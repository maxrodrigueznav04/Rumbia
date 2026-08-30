import { Agency } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

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
 * agencia creada.
 */
export const soloLecturaSiCongelada = asyncHandler(async (req, res, next) => {
  if (!req.user.agency || req.method === 'GET') return next();

  const agencia = await Agency.findById(req.user.agency).select('billing');
  if (!agencia || agencia.billing?.status === 'activa') return next();

  throw ApiError.forbidden(
    'La suscripción de tu agencia no está activa. Tus viajes siguen ahí, pero no puedes crear ni editar nada hasta que se active o se reactive un plan.'
  );
});

export default soloLecturaSiCongelada;
