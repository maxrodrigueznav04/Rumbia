import { Router } from 'express';
import * as ctrl from '../controllers/public.controller.js';
import validate from '../middleware/validate.js';
import { publicAiLimiter } from '../middleware/rateLimiters.js';
import { publicItinerarySchema } from '../validators/schemas.js';

/**
 * Rutas sin sesion. Todo lo que vive aqui tiene que poder abrirse desde un
 * enlace compartido o desde la portada, sin cuenta y sin token.
 */
const router = Router();

router.post(
  '/itinerary',
  publicAiLimiter,
  validate(publicItinerarySchema),
  ctrl.generarItinerarioInvitado
);

router.get('/itinerary/:token', ctrl.verItinerarioCompartido);

export default router;
