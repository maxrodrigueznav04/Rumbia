import mongoose from 'mongoose';

export const TIPOS_TRABAJO_BILLING = [
  'cancelar_suscripcion',
  'detener_renovacion',
  'expirar_checkout',
];

export const ESTADOS_TRABAJO_BILLING = ['pendiente', 'completado', 'fallido_definitivo'];

const pendingBillingJobSchema = new mongoose.Schema(
  {
    agency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agency',
      required: true,
      index: true,
    },
    tipo: {
      type: String,
      enum: TIPOS_TRABAJO_BILLING,
      required: true,
      index: true,
    },
    datos: {
      stripeSubscriptionId: { type: String, default: '' },
      stripeCustomerId: { type: String, default: '' },
      checkoutSessionId: { type: String, default: '' },
    },
    intentos: { type: Number, default: 0 },
    maxIntentos: { type: Number, default: 5 },
    ultimoError: { type: String, default: '' },
    proximoIntentoEn: { type: Date, default: Date.now, index: true },
    status: {
      type: String,
      enum: ESTADOS_TRABAJO_BILLING,
      default: 'pendiente',
      index: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model('PendingBillingJob', pendingBillingJobSchema);
