import { Router } from 'express';
import * as ctrl from '../controllers/chat.controller.js';
import validate from '../middleware/validate.js';
import { chatLimiter } from '../middleware/rateLimiters.js';
import { sendChatMessageSchema } from '../validators/schemas.js';

// mergeParams: hereda :id (el viaje) del router padre.
const router = Router({ mergeParams: true });

router.get('/', ctrl.getChat);
router.post('/', chatLimiter, validate(sendChatMessageSchema), ctrl.sendMessage);
router.delete('/', ctrl.clearChat);

export default router;
