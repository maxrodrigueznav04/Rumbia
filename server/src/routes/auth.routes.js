import { Router } from 'express';
import * as ctrl from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import subirLogo from '../middleware/subirLogo.js';
import {
  authLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  resendVerificationLimiter,
} from '../middleware/rateLimiters.js';
import verificarCaptcha from '../middleware/turnstile.js';
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  deleteAccountSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '../validators/schemas.js';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), verificarCaptcha, ctrl.register);
router.post('/login', authLimiter, validate(loginSchema), ctrl.login);
// Sin protect ni limite: limpiar una cookie no es una accion sensible, y
// exigir sesion valida para cerrarla dejaria a alguien con un token vencido
// sin forma de limpiar la cookie del navegador.
router.post('/logout', ctrl.logout);

// Recuperacion de contrasena. Sin sesion por definicion: quien la usa es
// justamente quien no puede entrar. Lleva captcha porque cada intento manda
// un correo de verdad: sin el, un bot podria vaciar la cuota de Resend o
// llenarle el buzon a cualquiera con solo su email.
router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  validate(forgotPasswordSchema),
  verificarCaptcha,
  ctrl.forgotPassword
);
router.post(
  '/reset-password',
  resetPasswordLimiter,
  validate(resetPasswordSchema),
  ctrl.resetPassword
);

// Verificar correo: el token de 64 hex ya hace de limite (no se adivina), y
// no manda ningun correo -- mismo criterio que reset-password, no el mas
// estricto de forgot-password.
router.post('/verify-email', resetPasswordLimiter, validate(verifyEmailSchema), ctrl.verifyEmail);
// Reenviar si manda uno nuevo, asi que si necesita el limite estricto, por
// cuenta (viene de una sesion ya iniciada, sin cuenta no tiene sentido).
router.post('/resend-verification', protect, resendVerificationLimiter, ctrl.resendVerification);

router.get('/me', protect, ctrl.me);
router.patch('/me', protect, validate(updateProfileSchema), ctrl.updateProfile);
router.post('/me/logo', protect, subirLogo, ctrl.uploadLogo);
router.patch('/me/password', protect, validate(changePasswordSchema), ctrl.changePassword);

// Baja de cuenta. Va con authLimiter porque pide contrasena: sin limite seria
// un sitio comodo para probar contrasenas contra una sesion ya abierta.
router.delete('/me', protect, authLimiter, validate(deleteAccountSchema), ctrl.deleteAccount);

export default router;
