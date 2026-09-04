import { Router } from 'express';
import publicRoutes from './public.routes.js';
import statsRoutes from './stats.routes.js';
import authRoutes from './auth.routes.js';
import tripRoutes from './trip.routes.js';
import expenseRoutes from './expense.routes.js';
import weatherRoutes from './weather.routes.js';
import agencyRoutes from './agency.routes.js';
import templateRoutes from './templates.routes.js';
import chatRoutes from './chat.routes.js';
import clientRoutes from './client.routes.js';
import env from '../config/env.js';

const router = Router();

/** Health check: util para el keep-alive de Render y para depurar el deploy. */
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    status: 'ok',
    env: env.nodeEnv,
    services: {
      gemini: env.gemini.enabled ? 'configurado' : 'no configurado',
      openWeather: env.openWeather.enabled ? 'configurado' : 'no configurado',
    },
    timestamp: new Date().toISOString(),
  });
});

router.use('/public', publicRoutes);
router.use('/stats', statsRoutes);
router.use('/auth', authRoutes);
router.use('/trips', tripRoutes);
router.use('/expenses', expenseRoutes);
router.use('/weather', weatherRoutes);
router.use('/agency', agencyRoutes);
router.use('/templates', templateRoutes);
router.use('/chat', chatRoutes);
router.use('/clients', clientRoutes);

export default router;
