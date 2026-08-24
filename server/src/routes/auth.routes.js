import { Router } from 'express';
import * as ctrl from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import {
  authLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
} from '../middleware/rateLimiters.js';
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  deleteAccountSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validators/schemas.js';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), ctrl.register);
router.post('/login', authLimiter, validate(loginSchema), ctrl.login);

// Recuperacion de contrasena. Sin sesion por definicion: quien la usa es
// justamente quien no puede entrar.
router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  validate(forgotPasswordSchema),
  ctrl.forgotPassword
);
router.post(
  '/reset-password',
  resetPasswordLimiter,
  validate(resetPasswordSchema),
  ctrl.resetPassword
);

router.get('/me', protect, ctrl.me);
router.patch('/me', protect, validate(updateProfileSchema), ctrl.updateProfile);
router.patch('/me/password', protect, validate(changePasswordSchema), ctrl.changePassword);

// Baja de cuenta. Va con authLimiter porque pide contrasena: sin limite seria
// un sitio comodo para probar contrasenas contra una sesion ya abierta.
router.delete('/me', protect, authLimiter, validate(deleteAccountSchema), ctrl.deleteAccount);

export default router;
