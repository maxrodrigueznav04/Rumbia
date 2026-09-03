import { z } from 'zod';
import { TRAVEL_STYLES, BUDGET_LEVELS, TRIP_PACES, PERFIL_USO } from '../models/User.js';
import {
  TRIP_STATUSES,
  OUTBOUND_MODES,
  LODGING_TYPES,
  LOCAL_TRANSPORT_TYPES,
} from '../models/Trip.js';
import { ACTIVITY_CATEGORIES } from '../models/Itinerary.js';
import { EXPENSE_CATEGORIES } from '../models/Expense.js';
import { ORIGENES_CLICK } from '../models/ClickSalida.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Identificador inválido.');

/**
 * En un query string, "?status=" o "?tripId=null" significa "sin filtro", no "valor invalido".
 * Sin esto un parametro vacio o 'null' revienta contra los esquemas con un 400 'Datos invalidos'.
 */
const opcionalEnQuery = (schema) =>
  z.preprocess((v) => (v === '' || v === 'null' || v === 'undefined' ? undefined : v), schema.optional());
const isoDate = z.coerce.date({ errorMap: () => ({ message: 'Fecha inválida.' }) });
const currency = z.string().length(3, 'Usa el código de 3 letras, ej. MXN.').toUpperCase();

/**
 * Numero coercionado con mensajes en espanol. Sin el errorMap, Zod contesta
 * "Expected number, received nan", que es lo que acaba viendo el usuario en
 * pantalla porque el front pinta los `details` del backend tal cual.
 */
const numero = (mensaje = 'Debe ser un número.') =>
  z.coerce.number({ errorMap: () => ({ message: mensaje }) });

const money = numero('Escribe un monto válido.').min(0, 'No puede ser negativo.');
const entero = (mensaje) => numero(mensaje).int('Debe ser un número entero.');
const url = z.string().url('URL inválida.').max(600).or(z.literal(''));

const place = z.object({
  name: z.string().trim().min(1, 'El nombre del lugar es obligatorio.').max(160),
  address: z.string().trim().max(240).optional(),
  country: z.string().trim().max(80).optional(),
  lat: numero('Latitud inválida.').min(-90).max(90).optional(),
  lng: numero('Longitud inválida.').min(-180).max(180).optional(),
});

/**
 * Parada adicional de un viaje multi-destino. El rango de fechas del lado
 * del modelo (Trip.js, pre('validate')) es la fuente de verdad para el
 * chequeo de "dentro de las fechas del viaje" — aqui solo se valida que la
 * propia parada tenga fechas coherentes, para dar el error antes de tocar
 * la base.
 */
const destinationStop = z
  .object({ place, startDate: isoDate, endDate: isoDate })
  .refine((v) => v.endDate >= v.startDate, {
    message: 'La fecha de salida de la parada no puede ser anterior a la de llegada.',
    path: ['endDate'],
  });

/* ------------------------------- Auth ------------------------------- */

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres.').max(80),
  email: z.string().trim().toLowerCase().email('Email inválido.'),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres.')
    .max(72, 'Máximo 72 caracteres.'), // limite real de bcrypt
  perfilUso: z.enum(PERFIL_USO).optional(),
  // Honeypot: campo invisible para una persona, tentador para un bot que
  // rellena todo lo que encuentra. Vacio es lo unico que deja pasar.
  // Ver register() en auth.controller.js.
  referenciaContacto: z.string().max(200).optional(),
  // Token de Cloudflare Turnstile. Opcional en el schema porque el captcha
  // puede estar desactivado (ver verificarCaptcha en auth.routes.js); ahi es
  // donde de verdad se decide si es obligatorio.
  turnstileToken: z.string().max(3000).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email inválido.'),
  password: z.string().min(1, 'La contraseña es obligatoria.'),
});

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    avatarUrl: url.optional(),
    preferences: z
      .object({
        travelStyles: z.array(z.enum(TRAVEL_STYLES)).max(5).optional(),
        budgetLevel: z.enum(BUDGET_LEVELS).optional(),
        pace: z.enum(TRIP_PACES).optional(),
        homeCity: z.string().trim().max(120).optional(),
        currency: currency.optional(),
        perfilUso: z.enum(PERFIL_USO).optional(),
      })
      .optional(),
    branding: z
      .object({
        agencyName: z.string().trim().max(80).optional(),
        logoUrl: url.optional(),
        contact: z.string().trim().max(160).optional(),
      })
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No enviaste ningún campo a actualizar.' });

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email inválido.'),
  turnstileToken: z.string().max(3000).optional(),
});

