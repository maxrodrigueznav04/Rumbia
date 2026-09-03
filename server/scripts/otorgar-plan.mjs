/**
 * Activa un plan de agencia a mano, sin pasar por Stripe. Para comprobar
 * cuentas propias, de prueba o de demostracion -- no para "regalar" un plan
 * a un cliente real, que si debe pagar por la app normal.
 *
 * Busca al usuario por correo, resuelve su agencia (tiene que pertenecer a
 * una ya), y pone billing.plan/status directo. No toca Stripe para nada: si
 * mas tarde esa agencia SI paga de verdad, el webhook de Stripe va a
 * sobreescribir esto con lo que corresponda, como es normal.
 *
 *   npm run otorgar-plan -- correo@ejemplo.com pro_mensual
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { User, Agency } from '../src/models/index.js';
import { PLANES_AGENCIA } from '../src/models/Agency.js';

const [email, plan] = process.argv.slice(2);

if (!email || !plan) {
  console.error('\nUso: npm run otorgar-plan -- correo@ejemplo.com <plan>\n');
  console.error(`Planes validos: ${PLANES_AGENCIA.join(', ')}\n`);
  process.exit(1);
}

if (!PLANES_AGENCIA.includes(plan)) {
  console.error(`\nPlan "${plan}" no existe. Planes validos: ${PLANES_AGENCIA.join(', ')}\n`);
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);

const user = await User.findOne({ email: email.toLowerCase().trim() });
if (!user) {
  console.error(`\nNo existe ninguna cuenta con el correo "${email}".\n`);
  process.exit(1);
}

if (!user.agency) {
  console.error(
    `\n"${email}" no pertenece a ninguna agencia todavia. Crea una agencia desde la app` +
      ' (Perfil -> Agencia) con esa cuenta y vuelve a correr este script.\n'
  );
  process.exit(1);
}

const agencia = await Agency.findById(user.agency);
if (!agencia) {
  console.error('\nLa agencia de esta cuenta ya no existe.\n');
  process.exit(1);
}

agencia.billing.plan = plan;
agencia.billing.status = 'activa';
await agencia.save();

console.log(`\nListo: "${agencia.agencyName}" (dueño: ${email}) quedó en plan "${plan}", estado activa.\n`);

await mongoose.disconnect();
