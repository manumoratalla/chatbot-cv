// Compara la pregunta con los fragmentos del índice
// y elige los que se envían al modelo.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { EMBEDDING_MODEL, TOP_K, MAX_CHUNKS, MIN_SCORE, ALWAYS_INCLUDE_IDS } from './config.js';
import { createEmbeddings } from './openai.js';


let indexCache;

async function loadIndex() {
  if (indexCache) return indexCache;

  let content;
  try {
    content = await readFile(path.join(process.cwd(), 'index', 'index.json'), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`No existe index/index.json en ${process.cwd()}. Ejecuta "npm run index" desde la raíz del proyecto.`);
    }
    throw error;
  }

  const index = JSON.parse(content);
  // Los vectores de modelos distintos no se pueden comparar.
  if (index.embeddingModel !== EMBEDDING_MODEL) {
    throw new Error(`El índice se creó con "${index.embeddingModel}", pero la configuración usa "${EMBEDDING_MODEL}". Ejecuta "npm run index".`);
  }

  indexCache = index;
  return indexCache;
}


function dotProduct(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

// Todos los fragmentos, del más al menos parecido al texto de búsqueda.
export async function rankChunks(searchText) {
  const { chunks } = await loadIndex();
  const { vectors } = await createEmbeddings([searchText]);
  return chunks
    .map(({ id, title, text, embedding }) => ({ id, title, text, score: dotProduct(vectors[0], embedding) }))
    .sort((a, b) => b.score - a.score);
}

const documentOf = (chunk) => chunk.id.split('#')[0];

// Elige los fragmentos que se envían al modelo:
//   1. Los que superan MIN_SCORE, como mucho TOP_K.
//   2. Si 2 o más son del mismo documento, la pregunta trata de ese tema: se
//      añaden sus demás fragmentos
//   3. Los de ALWAYS_INCLUDE_IDS (el de contacto).
export function selectChunks(rankedChunks) {
  const selected = rankedChunks.filter((chunk) => chunk.score >= MIN_SCORE).slice(0, TOP_K);

  const documents = selected.map(documentOf);
  const topics = new Set(documents.filter((doc, i) => documents.indexOf(doc) !== i));
  for (const chunk of rankedChunks) {
    if (selected.length >= MAX_CHUNKS) break;
    if (topics.has(documentOf(chunk)) && !selected.includes(chunk)) selected.push(chunk);
  }

  for (const id of ALWAYS_INCLUDE_IDS) {
    const chunk = rankedChunks.find((c) => c.id === id);
    if (chunk && !selected.includes(chunk)) selected.push(chunk);
  }

  return selected;
}
