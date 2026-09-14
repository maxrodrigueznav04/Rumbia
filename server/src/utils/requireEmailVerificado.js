import ApiError from './ApiError.js';
import { esAdmin } from './esAdmin.js';

/**
 * Exige correo verificado antes de dejar hacer algo que cuesta dinero real
 * (generar con IA) o que un correo desechable puede abusar en cadena (crear
 * una agencia y su trial gratis de 14 dias). El registro activaba la cuenta
 * sin confirmar el correo -- sin este candado, alguien podia registrar
 * cuentas o agencias en cadena con correos de un solo uso para multiplicar
 * cupo gratis (hallazgo S4 de la auditoria de lanzamiento).
 *
 * ADMIN_EMAIL nunca lo topa (mismo criterio que el resto de los limites de
 * uso). Las cuentas de antes de que este campo existiera tampoco: nacen con
 * `emailVerified: true` por default (ver User.js) -- este candado es solo
 * para cuentas NUEVAS de aqui en adelante, no una sorpresa retroactiva para
 * quien ya estaba usando o pagando Rumbia.
 */
export function requireEmailVerificado(user) {
  if (esAdmin(user) || user.emailVerified) return;
  throw ApiError.forbidden(
    'Verifica tu correo antes de continuar: revisa tu bandeja de entrada (o spam) y pulsa el enlace que te mandamos al crear tu cuenta.'
  );
}

export default requireEmailVerificado;
