// Protección contra bots con Vercel BotID (solo actúa en Vercel).

import { checkBotId } from 'botid/server';
import { BOTID_TIMEOUT_MS } from './config.js';

const ON_VERCEL = Boolean(process.env.VERCEL);

export async function botProtection(req, res, next) {
  if (!ON_VERCEL) return next();

  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`sin respuesta en ${BOTID_TIMEOUT_MS} ms`)), BOTID_TIMEOUT_MS);
  });

  try {
    const { isBot } = await Promise.race([checkBotId(), timeout]);
    if (isBot) {
      console.warn('BotID ha bloqueado una petición a /api/chat.');
      return res.status(403).json({
        error: 'No se ha podido comprobar que estés usando un navegador. Recarga la página y vuelve a intentarlo.',
      });
    }
  } catch (error) {
    console.error('BotID no ha podido comprobar la petición:', error.message);
  } finally {
    clearTimeout(timer);
  }

  next();
}
