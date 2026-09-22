/**
 * Test de regresión para P02: Aislamiento multi-tenant y propiedad de datos de agencia.
 * Cubre:
 * 1. Caso mixto de eliminación de cuenta (personal borrado, corporativo preservado, owner sin 500)
 * 2. Ex-miembro expulsado no puede modificar ni borrar gasto corporativo (403)
 * 3. Owner de la agencia sí puede modificar y borrar gasto corporativo de miembro (200)
 * 4. Otro miembro activo de la misma agencia no puede modificar ni borrar (403)
 * 5. Autor del gasto (miembro activo) sí puede modificar y borrar su propio gasto (200)
 * 6. Usuario de otra agencia no puede modificar ni borrar (403)
 * 7. Ex-miembro que salió voluntariamente de la agencia (POST /api/agency/salir) no puede modificar ni borrar (403)
 * 8. Edición y eliminación de gastos personales (dueño: 200, usuario ajeno: 403)
 * 9. Baja del owner con miembros: la agencia se elimina, los viajes de miembros revierten a personal y no pierden acceso
 */

const mongoUri = process.env.MONGO_URI_TEST || process.env.TEST_MONGO_URI;
if (!mongoUri) {
  console.error('\n[test-p02-regression] Error: Se requiere una URI configurada para una base de datos de pruebas aislada.');
  console.error('[test-p02-regression] Define la variable de entorno MONGO_URI_TEST o TEST_MONGO_URI antes de ejecutar este test.\n');
  process.exit(1);
}

process.env.MONGO_URI = mongoUri;
process.env.JWT_SECRET ||= 'test_only_rumbia_regression_secret_1234567890';
process.env.NODE_ENV = 'test';

import mongoose from 'mongoose';
import http from 'http';

const { default: app } = await import('../src/app.js');
const { signToken } = await import('../src/middleware/auth.js');
const { User, Trip, Expense, Itinerary, Agency, ItineraryTemplate } = await import('../src/models/index.js');

let server;
let baseUrl;

