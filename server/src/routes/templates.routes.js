import { Router } from 'express';
import * as ctrl from '../controllers/templates.controller.js';
import { protect } from '../middleware/auth.js';
import { soloLecturaSiCongelada } from '../middleware/billing.js';
import validate from '../middleware/validate.js';
import { aplicarPlantillaSchema } from '../validators/schemas.js';

const router = Router();
router.use(protect);

router.get('/', ctrl.listar);
router.delete('/:id', ctrl.eliminar);
// Aplicar una plantilla crea un viaje: mismo candado que crear uno a mano si
// la agencia no tiene un plan activo.
router.post('/:id/aplicar', soloLecturaSiCongelada, validate(aplicarPlantillaSchema), ctrl.aplicar);

export default router;
