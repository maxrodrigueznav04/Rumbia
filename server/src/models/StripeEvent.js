import mongoose from 'mongoose';

/**
 * Un renglon por evento de webhook de Stripe ya procesado, solo para no
 * aplicarlo dos veces. Stripe puede reenviar el mismo evento (si Rumbia
 * tardo en responder o hubo un timeout de red) esperando la misma respuesta
 * 2xx; sin este registro, un `checkout.session.completed` reenviado no hacia
 * ningun dano por ser el mismo dato dos veces, pero un `customer.subscription.*`
 * reenviado fuera de orden si podia pisar un estado mas nuevo con uno viejo.
 *
 * TTL de 30 dias: no hace falta guardar esto para siempre, solo lo que dura
 * la ventana real de reintentos de Stripe (unos pocos dias como mucho).
 */
const stripeEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true },
  type: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 },
});

export default mongoose.model('StripeEvent', stripeEventSchema);
