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

// $20/mes, $200/año (~17% menos que 12 meses corridos), $500 de por vida
// (~25 meses de mensualidad). El agente extra sigue la misma proporcion que
// el plan base en cada cadencia: $10/mes, $100/año, $250 de por vida.
const PRECIOS = [
  { plan: 'mensual', nombre: 'Rumbo Agencia — Mensual', base: 2000, agente: 1000, recurring: { interval: 'month' } },
  { plan: 'anual', nombre: 'Rumbo Agencia — Anual', base: 20000, agente: 10000, recurring: { interval: 'year' } },
  { plan: 'vitalicio', nombre: 'Rumbo Agencia — De por vida', base: 50000, agente: 25000, recurring: null },
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
    nombre: `${nombre} (base, hasta 3 agentes)`,
    montoCentavos: base,
    recurring,
  });
  const precioAgente = await buscarOCrearPrice({
    lookupKey: `agencia_${plan}_agente`,
    nombre: `${nombre} (agente extra)`,
    montoCentavos: agente,
    recurring,
  });

  lineasEnv.push(`STRIPE_PRICE_${plan.toUpperCase()}_BASE=${precioBase.id}`);
  lineasEnv.push(`STRIPE_PRICE_${plan.toUpperCase()}_AGENTE=${precioAgente.id}`);
}

console.log('\nPega esto en server/.env (y en las variables de entorno de Render):\n');
console.log(lineasEnv.join('\n'));
console.log('');
