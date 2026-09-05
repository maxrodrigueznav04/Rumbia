import mongoose from 'mongoose';

export const ACTIVITY_CATEGORIES = [
  'comida',
  'cultura',
  'naturaleza',
  'aventura',
  'compras',
  'vida-nocturna',
  'descanso',
  'traslado',
  'otro',
];

const activitySchema = new mongoose.Schema({
  // Hora en formato local "HH:mm". Se guarda como string para evitar lios de zona horaria.
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
  bookingUrl: { type: String, trim: true, maxlength: 600, default: '' },
  source: { type: String, enum: ['ia', 'usuario'], default: 'ia' },
  order: { type: Number, default: 0 }, // permite reordenar sin recalcular horas
});

const daySchema = new mongoose.Schema({
  dayNumber: { type: Number, required: true, min: 1 },
  date: { type: Date },
  // A que parada del viaje pertenece este dia: 0 = destino principal
  // (trip.destination), 1..N = indice en trip.additionalDestinations.
  // Puramente informativo: no bloquea moveActivity/reorderActivities, y
  // todo itinerario existente sin el campo se lee como 0 (destino unico),
  // sin migracion.
  destinationIndex: { type: Number, min: 0, default: 0 },
  title: { type: String, trim: true, maxlength: 160, default: '' },
  summary: { type: String, trim: true, maxlength: 600, default: '' },
  activities: { type: [activitySchema], default: [] },
});

daySchema.virtual('estimatedCost').get(function estimatedCost() {
  return Number(
    (this.activities || []).reduce((sum, a) => sum + (a.estimatedCost || 0), 0).toFixed(2)
  );
});
daySchema.set('toJSON', { virtuals: true });
daySchema.set('toObject', { virtuals: true });

const itinerarySchema = new mongoose.Schema(
  {
    trip: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      required: true,
      unique: true, // un itinerario vigente por viaje; regenerar lo reemplaza
      index: true,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    generatedBy: { type: String, enum: ['ia', 'manual'], default: 'ia' },
    model: { type: String, trim: true, default: '' }, // ej. gemini-2.5-flash
    // Snapshot del contexto usado: sirve para depurar y para mostrar "generado con estos datos".
    promptContext: {
      destination: String,
      // Ruta usada para pedirle a Gemini un viaje multi-ciudad (ver
      // gemini.service.js buildRouteLines). Vacio en un viaje de un solo
      // destino.
      paradas: [{ _id: false, nombre: String, startDay: Number, endDay: Number }],
      days: Number,
      travelers: Number,
      interests: [String],
      budgetHint: String,
      pace: String,
      extraNotes: String,
    },
    /**
     * Token del enlace publico. Es opcional y sparse: la mayoria de los
     * itinerarios no se comparten nunca, y un indice unico normal tratearia
     * todos los null como duplicados.
     *
     * Compartir es voluntario y reversible: mientras no exista token, no hay
     * forma de llegar al itinerario sin la sesion del dueno.
     */
    shareToken: { type: String, index: { unique: true, sparse: true }, select: false },
    sharedAt: { type: Date },
    /**
     * Marca (agencia o personal) congelada en el momento de compartir, no
     * resuelta en vivo cada vez que alguien abre el enlace. Sin esto, si el
     * dueño cambiaba de agencia (o salía y creaba otra) DESPUES de compartir
     * una propuesta, el enlace que ya le había mandado a un cliente empezaba
     * a mostrar la marca de la agencia NUEVA en vez de la que de verdad armó
     * esa propuesta -- una propuesta ya enviada no debería cambiar de marca
     * sola. Queda vacío en itinerarios compartidos antes de este campo
     * existir; verItinerarioCompartido cae a resolverla en vivo en ese caso.
     */
    marcaCompartida: {
      agencyName: { type: String, default: '' },
      logoUrl: { type: String, default: '' },
      contact: { type: String, default: '' },
      colorAcento: { type: String, default: '' },
      fuentePdf: { type: String, default: '' },
      densidadPdf: { type: String, default: 'normal' },
      marcaBlanca: { type: Boolean, default: false },
    },

    version: { type: Number, default: 1 },
    days: { type: [daySchema], default: [] },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

itinerarySchema.virtual('totalEstimatedCost').get(function totalEstimatedCost() {
  return Number(
    (this.days || [])
      .reduce(
        (sum, d) => sum + (d.activities || []).reduce((s, a) => s + (a.estimatedCost || 0), 0),
        0
      )
      .toFixed(2)
  );
});

itinerarySchema.virtual('activityCount').get(function activityCount() {
  return (this.days || []).reduce((sum, d) => sum + (d.activities?.length || 0), 0);
});

/** Coordenadas listas para pintar pines en Leaflet. */
itinerarySchema.methods.mapPins = function mapPins() {
  const pins = [];
  for (const day of this.days || []) {
    for (const act of day.activities || []) {
      if (typeof act.location?.lat === 'number' && typeof act.location?.lng === 'number') {
        pins.push({
          id: String(act._id),
          dayNumber: day.dayNumber,
          title: act.title,
          category: act.category,
          lat: act.location.lat,
          lng: act.location.lng,
        });
      }
    }
  }
  return pins;
};

export default mongoose.model('Itinerary', itinerarySchema);
