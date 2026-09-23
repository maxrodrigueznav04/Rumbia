import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/rumbia_test';
process.env.JWT_SECRET = 'test_only_rumbia_session_regression_secret';
const { protect, signToken } = await import('../src/middleware/auth.js');
const { User, Trip, Agency } = await import('../src/models/index.js');
const { getPanel } = await import('../src/controllers/trip.controller.js');
const { tripListQuerySchema } = await import('../src/validators/schemas.js');
const { deleteAccount } = await import('../src/controllers/auth.controller.js');
const { salirAgencia } = await import('../src/controllers/agency.controller.js');
afterEach(() => mock.restoreAll());
const ejecutar = (handler, req) => new Promise((resolve, reject) => handler(req, { json: resolve }, (error) => error ? reject(error) : resolve('next')));
test('la cookie B no permite una escritura desde una pantalla de la cuenta A', async () => {
  mock.method(User, 'findById', async () => ({ _id: 'b', tokenAnteriorAlCambio: () => false }));
  await assert.rejects(ejecutar(protect, { cookies: { rumbia_token: signToken('b') }, get: () => 'a' }), { statusCode: 409 });
});
test('misma identidad o un cliente anterior sin cabecera conserva autenticación', async () => {
  mock.method(User, 'findById', async () => ({ _id: 'b', tokenAnteriorAlCambio: () => false }));
  for (const esperado of ['b', undefined]) assert.equal(await ejecutar(protect, { cookies: { rumbia_token: signToken('b') }, get: () => esperado }), 'next');
});
test('el panel consulta todas las métricas limitado a la cuenta autenticada', async () => {
  const filtros = [];
  mock.method(Trip, 'countDocuments', async (filter) => { filtros.push(filter); return filtros.length; });
  const result = await ejecutar(getPanel, { user: { _id: 'propietario' } });
  assert.deepEqual(result.data, { porEnviar: 1, seguimiento: 2, proximasSalidas: 3, pendientes: 4 });
  assert.ok(filtros.every((f) => f.user === 'propietario'));
  assert.ok(filtros.every((f) => f.agency === null));
  assert.equal(filtros[1].estadoPropuesta, 'enviada');
  assert.ok(filtros[2].startDate.$gte instanceof Date);
});
test('el panel de agencia conserva el alcance del equipo y excluye agencias anteriores', async () => {
  const filtros = [];
  mock.method(Trip, 'countDocuments', async (filter) => { filtros.push(filter); return 0; });
  await ejecutar(getPanel, { user: { _id: 'agente', agency: 'agencia-actual' } });
  for (const filtro of filtros) {
    assert.deepEqual(filtro.$or, [{ agency: 'agencia-actual' }, { user: 'agente', agency: null }]);
  }
  assert.ok(filtros[3].$and[0].$or, 'el filtro de pendientes no sobrescribe la pertenencia');
});
test('los filtros de atención se validan sin aceptar valores arbitrarios', () => {
  assert.equal(tripListQuerySchema.parse({ atencion: 'pendientes' }).atencion, 'pendientes');
  assert.equal(tripListQuerySchema.safeParse({ atencion: 'todos-los-usuarios' }).success, false);
});

test('deleteAccount: el dueño de una agencia activa no puede eliminar su cuenta (409)', async () => {
  mock.method(User, 'findById', () => ({
    _id: 'dueno1',
    email: 'dueno@test.com',
    select: () => ({
      _id: 'dueno1',
      email: 'dueno@test.com',
      comparePassword: async () => true,
    }),
  }));
  mock.method(Agency, 'findOne', async () => ({ _id: 'agencia1', owner: 'dueno1' }));

  await assert.rejects(
    ejecutar(deleteAccount, { user: { _id: 'dueno1' }, body: { password: 'pass' } }),
    (err) => err.statusCode === 409 && err.message.includes('dueño de una agencia activa')
  );
});

test('salirAgencia: el dueño de la agencia no puede salir directamente ni destruir la agencia (409)', async () => {
  mock.method(Agency, 'findById', async () => ({ _id: 'agencia1', owner: 'dueno1' }));

  await assert.rejects(
    ejecutar(salirAgencia, { user: { _id: 'dueno1', agency: 'agencia1' } }),
    (err) => err.statusCode === 409 && err.message.includes('Como dueño no puedes salir')
  );
});

test('salirAgencia: un miembro normal sí puede salir de la agencia', async () => {
  let guardado = false;
  mock.method(Agency, 'findById', async () => ({ _id: 'agencia1', owner: 'otroDueno' }));
  const user = {
    _id: 'miembro1',
    agency: 'agencia1',
    save: async () => { guardado = true; },
    populate: async () => {},
    toJSON: () => ({ _id: 'miembro1', agency: null }),
  };

  const res = await ejecutar(salirAgencia, { user });
  assert.equal(res.success, true);
  assert.equal(user.agency, null);
  assert.equal(guardado, true);
});

