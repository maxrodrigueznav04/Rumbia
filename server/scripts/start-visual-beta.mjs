import 'dotenv/config';
import mongoose from 'mongoose';
import { assertVisualBetaDatabase, seedVisualBeta } from './lib/visualBeta.js';

assertVisualBetaDatabase(process.env.MONGO_URI);
if (process.env.STRIPE_SECRET_KEY || process.env.STRIPE_WEBHOOK_SECRET) {
  throw new Error('El entorno beta debe usar datos de prueba y no necesita claves de Stripe.');
}
process.env.VISUAL_TEMPLATES_ENABLED = 'true';
await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
try {
  const agencyId = await seedVisualBeta({ email: process.env.BETA_OWNER_EMAIL, password: process.env.BETA_OWNER_PASSWORD });
  process.env.VISUAL_TEMPLATES_AGENCIES = agencyId;
  console.log(`[beta] Cuenta de prueba preparada; agencia autorizada: ${agencyId}.`);
} finally {
  await mongoose.disconnect();
}
await import('../src/server.js');
