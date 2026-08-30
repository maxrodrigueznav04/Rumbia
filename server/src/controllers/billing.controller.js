import { Agency, User } from '../models/index.js';
import { AGENTES_INCLUIDOS } from '../models/Agency.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import stripeService from '../services/stripe.service.js';
import { agenciaComoDueno } from './agency.controller.js';

/** Estado de pago de la agencia del usuario en sesion (cualquier miembro puede verlo). */
export const obtenerBilling = asyncHandler(async (req, res) => {
  if (!req.user.agency) throw ApiError.notFound('No perteneces a ninguna agencia.');
  const agencia = await Agency.findById(req.user.agency).select('billing capacidadAgentes');
  if (!agencia) throw ApiError.notFound('No perteneces a ninguna agencia.');

  res.json({
    success: true,
    data: { billing: agencia.billing, capacidadAgentes: agencia.capacidadAgentes },
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
  const nuevaCapacidad = AGENTES_INCLUIDOS + extraAgentes;
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

/** Portal de Stripe: cambiar tarjeta, cancelar, ver facturas. Nada de eso vive en Rumbo. */
export const abrirPortal = asyncHandler(async (req, res) => {
  const agencia = await agenciaComoDueno(req);
  const url = await stripeService.crearSesionPortal({ agencia });
  res.json({ success: true, data: { url } });
});

/**
 * Webhook de Stripe. Se monta en app.js con el body crudo (no JSON-parseado)
 * porque la verificacion de firma necesita los bytes exactos que Stripe mando.
 *
 * Nunca confia en el `agencyId` del cliente: siempre lo lee de la metadata que
 * Rumbo mismo puso al crear la sesion de Checkout o la suscripcion, del lado
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

  switch (evento.type) {
    case 'checkout.session.completed': {
      const session = evento.data.object;
      const { agencyId, plan, extraAgentes } = session.metadata || {};
      if (!agencyId) break;

      await Agency.findByIdAndUpdate(agencyId, {
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

      await Agency.findByIdAndUpdate(agencyId, {
        'billing.status': activa ? 'activa' : 'congelada',
        ...(periodoHasta ? { 'billing.periodoHasta': periodoHasta } : {}),
      });
      break;
    }

    default:
      break; // El resto de los eventos no cambia nada del lado de Rumbo.
  }

  res.json({ received: true });
});
