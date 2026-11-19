// Configuración del chatbot: modelos, búsqueda, límites y tiempos máximos.

import path from 'node:path';

// Modelo de respuesta
export const CHAT_MODEL = 'gpt-6-luna';
export const REASONING_EFFORT = 'none';

export const MAX_OUTPUT_TOKENS = 600;
export const OPENAI_TIMEOUT_MS = 20_000;

// Embeddings y búsqueda (RAG)
export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_TIMEOUT_MS = 5_000;

// Rutas de los documentos y del índice
export const DATA_DIR = path.join(process.cwd(), 'data');
export const INDEX_FILE = path.join(process.cwd(), 'index', 'index.json');

// Fragmentos que se eligen por parecido con la pregunta.
export const TOP_K = 8;
// Si 2 o más de los elegidos son del mismo documento, la pregunta trata de ese
// tema y se añaden sus demás fragmentos, hasta este total.
export const MAX_CHUNKS = 9;
// Parecido mínimo (0-1) de los fragmentos elegidos.
export const MIN_SCORE = 0.3;
// Se envían siempre estos fragmentos
export const ALWAYS_INCLUDE_IDS = ['perfil#contacto', 'perfil#resumen-del-perfil'];

// Mensajes que llegan del navegador
export const MAX_MESSAGE_LENGTH = 500;
export const MAX_HISTORY_MESSAGES = 6;

export const MAX_ASSISTANT_MESSAGE_LENGTH = MAX_OUTPUT_TOKENS * 6;

// Límites de uso
export const DAILY_LIMIT_PER_IP = 20;
export const DAILY_LIMIT_GLOBAL = 300;

// Protección contra bots
export const BOTID_TIMEOUT_MS = 3_000; // si BotID no contesta, se deja pasar

// Proxy
// Cuántos proxies hay delante del servidor, para que req.ip sea la IP real.
export const TRUST_PROXY = parseTrustProxy(process.env.TRUST_PROXY);

function parseTrustProxy(value) {
  if (value === undefined || value.trim() === '') return process.env.VERCEL ? 1 : false;
  if (/^\d+$/.test(value.trim())) return Number(value);
  if (value.trim() === 'false') return false;
  return value;
}
