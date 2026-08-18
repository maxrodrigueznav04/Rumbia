// Verifica que editar el viaje mantenga el itinerario coherente.
const BASE = 'http://127.0.0.1:4000/api';

let pass = 0, fail = 0;
const t = async (nombre, fn) => {
  try { const r = await fn(); console.log(`  ok   ${nombre}${r ? ` -> ${r}` : ''}`); pass++; }
  catch (e) { console.log(`  FAIL ${nombre}: ${e.message}`); fail++; }
};
const assert = (c, m) => { if (!c) throw new Error(m); };

const login = await fetch(`${BASE}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'demo@rumbo.app', password: 'demo1234' }),
}).then((r) => r.json());
const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.data.token}` };
const call = async (m, ruta, body) => {
  const res = await fetch(BASE + ruta, { method: m, headers: h, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json().catch(() => null) };
};

const creado = await call('POST', '/trips', {
  title: 'Editar: original',
  destination: { name: 'Merida', country: 'MX', lat: 20.97, lng: -89.62 },
  startDate: '2027-06-10', endDate: '2027-06-13', // 4 dias
  travelers: 2, budget: { amount: 10000, currency: 'MXN' },
});
const id = creado.body.data.trip._id;

await call('POST', `/trips/${id}/itinerary`);
// Poner una actividad en el ultimo dia, para comprobar que no se pierde al acortar.
let itin = (await call('GET', `/trips/${id}/itinerary`)).body.data.itinerary;
await call('POST', `/trips/${id}/itinerary/days/${itin.days[3]._id}/activities`, {
  title: 'Cena de despedida', time: '20:00', category: 'comida',
});

console.log('Viaje de 4 dias con itinerario de 4 dias y 1 actividad en el dia 4\n');

console.log('== Alargar el viaje ==');

await t('de 4 a 6 dias agrega 2 dias vacios', async () => {
  const r = await call('PATCH', `/trips/${id}`, { startDate: '2027-06-10', endDate: '2027-06-15' });
  assert(r.status === 200, JSON.stringify(r.body));
  assert(r.body.data.itinerario, 'no reporto la sincronizacion');
  assert(r.body.data.itinerario.diasAgregados === 2, `agregados=${r.body.data.itinerario.diasAgregados}`);

  const it = (await call('GET', `/trips/${id}/itinerary`)).body.data.itinerary;
  assert(it.days.length === 6, `dias=${it.days.length}`);
  assert(it.days[5].dayNumber === 6, 'numeracion mal');
  return '6 dias, los nuevos vacios';
});

await t('las fechas de cada dia siguen a la salida', async () => {
  const r = await call('PATCH', `/trips/${id}`, { startDate: '2027-07-01', endDate: '2027-07-06' });
  assert(r.status === 200, JSON.stringify(r.body));

  const it = (await call('GET', `/trips/${id}/itinerary`)).body.data.itinerary;
  const fechas = it.days.map((d) => String(d.date).slice(0, 10));
  assert(fechas[0] === '2027-07-01', `dia 1 = ${fechas[0]}`);
  assert(fechas[5] === '2027-07-06', `dia 6 = ${fechas[5]}`);
  return `${fechas[0]} ... ${fechas[5]}`;
});

console.log('\n== Acortar el viaje ==');

await t('acortar NO borra dias con actividades y lo reporta', async () => {
  const r = await call('PATCH', `/trips/${id}`, { startDate: '2027-07-01', endDate: '2027-07-03' });
  assert(r.status === 200, JSON.stringify(r.body));
  const info = r.body.data.itinerario;
  assert(info.diasSobrantes === 3, `sobrantes=${info.diasSobrantes}`);
  assert(info.actividadesEnSobrantes === 1, `actividades=${info.actividadesEnSobrantes}`);

  const it = (await call('GET', `/trips/${id}/itinerary`)).body.data.itinerary;
  assert(it.days.length === 6, `se perdieron dias: ${it.days.length}`);
  const cena = it.days.flatMap((d) => d.activities).find((a) => a.title === 'Cena de despedida');
  assert(cena, 'se perdio la actividad');
  return '3 dias sobrantes reportados, nada borrado';
});

console.log('\n== Limpiar dias sobrantes ==');

await t('borrar un dia renumera y reasigna fechas', async () => {
  const it = (await call('GET', `/trips/${id}/itinerary`)).body.data.itinerary;
  const antes = it.days.length;
  const dia2 = it.days[1];

  const r = await call('DELETE', `/trips/${id}/itinerary/days/${dia2._id}`);
  assert(r.status === 200, JSON.stringify(r.body));

  const despues = r.body.data.itinerary;
  assert(despues.days.length === antes - 1, `dias=${despues.days.length}`);
  assert(despues.days.every((d, i) => d.dayNumber === i + 1), 'numeracion con huecos');
  assert(String(despues.days[0].date).startsWith('2027-07-01'), `dia 1 = ${despues.days[0].date}`);
  assert(String(despues.days[1].date).startsWith('2027-07-02'), `dia 2 = ${despues.days[1].date}`);
  return `${antes} -> ${despues.days.length} dias, sin huecos`;
});

await t('borrar el dia con actividad se lleva la actividad', async () => {
  const it = (await call('GET', `/trips/${id}/itinerary`)).body.data.itinerary;
  const conActividad = it.days.find((d) => d.activities.length > 0);
  assert(conActividad, 'no quedo ningun dia con actividad');

  const r = await call('DELETE', `/trips/${id}/itinerary/days/${conActividad._id}`);
  assert(r.status === 200, JSON.stringify(r.body));

  const total = r.body.data.itinerary.days.reduce((s, d) => s + d.activities.length, 0);
  assert(total === 0, `quedaron ${total} actividades`);
  return 'actividad eliminada con su dia';
});

await t('no se puede borrar el ultimo dia que queda', async () => {
  let it = (await call('GET', `/trips/${id}/itinerary`)).body.data.itinerary;
  while (it.days.length > 1) {
    const r = await call('DELETE', `/trips/${id}/itinerary/days/${it.days[0]._id}`);
    it = r.body.data.itinerary;
  }
  const r = await call('DELETE', `/trips/${id}/itinerary/days/${it.days[0]._id}`);
  assert(r.status === 400, `status=${r.status}`);
  return r.body.message;
});

await t('un dia inexistente da 404', async () => {
  const r = await call('DELETE', `/trips/${id}/itinerary/days/507f1f77bcf86cd799439011`);
  assert(r.status === 404, `status=${r.status}`);
  return r.body.message;
});

console.log('\n== Otros campos ==');

await t('editar titulo y presupuesto no toca el itinerario', async () => {
  const r = await call('PATCH', `/trips/${id}`, {
    title: 'Editar: nuevo nombre', budget: { amount: 18000 }, travelers: 3, status: 'planeado',
  });
  assert(r.status === 200, JSON.stringify(r.body));
  assert(!r.body.data.itinerario, 'sincronizo sin necesidad');
  const tr = r.body.data.trip;
  assert(tr.title === 'Editar: nuevo nombre' && tr.budget.amount === 18000 && tr.travelers === 3, 'no guardo');
  assert(tr.budget.currency === 'MXN', 'perdio la moneda al mandar solo amount');
  return 'sin sincronizacion innecesaria, moneda conservada';
});

await t('cambiar destino actualiza nombre y coordenadas', async () => {
  const r = await call('PATCH', `/trips/${id}`, {
    destination: { name: 'Campeche', country: 'MX', lat: 19.83, lng: -90.53 },
  });
  assert(r.status === 200, JSON.stringify(r.body));
  const d = r.body.data.trip.destination;
  assert(d.name === 'Campeche' && d.lat === 19.83, JSON.stringify(d));
  return `${d.name} [${d.lat}, ${d.lng}]`;
});

await t('fechas invertidas siguen rechazadas', async () => {
  const r = await call('PATCH', `/trips/${id}`, { startDate: '2027-07-10', endDate: '2027-07-01' });
  assert(r.status === 400, `status=${r.status}`);
  return r.body.details[0].message;
});

await call('DELETE', `/trips/${id}`);
console.log('\n(viaje de prueba eliminado)');
console.log(`\n${fail === 0 ? 'TODO OK' : 'HAY FALLOS'}: ${pass} pasaron, ${fail} fallaron\n`);
process.exit(fail === 0 ? 0 : 1);
