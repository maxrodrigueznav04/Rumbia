// Verifica modelos, validadores y servicios sin necesitar MongoDB.
process.env.MONGO_URI ||= 'mongodb://127.0.0.1:27017/rumbo';
process.env.JWT_SECRET ||= 'test_secret_test_secret_test_secret';

const { Trip, Itinerary, Expense, User, Agency, ItineraryTemplate } = await import('../src/models/index.js');
const schemas = await import('../src/validators/schemas.js');
const { buildLinksForTrip } = await import('../src/services/bookingLinks.service.js');
const { getWeatherForRange } = await import('../src/services/weather.service.js');
const mongoose = (await import('mongoose')).default;

let pass = 0, fail = 0;
const check = async (name, fn) => {
  try { const r = await fn(); console.log(`  ok  ${name}${r ? ` -> ${r}` : ''}`); pass++; }
  catch (e) { console.log(`  FAIL ${name}: ${e.message}`); fail++; }
};
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

console.log('\n== Modelos ==');

const uid = new mongoose.Types.ObjectId();

await check('Trip valido pasa validacion', async () => {
  const t = new Trip({
    user: uid,
    title: 'Oaxaca',
    destination: { name: 'Oaxaca', country: 'MX', lat: 17.07, lng: -96.72 },
    startDate: new Date('2026-09-10'),
    endDate: new Date('2026-09-14'),
    travelers: 2,
    budget: { amount: 20000, currency: 'MXN' },
  });
  const err = t.validateSync();
  assert(!err, err?.message);
  return `${t.durationDays} dias, ${t.nightsCount} noches`;
});

await check('Trip rechaza endDate < startDate', async () => {
  const t = new Trip({
    user: uid, title: 'X',
    destination: { name: 'Y' },
    startDate: new Date('2026-09-14'), endDate: new Date('2026-09-10'),
  });
  // validateSync() no corre los hooks pre('validate'); hay que usar la version async.
  const err = await t.validate().then(() => null, (e) => e);
  assert(err?.errors?.endDate, 'deberia invalidar endDate');
  return err.errors.endDate.message;
});

await check('Trip rechaza destino sin nombre', async () => {
  const t = new Trip({ user: uid, title: 'X', destination: {}, startDate: new Date(), endDate: new Date() });
  const err = t.validateSync();
  assert(err?.errors?.destination, 'deberia invalidar destination');
  return 'destino obligatorio';
});

await check('Trip acepta el estado "aprobado" y rechaza uno inventado', async () => {
  const ok = new Trip({
    user: uid, title: 'X', destination: { name: 'Y' },
    startDate: new Date('2026-09-10'), endDate: new Date('2026-09-14'), status: 'aprobado',
  });
  assert(!ok.validateSync(), 'aprobado deberia ser un estado valido');
  const mal = new Trip({
    user: uid, title: 'X', destination: { name: 'Y' },
    startDate: new Date('2026-09-10'), endDate: new Date('2026-09-14'), status: 'en-revision',
  });
  assert(mal.validateSync()?.errors?.status, 'estado inventado deberia fallar');
  return 'aprobado valido, estado inventado rechazado';
});

await check('coreCosts suma transporte + hospedaje + local', async () => {
  const t = new Trip({
    user: uid, title: 'X',
    destination: { name: 'Y' },
    startDate: new Date('2026-09-10'), endDate: new Date('2026-09-14'),
    transport: { outbound: { cost: 2450 }, inbound: { cost: 2610 } },
    lodging: [{ nightlyRate: 1350, nights: 4 }],
    localTransport: [{ estimatedCost: 1200 }, { estimatedCost: 1800 }],
  });
  const c = t.coreCosts;
  assert(c.transport === 5060, `transporte=${c.transport}`);
  assert(c.lodging === 5400, `hospedaje=${c.lodging}`);
  assert(c.localTransport === 3000, `local=${c.localTransport}`);
  assert(c.total === 13460, `total=${c.total}`);
  return `total ${c.total}`;
});

const viajeCon = (lodging) =>
  new Trip({
    user: uid, title: 'X', destination: { name: 'Y' },
    startDate: new Date(), endDate: new Date(),
    lodging,
  });

