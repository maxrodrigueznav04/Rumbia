import { Agency, User, StripeEvent } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import stripeService from '../services/stripe.service.js';
import { agenciaComoDueno } from './agency.controller.js';

/**
 * Estado de pago de la agencia del usuario en sesion (cualquier miembro puede verlo).
 *
 * stripeCustomerId/stripeSubscriptionId nunca salen de aqui: ningun miembro
 * (ni siquiera el dueno, que ya los usa del lado del servidor via
 * agenciaComoDueno para abrir el portal o el checkout) necesita verlos en
 * pantalla. Lo unico que el cliente si necesitaba de stripeCustomerId era
 * saber si la agencia "ya tuvo un plan antes" -- eso se manda como booleano.
 */
export const obtenerBilling = asyncHandler(async (req, res) => {
  if (!req.user.agency) throw ApiError.notFound('No perteneces a ninguna agencia.');
  const agencia = await Agency.findById(req.user.agency).select('billing capacidadAgentes');
  if (!agencia) throw ApiError.notFound('No perteneces a ninguna agencia.');

  const { stripeCustomerId, stripeSubscriptionId, checkoutSessionId, ultimoEventoStripeEn, ...billingPublico } =
    agencia.billing.toObject();

  res.json({
    success: true,
    data: {
      billing: { ...billingPublico, tuvoPlanAlgunaVez: Boolean(stripeCustomerId) },
      capacidadAgentes: agencia.capacidadAgentes,
    },
  });
});

/** Solo el dueño puede activar o cambiar el plan: es su tarjeta la que se cobra. */
export const iniciarCheckout = asyncHandler(async (req, res) => {
  const agencia = await agenciaComoDueno(req);
  const { plan, extraAgentes } = req.body;

  const url = await stripeService.crearSesionCheckout({
    agencia,
    user: req.user,
    plan,
    extraAgentes,
  });

  res.json({ success: true, data: { url } });
});

/**
 * Sube o baja los agentes extra de una suscripción ya activa (mensual/anual)
 * sin pasar por Checkout de nuevo. El plan "vitalicio" es pago único: no hay
 * suscripción que ajustar, así que no aplica aquí.
 */
export const cambiarAgentes = asyncHandler(async (req, res) => {
  const agencia = await agenciaComoDueno(req);
  const { extraAgentes } = req.body;

  if (agencia.billing?.status !== 'activa' || !agencia.billing?.stripeSubscriptionId) {
    throw ApiError.badRequest('Esta agencia no tiene una suscripción activa que ajustar.');
  }

  const miembrosActuales = await User.countDocuments({ agency: agencia._id });
  // capacidadAgentes (virtual de Agency.js) ya conoce el tope base de cada
  // plan (Inicio 3, Agencia 8, Pro 15): se le resta el extraAgentes actual y
  // se le suma el propuesto, en vez de repetir esos numeros aqui a mano.
  const nuevaCapacidad = agencia.capacidadAgentes - (agencia.billing.extraAgentes || 0) + extraAgentes;
  if (nuevaCapacidad < miembrosActuales) {
    throw ApiError.conflict(
      `Ya tienes ${miembrosActuales} agente(s) en la agencia; no puedes bajar el cupo por debajo de eso. Saca agentes primero.`
    );
  }

  await stripeService.cambiarAgentesSuscripcion({
    agencia,
    plan: agencia.billing.plan,
    nuevoExtraAgentes: extraAgentes,
  });

  agencia.billing.extraAgentes = extraAgentes;
  await agencia.save();

  res.json({ success: true, message: 'Agentes extra actualizados.', data: { agency: agencia } });
});

/** Portal de Stripe: cambiar tarjeta, cancelar, ver facturas. Nada de eso vive en Rumbia. */
export const abrirPortal = asyncHandler(async (req, res) => {
  const agencia = await agenciaComoDueno(req);
  const url = await stripeService.crearSesionPortal({ agencia });
  res.json({ success: true, data: { url } });
});

/**
 * Aplica un cambio de billing solo si este evento es igual o mas nuevo que el
 * ultimo que ya se aplico a esta agencia (billing.ultimoEventoStripeEn,
 * comparado contra `evento.created` de Stripe, no contra cuando Rumbia lo
 * recibio). Es un update atomico con el chequeo de frescura en el propio
 * filtro: sin esto, un webhook reenviado fuera de orden (Stripe no garantiza
 * el orden de entrega) podia pisar un estado mas nuevo con uno viejo -- por
 * ejemplo, una cancelacion seguida de un `checkout.session.completed`
 * atrasado que reactivaba la agencia por error.
 */
async function aplicarSiEsFresco(agencyId, eventoCreatedDate, camposUpdate) {
  await Agency.updateOne(
    {
      _id: agencyId,
      $or: [
        { 'billing.ultimoEventoStripeEn': { $exists: false } },
        { 'billing.ultimoEventoStripeEn': { $lte: eventoCreatedDate } },
      ],
    },
    { $set: { ...camposUpdate, 'billing.ultimoEventoStripeEn': eventoCreatedDate } }
  );
}

