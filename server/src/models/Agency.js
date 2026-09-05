import mongoose from 'mongoose';
import crypto from 'node:crypto';
import ApiError from '../utils/ApiError.js';
import { incrementarUsoIAMensual } from '../utils/cupoIA.js';

/**
 * Agencia: la marca que comparten varios agentes sin compartir cuenta.
 *
 * Cada agente sigue teniendo su propio login, sus propios viajes y su propia
 * contrasena — lo unico que la agencia centraliza es el membrete del PDF
 * (nombre, logo, contacto). La pertenencia vive en User.agency (un ref),
 * no en un arreglo de miembros aqui: asi hay un solo lugar de verdad y no dos
 * listas que se puedan desincronizar.
 */

// 16 bytes = 32 caracteres hex: con 4 (la version anterior) el espacio
// completo de codigos era de ~4.3 mil millones, adivinable en un tiempo
// realista contra un endpoint sin limite propio. A este tamano no lo es.
const generarCodigo = () => crypto.randomBytes(16).toString('hex');

export const PLANES_AGENCIA = [
  'inicio_mensual',
  'inicio_anual',
  'agencia_mensual',
  'agencia_anual',
  'pro_mensual',
  'pro_anual',
  'mensual',
  'anual',
  'vitalicio',
];

// Agentes que trae el plan base de inicio antes de comprar asientos extra.
export const AGENTES_INCLUIDOS = 3;

/**
 * Limites de uso de IA por mes que Rumbia SI anuncia en /acerca y en la
 * tarjeta de cada plan (TarjetaAgencia.jsx). Antes de esto no existia ningun
 * contador a nivel Agency: cualquier agencia con plan activo quedaba exenta
 * de todo limite (ver el bypass `if (user.agency) return` que sigue existiendo
 * en itinerary.controller.js / chat.controller.js para el cupo PERSONAL, que
 * no aplica con agencia de por medio). `null` = sin limite prometido para ese
 * campo en ese tier.
 *
 * Los planes legacy (mensual/anual/vitalicio, de antes de que existieran los
 * tiers Inicio/Agencia/Pro) no tienen contador aqui a proposito: no hay
 * ninguna promesa vigente de "X itinerarios al mes" para ellos en la pagina
 * actual, y limitar retroactivamente a alguien que ya estaba pagando sin ese
 * tope seria una sorpresa peor que dejarlo como esta hoy.
 */
const LIMITES_PLAN = {
  inicio: { itinerarios: 25, chat: 60 },
  agencia: { itinerarios: 150, chat: null },
  pro: { itinerarios: 500, chat: null },
};

export function limitesDePlan(plan) {
  if (plan?.startsWith('inicio')) return LIMITES_PLAN.inicio;
  if (plan?.startsWith('agencia')) return LIMITES_PLAN.agencia;
  if (plan?.startsWith('pro')) return LIMITES_PLAN.pro;
  return null;
}

// Opciones de tipografia del PDF (beneficio Agencia/Pro, igual que
// colorAcento). '' = la tipografia de Rumbia de siempre (Sora/Manrope). El
// nombre real de cada fuente y como cargarla vive en el cliente
// (client/src/utils/fuentesPdf.js) -- aqui solo se valida que el id exista.
export const FUENTES_PDF = [
  '',
  'editorial',
  'clasica',
  'corporativa',
  'redondeada',
  'tradicional',
  'neutra',
  'robusta',
];

// Escala de tamano de todo el documento (compacto/normal/grande). Un solo
// numero mueve TODOS los font-size del PDF via calc(), no hay que tocar
// regla por regla (ver --escala-pdf en global.css).
export const DENSIDADES_PDF = ['compacto', 'normal', 'grande'];

/**
 * Estado de pago de la agencia.
 *
 * "pendiente": nunca se activo un plan (agencia recien creada). Se comporta
 * igual que "congelada" para efectos de bloqueo: la diferencia es solo de
 * texto en la interfaz (una dice "activa tu plan", la otra "reactivalo").
 * "activa": el pago esta al corriente.
 * "congelada": tuvo un plan activo y se vencio o se cancelo.
 */
const billingSchema = new mongoose.Schema(
  {
    stripeCustomerId: { type: String, default: '' },
    // Vacio en el plan vitalicio: es un pago unico, no una suscripcion.
    stripeSubscriptionId: { type: String, default: '' },
    plan: { type: String, enum: PLANES_AGENCIA, default: null },
    status: {
      type: String,
      enum: ['trial', 'pendiente', 'activa', 'congelada'],
      default: 'trial',
    },
    // Asientos comprados encima de AGENTES_INCLUIDOS.
    extraAgentes: { type: Number, default: 0, min: 0 },
    // Vacio en el plan vitalicio, que no vence. En mensual/anual es la fecha
    // que Stripe reporta como fin del periodo pagado.
    periodoHasta: { type: Date },
    // Periodo de prueba gratuito de 7 dias para agencias nuevas.
    trialHasta: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    // Contador de uso de IA del mes en curso, mismo patron y mismo campo "mes"
    // (YYYY-MM) que User.usoIA, pero a nivel agencia: mientras el cupo
    // personal es "por cuenta sin agencia", este es "por agencia", compartido
    // entre todos sus agentes. Ver Agency.verificarCupoIA/consumirCupoIA.
    usoIA: {
      mes: { type: String, default: '' },
      generaciones: { type: Number, default: 0 },
      mensajesChat: { type: Number, default: 0 },
    },
    // Ultimo evento de Stripe aplicado a este documento (su campo `created`,
    // no cuando Rumbia lo recibio): un webhook reenviado o que llega atrasado
    // respecto a uno mas reciente no debe pisar un estado mas nuevo. Ver
    // billing.controller.js.
    ultimoEventoStripeEn: { type: Date },
    // true entre que Stripe reporta cancel_at_period_end y el fin del periodo
    // pagado: la agencia sigue activa, pero no se va a renovar sola. Sin esto
    // la UI decia "se renueva el [fecha]" para una suscripcion que ya se
    // cancelo desde el Customer Portal.
    cancelaAlFinalizarPeriodo: { type: Boolean, default: false },
    // Sesion de Checkout todavia abierta (no completada ni expirada), para no
    // crear una segunda si el dueno le da doble clic o tiene dos pestañas
    // abiertas del mismo formulario. Ver stripe.service.js.
    checkoutSessionId: { type: String, default: '' },
  },
  { _id: false }
);

