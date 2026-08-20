/**
 * Reporte de clics de salida en la terminal.
 *
 * Existe para no depender de ADMIN_EMAIL ni de tener el front abierto: con
 * acceso a la base ya se puede responder la pregunta que importa, que es qué
 * proveedores se pulsan de verdad.
 *
 *   npm run clicks           -> ultimos 30 dias
 *   npm run clicks -- 90     -> ultimos 90 dias
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import ClickSalida from '../src/models/ClickSalida.js';

const dias = Math.min(Math.max(Number(process.argv[2]) || 30, 1), 180);
const desde = new Date(Date.now() - dias * 86400000);

const tabla = (titulo, filas, total) => {
  console.log(`\n${titulo}`);
  if (!filas.length) {
    console.log('  (sin datos)');
    return;
  }
  const ancho = Math.max(...filas.map((f) => String(f._id || 'sin dato').length));
  for (const f of filas) {
    const nombre = String(f._id || 'sin dato').padEnd(ancho);
    const pct = total ? ((f.clicks / total) * 100).toFixed(1).padStart(5) : '    -';
    const barra = '#'.repeat(Math.round((f.clicks / (filas[0].clicks || 1)) * 24));
    const extra = f.afiliado ? `  (${f.afiliado} de afiliado)` : '';
    console.log(`  ${nombre}  ${String(f.clicks).padStart(5)}  ${pct}%  ${barra}${extra}`);
  }
};

await mongoose.connect(process.env.MONGO_URI);

const enRango = { createdAt: { $gte: desde } };
const total = await ClickSalida.countDocuments(enRango);

console.log(`\nClics de salida — últimos ${dias} días — ${total} en total`);

if (total === 0) {
  console.log('\nTodavía no hay clics registrados.');
} else {
  const agrupar = (campo, extra = {}) =>
    ClickSalida.aggregate([
      { $match: { ...enRango, ...extra } },
      { $group: { _id: `$${campo}`, clicks: { $sum: 1 }, afiliado: { $sum: { $cond: ['$esAfiliado', 1, 0] } } } },
      { $sort: { clicks: -1 } },
      { $limit: 20 },
    ]);

  tabla('Por proveedor', await agrupar('provider'), total);
  tabla('Por sección', await agrupar('section'), total);
  tabla('Por origen', await agrupar('origen'), total);
  tabla('Destinos más buscados', await agrupar('destination', { destination: { $nin: [null, ''] } }), total);
}

console.log();
await mongoose.disconnect();
