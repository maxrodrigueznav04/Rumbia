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
 * IA sin cuenta. Se limita por IP y con mano mucho mas dura que a los usuarios
 * registrados: es un endpoint abierto que gasta cuota de Gemini, y sin freno
 * cualquiera podria vaciarla en una tarde.
 */
export const publicAiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true,
  message: jsonMessage(
    'Ya probaste el generador varias veces. Crea una cuenta gratis para seguir generando itinerarios.'
  ),
});

/**
 * Generacion con Gemini para usuarios con sesion: se limita POR USUARIO (no por
 * IP) porque la cuota de la API key es lo que se protege, y varios usuarios
 * pueden compartir IP.
 */
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: env.aiRateLimitPerHour,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user?._id || req.ip),
  // Lo que se protege es la cuota de Gemini, y una generación que falló no la
  // consumió. Sin esto, una racha de errores (una API key mal configurada, por
  // ejemplo) deja al usuario sin intentos justo cuando el problema se arregla.
  skipFailedRequests: true,
  message: jsonMessage(
    `Límite de generaciones con IA alcanzado (${env.aiRateLimitPerHour} por hora). Intenta más tarde.`
  ),
});
