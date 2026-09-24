import { Router } from 'express';
import publicRoutes from './public.routes.js';
import statsRoutes from './stats.routes.js';
import authRoutes from './auth.routes.js';
import tripRoutes from './trip.routes.js';
import expenseRoutes from './expense.routes.js';
import weatherRoutes from './weather.routes.js';
import agencyRoutes from './agency.routes.js';
import templateRoutes from './templates.routes.js';
import visualTemplateRoutes from './visualTemplates.routes.js';
import chatRoutes from './chat.routes.js';
import clientRoutes from './client.routes.js';
import env from '../config/env.js';
import mongoose from 'mongoose';

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

/** Readiness: confirma que la instancia puede atender datos, no solo responder HTTP. */
router.get('/ready', (_req, res) => {
  const databaseReady = mongoose.connection.readyState === 1;
  res.status(databaseReady ? 200 : 503).json({
    success: databaseReady,
    status: databaseReady ? 'ready' : 'not_ready',
    database: databaseReady ? 'conectada' : 'no disponible',
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
router.use('/visual-templates', visualTemplateRoutes);
router.use('/chat', chatRoutes);
router.use('/clients', clientRoutes);

export default router;