export const resetPasswordSchema = z.object({
  // 64 caracteres hex en la practica; el minimo solo descarta basura evidente
  // antes de ir a buscarla a la base.
  token: z.string().trim().min(20, 'El enlace no es válido.').max(200),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres.')
    .max(72, 'Máximo 72 caracteres.'),
});

export const createAgencySchema = z.object({
  agencyName: z.string().trim().min(2, 'Ponle un nombre a la agencia.').max(80),
  contact: z.string().trim().max(160).optional(),
});

export const updateAgencySchema = z
  .object({
    agencyName: z.string().trim().min(2).max(80).optional(),
    contact: z.string().trim().max(160).optional(),
    // Solo para poder quitar el logo (PATCH { logoUrl: '' }); subirlo de verdad
    // pasa por /agency/logo, que es quien de verdad habla con Cloudinary.
    logoUrl: z.literal('').optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No enviaste ningún campo a actualizar.' });

export const joinAgencySchema = z.object({
  inviteCode: z.string().trim().min(1, 'Escribe el código de invitación.').max(40),
});

export const checkoutAgencySchema = z.object({
  plan: z.enum([
    'inicio_mensual',
    'inicio_anual',
    'agencia_mensual',
    'agencia_anual',
    'pro_mensual',
    'pro_anual',
    'mensual',
    'anual',
    'vitalicio',
  ]),
  extraAgentes: z.coerce.number().int().min(0).max(500).default(0),
});

export const cambiarAgentesSchema = z.object({
  extraAgentes: z.coerce.number().int().min(0).max(500),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Ingresa tu contraseña actual.'),
  newPassword: z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres.').max(72),
});

export const clickSalidaSchema = z.object({
  provider: z.string().trim().min(1).max(60),
  section: z.string().trim().max(40).optional(),
  destination: z.string().trim().max(120).optional(),
  esAfiliado: z.coerce.boolean().optional(),
  origen: z.enum(ORIGENES_CLICK).optional(),
});

export const publicItinerarySchema = z.object({
  destination: z.string().trim().min(2, 'Escribe a dónde quieres ir.').max(120),
  country: z.string().trim().max(60).optional(),
  startDate: isoDate,
  endDate: isoDate,
  travelers: entero('Escribe cuántos viajan.').min(1).max(20).default(1),
  interests: z.array(z.enum(TRAVEL_STYLES)).max(5).optional(),
  pace: z.enum(TRIP_PACES).optional(),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Escribe tu contraseña para confirmar.'),
});

/* ------------------------------- Trips ------------------------------ */

const legSchema = z.object({
  mode: z.enum(OUTBOUND_MODES).optional(),
  provider: z.string().trim().max(120).optional(),
  departureAt: isoDate.optional().nullable(),
  arrivalAt: isoDate.optional().nullable(),
  bookingRef: z.string().trim().max(60).optional(),
  externalUrl: url.optional(),
  cost: money.optional(),
  isEstimate: z.boolean().optional(),
  notes: z.string().trim().max(500).optional(),
});

export const lodgingSchema = z.object({
  type: z.enum(LODGING_TYPES).optional(),
  name: z.string().trim().max(160).optional(),
  place: place.partial().optional(),
  // 0 = destino principal, 1..N = indice en additionalDestinations. Sin tope
  // superior a proposito: el rango real depende de cuantas paradas tenga el
  // viaje, y esto es informativo, no bloqueante (ver comentario en Trip.js).
  destinationIndex: entero('Índice inválido.').min(0).optional(),
  checkIn: isoDate.optional().nullable(),
  checkOut: isoDate.optional().nullable(),
  totalCost: money.optional(),
  nightlyRate: money.optional(), // legado: solo llega desde registros viejos
  nights: entero('Escribe cuántas noches.').min(0, 'No puede ser negativo.').max(365, 'Máximo 365 noches.').optional(),
  bookingRef: z.string().trim().max(60).optional(),
  externalUrl: url.optional(),
  isEstimate: z.boolean().optional(),
  notes: z.string().trim().max(500).optional(),
});

export const localTransportSchema = z.object({
  type: z.enum(LOCAL_TRANSPORT_TYPES).optional(),
  provider: z.string().trim().max(120).optional(),
  estimatedCost: money.optional(),
  externalUrl: url.optional(),
  notes: z.string().trim().max(500).optional(),
});

const clienteSchema = z.object({
  nombre: z.string().trim().max(160).optional(),
  contacto: z.string().trim().max(160).optional(),
});

export const createTripSchema = z
  .object({
    title: z.string().trim().min(2, 'Ponle un título al viaje.').max(120),
    destination: place,
    origin: place.partial().optional(),
    // Paradas mas alla del destino principal, para viajes de mas de una
    // ciudad. Tope de 6: mas que eso deja de ser un viaje planeable a mano.
    additionalDestinations: z.array(destinationStop).max(6).optional(),
    startDate: isoDate,
    endDate: isoDate,
    travelers: entero('Escribe cuántas personas viajan.').min(1, 'Al menos 1 viajero.').max(30, 'Máximo 30 viajeros.').default(1),
    // Sin default en currency a proposito: el controller hereda la moneda del
    // perfil del usuario cuando no se manda una, y necesita ver undefined (no
    // 'MXN') para saber que hay que heredar.
    budget: z
      .object({ amount: money.default(0), currency: currency.optional() })
      .default({ amount: 0 }),
    status: z.enum(TRIP_STATUSES).optional(),
    coverImage: z.string().trim().max(600).optional(),
    notes: z.string().trim().max(2000).optional(),
    cliente: clienteSchema.optional(),
    // Gustos del viajero de este viaje (no de quien lo arma). Opcionales: un
    // agente puede no saberlos todavia al crear el viaje.
    interests: z.array(z.enum(TRAVEL_STYLES)).max(5).optional(),
    pace: z.enum(TRIP_PACES).optional(),
    budgetLevel: z.enum(BUDGET_LEVELS).optional(),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: 'La fecha de regreso no puede ser anterior a la de salida.',
    path: ['endDate'],
  })
  .refine(
    (v) =>
      (v.additionalDestinations || []).every(
        (p) => p.startDate >= v.startDate && p.endDate <= v.endDate
      ),
    { message: 'Las fechas de cada parada deben caer dentro de las fechas del viaje.', path: ['additionalDestinations'] }
  );

export const updateTripSchema = z
  .object({
    title: z.string().trim().min(2).max(120).optional(),
    destination: place.optional(),
    origin: place.partial().optional(),
    additionalDestinations: z.array(destinationStop).max(6).optional(),
    startDate: isoDate.optional(),
    endDate: isoDate.optional(),
    travelers: entero('Escribe cuántas personas viajan.').min(1, 'Al menos 1 viajero.').max(30, 'Máximo 30 viajeros.').optional(),
    budget: z.object({ amount: money.optional(), currency: currency.optional() }).optional(),
    status: z.enum(TRIP_STATUSES).optional(),
    coverImage: z.string().trim().max(600).optional(),
    notes: z.string().trim().max(2000).optional(),
    transport: z.object({ outbound: legSchema.optional(), inbound: legSchema.optional() }).optional(),
    lodging: z.array(lodgingSchema).max(10).optional(),
    localTransport: z.array(localTransportSchema).max(10).optional(),
    ocultarDesglose: z.boolean().optional(),
    interests: z.array(z.enum(TRAVEL_STYLES)).max(5).optional(),
    pace: z.enum(TRIP_PACES).optional(),
    budgetLevel: z.enum(BUDGET_LEVELS).optional(),
    margen: z.object({ tipo: z.enum(['fijo', 'porcentaje']).optional(), monto: money.optional() }).optional(),
    cliente: clienteSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No enviaste ningún campo a actualizar.' })
  .refine((v) => !(v.startDate && v.endDate) || v.endDate >= v.startDate, {
    message: 'La fecha de regreso no puede ser anterior a la de salida.',
    path: ['endDate'],
  })
  .refine(
    // Solo se puede validar aqui cuando el propio PATCH trae las tres cosas
    // a la vez; si solo llegan las paradas (fechas del viaje sin tocar), el
    // chequeo real lo hace el hook pre('validate') de Trip.js contra las
    // fechas ya guardadas.
    (v) =>
      !(v.startDate && v.endDate && v.additionalDestinations) ||
      v.additionalDestinations.every((p) => p.startDate >= v.startDate && p.endDate <= v.endDate),
    { message: 'Las fechas de cada parada deben caer dentro de las fechas del viaje.', path: ['additionalDestinations'] }
  );

export const tripListQuerySchema = z.object({
  status: opcionalEnQuery(z.enum([...TRIP_STATUSES, 'proximos', 'pasados'])),
  q: opcionalEnQuery(z.string().trim().max(120)),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const crearPlantillaSchema = z.object({
  name: z.string().trim().min(2, 'Ponle un nombre a la plantilla.').max(120),
});

export const aplicarPlantillaSchema = z
  .object({
    title: z.string().trim().min(2, 'Ponle un título al viaje.').max(120),
    startDate: isoDate,
    endDate: isoDate,
    travelers: entero('Escribe cuántas personas viajan.').min(1, 'Al menos 1 viajero.').max(30, 'Máximo 30 viajeros.').default(1),
    budget: z
      .object({ amount: money.default(0), currency: currency.optional() })
      .default({ amount: 0 }),
    cliente: clienteSchema.optional(),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: 'La fecha de regreso no puede ser anterior a la de salida.',
    path: ['endDate'],
  });

export const bookingLinksQuerySchema = z.object({
  section: opcionalEnQuery(z.enum(['transporte', 'hospedaje', 'transporte-local'])),
  type: opcionalEnQuery(z.string().trim().max(40)),
  // Que hospedaje de trip.lodging usar para armar el link (0 = primero). Sin
  // mandarlo, se conserva el comportamiento de siempre (lodging[0]).
  lodgingIndex: opcionalEnQuery(z.coerce.number().int().min(0)),
});

/* -------------------------------- Chat -------------------------------- */

export const sendChatMessageSchema = z.object({
  message: z.string().trim().min(1, 'Escribe un mensaje.').max(2000, 'Máximo 2000 caracteres.'),
  // Sin mandarlo, el chat responde en modo general (sin datos de un viaje
  // en particular). Ver chat.controller.js.
  tripId: objectId.optional(),
});

export const chatQuerySchema = z.object({
  tripId: opcionalEnQuery(objectId),
});

/* ----------------------------- Itinerary ---------------------------- */

export const generateItinerarySchema = z.object({
  extraNotes: z.string().trim().max(500).optional(),
  pace: z.enum(TRIP_PACES).optional(),
  interests: z.array(z.enum(TRAVEL_STYLES)).max(5).optional(),
  force: z.boolean().default(false), // sobrescribir un itinerario existente
});

export const activitySchema = z.object({
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'La hora debe tener formato HH:mm.')
    .or(z.literal(''))
    .optional(),
  title: z.string().trim().min(1, 'La actividad necesita un titulo.').max(160),
  description: z.string().trim().max(800).optional(),
  category: z.enum(ACTIVITY_CATEGORIES).optional(),
  location: z
    .object({
      name: z.string().trim().max(160).optional(),
      address: z.string().trim().max(240).optional(),
      lat: numero('Latitud inválida.').min(-90).max(90).optional(),
      lng: numero('Longitud inválida.').min(-180).max(180).optional(),
    })
    .optional(),
  estimatedCost: money.optional(),
  durationMinutes: entero('La duración debe ser un número.').min(0, 'No puede ser negativa.').max(1440, 'Máximo 24 horas.').optional(),
  bookingUrl: url.optional(),
});

export const updateActivitySchema = activitySchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: 'No enviaste ningún campo a actualizar.' }
);

export const updateDaySchema = z.object({
  title: z.string().trim().max(160).optional(),
  summary: z.string().trim().max(600).optional(),
});

export const reorderActivitiesSchema = z.object({
  // Lista completa de ids en el nuevo orden.
  activityIds: z.array(objectId).min(1, 'Envía al menos un id.'),
});

export const moveActivitySchema = z.object({
  targetDayNumber: entero('Número de día inválido.').min(1),
  position: entero('Posición inválida.').min(0).optional(),
});

/* ------------------------------ Expenses ---------------------------- */

export const createExpenseSchema = z.object({
  trip: objectId,
  category: z.enum(EXPENSE_CATEGORIES).default('otros'),
  description: z.string().trim().min(1, 'Describe el gasto.').max(160),
  amount: money,
  // Sin default aqui a proposito: el controller hereda la moneda del viaje
  // cuando no se manda una, y necesita ver undefined (no 'MXN') para saber
  // que hay que heredar.
  currency: currency.optional(),
  date: isoDate.optional(),
  isPaid: z.boolean().default(false),
  isEstimate: z.boolean().default(true),
  notes: z.string().trim().max(500).optional(),
});

export const updateExpenseSchema = z
  .object({
    category: z.enum(EXPENSE_CATEGORIES).optional(),
    description: z.string().trim().min(1).max(160).optional(),
    amount: money.optional(),
    currency: currency.optional(),
    date: isoDate.optional(),
    isPaid: z.boolean().optional(),
    isEstimate: z.boolean().optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No enviaste ningún campo a actualizar.' });

export const expenseListQuerySchema = z.object({
  trip: opcionalEnQuery(objectId),
  category: opcionalEnQuery(z.enum(EXPENSE_CATEGORIES)),
});

/* ------------------------------- Weather ---------------------------- */

export const weatherQuerySchema = z.object({
  lat: numero('Latitud inválida.').min(-90).max(90),
  lng: numero('Longitud inválida.').min(-180).max(180),
  startDate: isoDate,
  endDate: isoDate,
});

export const geocodeQuerySchema = z.object({
  q: z.string().trim().min(2, 'Escribe al menos 2 caracteres.').max(120),
});

export const idParamSchema = z.object({ id: objectId });
