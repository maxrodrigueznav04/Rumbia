import { EventEmitter } from 'node:events';
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/rumbia_test';
process.env.JWT_SECRET = 'test_only_rumbia_resilience_secret_123';
process.env.NODE_ENV = 'production';

const { createConcurrencyLimit } = await import('../src/middleware/concurrencyLimit.js');
const { errorHandler } = await import('../src/middleware/errorHandler.js');
const ApiError = (await import('../src/utils/ApiError.js')).default;

function request() {
  const req = new EventEmitter();
  req.aborted = false;
  return req;
}

function response() {
  const res = new EventEmitter();
  res.headers = {};
  res.headersSent = false;
  res.setHeader = (key, value) => { res.headers[key] = value; };
  res.status = (status) => { res.statusCode = status; return res; };
  res.json = (body) => { res.body = body; res.headersSent = true; return res; };
  return res;
}

test('limita trabajo activo, atiende la cola y rechaza el exceso con Retry-After', () => {
  const limit = createConcurrencyLimit({ maxActive: 1, maxQueue: 1, maxWaitMs: 1000 });
  const first = response();
  const second = response();
  const excess = response();
  let started = 0;

  limit(request(), first, () => { started += 1; });
  limit(request(), second, () => { started += 1; });
  limit(request(), excess, () => { started += 1; });

  assert.equal(started, 1);
  assert.equal(excess.statusCode, 503);
  assert.equal(excess.headers['Retry-After'], '1');
  first.emit('finish');
  assert.equal(started, 2);
  second.emit('finish');
});

test('una petición en cola deja de esperar si el cliente se desconecta', () => {
  const limit = createConcurrencyLimit({ maxActive: 1, maxQueue: 1, maxWaitMs: 1000 });
  const first = response();
  const waitingRequest = request();
  let started = 0;
  limit(request(), first, () => { started += 1; });
  limit(waitingRequest, response(), () => { started += 1; });
  waitingRequest.aborted = true;
  waitingRequest.emit('aborted');
  first.emit('finish');
  assert.equal(started, 1);
});

test('producción no devuelve detalles internos de errores 5xx', () => {
  const res = response();
  errorHandler(ApiError.serviceUnavailable('Proveedor no disponible.', 'respuesta privada'), {}, res, () => {});
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.message, 'Proveedor no disponible.');
  assert.equal('details' in res.body, false);
});

test('producción conserva detalles útiles de validación 4xx', () => {
  const res = response();
  errorHandler(ApiError.badRequest('Datos inválidos.', [{ field: 'email', message: 'inválido' }]), {}, res, () => {});
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body.details, [{ field: 'email', message: 'inválido' }]);
});
