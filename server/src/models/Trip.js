import mongoose from 'mongoose';

export const TRIP_STATUSES = ['borrador', 'planeado', 'en-curso', 'completado'];
export const OUTBOUND_MODES = ['avion', 'autobus', 'auto-propio', 'tren', 'otro'];
export const LODGING_TYPES = ['hotel', 'hostal', 'airbnb', 'cabana', 'casa-amigos', 'camping', 'otro'];
export const LOCAL_TRANSPORT_TYPES = ['renta-auto', 'app-transporte', 'taxi', 'transporte-publico', 'bicicleta', 'a-pie'];

/** Punto geografico reutilizable (destino, origen, hospedaje, actividad). */
const placeSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, maxlength: 160 },
    address: { type: String, trim: true, maxlength: 240 },
    country: { type: String, trim: true, maxlength: 80 },
    lat: { type: Number, min: -90, max: 90 },
    lng: { type: Number, min: -180, max: 180 },
  },
  { _id: false }
);

/** Un tramo del viaje: ida o vuelta. La app NO reserva: guarda datos + link externo. */
const legSchema = new mongoose.Schema(
  {
    mode: { type: String, enum: OUTBOUND_MODES, default: 'avion' },
    provider: { type: String, trim: true, maxlength: 120 },   // aerolinea / linea de autobus
    departureAt: { type: Date },
    arrivalAt: { type: Date },
    bookingRef: { type: String, trim: true, maxlength: 60 },  // el usuario lo copia tras reservar fuera
    externalUrl: { type: String, trim: true, maxlength: 600 },
    cost: { type: Number, min: 0, default: 0 },
    isEstimate: { type: Boolean, default: true },
    notes: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false }
);

const lodgingSchema = new mongoose.Schema({
  type: { type: String, enum: LODGING_TYPES, default: 'hotel' },
  name: { type: String, trim: true, maxlength: 160 },
  place: { type: placeSchema, default: () => ({}) },
  checkIn: { type: Date },
  checkOut: { type: Date },
  nightlyRate: { type: Number, min: 0, default: 0 },
  nights: { type: Number, min: 0, default: 0 },
  bookingRef: { type: String, trim: true, maxlength: 60 },
  externalUrl: { type: String, trim: true, maxlength: 600 },
  isEstimate: { type: Boolean, default: true },
  notes: { type: String, trim: true, maxlength: 500 },
});

// Subtotal = tarifa por noche x noches. Se expone al serializar.
lodgingSchema.virtual('subtotal').get(function subtotal() {
  return Number(((this.nightlyRate || 0) * (this.nights || 0)).toFixed(2));
});
lodgingSchema.set('toJSON', { virtuals: true });
lodgingSchema.set('toObject', { virtuals: true });

const localTransportSchema = new mongoose.Schema({
  type: { type: String, enum: LOCAL_TRANSPORT_TYPES, default: 'transporte-publico' },
  provider: { type: String, trim: true, maxlength: 120 },
  estimatedCost: { type: Number, min: 0, default: 0 },
  externalUrl: { type: String, trim: true, maxlength: 600 },
  notes: { type: String, trim: true, maxlength: 500 },
});

const tripSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    destination: {
      type: placeSchema,
      required: true,
      validate: {
        validator: (v) => Boolean(v && v.name),
        message: 'El destino necesita al menos un nombre.',
      },
    },
    origin: { type: placeSchema, default: () => ({}) },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    travelers: { type: Number, min: 1, max: 30, default: 1 },
    budget: {
      amount: { type: Number, min: 0, default: 0 },
      currency: { type: String, uppercase: true, minlength: 3, maxlength: 3, default: 'MXN' },
    },
    status: { type: String, enum: TRIP_STATUSES, default: 'borrador', index: true },
    coverImage: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, maxlength: 2000, default: '' },

    // --- Cobertura de gastos principales ---
    transport: {
      outbound: { type: legSchema, default: () => ({}) },
      inbound: { type: legSchema, default: () => ({ mode: 'avion' }) },
    },
    lodging: { type: [lodgingSchema], default: [] },
    localTransport: { type: [localTransportSchema], default: [] },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

tripSchema.index({ user: 1, startDate: -1 });

tripSchema.virtual('durationDays').get(function durationDays() {
  if (!this.startDate || !this.endDate) return 0;
  const ms = this.endDate.getTime() - this.startDate.getTime();
  return Math.max(1, Math.round(ms / 86400000) + 1); // inclusivo: sal y vuelve el mismo dia = 1
});

tripSchema.virtual('nightsCount').get(function nightsCount() {
  return Math.max(0, this.durationDays - 1);
});

/** Costos capturados en el propio viaje (sin gastos sueltos de la coleccion Expense). */
tripSchema.virtual('coreCosts').get(function coreCosts() {
  const transport =
    (this.transport?.outbound?.cost || 0) + (this.transport?.inbound?.cost || 0);
  const lodging = (this.lodging || []).reduce(
    (sum, l) => sum + (l.nightlyRate || 0) * (l.nights || 0),
    0
  );
  const local = (this.localTransport || []).reduce((sum, t) => sum + (t.estimatedCost || 0), 0);
  return {
    transport: Number(transport.toFixed(2)),
    lodging: Number(lodging.toFixed(2)),
    localTransport: Number(local.toFixed(2)),
    total: Number((transport + lodging + local).toFixed(2)),
  };
});

tripSchema.virtual('itinerary', {
  ref: 'Itinerary',
  localField: '_id',
  foreignField: 'trip',
  justOne: true,
});

tripSchema.virtual('expenses', {
  ref: 'Expense',
  localField: '_id',
  foreignField: 'trip',
});

tripSchema.pre('validate', function validateDates(next) {
  if (this.startDate && this.endDate && this.endDate < this.startDate) {
    this.invalidate('endDate', 'La fecha de regreso no puede ser anterior a la de salida.');
  }
  return next();
});

export default mongoose.model('Trip', tripSchema);