await check('lodging: el costo capturado es el total de la estancia', async () => {
  const l = viajeCon([{ totalCost: 3000, nights: 3 }]).lodging[0];
  assert(l.subtotal === 3000, `subtotal=${l.subtotal}`);
  assert(l.perNight === 1000, `perNight=${l.perNight}`);
  return '3000 en 3 noches -> 1000/noche';
});

await check('lodging: los registros viejos siguen sumando', async () => {
  // Antes del cambio se guardaba tarifa por noche; esos viajes no deben
  // quedarse en cero solo porque les falta totalCost.
  const l = viajeCon([{ nightlyRate: 1600, nights: 2 }]).lodging[0];
  assert(l.subtotal === 3200, `subtotal=${l.subtotal}`);
  assert(l.perNight === 1600, `perNight=${l.perNight}`);
  return 'tarifa x noches como respaldo';
});

await check('lodging: totalCost manda sobre nightlyRate', async () => {
  const l = viajeCon([{ totalCost: 2500, nightlyRate: 999, nights: 2 }]).lodging[0];
  assert(l.subtotal === 2500, `subtotal=${l.subtotal}`);
  return '2500';
});

await check('lodging: sin noches no revienta el por-noche', async () => {
  const l = viajeCon([{ totalCost: 1200, nights: 0 }]).lodging[0];
  assert(l.subtotal === 1200, `subtotal=${l.subtotal}`);
  assert(l.perNight === 0, `perNight=${l.perNight}`);
  return 'sin division por cero';
});

await check('Itinerary rechaza hora mal formada', async () => {
  const it = new Itinerary({
    trip: uid, user: uid,
    days: [{ dayNumber: 1, activities: [{ title: 'A', time: '25:99' }] }],
  });
  const err = it.validateSync();
  assert(err, 'deberia fallar');
  return 'formato HH:mm exigido';
});

await check('Itinerary totales y pines', async () => {
  const it = new Itinerary({
    trip: uid, user: uid,
    days: [
      { dayNumber: 1, activities: [
        { title: 'A', estimatedCost: 100, location: { lat: 17.06, lng: -96.72 } },
        { title: 'B', estimatedCost: 250, location: {} },
      ]},
      { dayNumber: 2, activities: [{ title: 'C', estimatedCost: 90, location: { lat: 17.04, lng: -96.76 } }] },
    ],
  });
  assert(!it.validateSync(), 'no deberia fallar');
  assert(it.totalEstimatedCost === 440, `total=${it.totalEstimatedCost}`);
  assert(it.activityCount === 3, `count=${it.activityCount}`);
  assert(it.mapPins().length === 2, `pins=${it.mapPins().length}`);
  return `costo 440, 3 actividades, 2 pines`;
});

await check('Expense rechaza categoria invalida', async () => {
  const e = new Expense({ trip: uid, user: uid, category: 'inventada', description: 'x', amount: 10 });
  assert(e.validateSync()?.errors?.category, 'deberia invalidar categoria');
  return 'enum aplicado';
});

await check('User no expone password en toJSON', async () => {
  const u = new User({ name: 'Ana', email: 'a@b.com', password: 'secreto123' });
  assert(u.toJSON().password === undefined, 'password filtrado');
  return 'password oculto';
});

await check('User rechaza mas de 5 estilos', async () => {
  const u = new User({ name: 'Ana', email: 'a@b.com', password: 'secreto123',
    preferences: { travelStyles: ['aventura','cultura','relax','gastronomia','naturaleza','compras'] } });
  assert(u.validateSync(), 'deberia fallar por limite de 5');
  return 'max 5';
});

await check('User nace sin uso de IA registrado este mes', async () => {
  const u = new User({ name: 'Ana', email: 'a@b.com', password: 'secreto123' });
  assert(u.usoIA.mes === '' && u.usoIA.generaciones === 0, 'sin mes ni generaciones todavia');
  return 'mes vacio, 0 generaciones -> revisarCupoPersonal lo inicializa al generar';
});

await check('Agency nace pendiente, sin agentes extra', async () => {
  const a = new Agency({ agencyName: 'Viajes del Sur', owner: uid });
  assert(!a.validateSync(), 'no deberia fallar');
  assert(a.billing.status === 'pendiente', `status=${a.billing.status}`);
  assert(a.capacidadAgentes === 3, `capacidad=${a.capacidadAgentes}`);
  return 'pendiente, cupo 3';
});

