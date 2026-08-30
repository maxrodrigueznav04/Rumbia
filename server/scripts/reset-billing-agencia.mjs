/**
 * Resetea el billing de una agencia a "pendiente", sin tocar nada mas
 * (nombre, logo, miembros, viajes siguen igual).
 *
 * Existe por el cambio de Stripe test -> live: los ids de cliente/suscripcion
 * que quedaron guardados de las pruebas en modo test no existen del lado
 * live, y Stripe los rechaza con "No such customer". Sin resetear el campo,
 * la agencia queda atascada mostrando "Administrar plan" (porque ya tiene un
 * stripeCustomerId) en vez de la pantalla para suscribirse de cero.
 *
 * Por defecto solo muestra que va a cambiar (dry-run). Agrega --confirmar
 * para aplicarlo de verdad.
 *
 *   node scripts/reset-billing-agencia.mjs dueno@correo.com
 *   node scripts/reset-billing-agencia.mjs dueno@correo.com --confirmar
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { Agency, User } from '../src/models/index.js';

const email = (process.argv[2] || '').toLowerCase().trim();
const confirmar = process.argv.includes('--confirmar');

if (!email) {
  console.error('Uso: node scripts/reset-billing-agencia.mjs <email-del-dueno> [--confirmar]');
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);

const user = await User.findOne({ email });
if (!user) {
  console.error(`No existe ningun usuario con el correo "${email}".`);
  await mongoose.disconnect();
  process.exit(1);
}
if (!user.agency) {
  console.error(`${email} no pertenece a ninguna agencia.`);
  await mongoose.disconnect();
  process.exit(1);
}

const agencia = await Agency.findById(user.agency);
if (!agencia) {
  console.error('Ese usuario apunta a una agencia que ya no existe.');
  await mongoose.disconnect();
  process.exit(1);
}
if (String(agencia.owner) !== String(user._id)) {
  console.error(`${email} pertenece a "${agencia.agencyName}" pero no es el dueño; solo el dueño tiene billing.`);
  await mongoose.disconnect();
  process.exit(1);
}

console.log(`\nAgencia: ${agencia.agencyName} (${agencia._id})`);
console.log('Billing actual:', JSON.stringify(agencia.billing, null, 2));

if (!confirmar) {
  console.log('\nDry-run: nada se cambió. Vuelve a correr con --confirmar para aplicarlo.\n');
  await mongoose.disconnect();
  process.exit(0);
}

agencia.billing = {
  stripeCustomerId: '',
  stripeSubscriptionId: '',
  plan: null,
  status: 'pendiente',
  extraAgentes: 0,
  periodoHasta: undefined,
};
await agencia.save();

console.log('\nListo: billing reseteado a "pendiente". La agencia va a volver a mostrar el formulario de suscripción.\n');
await mongoose.disconnect();
