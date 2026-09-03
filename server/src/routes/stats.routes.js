import { Router } from 'express';
import * as ctrl from '../controllers/stats.controller.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.get('/clicks', protect, ctrl.reporteClicks);
router.get('/auditoria', protect, ctrl.reporteAuditoria);

export default router;
