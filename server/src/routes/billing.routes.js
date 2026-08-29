import { Router } from 'express';
import * as ctrl from '../controllers/billing.controller.js';
import validate from '../middleware/validate.js';
import { checkoutAgencySchema } from '../validators/schemas.js';

// Se monta dentro de agency.routes.js, que ya exige sesion (protect) para
// todo lo que cuelga de /api/agency.
const router = Router();

router.get('/', ctrl.obtenerBilling);
router.post('/checkout', validate(checkoutAgencySchema), ctrl.iniciarCheckout);
router.post('/portal', ctrl.abrirPortal);

export default router;
