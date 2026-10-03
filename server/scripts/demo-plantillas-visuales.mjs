// Datos de prueba locales. Se recrean cada vez que se inicia la demo.
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.JWT_SECRET = randomBytes(48).toString('hex');
process.env.VISUAL_TEMPLATES_ENABLED = 'true';
process.env.CLIENT_URL = 'http://127.0.0.1:5173';
const browserPaths = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
process.env.CHROMIUM_PATH = browserPaths.find(existsSync) || process.env.CHROMIUM_PATH || '';

const mongo = await MongoMemoryServer.create();
process.env.MONGO_URI = mongo.getUri();
await mongoose.connect(process.env.MONGO_URI);
const [{ default: app }, { VisualTemplate }, { defaultVisualDesign, visualPresetDesign }] = await Promise.all([
  import('../src/app.js'), import('../src/models/index.js'), import('../src/validators/visualTemplate.js'),
]);

const user = new mongoose.Types.ObjectId();
const agency = new mongoose.Types.ObjectId();
const trip = new mongoose.Types.ObjectId();
await mongoose.connection.db.collection('users').insertOne({
  _id: user, name: 'Agente de prueba', email: 'dueno@example.test',
  password: await bcrypt.hash('Prueba1234', 12), emailVerified: true,
  agency, preferences: { idioma: 'es', perfilUso: 'agencia' },
});
await mongoose.connection.db.collection('agencies').insertOne({
  _id: agency, agencyName: 'DaycoTravels · demostración', contact: 'Propuesta de ejemplo',
  owner: user, status: 'activa', billing: { plan: 'agencia_mensual', status: 'activa' },
});
await mongoose.connection.db.collection('trips').insertOne({
  _id: trip, user, agency, title: 'Del Pacífico a la magia',
  destination: { name: 'San Diego' },
  additionalDestinations: [{ place: { name: 'Anaheim' }, startDate: new Date('2026-10-18T00:00:00Z'), endDate: new Date('2026-10-22T00:00:00Z') }],
  startDate: new Date('2026-10-15T00:00:00Z'), endDate: new Date('2026-10-22T00:00:00Z'),
  travelers: 2, status: 'planeado', budget: { currency: 'MXN' }, margen: { tipo: 'fijo', monto: 2500 },
});
await mongoose.connection.db.collection('itineraries').insertOne({
  trip, user, generatedBy: 'manual', days: [
    { dayNumber: 1, date: new Date('2026-10-15T00:00:00Z'), title: 'Bienvenida a San Diego', summary: 'Un comienzo junto al mar.', activities: [{ time: '10:00', title: 'Llegada y traslado', description: 'Tiempo para instalarse con calma.', estimatedCost: 800 }, { time: '17:00', title: 'Atardecer en la costa', description: 'Primer paseo frente al Pacífico.' }] },
    { dayNumber: 2, date: new Date('2026-10-16T00:00:00Z'), title: 'La Jolla y sus paisajes', summary: 'Un día entre acantilados y mar.', activities: [{ time: '09:30', title: 'Explorar La Jolla Cove', description: 'Recorrido libre por la costa.' }, { time: '13:00', title: 'Almuerzo sugerido', description: 'Una pausa para descubrir la cocina local.' }] },
    { dayNumber: 3, date: new Date('2026-10-17T00:00:00Z'), title: 'Rumbo a Anaheim', summary: 'Un cambio de escenario sin prisas.', activities: [{ time: '10:00', title: 'Traslado a Anaheim', description: 'Salida después del desayuno.', estimatedCost: 1500 }, { time: '18:00', title: 'Paseo vespertino', description: 'Tiempo libre cerca del hospedaje.' }] },
  ],
});
await VisualTemplate.create({ agency, createdBy: user, name: 'Editorial Dayco', status: 'published', activeSlot: 1, design: defaultVisualDesign() });
await VisualTemplate.create({ agency, createdBy: user, name: 'Distinción', status: 'published', activeSlot: 2, design: visualPresetDesign('lujo') });

const server = app.listen(4000, '127.0.0.1', () => console.log('API de prueba lista en http://127.0.0.1:4000'));
const close = async () => {
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  await mongo.stop();
  process.exit(0);
};
process.once('SIGINT', close);
process.once('SIGTERM', close);
