// Acceso a la API de OpenAI. El resto del proyecto solo usa generateReply() y
// createEmbeddings(): cambiar de proveedor (por ejemplo, Anthropic) afectaría únicamente a este archivo.

import OpenAI from 'openai';
import {
  CHAT_MODEL, REASONING_EFFORT, MAX_OUTPUT_TOKENS, OPENAI_TIMEOUT_MS,
  EMBEDDING_MODEL, EMBEDDING_TIMEOUT_MS,
} from './config.js';

// El cliente se crea con la primera pregunta
let client;

function getClient() {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('Falta OPENAI_API_KEY. Crea el archivo .env a partir de .env.example.');
    }
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: OPENAI_TIMEOUT_MS, maxRetries: 1 });
  }
  return client;
}

export async function generateReply(instructions, input) {
  const response = await getClient().responses.create({
    model: CHAT_MODEL,
    instructions,
    input,
    reasoning: { effort: REASONING_EFFORT },
    max_output_tokens: MAX_OUTPUT_TOKENS,
    store: false, // OpenAI no guarda la conversación
  });

  const { usage } = response;
  if (usage) {
    const cached = usage.input_tokens_details?.cached_tokens ?? 0;
    console.log(`Tokens: ${usage.input_tokens} de entrada (${cached} en caché), ${usage.output_tokens} de salida`);
  }
  if (response.status === 'incomplete') {
    console.warn(`Respuesta cortada antes de terminar (${response.incomplete_details?.reason ?? 'motivo desconocido'}).`);
  }

  return response.output_text || 'No he podido generar una respuesta. Prueba a reformular la pregunta.';
}

// Un vector por texto, en el mismo orden, y los tokens usados.
export async function createEmbeddings(texts) {
  const response = await getClient().embeddings.create(
    { model: EMBEDDING_MODEL, input: texts },
    { timeout: EMBEDDING_TIMEOUT_MS },
  );

  const vectors = response.data
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);

  return { vectors, tokens: response.usage.total_tokens };
}
