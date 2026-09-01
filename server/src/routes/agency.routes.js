import { Router } from 'express';
import * as ctrl from '../controllers/agency.controller.js';
import { protect } from '../middleware/auth.js';
import { joinAgencyLimiter } from '../middleware/rateLimiters.js';
import validate from '../middleware/validate.js';
import subirLogo from '../middleware/subirLogo.js';
import billingRoutes from './billing.routes.js';
import { createAgencySchema, updateAgencySchema, joinAgencySchema } from '../validators/schemas.js';

/** Todo aqui requiere sesion: una agencia solo existe en relacion a sus agentes. */
const router = Router();
router.use(protect);

// /api/agency/billing/...
router.use('/billing', billingRoutes);

router.post('/', validate(createAgencySchema), ctrl.crearAgencia);
router.get('/', ctrl.obtenerAgencia);
router.patch('/', validate(updateAgencySchema), ctrl.actualizarAgencia);
router.post('/logo', subirLogo, ctrl.subirLogoAgencia);
router.post('/unirse', joinAgencyLimiter, validate(joinAgencySchema), ctrl.unirseAgencia);
router.post('/salir', ctrl.salirAgencia);
router.post('/codigo', ctrl.regenerarCodigo);
router.delete('/miembros/:userId', ctrl.eliminarMiembro);
router.get('/reporte', ctrl.obtenerReporte);

export default router;
