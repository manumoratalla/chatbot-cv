// Validación de lo que envía el navegador. El HTML ya limita la longitud,
// pero el servidor no se fía: cualquiera puede llamar a la API directamente.

import { MAX_MESSAGE_LENGTH, MAX_HISTORY_MESSAGES, MAX_ASSISTANT_MESSAGE_LENGTH } from './config.js';

const INVALID_HISTORY = { error: 'El historial no es válido.' };

// Devuelve { history } con una copia limpia (solo role y content) o { error }.
function validateHistory(history) {
  if (history === undefined) return { history: [] };
  if (!Array.isArray(history)) return INVALID_HISTORY;

  const recent = history.slice(-MAX_HISTORY_MESSAGES);

  for (const item of recent) {
    const validRole = item?.role === 'user' || item?.role === 'assistant';
    const isText = typeof item?.content === 'string' && item.content.trim().length > 0;
    const userTooLong = isText && item.role === 'user' && item.content.length > MAX_MESSAGE_LENGTH;
    if (!validRole || !isText || userTooLong) return INVALID_HISTORY;
  }

  // Las respuestas del asistente solo sirven de contexto: si una es muy larga
  // se recorta, en vez de rechazar todo el historial y bloquear el chat.
  return {
    history: recent.map(({ role, content }) => ({
      role,
      content: role === 'assistant' ? content.slice(0, MAX_ASSISTANT_MESSAGE_LENGTH) : content,
    })),
  };
}

// Devuelve { message, history } o { error }.
export function validateChatRequest(body) {
  if (typeof body?.message !== 'string') return { error: 'Falta el mensaje.' };

  const message = body.message.trim();
  if (message.length === 0) return { error: 'El mensaje está vacío.' };
  if (message.length > MAX_MESSAGE_LENGTH) {
    return { error: `El mensaje no puede superar los ${MAX_MESSAGE_LENGTH} caracteres.` };
  }

  const { history, error } = validateHistory(body.history);
  if (error) return { error };

  return { message, history };
}
