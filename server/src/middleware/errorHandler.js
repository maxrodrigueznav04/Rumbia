import mongoose from 'mongoose';
import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import { reportarError } from '../config/sentry.js';
import { traducirMensaje } from '../i18n/mensajes.js';

export function notFound(req, _res, next) {
  next(ApiError.notFound(`Ruta no encontrada: ${req.method} ${req.originalUrl}`));
}

/* eslint-disable-next-line no-unused-vars */
export function errorHandler(err, req, res, _next) {
  const idioma = req.idioma || 'es';
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Error interno del servidor.';
  let details = err.details;

  // Errores de validacion de Mongoose -> 400 con lista de campos.
  if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    message = 'Datos inválidos.';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  }

  // CastError: un ObjectId mal formado no es un 500.
  if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = `Identificador inválido para el campo "${err.path}".`;
  }

  // Indice unico duplicado (email registrado).
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'campo';
    message = field === 'email' ? 'Ese email ya está registrado.' : `Valor duplicado en "${field}".`;
  }

  // Los fallos de servicios externos (503) son esperados y ya vienen con un
  // mensaje util: una linea basta. El stack completo se reserva para los bugs.
  if (statusCode >= 500) {
    if (err.isOperational) console.warn(`[aviso] ${statusCode} ${message}`);
    else {
      console.error('[error]', err);
      // Mismo criterio que el console.error: solo bugs de verdad, nunca los
      // 503 esperados de un servicio externo caido (esos ya se resuelven
      // solos y no hace falta que nadie los revise a mano).
      reportarError(err);
    }
  }

  message = traducirMensaje(message, idioma);
  if (Array.isArray(details)) {
    details = details.map((d) =>
      d && typeof d.message === 'string' ? { ...d, message: traducirMensaje(d.message, idioma) } : d
    );
  }

  res.status(statusCode).json({
    success: false,
    message,
    // Los detalles de un proveedor pueden contener fragmentos de respuestas
    // internas. En produccion solo son utiles para errores 4xx de validacion.
    ...(details && (!env.isProd || statusCode < 500) ? { details } : {}),
    ...(env.isProd ? {} : { stack: err.stack }),
  });
}

export default errorHandler;