/**
 * Activa la agencia a partir de una sesion de Checkout ya pagada. La misma
 * logica sirve para el pago inmediato (checkout.session.completed) y para el
 * que se confirma despues (checkout.session.async_payment_succeeded, metodos
 * como OXXO/SPEI) -- ver la llamada de cada uno mas abajo.
 */
async function activarPorCheckout(session, eventoCreatedDate) {
  const { agencyId, plan, extraAgentes } = session.metadata || {};
  if (!agencyId) return;

  await aplicarSiEsFresco(agencyId, eventoCreatedDate, {
    'billing.status': 'activa',
    'billing.plan': plan,
    'billing.extraAgentes': Number(extraAgentes || 0),
    'billing.stripeCustomerId': session.customer,
    'billing.stripeSubscriptionId': session.mode === 'subscription' ? session.subscription : '',
    // El plan vitalicio (mode: payment) no vence; los de suscripcion
    // reciben su fecha real en customer.subscription.updated, que Stripe
    // manda enseguida.
    ...(session.mode === 'payment' ? { 'billing.periodoHasta': null } : {}),
  });
}

/**
 * Webhook de Stripe. Se monta en app.js con el body crudo (no JSON-parseado)
 * porque la verificacion de firma necesita los bytes exactos que Stripe mando.
 *
 * Nunca confia en el `agencyId` del cliente: siempre lo lee de la metadata que
 * Rumbia mismo puso al crear la sesion de Checkout o la suscripcion, del lado
 * del servidor.
 */
export const webhook = asyncHandler(async (req, res) => {
  const firma = req.headers['stripe-signature'];
  let evento;
  try {
    evento = stripeService.construirEvento(req.body, firma);
  } catch (err) {
    console.warn(`[stripe] Firma de webhook invalida: ${err.message}`);
    throw ApiError.badRequest('Firma invalida.');
  }

  // Stripe puede reenviar el mismo evento si no vio la respuesta 2xx a
  // tiempo (timeout de red, redeploy a la mitad). El indice unico de
  // eventId es quien de verdad evita procesarlo dos veces: si otro proceso
  // ya lo inserto entre que se checa y se inserta, este insert simplemente
  // choca y se responde 200 sin repetir ningun efecto.
  try {
    await StripeEvent.create({ eventId: evento.id, type: evento.type });
  } catch (err) {
    if (err.code === 11000) {
      return res.json({ received: true, duplicado: true });
    }
    throw err;
  }

  const eventoCreatedDate = new Date(evento.created * 1000);

  switch (evento.type) {
    case 'checkout.session.completed': {
      const session = evento.data.object;
      // Con metodos de pago asincronos (OXXO, SPEI, comunes en MXN) esta
      // sesion puede "completarse" (el cliente eligio como pagar) sin que el
      // pago en si ya haya llegado. Activar aqui de todas formas regalaria
      // el plan sin cobro confirmado; se espera a async_payment_succeeded.
      if (session.payment_status === 'unpaid') break;
      await activarPorCheckout(session, eventoCreatedDate);
      break;
    }

    // El pago asincrono (OXXO/SPEI) se confirmo unos dias despues de crear
    // la sesion: recien aqui se activa el plan que checkout.session.completed
    // dejo pendiente arriba.
    case 'checkout.session.async_payment_succeeded': {
      await activarPorCheckout(evento.data.object, eventoCreatedDate);
      break;
    }

    case 'checkout.session.async_payment_failed': {
      const { agencyId } = evento.data.object.metadata || {};
      if (agencyId) {
        console.warn(`[stripe] Pago asincrono fallido para la agencia ${agencyId} (sesion ${evento.data.object.id}).`);
      }
      break;
    }

    // Renovacion, cambio de tarjeta, pago fallido, cancelacion: todo llega
    // aqui como un cambio de estado de la suscripcion.
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = evento.data.object;
      const agencyId = sub.metadata?.agencyId;
      if (!agencyId) break;

      const activa = evento.type === 'customer.subscription.updated' && ['active', 'trialing'].includes(sub.status);
      const periodoHasta = sub.current_period_end ? new Date(sub.current_period_end * 1000) : undefined;

      const camposUpdate = {
        'billing.status': activa ? 'activa' : 'congelada',
        'billing.cancelaAlFinalizarPeriodo': Boolean(sub.cancel_at_period_end),
        ...(periodoHasta ? { 'billing.periodoHasta': periodoHasta } : {}),
      };

      // Un cambio de plan hecho desde el Customer Portal reemplaza los items
      // de la suscripcion pero no toca subscription.metadata: sin esto,
      // Rumbia se enteraba del nuevo cobro pero seguia dando los permisos
      // del plan viejo. Si ningun plan conocido calza con los items (Price
      // fuera de catalogo), se deja el plan actual como esta, sin adivinar.
      if (evento.type === 'customer.subscription.updated') {
        const resuelto = stripeService.resolverPlanDesdeSuscripcion(sub);
        if (resuelto) {
          camposUpdate['billing.plan'] = resuelto.plan;
          camposUpdate['billing.extraAgentes'] = resuelto.extraAgentes;
        }
      }

      await aplicarSiEsFresco(agencyId, eventoCreatedDate, camposUpdate);
      break;
    }

    default:
      break; // El resto de los eventos no cambia nada del lado de Rumbia.
  }

  res.json({ received: true });
});
