// Activa Vercel BotID en el navegador

import { initBotId } from './vendor/botid-client-core.js';

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];
const isLocal = LOCAL_HOSTS.includes(location.hostname) || location.hostname.endsWith('.localhost');

if (!isLocal) {
  globalThis.process ??= { env: { NODE_ENV: 'production' } };
  initBotId({ protect: [{ path: '/api/chat', method: 'POST' }] });
}
