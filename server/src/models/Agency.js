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

// Fondo de pagina del PDF (beneficio Agencia/Pro, mismo criterio que
// fuentePdf/densidadPdf). Una paleta curada, no un color libre: el fondo
// cubre TODA la hoja detras de las tarjetas blancas, asi que un tono mal
// elegido (muy oscuro o saturado) se traga el documento entero -- el color
// de acento si es libre porque solo pinta detalles chicos, este no. Los
// valores reales de cada tono viven en client/src/utils/fondosPdf.js, mismo
// patron que FUENTES_PDF/fuentesPdf.js.
export const FONDOS_PDF = ['', 'azul', 'amarillo', 'morado', 'verde', 'beige', 'rosa', 'gris'];

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
    // Divisa en la que se cobra la suscripcion. MXN sigue siendo el default:
    // muchas tarjetas mexicanas (BBVA incluida) rechazan cargos en dolares,
    // asi que nunca se convierte a nadie de MXN a USD sin que lo elija.
    // Ver stripe.service.js / stripe-setup.mjs para el porque de precios
    // nativos por divisa en vez de conversion automatica de Stripe.
    moneda: { type: String, enum: ['mxn', 'usd'], default: 'mxn' },
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
    // Periodo de prueba gratuito de 14 dias para agencias nuevas.
    trialHasta: {
      type: Date,
      default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
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
    // Historial de pagadores previos (separación de pagador en transferencia de dueño, P02).
    // El nuevo dueño no hereda stripeCustomerId ni acceso al Customer Portal del pagador anterior.
    historialPagadores: [
      {
        stripeCustomerId: { type: String, default: '' },
        stripeSubscriptionId: { type: String, default: '' },
        transferidoEn: { type: Date, default: Date.now },
        desasociadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
    ],
  },
  { _id: false }
);

const transferenciaPendienteSchema = new mongoose.Schema(
  {
    destinatario: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    solicitadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    solicitadoEn: { type: Date, default: Date.now },
    expiraEn: { type: Date, required: true },
  },
  { _id: false }
);

const agencySchema = new mongoose.Schema(
  {
    agencyName: { type: String, required: true, trim: true, maxlength: 80 },
    logoUrl: { type: String, trim: true, default: '' },
    contact: { type: String, trim: true, maxlength: 160, default: '' },
    // Estado del ciclo de vida de la agencia, independiente del estado de billing.
    status: {
      type: String,
      enum: ['activa', 'archivada'],
      default: 'activa',
      index: true,
    },
    archivedAt: { type: Date, default: null },
    archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // Version para coordinacion de concurrencia en mutaciones de ciclo de vida
    version: { type: Number, default: 1 },
    transferenciaPendiente: { type: transferenciaPendienteSchema, default: null },
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
    // Mismo criterio que fuentePdf: se guarda en cualquier plan, solo se usa
    // si marcaBlanca es true.
    fondoPdf: { type: String, enum: FONDOS_PDF, default: '' },
    // Una agencia activa SIEMPRE requiere un dueño existente. Una agencia
    // archivada puede tener owner: null si su dueño se dio de baja posteriormente.
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
      validate: {
        validator: function (v) {
          return this.status !== 'activa' || Boolean(v);
        },
        message: 'Una agencia activa requiere un dueño.',
      },
    },
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

// Verifica si la agencia esta dentro de su periodo de prueba gratuito (trial) de 14 dias.
agencySchema.virtual('esTrialActivo').get(function esTrialActivo() {
  if (this.status === 'archivada' || this.billing?.status !== 'trial') return false;
  const ahora = new Date();
  const finTrial =
    this.billing?.trialHasta ||
    (this.createdAt ? new Date(new Date(this.createdAt).getTime() + 7 * 86400000) : null);
  return Boolean(finTrial && new Date(finTrial) > ahora);
});

// true si la suscripcion esta activa o si el trial de 14 dias sigue vigente.
agencySchema.virtual('tieneAccesoActivo').get(function tieneAccesoActivo() {
  if (this.status === 'archivada') return false;
  return this.billing?.status === 'activa' || this.esTrialActivo;
});

// Beneficio de los planes Agencia y Agencia Pro, y del trial de 14 dias:
// el PDF deja de mencionar a Rumbia en el pie y puede usar color de acento,
// fuentes, fondos y densidad propios. "inicio", agencias con trial vencido/congeladas
// y el uso personal (sin agencia) se quedan con el pie estandar.
agencySchema.virtual('marcaBlanca').get(function marcaBlanca() {
  const plan = this.billing?.plan;
  if (plan?.startsWith('agencia') || plan?.startsWith('pro')) return true;
  if (this.esTrialActivo) return true;
  return false;
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
