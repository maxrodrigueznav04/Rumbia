import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

export const TRAVEL_STYLES = [
  'aventura',
  'cultura',
  'relax',
  'gastronomia',
  'naturaleza',
  'vida-nocturna',
  'compras',
  'familia',
];

export const BUDGET_LEVELS = ['bajo', 'medio', 'alto'];
export const TRIP_PACES = ['relajado', 'moderado', 'intenso'];
// Decide si el flujo de viajes muestra los campos de agencia (cliente, margen,
// ocultar desglose, duplicar como variante) o se queda con lo minimo para
// alguien que arma su propio viaje. Ver Layout/FormViaje/DetalleViaje.
export const PERFIL_USO = ['personal', 'agencia'];

// Cupo de generaciones con IA al mes para quien no pertenece a ninguna
// agencia (uso personal, siempre gratis). Sin este tope, "uso personal" era
// indistinguible de correr una operacion de agencia a volumen sin pagar.
export const LIMITE_GENERACIONES_PERSONAL = 5;

// Cupo de mensajes al chat de IA al mes, mismo espiritu que el de arriba
// pero mucho mas alto: una conversacion manda muchos mensajes cortos, no
// una generacion pesada de itinerario. Igual que LIMITE_GENERACIONES_PERSONAL,
// solo aplica sin agencia.
export const LIMITE_MENSAJES_CHAT_PERSONAL = 60;

const preferencesSchema = new mongoose.Schema(
  {
    // Se usan como contexto del prompt de Gemini al generar itinerarios.
    travelStyles: {
      type: [{ type: String, enum: TRAVEL_STYLES }],
      default: [],
      validate: {
        validator: (v) => v.length <= 5,
        message: 'Máximo 5 estilos de viaje.',
      },
    },
    budgetLevel: { type: String, enum: BUDGET_LEVELS, default: 'medio' },
    pace: { type: String, enum: TRIP_PACES, default: 'moderado' },
    homeCity: { type: String, trim: true, maxlength: 120, default: '' },
    currency: { type: String, uppercase: true, minlength: 3, maxlength: 3, default: 'MXN' },
    perfilUso: { type: String, enum: PERFIL_USO, default: 'agencia' },
  },
  { _id: false }
);

/**
 * Marca de la agencia o despacho que usa Rumbia con sus propios clientes.
 *
 * Existe para el itinerario impreso: una agencia entrega el plan con su logo y
 * sus datos, no con los de Rumbia. Vacio significa que se imprime la marca de
 * Rumbia, que es lo correcto para alguien que viaja por su cuenta.
 */
const brandingSchema = new mongoose.Schema(
  {
    agencyName: { type: String, trim: true, maxlength: 80, default: '' },
    // URL y no archivo subido: Rumbia no tiene almacenamiento de imagenes, y
    // montarlo entero por un logo no se justifica todavia.
    logoUrl: { type: String, trim: true, default: '' },
    contact: { type: String, trim: true, maxlength: 160, default: '' },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'El nombre es obligatorio.'],
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    email: {
      type: String,
      required: [true, 'El email es obligatorio.'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email inválido.'],
    },
    password: {
      type: String,
      required: [true, 'La contraseña es obligatoria.'],
      minlength: [8, 'La contraseña debe tener al menos 8 caracteres.'],
      select: false, // nunca viaja en las respuestas por accidente
    },
    avatarUrl: { type: String, default: '' },
    // Cuando se cambio la contrasena. Sirve para invalidar los JWT emitidos
    // antes: sin esto, restablecer no echaria fuera a quien ya estuviera dentro.
    passwordChangedAt: { type: Date },
    // Se guarda el HASH del token de recuperacion, no el token. Si la base se
    // filtrara, lo que hay aqui no sirve para restablecer nada.
    resetTokenHash: { type: String, select: false },
    resetTokenExpires: { type: Date, select: false },
    // Default en `true` A PROPOSITO (al reves de lo que se esperaria): una
    // cuenta ya existente en la base, creada antes de que este campo
    // existiera, no lo trae guardado -- Mongoose le aplica el default al
    // cargarla. Si el default fuera `false`, todo usuario real (pagando o
    // no) quedaria "sin verificar" el dia que esto se despliegue. register()
    // es el UNICO lugar que pone `false` a proposito, para las cuentas
    // nuevas de aqui en adelante. Mismo patron de hash que resetTokenHash.
    emailVerified: { type: Boolean, default: true },
    emailVerifyTokenHash: { type: String, select: false },
    emailVerifyTokenExpires: { type: Date, select: false },
    // Bloqueo de cuenta por intentos fallidos, aparte del rate-limit por IP:
    // ese ultimo no frena un ataque distribuido en varias IPs contra un mismo
    // correo. Van con select:false porque son datos de seguridad interna, no
    // algo que la app deba mostrar nunca.
    failedLoginAttempts: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, select: false },
    preferences: { type: preferencesSchema, default: () => ({}) },
    branding: { type: brandingSchema, default: () => ({}) },
    // Si el agente pertenece a una agencia, su membrete efectivo es el de la
    // agencia, no el de branding de arriba. Ver agency.controller.js.
    agency: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency', default: null, index: true },
    // Contador de generaciones con IA del mes en curso, solo relevante sin
    // agencia (con agencia, el cupo lo decide el plan de la agencia). "mes"
    // es YYYY-MM; se reinicia solo comparando contra el mes actual al
    // generar, sin cron ni job aparte. Ver itinerary.controller.js.
    usoIA: {
      mes: { type: String, default: '' },
      generaciones: { type: Number, default: 0 },
      // Mismo "mes" de arriba, contador aparte: mandar mensajes al chat de
      // IA no consume el cupo de generar itinerarios ni viceversa. Ver
      // chat.controller.js.
      mensajesChat: { type: Number, default: 0 },
    },
    lastLoginAt: { type: Date },
    // Se marca la primera vez que este usuario CREA una agencia (nunca se
    // desmarca al salir o borrarla): sin esto, salir de una agencia y crear
    // otra le regalaba un trial de 7 dias nuevo cada vez, indefinidamente.
    // Vive en el usuario, no en la agencia, justo para sobrevivir a que la
    // agencia se borre. Ver agency.controller.js crearAgencia.
    trialAgenciaUsado: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.password;
        delete ret.resetTokenHash;
        delete ret.resetTokenExpires;
        delete ret.__v;
        return ret;
      },
    },
  }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  // Un segundo hacia atras a proposito: el JWT que se firma justo despues lleva
  // iat en segundos enteros, y sin ese margen el redondeo puede dejarlo como
  // "emitido antes del cambio", tirando la sesion que se acaba de crear.
  this.passwordChangedAt = new Date(Date.now() - 1000);
  return next();
});

/** ¿Este JWT se emitio antes del ultimo cambio de contrasena? */
userSchema.methods.tokenAnteriorAlCambio = function tokenAnteriorAlCambio(iatSegundos) {
  if (!this.passwordChangedAt || !iatSegundos) return false;
  return iatSegundos * 1000 < this.passwordChangedAt.getTime();
};

userSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.virtual('trips', {
  ref: 'Trip',
  localField: '_id',
  foreignField: 'user',
});

export default mongoose.model('User', userSchema);
