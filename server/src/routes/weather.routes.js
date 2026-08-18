import { Router } from 'express';
import * as ctrl from '../controllers/weather.controller.js';
import { protect } from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import { weatherQuerySchema, geocodeQuerySchema } from '../validators/schemas.js';

const router = Router();

router.use(protect);

router.get('/', validate(weatherQuerySchema, 'query'), ctrl.getWeather);
router.get('/geocode', validate(geocodeQuerySchema, 'query'), ctrl.geocodePlace);

export default router;
