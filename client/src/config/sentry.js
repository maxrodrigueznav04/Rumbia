import * as Sentry from '@sentry/react';

/**
 * Monitoreo de errores, apagado por default (mismo patron que el servidor):
 * sin VITE_SENTRY_DSN esto es un no-op completo, la app corre exactamente
 * igual que sin esta integracion.
 *
 * Se llama UNA VEZ al arrancar (main.jsx), antes de montar la app.
 */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Sin tracesSampleRate ni replaysSessionSampleRate: solo errores, nada
    // de performance ni grabacion de sesion -- el tier gratuito de Sentry
    // cobra por evento, y lo que hace falta hoy es solo saber que algo se
    // rompio, no instrumentar cada interaccion.
  });
}

/**
 * Reporta un error a Sentry, si esta configurado. Usado por LimiteDeError.jsx
 * (errores de render) y por el listener global de abajo (errores fuera del
 * ciclo de render de React: un event handler, una promesa sin capturar).
 */
export function reportarError(error, contexto) {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  Sentry.captureException(error, contexto ? { contexts: contexto } : undefined);
}

/**
 * Errores fuera del ciclo de render (un event handler que revienta, una
 * promesa sin .catch) nunca pasan por LimiteDeError.jsx -- React solo
 * intercepta errores de render/commit. Sin esto, esa clase entera de bugs
 * seria invisible para Sentry aunque este configurado.
 */
export function instalarListenersGlobales() {
  if (!import.meta.env.VITE_SENTRY_DSN) return;
  window.addEventListener('error', (event) => {
    if (event.error instanceof Error) reportarError(event.error);
  });
  window.addEventListener('unhandledrejection', (event) => {
    const razon = event.reason;
    reportarError(razon instanceof Error ? razon : new Error(String(razon)));
  });
}

export default { initSentry, reportarError, instalarListenersGlobales };
