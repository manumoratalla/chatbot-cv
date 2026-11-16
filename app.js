// Aplicación Express: define las rutas, pero no arranca el servidor.
// En local (o en Render) la arranca server.js; Vercel usa directamente esta exportación.

import express from 'express';
import path from 'node:path';
import { TRUST_PROXY } from './lib/config.js';
import { validateChatRequest } from './lib/validation.js';
import { answerQuestion } from './lib/chat.js';
import { checkRateLimit } from './lib/rate-limit.js';
import { botProtection } from './lib/bot-protection.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', TRUST_PROXY); // para que sea la IP real

// Página principal ("/"). En Vercel, express.static no la sirve, así que se envía a mano.
// s-maxage: Vercel la guarda en caché un día y así no ejecuta la función en cada visita.
app.get('/', (req, res) => {
  const options = { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=86400' } };
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'), options, (err) => {
    if (err && !res.headersSent) res.redirect('/index.html');
  });
});

// El resto de public/ en local. En Vercel lo sirve el CDN antes de llegar aquí.
app.use(express.static(path.join(import.meta.dirname, 'public')));

app.use(express.json({ limit: '20kb' })); // un cuerpo mayor se rechaza (413) sin procesarlo

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Orden de seguridad: bots → validación → límites → OpenAI.
app.post('/api/chat', botProtection, async (req, res) => {
  const { message, history, error } = validateChatRequest(req.body);
  if (error) return res.status(400).json({ error });

  const limit = await checkRateLimit(req.ip ?? 'desconocida');
  if (!limit.allowed) {
    res.set('Retry-After', String(limit.retryAfterSeconds));
    const limitMessage = limit.reason === 'ip'
      ? 'Has alcanzado el límite de preguntas por hoy. Vuelve a intentarlo mañana.'
      : 'El asistente ha alcanzado su límite de preguntas por hoy. Vuelve a intentarlo mañana.';
    return res.status(429).json({ error: limitMessage });
  }

  const { reply } = await answerQuestion(message, history);
  res.json({ reply });
});

// La API responde siempre en JSON, también cuando la ruta no existe.
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada.' });
});

// Manejador de errores: Express lo reconoce por tener 4 parámetros.
app.use((err, req, res, next) => {
  // Solo los errores del propio Express (JSON mal formado, cuerpo demasiado
  // grande) son culpa del visitante y traen expose = true. Los otros de OpenAI
  // (clave incorrecta, sin saldo...) no lo traen y se tratan como un 500.
  if (err.expose === true && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: 'La petición no es válida.' });
  }

  console.error(err.status ? err.message : err);
  res.status(500).json({
    error: 'No se ha podido generar la respuesta. Inténtalo de nuevo más tarde o usa los enlaces de contacto de la página.',
  });
});

export default app;
