// Verifica modelos, validadores y servicios sin necesitar MongoDB.
process.env.MONGO_URI ||= 'mongodb://127.0.0.1:27017/rumbo';
process.env.JWT_SECRET ||= 'test_secret_test_secret_test_secret';

const { Trip, Itinerary, Expense, User } = await import('../src/models/index.js');
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

await check('lodging.subtotal virtual', async () => {
  const t = new Trip({
    user: uid, title: 'X', destination: { name: 'Y' },
    startDate: new Date(), endDate: new Date(),
    lodging: [{ nightlyRate: 1600, nights: 2 }],
  });
  assert(t.lodging[0].subtotal === 3200, `subtotal=${t.lodging[0].subtotal}`);
  return '3200';
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

console.log('\n== Validadores (Zod) ==');

await check('createTripSchema acepta payload valido', async () => {
  const r = schemas.createTripSchema.safeParse({
    title: 'Oaxaca', destination: { name: 'Oaxaca' },
    startDate: '2026-09-10', endDate: '2026-09-14', travelers: '2',
  });
  assert(r.success, JSON.stringify(r.error?.issues));
  assert(r.data.travelers === 2, 'coerce a numero');
  assert(r.data.budget.currency === 'MXN', 'default de moneda');
  return 'coerce + defaults ok';
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

console.log(`\n${fail === 0 ? 'TODO OK' : 'HAY FALLOS'}: ${pass} pasaron, ${fail} fallaron\n`);
process.exit(fail === 0 ? 0 : 1);
