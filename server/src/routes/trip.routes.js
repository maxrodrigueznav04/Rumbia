import { Router } from 'express';
import * as ctrl from '../controllers/trip.controller.js';
import { listTripExpenses } from '../controllers/expense.controller.js';
import { getTripWeather } from '../controllers/weather.controller.js';
import { protect } from '../middleware/auth.js';
import { soloLecturaSiCongelada } from '../middleware/billing.js';
import validate from '../middleware/validate.js';
import itineraryRoutes from './itinerary.routes.js';
import visualProposalRoutes from './visualProposals.routes.js';
import env from '../config/env.js';
import {
  createTripSchema,
  updateTripSchema,
  tripListQuerySchema,
  bookingLinksQuerySchema,
} from '../validators/schemas.js';

const router = Router();

// Todo lo de viajes requiere sesion.
router.use(protect);
// Cubre tambien /itinerary anidado: nada de esto escribe si la agencia esta congelada.
router.use(soloLecturaSiCongelada);

router.get('/', validate(tripListQuerySchema, 'query'), ctrl.listTrips);
router.post('/', validate(createTripSchema), ctrl.createTrip);
router.get('/panel', ctrl.getPanel);

router.get('/:id', ctrl.getTrip);
router.patch('/:id', validate(updateTripSchema), ctrl.updateTrip);
router.delete('/:id', ctrl.deleteTrip);
router.post('/:id/duplicar', ctrl.duplicarViaje);

router.get('/:id/summary', ctrl.getTripSummary);
router.get('/:id/booking-links', validate(bookingLinksQuerySchema, 'query'), ctrl.getBookingLinks);
router.get('/:id/expenses', listTripExpenses);
router.get('/:id/weather', getTripWeather);

// /api/trips/:id/itinerary/...
router.use('/:id/itinerary', itineraryRoutes);
if (env.visualTemplatesEnabled) router.use('/:id/visual-proposal', visualProposalRoutes);

export default router;
