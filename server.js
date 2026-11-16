// Arranca el servidor en local (npm run dev / npm start) o en hostings como Render.
// Vercel no lo usa: importa directamente la app de app.js.

import app from './app.js';
import { RATE_LIMIT_STORE } from './lib/rate-limit.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor funcionando en http://localhost:${PORT}`);
  console.log(`Límites de uso guardados en: ${RATE_LIMIT_STORE}`);
});
