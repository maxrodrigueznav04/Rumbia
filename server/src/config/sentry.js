import * as Sentry from '@sentry/node';
import env from './env.js';

/**
 * Monitoreo de errores, apagado por default (mismo patron que Cloudinary,
 * Turnstile y Stripe): sin SENTRY_DSN esto es un no-op completo, el servidor
 * arranca y corre exactamente igual que sin esta integracion.
 *
 * Se llama UNA VEZ al arrancar, antes que cualquier otra cosa: Sentry
 * necesita inicializarse antes de que ocurra el error que se quiere
 * capturar, no despues.
 */
export function initSentry() {
  if (!env.sentryDsn) return;
  Sentry.init({
    dsn: env.sentryDsn,
    environment: env.nodeEnv,
    // Sin tracesSampleRate: solo se capturan errores, no se instrumenta cada
    // peticion como transaccion. Mas simple, y el tier gratuito de Sentry
    // cobra por evento -- no tiene caso gastarlo en trazas de performance
    // cuando lo que hace falta hoy es simplemente saber que algo se rompio.
  });
}

/**
 * Reporta un error real a Sentry, si esta configurado. Deliberadamente
 * separado de errorHandler.js (que decide QUE es un error real, filtrando
 * los 503 esperados de servicios externos) para no acoplar ese archivo a
 * Sentry -- errorHandler.js sigue funcionando igual si algun dia se cambia
 * o se quita el monitoreo.
 */
export function reportarError(err) {
  if (!env.sentryDsn) return;
  Sentry.captureException(err);
}

export default { initSentry, reportarError };
