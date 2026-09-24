import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import * as ctrl from '../controllers/visualTemplates.controller.js';
import { createVisualTemplateSchema, updateVisualTemplateSchema } from '../validators/visualTemplate.js';

const router = Router();
router.use(protect);
router.get('/', ctrl.list);
router.post('/', validate(createVisualTemplateSchema), ctrl.create);
router.get('/:id', ctrl.get);
router.patch('/:id', validate(updateVisualTemplateSchema), ctrl.update);
router.post('/:id/duplicate', ctrl.duplicate);

export default router;
