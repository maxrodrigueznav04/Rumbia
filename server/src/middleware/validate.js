import ApiError from '../utils/ApiError.js';

/**
 * Valida req[source] contra un esquema de Zod y reemplaza el valor por el parseado
 * (asi los controladores reciben datos ya coercionados y sin campos extra).
 */
export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({
      field: i.path.join('.') || source,
      message: i.message,
    }));
    return next(ApiError.badRequest('Datos invalidos.', details));
  }
  if (source === 'query') {
    // req.query es solo-lectura en Express 5; se guarda aparte por compatibilidad.
    req.validatedQuery = result.data;
  } else {
    req[source] = result.data;
  }
  return next();
};

export default validate;
