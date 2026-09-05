import { Router } from 'express';
import * as ctrl from '../controllers/itinerary.controller.js';
import validate from '../middleware/validate.js';
import { aiLimiter, heavyAiConcurrencyLimit } from '../middleware/rateLimiters.js';
import {
  generateItinerarySchema,
  activitySchema,
  updateActivitySchema,
  updateDaySchema,
  reorderActivitiesSchema,
  moveActivitySchema,
  crearPlantillaSchema,
} from '../validators/schemas.js';

// mergeParams: hereda :id (el viaje) del router padre.
const router = Router({ mergeParams: true });

router.get('/', ctrl.getItinerary);
router.post('/', ctrl.createBlank);
router.delete('/', ctrl.deleteItinerary);

router.post('/share', ctrl.compartir);
router.delete('/share', ctrl.dejarDeCompartir);

router.post('/plantilla', validate(crearPlantillaSchema), ctrl.crearPlantilla);

// El unico endpoint que consume cuota de Gemini: limitado por usuario/hora.
router.post('/generate', aiLimiter, validate(generateItinerarySchema), heavyAiConcurrencyLimit, ctrl.generate);

router.patch('/days/:dayId', validate(updateDaySchema), ctrl.updateDay);
router.delete('/days/:dayId', ctrl.deleteDay);
router.patch('/days/:dayId/reorder', validate(reorderActivitiesSchema), ctrl.reorderActivities);

router.post('/days/:dayId/activities', validate(activitySchema), ctrl.addActivity);
router.patch('/days/:dayId/activities/:activityId', validate(updateActivitySchema), ctrl.updateActivity);
router.patch('/days/:dayId/activities/:activityId/move', validate(moveActivitySchema), ctrl.moveActivity);
router.delete('/days/:dayId/activities/:activityId', ctrl.deleteActivity);

export default router;
