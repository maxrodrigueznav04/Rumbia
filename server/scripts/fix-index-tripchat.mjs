/**
 * Corrige un indice viejo en tripchats.
 *
 * Antes de que el chat general (trip: null, sin viaje atado) existiera,
 * TripChat tenia un indice unico solo por `trip`. Al migrar al indice
 * compuesto (user, trip) -- porque ahora varios usuarios comparten
 * trip: null -- ese indice viejo se quedo en la base real: Mongoose no
 * borra solo un indice que ya no esta en el schema, solo crea los que
 * faltan. El resultado es que, en produccion, el indice viejo sigue
 * exigiendo que `trip` sea unico en TODA la coleccion, no por usuario --
 * asi que como mucho una sola persona en todo el sistema puede tener un
 * chat general, y a cualquier otra le sale "Valor duplicado en trip" al
 * intentar mandar su primer mensaje sin viaje seleccionado.
 *
 * Por defecto solo lista los indices actuales de la coleccion (dry-run).
 * Agrega --confirmar para borrar el indice viejo de verdad.
 *
 *   node scripts/fix-index-tripchat.mjs
 *   node scripts/fix-index-tripchat.mjs --confirmar
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { TripChat } from '../src/models/index.js';

const confirmar = process.argv.includes('--confirmar');

await mongoose.connect(process.env.MONGO_URI);

const indices = await TripChat.collection.indexes();
console.log('\nIndices actuales de tripchats:');
indices.forEach((i) => console.log(` - ${i.name}: ${JSON.stringify(i.key)}${i.unique ? ' (unique)' : ''}`));

// MongoDB nombra los indices "campo_direccion" por defecto: el viejo,
// single-field sobre trip, es "trip_1". El nuevo compuesto es "user_1_trip_1".
const viejo = indices.find((i) => i.name === 'trip_1');

if (!viejo) {
  console.log('\nNo se encontro un indice viejo "trip_1": nada que corregir.\n');
  await mongoose.disconnect();
  process.exit(0);
}

if (!confirmar) {
  console.log('\nSe encontro el indice viejo "trip_1". Dry-run: nada se borró.');
  console.log('Vuelve a correr con --confirmar para borrarlo de verdad.\n');
  await mongoose.disconnect();
  process.exit(0);
}

await TripChat.collection.dropIndex('trip_1');
console.log('\nListo: indice viejo "trip_1" borrado. El indice compuesto (user, trip) sigue intacto.\n');
await mongoose.disconnect();
