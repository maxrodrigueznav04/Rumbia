// Verifica modelos, validadores y servicios sin necesitar MongoDB.
process.env.MONGO_URI ||= 'mongodb://127.0.0.1:27017/rumbia';
process.env.JWT_SECRET ||= 'test_secret_test_secret_test_secret';
process.env.ADMIN_EMAIL ||= 'admin@rumbia.app';

const { Trip, Itinerary, Expense, User, Agency, ItineraryTemplate, AuditLog } = await import('../src/models/index.js');
const schemas = await import('../src/validators/schemas.js');
const { buildLinksForTrip } = await import('../src/services/bookingLinks.service.js');
const { getWeatherForRange, getWeatherForStops } = await import('../src/services/weather.service.js');
const { buildRouteLines } = await import('../src/services/gemini.service.js');
const { buildTripContext } = await import('../src/services/chat.service.js');
const { esAdmin } = await import('../src/utils/esAdmin.js');
const { escaparRegex, CAMPOS_EDITABLES_DIRECTO } = await import('../src/controllers/trip.controller.js');
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

await check('Trip valido con paradas adicionales pasa validacion', async () => {
  const t = new Trip({
    user: uid, title: 'Ruta europea',
    destination: { name: 'Paris', country: 'FR' },
    additionalDestinations: [
      { place: { name: 'Roma', country: 'IT' }, startDate: new Date('2026-09-14'), endDate: new Date('2026-09-18') },
    ],
    startDate: new Date('2026-09-10'), endDate: new Date('2026-09-18'),
  });
  const err = await t.validate().then(() => null, (e) => e);
  assert(!err, err?.message);
  return '1 parada dentro del rango del viaje, sin errores';
});

await check('Trip rechaza una parada con endDate < startDate propia', async () => {
  const t = new Trip({
    user: uid, title: 'X', destination: { name: 'Y' },
    additionalDestinations: [
      { place: { name: 'Z' }, startDate: new Date('2026-09-16'), endDate: new Date('2026-09-14') },
    ],
    startDate: new Date('2026-09-10'), endDate: new Date('2026-09-18'),
  });
  const err = await t.validate().then(() => null, (e) => e);
  assert(err?.errors?.['additionalDestinations.0.endDate'], 'deberia invalidar la parada');
  return err.errors['additionalDestinations.0.endDate'].message;
});

