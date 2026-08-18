/** Error con status HTTP; el errorHandler lo convierte en respuesta JSON. */
export default class ApiError extends Error {
  constructor(statusCode, message, details = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(msg = 'Petición inválida.', details) { return new ApiError(400, msg, details); }
  static unauthorized(msg = 'No autenticado.') { return new ApiError(401, msg); }
  static forbidden(msg = 'No tienes permiso sobre este recurso.') { return new ApiError(403, msg); }
  static notFound(msg = 'Recurso no encontrado.') { return new ApiError(404, msg); }
  static conflict(msg = 'Conflicto con el estado actual.') { return new ApiError(409, msg); }
  static tooMany(msg = 'Demasiadas peticiones.') { return new ApiError(429, msg); }
  static serviceUnavailable(msg = 'Servicio externo no disponible.', details) {
    return new ApiError(503, msg, details);
  }
}
