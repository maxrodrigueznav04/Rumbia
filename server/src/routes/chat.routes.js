import { Router } from 'express';
import * as ctrl from '../controllers/chat.controller.js';
import { protect } from '../middleware/auth.js';
import { soloLecturaSiCongelada } from '../middleware/billing.js';
import validate from '../middleware/validate.js';
import { chatLimiter } from '../middleware/rateLimiters.js';
import { sendChatMessageSchema, chatQuerySchema } from '../validators/schemas.js';

/**
 * Chat global: /api/chat, no anidado bajo /trips/:id. `tripId` es opcional
 * en el body (POST) o el query (GET/DELETE) -- con el, el asistente conoce
 * ese viaje; sin el, es una conversacion general. Ver chat.controller.js.
 */
const router = Router();
router.use(protect);

router.get('/', validate(chatQuerySchema, 'query'), ctrl.getChat);
// Gasta cuota de Gemini: mismo candado de facturacion congelada que crear/editar
// un viaje, y su propio rate limit (mas alto que el de generar itinerarios).
router.post('/', soloLecturaSiCongelada, chatLimiter, validate(sendChatMessageSchema), ctrl.sendMessage);
router.delete('/', validate(chatQuerySchema, 'query'), ctrl.clearChat);

export default router;
