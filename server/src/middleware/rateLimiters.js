import rateLimit from 'express-rate-limit';
import env from '../config/env.js';
import { createConcurrencyLimit } from './concurrencyLimit.js';

const jsonMessage = (message) => ({ success: false, message });

// Candado compartido por la muestra publica y las generaciones autenticadas.
// Protege una instancia pequena ante una rafaga aunque cada IP/usuario siga
// dentro de su propio rate limit.
export const heavyAiConcurrencyLimit = createConcurrencyLimit({
  maxActive: env.aiMaxConcurrent,
  maxQueue: env.aiMaxQueue,
  maxWaitMs: env.aiQueueWaitMs,
});

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
 * Pedir el enlace de recuperacion. Cada intento manda un correo de verdad, asi
 * que el limite protege la cuota del proveedor y, sobre todo, el buzon de la
 * persona: sin el, cualquiera podria llenarselo pulsando el boton en bucle.
 */
export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonMessage('Pediste el enlace demasiadas veces. Espera una hora e intenta de nuevo.'),
});

/**
 * Gastar el enlace. Va MUCHO mas suelto que pedirlo, y a proposito: aqui no se
 * manda ningun correo, y quien llega ya trae un token de 64 caracteres que no
 * se adivina. Compartir presupuesto con el de arriba dejaba a una persona
 * bloqueada una hora justo a media recuperacion, por pedir el enlace dos veces
 * y equivocarse otras dos con la contrasena nueva.
 */
export const resetPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonMessage('Demasiados intentos. Espera un rato e intenta de nuevo.'),
});

/**
 * Reenviar el correo de verificacion: manda un correo real, mismo espiritu
 * que forgotPasswordLimiter, pero por USUARIO (viene de una sesion ya
 * autenticada) en vez de por IP.
 */
export const resendVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user?._id || req.ip),
  message: jsonMessage('Pediste el correo de verificación demasiadas veces. Espera una hora e intenta de nuevo.'),
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

/**
 * Chat con el asistente de IA: mismo espiritu que aiLimiter (por usuario, no
 * por IP; un mensaje fallido no cuenta) pero con un tope mucho mas alto,
 * porque una conversacion normal manda muchos mensajes cortos en una sola
 * sesion en vez de una llamada pesada cada tanto.
 */
export const chatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: env.aiChatRateLimitPerHour,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user?._id || req.ip),
  skipFailedRequests: true,
  message: jsonMessage(
    `Límite de mensajes al chat alcanzado (${env.aiChatRateLimitPerHour} por hora). Intenta más tarde.`
  ),
});

/**
 * Unirse a una agencia con un codigo de invitacion: es adivinar un secreto
 * compartido, mismo espiritu que forgotPasswordLimiter/resetPasswordLimiter.
 * Por IP (sin keyGenerator propio) y no por usuario -- crear una cuenta
 * nueva es gratis, asi que limitar solo por usuario no frenaria a alguien
 * dispuesto a registrar varias para multiplicar los intentos.
 */
export const joinAgencyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonMessage('Demasiados intentos de unirte a una agencia. Espera una hora e intenta de nuevo.'),
});
