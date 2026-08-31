import env from '../config/env.js';

/**
 * Cuenta sin topes de uso, atada a ADMIN_EMAIL (la misma variable que ya
 * usaba el reporte de clics).
 *
 * A proposito NO salta ningun control de pertenencia: sigue sin poder ver o
 * editar viajes, gastos o agencias que no sean suyos — findOwnedTrip,
 * agenciaComoDueno y demas ni se enteran de esto. Lo unico que evita son
 * limites de uso (cupo de generaciones con IA, candado de facturacion
 * congelada): cosas que cuestan dinero o cupo, no permisos sobre datos
 * ajenos.
 */
export function esAdmin(user) {
  return Boolean(env.adminEmail) && user?.email === env.adminEmail;
}

export default esAdmin;
