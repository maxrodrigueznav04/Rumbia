/**
 * Test de regresión para P02: Aislamiento multi-tenant y propiedad de datos de agencia.
 * Cubre:
 * 0. Seguridad: rechazo preventivo de URIs remotas y mongodb+srv sin intentar conexión
 * 1. Caso mixto de eliminación de cuenta (personal borrado, corporativo preservado, owner sin 500)
 * 2. Ex-miembro expulsado no puede modificar ni borrar gasto corporativo (403)
 * 3. Owner de la agencia sí puede modificar y borrar gasto corporativo de miembro (200)
 * 4. Otro miembro activo de la misma agencia no puede modificar ni borrar (403)
 * 5. Autor del gasto (miembro activo) sí puede modificar y borrar su propio gasto (200)
 * 6. Usuario de otra agencia no puede modificar ni borrar (403)
 * 7. Ex-miembro que salió voluntariamente de la agencia (POST /api/agency/salir) no puede modificar ni borrar (403)
 * 8. Edición y eliminación de gastos personales (dueño: 200, usuario ajeno: 403)
 * 9. Baja del owner con agencia activa es rechazada (409) para proteger integridad corporativa
 * 10. Salida del owner de la agencia (POST /api/agency/salir) es rechazada (409) con o sin miembros
 */

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import http from 'http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import mongoose from 'mongoose';

const execFileAsync = promisify(execFile);

/**
 * Valida estrictamente que una URI apunte a una base de datos MongoDB local.
 * Reglas de seguridad:
 * - Rechaza terminantemente esquemas mongodb+srv://.
 * - Debe iniciar con mongodb://.
 * - Solo se admiten conexiones locales a 127.0.0.1 o localhost.
 * - Rechaza cualquier dirección remota, dominio externo o IP no local.
 * - No imprime credenciales ni secretos en los errores.
 */
export function validarMongoUriLocal(uri) {
  if (!uri || typeof uri !== 'string') {
    throw new Error('No se proporcionó una URI de conexión.');
  }

  const trimmed = uri.trim();
  if (trimmed.startsWith('mongodb+srv://') || trimmed.includes('+srv')) {
    throw new Error('Esquema mongodb+srv:// no permitido. Las pruebas solo se permiten contra MongoDB local en 127.0.0.1 o localhost.');
  }

  if (!trimmed.startsWith('mongodb://')) {
    throw new Error('Esquema inválido. La URI debe iniciar estrictamente con mongodb://');
  }

  // Extraer la sección de hosts (entre mongodb:// y / o ?)
  const sinEsquema = trimmed.slice('mongodb://'.length);
  const sinCredenciales = sinEsquema.includes('@') ? sinEsquema.split('@')[1] : sinEsquema;
  const hostsParte = sinCredenciales.split('/')[0].split('?')[0];
  const hosts = hostsParte.split(',').map((h) => h.trim()).filter(Boolean);

  if (!hosts.length) {
    throw new Error('No se identificó ningún host en la URI.');
  }

  for (const hostConPuerto of hosts) {
    const hostOnly = hostConPuerto.split(':')[0].toLowerCase();
    if (hostOnly !== '127.0.0.1' && hostOnly !== 'localhost') {
      throw new Error(`Host no autorizado: "${hostOnly}". Las pruebas solo pueden ejecutarse contra MongoDB local en 127.0.0.1 o localhost.`);
    }
  }

  // Extraer y validar explícitamente el nombre de la base de datos
  if (!sinCredenciales.includes('/')) {
    throw new Error('No se especificó ninguna base de datos en la URI. Debe especificar una base de datos de pruebas ("rumbia_test_p02" o con prefijo "rumbia_test_").');
  }

  const despuesDeSlash = sinCredenciales.slice(sinCredenciales.indexOf('/') + 1);
  const dbName = despuesDeSlash.split('?')[0].trim();

  if (!dbName) {
    throw new Error('No se especificó ninguna base de datos en la URI. Debe especificar una base de datos de pruebas ("rumbia_test_p02" o con prefijo "rumbia_test_").');
  }

  const esBaseValida = dbName === 'rumbia_test_p02' || dbName.startsWith('rumbia_test_');
  if (!esBaseValida) {
    throw new Error(`Base de datos no autorizada: "${dbName}". Las pruebas solo pueden ejecutarse contra "rumbia_test_p02" o una base con prefijo "rumbia_test_".`);
  }

  return true;
}

process.env.JWT_SECRET ||= 'test_only_rumbia_regression_secret_1234567890';

const esEjecucionDirecta = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (esEjecucionDirecta) {
  // Seguridad estricta: NO se usa process.env.MONGO_URI como respaldo bajo ninguna circunstancia.
  // Solo se aceptan las variables dedicadas MONGO_URI_TEST o TEST_MONGO_URI.
  const mongoUri = process.env.MONGO_URI_TEST || process.env.TEST_MONGO_URI;
  if (!mongoUri) {
    console.error('\n[test-p02-regression] Error: Se requiere una URI configurada explícitamente para una base de datos de pruebas aislada.');
    console.error('[test-p02-regression] Define la variable de entorno MONGO_URI_TEST o TEST_MONGO_URI (ej: mongodb://127.0.0.1:27018/rumbia_test_p02).');
    console.error('[test-p02-regression] Por seguridad, no se utiliza MONGO_URI como respaldo ni se aceptan conexiones remotas.\n');
    process.exit(1);
  }

  try {
    validarMongoUriLocal(mongoUri);
  } catch (err) {
    console.error('\n[test-p02-regression] Error de seguridad: La URI de pruebas fue rechazada antes de conectar.');
    console.error(`[test-p02-regression] ${err.message}`);
    console.error('[test-p02-regression] Se prohíben esquemas mongodb+srv://, hosts remotos o entornos no locales.\n');
    process.exit(1);
  }

  process.env.MONGO_URI = mongoUri;
  process.env.NODE_ENV = 'test';
}

let app, signToken, User, Trip, Expense, Itinerary, Agency, ItineraryTemplate, Client, PendingBillingJob, AuditLog, encolarPendienteBilling, procesarPendientesBilling;

