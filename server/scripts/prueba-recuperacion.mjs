/**
 * Recuperacion de contrasena, contra el servidor levantado.
 *
 *   npm run test:recuperacion
 *
 * El token viaja solo en el correo, asi que el script no puede leerlo de la
 * respuesta: para la segunda mitad se conecta a Mongo y siembra el hash de un
 * token que el mismo elige. Lo que si comprueba de la primera mitad es que
 * pedir el enlace deja guardado un hash y una caducidad coherente, que es la
 * parte que puede romperse sin que nadie se entere.
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import User from '../src/models/User.js';

const BASE = 'http://127.0.0.1:4000/api';

let pass = 0;
let fail = 0;
const t = async (nombre, fn) => {
  try {
    const r = await fn();
    console.log(`  ok   ${nombre}${r ? ` -> ${r}` : ''}`);
    pass += 1;
  } catch (e) {
    console.log(`  FAIL ${nombre}: ${e.message}`);
    fail += 1;
  }
};
const assert = (c, m) => {
  if (!c) throw new Error(m);
};

const post = async (ruta, cuerpo) => {
  const res = await fetch(BASE + ruta, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
};
const meStatus = async (tok) =>
  (await fetch(`${BASE}/auth/me`, { headers: { Authorization: `Bearer ${tok}` } })).status;

await mongoose.connect(process.env.MONGO_URI);

const email = `prueba-recuperacion-${Date.now()}@ejemplo.test`;
const alta = await post('/auth/register', { name: 'Prueba', email, password: 'viejaClave1' });
assert(alta.status === 201, 'no se pudo crear el usuario de prueba');
const tokenViejo = alta.body.data.token;

console.log('\n== No se puede averiguar que cuentas existen ==');

const existente = await post('/auth/forgot-password', { email });
const inexistente = await post('/auth/forgot-password', { email: 'nadie-aqui@ejemplo.test' });
const demo = await post('/auth/forgot-password', { email: process.env.SEED_USER_EMAIL || 'demo@rumbo.app' });

await t('misma respuesta exista o no la cuenta', async () => {
  assert(existente.status === inexistente.status, 'los codigos difieren');
  assert(existente.body.message === inexistente.body.message, 'los mensajes difieren');
  return `${existente.status} y el mismo texto en los dos`;
});

await t('la cuenta demo no recibe enlace, pero tampoco se delata', async () => {
  assert(demo.status === 200, 'deberia responder 200 igual que las demas');
  assert(demo.body.message === existente.body.message, 'el mensaje la delata');
  const u = await User.findOne({ email: (process.env.SEED_USER_EMAIL || 'demo@rumbo.app') }).select(
    '+resetTokenHash'
  );
  assert(!u?.resetTokenHash, 'se le genero token a la cuenta demo');
  return 'sin token generado';
});

console.log('\n== Pedir el enlace deja el token bien guardado ==');

await t('guarda un hash, nunca el token en claro', async () => {
  const u = await User.findOne({ email }).select('+resetTokenHash +resetTokenExpires');
  assert(u.resetTokenHash, 'no se guardo nada');
  assert(/^[a-f0-9]{64}$/.test(u.resetTokenHash), 'no parece un sha256 en hexadecimal');
  return `sha256 de 64 caracteres`;
});

await t('la caducidad ronda los 30 minutos', async () => {
  const u = await User.findOne({ email }).select('+resetTokenExpires');
  const minutos = (u.resetTokenExpires - Date.now()) / 60000;
  assert(minutos > 25 && minutos <= 30, `caduca en ${minutos.toFixed(1)} min`);
  return `${minutos.toFixed(0)} min`;
});

console.log('\n== Gastar el enlace ==');

// El token real solo existe en el correo. Se siembra uno conocido para poder
// ejercitar el resto del camino.
const token = crypto.randomBytes(32).toString('hex');
const sembrar = async (expira = new Date(Date.now() + 20 * 60 * 1000)) => {
  await User.updateOne(
    { email },
    { resetTokenHash: crypto.createHash('sha256').update(token).digest('hex'), resetTokenExpires: expira }
  );
};

await t('un token caducado no sirve', async () => {
  await sembrar(new Date(Date.now() - 60 * 1000));
  const r = await post('/auth/reset-password', { token, password: 'nuevaClave1' });
  assert(r.status === 400, `respondio ${r.status}`);
  return '400, y el mismo mensaje que un token inventado';
});

await t('un token que no existe no sirve', async () => {
  const r = await post('/auth/reset-password', { token: 'f'.repeat(64), password: 'nuevaClave1' });
  assert(r.status === 400, `respondio ${r.status}`);
  return '400';
});

let tokenNuevo;
await t('con el token bueno se cambia la contrasena y se entra directo', async () => {
  await sembrar();
  const r = await post('/auth/reset-password', { token, password: 'nuevaClave1' });
  assert(r.status === 200, `respondio ${r.status}: ${r.body?.message}`);
  tokenNuevo = r.body.data.token;
  assert(tokenNuevo, 'no devolvio sesion');
  assert(r.body.data.user.resetTokenHash === undefined, 'filtro el hash en la respuesta');
  return 'sesion nueva sin pasar por el login';
});

await t('el token es de un solo uso', async () => {
  const r = await post('/auth/reset-password', { token, password: 'otraDistinta1' });
  assert(r.status === 400, `respondio ${r.status}`);
  return '400 al reutilizarlo';
});

console.log('\n== Lo que hace util un restablecimiento ==');

await t('la sesion anterior deja de valer', async () => {
  const s = await meStatus(tokenViejo);
  assert(s === 401, `la sesion vieja sigue viva (${s})`);
  return '401: a quien estuviera dentro se le cierra la sesion';
});

await t('la sesion recien emitida si vale', async () => {
  const s = await meStatus(tokenNuevo);
  assert(s === 200, `respondio ${s}`);
  return '200';
});

await t('la contrasena vieja ya no entra', async () => {
  const r = await post('/auth/login', { email, password: 'viejaClave1' });
  assert(r.status === 401, `respondio ${r.status}`);
  return '401';
});

await t('la contrasena nueva entra', async () => {
  const r = await post('/auth/login', { email, password: 'nuevaClave1' });
  assert(r.status === 200, `respondio ${r.status}`);
  return '200';
});

await User.deleteOne({ email });
await mongoose.disconnect();

console.log(`\n${fail === 0 ? 'TODO OK' : 'CON FALLOS'}: ${pass} pasaron, ${fail} fallaron\n`);
process.exit(fail === 0 ? 0 : 1);