const agencySchema = new mongoose.Schema(
  {
    agencyName: { type: String, required: true, trim: true, maxlength: 80 },
    logoUrl: { type: String, trim: true, default: '' },
    contact: { type: String, trim: true, maxlength: 160, default: '' },
    // Color de acento del PDF (insignia, marcadores de dia, actividades).
    // Beneficio de los planes Agencia/Pro -- el campo se puede guardar en
    // cualquier plan, pero solo se USA cuando marcaBlanca (abajo) es true;
    // el front tambien oculta el selector si no aplica.
    colorAcento: {
      type: String,
      trim: true,
      default: '',
      match: [/^#([0-9a-f]{3}|[0-9a-f]{6})$/i, 'El color debe ser un codigo hexadecimal, ej. #1F6F5C.'],
    },
    // Mismo criterio que colorAcento: se guarda en cualquier plan, solo se
    // usa si marcaBlanca es true.
    fuentePdf: { type: String, enum: FUENTES_PDF, default: '' },
    densidadPdf: { type: String, enum: DENSIDADES_PDF, default: 'normal' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Se comparte fuera de la app (whatsapp, correo) para que un agente se una
    // sin que el dueno tenga que invitarlo uno por uno desde un panel.
    inviteCode: { type: String, required: true, unique: true, default: generarCodigo },
    billing: { type: billingSchema, default: () => ({}) },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

agencySchema.methods.regenerarCodigo = function regenerarCodigo() {
  this.inviteCode = generarCodigo();
  return this.inviteCode;
};

// Beneficio de los planes Agencia y Agencia Pro: el PDF deja de mencionar a
// Rumbia en el pie y puede usar el color de acento propio. "inicio" y el uso
// personal (sin agencia) se quedan con el pie estandar.
agencySchema.virtual('marcaBlanca').get(function marcaBlanca() {
  const plan = this.billing?.plan;
  return Boolean(plan?.startsWith('agencia') || plan?.startsWith('pro'));
});

agencySchema.virtual('capacidadAgentes').get(function capacidadAgentes() {
  const plan = this.billing?.plan;
  if (plan?.startsWith('pro')) return 15 + (this.billing?.extraAgentes || 0);
  if (plan?.startsWith('agencia')) return 8 + (this.billing?.extraAgentes || 0);
  if (plan?.startsWith('inicio')) return 3 + (this.billing?.extraAgentes || 0);
  return AGENTES_INCLUIDOS + (this.billing?.extraAgentes || 0);
});

/**
 * Revisa el cupo mensual de IA del plan de esta agencia. `campo` es
 * 'generaciones' (itinerarios) o 'chat' (mensajes). Sin plan reconocido
 * (trial, pendiente, congelada o un plan legacy) no hay limite que aplicar
 * aqui -- el candado real para una agencia sin plan activo ya es
 * soloLecturaSiCongelada (middleware/billing.js), que bloquea toda
 * escritura, generar itinerarios incluido.
 */
agencySchema.methods.verificarCupoIA = function verificarCupoIA(campo) {
  const limites = limitesDePlan(this.billing?.plan);
  const limite = campo === 'chat' ? limites?.chat : limites?.itinerarios;
  if (limite == null) return;

  const mesActual = new Date().toISOString().slice(0, 7);
  const usados =
    this.billing.usoIA?.mes === mesActual
      ? campo === 'chat'
        ? this.billing.usoIA.mensajesChat
        : this.billing.usoIA.generaciones
      : 0;

  if (usados >= limite) {
    const nombre = campo === 'chat' ? 'mensajes al chat' : 'itinerarios generados con IA';
    throw ApiError.forbidden(
      `Tu agencia llegó al límite de ${limite} ${nombre} este mes en su plan. Sube de plan para generar más.`
    );
  }
};

/**
 * Suma 1 al contador del mes en curso (reiniciandolo si cambio de mes), de
 * forma atomica -- sin cargar this.billing.usoIA y volver a guardarlo, que
 * perdia un incremento si dos agentes de la misma agencia generaban casi al
 * mismo tiempo (ver incrementarUsoIAMensual).
 */
agencySchema.methods.consumirCupoIA = async function consumirCupoIA(campo) {
  const [propio, otro] = campo === 'chat' ? ['mensajesChat', 'generaciones'] : ['generaciones', 'mensajesChat'];
  await incrementarUsoIAMensual(this.constructor, { _id: this._id }, 'billing.usoIA', propio, otro);
};

export default mongoose.model('Agency', agencySchema);
