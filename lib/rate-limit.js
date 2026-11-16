// Límites de uso diarios: por IP y global (valores en lib/config.js).
// Los contadores van en Upstash Redis porque en Vercel cada petición puede
// ejecutarse en una instancia distinta y la memoria no se comparte.

import { createHmac } from 'node:crypto';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { DAILY_LIMIT_PER_IP, DAILY_LIMIT_GLOBAL } from './config.js';

// Al conectar Upstash desde el Marketplace de Vercel, las variables se llaman KV_*.
const upstashUrl = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const useUpstash = Boolean(upstashUrl && upstashToken);

export const RATE_LIMIT_STORE = useUpstash ? 'Upstash' : 'memoria (solo para pruebas en local)';

const ENVIRONMENT = process.env.VERCEL_ENV ?? 'local';

// La IP no se guarda tal cual, sino seudonimizada con una clave secreta
const ipHashSecret = process.env.IP_HASH_SECRET;

if (process.env.VERCEL && !useUpstash) {
  console.warn('AVISO: sin Upstash, los límites de uso no funcionan en Vercel. Configura UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN.');
}
if (process.env.VERCEL && !ipHashSecret) {
  console.warn('AVISO: falta IP_HASH_SECRET, así que las IPs se guardan sin seudonimizar.');
}

function ipKey(ip) {
  return ipHashSecret ? createHmac('sha256', ipHashSecret).update(ip).digest('base64url') : ip;
}

// Ventana fija de un día
let upstashLimiters;

function getUpstashLimiters() {
  if (!upstashLimiters) {
    const redis = new Redis({ url: upstashUrl, token: upstashToken });
    const limiter = (max, name) => new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(max, '1 d'),
      prefix: `chatbot-cv:${ENVIRONMENT}:${name}`,
      timeout: 1000,
    });
    upstashLimiters = { perIp: limiter(DAILY_LIMIT_PER_IP, 'ip'), global: limiter(DAILY_LIMIT_GLOBAL, 'global') };
  }
  return upstashLimiters;
}

// Contadores en memoria (solo en local): se vacían al cambiar el día UTC.
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const memoryCounters = new Map();
let memoryDay;

function memoryLimit(key, max) {
  const today = Math.floor(Date.now() / ONE_DAY_MS);
  if (today !== memoryDay) {
    memoryCounters.clear();
    memoryDay = today;
  }
  const count = (memoryCounters.get(key) ?? 0) + 1;
  memoryCounters.set(key, count);
  return { success: count <= max, reset: (today + 1) * ONE_DAY_MS }; // misma forma que Upstash
}

async function countRequest(type, key, max) {
  if (!useUpstash) return memoryLimit(`${type}:${key}`, max);

  const result = await getUpstashLimiters()[type].limit(key);
  if (result.reason === 'timeout') {
    console.warn('Upstash no ha respondido a tiempo: se deja pasar la pregunta sin contarla.');
  }
  return result;
}

// Devuelve { allowed: true } o { allowed: false, reason: 'ip' | 'global', retryAfterSeconds }.
export async function checkRateLimit(ip) {
  try {
    // Primero la IP: si ya agotó su cupo, no gasta una pregunta del global.
    const perIp = await countRequest('perIp', ipKey(ip), DAILY_LIMIT_PER_IP);
    if (!perIp.success) return blocked('ip', perIp.reset);

    const global = await countRequest('global', 'all', DAILY_LIMIT_GLOBAL);
    if (!global.success) return blocked('global', global.reset);

    return { allowed: true };
  } catch (error) {
    // Fail-open: si Upstash falla, se deja pasar.
    console.error('Error al comprobar los límites de uso:', error.message);
    return { allowed: true };
  }
}

function blocked(reason, reset) {
  return { allowed: false, reason, retryAfterSeconds: Math.max(1, Math.ceil((reset - Date.now()) / 1000)) };
}