async function startServer() {
  await mongoose.connect(process.env.MONGO_URI);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}/api`;
  console.log(`[test-p02-regression] Servidor de prueba escuchando en puerto ${port}`);
}

async function stopServer() {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  console.log('[test-p02-regression] Servidor y base de datos desconectados');
}

function req(method, path, { user, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (user) {
    const token = signToken(user._id);
    headers['Cookie'] = `rumbia_token=${token}`;
    headers['X-Rumbia-User'] = String(user._id);
  }
  return fetch(baseUrl + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (res) => ({
    status: res.status,
    json: await res.json().catch(() => null),
  }));
}

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

async function runTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✅ OK: ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  ❌ FALLÓ: ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

async function cleanupTestData(tag) {
  const users = await User.find({ email: new RegExp(tag, 'i') });
  const userIds = users.map((u) => u._id);
  const agencies = await Agency.find({ owner: { $in: userIds } });
  const agencyIds = agencies.map((a) => a._id);

  await Expense.deleteMany({ $or: [{ user: { $in: userIds } }, { trip: { $in: await Trip.find({ $or: [{ user: { $in: userIds } }, { agency: { $in: agencyIds } }] }).distinct('_id') } }] });
  await Itinerary.deleteMany({ user: { $in: userIds } });
  await ItineraryTemplate.deleteMany({ $or: [{ user: { $in: userIds } }, { agency: { $in: agencyIds } }] });
  await Trip.deleteMany({ $or: [{ user: { $in: userIds } }, { agency: { $in: agencyIds } }] });
  await Agency.deleteMany({ _id: { $in: agencyIds } });
  await User.deleteMany({ _id: { $in: userIds } });
}

const ts = Date.now();
const TAG = `p02test_${ts}`;

async function crearUsuario(email, name = 'Usuario Test', role = 'agente') {
  return await User.create({
    name,
    email,
    password: 'Password123!',
    emailVerified: true,
    role,
    preferences: { perfilUso: 'agencia' },
  });
}

async function main() {
  console.log('================================================================');
  console.log('SUITE DE REGRESIÓN P02: AISLAMIENTO MULTI-TENANT Y PERMISOS');
  console.log('================================================================\n');

  await startServer();

  try {
    // -------------------------------------------------------------
    // CASO 1: Caso mixto de eliminación de cuenta
    // -------------------------------------------------------------
    await runTest('1. Caso mixto de eliminación de cuenta (personal borrado, corporativo preservado, owner sin 500)', async () => {
      const owner = await crearUsuario(`owner1_${TAG}@test.com`, 'Owner 1', 'dueno_agencia');
      const agency = await Agency.create({
        agencyName: 'Agencia 1 Test',
        owner: owner._id,
        billing: { status: 'activa', plan: 'agencia_mensual' },
      });
      owner.agency = agency._id;
      await owner.save();

      const member = await crearUsuario(`member1_${TAG}@test.com`, 'Member 1', 'agente');
      member.agency = agency._id;
      await member.save();

      const personalTrip = await Trip.create({
        user: member._id,
        agency: null,
        title: 'Viaje Personal Member 1',
        destination: { name: 'Cancún', country: 'MX' },
        startDate: '2026-10-01',
        endDate: '2026-10-05',
        travelers: 1,
      });
      const personalExpense = await Expense.create({
        user: member._id,
        trip: personalTrip._id,
        category: 'comida',
        description: 'Tacos personales',
        amount: 250,
        currency: 'MXN',
        date: '2026-10-02',
      });

      const corpTrip = await Trip.create({
        user: member._id,
        agency: agency._id,
        title: 'Viaje Corporativo Member 1',
        destination: { name: 'Madrid', country: 'ES' },
        startDate: '2026-11-01',
        endDate: '2026-11-08',
        travelers: 2,
      });
      const corpExpense = await Expense.create({
        user: member._id,
        trip: corpTrip._id,
        category: 'hospedaje',
        description: 'Hotel corporativo',
        amount: 5000,
        currency: 'MXN',
        date: '2026-11-02',
      });
      const corpTemplate = await ItineraryTemplate.create({
        user: member._id,
        agency: agency._id,
        name: 'Plantilla Madrid Corp',
        destination: { name: 'Madrid', country: 'ES' },
        days: [{ dayNumber: 1, title: 'Día 1', activities: [] }],
      });

      const deleteRes = await req('DELETE', '/auth/me', {
        user: member,
        body: { password: 'Password123!' },
      });
      assert(deleteRes.status === 200, `DELETE /auth/me respondió ${deleteRes.status}`);
      assert(deleteRes.json?.data?.viajesEliminados === 1, `Reportó ${deleteRes.json?.data?.viajesEliminados} viajes eliminados, se esperaba 1`);

      const checkPersonalTrip = await Trip.findById(personalTrip._id);
      assert(checkPersonalTrip === null, 'El viaje personal NO se eliminó de la BD');
      const checkPersonalExpense = await Expense.findById(personalExpense._id);
      assert(checkPersonalExpense === null, 'El gasto personal NO se eliminó de la BD');

      const checkCorpTrip = await Trip.findById(corpTrip._id);
      assert(checkCorpTrip !== null, 'El viaje corporativo fue incorrectamente eliminado');
      assert(String(checkCorpTrip.agency) === String(agency._id), 'El viaje corporativo perdió su referencia de agencia');
      assert(String(checkCorpTrip.user) === String(member._id), 'La autoría histórica del viaje corporativo fue alterada');

      const checkCorpExpense = await Expense.findById(corpExpense._id);
      assert(checkCorpExpense !== null, 'El gasto corporativo fue incorrectamente eliminado');
      assert(String(checkCorpExpense.user) === String(member._id), 'La autoría histórica del gasto corporativo fue alterada');

      const checkCorpTemplate = await ItineraryTemplate.findById(corpTemplate._id);
      assert(checkCorpTemplate !== null, 'La plantilla corporativa fue incorrectamente eliminada');

      const ownerTripList = await req('GET', '/trips', { user: owner });
      assert(ownerTripList.status === 200, `Owner GET /trips respondió ${ownerTripList.status}`);
      const tripEncontrado = ownerTripList.json?.data?.trips?.find((t) => String(t._id) === String(corpTrip._id));
      assert(tripEncontrado, 'El viaje corporativo no aparece en la lista de viajes del owner');

      const ownerTripDetail = await req('GET', `/trips/${corpTrip._id}`, { user: owner });
      assert(ownerTripDetail.status === 200, `Owner GET /trips/:id respondió ${ownerTripDetail.status}`);

      const ownerTripExpenses = await req('GET', `/trips/${corpTrip._id}/expenses`, { user: owner });
      assert(ownerTripExpenses.status === 200, `Owner GET /trips/:id/expenses respondió ${ownerTripExpenses.status}`);
      assert(ownerTripExpenses.json?.data?.expenses?.length === 1, 'El gasto corporativo no aparece en los gastos del viaje');

      const ownerTemplates = await req('GET', '/templates', { user: owner });
      assert(ownerTemplates.status === 200, `Owner GET /templates respondió ${ownerTemplates.status}`);
      const templateEncontrada = ownerTemplates.json?.data?.templates?.find((t) => String(t._id) === String(corpTemplate._id));
      assert(templateEncontrada, 'La plantilla corporativa no aparece');
      assert(templateEncontrada.creadaPor === 'Usuario eliminado', `creadaPor esperado 'Usuario eliminado', recibido '${templateEncontrada.creadaPor}'`);
    });

    // -------------------------------------------------------------
    // CASO 2: Ex-miembro expulsado no puede modificar ni borrar gasto corporativo
    // -------------------------------------------------------------
    await runTest('2. Ex-miembro expulsado no puede modificar ni borrar gasto corporativo (403)', async () => {
      const owner = await crearUsuario(`owner2_${TAG}@test.com`, 'Owner 2', 'dueno_agencia');
      const agency = await Agency.create({
        agencyName: 'Agencia 2 Test',
        owner: owner._id,
        billing: { status: 'activa', plan: 'agencia_mensual' },
      });
      owner.agency = agency._id;
      await owner.save();

      const member = await crearUsuario(`member2_${TAG}@test.com`, 'Member 2', 'agente');
      member.agency = agency._id;
      await member.save();

      const corpTrip = await Trip.create({
        user: member._id,
        agency: agency._id,
        title: 'Viaje Corp Caso 2',
        destination: { name: 'Tokio', country: 'JP' },
        startDate: '2026-11-01',
        endDate: '2026-11-10',
        travelers: 1,
      });
      const corpExpense = await Expense.create({
        user: member._id,
        trip: corpTrip._id,
        category: 'transporte',
        description: 'Vuelo a Tokio',
        amount: 15000,
        currency: 'MXN',
        date: '2026-11-01',
      });

      const expelRes = await req('DELETE', `/agency/miembros/${member._id}`, { user: owner });
      assert(expelRes.status === 200, `Expulsión respondió ${expelRes.status}`);

      const memberActualizado = await User.findById(member._id);
      assert(memberActualizado.agency === null, 'El miembro expulsado aún tiene agencia asignada');

      const patchRes = await req('PATCH', `/expenses/${corpExpense._id}`, {
        user: memberActualizado,
        body: { description: 'Intento de modificación no autorizada' },
      });
      assert(patchRes.status === 403, `PATCH por ex-miembro expulsado respondió ${patchRes.status}, se esperaba 403`);

      const deleteRes = await req('DELETE', `/expenses/${corpExpense._id}`, {
        user: memberActualizado,
      });
      assert(deleteRes.status === 403, `DELETE por ex-miembro expulsado respondió ${deleteRes.status}, se esperaba 403`);

      const expenseDb = await Expense.findById(corpExpense._id);
      assert(expenseDb !== null, 'El gasto fue eliminado indebidamente');
      assert(expenseDb.description === 'Vuelo a Tokio', 'El gasto fue modificado indebidamente');
    });

    // -------------------------------------------------------------
    // CASO 3: Owner de la agencia sí puede modificar y borrar gasto corporativo de miembro
    // -------------------------------------------------------------
    await runTest('3. Owner de la agencia sí puede modificar y borrar gasto corporativo de miembro (200)', async () => {
      const owner = await crearUsuario(`owner3_${TAG}@test.com`, 'Owner 3', 'dueno_agencia');
      const agency = await Agency.create({
        agencyName: 'Agencia 3 Test',
        owner: owner._id,
        billing: { status: 'activa', plan: 'agencia_mensual' },
      });
      owner.agency = agency._id;
      await owner.save();

      const member = await crearUsuario(`member3_${TAG}@test.com`, 'Member 3', 'agente');
      member.agency = agency._id;
      await member.save();

      const corpTrip = await Trip.create({
        user: member._id,
        agency: agency._id,
        title: 'Viaje Corp Caso 3',
        destination: { name: 'Bogota', country: 'CO' },
        startDate: '2026-11-05',
        endDate: '2026-11-12',
        travelers: 2,
      });
      const corpExpense = await Expense.create({
        user: member._id,
        trip: corpTrip._id,
        category: 'comida',
        description: 'Cena de bienvenida',
        amount: 800,
        currency: 'MXN',
        date: '2026-11-06',
      });

      const patchRes = await req('PATCH', `/expenses/${corpExpense._id}`, {
        user: owner,
        body: { description: 'Cena de bienvenida aprobada por Owner', amount: 950 },
      });
      assert(patchRes.status === 200, `Owner PATCH respondió ${patchRes.status}`);

      const expenseActualizado = await Expense.findById(corpExpense._id);
      assert(expenseActualizado.description === 'Cena de bienvenida aprobada por Owner', 'El gasto no se actualizó');
      assert(expenseActualizado.amount === 950, 'El monto no se actualizó');

      const deleteRes = await req('DELETE', `/expenses/${corpExpense._id}`, {
        user: owner,
      });
      assert(deleteRes.status === 200, `Owner DELETE respondió ${deleteRes.status}`);

      const expenseBorrado = await Expense.findById(corpExpense._id);
      assert(expenseBorrado === null, 'El gasto no fue eliminado por el Owner');
    });

    // -------------------------------------------------------------
    // CASO 4: Otro miembro activo de la misma agencia no puede modificar ni borrar
    // -------------------------------------------------------------
    await runTest('4. Otro miembro activo de la misma agencia no puede modificar ni borrar (403)', async () => {
      const owner = await crearUsuario(`owner4_${TAG}@test.com`, 'Owner 4', 'dueno_agencia');
      const agency = await Agency.create({
        agencyName: 'Agencia 4 Test',
        owner: owner._id,
        billing: { status: 'activa', plan: 'agencia_mensual' },
      });
      owner.agency = agency._id;
      await owner.save();

      const member1 = await crearUsuario(`member4a_${TAG}@test.com`, 'Member 4A', 'agente');
      member1.agency = agency._id;
      await member1.save();

      const member2 = await crearUsuario(`member4b_${TAG}@test.com`, 'Member 4B', 'agente');
      member2.agency = agency._id;
      await member2.save();

      const corpTrip = await Trip.create({
        user: member1._id,
        agency: agency._id,
        title: 'Viaje Corp Caso 4',
        destination: { name: 'Lima', country: 'PE' },
        startDate: '2026-11-10',
        endDate: '2026-11-15',
        travelers: 1,
      });
      const corpExpense = await Expense.create({
        user: member1._id,
        trip: corpTrip._id,
        category: 'transporte',
        description: 'Taxi aeropuerto',
        amount: 350,
        currency: 'MXN',
        date: '2026-11-10',
      });

      const patchRes = await req('PATCH', `/expenses/${corpExpense._id}`, {
        user: member2,
        body: { description: 'Intento de modificación por compañero' },
      });
      assert(patchRes.status === 403, `PATCH por otro miembro respondió ${patchRes.status}, se esperaba 403`);

      const deleteRes = await req('DELETE', `/expenses/${corpExpense._id}`, {
        user: member2,
      });
      assert(deleteRes.status === 403, `DELETE por otro miembro respondió ${deleteRes.status}, se esperaba 403`);

      const expenseDb = await Expense.findById(corpExpense._id);
      assert(expenseDb !== null && expenseDb.description === 'Taxi aeropuerto', 'El gasto fue indebidamente afectado');
    });

    // -------------------------------------------------------------
    // CASO 5: Autor del gasto (miembro activo) sí puede modificar y borrar su propio gasto
    // -------------------------------------------------------------
    await runTest('5. Autor del gasto (miembro activo) sí puede modificar y borrar su propio gasto (200)', async () => {
      const owner = await crearUsuario(`owner5_${TAG}@test.com`, 'Owner 5', 'dueno_agencia');
      const agency = await Agency.create({
        agencyName: 'Agencia 5 Test',
        owner: owner._id,
        billing: { status: 'activa', plan: 'agencia_mensual' },
      });
      owner.agency = agency._id;
      await owner.save();

      const member = await crearUsuario(`member5_${TAG}@test.com`, 'Member 5', 'agente');
      member.agency = agency._id;
      await member.save();

      const corpTrip = await Trip.create({
        user: member._id,
        agency: agency._id,
        title: 'Viaje Corp Caso 5',
        destination: { name: 'Santiago', country: 'CL' },
        startDate: '2026-12-01',
        endDate: '2026-12-06',
        travelers: 1,
      });
      const corpExpense = await Expense.create({
        user: member._id,
        trip: corpTrip._id,
        category: 'hospedaje',
        description: 'Hotel Providencia',
        amount: 4200,
        currency: 'MXN',
        date: '2026-12-01',
      });

      const patchRes = await req('PATCH', `/expenses/${corpExpense._id}`, {
        user: member,
        body: { description: 'Hotel Providencia (desayuno incluido)', amount: 4500 },
      });
      assert(patchRes.status === 200, `Autor PATCH respondió ${patchRes.status}`);

      const expenseActualizado = await Expense.findById(corpExpense._id);
      assert(expenseActualizado.description === 'Hotel Providencia (desayuno incluido)', 'El gasto no se actualizó');
      assert(expenseActualizado.amount === 4500, 'El monto no se actualizó');

      const deleteRes = await req('DELETE', `/expenses/${corpExpense._id}`, {
        user: member,
      });
      assert(deleteRes.status === 200, `Autor DELETE respondió ${deleteRes.status}`);

      const expenseBorrado = await Expense.findById(corpExpense._id);
      assert(expenseBorrado === null, 'El gasto no fue borrado');
    });

    // -------------------------------------------------------------
    // CASO 6: Usuario de otra agencia no puede modificar ni borrar
    // -------------------------------------------------------------
    await runTest('6. Usuario de otra agencia no puede modificar ni borrar (403)', async () => {
      const ownerA = await crearUsuario(`owner6a_${TAG}@test.com`, 'Owner 6A', 'dueno_agencia');
      const agencyA = await Agency.create({
        agencyName: 'Agencia 6A Test',
        owner: ownerA._id,
        billing: { status: 'activa', plan: 'agencia_mensual' },
      });
      ownerA.agency = agencyA._id;
      await ownerA.save();

      const ownerB = await crearUsuario(`owner6b_${TAG}@test.com`, 'Owner 6B', 'dueno_agencia');
      const agencyB = await Agency.create({
        agencyName: 'Agencia 6B Test',
        owner: ownerB._id,
        billing: { status: 'activa', plan: 'agencia_mensual' },
      });
      ownerB.agency = agencyB._id;
      await ownerB.save();

      const corpTripA = await Trip.create({
        user: ownerA._id,
        agency: agencyA._id,
        title: 'Viaje Corp Agencia A',
        destination: { name: 'Buenos Aires', country: 'AR' },
        startDate: '2026-11-15',
        endDate: '2026-11-20',
        travelers: 1,
      });
      const corpExpenseA = await Expense.create({
        user: ownerA._id,
        trip: corpTripA._id,
        category: 'transporte',
        description: 'Vuelo a Buenos Aires',
        amount: 8000,
        currency: 'MXN',
        date: '2026-11-15',
      });

      const patchRes = await req('PATCH', `/expenses/${corpExpenseA._id}`, {
        user: ownerB,
        body: { description: 'Intento de modificación por otra agencia' },
      });
      assert(patchRes.status === 403, `PATCH por usuario de otra agencia respondió ${patchRes.status}, se esperaba 403`);

      const deleteRes = await req('DELETE', `/expenses/${corpExpenseA._id}`, {
        user: ownerB,
      });
      assert(deleteRes.status === 403, `DELETE por usuario de otra agencia respondió ${deleteRes.status}, se esperaba 403`);

      const expenseDb = await Expense.findById(corpExpenseA._id);
      assert(expenseDb !== null && expenseDb.description === 'Vuelo a Buenos Aires', 'El gasto fue alterado');
    });

    // -------------------------------------------------------------
    // CASO 7: Ex-miembro que salió voluntariamente de la agencia (POST /api/agency/salir) no puede modificar ni borrar
    // -------------------------------------------------------------
    await runTest('7. Ex-miembro que salió voluntariamente de la agencia (POST /api/agency/salir) no puede modificar ni borrar (403)', async () => {
      const owner = await crearUsuario(`owner7_${TAG}@test.com`, 'Owner 7', 'dueno_agencia');
      const agency = await Agency.create({
        agencyName: 'Agencia 7 Test',
        owner: owner._id,
        billing: { status: 'activa', plan: 'agencia_mensual' },
      });
      owner.agency = agency._id;
      await owner.save();

      const member = await crearUsuario(`member7_${TAG}@test.com`, 'Member 7', 'agente');
      member.agency = agency._id;
      await member.save();

      const corpTrip = await Trip.create({
        user: member._id,
        agency: agency._id,
        title: 'Viaje Corp Caso 7',
        destination: { name: 'Cartagena', country: 'CO' },
        startDate: '2026-12-10',
        endDate: '2026-12-15',
        travelers: 2,
      });
      const corpExpense = await Expense.create({
        user: member._id,
        trip: corpTrip._id,
        category: 'actividades',
        description: 'Tour islas del Rosario',
        amount: 1200,
        currency: 'MXN',
        date: '2026-12-11',
      });

      const salirRes = await req('POST', '/agency/salir', { user: member });
      assert(salirRes.status === 200, `POST /agency/salir respondió ${salirRes.status}`);

      const memberActualizado = await User.findById(member._id);
      assert(memberActualizado.agency === null, 'El miembro que salió voluntariamente aún tiene agencia asignada');

      const patchRes = await req('PATCH', `/expenses/${corpExpense._id}`, {
        user: memberActualizado,
        body: { description: 'Intento de modificación por ex-miembro voluntario' },
      });
      assert(patchRes.status === 403, `PATCH por ex-miembro voluntario respondió ${patchRes.status}, se esperaba 403`);

      const deleteRes = await req('DELETE', `/expenses/${corpExpense._id}`, {
        user: memberActualizado,
      });
      assert(deleteRes.status === 403, `DELETE por ex-miembro voluntario respondió ${deleteRes.status}, se esperaba 403`);

      const expenseDb = await Expense.findById(corpExpense._id);
      assert(expenseDb !== null && expenseDb.description === 'Tour islas del Rosario', 'El gasto fue alterado');
    });

    // -------------------------------------------------------------
    // CASO 8: Cobertura para editar y eliminar gastos personales
    // -------------------------------------------------------------
    await runTest('8. Cobertura para editar y eliminar gastos personales (dueño: 200, ajeno: 403)', async () => {
      const userA = await crearUsuario(`usera8_${TAG}@test.com`, 'Usuario Personal A');
      const userB = await crearUsuario(`userb8_${TAG}@test.com`, 'Usuario Personal B');

      const tripA = await Trip.create({
        user: userA._id,
        agency: null,
        title: 'Viaje Personal Caso 8',
        destination: { name: 'Guadalajara', country: 'MX' },
        startDate: '2026-10-10',
        endDate: '2026-10-14',
        travelers: 1,
      });
      const expenseA = await Expense.create({
        user: userA._id,
        trip: tripA._id,
        category: 'comida',
        description: 'Tortas ahogadas',
        amount: 180,
        currency: 'MXN',
        date: '2026-10-11',
      });

      // Usuario B (ajeno) intenta modificar gasto personal de Usuario A -> 403
      const patchAjeno = await req('PATCH', `/expenses/${expenseA._id}`, {
        user: userB,
        body: { description: 'Intento de edición por usuario ajeno' },
      });
      assert(patchAjeno.status === 403, `PATCH gasto personal por usuario ajeno respondió ${patchAjeno.status}, se esperaba 403`);

      // Usuario B intenta borrar gasto personal de Usuario A -> 403
      const deleteAjeno = await req('DELETE', `/expenses/${expenseA._id}`, {
        user: userB,
      });
      assert(deleteAjeno.status === 403, `DELETE gasto personal por usuario ajeno respondió ${deleteAjeno.status}, se esperaba 403`);

      // Usuario A (dueño) modifica su gasto personal -> 200
      const patchPropio = await req('PATCH', `/expenses/${expenseA._id}`, {
        user: userA,
        body: { description: 'Tortas ahogadas con refresco', amount: 220 },
      });
      assert(patchPropio.status === 200, `PATCH gasto personal por dueño respondió ${patchPropio.status}`);

      const expenseActualizado = await Expense.findById(expenseA._id);
      assert(expenseActualizado.description === 'Tortas ahogadas con refresco', 'La descripción no se actualizó');
      assert(expenseActualizado.amount === 220, 'El monto no se actualizó');

      // Usuario A (dueño) elimina su gasto personal -> 200
      const deletePropio = await req('DELETE', `/expenses/${expenseA._id}`, {
        user: userA,
      });
      assert(deletePropio.status === 200, `DELETE gasto personal por dueño respondió ${deletePropio.status}`);

      const expenseBorrado = await Expense.findById(expenseA._id);
      assert(expenseBorrado === null, 'El gasto personal no fue eliminado por el dueño');
    });

    // -------------------------------------------------------------
    // CASO 9: Baja del owner de agencia con miembros activos
    // -------------------------------------------------------------
    await runTest('9. Baja del owner con miembros: la agencia se elimina, los viajes de miembros revierten a personal y conservan acceso', async () => {
      const owner = await crearUsuario(`owner9_${TAG}@test.com`, 'Owner 9', 'dueno_agencia');
      const agency = await Agency.create({
        agencyName: 'Agencia 9 Test',
        owner: owner._id,
        billing: { status: 'activa', plan: 'agencia_mensual' },
      });
      owner.agency = agency._id;
      await owner.save();

      const member = await crearUsuario(`member9_${TAG}@test.com`, 'Member 9', 'agente');
      member.agency = agency._id;
      await member.save();

      // Viaje corporativo y gasto creados por el miembro
      const memberCorpTrip = await Trip.create({
        user: member._id,
        agency: agency._id,
        title: 'Viaje Corporativo de Miembro 9',
        destination: { name: 'Paris', country: 'FR' },
        startDate: '2026-11-20',
        endDate: '2026-11-27',
        travelers: 2,
      });
      const memberCorpExpense = await Expense.create({
        user: member._id,
        trip: memberCorpTrip._id,
        category: 'hospedaje',
        description: 'Hotel Paris Miembro',
        amount: 3500,
        currency: 'MXN',
        date: '2026-11-21',
      });

      // Viaje corporativo y gasto creados por el owner
      const ownerCorpTrip = await Trip.create({
        user: owner._id,
        agency: agency._id,
        title: 'Viaje Corporativo de Owner 9',
        destination: { name: 'Londres', country: 'GB' },
        startDate: '2026-12-01',
        endDate: '2026-12-08',
        travelers: 1,
      });
      const ownerCorpExpense = await Expense.create({
        user: owner._id,
        trip: ownerCorpTrip._id,
        category: 'transporte',
        description: 'Tren Londres Owner',
        amount: 1500,
        currency: 'MXN',
        date: '2026-12-02',
      });

      // Owner elimina su cuenta via DELETE /api/auth/me
      const deleteOwnerRes = await req('DELETE', '/auth/me', {
        user: owner,
        body: { password: 'Password123!' },
      });
      assert(deleteOwnerRes.status === 200, `DELETE /auth/me de owner respondió ${deleteOwnerRes.status}`);

      // Verificar en BD:
      // 1. Owner eliminado
      const checkOwner = await User.findById(owner._id);
      assert(checkOwner === null, 'El owner no fue eliminado de la BD');

      // 2. Agencia eliminada
      const checkAgency = await Agency.findById(agency._id);
      assert(checkAgency === null, 'La agencia no fue eliminada de la BD');

      // 3. Miembro sigue vivo pero con agency: null
      const checkMember = await User.findById(member._id);
      assert(checkMember !== null, 'El miembro fue eliminado indebidamente');
      assert(checkMember.agency === null, 'El miembro aún tiene agency asignada');

      // 4. Viaje del owner fue eliminado (limpieza sin huérfanos)
      const checkOwnerTrip = await Trip.findById(ownerCorpTrip._id);
      assert(checkOwnerTrip === null, 'El viaje corporativo del owner no fue eliminado');
      const checkOwnerExpense = await Expense.findById(ownerCorpExpense._id);
      assert(checkOwnerExpense === null, 'El gasto corporativo del owner no fue eliminado');

      // 5. Viaje del miembro fue PRESERVADO y revirtió a agency: null
      const checkMemberTrip = await Trip.findById(memberCorpTrip._id);
      assert(checkMemberTrip !== null, 'El viaje corporativo del miembro fue eliminado indebidamente');
      assert(checkMemberTrip.agency === null, 'El viaje del miembro aún tiene agency asignada');
      assert(String(checkMemberTrip.user) === String(member._id), 'La autoría del viaje del miembro cambió');

      // 6. Gasto del miembro fue PRESERVADO
      const checkMemberExpense = await Expense.findById(memberCorpExpense._id);
      assert(checkMemberExpense !== null, 'El gasto del miembro fue eliminado indebidamente');

      // 7. Miembro accede a sus datos via API sin 500 ni 403
      const memberTripsRes = await req('GET', '/trips', { user: checkMember });
      assert(memberTripsRes.status === 200, `GET /trips de miembro respondió ${memberTripsRes.status}`);
      const tripEncontrado = memberTripsRes.json?.data?.trips?.find((t) => String(t._id) === String(memberCorpTrip._id));
      assert(tripEncontrado, 'El viaje del miembro no aparece en su lista tras la disolución de la agencia');

      const memberTripDetail = await req('GET', `/trips/${memberCorpTrip._id}`, { user: checkMember });
      assert(memberTripDetail.status === 200, `GET /trips/:id respondió ${memberTripDetail.status}`);

      const memberExpensesRes = await req('GET', `/trips/${memberCorpTrip._id}/expenses`, { user: checkMember });
      assert(memberExpensesRes.status === 200, `GET /trips/:id/expenses respondió ${memberExpensesRes.status}`);
      assert(memberExpensesRes.json?.data?.expenses?.length === 1, 'El gasto del miembro no aparece en el viaje');

      // 8. Miembro puede editar y borrar su gasto (ahora en viaje personal)
      const patchMemberExpense = await req('PATCH', `/expenses/${memberCorpExpense._id}`, {
        user: checkMember,
        body: { description: 'Hotel Paris Miembro (actualizado)', amount: 3800 },
      });
      assert(patchMemberExpense.status === 200, `PATCH del gasto por el miembro respondió ${patchMemberExpense.status}`);

      const deleteMemberExpense = await req('DELETE', `/expenses/${memberCorpExpense._id}`, {
        user: checkMember,
      });
      assert(deleteMemberExpense.status === 200, `DELETE del gasto por el miembro respondió ${deleteMemberExpense.status}`);

      const checkExpenseFinal = await Expense.findById(memberCorpExpense._id);
      assert(checkExpenseFinal === null, 'El gasto no fue eliminado por el miembro');
    });

  } finally {
    console.log('\n[test-p02-regression] Limpiando datos de prueba...');
    await cleanupTestData(TAG);
    await stopServer();
  }

  console.log('\n================================================================');
  console.log(`RESUMEN: ${passedTests}/${totalTests} pruebas pasadas (${failedTests} fallos)`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Error fatal en suite de regresión:', err);
  process.exit(1);
});
