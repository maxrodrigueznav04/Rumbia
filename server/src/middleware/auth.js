import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import User from '../models/User.js';

// Explicito a proposito: sin esto, jwt.verify acepta cualquier algoritmo que
// declare el propio token (jsonwebtoken elige como verificar segun el "alg"
// del header). Fijarlo a HS256 cierra la puerta a un cambio futuro que meta
// una key asimetrica sin tocar aqui, que abriria confusion de algoritmos.
const JWT_ALGORITHM = 'HS256';

export function signToken(userId) {
  return jwt.sign({ sub: String(userId) }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
    algorithm: JWT_ALGORITHM,
  });
}

/** Exige un Bearer token valido y cuelga req.user. */
export const protect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

  if (!token) throw ApiError.unauthorized('Falta el token de acceso.');

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret, { algorithms: [JWT_ALGORITHM] });
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'Tu sesión expiró, inicia sesión de nuevo.' : 'Token inválido.';
    throw ApiError.unauthorized(msg);
  }

  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('El usuario del token ya no existe.');

  // Un JWT no se puede revocar, asi que se compara cuando se emitio contra
  // cuando se cambio la contrasena. Es lo que hace que restablecer sirva de
  // algo cuando alguien mas ya habia entrado: su sesion deja de valer.
  if (user.tokenAnteriorAlCambio(payload.iat)) {
    throw ApiError.unauthorized('Tu contraseña cambió. Inicia sesión de nuevo.');
  }

  req.user = user;
  return next();
});

export default protect;