await check('Agency: agentes extra suman a la capacidad', async () => {
  const a = new Agency({ agencyName: 'Viajes del Sur', owner: uid, billing: { extraAgentes: 5 } });
  assert(a.capacidadAgentes === 8, `capacidad=${a.capacidadAgentes}`);
  return '3 incluidos + 5 extra = 8';
});

await check('Agency rechaza un plan que no existe', async () => {
  const a = new Agency({ agencyName: 'X', owner: uid, billing: { plan: 'trimestral' } });
  assert(a.validateSync()?.errors['billing.plan'], 'deberia invalidar el plan');
  return 'enum aplicado';
});

await check('ItineraryTemplate valida y cuenta actividades sin fechas', async () => {
  const t = new ItineraryTemplate({
    user: uid,
    name: 'Cancún todo incluido',
    destination: { name: 'Cancún', country: 'México' },
    days: [
      { dayNumber: 1, title: 'Llegada', activities: [{ title: 'Check-in', category: 'descanso' }] },
      { dayNumber: 2, title: 'Playa', activities: [{ title: 'Snorkel' }, { title: 'Comida' }] },
    ],
  });
  assert(!t.validateSync(), 'no deberia fallar');
  assert(t.activityCount === 3, `activityCount=${t.activityCount}`);
  assert(t.days[0].dayNumber === 1 && t.days[0].date === undefined, 'dias relativos, sin fecha de calendario');
  return '2 dias, 3 actividades, sin fechas';
});

await check('ItineraryTemplate exige nombre a cada actividad', async () => {
  const t = new ItineraryTemplate({
    user: uid,
    name: 'X',
    destination: { name: 'Y' },
    days: [{ dayNumber: 1, activities: [{ category: 'comida' }] }],
  });
  const err = t.validateSync();
  assert(err, 'deberia fallar sin title en la actividad');
  return 'title obligatorio en cada actividad';
});

console.log('\n== Itinerario: reordenar por hora ==');

const { reorderByTime } = await import('../src/controllers/itinerary.controller.js');

await check('mueve la actividad editada a su lugar cronologico', async () => {
  const it = new Itinerary({
    trip: uid, user: uid,
    days: [{ dayNumber: 1, activities: [
      { title: 'Desayuno', time: '08:00' },
      { title: 'Museo', time: '10:00' },
      { title: 'Comida', time: '13:00' },
    ]}],
  });
  const day = it.days[0];
  // El usuario adelanta "Comida" a las 07:00: debe pasar a ser la primera.
  day.activities[2].time = '07:00';
  reorderByTime(day);
  const orden = day.activities.map((a) => a.title).join(',');
  assert(orden === 'Comida,Desayuno,Museo', orden);
  assert(day.activities.map((a) => a.order).join(',') === '0,1,2', 'order renumerado');
  return day.activities.map((a) => `${a.time} ${a.title}`).join(' / ');
});

await check('las actividades sin hora se van al final, sin perder su orden relativo', async () => {
  const it = new Itinerary({
    trip: uid, user: uid,
    days: [{ dayNumber: 1, activities: [
      { title: 'Checkout', time: '' },
      { title: 'Comida', time: '13:00' },
      { title: 'Souvenirs', time: '' },
    ]}],
  });
  const day = it.days[0];
  reorderByTime(day);
  const orden = day.activities.map((a) => a.title).join(',');
  assert(orden === 'Comida,Checkout,Souvenirs', orden);
  return orden;
});

console.log('\n== Validadores (Zod) ==');

await check('createTripSchema acepta payload valido', async () => {
  const r = schemas.createTripSchema.safeParse({
    title: 'Oaxaca', destination: { name: 'Oaxaca' },
    startDate: '2026-09-10', endDate: '2026-09-14', travelers: '2',
  });
  assert(r.success, JSON.stringify(r.error?.issues));
  assert(r.data.travelers === 2, 'coerce a numero');
  assert(r.data.budget.amount === 0, 'default de monto');
  // currency NO trae default a proposito: createTrip (el controller) hereda
  // la preferencia del usuario cuando no se manda, y necesita ver undefined
  // (no 'MXN') para saber que hay que heredar. Ver trip.controller.js.
  assert(r.data.budget.currency === undefined, 'sin default de moneda en el schema');
  assert(r.data.interests === undefined && r.data.pace === undefined && r.data.budgetLevel === undefined,
    'gustos del viajero sin default: generate() cae al perfil de quien genera si faltan');
  return 'coerce + default de monto, moneda sin forzar, gustos del viajero opcionales';
});

