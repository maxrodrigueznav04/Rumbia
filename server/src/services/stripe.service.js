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
 * Un Price de Stripe por casilla y por divisa: la base de cada plan y el
 * costo de un agente extra en ese mismo plan. "vitalicio" es pago unico
 * (mode: payment); los otros dos son suscripciones que Stripe renueva solo.
 *
 * MXN sigue siendo la divisa "de siempre" y la unica con los 9 planes
 * (incluidos los legacy mensual/anual/vitalicio, que ya no se venden a
 * clientes nuevos). USD solo cubre los tiers vigentes -- no se convierte
 * automaticamente a nadie: Rumbia cobra nativo en cada divisa porque muchas
 * tarjetas mexicanas (BBVA incluida) rechazan cargos en dolares. Ver
 * stripe-setup.mjs para el detalle de precios y el porque del lookup_key
 * con sufijo de divisa.
 */
const PLANES = {
  inicio_mensual: {
    permiteExtra: false,
    modo: 'subscription',
    precios: {
      mxn: { base: () => env.stripe.precios.inicioMensualBase, agente: () => null },
      usd: { base: () => env.stripe.preciosUsd.inicioMensualBase, agente: () => null },
    },
  },
  inicio_anual: {
    permiteExtra: false,
    modo: 'subscription',
    precios: {
      mxn: { base: () => env.stripe.precios.inicioAnualBase, agente: () => null },
      usd: { base: () => env.stripe.preciosUsd.inicioAnualBase, agente: () => null },
    },
  },
  agencia_mensual: {
    permiteExtra: false,
    modo: 'subscription',
    precios: {
      mxn: { base: () => env.stripe.precios.agenciaMensualBase, agente: () => null },
      usd: { base: () => env.stripe.preciosUsd.agenciaMensualBase, agente: () => null },
    },
  },
  agencia_anual: {
    permiteExtra: false,
    modo: 'subscription',
    precios: {
      mxn: { base: () => env.stripe.precios.agenciaAnualBase, agente: () => null },
      usd: { base: () => env.stripe.preciosUsd.agenciaAnualBase, agente: () => null },
    },
  },
  pro_mensual: {
    permiteExtra: true,
    modo: 'subscription',
    precios: {
      mxn: { base: () => env.stripe.precios.proMensualBase, agente: () => env.stripe.precios.proMensualAgente },
      usd: { base: () => env.stripe.preciosUsd.proMensualBase, agente: () => env.stripe.preciosUsd.proMensualAgente },
    },
  },
  pro_anual: {
    permiteExtra: true,
    modo: 'subscription',
    precios: {
      mxn: { base: () => env.stripe.precios.proAnualBase, agente: () => env.stripe.precios.proAnualAgente },
      usd: { base: () => env.stripe.preciosUsd.proAnualBase, agente: () => env.stripe.preciosUsd.proAnualAgente },
    },
  },
  mensual: {
    permiteExtra: true,
    modo: 'subscription',
    precios: {
      mxn: { base: () => env.stripe.precios.mensualBase, agente: () => env.stripe.precios.mensualAgente },
    },
  },
  anual: {
    permiteExtra: true,
    modo: 'subscription',
    precios: {
      mxn: { base: () => env.stripe.precios.anualBase, agente: () => env.stripe.precios.anualAgente },
    },
  },
  vitalicio: {
    permiteExtra: true,
    modo: 'payment',
    precios: {
      mxn: { base: () => env.stripe.precios.vitalicioBase, agente: () => env.stripe.precios.vitalicioAgente },
    },
  },
};

const MONEDAS = ['mxn', 'usd'];

function configDePlan(plan, moneda = 'mxn') {
  const cfg = PLANES[plan];
  if (!cfg) throw ApiError.badRequest(`Plan "${plan}" no existe.`);
  const precios = cfg.precios[moneda];
  if (!precios) {
    throw ApiError.badRequest(`El plan "${plan}" no esta disponible en ${moneda.toUpperCase()}.`);
  }
  if (!precios.base() || (cfg.permiteExtra && !precios.agente())) {
    throw ApiError.serviceUnavailable(
      `El plan "${plan}" no tiene sus Price de Stripe (${moneda.toUpperCase()}) configurados. Corre "npm run stripe:setup" en server/ y copia las variables al .env.`
    );
  }
  return { modo: cfg.modo, permiteExtra: cfg.permiteExtra, base: precios.base, agente: precios.agente };
}

