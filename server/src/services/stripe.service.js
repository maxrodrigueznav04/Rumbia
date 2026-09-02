import Stripe from 'stripe';
import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';

/**
 * Cobro a agencias con Stripe.
 *
 * A diferencia de Gemini, Resend o Cloudinary, aqui si se usa el SDK oficial
 * en vez de fetch a mano: verificar la firma de un webhook (HMAC con
 * tolerancia de tiempo, formato "t=...,v1=...") es facil de hacer mal, y es
 * justo el punto donde un error deja pasar eventos falsos que activarian
 * agencias sin que nadie haya pagado.
 */

const stripe = env.stripe.enabled ? new Stripe(env.stripe.secretKey) : null;

function requerirStripe() {
  if (!stripe) {
    throw ApiError.serviceUnavailable(
      'El cobro a agencias no esta configurado. Agrega STRIPE_SECRET_KEY en el .env del servidor.'
    );
  }
  return stripe;
}

/**
 * Un Price de Stripe por casilla: la base de cada plan y el costo de un
 * agente extra en ese mismo plan. "vitalicio" es pago unico (mode: payment);
 * los otros dos son suscripciones que Stripe renueva solo.
 */
const PLANES = {
  inicio_mensual: { base: () => env.stripe.precios.inicioMensualBase, agente: () => null, permiteExtra: false, modo: 'subscription' },
  inicio_anual: { base: () => env.stripe.precios.inicioAnualBase, agente: () => null, permiteExtra: false, modo: 'subscription' },
  agencia_mensual: { base: () => env.stripe.precios.agenciaMensualBase, agente: () => null, permiteExtra: false, modo: 'subscription' },
  agencia_anual: { base: () => env.stripe.precios.agenciaAnualBase, agente: () => null, permiteExtra: false, modo: 'subscription' },
  pro_mensual: { base: () => env.stripe.precios.proMensualBase, agente: () => env.stripe.precios.proMensualAgente, permiteExtra: true, modo: 'subscription' },
  pro_anual: { base: () => env.stripe.precios.proAnualBase, agente: () => env.stripe.precios.proAnualAgente, permiteExtra: true, modo: 'subscription' },
  mensual: { base: () => env.stripe.precios.mensualBase, agente: () => env.stripe.precios.mensualAgente, permiteExtra: true, modo: 'subscription' },
  anual: { base: () => env.stripe.precios.anualBase, agente: () => env.stripe.precios.anualAgente, permiteExtra: true, modo: 'subscription' },
  vitalicio: { base: () => env.stripe.precios.vitalicioBase, agente: () => env.stripe.precios.vitalicioAgente, permiteExtra: true, modo: 'payment' },
};

function configDePlan(plan) {
  const cfg = PLANES[plan];
  if (!cfg) throw ApiError.badRequest(`Plan "${plan}" no existe.`);
  if (!cfg.base() || (cfg.permiteExtra && !cfg.agente())) {
    throw ApiError.serviceUnavailable(
      `El plan "${plan}" no tiene sus Price de Stripe configurados. Corre "npm run stripe:setup" en server/ y copia las variables al .env.`
    );
  }
  return cfg;
}

/**
 * Sesion de Checkout para activar o cambiar el plan de una agencia.
 *
 * El customer de Stripe se crea una sola vez por agencia y se reutiliza: asi
 * el historial de pagos y la tarjeta guardada quedan en un solo lugar aunque
 * la agencia cambie de plan mas adelante.
 */
export async function crearSesionCheckout({ agencia, user, plan, extraAgentes = 0 }) {
  const s = requerirStripe();
  const cfg = configDePlan(plan);

  try {
    let customerId = agencia.billing?.stripeCustomerId;
    if (!customerId) {
      const customer = await s.customers.create({
        email: user.email,
        name: agencia.agencyName,
        metadata: { agencyId: String(agencia._id) },
      });
      customerId = customer.id;
    }

    const lineItems = [{ price: cfg.base(), quantity: 1 }];
    if (extraAgentes > 0) lineItems.push({ price: cfg.agente(), quantity: extraAgentes });

    const session = await s.checkout.sessions.create({
      customer: customerId,
      mode: cfg.modo,
      line_items: lineItems,
      success_url: `${env.clientUrl}/perfil?billing=exito`,
      cancel_url: `${env.clientUrl}/perfil?billing=cancelado`,
      metadata: { agencyId: String(agencia._id), plan, extraAgentes: String(extraAgentes) },
      // El modo "payment" (vitalicio) no acepta subscription_data.
      ...(cfg.modo === 'subscription'
        ? { subscription_data: { metadata: { agencyId: String(agencia._id), plan } } }
        : {}),
    });

    return session.url;
  } catch (err) {
    throw traducirErrorStripe(err);
  }
}

