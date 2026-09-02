// Crea en Stripe los Products/Prices que necesita el cobro a agencias, y
// deja listas las lineas para pegar en .env. Correrlo dos veces no duplica
// nada: usa lookup_key para encontrar lo que ya existe antes de crear.
//
//   cd server && npm run stripe:setup
//
// Requiere STRIPE_SECRET_KEY en el .env (modo test o modo live, segun cual
// uses). Los montos estan en USD: cambia MONEDA y PRECIOS abajo si prefieres
// cobrar en otra divisa.

import 'dotenv/config';
import Stripe from 'stripe';

const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY) {
  console.error('\nFalta STRIPE_SECRET_KEY en server/.env. Consiguela en https://dashboard.stripe.com/apikeys\n');
  process.exit(1);
}

const stripe = new Stripe(KEY);
const MONEDA = 'usd';

// Planes oficiales:
// - Inicio / Solo: $9.99/mes, $104.99/año (1 a 3 agentes)
// - Agencia: $23.99/mes, $249.99/año (4 a 8 agentes)
// - Agencia Pro: $39.99/mes, $419.99/año (hasta 15 agentes, +$4/mes por agente 16+)
const PRECIOS = [
  { plan: 'inicio_mensual', nombre: 'Rumbia — Inicio Mensual', base: 999, agente: null, recurring: { interval: 'month' } },
  { plan: 'inicio_anual', nombre: 'Rumbia — Inicio Anual', base: 10499, agente: null, recurring: { interval: 'year' } },
  { plan: 'agencia_mensual', nombre: 'Rumbia — Agencia Mensual', base: 2399, agente: null, recurring: { interval: 'month' } },
  { plan: 'agencia_anual', nombre: 'Rumbia — Agencia Anual', base: 24999, agente: null, recurring: { interval: 'year' } },
  { plan: 'pro_mensual', nombre: 'Rumbia — Agencia Pro Mensual', base: 3999, agente: 400, recurring: { interval: 'month' } },
  { plan: 'pro_anual', nombre: 'Rumbia — Agencia Pro Anual', base: 41999, agente: 4200, recurring: { interval: 'year' } },
];

async function buscarOCrearPrice({ lookupKey, nombre, montoCentavos, recurring }) {
  const existentes = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  if (existentes.data.length) {
    console.log(`  ok  ${lookupKey} ya existe -> ${existentes.data[0].id}`);
    return existentes.data[0];
  }

  const producto = await stripe.products.create({ name: nombre });
  const price = await stripe.prices.create({
    product: producto.id,
    currency: MONEDA,
    unit_amount: montoCentavos,
    lookup_key: lookupKey,
    ...(recurring ? { recurring } : {}),
  });
  console.log(`  creado  ${lookupKey} -> ${price.id}`);
  return price;
}

console.log(`\nCreando/verificando precios en Stripe (moneda: ${MONEDA.toUpperCase()})...\n`);

const lineasEnv = [];
for (const { plan, nombre, base, agente, recurring } of PRECIOS) {
  const precioBase = await buscarOCrearPrice({
    lookupKey: `agencia_${plan}_base`,
    nombre,
    montoCentavos: base,
    recurring,
  });
  lineasEnv.push(`STRIPE_PRICE_${plan.toUpperCase()}_BASE=${precioBase.id}`);

  if (agente) {
    const precioAgente = await buscarOCrearPrice({
      lookupKey: `agencia_${plan}_agente`,
      nombre: `${nombre} (agente extra)`,
      montoCentavos: agente,
      recurring,
    });
    lineasEnv.push(`STRIPE_PRICE_${plan.toUpperCase()}_AGENTE=${precioAgente.id}`);
  }
}

console.log('\nPega esto en server/.env (y en las variables de entorno de Render):\n');
console.log(lineasEnv.join('\n'));
console.log('');
