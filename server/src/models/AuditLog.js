import mongoose from 'mongoose';

/**
 * Registro de acciones sensibles de dueño de agencia y de la cuenta admin.
 *
 * Existe para responder "¿quién hizo qué, cuándo?" en las pocas acciones que
 * de verdad pueden afectar a otra persona sin que ella lo pida (sacarla de
 * la agencia) o que son difíciles de deshacer (regenerar el código invalida
 * el anterior; una agencia borrada no vuelve). Antes de esto, lo único que
 * quedaba era `updatedAt` en el propio documento, que no dice quién ni por
 * qué -- ver "Pendientes conocidos" en el README.
 *
 * Deliberadamente NO registra acciones de rutina (crear un viaje, editar el
 * perfil, unirse a una agencia sin saltarse nada): esto es un registro de
 * auditoría, no un log de actividad general, y llenarlo de ruido le resta
 * valor a lo que sí importa revisar.
 */
export const ACCIONES_AUDITORIA = [
  'agencia.miembro_eliminado',
  'agencia.codigo_regenerado',
  'agencia.eliminada',
  'agencia.union_admin',
  // cancelarSuscripcion (stripe.service.js) no bloquea el borrado si Stripe
  // falla -- a proposito, ver su comentario -- pero sin esto la unica huella
  // quedaba en console.error, que Render rota y se pierde. Con esto queda
  // consultable para reconciliar el cobro a mano en el dashboard de Stripe.
  'agencia.cancelacion_stripe_fallida',
  'agencia.transferencia_solicitada',
  'agencia.transferencia_aceptada',
  'agencia.transferencia_cancelada',
  'agencia.transferencia_rechazada',
  'agencia.archivada',
  'agencia.owner_eliminado',
  'agencia.owner_salio',
  'agencia.trabajo_billing_encolado',
  'agencia.trabajo_billing_completado',
  'agencia.trabajo_billing_fallido',
];

const auditLogSchema = new mongoose.Schema(
  {
    // Sin `required` a proposito: una agencia borrada (agencia.eliminada) no
    // puede dejar de tener este campo, pero tampoco tiene sentido forzar un
    // ref a un documento que el propio evento acaba de eliminar.
    agency: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency', index: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Copia del nombre/correo al momento del evento: si el actor despues
    // cambia de nombre, sale de la agencia o se borra la cuenta, el registro
    // sigue siendo legible sin depender de un populate que ya no resuelve.
    actorNombre: { type: String, trim: true, maxlength: 120, default: '' },
    actorEmail: { type: String, trim: true, maxlength: 160, default: '' },
    accion: { type: String, enum: ACCIONES_AUDITORIA, required: true },
    detalle: { type: String, trim: true, maxlength: 300, default: '' },
    // Un año es de sobra para revisar un incidente sin que la coleccion
    // crezca para siempre; estas acciones no son tan frecuentes como los
    // clics de salida (que se conservan solo 180 dias).
    createdAt: { type: Date, default: Date.now, expires: '365d' },
  },
  { versionKey: false }
);

auditLogSchema.index({ agency: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

/** Registra un evento sin arriesgar la operacion que lo disparo si algo falla. */
auditLogSchema.statics.registrar = async function registrar({ agency, actor, accion, detalle }) {
  try {
    await this.create({
      agency: agency || undefined,
      actor: actor._id,
      actorNombre: actor.name || '',
      actorEmail: actor.email || '',
      accion,
      detalle: detalle || '',
    });
  } catch (err) {
    // Un fallo al escribir la auditoria no debe tumbar la accion real (sacar
    // a un miembro, regenerar el codigo, etc.): se loguea y se sigue.
    console.error(`[auditoria] No se pudo registrar "${accion}": ${err.message}`);
  }
};

export default mongoose.model('AuditLog', auditLogSchema);
