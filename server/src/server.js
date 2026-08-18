import app from './app.js';
import env from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';

await connectDB();

const server = app.listen(env.port, () => {
  console.log(`[server] Rumbo API escuchando en http://localhost:${env.port} (${env.nodeEnv})`);
  if (!env.gemini.enabled) console.warn('[server] GEMINI_API_KEY ausente: la generacion con IA queda deshabilitada.');
  if (!env.openWeather.enabled) console.warn('[server] OPENWEATHER_API_KEY ausente: el clima usara solo estimaciones.');
});

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
});
