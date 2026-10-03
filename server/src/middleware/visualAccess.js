import { hasVisualTemplateAccess } from '../services/visualAccess.service.js';
import ApiError from '../utils/ApiError.js';

export function requireVisualAccess(req, _res, next) {
  if (!hasVisualTemplateAccess(req.user?.agency)) {
    return next(ApiError.notFound('Las plantillas visuales todavía no están disponibles para esta agencia.'));
  }
  next();
}
