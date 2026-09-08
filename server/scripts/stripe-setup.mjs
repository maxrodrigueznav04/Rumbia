// Crea en Stripe los Products/Prices que necesita el cobro a agencias, y
// deja listas las lineas para pegar en .env. Correrlo dos veces no duplica
// nada: usa lookup_key para encontrar lo que ya existe antes de crear.
//
//   cd server && npm run stripe:setup
//
// Requiere STRIPE_SECRET_KEY en el .env (modo test o modo live, segun cual
// uses). Crea precios en MXN y en USD (ver MONEDAS abajo): ambas divisas
// coexisten a proposito, no se reemplazan.
//
// El lookup_key incluye la moneda a proposito: muchas tarjetas mexicanas
// rechazan cargos en una divisa extranjera aunque Stripe intente mostrar el
// precio convertido (ver "Adaptive Pricing"), asi que cada divisa se cobra
// nativa -- MXN sigue siendo la default para no romper a nadie con tarjeta
// mexicana (BBVA incluida, que de plano rechaza cargos en dolares), y USD se
// suma para vender a mercados que si pagan en dolares. El sufijo de divisa
// en el lookup_key evita que el script reutilice por error un Price viejo en
// otra divisa con el mismo lookup_key (Stripe exige que sean unicos solo
// entre Prices activos).

import 'dotenv/config';
import Stripe from 'stripe';

const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY) {
  console.error('\nFalta STRIPE_SECRET_KEY en server/.env. Consiguela en https://dashboard.stripe.com/apikeys\n');
  process.exit(1);
}

const stripe = new Stripe(KEY);

// Planes oficiales en MXN (montos aproximados, redondeados desde los precios
// en USD originales a un tipo de cambio de referencia -- no atados a un tipo
// de cambio en vivo, se ajustan a mano si hace falta):
// - Inicio / Solo: $190/mes, $1,950/año (1 a 3 agentes)
// - Agencia: $450/mes, $4,650/año (4 a 8 agentes)
// - Agencia Pro: $750/mes, $7,800/año (hasta 15 agentes, +$75/mes por agente 16+)
//
// Los mismos planes en USD (precios propios para el mercado que paga en
// dolares, no una conversion automatica del MXN de arriba):
// - Inicio: $10/mes, $104/año
// - Agencia: $25/mes, $260/año
// - Agencia Pro: $40/mes, $416/año (+$4/mes por agente extra)
const MONEDAS = [
  {
    codigo: 'mxn',
    sufijoEnv: '',
    precios: [
      { plan: 'inicio_mensual', nombre: 'Rumbia — Inicio Mensual', base: 19000, agente: null, recurring: { interval: 'month' } },
      { plan: 'inicio_anual', nombre: 'Rumbia — Inicio Anual', base: 195000, agente: null, recurring: { interval: 'year' } },
      { plan: 'agencia_mensual', nombre: 'Rumbia — Agencia Mensual', base: 45000, agente: null, recurring: { interval: 'month' } },
      { plan: 'agencia_anual', nombre: 'Rumbia — Agencia Anual', base: 465000, agente: null, recurring: { interval: 'year' } },
      { plan: 'pro_mensual', nombre: 'Rumbia — Agencia Pro Mensual', base: 75000, agente: 7500, recurring: { interval: 'month' } },
      { plan: 'pro_anual', nombre: 'Rumbia — Agencia Pro Anual', base: 780000, agente: 78000, recurring: { interval: 'year' } },
    ],
  },
  {
    codigo: 'usd',
    sufijoEnv: '_USD',
    precios: [
      { plan: 'inicio_mensual', nombre: 'Rumbia — Inicio Mensual (USD)', base: 1000, agente: null, recurring: { interval: 'month' } },
      { plan: 'inicio_anual', nombre: 'Rumbia — Inicio Anual (USD)', base: 10400, agente: null, recurring: { interval: 'year' } },
      { plan: 'agencia_mensual', nombre: 'Rumbia — Agencia Mensual (USD)', base: 2500, agente: null, recurring: { interval: 'month' } },
      { plan: 'agencia_anual', nombre: 'Rumbia — Agencia Anual (USD)', base: 26000, agente: null, recurring: { interval: 'year' } },
      { plan: 'pro_mensual', nombre: 'Rumbia — Agencia Pro Mensual (USD)', base: 4000, agente: 400, recurring: { interval: 'month' } },
      { plan: 'pro_anual', nombre: 'Rumbia — Agencia Pro Anual (USD)', base: 41600, agente: 4200, recurring: { interval: 'year' } },
    ],
  },
];

async function buscarOCrearPrice({ lookupKey, nombre, moneda, montoCentavos, recurring }) {
  const existentes = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  if (existentes.data.length) {
    console.log(`  ok  ${lookupKey} ya existe -> ${existentes.data[0].id}`);
    return existentes.data[0];
  }

  const producto = await stripe.products.create({ name: nombre });
  const price = await stripe.prices.create({
    product: producto.id,
    currency: moneda,
    unit_amount: montoCentavos,
    lookup_key: lookupKey,
    ...(recurring ? { recurring } : {}),
  });
  console.log(`  creado  ${lookupKey} -> ${price.id}`);
  return price;
}

const lineasEnv = [];
for (const { codigo, sufijoEnv, precios } of MONEDAS) {
  console.log(`\nCreando/verificando precios en Stripe (moneda: ${codigo.toUpperCase()})...\n`);

  for (const { plan, nombre, base, agente, recurring } of precios) {
    const precioBase = await buscarOCrearPrice({
      lookupKey: `agencia_${plan}_base_${codigo}`,
      nombre,
      moneda: codigo,
      montoCentavos: base,
      recurring,
    });
    lineasEnv.push(`STRIPE_PRICE_${plan.toUpperCase()}_BASE${sufijoEnv}=${precioBase.id}`);

    if (agente) {
      const precioAgente = await buscarOCrearPrice({
        lookupKey: `agencia_${plan}_agente_${codigo}`,
        nombre: `${nombre} (agente extra)`,
        moneda: codigo,
        montoCentavos: agente,
        recurring,
      });
      lineasEnv.push(`STRIPE_PRICE_${plan.toUpperCase()}_AGENTE${sufijoEnv}=${precioAgente.id}`);
    }
  }
}

console.log('\nPega esto en server/.env (y en las variables de entorno de Render):\n');
console.log(lineasEnv.join('\n'));
console.log('');
