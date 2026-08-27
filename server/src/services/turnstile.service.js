import env from '../config/env.js';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TIMEOUT_MS = 8000;

/**
 * Verifica el token que Cloudflare Turnstile le entrega al navegador tras
 * resolver el reto anti-bot. Sin TURNSTILE_SECRET_KEY configurada el captcha
 * esta desactivado y siempre pasa (ver env.turnstile.enabled): asi el
 * registro sigue funcionando en desarrollo local o mientras no exista la
 * cuenta de Cloudflare.
 *
 * Si Cloudflare no responde (caido, tardo), se deja pasar: no tiene sentido
 * dejar a alguien de verdad sin poder registrarse por un problema ajeno,
 * sobre todo con el honeypot y el rate-limit ya cubriendo esa entrada. Si en
 * cambio Cloudflare SI contesta y dice que el token no es valido, ahi si se
 * bloquea: es una senal real, no un problema de red.
 */
export async function verificarTurnstile(token, ip) {
  if (!env.turnstile.enabled) return true;
  if (!token) return false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const body = new URLSearchParams({ secret: env.turnstile.secretKey, response: token });
    if (ip) body.set('remoteip', ip);

    const res = await fetch(VERIFY_URL, { method: 'POST', body, signal: controller.signal });
    if (!res.ok) return true;

    const data = await res.json();
    return Boolean(data.success);
  } catch {
    return true;
  } finally {
    clearTimeout(timer);
  }
}

export default { verificarTurnstile };