/** Enlace al Customer Portal de Stripe: ahi cambian tarjeta, cancelan o ven facturas, sin que Rumbia construya nada de eso. */
export async function crearSesionPortal({ agencia }) {
  const s = requerirStripe();
  if (!agencia.billing?.stripeCustomerId) {
    throw ApiError.badRequest('Esta agencia todavia no tiene un plan. Activa uno primero.');
  }
  try {
    const session = await s.billingPortal.sessions.create({
      customer: agencia.billing.stripeCustomerId,
      return_url: `${env.clientUrl}/perfil`,
    });
    return session.url;
  } catch (err) {
    throw traducirErrorStripe(err);
  }
}

/**
 * Sube o baja los agentes extra de una suscripcion ya activa (mensual o
 * anual) sin cancelarla ni pasar por Checkout otra vez: Stripe prorratea la
 * diferencia en la siguiente factura. "vitalicio" es pago unico, no tiene
 * suscripcion que actualizar.
 */
export async function cambiarAgentesSuscripcion({ agencia, plan, nuevoExtraAgentes }) {
  const s = requerirStripe();
  const cfg = configDePlan(plan);
  if (cfg.modo !== 'subscription') {
    throw ApiError.badRequest('El plan "vitalicio" es un pago único: no tiene una suscripción que ajustar.');
  }

  try {
    const sub = await s.subscriptions.retrieve(agencia.billing.stripeSubscriptionId);
    const itemAgente = sub.items.data.find((it) => it.price.id === cfg.agente());

    if (nuevoExtraAgentes === 0) {
      if (!itemAgente) return; // Ya no habia agentes extra que quitar.
      await s.subscriptions.update(sub.id, {
        items: [{ id: itemAgente.id, deleted: true }],
        proration_behavior: 'create_prorations',
      });
      return;
    }

    await s.subscriptions.update(sub.id, {
      items: [
        itemAgente
          ? { id: itemAgente.id, quantity: nuevoExtraAgentes }
          : { price: cfg.agente(), quantity: nuevoExtraAgentes },
      ],
      proration_behavior: 'create_prorations',
    });
  } catch (err) {
    throw traducirErrorStripe(err);
  }
}

/**
 * Los errores de la API de Stripe ya traen el detalle util (que parametro y
 * por que), pero solo en `type`/`param`/`message` — sin esto el usuario ve un
 * "Not a valid URL" pelón sin saber si fue el success_url, el customer o el
 * price.
 */
function traducirErrorStripe(err) {
  if (err instanceof ApiError) return err;
  if (typeof err?.type === 'string' && err.type.startsWith('Stripe')) {
    console.error(`[stripe] ${err.type}${err.param ? ` (param: ${err.param})` : ''}: ${err.message}`);
    return ApiError.badRequest(
      err.param ? `Stripe rechazó "${err.param}": ${err.message}` : `Stripe rechazó la solicitud: ${err.message}`
    );
  }
  return err;
}

/** Verifica la firma y arma el evento. Lanza si el body fue alterado o la firma no corresponde. */
export function construirEvento(payloadCrudo, firma) {
  const s = requerirStripe();
  if (!env.stripe.webhookSecret) {
    throw ApiError.serviceUnavailable('Falta STRIPE_WEBHOOK_SECRET: no se puede verificar el webhook.');
  }
  return s.webhooks.constructEvent(payloadCrudo, firma, env.stripe.webhookSecret);
}

export default { crearSesionCheckout, crearSesionPortal, cambiarAgentesSuscripcion, construirEvento };
