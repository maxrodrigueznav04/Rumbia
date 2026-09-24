/**
 * Script operativo para procesar tareas externas pendientes de Stripe (P02).
 * Puede ejecutarse periódicamente (cron/worker) o bajo demanda.
 *
 * Exige conexión estrictamente local a MongoDB y base autorizada.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { validarMongoUriLocal } from './test-p02-regression.mjs';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'cambia_esto_por_una_cadena_larga_y_aleatoria') {
  process.env.JWT_SECRET = 'test_only_rumbia_operational_script_secret_1234567890';
}

const mongoUri = process.env.MONGO_URI_TEST || process.env.TEST_MONGO_URI || process.env.MONGO_URI;

if (!mongoUri) {
  console.error('[procesar-pendientes-billing] Define MONGO_URI_TEST o MONGO_URI antes de ejecutar.');
  process.exit(1);
}

try {
  validarMongoUriLocal(mongoUri);
} catch (err) {
  console.error('[procesar-pendientes-billing] Error de seguridad:', err.message);
  process.exit(1);
}

const { procesarPendientesBilling } = await import('../src/services/billingQueue.service.js');

await mongoose.connect(mongoUri);
console.log('[procesar-pendientes-billing] Conectado a MongoDB. Procesando cola...');

const res = await procesarPendientesBilling();
console.log(`[procesar-pendientes-billing] Resultados:`, res);

await mongoose.disconnect();
console.log('[procesar-pendientes-billing] Finalizado.');
