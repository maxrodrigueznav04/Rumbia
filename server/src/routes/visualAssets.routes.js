import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { requireVisualAccess } from '../middleware/visualAccess.js';
import subirImagenPropuesta from '../middleware/subirImagenPropuesta.js';
import * as ctrl from '../controllers/visualAssets.controller.js';

const router = Router();
router.use(protect, requireVisualAccess);
router.get('/', ctrl.list);
router.post('/', subirImagenPropuesta, ctrl.upload);
router.delete('/:id', ctrl.remove);

export default router;
