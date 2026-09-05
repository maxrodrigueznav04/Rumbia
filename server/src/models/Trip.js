import mongoose from 'mongoose';
import { TRAVEL_STYLES, TRIP_PACES, BUDGET_LEVELS } from './User.js';

// "aprobado": el cliente ya dijo que si a la propuesta, pero el viaje todavia
// no arranca. Vive entre "planeado" y "en-curso" para que un agente pueda
// distinguir "armado, esperando visto bueno" de "ya aprobado, listo para
// salir".
export const TRIP_STATUSES = ['borrador', 'planeado', 'aprobado', 'en-curso', 'completado'];
// Embudo de ventas: en que va la PROPUESTA con el cliente, no en que va el
// viaje en si (eso lo dice status, arriba). Son ejes independientes a
// proposito: un viaje puede estar "planeado" y su propuesta "pagada", o
// "en-curso" con la propuesta todavia "enviada" si el cliente pago aparte.
// compartir() (itinerary.controller.js) la avanza sola de "borrador" a
// "enviada" al generar el enlace publico; aceptarPropuesta()
// (public.controller.js) la avanza a "aceptada" cuando el cliente da clic en
// el enlace. "pagada"/"cancelada" las pone el agente a mano.
export const ESTADOS_PROPUESTA = ['borrador', 'enviada', 'aceptada', 'pagada', 'cancelada'];
// Tope duro de duracion, exigido en el propio modelo (no solo en Zod) para
// cubrir TODOS los caminos que guardan un Trip -- crear, editar, aplicar una
// plantilla, un script futuro -- sin repetir el chequeo en cada uno. Sin
// esto, un rango de fechas absurdo (anos de diferencia) hace que
// createBlank/sincronizarItinerario (itinerary.controller.js,
// trip.controller.js) y el clima por rango construyan arreglos de cientos de
// miles de elementos de un solo golpe, sincronicamente, con una sola
// peticion.
export const MAX_DURACION_VIAJE_DIAS = 366;
export const OUTBOUND_MODES = ['avion', 'autobus', 'auto-propio', 'tren', 'otro'];
export const LODGING_TYPES = ['hotel', 'hostal', 'airbnb', 'cabana', 'casa-amigos', 'camping', 'otro'];
export const LOCAL_TRANSPORT_TYPES = ['renta-auto', 'app-transporte', 'taxi', 'transporte-publico', 'bicicleta', 'a-pie'];

/** Punto geografico reutilizable (destino, origen, hospedaje, actividad). */
export const placeSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, maxlength: 160 },
    address: { type: String, trim: true, maxlength: 240 },
    country: { type: String, trim: true, maxlength: 80 },
    lat: { type: Number, min: -90, max: 90 },
    lng: { type: Number, min: -180, max: 180 },
  },
  { _id: false }
);

/**
 * Una parada adicional del viaje, mas alla del destino principal. Cada
 * parada trae su propio rango de fechas (subconjunto de las del viaje) para
 * poder pedir clima e itinerario por tramo sin adivinar cuando empieza y
 * termina cada ciudad.
 */