await check('createTripSchema acepta los gustos del viajero cuando si se mandan', async () => {
  const r = schemas.createTripSchema.safeParse({
    title: 'Oaxaca', destination: { name: 'Oaxaca' },
    startDate: '2026-09-10', endDate: '2026-09-14',
    interests: ['aventura', 'gastronomia'], pace: 'intenso', budgetLevel: 'alto',
  });
  assert(r.success, JSON.stringify(r.error?.issues));
  assert(r.data.interests.length === 2 && r.data.pace === 'intenso' && r.data.budgetLevel === 'alto',
    'se guardan los del viaje, no los del perfil de quien lo crea');
  const mal = schemas.createTripSchema.safeParse({
    title: 'Oaxaca', destination: { name: 'Oaxaca' },
    startDate: '2026-09-10', endDate: '2026-09-14', pace: 'turbo',
  });
  assert(!mal.success, 'ritmo invalido deberia fallar');
  return '2 intereses + ritmo intenso + gasto alto guardados; ritmo invalido rechazado';
});

await check('createTripSchema rechaza fechas invertidas', async () => {
  const r = schemas.createTripSchema.safeParse({
    title: 'Oaxaca', destination: { name: 'Oaxaca' },
    startDate: '2026-09-14', endDate: '2026-09-10',
  });
  assert(!r.success, 'deberia fallar');
  return r.error.issues[0].message;
});

await check('registerSchema exige password de 8+', async () => {
  const r = schemas.registerSchema.safeParse({ name: 'Ana', email: 'A@B.COM', password: 'corta' });
  assert(!r.success, 'deberia fallar');
  const ok = schemas.registerSchema.safeParse({ name: 'Ana', email: 'A@B.COM', password: 'largapass' });
  assert(ok.success && ok.data.email === 'a@b.com', 'email normalizado a minusculas');
  return 'min 8 + email en minusculas';
});

await check('activitySchema valida hora', async () => {
  assert(!schemas.activitySchema.safeParse({ title: 'A', time: '9:00' }).success, '9:00 invalido');
  assert(schemas.activitySchema.safeParse({ title: 'A', time: '09:00' }).success, '09:00 valido');
  return 'HH:mm';
});

await check('updateTripSchema rechaza body vacio', async () => {
  assert(!schemas.updateTripSchema.safeParse({}).success, 'deberia fallar');
  return 'body vacio rechazado';
});

await check('createExpenseSchema no fuerza moneda: el controller hereda la del viaje', async () => {
  const r = schemas.createExpenseSchema.safeParse({
    trip: '507f1f77bcf86cd799439011', description: 'Cena', amount: 250,
  });
  assert(r.success, JSON.stringify(r.error?.issues));
  assert(r.data.currency === undefined, 'sin default de moneda en el schema');
  return 'sin default, expense.controller.js hereda de trip.budget.currency';
});

await check('checkoutAgencySchema exige un plan valido y por defecto 0 agentes extra', async () => {
  const ok = schemas.checkoutAgencySchema.safeParse({ plan: 'anual' });
  assert(ok.success && ok.data.extraAgentes === 0, 'default extraAgentes=0');
  const mal = schemas.checkoutAgencySchema.safeParse({ plan: 'trimestral' });
  assert(!mal.success, 'plan invalido deberia fallar');
  return 'anual + default 0, plan invalido rechazado';
});

await check('cambiarAgentesSchema exige extraAgentes explicito (sin default)', async () => {
  const ok = schemas.cambiarAgentesSchema.safeParse({ extraAgentes: '4' });
  assert(ok.success && ok.data.extraAgentes === 4, 'coerciona a numero');
  const mal = schemas.cambiarAgentesSchema.safeParse({});
  assert(!mal.success, 'sin extraAgentes deberia fallar');
  return '4 agentes extra, body vacio rechazado';
});

