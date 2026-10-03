import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { requireVisualAccess } from '../middleware/visualAccess.js';
import validate from '../middleware/validate.js';
import * as ctrl from '../controllers/visualTemplates.controller.js';
import { createVisualTemplateSchema, updateVisualTemplateSchema, deleteVisualTemplateSchema } from '../validators/visualTemplate.js';

const router = Router();
router.use(protect, requireVisualAccess);
router.get('/', ctrl.list);
router.get('/art/:artId', ctrl.art);
router.post('/', validate(createVisualTemplateSchema), ctrl.create);
router.get('/:id', ctrl.get);
router.patch('/:id', validate(updateVisualTemplateSchema), ctrl.update);
router.delete('/:id', validate(deleteVisualTemplateSchema), ctrl.remove);
router.post('/:id/duplicate', ctrl.duplicate);

export default router;
