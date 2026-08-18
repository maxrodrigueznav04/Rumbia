import rateLimit from 'express-rate-limit';
import env from '../config/env.js';

const jsonMessage = (message) => ({ success: false, message });

/** Limite general de la API. */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonMessage('Demasiadas peticiones. Intenta de nuevo en unos minutos.'),
});

/** Login/registro: frena fuerza bruta. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: jsonMessage('Demasiados intentos de acceso. Espera 15 minutos.'),
});

/**
 * Generacion con Gemini: se limita POR USUARIO (no por IP) porque la cuota
 * de la API key es lo que se protege, y varios usuarios pueden compartir IP.
 */
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: env.aiRateLimitPerHour,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user?._id || req.ip),
  message: jsonMessage(
    `Límite de generaciones con IA alcanzado (${env.aiRateLimitPerHour} por hora). Intenta más tarde.`
  ),
});
