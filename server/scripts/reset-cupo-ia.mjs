/**
 * Resetea el cupo mensual de generaciones con IA de un usuario en plan
 * personal (usoIA.generaciones a 0), sin tocar nada mas del perfil.
 *
 * Existe porque un bug (ya corregido) gastaba un cupo real en cada intento
 * fallido de generar itinerario -- no solo en los que si generaban algo.
 * Alguien que reintento varias veces mientras Gemini estaba saturado pudo
 * quemarse el mes entero sin un solo itinerario guardado. Este script
 * devuelve el cupo a quien le haya pasado eso.
 *
 * Por defecto solo muestra que va a cambiar (dry-run). Agrega --confirmar
 * para aplicarlo de verdad.
 *
 *   node scripts/reset-cupo-ia.mjs correo@ejemplo.com
 *   node scripts/reset-cupo-ia.mjs correo@ejemplo.com --confirmar
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from '../src/models/index.js';

const email = (process.argv[2] || '').toLowerCase().trim();
const confirmar = process.argv.includes('--confirmar');

if (!email) {
  console.error('Uso: node scripts/reset-cupo-ia.mjs <email> [--confirmar]');
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);

const user = await User.findOne({ email });
if (!user) {
  console.error(`No existe ningun usuario con el correo "${email}".`);
  await mongoose.disconnect();
  process.exit(1);
}

console.log(`\nUsuario: ${user.name} (${user.email})`);
console.log('Cupo actual:', JSON.stringify(user.usoIA, null, 2));

if (!confirmar) {
  console.log('\nDry-run: nada se cambió. Vuelve a correr con --confirmar para aplicarlo.\n');
  await mongoose.disconnect();
  process.exit(0);
}

user.usoIA.generaciones = 0;
await user.save({ validateBeforeSave: false });

console.log('\nListo: cupo de generaciones con IA reseteado a 0 para este mes.\n');
await mongoose.disconnect();
