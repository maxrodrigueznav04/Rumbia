// Reproduce exactamente los payloads que mandan los formularios nuevos del cliente.
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

// Viaje limpio para no ensuciar los del seed.
const creado = await call('POST', '/trips', {
  title: 'Prueba de formularios',
  destination: { name: 'Guanajuato', country: 'MX', lat: 21.019, lng: -101.257 },
  origin: { name: 'Monterrey' },
  startDate: '2027-05-10', endDate: '2027-05-14',
  travelers: 2, budget: { amount: 15000, currency: 'MXN' },
});
const tripId = creado.body.data.trip._id;
console.log(`Viaje de prueba creado (${creado.body.data.trip.durationDays} dias)\n`);

console.log('== FormTransporte ==');

await t('guarda el tramo de ida', async () => {
  const r = await call('PATCH', `/trips/${tripId}`, {
    transport: {
      outbound: {
        mode: 'autobus', provider: 'ETN',
        departureAt: '2027-05-10T08:30:00.000Z',
        cost: 1180, bookingRef: 'ETN99X', isEstimate: false, notes: 'Terminal Norte',
      },
    },
  });
  assert(r.status === 200, JSON.stringify(r.body));
  const o = r.body.data.trip.transport.outbound;
  assert(o.provider === 'ETN' && o.cost === 1180 && o.bookingRef === 'ETN99X', 'no guardo todo');
  assert(o.departureAt.startsWith('2027-05-10T08:30'), `fecha=${o.departureAt}`);
  return 'ETN $1180, sin corrimiento de fecha';
});

await t('guardar la vuelta no borra la ida', async () => {
  const r = await call('PATCH', `/trips/${tripId}`, {
    transport: { inbound: { mode: 'autobus', provider: 'ETN', cost: 1180, isEstimate: true, notes: '', bookingRef: '', departureAt: '2027-05-14T18:00:00.000Z' } },
  });
  const tr = r.body.data.trip.transport;
  assert(tr.outbound.bookingRef === 'ETN99X', 'perdio la ida');
  assert(tr.inbound.cost === 1180, 'no guardo la vuelta');
  return 'ambos tramos intactos';
});

await t('campos vacios no rompen (auto propio sin provider)', async () => {
  const r = await call('PATCH', `/trips/${tripId}`, {
    transport: { outbound: { mode: 'auto-propio', provider: '', cost: 2200, bookingRef: '', notes: 'Gasolina y casetas', isEstimate: false, departureAt: '2027-05-10T07:00:00.000Z' } },
  });
  assert(r.status === 200, JSON.stringify(r.body));
  return 'strings vacios aceptados';
});

console.log('\n== FormHospedaje ==');

await t('agrega el primer hospedaje', async () => {
  const r = await call('PATCH', `/trips/${tripId}`, {
    lodging: [{
      type: 'hotel', name: 'Hotel Boutique 1850',
      place: { name: 'Jardin de la Union' },
      checkIn: '2027-05-10T12:00:00.000Z', checkOut: '2027-05-14T12:00:00.000Z',
      nightlyRate: 1900, nights: 4, bookingRef: '', isEstimate: true, notes: '',
    }],
  });
  assert(r.status === 200, JSON.stringify(r.body));
  const l = r.body.data.trip.lodging[0];
  assert(l.subtotal === 7600, `subtotal=${l.subtotal}`);
  return `subtotal ${l.subtotal} calculado por el virtual`;
});

await t('agregar un segundo conserva el primero (round-trip del arreglo)', async () => {
  const actual = (await call('GET', `/trips/${tripId}`)).body.data.trip;
  // Igual que hace el formulario: limpia los campos derivados antes de reenviar.
  const lista = actual.lodging.map((l) => ({
    type: l.type, name: l.name,
    place: l.place?.name ? { name: l.place.name } : undefined,
    checkIn: l.checkIn, checkOut: l.checkOut,
    nightlyRate: l.nightlyRate, nights: l.nights,
    bookingRef: l.bookingRef, isEstimate: l.isEstimate, notes: l.notes,
  }));
  lista.push({ type: 'airbnb', name: 'Depa en el centro', nightlyRate: 1200, nights: 1, isEstimate: true });

  const r = await call('PATCH', `/trips/${tripId}`, { lodging: lista });
  assert(r.status === 200, JSON.stringify(r.body));
  const ls = r.body.data.trip.lodging;
  assert(ls.length === 2, `hay ${ls.length}`);
  assert(ls[0].name === 'Hotel Boutique 1850', 'perdio el primero');
  assert(ls[0].place?.name === 'Jardin de la Union', 'perdio el place anidado');
  assert(ls[0].subtotal === 7600 && ls[1].subtotal === 1200, 'subtotales mal');
  return '2 hospedajes, place anidado conservado';
});

await t('eliminar uno deja el otro intacto', async () => {
  const actual = (await call('GET', `/trips/${tripId}`)).body.data.trip;
  const lista = actual.lodging.filter((_, i) => i !== 1).map((item) => {
    const { _id, id, subtotal, ...limpio } = item;
    return limpio;
  });
  const r = await call('PATCH', `/trips/${tripId}`, { lodging: lista });
  assert(r.status === 200, JSON.stringify(r.body));
  assert(r.body.data.trip.lodging.length === 1, 'no elimino');
  assert(r.body.data.trip.lodging[0].name === 'Hotel Boutique 1850', 'elimino el equivocado');
  return 'queda solo el hotel';
});

console.log('\n== FormTransporteLocal ==');