await check('crearPlantillaSchema exige nombre', async () => {
  const ok = schemas.crearPlantillaSchema.safeParse({ name: 'Cancún todo incluido' });
  assert(ok.success, JSON.stringify(ok.error?.issues));
  const mal = schemas.crearPlantillaSchema.safeParse({ name: 'X' });
  assert(!mal.success, 'un solo caracter deberia fallar (min 2)');
  return 'nombre valido aceptado, uno muy corto rechazado';
});

await check('aplicarPlantillaSchema valida fechas y trae defaults', async () => {
  const ok = schemas.aplicarPlantillaSchema.safeParse({
    title: 'Viaje de los Hernandez', startDate: '2026-11-01', endDate: '2026-11-05',
  });
  assert(ok.success, JSON.stringify(ok.error?.issues));
  assert(ok.data.travelers === 1 && ok.data.budget.amount === 0, 'defaults de travelers y budget');
  const mal = schemas.aplicarPlantillaSchema.safeParse({
    title: 'X', startDate: '2026-11-05', endDate: '2026-11-01',
  });
  assert(!mal.success, 'fecha de regreso antes de la salida deberia fallar');
  return 'defaults ok, fechas invertidas rechazadas';
});

await check('tripListQuerySchema aplica defaults', async () => {
  const r = schemas.tripListQuerySchema.safeParse({});
  assert(r.success && r.data.page === 1 && r.data.limit === 20, 'defaults');
  return 'page=1 limit=20';
});

console.log('\n== Servicios ==');

await check('buildLinksForTrip arma las 3 secciones', async () => {
  const trip = new Trip({
    user: uid, title: 'X',
    destination: { name: 'Oaxaca de Juarez', country: 'MX' },
    origin: { name: 'Monterrey' },
    startDate: new Date('2026-09-10'), endDate: new Date('2026-09-14'),
    travelers: 2,
    transport: { outbound: { mode: 'avion' } },
    lodging: [{ type: 'airbnb', checkIn: new Date('2026-09-10'), checkOut: new Date('2026-09-14') }],
    localTransport: [{ type: 'renta-auto' }],
  });
  const links = buildLinksForTrip(trip);
  assert(links.transporte.length >= 2, 'transporte');
  assert(links.hospedaje[0].provider === 'Airbnb', 'airbnb primero cuando es el tipo elegido');
  assert(links.hospedaje[0].url.includes('checkin=2026-09-10'), 'fechas prellenadas');
  assert(links['transporte-local'][0].provider === 'DiscoverCars', 'renta de auto');
  for (const group of Object.values(links)) {
    for (const l of group) new URL(l.url); // lanza si la URL es invalida
  }
  return `${Object.values(links).flat().length} enlaces, todos con URL valida`;
});

await check('buildLinksForTrip cambia con el modo de transporte', async () => {
  const trip = new Trip({
    user: uid, title: 'X', destination: { name: 'CDMX' }, origin: { name: 'Monterrey' },
    startDate: new Date('2026-09-10'), endDate: new Date('2026-09-12'),
    transport: { outbound: { mode: 'autobus' } },
  });
  const links = buildLinksForTrip(trip, { section: 'transporte' });
  assert(links.transporte.some((l) => l.provider === 'Rome2Rio'), 'autobus -> Rome2Rio');
  return links.transporte.map((l) => l.provider).join(', ');
});

console.log('\n== Clima (sin API key: solo estimacion) ==');

const weather = await getWeatherForRange({
  lat: 17.07, lng: -96.72,
  startDate: new Date('2027-01-10'), endDate: new Date('2027-01-14'),
});
await check('devuelve un dia por fecha del rango', async () => {
  assert(weather.days.length === 5, `dias=${weather.days.length}`);
  assert(weather.days.every((d) => d.source === 'estimacion-historica'), 'marcado como estimacion');
  return `${weather.days.length} dias, ${weather.days[0].tempAvg}C promedio`;
});
await check('estacionalidad invertida en el hemisferio sur', async () => {
  const norte = await getWeatherForRange({ lat: 45, lng: 0, startDate: new Date('2027-07-10'), endDate: new Date('2027-07-11') });
  const sur = await getWeatherForRange({ lat: -45, lng: 0, startDate: new Date('2027-07-10'), endDate: new Date('2027-07-11') });
  assert(norte.days[0].tempAvg > sur.days[0].tempAvg, 'julio: norte mas calido que sur');
  return `julio -> lat45N ${norte.days[0].tempAvg}C vs lat45S ${sur.days[0].tempAvg}C`;
});

