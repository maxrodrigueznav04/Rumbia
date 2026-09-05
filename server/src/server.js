import app from './app.js';
import env from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { initSentry, reportarError } from './config/sentry.js';

// Antes que cualquier otra cosa: sin SENTRY_DSN es un no-op (ver sentry.js).
initSentry();

await connectDB();

const server = app.listen(env.port, () => {
  console.log(`[server] Rumbia API escuchando en http://localhost:${env.port} (${env.nodeEnv})`);
  if (!env.gemini.enabled) console.warn('[server] GEMINI_API_KEY ausente: la generacion con IA queda deshabilitada.');
  if (!env.openWeather.enabled) console.warn('[server] OPENWEATHER_API_KEY ausente: el clima usara solo estimaciones.');
});

// Corta clientes lentos sin interrumpir una generacion valida de IA (150 s).
server.requestTimeout = 190000;
server.headersTimeout = 15000;
server.keepAliveTimeout = 5000;

async function shutdown(signal) {
  console.log(`\n[server] ${signal} recibido, cerrando...`);
  server.close(async () => {
    await disconnectDB();
    process.exit(0);
  });
  // Si algo se queda colgado, no bloquear el redeploy indefinidamente.
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  console.error('[server] Promesa rechazada sin manejar:', reason);
  reportarError(reason instanceof Error ? reason : new Error(String(reason)));
});