await t('agrega transporte local', async () => {
  const r = await call('PATCH', `/trips/${tripId}`, {
    localTransport: [{ type: 'a-pie', provider: '', estimatedCost: 0, notes: 'Centro caminable' }],
  });
  assert(r.status === 200, JSON.stringify(r.body));
  return 'costo 0 aceptado';
});

console.log('\n== FormGasto ==');

let gastoId = null;

await t('crea gasto', async () => {
  const r = await call('POST', '/expenses', {
    trip: tripId, category: 'comida', description: 'Enchiladas mineras',
    amount: 320, date: '2027-05-11T12:00:00.000Z', isPaid: false, notes: '',
  });
  assert(r.status === 201, JSON.stringify(r.body));
  gastoId = r.body.data.expense._id;
  assert(r.body.data.expense.currency === 'MXN', 'no heredo la moneda del viaje');
  return 'moneda heredada del viaje';
});

await t('marcar como pagado con PATCH parcial', async () => {
  const r = await call('PATCH', `/expenses/${gastoId}`, { isPaid: true });
  assert(r.status === 200, JSON.stringify(r.body));
  assert(r.body.data.expense.isPaid === true, 'no marco');
  assert(r.body.data.expense.description === 'Enchiladas mineras', 'perdio la descripcion');
  return 'toggle sin perder campos';
});

await t('gasto sin monto es rechazado', async () => {
  const r = await call('POST', '/expenses', { trip: tripId, category: 'otros', description: 'x' });
  assert(r.status === 400, `status=${r.status}`);
  return r.body.details[0].message;
});

console.log('\n== FormActividad ==');

let dayId = null, actId = null;

await t('crea itinerario en blanco', async () => {
  const r = await call('POST', `/trips/${tripId}/itinerary`);
  assert(r.status === 201, JSON.stringify(r.body));
  dayId = r.body.data.itinerary.days[0]._id;
  return `${r.body.data.itinerary.days.length} dias`;
});

await t('agrega actividad con todos los campos del formulario', async () => {
  const r = await call('POST', `/trips/${tripId}/itinerary/days/${dayId}/activities`, {
    time: '14:30', title: 'Museo de las Momias', description: 'Llegar temprano',
    category: 'cultura', location: { name: 'Explanada del Panteon' },
    estimatedCost: 120, durationMinutes: 90, bookingUrl: 'https://momiasdeguanajuato.gob.mx',
  });
  assert(r.status === 201, JSON.stringify(r.body));
  actId = r.body.data.activity._id;
  const a = r.body.data.activity;
  assert(a.bookingUrl.includes('momias'), 'no guardo el link');
  assert(a.location.name === 'Explanada del Panteon', 'no guardo el lugar');
  return 'todos los campos guardados';
});

await t('URL invalida es rechazada', async () => {
  const r = await call('POST', `/trips/${tripId}/itinerary/days/${dayId}/activities`, {
    title: 'Mala', bookingUrl: 'no-es-una-url',
  });
  assert(r.status === 400, `status=${r.status}`);
  return r.body.details[0].message;
});

await t('edita actividad sin perder lo demas', async () => {
  const r = await call('PATCH', `/trips/${tripId}/itinerary/days/${dayId}/activities/${actId}`, {
    estimatedCost: 150,
  });
  assert(r.status === 200, JSON.stringify(r.body));
  assert(r.body.data.activity.estimatedCost === 150, 'no actualizo');
  assert(r.body.data.activity.title === 'Museo de las Momias', 'perdio el titulo');
  return 'PATCH parcial correcto';
});

await t('reordenar con arrastrar y soltar', async () => {
  for (const titulo of ['Segunda', 'Tercera']) {
    await call('POST', `/trips/${tripId}/itinerary/days/${dayId}/activities`, { title: titulo, time: '16:00' });
  }
  const itin = (await call('GET', `/trips/${tripId}/itinerary`)).body.data.itinerary;
  const ids = itin.days[0].activities.map((a) => a._id);

  // Simula arrastrar la ultima al principio, igual que hace la UI.
  const nuevos = [...ids];
  const [movido] = nuevos.splice(2, 1);
  nuevos.splice(0, 0, movido);

  const r = await call('PATCH', `/trips/${tripId}/itinerary/days/${dayId}/reorder`, { activityIds: nuevos });
  assert(r.status === 200, JSON.stringify(r.body));
  const orden = r.body.data.day.activities.map((a) => a.title);
  assert(orden[0] === 'Tercera', `orden=${orden.join(' > ')}`);
  assert(r.body.data.day.activities.every((a, i) => a.order === i), 'order mal renumerado');
  return orden.join(' > ');
});

console.log('\n== Resumen consolidado ==');

await t('el presupuesto suma viaje + gastos sueltos', async () => {
  const r = await call('GET', `/trips/${tripId}/summary`);
  const d = r.body.data;
  // 2200 ida + 1180 vuelta + 7600 hotel + 0 local + 320 comida
  assert(d.breakdown.transporte === 3380, `transporte=${d.breakdown.transporte}`);
  assert(d.breakdown.hospedaje === 7600, `hospedaje=${d.breakdown.hospedaje}`);
  assert(d.breakdown.comida === 320, `comida=${d.breakdown.comida}`);
  assert(d.totals.total === 11300, `total=${d.totals.total}`);
  assert(d.budget.remaining === 3700, `restante=${d.budget.remaining}`);
  return `total ${d.totals.total} de 15000, quedan ${d.budget.remaining}`;
});

// Limpieza
await call('DELETE', `/trips/${tripId}`);
console.log('\n(viaje de prueba eliminado)');
console.log(`\n${fail === 0 ? 'TODO OK' : 'HAY FALLOS'}: ${pass} pasaron, ${fail} fallaron\n`);
process.exit(fail === 0 ? 0 : 1);