if (esEjecucionDirecta) {
  ({ default: app } = await import('../src/app.js'));
  ({ signToken } = await import('../src/middleware/auth.js'));
  ({ User, Trip, Expense, Itinerary, Agency, ItineraryTemplate, Client, PendingBillingJob, AuditLog } = await import('../src/models/index.js'));
  ({ encolarPendienteBilling, procesarPendientesBilling } = await import('../src/services/billingQueue.service.js'));
}

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
  const agencies = await Agency.find({ $or: [{ owner: { $in: userIds } }, { agencyName: new RegExp(tag, 'i') }] });
  const agencyIds = agencies.map((a) => a._id);

  await Expense.deleteMany({ $or: [{ user: { $in: userIds } }, { trip: { $in: await Trip.find({ $or: [{ user: { $in: userIds } }, { agency: { $in: agencyIds } }] }).distinct('_id') } }] });
  await Itinerary.deleteMany({ user: { $in: userIds } });
  await Client.deleteMany({ $or: [{ user: { $in: userIds } }, { agency: { $in: agencyIds } }] });
  await PendingBillingJob.deleteMany({ agency: { $in: agencyIds } });
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

  // -------------------------------------------------------------
  // CASO 0: Seguridad - Rechazo preventivo de URIs remotas y mongodb+srv sin conectar
  // -------------------------------------------------------------
  await runTest('0. Seguridad: rechazo preventivo de URIs remotas, mongodb+srv y variables de respaldo sin intentar conexión', async () => {
    // 1. mongodb+srv:// rechazado inmediatamente
    let lanzoSrv = false;
    try {
      validarMongoUriLocal('mongodb+srv://cluster-remoto.ejemplo.test/rumbia_test');
    } catch (err) {
      lanzoSrv = /mongodb\+srv/i.test(err.message);
    }
    assert(lanzoSrv, 'No se rechazó la URI con esquema mongodb+srv://');

    // 2. Host remoto de dominio rechazado inmediatamente
    let lanzoHostRemoto = false;
    try {
      validarMongoUriLocal('mongodb://servidor-remoto.ejemplo.test:27017/rumbia_test');
    } catch (err) {
      lanzoHostRemoto = /Host no autorizado/i.test(err.message);
    }
    assert(lanzoHostRemoto, 'No se rechazó el host remoto de dominio');

    // 3. IP remota rechazada inmediatamente
    let lanzoIpRemota = false;
    try {
      validarMongoUriLocal('mongodb://192.168.1.100:27017/rumbia_test');
    } catch (err) {
      lanzoIpRemota = /Host no autorizado/i.test(err.message);
    }
    assert(lanzoIpRemota, 'No se rechazó la IP no local');

    // 4. Esquemas ajenos rechazados inmediatamente
    let lanzoEsquema = false;
    try {
      validarMongoUriLocal('http://127.0.0.1:27017/rumbia_test_p02');
    } catch (err) {
      lanzoEsquema = /Esquema/i.test(err.message);
    }
    assert(lanzoEsquema, 'No se rechazó el esquema inválido');

    // 5. Host local sin base de datos rechazada inmediatamente
    let lanzoSinBase = false;
    try {
      validarMongoUriLocal('mongodb://127.0.0.1:27018');
    } catch (err) {
      lanzoSinBase = /No se especificó ninguna base de datos/i.test(err.message);
    }
    assert(lanzoSinBase, 'No se rechazó la URI local sin base de datos');

    let lanzoSlashVacio = false;
    try {
      validarMongoUriLocal('mongodb://127.0.0.1:27018/');
    } catch (err) {
      lanzoSlashVacio = /No se especificó ninguna base de datos/i.test(err.message);
    }
    assert(lanzoSlashVacio, 'No se rechazó la URI con slash pero sin base de datos');

    // 6. Base de datos local no autorizada rechazada inmediatamente
    let lanzoBaseNoAutorizada = false;
    try {
      validarMongoUriLocal('mongodb://127.0.0.1:27018/rumbia');
    } catch (err) {
      lanzoBaseNoAutorizada = /Base de datos no autorizada/i.test(err.message);
    }
    assert(lanzoBaseNoAutorizada, 'No se rechazó la base no autorizada "rumbia"');

    let lanzoBaseAdmin = false;
    try {
      validarMongoUriLocal('mongodb://localhost:27017/admin');
    } catch (err) {
      lanzoBaseAdmin = /Base de datos no autorizada/i.test(err.message);
    }
    assert(lanzoBaseAdmin, 'No se rechazó la base no autorizada "admin"');

    // 7. Host local 127.0.0.1 y localhost con base autorizada (rumbia_test_p02 o prefijo rumbia_test_) permitidos
    assert(validarMongoUriLocal('mongodb://127.0.0.1:27018/rumbia_test_p02') === true, 'No aceptó 127.0.0.1 con rumbia_test_p02');
    assert(validarMongoUriLocal('mongodb://localhost:27017/rumbia_test_p02') === true, 'No aceptó localhost con rumbia_test_p02');
    assert(validarMongoUriLocal('mongodb://127.0.0.1:27018/rumbia_test_custom') === true, 'No aceptó base con prefijo rumbia_test_');
    assert(validarMongoUriLocal('mongodb://127.0.0.1:27017,127.0.0.1:27018/rumbia_test_p02') === true, 'No aceptó replica set local');
  });

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
    // CASO 9: Protección P02: Intento de baja del dueño con agencia activa
    // -------------------------------------------------------------
    await runTest('9. Protección P02: Intento de baja del dueño con agencia activa es rechazado (409) y preserva los datos', async () => {
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

      // Owner intenta eliminar su cuenta via DELETE /api/auth/me -> debe ser RECHAZADO con 409
      const deleteOwnerRes = await req('DELETE', '/auth/me', {
        user: owner,
        body: { password: 'Password123!' },
      });
      assert(deleteOwnerRes.status === 409, `DELETE /auth/me de owner respondió ${deleteOwnerRes.status}, se esperaba 409`);
      assert(
        deleteOwnerRes.json?.message?.includes('dueño de una agencia activa'),
        `Mensaje inesperado: ${deleteOwnerRes.json?.message}`
      );

      // Verificar en BD que NINGÚN dato fue eliminado ni alterado:
      // 1. Owner sigue existiendo
      const checkOwner = await User.findById(owner._id);
      assert(checkOwner !== null, 'El owner fue eliminado indebidamente');

      // 2. Agencia sigue existiendo y su owner sigue siendo el mismo
      const checkAgency = await Agency.findById(agency._id);
      assert(checkAgency !== null, 'La agencia fue eliminada indebidamente');
      assert(String(checkAgency.owner) === String(owner._id), 'El owner de la agencia cambió indebidamente');

      // 3. Miembro sigue siendo miembro activo de la agencia
      const checkMember = await User.findById(member._id);
      assert(checkMember !== null, 'El miembro fue eliminado indebidamente');
      assert(String(checkMember.agency) === String(agency._id), 'La pertenencia de agencia del miembro fue alterada');

      // 4. Viaje y gasto corporativo del owner están intactos y siguen perteneciendo a la agencia
      const checkOwnerTrip = await Trip.findById(ownerCorpTrip._id);
      assert(checkOwnerTrip !== null, 'El viaje corporativo del owner fue eliminado');
      assert(String(checkOwnerTrip.agency) === String(agency._id), 'El viaje del owner perdió su agency');
      assert(String(checkOwnerTrip.user) === String(owner._id), 'La autoría del viaje cambió');
      const checkOwnerExpense = await Expense.findById(ownerCorpExpense._id);
      assert(checkOwnerExpense !== null, 'El gasto corporativo del owner no debió ser eliminado');

      // 5. Viaje y gasto corporativo del miembro están intactos y siguen perteneciendo a la agencia
      const checkMemberTrip = await Trip.findById(memberCorpTrip._id);
      assert(checkMemberTrip !== null, 'El viaje corporativo del miembro fue eliminado');
      assert(String(checkMemberTrip.agency) === String(agency._id), 'El viaje del miembro perdió su agency');
      assert(String(checkMemberTrip.user) === String(member._id), 'La autoría del viaje del miembro cambió');
      const checkMemberExpense = await Expense.findById(memberCorpExpense._id);
      assert(checkMemberExpense !== null, 'El gasto corporativo del miembro no debió ser eliminado');
    });

    // -------------------------------------------------------------
    // CASO 10: Salida de agencia por el dueño (POST /api/agency/salir)
    // -------------------------------------------------------------
    await runTest('10. Protección P02: Intento de salida de agencia del dueño (POST /api/agency/salir) es rechazado (409) con o sin miembros', async () => {
      // Caso 10a: Dueño con miembros
      const owner10 = await crearUsuario(`owner10_${TAG}@test.com`, 'Owner 10', 'dueno_agencia');
      const agency10 = await Agency.create({
        agencyName: 'Agencia 10 Test',
        owner: owner10._id,
        billing: { status: 'activa', plan: 'agencia_mensual' },
      });
      owner10.agency = agency10._id;
      await owner10.save();

      const member10 = await crearUsuario(`member10_${TAG}@test.com`, 'Member 10', 'agente');
      member10.agency = agency10._id;
      await member10.save();

      const salirConMiembros = await req('POST', '/agency/salir', { user: owner10 });
      assert(salirConMiembros.status === 409, `POST /agency/salir de owner con miembros respondió ${salirConMiembros.status}, se esperaba 409`);

      // Caso 10b: Dueño solo en la agencia
      const ownerSolo = await crearUsuario(`ownerSolo_${TAG}@test.com`, 'Owner Solo', 'dueno_agencia');
      const agencySolo = await Agency.create({
        agencyName: 'Agencia Solo Test',
        owner: ownerSolo._id,
        billing: { status: 'activa', plan: 'agencia_mensual' },
      });
      ownerSolo.agency = agencySolo._id;
      await ownerSolo.save();

      const templateSolo = await ItineraryTemplate.create({
        user: ownerSolo._id,
        agency: agencySolo._id,
        name: 'Plantilla Solo 10',
        destination: { name: 'Cancún', country: 'MX' },
      });

      const salirSolo = await req('POST', '/agency/salir', { user: ownerSolo });
      assert(salirSolo.status === 409, `POST /agency/salir de owner solo respondió ${salirSolo.status}, se esperaba 409`);

      // Verificar que la agencia y la plantilla NO fueron autodestruidas
      const checkAgencySolo = await Agency.findById(agencySolo._id);
      assert(checkAgencySolo !== null, 'La agencia del dueño solo fue destruida indebidamente');
      const checkTemplateSolo = await ItineraryTemplate.findById(templateSolo._id);
      assert(checkTemplateSolo !== null, 'La plantilla de la agencia fue destruida indebidamente');

      const checkOwnerSolo = await User.findById(ownerSolo._id);
      assert(String(checkOwnerSolo.agency) === String(agencySolo._id), 'El owner solo fue desvinculado de su agencia');
    });

    // -------------------------------------------------------------
    // CASO 11: Transferencia aceptada de propiedad de agencia
    // -------------------------------------------------------------
    await runTest('11. Transferencia P02: Dueño transfiere a miembro activo, quien acepta con su sesión; autoría y pertenencia intactas', async () => {
      const owner11 = await crearUsuario(`owner11_${TAG}@test.com`, 'Owner 11', 'dueno_agencia');
      const agency11 = await Agency.create({
        agencyName: 'Agencia 11 Test',
        owner: owner11._id,
        billing: { status: 'activa', plan: 'agencia_mensual' },
      });
      owner11.agency = agency11._id;
      await owner11.save();

      const member11 = await crearUsuario(`member11_${TAG}@test.com`, 'Member 11', 'agente');
      member11.agency = agency11._id;
      await member11.save();

      // Viaje y gasto creados por el dueño original
      const tripOwnerOriginal = await Trip.create({
        user: owner11._id,
        agency: agency11._id,
        title: 'Viaje Original Owner 11',
        destination: { name: 'Madrid', country: 'ES' },
        startDate: '2026-11-01',
        endDate: '2026-11-08',
        travelers: 2,
      });
      const expenseOwnerOriginal = await Expense.create({
        user: owner11._id,
        trip: tripOwnerOriginal._id,
        category: 'hospedaje',
        description: 'Hotel Madrid',
        amount: 5000,
        currency: 'MXN',
        date: '2026-11-02',
      });

      // 1. Owner solicita transferencia al miembro
      const transferReq = await req('POST', '/agency/transferir/solicitar', {
        user: owner11,
        body: {
          destinatarioId: String(member11._id),
          password: 'Password123!',
        },
      });
      assert(transferReq.status === 200, `Solicitar transferencia respondió ${transferReq.status}, se esperaba 200`);

      const checkAgencyPendiente = await Agency.findById(agency11._id);
      assert(checkAgencyPendiente.transferenciaPendiente !== null, 'No se guardó transferenciaPendiente');
      assert(String(checkAgencyPendiente.transferenciaPendiente.destinatario) === String(member11._id), 'Destinatario incorrecto');

      // 2. Miembro acepta la transferencia con su propia sesión
      const transferAccept = await req('POST', '/agency/transferir/aceptar', {
        user: member11,
      });
      assert(transferAccept.status === 200, `Aceptar transferencia respondió ${transferAccept.status}, se esperaba 200`);

      // 3. Verificar que member11 ahora es el owner
      const checkAgencyTransferred = await Agency.findById(agency11._id);
      assert(String(checkAgencyTransferred.owner) === String(member11._id), 'El owner no fue transferido a member11');
      assert(checkAgencyTransferred.transferenciaPendiente === null, 'transferenciaPendiente no fue limpiada');
      assert(checkAgencyTransferred.version >= 2, 'La versión de la agencia no se incrementó');

      // 4. El dueño original sigue siendo miembro activo
      const checkOwnerOriginal = await User.findById(owner11._id);
      assert(String(checkOwnerOriginal.agency) === String(agency11._id), 'El dueño original fue desvinculado de la membresía');

      // 5. Los registros corporativos conservan intactos user (autor) y agency (pertenencia)
      const checkTrip = await Trip.findById(tripOwnerOriginal._id);
      assert(String(checkTrip.agency) === String(agency11._id), 'El viaje corporativo perdió su agencia');
      assert(String(checkTrip.user) === String(owner11._id), 'La autoría histórica del viaje cambió indebidamente');

      const checkExpense = await Expense.findById(expenseOwnerOriginal._id);
      assert(String(checkExpense.user) === String(owner11._id), 'La autoría histórica del gasto cambió indebidamente');

      // 6. El dueño original ya no es owner: si intenta archivar la agencia, recibe 403
      const intentoArchivarExDueno = await req('POST', '/agency/archivar', {
        user: owner11,
        body: { password: 'Password123!', confirmacion: 'ARCHIVAR' },
      });
      assert(intentoArchivarExDueno.status === 403, `Ex-dueño pudo archivar: ${intentoArchivarExDueno.status}, se esperaba 403`);
    });

    // -------------------------------------------------------------
    // CASO 12: Reglas de validación, rechazo y caducidad de transferencias
    // -------------------------------------------------------------
    await runTest('12. Transferencia P02: Validaciones (auto-transferencia, ajenos, cancelación, rechazo y caducidad)', async () => {
      const owner12 = await crearUsuario(`owner12_${TAG}@test.com`, 'Owner 12', 'dueno_agencia');
      const agency12 = await Agency.create({
        agencyName: 'Agencia 12 Test',
        owner: owner12._id,
        billing: { status: 'activa', plan: 'agencia_mensual' },
      });
      owner12.agency = agency12._id;
      await owner12.save();

      const member12 = await crearUsuario(`member12_${TAG}@test.com`, 'Member 12', 'agente');
      member12.agency = agency12._id;
      await member12.save();

      const userAjeno12 = await crearUsuario(`ajeno12_${TAG}@test.com`, 'Ajeno 12', 'agente');

      // 1. Auto-transferencia rechazada con 400
      const autoTransfer = await req('POST', '/agency/transferir/solicitar', {
        user: owner12,
        body: { destinatarioId: String(owner12._id), password: 'Password123!' },
      });
      assert(autoTransfer.status === 400, `Auto-transferencia respondió ${autoTransfer.status}, se esperaba 400`);

      // 2. Transferencia a usuario ajeno rechazada con 400
      const transferAjeno = await req('POST', '/agency/transferir/solicitar', {
        user: owner12,
        body: { destinatarioId: String(userAjeno12._id), password: 'Password123!' },
      });
      assert(transferAjeno.status === 400, `Transferencia a usuario ajeno respondió ${transferAjeno.status}, se esperaba 400`);

      // 3. Solicitar transferencia válida y luego cancelarla por el dueño
      await req('POST', '/agency/transferir/solicitar', {
        user: owner12,
        body: { destinatarioId: String(member12._id), password: 'Password123!' },
      });
      const cancelRes = await req('POST', '/agency/transferir/cancelar', { user: owner12 });
      assert(cancelRes.status === 200, `Cancelar transferencia respondió ${cancelRes.status}, se esperaba 200`);

      // Intentar aceptar tras cancelación -> 404
      const acceptCancelado = await req('POST', '/agency/transferir/aceptar', { user: member12 });
      assert(acceptCancelado.status === 404, `Aceptar transferencia cancelada respondió ${acceptCancelado.status}, se esperaba 404`);

      // 4. Solicitar y rechazar por el destinatario
      await req('POST', '/agency/transferir/solicitar', {
        user: owner12,
        body: { destinatarioId: String(member12._id), password: 'Password123!' },
      });
      const rejectRes = await req('POST', '/agency/transferir/rechazar', { user: member12 });
      assert(rejectRes.status === 200, `Rechazar transferencia respondió ${rejectRes.status}, se esperaba 200`);

      // 5. Caducidad: Simular expiración de 7 días
      await Agency.findByIdAndUpdate(agency12._id, {
        transferenciaPendiente: {
          destinatario: member12._id,
          solicitadoPor: owner12._id,
          solicitadoEn: new Date(Date.now() - 8 * 86400000),
          expiraEn: new Date(Date.now() - 1000), // Expiró hace 1 segundo
        },
      });
      const acceptExpirado = await req('POST', '/agency/transferir/aceptar', { user: member12 });
      assert(acceptExpirado.status === 400, `Aceptar transferencia expirada respondió ${acceptExpirado.status}, se esperaba 400`);
    });

    // -------------------------------------------------------------
    // CASO 13: Archivo de agencia y suspensión de escrituras corporativas
    // -------------------------------------------------------------
    await runTest('13. Archivo P02: Dueño archiva agencia; escrituras corporativas suspendidas, enlaces públicos revocados y lectura conservada', async () => {
      const owner13 = await crearUsuario(`owner13_${TAG}@test.com`, 'Owner 13', 'dueno_agencia');
      const agency13 = await Agency.create({
        agencyName: 'Agencia 13 Test',
        owner: owner13._id,
        billing: { status: 'activa', plan: 'agencia_mensual' },
      });
      owner13.agency = agency13._id;
      await owner13.save();

      const member13 = await crearUsuario(`member13_${TAG}@test.com`, 'Member 13', 'agente');
      member13.agency = agency13._id;
      await member13.save();

      // Viaje corporativo preexistente antes del archivo
      const corpTrip13 = await Trip.create({
        user: member13._id,
        agency: agency13._id,
        title: 'Viaje Corporativo 13',
        destination: { name: 'Roma', country: 'IT' },
        startDate: '2026-11-10',
        endDate: '2026-11-15',
        travelers: 2,
      });
      const corpItinerary13 = await Itinerary.create({
        trip: corpTrip13._id,
        user: member13._id,
        shareToken: `token13_${TAG}`,
        days: [{ dayNumber: 1, title: 'Dia 1 Roma', activities: [] }],
      });

      // 1. Archivar la agencia por el dueño
      const archivarRes = await req('POST', '/agency/archivar', {
        user: owner13,
        body: { password: 'Password123!', confirmacion: 'ARCHIVAR' },
      });
      assert(archivarRes.status === 200, `Archivar agencia respondió ${archivarRes.status}, se esperaba 200`);

      const checkArchivada = await Agency.findById(agency13._id);
      assert(checkArchivada.status === 'archivada', 'El estado de la agencia no es archivada');
      assert(checkArchivada.archivedAt instanceof Date, 'archivedAt no fue registrado');
      assert(String(checkArchivada.archivedBy) === String(owner13._id), 'archivedBy no coincide con el dueño');

      // 2. Miembro intenta crear viaje corporativo -> 403 Forbidden
      const crearViajeCorp = await req('POST', '/trips', {
        user: member13,
        body: {
          title: 'Intento Viaje Corp en Archivada',
          destination: { name: 'Tokio', country: 'JP' },
          startDate: '2026-12-01',
          endDate: '2026-12-08',
        },
      });
      assert(crearViajeCorp.status === 403, `Crear viaje corporativo en archivada respondió ${crearViajeCorp.status}, se esperaba 403`);

      // 3. Miembro intenta agregar gasto a viaje corporativo de agencia archivada -> 403 Forbidden
      const crearGastoCorp = await req('POST', '/expenses', {
        user: member13,
        body: {
          trip: String(corpTrip13._id),
          description: 'Gasto en agencia archivada',
          amount: 500,
          category: 'comida',
        },
      });
      assert(crearGastoCorp.status === 403, `Crear gasto corporativo en archivada respondió ${crearGastoCorp.status}, se esperaba 403`);

      // 4. Nuevo usuario intenta unirse a agencia archivada con código -> 403 Forbidden
      const usuarioNuevo = await crearUsuario(`nuevo13_${TAG}@test.com`, 'Nuevo 13', 'agente');
      const unirseRes = await req('POST', '/agency/unirse', {
        user: usuarioNuevo,
        body: { inviteCode: checkArchivada.inviteCode },
      });
      assert(unirseRes.status === 403, `Unirse a agencia archivada respondió ${unirseRes.status}, se esperaba 403`);

      // 5. Enlace público compartido deja de ser accesible -> 404 Not Found
      const shareRes = await req('GET', `/public/itinerary/${corpItinerary13.shareToken}`);
      assert(shareRes.status === 404, `Acceso público a itinerario de agencia archivada respondió ${shareRes.status}, se esperaba 404`);

      // 6. Lectura privada del viaje corporativo por miembro sigue funcionando -> 200 OK
      const getTripRes = await req('GET', `/trips/${corpTrip13._id}`, { user: member13 });
      assert(getTripRes.status === 200, `Lectura de viaje corporativo respondió ${getTripRes.status}, se esperaba 200`);
    });

    // -------------------------------------------------------------
    // CASO 14: Salida voluntaria y baja de cuenta del dueño tras archivar
    // -------------------------------------------------------------
    await runTest('14. Conservación P02: Dueño de agencia archivada puede salir o darse de baja; owner pasa a null y datos corporativos se preservan', async () => {
      // Caso 14a: Salida voluntaria del dueño tras archivar
      const owner14a = await crearUsuario(`owner14a_${TAG}@test.com`, 'Owner 14a', 'dueno_agencia');
      const agency14a = await Agency.create({
        agencyName: 'Agencia 14a Test',
        owner: owner14a._id,
        status: 'archivada',
        archivedAt: new Date(),
        archivedBy: owner14a._id,
        billing: { status: 'congelada' },
      });
      owner14a.agency = agency14a._id;
      await owner14a.save();

      const salirOwnerArchivada = await req('POST', '/agency/salir', { user: owner14a });
      assert(salirOwnerArchivada.status === 200, `POST /agency/salir de owner en archivada respondió ${salirOwnerArchivada.status}, se esperaba 200`);

      const checkAgency14a = await Agency.findById(agency14a._id);
      assert(checkAgency14a.owner === null, 'La agencia archivada no fijó owner: null tras salida');
      const checkOwner14a = await User.findById(owner14a._id);
      assert(checkOwner14a.agency === null, 'El usuario no fue desvinculado de la agencia');

      // Caso 14b: Baja de cuenta del dueño tras archivar
      const owner14b = await crearUsuario(`owner14b_${TAG}@test.com`, 'Owner 14b', 'dueno_agencia');
      const agency14b = await Agency.create({
        agencyName: 'Agencia 14b Test',
        owner: owner14b._id,
        status: 'archivada',
        archivedAt: new Date(),
        archivedBy: owner14b._id,
        billing: { status: 'congelada' },
      });
      owner14b.agency = agency14b._id;
      await owner14b.save();

      // Viaje y gasto corporativos
      const tripCorp14b = await Trip.create({
        user: owner14b._id,
        agency: agency14b._id,
        title: 'Viaje Corporativo 14b',
        destination: { name: 'Sevilla', country: 'ES' },
        startDate: '2026-11-01',
        endDate: '2026-11-05',
        travelers: 1,
      });
      const expenseCorp14b = await Expense.create({
        user: owner14b._id,
        trip: tripCorp14b._id,
        category: 'comida',
        description: 'Tapas Sevilla',
        amount: 800,
        currency: 'MXN',
      });

      // Viaje personal del dueño
      const tripPersonal14b = await Trip.create({
        user: owner14b._id,
        agency: null,
        title: 'Viaje Personal Owner 14b',
        destination: { name: 'Playa del Carmen', country: 'MX' },
        startDate: '2026-12-01',
        endDate: '2026-12-05',
        travelers: 1,
      });

      // Dueño se da de baja
      const bajaOwnerRes = await req('DELETE', '/auth/me', {
        user: owner14b,
        body: { password: 'Password123!' },
      });
      assert(bajaOwnerRes.status === 200, `DELETE /auth/me de owner en archivada respondió ${bajaOwnerRes.status}, se esperaba 200`);

      // 1. Cuenta de owner eliminada
      const checkOwnerEliminado = await User.findById(owner14b._id);
      assert(checkOwnerEliminado === null, 'La cuenta del dueño no fue eliminada');

      // 2. Viaje personal eliminado
      const checkTripPersonal = await Trip.findById(tripPersonal14b._id);
      assert(checkTripPersonal === null, 'El viaje personal del dueño no fue eliminado');

      // 3. Agencia archivada existe con owner: null
      const checkAgency14b = await Agency.findById(agency14b._id);
      assert(checkAgency14b !== null, 'La agencia archivada fue eliminada indebidamente');
      assert(checkAgency14b.owner === null, 'La agencia archivada no fijó owner: null');

      // 4. Viaje y gasto corporativo CONSERVADOS intactos
      const checkTripCorp = await Trip.findById(tripCorp14b._id);
      assert(checkTripCorp !== null, 'El viaje corporativo fue eliminado');
      assert(String(checkTripCorp.agency) === String(agency14b._id), 'El viaje corporativo perdió su agency');
      assert(String(checkTripCorp.user) === String(owner14b._id), 'La autoría histórica fue borrada o alterada');

      const checkExpenseCorp = await Expense.findById(expenseCorp14b._id);
      assert(checkExpenseCorp !== null, 'El gasto corporativo fue eliminado');
    });

    // -------------------------------------------------------------
    // CASO 15: Facturación - Protección de Pagador Anterior, Reintentos y Webhooks Tardíos
    // -------------------------------------------------------------
    await runTest('15. Facturación P02: Transferir oculta portal/método del pagador anterior; reintentos de Stripe encolados; webhooks tardíos ignorados', async () => {
      // 1. Crear dueño y miembro con suscripción activa previa
      const owner15 = await crearUsuario(`owner15_${TAG}@test.com`, 'Owner 15', 'dueno_agencia');
      const member15 = await crearUsuario(`member15_${TAG}@test.com`, 'Member 15', 'agente');
      const agency15 = await Agency.create({
        agencyName: `Agencia 15 Billing ${TAG}`,
        owner: owner15._id,
        members: [{ user: member15._id, role: 'agente', joinedAt: new Date() }],
        status: 'activa',
        billing: {
          status: 'activa',
          plan: 'agencia_mensual',
          stripeCustomerId: 'cus_owner15_secret',
          stripeSubscriptionId: 'sub_owner15_secret',
          ultimoEventoStripeEn: new Date('2026-09-01T00:00:00Z'),
        },
      });
      owner15.agency = agency15._id;
      await owner15.save();
      member15.agency = agency15._id;
      await member15.save();

      // 2. Transferencia al miembro
      const transferRes = await req('POST', '/agency/transferir/solicitar', {
        user: owner15,
        body: { destinatarioId: String(member15._id), password: 'Password123!' },
      });
      assert(transferRes.status === 200, `Solicitar transferencia respondió ${transferRes.status}`);

      const acceptRes = await req('POST', '/agency/transferir/aceptar', { user: member15 });
      assert(acceptRes.status === 200, `Aceptar transferencia respondió ${acceptRes.status}`);

      // Verificar que el nuevo dueño NO tiene stripeCustomerId/SubscriptionId activos y están en historialPagadores
      const agencyTrasTransfer = await Agency.findById(agency15._id);
      assert(!agencyTrasTransfer.billing.stripeCustomerId, 'stripeCustomerId no fue limpiado tras transferir');
      assert(!agencyTrasTransfer.billing.stripeSubscriptionId, 'stripeSubscriptionId no fue limpiado tras transferir');
      assert(agencyTrasTransfer.billing.historialPagadores?.length === 1, 'historialPagadores no registró al pagador anterior');
      assert(agencyTrasTransfer.billing.historialPagadores[0].stripeCustomerId === 'cus_owner15_secret', 'historialPagadores guardó customer erróneo');
      assert(agencyTrasTransfer.billing.historialPagadores[0].stripeSubscriptionId === 'sub_owner15_secret', 'historialPagadores guardó subscription errónea');

      // 3. Nuevo dueño intenta abrir Customer Portal de Stripe -> 400 Bad Request
      const portalRes = await req('POST', '/agency/billing/portal', { user: member15 });
      assert(portalRes.status === 400, `Abrir portal sin customer respondió ${portalRes.status}, se esperaba 400`);
      assert(portalRes.json?.message?.includes('no tiene una suscripción ni datos de pago'), 'Mensaje de error inesperado en portal');

      // 4. Cola de reintentos y PendingBillingJob ante fallos externos de Stripe
      const jobEncolado = await encolarPendienteBilling({
        agencyId: agency15._id,
        tipo: 'cancelar_suscripcion',
        datos: { stripeSubscriptionId: 'sub_owner15_secret' },
        actor: owner15._id,
      });
      assert(jobEncolado && jobEncolado.status === 'pendiente', 'No se encoló el trabajo pendiente de billing');
      assert(jobEncolado.intentos === 0, 'Intentos iniciales debe ser 0');

      // Procesar la cola
      const resProcesar = await procesarPendientesBilling();
      assert(resProcesar.completados >= 1, 'El trabajo de billing en cola no fue completado');

      const jobConsultado = await PendingBillingJob.findById(jobEncolado._id);
      assert(jobConsultado.status === 'completado', 'El estado del trabajo no pasó a completado');

      // 5. Webhook tardío no altera estado de agencia archivada ni sobrescribe por suscripción en historialPagadores
      const agencyArchivada15 = await Agency.create({
        agencyName: `Agencia 15 Archivada ${TAG}`,
        owner: null,
        status: 'archivada',
        billing: {
          status: 'congelada',
          plan: 'inicio_mensual',
          historialPagadores: [{ stripeSubscriptionId: 'sub_owner15_secret' }],
          ultimoEventoStripeEn: new Date('2026-09-02T00:00:00Z'),
        },
      });

      // Intento de actualización vía webhook con fecha posterior
      const { webhook } = await import('../src/controllers/billing.controller.js');
      const stripeService = (await import('../src/services/stripe.service.js')).default;
      const origConstruirEvento = stripeService.construirEvento;
      try {
        stripeService.construirEvento = () => ({
          id: `evt_tardio_${TAG}`,
          type: 'customer.subscription.updated',
          created: 1790000000,
          data: {
            object: {
              id: 'sub_owner15_secret',
              status: 'active',
              current_period_end: 1790005000,
              metadata: { agencyId: String(agencyArchivada15._id) },
              items: { data: [{ price: { id: 'price_test' }, quantity: 1 }] },
            },
          },
        });

        let webhookRes = null;
        await webhook(
          { headers: { 'stripe-signature': 'sig' }, body: Buffer.from('test') },
          { json: (d) => { webhookRes = d; } },
          (err) => { throw err; }
        );
        assert(webhookRes?.received === true, 'Webhook no respondió received: true');

        const agencyRevisada = await Agency.findById(agencyArchivada15._id);
        assert(agencyRevisada.status === 'archivada', 'La agencia archivada fue modificada indebidamente');
        assert(agencyRevisada.billing.status === 'congelada', 'El billing fue reactivado indebidamente por webhook tardío');
      } finally {
        stripeService.construirEvento = origConstruirEvento;
      }
    });

    // -------------------------------------------------------------
    // CASO 16: Cierre Efectivo de Agencia Archivada (Sin Bypass Admin, Enlace Público 404, Plantillas 403)
    // -------------------------------------------------------------
    await runTest('16. Cierre Efectivo P02: Enlace público 404; plantillas corporativas 403; admin sin bypass de archivada', async () => {
      const owner16 = await crearUsuario(`owner16_${TAG}@test.com`, 'Owner 16', 'dueno_agencia');
      const admin16 = await crearUsuario(`admin16_${TAG}@test.com`, 'Admin 16', 'admin');
      const agency16 = await Agency.create({
        agencyName: `Agencia 16 Cierre ${TAG}`,
        owner: owner16._id,
        status: 'activa',
        billing: { status: 'activa' },
      });
      owner16.agency = agency16._id;
      await owner16.save();
      admin16.agency = agency16._id;
      await admin16.save();

      const tripCorp16 = await Trip.create({
        user: owner16._id,
        agency: agency16._id,
        title: 'Viaje Corp 16',
        destination: { name: 'Cuzco', country: 'PE' },
        startDate: '2026-10-10',
        endDate: '2026-10-15',
        travelers: 2,
        estadoPropuesta: 'enviada',
      });
      const itinCorp16 = await Itinerary.create({
        trip: tripCorp16._id,
        user: owner16._id,
        title: 'Itinerario Corp 16',
        shareToken: `token16_${TAG}`,
        days: [{ dayNumber: 1, title: 'Llegada' }],
      });
      const expCorp16 = await Expense.create({
        user: owner16._id,
        trip: tripCorp16._id,
        category: 'comida',
        description: 'Almuerzo Cuzco',
        amount: 300,
        currency: 'USD',
      });
      const templateCorp16 = await ItineraryTemplate.create({
        agency: agency16._id,
        user: owner16._id,
        name: 'Plantilla Corporativa 16',
        destination: { name: 'Cuzco' },
        days: [{ dayNumber: 1, title: 'Dia 1' }],
      });

      // Archivar la agencia
      const archivarRes = await req('POST', '/agency/archivar', {
        user: owner16,
        body: { password: 'Password123!', confirmacion: 'ARCHIVAR' },
      });
      assert(archivarRes.status === 200, `Archivar agencia respondió ${archivarRes.status}`);

      // 1. Enlace público: aceptar propuesta -> 404 Not Found
      const aceptarPropuestaRes = await req('POST', `/public/itinerary/${itinCorp16.shareToken}/aceptar`, {
        body: { notasCliente: 'Acepto la propuesta' },
      });
      assert(aceptarPropuestaRes.status === 404, `Aceptar propuesta en agencia archivada respondió ${aceptarPropuestaRes.status}, se esperaba 404`);

      // 2. Plantillas corporativas: borrar o aplicar -> 403 Forbidden
      const borrarPlantillaRes = await req('DELETE', `/templates/${templateCorp16._id}`, { user: owner16 });
      assert(borrarPlantillaRes.status === 403, `Borrar plantilla corporativa en archivada respondió ${borrarPlantillaRes.status}, se esperaba 403`);

      const aplicarPlantillaRes = await req('POST', `/templates/${templateCorp16._id}/aplicar`, {
        user: owner16,
        body: { startDate: '2026-11-01', endDate: '2026-11-05' },
      });
      assert(aplicarPlantillaRes.status === 403, `Aplicar plantilla corporativa en archivada respondió ${aplicarPlantillaRes.status}, se esperaba 403`);

      // 3. Cuenta Administradora (admin) NO tiene bypass en agencia archivada
      const adminTripEdit = await req('PATCH', `/trips/${tripCorp16._id}`, {
        user: admin16,
        body: { title: 'Admin Intentando Editar Corp' },
      });
      assert(adminTripEdit.status === 403, `Admin editando viaje corporativo archivado respondió ${adminTripEdit.status}, se esperaba 403`);

      const adminTripDup = await req('POST', `/trips/${tripCorp16._id}/duplicar`, {
        user: admin16,
      });
      assert(adminTripDup.status === 403, `Admin duplicando viaje corporativo archivado respondió ${adminTripDup.status}, se esperaba 403`);

      const adminCreateExpense = await req('POST', '/expenses', {
        user: admin16,
        body: {
          trip: String(tripCorp16._id),
          description: 'Gasto por admin',
          amount: 100,
          category: 'transporte',
        },
      });
      assert(adminCreateExpense.status === 403, `Admin creando gasto corporativo archivado respondió ${adminCreateExpense.status}, se esperaba 403`);

      const adminPatchExpense = await req('PATCH', `/expenses/${expCorp16._id}`, {
        user: admin16,
        body: { amount: 999 },
      });
      assert(adminPatchExpense.status === 403, `Admin editando gasto corporativo archivado respondió ${adminPatchExpense.status}, se esperaba 403`);

      const adminDeleteExpense = await req('DELETE', `/expenses/${expCorp16._id}`, {
        user: admin16,
      });
      assert(adminDeleteExpense.status === 403, `Admin borrando gasto corporativo archivado respondió ${adminDeleteExpense.status}, se esperaba 403`);

      const adminChat = await req('POST', '/chat', {
        user: admin16,
        body: { tripId: String(tripCorp16._id), message: 'Hola' },
      });
      assert(adminChat.status === 403, `Admin enviando mensaje al chat de viaje archivado respondió ${adminChat.status}, se esperaba 403`);

      const adminClearChat = await req('DELETE', `/chat?tripId=${tripCorp16._id}`, {
        user: admin16,
      });
      assert(adminClearChat.status === 403, `Admin reiniciando chat de viaje archivado respondió ${adminClearChat.status}, se esperaba 403`);
    });

    // -------------------------------------------------------------
    // CASO 17: Datos Personales Preservados y Editables para Miembro de Agencia Archivada
    // -------------------------------------------------------------
    await runTest('17. Datos Personales P02: Miembro de agencia archivada puede crear, editar y borrar viajes, gastos, clientes y plantillas personales', async () => {
      const owner17 = await crearUsuario(`owner17_${TAG}@test.com`, 'Owner 17', 'dueno_agencia');
      const member17 = await crearUsuario(`member17_${TAG}@test.com`, 'Member 17', 'agente');
      const agency17 = await Agency.create({
        agencyName: `Agencia 17 Personal ${TAG}`,
        owner: owner17._id,
        members: [{ user: member17._id, role: 'agente', joinedAt: new Date() }],
        status: 'archivada',
        billing: { status: 'congelada' },
      });
      owner17.agency = agency17._id;
      await owner17.save();
      member17.agency = agency17._id;
      await member17.save();

      // 1. Crear viaje personal (esPersonal: true) -> 201 Created
      const createTripRes = await req('POST', '/trips', {
        user: member17,
        body: {
          title: 'Viaje Personal Member 17',
          destination: { name: 'Bariloche', country: 'AR' },
          startDate: '2026-11-10',
          endDate: '2026-11-15',
          travelers: 1,
          esPersonal: true,
        },
      });
      assert(createTripRes.status === 201, `Crear viaje personal respondió ${createTripRes.status}, se esperaba 201`);
      const tripPersonalId = createTripRes.json?.data?.trip?._id;
      assert(tripPersonalId, 'No se recibió ID de viaje personal creado');
      const tripCreado = await Trip.findById(tripPersonalId);
      assert(tripCreado.agency === null, 'El viaje personal no tiene agency: null');

      // 2. Editar viaje personal -> 200 OK
      const editTripRes = await req('PATCH', `/trips/${tripPersonalId}`, {
        user: member17,
        body: { title: 'Viaje Personal Modificado 17' },
      });
      assert(editTripRes.status === 200, `Editar viaje personal respondió ${editTripRes.status}, se esperaba 200`);

      // 3. Crear gasto personal en el viaje personal -> 201 Created
      const createExpRes = await req('POST', '/expenses', {
        user: member17,
        body: {
          trip: String(tripPersonalId),
          description: 'Cena personal',
          amount: 50,
          category: 'comida',
        },
      });
      assert(createExpRes.status === 201, `Crear gasto personal respondió ${createExpRes.status}, se esperaba 201`);
      const expensePersonalId = createExpRes.json?.data?.expense?._id;
      assert(expensePersonalId, 'No se recibió ID de gasto personal creado');

      // 4. Editar gasto personal -> 200 OK
      const editExpRes = await req('PATCH', `/expenses/${expensePersonalId}`, {
        user: member17,
        body: { amount: 75 },
      });
      assert(editExpRes.status === 200, `Editar gasto personal respondió ${editExpRes.status}, se esperaba 200`);

      // 5. Borrar gasto personal -> 200 OK
      const deleteExpRes = await req('DELETE', `/expenses/${expensePersonalId}`, {
        user: member17,
      });
      assert(deleteExpRes.status === 200, `Borrar gasto personal respondió ${deleteExpRes.status}, se esperaba 200`);

      // 6. Crear cliente personal -> 201 Created
      const createClientRes = await req('POST', '/clients', {
        user: member17,
        body: {
          nombre: 'Cliente Personal 17',
          email: 'cliente17@personal.test',
          telefono: '+5411223344',
          esPersonal: true,
        },
      });
      assert(createClientRes.status === 201, `Crear cliente personal respondió ${createClientRes.status}, se esperaba 201`);
      const clientPersonalId = createClientRes.json?.data?.cliente?._id;
      assert(clientPersonalId, 'No se recibió ID de cliente personal creado');
      const clientCreado = await Client.findById(clientPersonalId);
      assert(clientCreado.agency === null, 'El cliente personal no tiene agency: null');

      // 7. Editar cliente personal -> 200 OK
      const editClientRes = await req('PATCH', `/clients/${clientPersonalId}`, {
        user: member17,
        body: { notas: 'Notas privadas personales' },
      });
      assert(editClientRes.status === 200, `Editar cliente personal respondió ${editClientRes.status}, se esperaba 200`);

      // 8. Borrar cliente personal -> 200 OK
      const deleteClientRes = await req('DELETE', `/clients/${clientPersonalId}`, {
        user: member17,
      });
      assert(deleteClientRes.status === 200, `Borrar cliente personal respondió ${deleteClientRes.status}, se esperaba 200`);

      // 9. Crear plantilla personal directamente -> guardada con agency: null
      const templatePersonal = await ItineraryTemplate.create({
        agency: null,
        user: member17._id,
        name: 'Plantilla Personal 17',
        destination: { name: 'Mendoza' },
        days: [{ dayNumber: 1, title: 'Dia 1' }],
      });
      assert(templatePersonal.agency === null, 'La plantilla personal no tiene agency: null');

      // 10. Borrar plantilla personal -> 200 OK
      const deleteTemplateRes = await req('DELETE', `/templates/${templatePersonal._id}`, {
        user: member17,
      });
      assert(deleteTemplateRes.status === 200, `Borrar plantilla personal respondió ${deleteTemplateRes.status}, se esperaba 200`);

      // 11. Borrar viaje personal -> 200 OK
      const deleteTripRes = await req('DELETE', `/trips/${tripPersonalId}`, {
        user: member17,
      });
      assert(deleteTripRes.status === 200, `Borrar viaje personal respondió ${deleteTripRes.status}, se esperaba 200`);
    });

    // -------------------------------------------------------------
    // CASO 18: Concurrencia Real y Control Optimista por Versión
    // -------------------------------------------------------------
    await runTest('18. Concurrencia P02: Bloqueo optimista por versión ante solicitudes simultáneas y aceptación vs expulsión', async () => {
      // 1. Solicitudes de transferencia simultáneas
      const owner18 = await crearUsuario(`owner18_${TAG}@test.com`, 'Owner 18', 'dueno_agencia');
      const member18a = await crearUsuario(`member18a_${TAG}@test.com`, 'Member 18a', 'agente');
      const member18b = await crearUsuario(`member18b_${TAG}@test.com`, 'Member 18b', 'agente');
      const agency18 = await Agency.create({
        agencyName: `Agencia 18 Concurrencia ${TAG}`,
        owner: owner18._id,
        members: [
          { user: member18a._id, role: 'agente', joinedAt: new Date() },
          { user: member18b._id, role: 'agente', joinedAt: new Date() },
        ],
        status: 'activa',
        version: 1,
      });
      owner18.agency = agency18._id;
      await owner18.save();
      member18a.agency = agency18._id;
      await member18a.save();
      member18b.agency = agency18._id;
      await member18b.save();

      // Lanzar 2 peticiones paralelas de solicitud de transferencia
      const [resSolA, resSolB] = await Promise.all([
        req('POST', '/agency/transferir/solicitar', {
          user: owner18,
          body: { destinatarioId: String(member18a._id), password: 'Password123!' },
        }),
        req('POST', '/agency/transferir/solicitar', {
          user: owner18,
          body: { destinatarioId: String(member18b._id), password: 'Password123!' },
        }),
      ]);

      const statuses = [resSolA.status, resSolB.status].sort();
      // Una debe ser exitosa (200) y la otra debe ser conflicto (409)
      assert(statuses[0] === 200 && statuses[1] === 409, `Se esperaba un 200 y un 409 en solicitudes concurrentes, pero se obtuvo ${resSolA.status} y ${resSolB.status}`);

      // 2. Aceptación vs. Expulsión del miembro destinatario
      // Tenemos una transferencia pendiente hacia el ganador
      const agenciaActual = await Agency.findById(agency18._id);
      const destinatarioId = agenciaActual.transferenciaPendiente.destinatario;
      const destinatarioUser = String(destinatarioId) === String(member18a._id) ? member18a : member18b;

      // El dueño expulsa al destinatario
      const expulsarRes = await req('DELETE', `/agency/miembros/${destinatarioUser._id}`, { user: owner18 });
      assert(expulsarRes.status === 200, `Expulsar miembro respondió ${expulsarRes.status}`);

      // El destinatario expulsado intenta aceptar con su sesión
      const aceptarExpulsadoRes = await req('POST', '/agency/transferir/aceptar', { user: destinatarioUser });
      assert(
        aceptarExpulsadoRes.status === 400 || aceptarExpulsadoRes.status === 404,
        `Aceptar transferencia tras expulsión respondió ${aceptarExpulsadoRes.status}, se esperaba 400 o 404`
      );

      // La agencia debe seguir perteneciendo al owner original
      const checkAgencia18 = await Agency.findById(agency18._id);
      assert(String(checkAgencia18.owner) === String(owner18._id), 'El owner cambió indebidamente tras expulsión');
      assert(!checkAgencia18.transferenciaPendiente?.destinatario, 'La transferencia pendiente no fue limpiada');
    });

    // -------------------------------------------------------------
    // CASO 19: Migración Segura de Agencias Legacy
    // -------------------------------------------------------------
    await runTest('19. Migración P02: Detección, dry-run y confirmación atómica para agencias legacy sin status ni version', async () => {
      const owner19 = await crearUsuario(`owner19_${TAG}@test.com`, 'Owner 19', 'dueno_agencia');
      const member19 = await crearUsuario(`member19_${TAG}@test.com`, 'Member 19', 'agente');

      // Insertar agencia legacy DIRECTAMENTE sin campos status ni version
      const legacyId = new mongoose.Types.ObjectId();
      await mongoose.connection.collection('agencies').insertOne({
        _id: legacyId,
        agencyName: `Agencia Legacy 19 ${TAG}`,
        owner: owner19._id,
        members: [{ user: member19._id, role: 'agente', joinedAt: new Date() }],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      owner19.agency = legacyId;
      await owner19.save();
      member19.agency = legacyId;
      await member19.save();

      // Verificar que el documento carece de status y version
      const docRawAntes = await mongoose.connection.collection('agencies').findOne({ _id: legacyId });
      assert(docRawAntes.status === undefined, 'El doc legacy no debería tener status');
      assert(docRawAntes.version === undefined, 'El doc legacy no debería tener version');

      // Ejecutar script en dry-run
      const scriptMigracion = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'migracion-p02-status-agencias.mjs');
      const { stdout: dryRunStdout } = await execFileAsync(
        process.execPath,
        [scriptMigracion],
        {
          cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
          env: {
            ...process.env,
            MONGO_URI_TEST: process.env.MONGO_URI,
          },
        }
      );
      assert(dryRunStdout.includes('DRY-RUN'), 'No indicó modo DRY-RUN');
      assert(dryRunStdout.includes('candidatas a migrar'), 'No reportó candidatas');

      // Verificar que en dry-run no se modificó nada
      const docRawDryRun = await mongoose.connection.collection('agencies').findOne({ _id: legacyId });
      assert(docRawDryRun.status === undefined, 'Dry-run no debió asignar status');

      // Ejecutar script con --confirmar
      const { stdout: confirmarStdout } = await execFileAsync(
        process.execPath,
        [scriptMigracion, '--confirmar'],
        {
          cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
          env: {
            ...process.env,
            MONGO_URI_TEST: process.env.MONGO_URI,
          },
        }
      );
      assert(confirmarStdout.includes('MIGRACIÓN COMPLETADA EXITOSAMENTE'), 'No confirmó éxito de la migración');

      // Verificar que el documento ahora tiene status='activa' y version=1
      const docMigrado = await mongoose.connection.collection('agencies').findOne({ _id: legacyId });
      assert(docMigrado.status === 'activa', `Status esperado 'activa', obtenido: ${docMigrado.status}`);
      assert(docMigrado.version === 1, `Version esperada 1, obtenida: ${docMigrado.version}`);

      // Comprobar que la agencia migrada puede ser transferida y archivada en el ciclo de vida
      const transferRes = await req('POST', '/agency/transferir/solicitar', {
        user: owner19,
        body: { destinatarioId: String(member19._id), password: 'Password123!' },
      });
      assert(transferRes.status === 200, `Transferencia en migrada respondió ${transferRes.status}`);

      const acceptRes = await req('POST', '/agency/transferir/aceptar', { user: member19 });
      assert(acceptRes.status === 200, `Aceptar transferencia en migrada respondió ${acceptRes.status}`);

      const archivarRes = await req('POST', '/agency/archivar', {
        user: member19,
        body: { password: 'Password123!', confirmacion: 'ARCHIVAR' },
      });
      assert(archivarRes.status === 200, `Archivar agencia migrada respondió ${archivarRes.status}`);

      const docFinal = await Agency.findById(legacyId);
      assert(docFinal.status === 'archivada', 'La agencia migrada no quedó en status archivada');
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

if (esEjecucionDirecta) {
  main().catch((err) => {
    console.error('Error fatal en suite de regresión:', err);
    process.exit(1);
  });
}
