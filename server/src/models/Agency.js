import mongoose from 'mongoose';
import crypto from 'node:crypto';

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
  },
  { _id: false }
);

const agencySchema = new mongoose.Schema(
  {
    agencyName: { type: String, required: true, trim: true, maxlength: 80 },
    logoUrl: { type: String, trim: true, default: '' },
    contact: { type: String, trim: true, maxlength: 160, default: '' },
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

agencySchema.virtual('capacidadAgentes').get(function capacidadAgentes() {
  const plan = this.billing?.plan;
  if (plan?.startsWith('pro')) return 15 + (this.billing?.extraAgentes || 0);
  if (plan?.startsWith('agencia')) return 8 + (this.billing?.extraAgentes || 0);
  if (plan?.startsWith('inicio')) return 3 + (this.billing?.extraAgentes || 0);
  return AGENTES_INCLUIDOS + (this.billing?.extraAgentes || 0);
});

export default mongoose.model('Agency', agencySchema);
