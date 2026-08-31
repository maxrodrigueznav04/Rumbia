import mongoose from 'mongoose';
import { ACTIVITY_CATEGORIES } from './Itinerary.js';
import { placeSchema } from './Trip.js';

/**
 * Plantilla de itinerario: la copia de un itinerario ya armado, sin fechas
 * (dias relativos, no calendario) para poder aplicarla a un cliente nuevo.
 *
 * Vive separada de Itinerary a proposito: una plantilla no pertenece a
 * ningun Trip, y mezclar "itinerario real de un viaje" con "itinerario de
 * referencia sin viaje" en el mismo modelo habria significado hacer `trip`
 * opcional en Itinerary — mas riesgo de bug que un modelo aparte y chico.
 */

const plantillaActivitySchema = new mongoose.Schema(
  {
    time: {
      type: String,
      trim: true,
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'La hora debe tener formato HH:mm.'],
      default: '',
    },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 800, default: '' },
    category: { type: String, enum: ACTIVITY_CATEGORIES, default: 'otro' },
    location: {
      name: { type: String, trim: true, maxlength: 160, default: '' },
      address: { type: String, trim: true, maxlength: 240, default: '' },
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 },
    },
    estimatedCost: { type: Number, min: 0, default: 0 },
    durationMinutes: { type: Number, min: 0, max: 1440, default: 60 },
  },
  { _id: false }
);

/**
 * Parada adicional de la plantilla: igual idea que Trip.additionalDestinations,
 * pero con dias relativos (startDayNumber/endDayNumber) en vez de fechas —
 * una plantilla no tiene calendario propio. templates.controller.js los
 * traduce a fechas absolutas al aplicar la plantilla a un viaje.
 */
const plantillaDestinationStopSchema = new mongoose.Schema(
  {
    place: { type: placeSchema, required: true },
    startDayNumber: { type: Number, required: true, min: 1 },
    endDayNumber: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const plantillaDaySchema = new mongoose.Schema(
  {
    // Numero de dia relativo (1, 2, 3...), no una fecha: la fecha real la
    // pone el viaje al que se aplique la plantilla.
    dayNumber: { type: Number, required: true, min: 1 },
    // 0 = destino principal, 1..N = indice en additionalDestinations. Ver
    // el mismo campo en Itinerary.daySchema.
    destinationIndex: { type: Number, min: 0, default: 0 },
    title: { type: String, trim: true, maxlength: 160, default: '' },
    summary: { type: String, trim: true, maxlength: 600, default: '' },
    activities: { type: [plantillaActivitySchema], default: [] },
  },
  { _id: false }
);

const itineraryTemplateSchema = new mongoose.Schema(
  {
    // Quien la guardo. Se conserva aunque se comparta con la agencia, para
    // saber a quien pedirle permiso de borrarla.
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Si quien la guardo tenia agencia en ese momento, se comparte con todo
    // el equipo: el punto de una plantilla es no volver a armar un destino
    // que se repite, y eso vale mas compartido entre agentes que privado.
    agency: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency', default: null, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    destination: { type: placeSchema, required: true },
    additionalDestinations: { type: [plantillaDestinationStopSchema], default: [] },
    days: { type: [plantillaDaySchema], default: [] },
  },
  { timestamps: true }
);

itineraryTemplateSchema.virtual('activityCount').get(function activityCount() {
  return (this.days || []).reduce((sum, d) => sum + (d.activities?.length || 0), 0);
});
itineraryTemplateSchema.set('toJSON', { virtuals: true });
itineraryTemplateSchema.set('toObject', { virtuals: true });

export default mongoose.model('ItineraryTemplate', itineraryTemplateSchema);