/* ---------------------- Tipos de cambio ---------------------- */

console.log(`\n== Conversion de divisas (fetch simulado) ==`);

const { convertirTotales, limpiarCache } = await import('../src/services/exchange.service.js');
const fetchReal = globalThis.fetch;
const simular = (respuesta) => {
  globalThis.fetch = async () => respuesta;
};

await check('sin mezcla de monedas no llama a la API', async () => {
  limpiarCache();
  let llamadas = 0;
  globalThis.fetch = async () => { llamadas += 1; return { ok: false }; };
  const r = await convertirTotales([{ amount: 100, currency: 'MXN' }], 'MXN');
  assert(llamadas === 0, `llamadas=${llamadas}`);
  assert(r.convertido[0].convertido === 100, 'monto intacto');
  return 'cero peticiones';
});

await check('convierte con la tasa recibida', async () => {
  limpiarCache();
  // Frankfurter responde a ?from=MXN con cuantos USD da UN peso, asi que para
  // pasar dolares a pesos hay que dividir. 0.05 -> el dolar vale 20 pesos.
  simular({ ok: true, json: async () => ({ rates: { USD: 0.05 } }) });
  const r = await convertirTotales(
    [{ amount: 1000, currency: 'MXN' }, { amount: 100, currency: 'USD' }],
    'MXN'
  );
  const total = r.convertido.reduce((s, x) => s + x.convertido, 0);
  assert(total === 3000, `total=${total}`);
  return '100 USD a 20 MXN -> 2000, total 3000';
});

await check('si la API falla no inventa un total', async () => {
  limpiarCache();
  simular({ ok: false });
  const r = await convertirTotales(
    [{ amount: 1000, currency: 'MXN' }, { amount: 100, currency: 'USD' }],
    'MXN'
  );
  assert(r.sinConvertir.includes('USD'), 'reporta USD como no convertido');
  assert(r.convertido[1].convertido === 0, 'el gasto no convertido no suma');
  assert(r.convertido[0].convertido === 1000, 'lo que si estaba en la moneda del viaje se conserva');
  return 'avisa en vez de mentir';
});

await check('cachea: dos conversiones seguidas piden una sola vez', async () => {
  limpiarCache();
  let llamadas = 0;
  globalThis.fetch = async () => { llamadas += 1; return { ok: true, json: async () => ({ rates: { USD: 20 } }) }; };
  await convertirTotales([{ amount: 1, currency: 'USD' }], 'MXN');
  await convertirTotales([{ amount: 2, currency: 'USD' }], 'MXN');
  assert(llamadas === 1, `llamadas=${llamadas}`);
  return 'una peticion para dos resumenes';
});

globalThis.fetch = fetchReal;

console.log(`
== Enlaces de afiliado ==`);

const afiliados = await import('../src/services/affiliates.service.js');
const conConfig = (json, fn) => async () => {
  const previo = process.env.AFFILIATE_LINKS;
  process.env.AFFILIATE_LINKS = json;
  afiliados.limpiarCache();
  try { return await fn(); }
  finally {
    if (previo === undefined) delete process.env.AFFILIATE_LINKS;
    else process.env.AFFILIATE_LINKS = previo;
    afiliados.limpiarCache();
  }
};

await check('sin configuracion el enlace sale intacto', conConfig('', async () => {
  const original = { provider: 'Booking.com', url: 'https://www.booking.com/searchresults.es.html?ss=Oaxaca' };
  const r = afiliados.decorarEnlace(original);
  assert(r.url === original.url, `url=${r.url}`);
  assert(!r.esAfiliado, 'no se marca como afiliado');
  assert(afiliados.hayAfiliados() === false, 'hayAfiliados debe ser false');
  return 'sin tocar, y sin decir que hay comision';
}));

