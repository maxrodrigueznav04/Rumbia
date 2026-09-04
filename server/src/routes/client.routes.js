import { Router } from 'express';
import * as ctrl from '../controllers/client.controller.js';
import { protect } from '../middleware/auth.js';
import { soloLecturaSiCongelada } from '../middleware/billing.js';
import validate from '../middleware/validate.js';
import {
  createClientSchema,
  updateClientSchema,
  clientListQuerySchema,
  idParamSchema,
} from '../validators/schemas.js';

const router = Router();

router.use(protect);

router.get('/', validate(clientListQuerySchema, 'query'), ctrl.listarClientes);
router.post('/', soloLecturaSiCongelada, validate(createClientSchema), ctrl.crearCliente);
router.get('/:id', validate(idParamSchema, 'params'), ctrl.obtenerCliente);
router.patch(
  '/:id',
  soloLecturaSiCongelada,
  validate(idParamSchema, 'params'),
  validate(updateClientSchema),
  ctrl.actualizarCliente
);
router.delete('/:id', soloLecturaSiCongelada, validate(idParamSchema, 'params'), ctrl.eliminarCliente);

export default router;
