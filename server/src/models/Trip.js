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
  // Booking, Airbnb y compañía cotizan la estancia completa ("$3,000 por 3
  // noches"), no la noche suelta: se captura el total y la tarifa por noche se
  // deriva. nightlyRate se conserva para los registros anteriores al cambio.
  totalCost: { type: Number, min: 0, default: 0 },
  nightlyRate: { type: Number, min: 0, default: 0 },
  nights: { type: Number, min: 0, default: 0 },
  bookingRef: { type: String, trim: true, maxlength: 60 },
  externalUrl: { type: String, trim: true, maxlength: 600 },
  isEstimate: { type: Boolean, default: true },
  notes: { type: String, trim: true, maxlength: 500 },
});

/**
 * Costo de la estancia. Manda totalCost; si viene en cero se cae a la fórmula
 * vieja (tarifa x noches) para no romper los viajes ya guardados.
 */
lodgingSchema.virtual('subtotal').get(function subtotal() {
  const total = this.totalCost || (this.nightlyRate || 0) * (this.nights || 0);
  return Number(total.toFixed(2));
});

/** Tarifa por noche derivada, solo para mostrar. */
lodgingSchema.virtual('perNight').get(function perNight() {
  const noches = this.nights || 0;
  if (!noches) return 0;
  return Number((this.subtotal / noches).toFixed(2));
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
    // Al duplicar un viaje para armar variantes ("Opcion Economica" vs
    // "Premium" del mismo prospecto), la copia apunta aqui al viaje raiz de
    // la familia. El propio raiz se queda en null: no apunta a si mismo, asi
    // que para juntar a toda la familia hay que buscar por (grupoPropuesta ||
    // _id) y no solo por grupoPropuesta.
    grupoPropuesta: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', default: null, index: true },
    budget: {
      amount: { type: Number, min: 0, default: 0 },
      currency: { type: String, uppercase: true, minlength: 3, maxlength: 3, default: 'MXN' },
    },
    status: { type: String, enum: TRIP_STATUSES, default: 'borrador', index: true },
    coverImage: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, maxlength: 2000, default: '' },
    // Para agencias con paquete cerrado o que le suman su comisión: el
    // cliente ve el total y de qué se compone (vuelo, hotel, traslados), pero
    // no el precio de cada renglon. Se aplica en el PDF y el enlace publico;
    // el dueño del viaje sigue viendo todo en su propia pantalla.
    ocultarDesglose: { type: Boolean, default: false },
    // La cuota de servicio o margen de la agencia sobre el costo real. "fijo"
    // es un monto total del viaje (se reparte entre los viajeros igual que
    // transporte y hospedaje); "porcentaje" se aplica sobre el costo total.
    // Se suma al costo real para dar el precio final que ve el cliente.
    margen: {
      tipo: { type: String, enum: ['fijo', 'porcentaje'], default: 'fijo' },
      monto: { type: Number, min: 0, default: 0 },
    },

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
  // Misma regla que el virtual subtotal: manda el total capturado y solo se
  // recurre a tarifa x noches en los registros viejos.
  const lodging = (this.lodging || []).reduce(
    (sum, l) => sum + (l.totalCost || (l.nightlyRate || 0) * (l.nights || 0)),
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
