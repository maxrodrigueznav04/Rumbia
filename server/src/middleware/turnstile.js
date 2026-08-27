import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { verificarTurnstile } from '../services/turnstile.service.js';

/**
 * Exige un token de Turnstile valido antes de seguir. Va DESPUES de validate()
 * en la ruta: turnstileToken tiene que estar en el schema de Zod, o
 * validate() lo habria descartado del body antes de llegar aqui.
 */
export const verificarCaptcha = asyncHandler(async (req, _res, next) => {
  const ok = await verificarTurnstile(req.body.turnstileToken, req.ip);
  if (!ok) throw ApiError.badRequest('No pudimos verificar que eres una persona. Intenta de nuevo.');
  return next();
});

export default verificarCaptcha;
