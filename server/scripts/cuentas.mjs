/**
 * Reporte de cuentas registradas en la terminal.
 *
 * Existe por el mismo motivo que clicks.mjs y auditoria.mjs: no depender de
 * ADMIN_EMAIL ni de tener el front abierto para responder "¿está entrando
 * gente de verdad?" -- a diferencia del tráfico crudo de Cloudflare (que
 * cuenta bots, assets y escaneos de puertos), cada fila aquí es una cuenta
 * que de verdad se registró.
 *
 *   npm run cuentas           -> ultimos 30 dias
 *   npm run cuentas -- 7      -> ultimos 7 dias
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/models/User.js';
// Sin importar Agency, mongoose no tiene su schema registrado y el populate
// de abajo truena con "Schema hasn't been registered for model 'Agency'".
import '../src/models/Agency.js';

const dias = Math.min(Math.max(Number(process.argv[2]) || 30, 1), 180);
const desde = new Date(Date.now() - dias * 86400000);

const tabla = (titulo, filas, total) => {
  console.log(`\n${titulo}`);
  if (!filas.length) {
    console.log('  (sin datos)');
    return;
  }
  const ancho = Math.max(...filas.map((f) => String(f._id ?? 'sin dato').length));
  for (const f of filas) {
    const nombre = String(f._id ?? 'sin dato').padEnd(ancho);
    const pct = total ? ((f.cantidad / total) * 100).toFixed(1).padStart(5) : '    -';
    const barra = '#'.repeat(Math.round((f.cantidad / (filas[0].cantidad || 1)) * 24));
    console.log(`  ${nombre}  ${String(f.cantidad).padStart(5)}  ${pct}%  ${barra}`);
  }
};

await mongoose.connect(process.env.MONGO_URI);

const totalGeneral = await User.countDocuments({});
const enRango = { createdAt: { $gte: desde } };
const nuevas = await User.countDocuments(enRango);

console.log(`\nCuentas registradas — últimos ${dias} días — ${nuevas} nueva(s) de ${totalGeneral} en total`);

if (totalGeneral === 0) {
  console.log('\nTodavía no hay cuentas registradas.');
} else {
  const agrupar = (campo) =>
    User.aggregate([
      { $match: enRango },
      { $group: { _id: `$${campo}`, cantidad: { $sum: 1 } } },
      { $sort: { cantidad: -1 } },
    ]);

  tabla('Por tipo de uso', await agrupar('preferences.perfilUso'), nuevas);

  const verificadas = await User.aggregate([
    { $match: enRango },
    { $group: { _id: '$emailVerified', cantidad: { $sum: 1 } } },
  ]);
  tabla(
    'Correo verificado',
    verificadas.map((v) => ({ _id: v._id ? 'sí' : 'no', cantidad: v.cantidad })),
    nuevas
  );

  const conAgencia = await User.countDocuments({ ...enRango, agency: { $ne: null } });
  console.log(`\nCon agencia: ${conAgencia} de ${nuevas} nueva(s)`);

  const recientes = await User.find(enRango)
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('agency', 'agencyName')
    .select('name email createdAt emailVerified agency')
    .lean();

  console.log(`\nÚltimas ${recientes.length} cuenta(s) (máx. 50)\n`);
  for (const u of recientes) {
    const fecha = new Date(u.createdAt).toISOString().replace('T', ' ').slice(0, 16);
    const verificado = u.emailVerified ? 'verificado' : 'sin verificar';
    const agencia = u.agency?.agencyName ? `  [${u.agency.agencyName}]` : '';
    console.log(`${fecha}  ${u.email.padEnd(32)}  ${(u.name || '').padEnd(24)}  ${verificado}${agencia}`);
  }
}

console.log();
await mongoose.disconnect();
