/**
 * Registro de auditoria en la terminal: acciones sensibles de dueños de
 * agencia y de la cuenta admin (sacar un agente, regenerar el codigo,
 * borrar una agencia, o admin uniendose saltandose plan/cupo).
 *
 * Existe por el mismo motivo que clicks.mjs: no depender de ADMIN_EMAIL ni
 * de tener el front abierto para responder "¿quien hizo esto, cuando?".
 *
 *   npm run auditoria           -> ultimos 100 eventos
 *   npm run auditoria -- 20     -> ultimos 20 eventos
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import AuditLog from '../src/models/AuditLog.js';
// Sin importar Agency, mongoose no tiene su schema registrado y el populate
// de abajo truena con "Schema hasn't been registered for model 'Agency'".
import '../src/models/Agency.js';

const limite = Math.min(Math.max(Number(process.argv[2]) || 100, 1), 500);

await mongoose.connect(process.env.MONGO_URI);

const eventos = await AuditLog.find({})
  .sort({ createdAt: -1 })
  .limit(limite)
  .populate('agency', 'agencyName')
  .lean();

console.log(`\nRegistro de auditoría — últimos ${eventos.length} evento(s)\n`);

if (!eventos.length) {
  console.log('Todavía no hay eventos registrados.');
} else {
  for (const e of eventos) {
    const fecha = new Date(e.createdAt).toISOString().replace('T', ' ').slice(0, 19);
    const agencia = e.agency?.agencyName || '(agencia ya no existe)';
    const detalle = e.detalle ? ` — ${e.detalle}` : '';
    console.log(`${fecha}  ${e.accion.padEnd(28)}  ${e.actorEmail || e.actorNombre}  [${agencia}]${detalle}`);
  }
}

console.log();
await mongoose.disconnect();