await check('tipo param agrega el identificador', conConfig(
  JSON.stringify({ 'Booking.com': { tipo: 'param', clave: 'aid', valor: '1234567' } }),
  async () => {
    const r = afiliados.decorarEnlace({ provider: 'Booking.com', url: 'https://www.booking.com/x.html?ss=Oaxaca' });
    const u = new URL(r.url);
    assert(u.searchParams.get('aid') === '1234567', `aid=${u.searchParams.get('aid')}`);
    assert(u.searchParams.get('ss') === 'Oaxaca', 'conserva los parametros originales');
    assert(r.esAfiliado === true, 'queda marcado como afiliado');
    return 'aid puesto sin perder la busqueda';
  }));

await check('tipo envoltura mete la URL en el redirector (CJ)', conConfig(
  JSON.stringify({ Skyscanner: { tipo: 'envoltura', plantilla: 'https://www.anrdoezrs.net/links/999/type/dlg/{url}' } }),
  async () => {
    const destino = 'https://www.skyscanner.com.mx/transport/vuelos/';
    const r = afiliados.decorarEnlace({ provider: 'Skyscanner', url: destino });
    assert(r.url.startsWith('https://www.anrdoezrs.net/links/999/'), `url=${r.url}`);
    assert(r.url.includes(encodeURIComponent(destino)), 'la URL destino va codificada');
    return 'redireccion de CJ';
  }));

await check('un proveedor sin configurar no se toca', conConfig(
  JSON.stringify({ 'Booking.com': { tipo: 'param', clave: 'aid', valor: '1' } }),
  async () => {
    const r = afiliados.decorarEnlace({ provider: 'Airbnb', url: 'https://www.airbnb.mx/s/Oaxaca' });
    assert(r.url === 'https://www.airbnb.mx/s/Oaxaca', 'intacto');
    assert(!r.esAfiliado, 'sin marcar');
    return 'solo se decora lo configurado';
  }));

await check('configuracion invalida se ignora en vez de romper el enlace', conConfig(
  '{ esto no es json',
  async () => {
    const r = afiliados.decorarEnlace({ provider: 'Booking.com', url: 'https://www.booking.com/x' });
    assert(r.url === 'https://www.booking.com/x', 'el enlace sigue funcionando');
    return 'mejor sin comision que roto';
  }));

await check('decorarSecciones respeta la forma que espera el cliente', conConfig(
  JSON.stringify({ 'Booking.com': { tipo: 'param', clave: 'aid', valor: '7' } }),
  async () => {
    const secciones = { hospedaje: [
      { provider: 'Booking.com', label: 'Buscar hoteles', url: 'https://www.booking.com/x' },
      { provider: 'Airbnb', label: 'Buscar casas', url: 'https://www.airbnb.mx/s/X' },
    ] };
    const r = afiliados.decorarSecciones(secciones);
    assert(r.hospedaje.length === 2, 'no pierde enlaces');
    assert(r.hospedaje[0].esAfiliado === true && !r.hospedaje[1].esAfiliado, 'marca solo el configurado');
    assert(r.hospedaje[0].label === 'Buscar hoteles', 'conserva la etiqueta');
    return '2 enlaces, 1 marcado';
  }));

console.log('\n== Stripe (sin configurar) ==');

const stripeService = (await import('../src/services/stripe.service.js')).default;

await check('crearSesionCheckout avisa claro si falta STRIPE_SECRET_KEY', async () => {
  try {
    await stripeService.crearSesionCheckout({ agencia: {}, user: {}, plan: 'mensual' });
    throw new Error('deberia haber lanzado');
  } catch (e) {
    assert(e.statusCode === 503, `statusCode=${e.statusCode}`);
    return e.message;
  }
});

await check('cambiarAgentesSuscripcion tambien avisa claro sin STRIPE_SECRET_KEY', async () => {
  try {
    await stripeService.cambiarAgentesSuscripcion({ agencia: {}, plan: 'mensual', nuevoExtraAgentes: 2 });
    throw new Error('deberia haber lanzado');
  } catch (e) {
    assert(e.statusCode === 503, `statusCode=${e.statusCode}`);
    return e.message;
  }
});

console.log(`\n${fail === 0 ? 'TODO OK' : 'HAY FALLOS'}: ${pass} pasaron, ${fail} fallaron\n`);
process.exit(fail === 0 ? 0 : 1);
