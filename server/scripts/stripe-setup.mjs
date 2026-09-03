// Crea en Stripe los Products/Prices que necesita el cobro a agencias, y
// deja listas las lineas para pegar en .env. Correrlo dos veces no duplica
// nada: usa lookup_key para encontrar lo que ya existe antes de crear.
//
//   cd server && npm run stripe:setup
//
// Requiere STRIPE_SECRET_KEY en el .env (modo test o modo live, segun cual
// uses). Los montos estan en MXN: cambia MONEDA y PRECIOS abajo si prefieres
// cobrar en otra divisa.
//
// El lookup_key incluye la moneda a proposito: muchas tarjetas mexicanas
// rechazan cargos en una divisa extranjera aunque Stripe intente mostrar el
// precio convertido (ver "Adaptive Pricing"), asi que se cobra nativo en
// MXN. Si algun dia cambia la moneda otra vez, el sufijo evita que el script
// reutilice por error un Price viejo en otra divisa con el mismo lookup_key
// (Stripe exige que sean unicos solo entre Prices activos).

import 'dotenv/config';
import Stripe from 'stripe';

const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY) {
  console.error('\nFalta STRIPE_SECRET_KEY en server/.env. Consiguela en https://dashboard.stripe.com/apikeys\n');
  process.exit(1);
}

const stripe = new Stripe(KEY);
const MONEDA = 'mxn';

// Planes oficiales (montos aproximados, redondeados desde los precios en
// USD originales a un tipo de cambio de referencia -- no atados a un tipo
// de cambio en vivo, se ajustan a mano si hace falta):
// - Inicio / Solo: $190/mes, $1,950/año (1 a 3 agentes)
// - Agencia: $450/mes, $4,650/año (4 a 8 agentes)
// - Agencia Pro: $750/mes, $7,800/año (hasta 15 agentes, +$75/mes por agente 16+)
const PRECIOS = [
  { plan: 'inicio_mensual', nombre: 'Rumbia — Inicio Mensual', base: 19000, agente: null, recurring: { interval: 'month' } },
  { plan: 'inicio_anual', nombre: 'Rumbia — Inicio Anual', base: 195000, agente: null, recurring: { interval: 'year' } },
  { plan: 'agencia_mensual', nombre: 'Rumbia — Agencia Mensual', base: 45000, agente: null, recurring: { interval: 'month' } },
  { plan: 'agencia_anual', nombre: 'Rumbia — Agencia Anual', base: 465000, agente: null, recurring: { interval: 'year' } },
  { plan: 'pro_mensual', nombre: 'Rumbia — Agencia Pro Mensual', base: 75000, agente: 7500, recurring: { interval: 'month' } },
  { plan: 'pro_anual', nombre: 'Rumbia — Agencia Pro Anual', base: 780000, agente: 78000, recurring: { interval: 'year' } },
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
    lookupKey: `agencia_${plan}_base_${MONEDA}`,
    nombre,
    montoCentavos: base,
    recurring,
  });
  lineasEnv.push(`STRIPE_PRICE_${plan.toUpperCase()}_BASE=${precioBase.id}`);

  if (agente) {
    const precioAgente = await buscarOCrearPrice({
      lookupKey: `agencia_${plan}_agente_${MONEDA}`,
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
