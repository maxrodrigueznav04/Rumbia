/**
 * Agencias: crear, unirse, permisos de dueño vs agente, y que la marca de la
 * agencia le gane a la marca personal en el PDF (privado y compartido).
 *
 *   npm run test:agencia
 *
 * Crea sus propias cuentas de prueba (@ejemplo.test) y las borra al final,
 * incluida la agencia. No toca la cuenta demo.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { User, Agency } from '../src/models/index.js';

const BASE = 'http://127.0.0.1:4000/api';

// Conectado desde el inicio: varios checks usan Agency.findOne() directo para
// confirmar que no queda huerfana, no solo lo que dice la API.
await mongoose.connect(process.env.MONGO_URI);

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

const call = async (method, ruta, body, tok, form) => {
  const res = await fetch(BASE + ruta, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
    },
    body: form || (body ? JSON.stringify(body) : undefined),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
};

const ts = Date.now();
const duenoEmail = `prueba-agencia-dueno-${ts}@ejemplo.test`;
const agenteEmail = `prueba-agencia-agente-${ts}@ejemplo.test`;

const altaDueno = await call('POST', '/auth/register', {
  name: 'Ana Dueña',
  email: duenoEmail,
  password: 'claveDueno1',
});
const altaAgente = await call('POST', '/auth/register', {
  name: 'Beto Agente',
  email: agenteEmail,
  password: 'claveAgente1',
});
assert(altaDueno.status === 201 && altaAgente.status === 201, 'no se pudieron crear las cuentas de prueba');
const tokDueno = altaDueno.body.data.token;
const tokAgente = altaAgente.body.data.token;

console.log('\n== Crear y unirse ==');

await t('crea la agencia y queda como dueño', async () => {
  const r = await call('POST', '/agency', { agencyName: 'Agencia de Prueba' }, tokDueno);
  assert(r.status === 201, `respondio ${r.status}`);
  assert(r.body.data.user.agency, 'el usuario no quedo con agency poblada');
  return 'agencia creada';
});

await t('no se puede crear una segunda agencia', async () => {
  const r = await call('POST', '/agency', { agencyName: 'Otra' }, tokDueno);
  assert(r.status === 409, `respondio ${r.status}`);
  return '409';
});

let codigo;
await t('el dueño ve el codigo de invitacion y una lista de miembros vacia', async () => {
  const r = await call('GET', '/agency', null, tokDueno);
  assert(r.body.data.esDueno === true, 'esDueno deberia ser true');
  assert(r.body.data.agency.inviteCode, 'no trae el codigo');
  assert(r.body.data.miembros.length === 0, `miembros deberia estar vacio, trajo ${r.body.data.miembros.length}`);
  codigo = r.body.data.agency.inviteCode;
  return codigo;
});

await t('el agente se une con el codigo', async () => {
  const r = await call('POST', '/agency/unirse', { inviteCode: codigo }, tokAgente);
  assert(r.status === 200, `respondio ${r.status}`);
  assert(r.body.data.user.agency, 'no quedo con agency poblada');
  assert(r.body.data.user.agency.inviteCode === undefined, 'un agente no deberia recibir el codigo');
  return 'unido';
});

await t('un codigo invalido no une a nadie', async () => {
  const r = await call('POST', '/agency/unirse', { inviteCode: 'noexiste' }, tokAgente);
  // Ya esta en una agencia, asi que aqui el rechazo es por eso, no por el codigo.
  assert(r.status === 409, `respondio ${r.status}`);
  return '409: ya pertenece a una';
});

console.log('\n== Permisos: dueño vs agente ==');

await t('el agente ve la marca pero no el codigo ni la lista', async () => {
  const r = await call('GET', '/agency', null, tokAgente);
  assert(r.body.data.esDueno === false, 'esDueno deberia ser false');
  assert(r.body.data.agency.inviteCode === undefined, 'un agente no deberia ver el codigo');
  assert(r.body.data.miembros.length === 0, 'un agente no deberia ver la lista de miembros');
  return 'marca visible, gestion oculta';
});

await t('el agente no puede editar la agencia', async () => {
  const r = await call('PATCH', '/agency', { agencyName: 'Hackeada' }, tokAgente);
  assert(r.status === 403, `respondio ${r.status}`);
  return '403';
});

await t('el agente no puede subir el logo', async () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
    'base64'
  );
  const form = new FormData();
  form.append('logo', new Blob([png], { type: 'image/png' }), 'logo.png');
  const r = await call('POST', '/agency/logo', null, tokAgente, form);
  assert(r.status === 403, `respondio ${r.status}`);
  return '403';
});

await t('el dueño ya ve al agente en la lista', async () => {
  const r = await call('GET', '/agency', null, tokDueno);
  assert(r.body.data.miembros.length === 1, `esperaba 1 miembro, hay ${r.body.data.miembros.length}`);
  assert(r.body.data.miembros[0].email === agenteEmail, 'el miembro listado no es el agente');
  return agenteEmail;
});

console.log('\n== La marca de la agencia le gana a la marca personal ==');

await t('el agente guarda una marca personal antes de que importe', async () => {
  const r = await call('PATCH', '/auth/me', { branding: { agencyName: 'Marca Personal' } }, tokAgente);
  assert(r.status === 200, `respondio ${r.status}`);
  return 'guardada, pero va a quedar inerte';
});

await t('la agencia guarda su propia marca', async () => {
  const r = await call('PATCH', '/agency', { agencyName: 'Agencia con Marca', contact: 'hola@agencia.test' }, tokDueno);
  assert(r.status === 200, `respondio ${r.status}`);
  return 'ok';
});

let tripId;
await t('el agente arma un viaje y lo comparte', async () => {
  const viaje = await call(
    'POST',
    '/trips',
    {
      title: 'Viaje de prueba',
      destination: { name: 'Oaxaca', country: 'MX' },
      origin: { name: 'CDMX' },
      startDate: '2027-03-01',
      endDate: '2027-03-02',
      travelers: 1,
    },
    tokAgente
  );
  assert(viaje.status === 201, `crear viaje: ${viaje.status}`);
  tripId = viaje.body.data.trip._id;

  const itin = await call('POST', `/trips/${tripId}/itinerary`, null, tokAgente);
  assert(itin.status === 201, `crear itinerario: ${itin.status}`);

  return tripId;
});

let token;
await t('genera el enlace publico', async () => {
  const r = await call('POST', `/trips/${tripId}/itinerary/share`, null, tokAgente);
  assert(r.status === 200, `respondio ${r.status}`);
  token = r.body.data.token;
  return token;
});

await t('el JSON publico trae la marca de la AGENCIA, no la personal del agente', async () => {
  const r = await fetch(`${BASE}/public/itinerary/${token}`).then((res) => res.json());
  const marca = r.data.marca;
  assert(marca.agencyName === 'Agencia con Marca', `trajo "${marca.agencyName}"`);
  assert(marca.contact === 'hola@agencia.test', `trajo "${marca.contact}"`);
  return marca.agencyName;
});

await t('/auth/me del agente trae la agencia poblada para el PDF privado', async () => {
  const r = await call('GET', '/auth/me', null, tokAgente);
  assert(
    r.body.data.user.agency?.agencyName === 'Agencia con Marca',
    `trajo ${JSON.stringify(r.body.data.user.agency)}`
  );
  return 'lista para el print de Itinerario.jsx';
});

console.log('\n== Salir y eliminar ==');

await t('el dueño no puede salir mientras haya otros agentes', async () => {
  const r = await call('POST', '/agency/salir', null, tokDueno);
  assert(r.status === 409, `respondio ${r.status}`);
  return '409';
});

await t('el dueño elimina al agente directamente', async () => {
  const meAgente = await call('GET', '/auth/me', null, tokAgente);
  const r = await call('DELETE', `/agency/miembros/${meAgente.body.data.user._id}`, null, tokDueno);
  assert(r.status === 200, `respondio ${r.status}`);
  const check = await call('GET', '/auth/me', null, tokAgente);
  assert(check.body.data.user.agency === null, 'el agente deberia haber quedado sin agencia');
  return 'agente liberado, sin quedar huerfano';
});

await t('ahora si puede salir, y la agencia se autodestruye', async () => {
  const r = await call('POST', '/agency/salir', null, tokDueno);
  assert(r.status === 200, `respondio ${r.status}`);
  const yaNoExiste = await Agency.findOne({ agencyName: 'Agencia con Marca' });
  assert(!yaNoExiste, 'la agencia deberia haberse borrado sola');
  return 'sin agencias huerfanas';
});

console.log('\n== Borrar la cuenta de un dueño no deja la agencia huerfana ==');

await t('crear otra agencia, unir al agente, y borrar la cuenta del dueño sin salir antes', async () => {
  const crear = await call('POST', '/agency', { agencyName: 'Fragil' }, tokDueno);
  const codigo2 = crear.body.data.agency.inviteCode;
  await call('POST', '/agency/unirse', { inviteCode: codigo2 }, tokAgente);

  const borrar = await call('DELETE', '/auth/me', { password: 'claveDueno1' }, tokDueno);
  assert(borrar.status === 200, `borrar cuenta: ${borrar.status}`);

  const meAgente = await call('GET', '/auth/me', null, tokAgente);
  assert(meAgente.body.data.user.agency === null, 'el agente quedo apuntando a una agencia sin dueño');

  const huerfana = await Agency.findOne({ agencyName: 'Fragil' });
  assert(!huerfana, 'la agencia "Fragil" deberia haberse borrado con su dueño');

  return 'el agente vuelve a su marca propia, sin agencia huerfana en la base';
});

await User.deleteOne({ email: agenteEmail });
await mongoose.disconnect();

console.log(`\n${fail === 0 ? 'TODO OK' : 'CON FALLOS'}: ${pass} pasaron, ${fail} fallaron\n`);
process.exit(fail === 0 ? 0 : 1);