const destinationStopSchema = new mongoose.Schema(
  {
    place: { type: placeSchema, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
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
  // A que parada del viaje pertenece este hospedaje: 0 = destino principal,
  // 1..N = indice en additionalDestinations. Mismo patron e igual de
  // informativo que Itinerary.days.destinationIndex: a proposito NO se
  // valida contra additionalDestinations.length en ningun hook (ver
  // pre('validate') mas abajo) -- si se borra la parada que un hospedaje
  // referenciaba, el dato queda huerfano pero no bloquea guardar nada; quien
  // lo lee (bookingLinks.service.js, el cliente) lo clampea a la defensiva y
  // cae de vuelta al destino principal.
  destinationIndex: { type: Number, min: 0, default: 0 },
  checkIn: { type: Date },
  checkOut: { type: Date },
  // Booking, Airbnb y compañía cotizan la estancia completa ("$3,000 por 3
  // noches"), no la noche suelta: se captura el total y la tarifa por noche se
  // deriva. nightlyRate se conserva para los registros anteriores al cambio.
  // Sin default a proposito: un registro que nunca capturo totalCost tiene
  // que leerse como undefined, no como 0, para que el virtual subtotal (abajo)
  // pueda distinguir "nunca se capturo" (cae a nightlyRate x nights) de "de
  // verdad costo $0" (cortesia, puntos) sin resucitar un costo viejo.
  totalCost: { type: Number, min: 0 },
  nightlyRate: { type: Number, min: 0, default: 0 },
  nights: { type: Number, min: 0, default: 0 },
  bookingRef: { type: String, trim: true, maxlength: 60 },
  externalUrl: { type: String, trim: true, maxlength: 600 },
  isEstimate: { type: Boolean, default: true },
  notes: { type: String, trim: true, maxlength: 500 },
});

/**
 * Costo de la estancia. Manda totalCost; solo se cae a la fórmula vieja
 * (tarifa x noches) cuando totalCost nunca se capturó (undefined/null), no
 * cuando de verdad es 0 -- un hospedaje regalado o pagado con puntos tiene
 * totalCost:0 a proposito, y con "||" un registro viejo que todavia trae
 * nightlyRate/nights de antes del cambio resucitaba un costo que ya no
 * existe en cuanto alguien editaba totalCost a 0.
 */
lodgingSchema.virtual('subtotal').get(function subtotal() {
  const total = this.totalCost != null ? this.totalCost : (this.nightlyRate || 0) * (this.nights || 0);
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
    // Paradas mas alla del destino principal, para viajes de mas de una
    // ciudad. Vacio por defecto: no cambia nada del comportamiento de un
    // viaje de un solo destino. Ver destinationStopSchema arriba.
    additionalDestinations: { type: [destinationStopSchema], default: [] },
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
    // Gustos del VIAJERO de este viaje, no de quien lo arma: un agente arma
    // viajes para clientes distintos, cada uno con su propio gusto, asi que
    // generar con las preferencias del perfil del agente (su gusto personal)
    // no tiene sentido. Sin especificar, generate() en
    // itinerary.controller.js cae al perfil de quien genera, para no romper
    // el uso personal (ahi si tiene sentido usar el gusto propio).
    interests: {
      type: [{ type: String, enum: TRAVEL_STYLES }],
      default: [],
      validate: { validator: (v) => v.length <= 5, message: 'Máximo 5 estilos de viaje.' },
    },
    pace: { type: String, enum: TRIP_PACES, default: null },
    budgetLevel: { type: String, enum: BUDGET_LEVELS, default: null },
    status: { type: String, enum: TRIP_STATUSES, default: 'borrador', index: true },
    estadoPropuesta: { type: String, enum: ESTADOS_PROPUESTA, default: 'borrador', index: true },
    // Rastro de la aceptacion desde el enlace publico (aceptarPropuesta): sin
    // esto, el flag estadoPropuesta='aceptada' no dice quien la acepto ni con
    // que precio/version de itinerario se quedo el cliente si luego el agente
    // cambia el margen o regenera el itinerario. No es sensible (no hay cuenta
    // de cliente en este sistema): solo IP/user-agent de quien dio clic.
    aceptacion: {
      en: { type: Date },
      ip: { type: String, trim: true, default: '' },
      userAgent: { type: String, trim: true, default: '' },
      precioTotalPorPersona: { type: Number, min: 0 },
      itineraryVersion: { type: Number },
    },
    coverImage: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, maxlength: 2000, default: '' },
    // Cliente del CRM vinculado opcionalmente al viaje
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null, index: true },
    // Quien viaja, no quien organiza. Ninguno de los dos es obligatorio:
    // alguien planeando su propio viaje no necesita esto. Sirve para
    // encontrar el viaje en la lista ("el de la familia Hernandez") y para
    // saber a quien contactar, sin ser un CRM aparte.
    cliente: {
      nombre: { type: String, trim: true, maxlength: 160, default: '' },
      contacto: { type: String, trim: true, maxlength: 160, default: '' },
    },
    // Para agencias con paquete cerrado o que le suman su comisión: el
    // cliente ve el total y de qué se compone (vuelo, hotel, traslados), pero
    // no el precio de cada renglon. Se aplica en el PDF y el enlace publico;
    // el dueño del viaje sigue viendo todo en su propia pantalla.
    ocultarDesglose: { type: Boolean, default: false },
    // Independiente de ocultarDesglose (eso es precio): esto tapa el codigo
    // de reservacion, el link de gestion externo y las notas internas de
    // transporte/hospedaje en el PDF y el enlace publico -- datos que sirven
    // para que el agente administre la reserva, no para que el cliente la
    // manipule. Default true a proposito: la mayoria de los viajes no
    // necesita mostrarle esto al cliente, asi que empieza oculto y el agente
    // decide activarlo si de verdad quiere compartirlo.
    ocultarCodigos: { type: Boolean, default: true },
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
// listTrips filtra por endDate en los filtros "proximos"/"pasados"
// (status=proximos -> endDate >= hoy, pasados -> endDate < hoy); sin este
// indice esa consulta hace collection scan una vez que hay muchos viajes.
tripSchema.index({ user: 1, endDate: 1 });

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
  // Reusa el virtual subtotal de cada hospedaje (no repite su logica aqui) --
  // asi ambos coinciden siempre, incluida la correccion de totalCost:0.
  const lodging = (this.lodging || []).reduce((sum, l) => sum + l.subtotal, 0);
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

  if (this.startDate && this.endDate) {
    const dias = Math.round((this.endDate.getTime() - this.startDate.getTime()) / 86400000) + 1;
    if (dias > MAX_DURACION_VIAJE_DIAS) {
      this.invalidate('endDate', `Un viaje no puede durar más de ${MAX_DURACION_VIAJE_DIAS} días.`);
    }
  }

  // Cada parada tiene que caer dentro del rango del viaje completo: sin
  // esto una parada podria quedar fuera de las fechas que el viaje dice
  // cubrir, y el clima/prompt de esa parada pedirian un rango sin sentido.
  if (this.startDate && this.endDate) {
    (this.additionalDestinations || []).forEach((parada, i) => {
      if (parada.endDate < parada.startDate) {
        this.invalidate(
          `additionalDestinations.${i}.endDate`,
          'La fecha de salida de la parada no puede ser anterior a la de llegada.'
        );
      }
      if (parada.startDate < this.startDate || parada.endDate > this.endDate) {
        this.invalidate(
          `additionalDestinations.${i}`,
          'Las fechas de la parada deben caer dentro de las fechas del viaje.'
        );
      }
    });
  }

  return next();
});

export default mongoose.model('Trip', tripSchema);
