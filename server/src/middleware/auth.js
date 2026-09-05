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

// Nombre de la cookie httpOnly donde vive el JWT. El cliente nunca lee su
// contenido -- solo manda credentials:'include' para que el navegador la
// adjunte solo; ese es el punto entero de httpOnly.
const COOKIE_NAME = 'rumbia_token';
// Debe coincidir con JWT_EXPIRES_IN (7d por defecto): si se cambia uno, hay
// que cambiar el otro. No se derivan del mismo valor porque jsonwebtoken
// acepta strings tipo "7d" y res.cookie() necesita milisegundos -- parsear
// ese formato generico para un solo lugar que lo usa no vale la pena.
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Opciones de la cookie. secure:false en local a proposito -- ahi todo corre
 * sobre HTTP plano (o el navegador nunca la guardaria), y el proxy de Vite
 * hace que cliente y API parezcan el mismo origen de todas formas. Sin
 * "domain" explicito: la cookie queda host-only para api.rumbiamx.com, que
 * es el unico host al que el cliente le manda peticiones -- no hace falta
 * compartirla con rumbiamx.com, que solo sirve archivos estaticos.
 */
function opcionesCookie() {
  return {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax',
    path: '/',
  };
}

export function signToken(userId) {
  return jwt.sign({ sub: String(userId) }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
    algorithm: JWT_ALGORITHM,
  });
}

/**
 * Firma el token y lo deja en una cookie httpOnly -- invisible para
 * JavaScript, incluido un script inyectado por XSS, a diferencia de
 * localStorage. Devuelve el token igual: mientras el cliente viejo (el que
 * todavia guarda el token a mano y lo manda por header) siga desplegado en
 * el navegador de alguien, seguir mandandolo en el body evita que se le
 * corte la sesion a media migracion.
 */
export function setAuthCookie(res, userId) {
  const token = signToken(userId);
  res.cookie(COOKIE_NAME, token, { ...opcionesCookie(), maxAge: COOKIE_MAX_AGE_MS });
  return token;
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, opcionesCookie());
}

/**
 * Exige un token valido y cuelga req.user. Lee la cookie httpOnly
 * (`rumbia_token`), que es lo unico que el cliente actual manda: nunca lee
 * ni maneja el JWT a mano, solo `credentials:'include'` para que el
 * navegador la adjunte solo. El respaldo por header "Authorization: Bearer"
 * y el campo "token" en el JSON de register/login/etc. ya se quitaron -- el
 * cliente nunca los uso (es una SPA que siempre corre el build mas reciente,
 * no hay clientes de terceros ni versiones viejas circulando).
 */
export const protect = asyncHandler(async (req, _res, next) => {
  const token = req.cookies?.[COOKIE_NAME];

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

  // Una pestaña antigua nunca debe operar con la cookie de otra cuenta.
  const expectedUser = req.get('X-Rumbia-User');
  if (expectedUser && expectedUser !== String(user._id)) {
    throw new ApiError(409, 'La cuenta activa cambió. Actualiza la sesión antes de continuar.');
  }

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
