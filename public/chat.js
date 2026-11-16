// Lógica del chat en el navegador: envía la pregunta y el historial a /api/chat
// y muestra la respuesta.

const MAX_HISTORY_MESSAGES = 6;
const REQUEST_TIMEOUT_MS = 40_000;

const form = document.getElementById('chat-form');
const input = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const messages = document.getElementById('messages');

// El servidor no guarda nada: el historial vive en la página y se pierde al recargar.
let chatHistory = [];
let isSending = false;

function addMessage(role, text) {
  const bubble = document.createElement('div');
  bubble.className = `message message--${role}`;
  bubble.textContent = text;
  messages.append(bubble);
  messages.scrollTop = messages.scrollHeight;
  return bubble;
}

// Error con el código HTTP, para saber si hay que vaciar el historial.
class ChatError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(message, signal) {
  let response;
  try {
    response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history: chatHistory }),
      signal,
    });
  } catch {
    throw new ChatError('No se ha podido conectar con el servidor.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    // El servidor siempre responde { error: "texto" }. Si no es un texto, la
    // respuesta viene de Vercel: el firewall, por ejemplo, envía { error: { code, message } }.
    const serverMessage = typeof data.error === 'string' ? data.error : undefined;
    if (response.status === 429 && !serverMessage) {
      throw new ChatError('Has enviado demasiados mensajes seguidos. Espera un momento y vuelve a intentarlo.', 429);
    }
    throw new ChatError(serverMessage ?? 'El servidor no ha podido responder.', response.status);
  }
  return data.reply;
}

function sendToServer(message) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new ChatError('La respuesta está tardando demasiado. Inténtalo de nuevo en un momento.'));
    }, REQUEST_TIMEOUT_MS);
  });
  return Promise.race([request(message, controller.signal), timeout]).finally(() => clearTimeout(timer));
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = input.value.trim();
  if (!message || isSending) return;

  isSending = true;
  sendButton.disabled = true;
  addMessage('user', message);
  input.value = '';
  const typing = addMessage('bot', 'Escribiendo…');
  typing.classList.add('message--typing');

  try {
    const reply = await sendToServer(message);
    addMessage('bot', reply);
    chatHistory.push({ role: 'user', content: message }, { role: 'assistant', content: reply });
    chatHistory = chatHistory.slice(-MAX_HISTORY_MESSAGES);
  } catch (error) {
    if (error.status === 400) chatHistory = [];
    addMessage('error', error.message);
  } finally {
    typing.remove();
    isSending = false;
    sendButton.disabled = false;
    if (document.activeElement === sendButton || document.activeElement === document.body) input.focus();
  }
});

addMessage('bot', '¡Hola! Soy el asistente virtual de Manuel. Puedo resolver tus dudas sobre su formación, su experiencia, sus proyectos o las tecnologías que utiliza. ¿Qué te gustaría saber?');
input.focus();
