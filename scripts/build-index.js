// Crea index/index.json a partir de los documentos de data/.
// Se ejecuta a mano cada vez que cambian los documentos:
//   npm run index:preview  → muestra los fragmentos, sin llamar a OpenAI
//   npm run index          → calcula los embeddings y guarda el índice

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR, INDEX_FILE, EMBEDDING_MODEL } from '../lib/config.js';
import { readDocuments, splitIntoChunks } from '../lib/documents.js';
import { createEmbeddings } from '../lib/openai.js';

const isPreview = process.argv.includes('--preview');

async function main() {
  let documents;
  try {
    documents = await readDocuments(DATA_DIR);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('No existe la carpeta data/. Copia data.example/ como data/ (o crea tus propios documentos) y vuelve a ejecutar el comando.');
    }
    throw error;
  }
  if (documents.length === 0) throw new Error(`No hay documentos .md en ${DATA_DIR}`);

  const chunks = documents.flatMap(({ name, content }) => splitIntoChunks(name, content));
  console.log(`${documents.length} documentos -> ${chunks.length} fragmentos\n`);

  if (isPreview) {
    for (const chunk of chunks) {
      console.log(`[${chunk.id}]  (${chunk.text.length} caracteres)\n${chunk.text}\n`);
    }
    console.log('Vista previa: no se ha llamado a OpenAI ni se ha guardado nada.');
    return;
  }

  console.log(`Creando embeddings con ${EMBEDDING_MODEL}...`);
  const { vectors, tokens } = await createEmbeddings(chunks.map((chunk) => chunk.text));

  const index = {
    embeddingModel: EMBEDDING_MODEL, // se comprueba al cargar el índice
    createdAt: new Date().toISOString(),
    chunks: chunks.map((chunk, i) => ({ ...chunk, embedding: vectors[i] })),
  };

  await mkdir(path.dirname(INDEX_FILE), { recursive: true });
  await writeFile(INDEX_FILE, JSON.stringify(index));

  console.log(`Índice guardado en ${path.relative(process.cwd(), INDEX_FILE)}`);
  console.log(`${chunks.length} fragmentos · ${vectors[0].length} dimensiones · ${tokens} tokens`);
}

main().catch((error) => {
  console.error('Error al crear el índice:', error.message);
  process.exitCode = 1;
});