/**
 * Sesion de Checkout para activar o cambiar el plan de una agencia.
 *
 * El customer de Stripe se crea una sola vez por agencia y se reutiliza: asi
 * el historial de pagos y la tarjeta guardada quedan en un solo lugar aunque
 * la agencia cambie de plan mas adelante.
 */
export async function crearSesionCheckout({ agencia, user, plan, extraAgentes = 0, moneda = 'mxn' }) {
  const s = requerirStripe();
  const cfg = configDePlan(plan, moneda);

  // Ya tiene un plan cobrando: otra sesion de Checkout aqui crearia una
  // SEGUNDA suscripcion en paralelo, no cambiaria la que ya existe (Stripe no
  // las fusiona solo). Cambiar de plan pasa por crearSesionPortal; ajustar
  // asientos, por cambiarAgentesSuscripcion. Ninguno de los dos pasa por aqui.
  if (agencia.billing?.status === 'activa') {
    throw ApiError.badRequest(
      'Esta agencia ya tiene un plan activo. Usa "Administrar plan" para cambiarlo, no actives uno nuevo.'
    );
  }

  try {
    // Doble clic o dos pestañas con el mismo formulario: si ya hay una sesion
    // de Checkout abierta y sin usar, se reutiliza en vez de crear otra --
    // que, si ambas se llegan a completar, dejaria dos suscripciones cobrando
    // a la vez. "abierta" se pregunta a Stripe mismo, no se guarda una fecha
    // de vencimiento propia que se pueda desincronizar.
    if (agencia.billing?.checkoutSessionId) {
      const existente = await s.checkout.sessions.retrieve(agencia.billing.checkoutSessionId).catch(() => null);
      if (existente?.status === 'open') return existente.url;
    }

    let customerId = agencia.billing?.stripeCustomerId;
    if (!customerId) {
      const customer = await s.customers.create(
        {
          email: user.email,
          name: agencia.agencyName,
          metadata: { agencyId: String(agencia._id) },
        },
        // Clave estable por agencia: dos requests concurrentes con los mismos
        // parametros (doble clic, dos pestañas) reciben el MISMO Customer de
        // Stripe en vez de uno cada una -- es justo la carrera que reprodujo
        // la auditoria externa de lanzamiento.
        { idempotencyKey: `rumbia-customer-${agencia._id}` }
      );
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
      metadata: { agencyId: String(agencia._id), plan, extraAgentes: String(extraAgentes), moneda },
      // El modo "payment" (vitalicio) no acepta subscription_data.
      ...(cfg.modo === 'subscription'
        ? { subscription_data: { metadata: { agencyId: String(agencia._id), plan, moneda } } }
        : {}),
    });

    // Se guarda de una vez, sin esperar al webhook: es lo que permite que la
    // reutilizacion de arriba funcione en la siguiente llamada.
    agencia.billing.stripeCustomerId = customerId;
    agencia.billing.checkoutSessionId = session.id;
    await agencia.save();

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
  const cfg = configDePlan(plan, agencia.billing?.moneda || 'mxn');
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
 * Deriva el plan y los agentes extra de una suscripcion a partir de sus
 * items reales (el Price de cada renglon), no de la metadata que Rumbia le
 * puso una sola vez al crearla. Hace falta porque cambiar de plan desde el
 * Customer Portal de Stripe reemplaza los items de la suscripcion pero NO
 * actualiza `subscription.metadata` -- sin esto, un cambio de plan hecho ahi
 * se cobraba distinto pero los permisos en Rumbia se quedaban con el plan
 * viejo. Devuelve null si ningun plan conocido coincide con los items (Price
 * fuera de catalogo, o config incompleta) para no pisar un plan valido con
 * uno adivinado a medias.
 *
 * Nota: si dos claves de PLANES comparten el mismo Price por un fallback de
 * configuracion (agencia_mensual sin su propio STRIPE_PRICE_* cae al de
 * "mensual", ver env.js), se resuelve la primera que aparezca en PLANES --
 * hoy eso favorece los tiers nuevos (Inicio/Agencia/Pro) sobre los legacy.
 *
 * Tambien devuelve la divisa: el Price en si ya la fija (un Price de Stripe
 * nunca cambia de divisa), asi que hace falta recorrer ambas listas de
 * precios por plan para saber cual matcheo.
 */
export function resolverPlanDesdeSuscripcion(sub) {
  const priceIds = (sub.items?.data || []).map((it) => it.price?.id).filter(Boolean);
  for (const [plan, cfg] of Object.entries(PLANES)) {
    if (cfg.modo !== 'subscription') continue;
    for (const moneda of MONEDAS) {
      const precios = cfg.precios[moneda];
      if (!precios) continue;
      const basePriceId = precios.base();
      if (!basePriceId || !priceIds.includes(basePriceId)) continue;

      let extraAgentes = 0;
      if (cfg.permiteExtra && precios.agente()) {
        const itemAgente = sub.items.data.find((it) => it.price?.id === precios.agente());
        extraAgentes = itemAgente?.quantity || 0;
      }
      return { plan, moneda, extraAgentes };
    }
  }
  return null;
}

/**
 * Cancela la suscripcion de Stripe de una agencia, si tiene una. Se llama
 * ANTES de borrar la agencia (el dueño sale sin mas agentes, o borra su
 * cuenta): sin esto, Stripe le seguiria cobrando cada mes/año por una
 * agencia que ya no existe en Rumbia, sin que nadie pueda ya entrar a
 * cancelarla desde el Customer Portal (necesita la agencia para llegar ahi).
 *
 * "vitalicio" es pago unico: no tiene stripeSubscriptionId, no hay nada que
 * cancelar. Si Stripe falla (red, suscripcion ya cancelada del otro lado) no
 * se tira el borrado por eso -- perder el registro del usuario porque Stripe
 * tuvo un hipo seria peor que un cobro de mas que se resuelve a mano. Por eso
 * regresa { ok } en vez de lanzar: el llamador decide si vale la pena dejar
 * un rastro (ver agency.controller.js/auth.controller.js, que lo registran
 * en AuditLog antes de borrar la agencia).
 */
export async function cancelarSuscripcion({ agencia }) {
  const subscriptionId = agencia?.billing?.stripeSubscriptionId;
  if (!stripe || !subscriptionId) return { ok: true };
  try {
    await stripe.subscriptions.cancel(subscriptionId);
    return { ok: true };
  } catch (err) {
    if (err.code === 'resource_missing' || err.message?.includes('No such subscription')) {
      return { ok: true };
    }
    console.error(`[stripe] No se pudo cancelar la suscripcion ${subscriptionId} de la agencia ${agencia._id}: ${err.message}`);
    return { ok: false, error: err.message, subscriptionId };
  }
}

export async function cancelarSuscripcionDirecto(subscriptionId) {
  if (!stripe || !subscriptionId) return { ok: true };
  try {
    await stripe.subscriptions.cancel(subscriptionId);
    return { ok: true };
  } catch (err) {
    if (err.code === 'resource_missing' || err.message?.includes('No such subscription')) {
      return { ok: true };
    }
    throw err;
  }
}

export async function detenerRenovacion({ agencia }) {
  const subscriptionId = agencia?.billing?.stripeSubscriptionId;
  if (!stripe || !subscriptionId) return { ok: true };
  try {
    await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
    return { ok: true };
  } catch (err) {
    if (err.code === 'resource_missing' || err.message?.includes('No such subscription')) {
      return { ok: true };
    }
    console.error(`[stripe] No se pudo detener renovacion ${subscriptionId} de agencia ${agencia._id}: ${err.message}`);
    return { ok: false, error: err.message, subscriptionId };
  }
}

export async function detenerRenovacionDirecto(subscriptionId) {
  if (!stripe || !subscriptionId) return { ok: true };
  try {
    await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
    return { ok: true };
  } catch (err) {
    if (err.code === 'resource_missing' || err.message?.includes('No such subscription')) {
      return { ok: true };
    }
    throw err;
  }
}

export async function expirarSesionCheckout(sessionId) {
  if (!stripe || !sessionId) return { ok: true };
  try {
    await stripe.checkout.sessions.expire(sessionId);
    return { ok: true };
  } catch (err) {
    if (err.code === 'resource_missing' || err.message?.includes('No such checkout') || err.message?.includes('cannot expire')) {
      return { ok: true };
    }
    console.warn(`[stripe] No se pudo expirar sesion de checkout ${sessionId}: ${err.message}`);
    return { ok: false, error: err.message, sessionId };
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

export default {
  crearSesionCheckout,
  crearSesionPortal,
  cambiarAgentesSuscripcion,
  resolverPlanDesdeSuscripcion,
  cancelarSuscripcion,
  cancelarSuscripcionDirecto,
  detenerRenovacion,
  detenerRenovacionDirecto,
  expirarSesionCheckout,
  construirEvento,
};