await check('Trip rechaza una parada fuera del rango del viaje', async () => {
  const t = new Trip({
    user: uid, title: 'X', destination: { name: 'Y' },
    additionalDestinations: [
      { place: { name: 'Z' }, startDate: new Date('2026-09-05'), endDate: new Date('2026-09-08') },
    ],
    startDate: new Date('2026-09-10'), endDate: new Date('2026-09-18'),
  });
  const err = await t.validate().then(() => null, (e) => e);
  assert(err?.errors?.['additionalDestinations.0'], 'deberia invalidar la parada por caer fuera del rango');
  return 'parada anterior al inicio del viaje rechazada';
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

await check('lodging: sin destinationIndex, por defecto es 0 (destino principal)', async () => {
  const l = viajeCon([{ totalCost: 1000, nights: 1 }]).lodging[0];
  assert(l.destinationIndex === 0, `destinationIndex=${l.destinationIndex}`);
  return 'retrocompatible: viajes viejos se leen como destino principal';
});

await check('lodging: destinationIndex fuera de rango NO bloquea el guardado', async () => {
  // Igual que Itinerary.days.destinationIndex: es informativo, no bloqueante.
  // Un viaje con 1 sola parada (additionalDestinations.length === 1) y un
  // hospedaje con destinationIndex: 5 (huerfano, p.ej. porque se borro una
  // parada) debe seguir pasando validacion -- nunca dejar el viaje sin poder
  // guardarse por un dato de un hospedaje que ni siquiera esta en pantalla.
  const t = new Trip({
    user: uid, title: 'X', destination: { name: 'Madrid' },
    additionalDestinations: [
      { place: { name: 'Roma' }, startDate: new Date('2026-09-14'), endDate: new Date('2026-09-16') },
    ],
    startDate: new Date('2026-09-10'), endDate: new Date('2026-09-18'),
    lodging: [{ totalCost: 1000, nights: 1, destinationIndex: 5 }],
  });
  const err = await t.validate().then(() => null, (e) => e);
  assert(!err, err?.message);
  return 'destinationIndex huerfano (5, sin parada 5) no truena la validacion';
});

await check('Trip: existe un indice para el filtro "proximos"/"pasados" (user + endDate)', async () => {
  // schema.indexes() no necesita conexion real a Mongo: solo lee las
  // definiciones declaradas. listTrips filtra por endDate en esos dos
  // estados; sin este indice esa consulta hace collection scan.
  const indices = Trip.schema.indexes().map(([campos]) => JSON.stringify(campos));
  assert(
    indices.includes(JSON.stringify({ user: 1, endDate: 1 })),
    `indices declarados: ${indices.join(', ')}`
  );
  return 'indice {user:1, endDate:1} declarado';
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

await check('esAdmin reconoce solo al correo de ADMIN_EMAIL', async () => {
  assert(esAdmin({ email: 'admin@rumbia.app' }) === true, 'deberia reconocer al admin');
  assert(esAdmin({ email: 'otro@correo.com' }) === false, 'nadie mas deberia pasar');
  assert(esAdmin(null) === false, 'sin usuario no truena, da false');
  return 'admin reconocido, cualquier otro correo rechazado, null seguro';
});

await check('User nace sin uso de IA registrado este mes', async () => {
  const u = new User({ name: 'Ana', email: 'a@b.com', password: 'secreto123' });
  assert(u.usoIA.mes === '' && u.usoIA.generaciones === 0, 'sin mes ni generaciones todavia');
  return 'mes vacio, 0 generaciones -> consumirCupoPersonal lo inicializa tras generar con exito';
});

await check('Agency nace en periodo de prueba (trial), sin agentes extra', async () => {
  const a = new Agency({ agencyName: 'Viajes del Sur', owner: uid });
  assert(!a.validateSync(), 'no deberia fallar');
  assert(a.billing.status === 'trial', `status=${a.billing.status}`);
  assert(a.billing.trialHasta instanceof Date, 'debe tener fecha de fin de trial');
  assert(a.capacidadAgentes === 3, `capacidad=${a.capacidadAgentes}`);
  return 'trial 7 días, cupo 3';
});

await check('Agency: agentes extra suman a la capacidad', async () => {
  const a = new Agency({ agencyName: 'Viajes del Sur', owner: uid, billing: { extraAgentes: 5 } });
  assert(a.capacidadAgentes === 8, `capacidad=${a.capacidadAgentes}`);
  return '3 incluidos + 5 extra = 8';
});

await check('Agency: capacidadAgentes respeta el tope base de cada tier (Inicio/Agencia/Pro)', async () => {
  // Bug real corregido: billing.controller.js usaba AGENTES_INCLUIDOS (fijo
  // en 3) para validar el cupo al ajustar agentes extra, en vez de leer
  // capacidadAgentes -- bloqueaba a cualquier agencia Agencia/Pro con mas
  // de 3 miembros, aunque su plan tuviera cupo real de sobra.
  const inicio = new Agency({ agencyName: 'X', owner: uid, billing: { plan: 'inicio_mensual' } });
  assert(inicio.capacidadAgentes === 3, `inicio=${inicio.capacidadAgentes}`);

  const agencia = new Agency({ agencyName: 'X', owner: uid, billing: { plan: 'agencia_mensual' } });
  assert(agencia.capacidadAgentes === 8, `agencia=${agencia.capacidadAgentes}`);

  const pro = new Agency({ agencyName: 'X', owner: uid, billing: { plan: 'pro_mensual', extraAgentes: 4 } });
  assert(pro.capacidadAgentes === 19, `pro=${pro.capacidadAgentes}`);

  return 'inicio=3, agencia=8, pro=15(+extra)';
});

await check('Agency: marcaBlanca solo en planes Agencia y Pro, no Inicio ni sin plan', async () => {
  const sinPlan = new Agency({ agencyName: 'X', owner: uid });
  assert(sinPlan.marcaBlanca === false, 'trial/sin plan no califica');

  const inicio = new Agency({ agencyName: 'X', owner: uid, billing: { plan: 'inicio_mensual' } });
  assert(inicio.marcaBlanca === false, 'Inicio no califica');

  const agencia = new Agency({ agencyName: 'X', owner: uid, billing: { plan: 'agencia_anual' } });
  assert(agencia.marcaBlanca === true, 'Agencia si califica');

  const pro = new Agency({ agencyName: 'X', owner: uid, billing: { plan: 'pro_mensual' } });
  assert(pro.marcaBlanca === true, 'Pro si califica');

  return 'sin plan/Inicio -> false, Agencia/Pro -> true';
});

await check('Agency valida el formato del color de acento', async () => {
  const valido = new Agency({ agencyName: 'X', owner: uid, colorAcento: '#1F6F5C' });
  assert(!valido.validateSync(), 'un hex de 6 digitos es valido');

  const invalido = new Agency({ agencyName: 'X', owner: uid, colorAcento: 'verde' });
  assert(invalido.validateSync()?.errors.colorAcento, 'un color que no es hex debe fallar');

  return 'hex valido pasa, texto libre se rechaza';
});

await check('Agency rechaza un plan que no existe', async () => {
  const a = new Agency({ agencyName: 'X', owner: uid, billing: { plan: 'trimestral' } });
  assert(a.validateSync()?.errors['billing.plan'], 'deberia invalidar el plan');
  return 'enum aplicado';
});

await check('AuditLog exige actor y una accion del enum', async () => {
  const sinActor = new AuditLog({ accion: 'agencia.codigo_regenerado' });
  assert(sinActor.validateSync()?.errors?.actor, 'deberia exigir actor');

  const accionInventada = new AuditLog({ actor: uid, accion: 'agencia.hackeada' });
  assert(accionInventada.validateSync()?.errors?.accion, 'deberia invalidar una accion fuera del enum');

  const valido = new AuditLog({ actor: uid, accion: 'agencia.miembro_eliminado' });
  assert(!valido.validateSync(), 'con actor y accion valida no deberia fallar');
  return 'actor y accion obligatorios, enum aplicado';
});

await check('AuditLog: agency es opcional (agencia.eliminada se registra antes de borrar el doc)', async () => {
  const a = new AuditLog({ actor: uid, accion: 'agencia.eliminada' });
  assert(!a.validateSync(), 'sin agency no deberia fallar la validacion');
  return 'agency puede quedar vacio sin romper la validacion';
});

await check('Agency: inviteCode nace con 16 bytes de entropia (32 caracteres hex)', async () => {
  const a = new Agency({ agencyName: 'Viajes del Sur', owner: uid });
  assert(/^[0-9a-f]{32}$/.test(a.inviteCode), `inviteCode=${a.inviteCode}`);
  const anterior = a.inviteCode;
  const nuevo = a.regenerarCodigo();
  assert(/^[0-9a-f]{32}$/.test(nuevo) && nuevo !== anterior, 'regenerar tambien produce 32 hex distintos');
  return `${a.inviteCode.length} caracteres`;
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

console.log('\n== Cupo mensual de IA (uso personal) ==');

const { verificarCupoPersonal } = await import('../src/controllers/itinerary.controller.js');
const mesActual = new Date().toISOString().slice(0, 7);

await check('verificarCupoPersonal no lanza con cupo disponible', async () => {
  const u = new User({
    name: 'Ana', email: 'a@b.com', password: 'secreto123',
    usoIA: { mes: mesActual, generaciones: 3 },
  });
  verificarCupoPersonal(u); // no deberia lanzar
  return '3 de 5 usadas, sigue pasando';
});

await check('verificarCupoPersonal lanza al llegar al limite', async () => {
  const u = new User({
    name: 'Ana', email: 'a@b.com', password: 'secreto123',
    usoIA: { mes: mesActual, generaciones: 5 },
  });
  let err;
  try { verificarCupoPersonal(u); } catch (e) { err = e; }
  assert(err, 'deberia lanzar al llegar a 5');
  return err.message;
});

await check('verificarCupoPersonal NO consume cupo por si sola (a diferencia de la version vieja)', async () => {
  // Este es el bug real que motivo separar verificar de consumir: antes,
  // cada intento fallido a Gemini (503, timeout) ya habia gastado un cupo
  // porque revisarCupoPersonal() incrementaba y guardaba ANTES de llamar a
  // Gemini. Ahora verificar es de solo lectura -- llamarla muchas veces
  // seguidas (como reintentar una generacion que sigue fallando) no debe
  // mover el contador ni un poco.
  const u = new User({
    name: 'Ana', email: 'a@b.com', password: 'secreto123',
    usoIA: { mes: mesActual, generaciones: 4 },
  });
  for (let i = 0; i < 10; i += 1) verificarCupoPersonal(u);
  assert(u.usoIA.generaciones === 4, `no deberia moverse de 4, quedo en ${u.usoIA.generaciones}`);
  return 'diez llamadas seguidas, el contador se queda en 4 (consumirCupoPersonal es quien lo mueve, tras exito real)';
});

console.log('\n== Cupo mensual del chat de IA (uso personal) ==');

const { verificarCupoChat } = await import('../src/controllers/chat.controller.js');

await check('verificarCupoChat no lanza con cupo disponible, y es independiente del de generaciones', async () => {
  const u = new User({
    name: 'Ana', email: 'a@b.com', password: 'secreto123',
    usoIA: { mes: mesActual, generaciones: 5, mensajesChat: 10 },
  });
  verificarCupoChat(u); // no deberia lanzar aunque generaciones ya este al tope
  return '10 de 60 mensajes usados, generaciones al tope no afecta al chat';
});

await check('verificarCupoChat lanza al llegar al limite', async () => {
  const u = new User({
    name: 'Ana', email: 'a@b.com', password: 'secreto123',
    usoIA: { mes: mesActual, mensajesChat: 60 },
  });
  let err;
  try { verificarCupoChat(u); } catch (e) { err = e; }
  assert(err, 'deberia lanzar al llegar a 60');
  return err.message;
});

await check('verificarCupoChat no aplica a cuentas con agencia', async () => {
  const u = new User({
    name: 'Ana', email: 'a@b.com', password: 'secreto123',
    agency: new mongoose.Types.ObjectId(),
    usoIA: { mes: mesActual, mensajesChat: 999 },
  });
  verificarCupoChat(u); // no deberia lanzar: con agencia, el cupo mensual no aplica
  return 'agencia sin limite mensual, igual que verificarCupoPersonal';
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

await check('createTripSchema conserva additionalDestinations (no lo descarta)', async () => {
  const r = schemas.createTripSchema.safeParse({
    title: 'Ruta europea', destination: { name: 'Paris' },
    additionalDestinations: [
      { place: { name: 'Roma' }, startDate: '2026-09-14', endDate: '2026-09-18' },
    ],
    startDate: '2026-09-10', endDate: '2026-09-18',
  });
  assert(r.success, JSON.stringify(r.error?.issues));
  assert(r.data.additionalDestinations?.length === 1, 'additionalDestinations no deberia perderse');
  assert(r.data.additionalDestinations[0].place.name === 'Roma', 'el lugar de la parada deberia conservarse');
  return 'parada conservada tal cual se mando';
});

await check('createTripSchema rechaza una parada fuera de las fechas del viaje', async () => {
  const r = schemas.createTripSchema.safeParse({
    title: 'X', destination: { name: 'Y' },
    additionalDestinations: [
      { place: { name: 'Z' }, startDate: '2026-09-05', endDate: '2026-09-08' },
    ],
    startDate: '2026-09-10', endDate: '2026-09-18',
  });
  assert(!r.success, 'deberia fallar');
  return r.error.issues[0].message;
});

await check('updateTripSchema con solo additionalDestinations no dispara "body vacio"', async () => {
  const r = schemas.updateTripSchema.safeParse({ additionalDestinations: [] });
  assert(r.success, JSON.stringify(r.error?.issues));
  return 'additionalDestinations vacio es un campo valido a actualizar';
});

await check('updateTripSchema conserva destinationIndex en lodging (no lo descarta)', async () => {
  const r = schemas.updateTripSchema.safeParse({
    lodging: [{ type: 'hotel', totalCost: 2000, nights: 2, destinationIndex: 1 }],
  });
  assert(r.success, JSON.stringify(r.error?.issues));
  assert(r.data.lodging[0].destinationIndex === 1, 'destinationIndex no deberia perderse');
  return 'destinationIndex conservado tal cual se mando';
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

await check('sendChatMessageSchema exige texto no vacio, tope 2000 caracteres, tripId opcional', async () => {
  const vacio = schemas.sendChatMessageSchema.safeParse({ message: '  ' });
  assert(!vacio.success, 'mensaje solo con espacios se rechaza (trim + min(1))');

  const sinTrip = schemas.sendChatMessageSchema.safeParse({ message: 'hola' });
  assert(sinTrip.success && sinTrip.data.tripId === undefined, 'sin tripId, modo general');

  const conTrip = schemas.sendChatMessageSchema.safeParse({
    message: 'hola', tripId: '507f1f77bcf86cd799439011',
  });
  assert(conTrip.success && conTrip.data.tripId === '507f1f77bcf86cd799439011', 'tripId valido se conserva');

  const tripInvalido = schemas.sendChatMessageSchema.safeParse({ message: 'hola', tripId: 'no-es-un-id' });
  assert(!tripInvalido.success, 'tripId con formato invalido se rechaza');

  const largo = schemas.sendChatMessageSchema.safeParse({ message: 'a'.repeat(2001) });
  assert(!largo.success, 'mas de 2000 caracteres se rechaza');

  return 'vacio rechazado, valido conservado, tope de 2000 respetado, tripId opcional y validado';
});

await check('chatQuerySchema: tripId opcional para modo general', async () => {
  const sinTrip = schemas.chatQuerySchema.safeParse({});
  assert(sinTrip.success && sinTrip.data.tripId === undefined, 'sin tripId es valido (chat general)');

  const tripNullStr = schemas.chatQuerySchema.safeParse({ tripId: 'null' });
  assert(tripNullStr.success && tripNullStr.data.tripId === undefined, "tripId 'null' no truena y pasa a undefined");

  const tripUndefStr = schemas.chatQuerySchema.safeParse({ tripId: 'undefined' });
  assert(tripUndefStr.success && tripUndefStr.data.tripId === undefined, "tripId 'undefined' no truena y pasa a undefined");

  const tripVacio = schemas.chatQuerySchema.safeParse({ tripId: '' });
  assert(tripVacio.success && tripVacio.data.tripId === undefined, 'tripId vacio no truena y pasa a undefined');

  const conTrip = schemas.chatQuerySchema.safeParse({ tripId: '507f1f77bcf86cd799439011' });
  assert(conTrip.success && conTrip.data.tripId === '507f1f77bcf86cd799439011', 'tripId valido se conserva');

  return 'chat general (sin tripId, con null, con undefined o vacio) y con tripId validos';
});

await check('bookingLinksQuerySchema acepta lodgingIndex opcional', async () => {
  const sinIndice = schemas.bookingLinksQuerySchema.safeParse({ section: 'hospedaje' });
  assert(sinIndice.success && sinIndice.data.lodgingIndex === undefined, 'sin lodgingIndex, sigue siendo opcional');

  const conIndice = schemas.bookingLinksQuerySchema.safeParse({ section: 'hospedaje', lodgingIndex: '1' });
  assert(conIndice.success && conIndice.data.lodgingIndex === 1, 'coerciona el string de query a numero');

  const negativo = schemas.bookingLinksQuerySchema.safeParse({ lodgingIndex: '-1' });
  assert(!negativo.success, 'rechaza negativos');

  return 'opcional, coerciona a numero, rechaza negativos';
});

console.log('\n== Seguridad ==');

await check('updateTrip: el allowlist de campos editables nunca incluye datos internos', async () => {
  const peligrosos = ['user', 'grupoPropuesta', '_id', 'id', '__v'];
  for (const campo of peligrosos) {
    assert(!CAMPOS_EDITABLES_DIRECTO.includes(campo), `"${campo}" no deberia ser editable via PATCH`);
  }
  // Y que si trae los campos reales que si se pueden editar directo (los que
  // no llevan merge especial en updateTrip: budget/origin/margen/cliente/
  // transport si lo llevan, y no deben estar aqui).
  for (const campo of ['title', 'status', 'lodging', 'additionalDestinations']) {
    assert(CAMPOS_EDITABLES_DIRECTO.includes(campo), `"${campo}" deberia poder editarse via PATCH`);
  }
  for (const campo of ['budget', 'origin', 'margen', 'cliente', 'transport']) {
    assert(!CAMPOS_EDITABLES_DIRECTO.includes(campo), `"${campo}" se fusiona aparte, no deberia estar en el allowlist directo`);
  }
  return `${CAMPOS_EDITABLES_DIRECTO.length} campos editables directos, sin datos internos`;
});

await check('escaparRegex neutraliza un patron tipo ReDoS antes de armar el regex', async () => {
  // (a+)+$ es el ejemplo clasico de backtracking catastrofico. Si se
  // escapa bien, new RegExp() lo trata como texto literal (no como grupo
  // repetido) y evaluarlo contra una cadena que provocaria el cuelgue debe
  // ser instantaneo.
  const patronMalicioso = '(a+)+$';
  const inicio = Date.now();
  const re = new RegExp(escaparRegex(patronMalicioso), 'i');
  const sinMatch = re.test('a'.repeat(40) + '!'); // la entrada que cuelga el regex sin escapar
  const tardanza = Date.now() - inicio;
  assert(!sinMatch, 'como texto literal, "(a+)+$" no aparece dentro de puras "a"');
  assert(tardanza < 100, `deberia ser instantaneo, tardo ${tardanza}ms`);
  return `neutralizado, ${tardanza}ms`;
});

await check('escaparRegex no rompe una busqueda normal', async () => {
  const re = new RegExp(escaparRegex('roma'), 'i');
  assert(re.test('Viaje a Roma'), 'la busqueda case-insensitive de siempre sigue funcionando');
  return 'busqueda normal intacta';
});

await check('escaparRegex trata un punto literal como punto, no "cualquier caracter"', async () => {
  const re = new RegExp(escaparRegex('a.c'), 'i');
  assert(!re.test('abc'), 'sin escapar, "." haria match con cualquier caracter (abc si haria match)');
  assert(re.test('a.c'), 'el punto literal si debe encontrarse a si mismo');
  return 'metacaracteres literales, no interpretados';
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

await check('buildLinksForTrip: hospedaje usa la ciudad de la parada real, no siempre el destino principal', async () => {
  const trip = new Trip({
    user: uid, title: 'Euro trip',
    destination: { name: 'Madrid', country: 'ES' },
    additionalDestinations: [
      { place: { name: 'Barcelona' }, startDate: new Date('2026-09-13'), endDate: new Date('2026-09-16') },
    ],
    startDate: new Date('2026-09-10'), endDate: new Date('2026-09-16'),
    lodging: [
      { type: 'hotel', destinationIndex: 1, checkIn: new Date('2026-09-13'), checkOut: new Date('2026-09-16') },
    ],
  });
  const links = buildLinksForTrip(trip, { section: 'hospedaje' });
  assert(links.hospedaje[0].url.includes(encodeURIComponent('Barcelona')), 'deberia buscar en Barcelona, no Madrid');
  return links.hospedaje[0].url;
});

await check('buildLinksForTrip: destinationIndex huerfano (parada borrada) cae al destino principal sin tronar', async () => {
  const trip = new Trip({
    user: uid, title: 'Euro trip',
    destination: { name: 'Madrid', country: 'ES' },
    additionalDestinations: [],
    startDate: new Date('2026-09-10'), endDate: new Date('2026-09-16'),
    lodging: [{ type: 'hotel', destinationIndex: 3, checkIn: new Date('2026-09-13'), checkOut: new Date('2026-09-16') }],
  });
  const links = buildLinksForTrip(trip, { section: 'hospedaje' });
  assert(links.hospedaje[0].url.includes(encodeURIComponent('Madrid')), 'deberia caer al destino principal');
  return links.hospedaje[0].url;
});

await check('buildLinksForTrip: lodgingIndex opt-in apunta a un hospedaje especifico', async () => {
  const trip = new Trip({
    user: uid, title: 'Euro trip',
    destination: { name: 'Madrid', country: 'ES' },
    additionalDestinations: [
      { place: { name: 'Barcelona' }, startDate: new Date('2026-09-13'), endDate: new Date('2026-09-16') },
    ],
    startDate: new Date('2026-09-10'), endDate: new Date('2026-09-16'),
    lodging: [
      { type: 'hotel', destinationIndex: 0, checkIn: new Date('2026-09-10'), checkOut: new Date('2026-09-13') },
      { type: 'airbnb', destinationIndex: 1, checkIn: new Date('2026-09-13'), checkOut: new Date('2026-09-16') },
    ],
  });
  const sinIndice = buildLinksForTrip(trip, { section: 'hospedaje' });
  assert(sinIndice.hospedaje[0].url.includes(encodeURIComponent('Madrid')), 'sin indice, usa lodging[0] -> Madrid');

  const conIndice = buildLinksForTrip(trip, { section: 'hospedaje', lodgingIndex: 1 });
  assert(conIndice.hospedaje[0].provider === 'Airbnb', 'lodgingIndex 1 es el airbnb');
  assert(conIndice.hospedaje[0].url.includes(encodeURIComponent('Barcelona')), 'lodgingIndex 1 -> Barcelona');

  const fueraDeRango = buildLinksForTrip(trip, { section: 'hospedaje', lodgingIndex: 99 });
  assert(fueraDeRango.hospedaje[0].url.includes(encodeURIComponent('Madrid')), 'indice invalido cae a lodging[0]');

  return 'sin indice=Madrid, indice 1=Barcelona/Airbnb, indice invalido=Madrid';
});

await check('buildLinksForTrip: sin lodging usa el destino principal (comportamiento previo intacto)', async () => {
  const trip = new Trip({
    user: uid, title: 'X', destination: { name: 'Oaxaca' },
    startDate: new Date('2026-09-10'), endDate: new Date('2026-09-14'),
  });
  const links = buildLinksForTrip(trip, { section: 'hospedaje' });
  assert(links.hospedaje[0].url.includes(encodeURIComponent('Oaxaca')), 'sin hospedajes, cae al destino principal');
  return links.hospedaje[0].url;
});

await check('buildTripContext incluye destino, presupuesto y la ciudad real de cada hospedaje', async () => {
  const trip = new Trip({
    user: uid, title: 'Euro trip 2027',
    destination: { name: 'Madrid', country: 'ES' },
    additionalDestinations: [
      { place: { name: 'Barcelona' }, startDate: new Date('2027-06-13'), endDate: new Date('2027-06-16') },
    ],
    startDate: new Date('2027-06-10'), endDate: new Date('2027-06-16'),
    travelers: 2,
    budget: { amount: 50000, currency: 'MXN' },
    lodging: [
      { type: 'hotel', name: 'Hotel Centro', destinationIndex: 0, checkIn: new Date('2027-06-10'), checkOut: new Date('2027-06-13') },
      { type: 'airbnb', name: 'Depa Born', destinationIndex: 1, checkIn: new Date('2027-06-13'), checkOut: new Date('2027-06-16') },
    ],
  });
  const contexto = buildTripContext(trip, null);
  assert(contexto.includes('Madrid'), 'incluye el destino principal');
  assert(contexto.includes('Barcelona'), 'incluye la parada adicional');
  assert(contexto.includes('50000'), 'incluye el presupuesto');
  assert(contexto.includes('Hotel Centro en Madrid'), 'primer hospedaje con su ciudad real');
  assert(contexto.includes('Depa Born en Barcelona'), 'segundo hospedaje con su ciudad real, no la principal');
  return contexto.split('\n').length + ' lineas de contexto';
});

await check('buildTripContext sin viaje (modo general) no truena', async () => {
  const contexto = buildTripContext(null, null);
  assert(typeof contexto === 'string' && contexto.length > 0, 'devuelve texto, no lanza');
  return contexto;
});

await check('buildTripContext no truena sin hospedaje, sin paradas ni sin itinerario', async () => {
  const trip = new Trip({
    user: uid, title: 'Oaxaca', destination: { name: 'Oaxaca' },
    startDate: new Date('2027-01-01'), endDate: new Date('2027-01-05'),
  });
  const contexto = buildTripContext(trip, null);
  assert(contexto.includes('Todavia no hay hospedaje capturado'), 'aviso de sin hospedaje');
  assert(contexto.includes('Todavia no hay itinerario armado'), 'aviso de sin itinerario');
  return 'viaje minimo, contexto sin tronar';
});

await check('buildTripContext resume el itinerario existente cuando lo hay', async () => {
  const trip = new Trip({
    user: uid, title: 'Oaxaca', destination: { name: 'Oaxaca' },
    startDate: new Date('2027-01-01'), endDate: new Date('2027-01-02'),
  });
  const itinerary = new Itinerary({
    trip: trip._id, user: uid, generatedBy: 'ia',
    days: [{ dayNumber: 1, title: 'Centro historico', activities: [] }],
  });
  const contexto = buildTripContext(trip, itinerary);
  assert(contexto.includes('generado con IA'), 'dice como se genero');
  assert(contexto.includes('Centro historico'), 'incluye el titulo del dia');
  return 'itinerario existente resumido en el contexto';
});

await check('buildRouteLines: un solo destino devuelve un tramo que cubre todo el viaje', async () => {
  const ruta = buildRouteLines('Paris', 5, []);
  assert(ruta.length === 1, 'un solo tramo');
  assert(ruta[0].startDay === 1 && ruta[0].endDay === 5 && ruta[0].destinationIndex === 0, JSON.stringify(ruta));
  return `1 tramo: Paris, dias 1-5, indice 0`;
});

await check('buildRouteLines: rellena el destino principal antes/despues/entre paradas', async () => {
  const ruta = buildRouteLines('Paris', 10, [
    { nombre: 'Roma', startDay: 4, endDay: 6 },
    { nombre: 'Berlin', startDay: 8, endDay: 9 },
  ]);
  assert(ruta.length === 5, `5 tramos esperados, vinieron ${ruta.length}`);
  const [t1, t2, t3, t4, t5] = ruta;
  assert(t1.nombre === 'Paris' && t1.startDay === 1 && t1.endDay === 3 && t1.destinationIndex === 0, JSON.stringify(t1));
  assert(t2.nombre === 'Roma' && t2.startDay === 4 && t2.endDay === 6 && t2.destinationIndex === 1, JSON.stringify(t2));
  assert(t3.nombre === 'Paris' && t3.startDay === 7 && t3.endDay === 7 && t3.destinationIndex === 0, JSON.stringify(t3));
  assert(t4.nombre === 'Berlin' && t4.startDay === 8 && t4.endDay === 9 && t4.destinationIndex === 2, JSON.stringify(t4));
  assert(t5.nombre === 'Paris' && t5.startDay === 10 && t5.endDay === 10 && t5.destinationIndex === 0, JSON.stringify(t5));
  return 'Paris(1-3) -> Roma(4-6, idx1) -> Paris(7) -> Berlin(8-9, idx2) -> Paris(10)';
});

await check('buildRouteLines: parada pegada al inicio no deja un tramo vacio de Paris', async () => {
  const ruta = buildRouteLines('Paris', 6, [{ nombre: 'Roma', startDay: 1, endDay: 3 }]);
  assert(ruta.length === 2, `2 tramos esperados, vinieron ${ruta.length}`);
  assert(ruta[0].nombre === 'Roma' && ruta[0].startDay === 1, 'la parada empieza el dia 1, sin hueco antes');
  assert(ruta[1].nombre === 'Paris' && ruta[1].startDay === 4 && ruta[1].endDay === 6, JSON.stringify(ruta[1]));
  return 'sin tramo vacio cuando la parada arranca el dia 1';
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

await check('getWeatherForStops resuelve clima por parada, con coordenadas', async () => {
  const paradas = await getWeatherForStops([
    { place: { name: 'Roma', lat: 41.9, lng: 12.5 }, startDate: new Date('2027-01-14'), endDate: new Date('2027-01-16') },
  ]);
  assert(paradas.length === 1 && !paradas[0].error, JSON.stringify(paradas));
  assert(paradas[0].days.length === 3, `dias de la parada=${paradas[0].days.length}`);
  return `1 parada, ${paradas[0].days.length} dias, sin error`;
});

await check('getWeatherForStops no tumba las demas si una parada no se puede geocodificar', async () => {
  const paradas = await getWeatherForStops([
    { place: { name: 'Ciudad Inventada Xyz123' }, startDate: new Date('2027-01-14'), endDate: new Date('2027-01-16') },
    { place: { name: 'Roma', lat: 41.9, lng: 12.5 }, startDate: new Date('2027-01-17'), endDate: new Date('2027-01-18') },
  ]);
  assert(paradas.length === 2, 'deberian venir las 2 paradas');
  assert(paradas[0].error, 'la primera deberia fallar (sin API key de geocodificacion no hay red)');
  assert(!paradas[1].error && paradas[1].days, 'la segunda si trae coordenadas y no deberia fallar');
  return 'la parada sin geocodificar trae error, la otra sigue funcionando';
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
