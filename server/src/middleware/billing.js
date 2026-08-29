import { Agency, User } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * Bloquea crear o editar viajes, itinerarios y gastos si la agencia del
 * usuario dejó de pagar, sin borrar ni ocultar nada de lo que ya existe.
 *
 * Un dueño de agencia SOLO (nadie más se unió) nunca se bloquea: mientras no
 * comparta la marca con nadie es exactamente el mismo caso que usar Rumbo
 * personal, y eso es gratis. El candado es para cuando la agencia ya era
 * varias personas compartiendo la marca y el plan se venció o se canceló.
 */
export const soloLecturaSiCongelada = asyncHandler(async (req, res, next) => {
  if (!req.user.agency || req.method === 'GET') return next();

  const agencia = await Agency.findById(req.user.agency).select('billing');
  if (!agencia || agencia.billing?.status === 'activa') return next();

  const hayOtrosAgentes = await User.exists({ agency: agencia._id, _id: { $ne: req.user._id } });
  if (!hayOtrosAgentes) return next();

  throw ApiError.forbidden(
    'La suscripción de tu agencia no está activa. Tus viajes siguen ahí, pero no puedes crear ni editar nada hasta que se reactive.'
  );
});

export default soloLecturaSiCongelada;
