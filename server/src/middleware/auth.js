import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import User from '../models/User.js';

export function signToken(userId) {
  return jwt.sign({ sub: String(userId) }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

/** Exige un Bearer token valido y cuelga req.user. */
export const protect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

  if (!token) throw ApiError.unauthorized('Falta el token de acceso.');

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'Tu sesión expiró, inicia sesión de nuevo.' : 'Token inválido.';
    throw ApiError.unauthorized(msg);
  }

  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('El usuario del token ya no existe.');

  req.user = user;
  return next();
});

export default protect;
