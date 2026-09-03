import { Agency } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { esAdmin } from '../utils/esAdmin.js';

/**
 * Bloquea crear o editar viajes, itinerarios y gastos si la agencia del
 * usuario no tiene un plan activo, sin borrar ni ocultar nada de lo que ya
 * existe.
 *
 * A diferencia de antes, esto ya no exime al dueño mientras este solo en su
 * agencia: crear una agencia es gratis, pero usarla (crear/editar viajes)
 * requiere un plan activo desde el primer agente, sea el dueño solo o no. El
 * uso sin marca de agencia (branding personal, sin Agency de por medio) sigue
 * siendo gratis siempre — este candado solo aplica a quien ya tiene una
 * agencia creada. La cuenta admin (ADMIN_EMAIL) tampoco se congela nunca.
 */
export const soloLecturaSiCongelada = asyncHandler(async (req, res, next) => {
  if (!req.user.agency || req.method === 'GET' || esAdmin(req.user)) return next();

  const agencia = await Agency.findById(req.user.agency).select('billing createdAt');
  if (!agencia) return next();

  // 1. Suscripción activa en Stripe
  if (agencia.billing?.status === 'activa') return next();

  // 2. Periodo de prueba gratuito (trial) de 7 días vigente
  const ahora = new Date();
  const finTrial =
    agencia.billing?.trialHasta ||
    (agencia.billing?.status === 'trial'
      ? new Date(new Date(agencia.createdAt).getTime() + 7 * 86400000)
      : null);

  if (finTrial && new Date(finTrial) > ahora) {
    return next();
  }

  const esTrial = agencia.billing?.status === 'trial' || Boolean(finTrial);
  throw ApiError.forbidden(
    esTrial
      ? 'El periodo de prueba gratuita de 7 días de tu agencia ha concluido. Tus viajes siguen guardados, pero necesitas activar un plan para crear o editar contenido.'
      : 'La suscripción de tu agencia no está activa. Tus viajes siguen ahí, pero no puedes crear ni editar nada hasta que se active un plan.'
  );
});

export default soloLecturaSiCongelada;
