import { Agency, User, AuditLog } from '../models/index.js';
import ApiError from '../utils/ApiError.js';

const DIAS_VIGENCIA_TRANSFERENCIA = 7;

/**
 * Solicita la transferencia de propiedad de la agencia a un miembro activo.
 * Reglas de negocio (P02):
 * - Solo el dueño actual puede solicitar la transferencia.
 * - Requiere confirmación con la contraseña actual del dueño.
 * - La agencia debe estar activa.
 * - El destinatario debe existir, no ser el dueño actual y pertenecer a la misma agencia.
 * - Solo se permite una solicitud vigente a la vez (vigencia: 7 días).
 */
export async function solicitarTransferencia({ agencyId, actor, destinatarioId, password }) {
  if (!actor || !actor.agency || String(actor.agency) !== String(agencyId)) {
    throw ApiError.forbidden('No perteneces a esta agencia.');
  }

  const user = await User.findById(actor._id).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('La contraseña no es correcta.');
  }

  const agencia = await Agency.findById(agencyId);
  if (!agencia) throw ApiError.notFound('Agencia no encontrada.');

  if (String(agencia.owner) !== String(actor._id)) {
    throw ApiError.forbidden('Solo el dueño de la agencia puede transferir la propiedad.');
  }

  if (agencia.status !== 'activa') {
    throw ApiError.badRequest('No se puede transferir una agencia archivada.');
  }

  if (String(destinatarioId) === String(actor._id)) {
    throw ApiError.badRequest('No puedes transferirte la agencia a ti mismo.');
  }

  const ahora = new Date();
  if (agencia.transferenciaPendiente?.expiraEn && agencia.transferenciaPendiente.expiraEn > ahora) {
    throw ApiError.conflict('Ya existe una solicitud de transferencia pendiente. Cancélala antes de emitir una nueva.');
  }

  const destinatario = await User.findById(destinatarioId);
  if (!destinatario || String(destinatario.agency) !== String(agencyId)) {
    throw ApiError.badRequest('El destinatario debe ser un miembro activo de esta agencia.');
  }

  const expiraEn = new Date(ahora.getTime() + DIAS_VIGENCIA_TRANSFERENCIA * 24 * 60 * 60 * 1000);

  const agenciaActualizada = await Agency.findOneAndUpdate(
    { _id: agencyId, owner: actor._id, status: 'activa' },
    {
      $set: {
        transferenciaPendiente: {
          destinatario: destinatario._id,
          solicitadoPor: actor._id,
          solicitadoEn: ahora,
          expiraEn,
        },
      },
      $inc: { version: 1 },
    },
    { new: true }
  );

  if (!agenciaActualizada) {
    throw ApiError.conflict('La agencia cambió de estado o ya no eres el dueño.');
  }

  await AuditLog.registrar({
    agency: agencyId,
    actor,
    accion: 'agencia.transferencia_solicitada',
    detalle: `Solicitó transferir la agencia a ${destinatario.name} (${destinatario.email}). Expira el ${expiraEn.toISOString()}.`,
  });

  return {
    transferencia: agenciaActualizada.transferenciaPendiente,
    version: agenciaActualizada.version,
  };
}

/**
 * Acepta una transferencia de propiedad de agencia.
 * Reglas de negocio (P02):
 * - Solo el destinatario especificado puede aceptar la transferencia.
 * - Requiere sesión activa del destinatario.
 * - La solicitud debe existir y no estar vencida.
 * - La agencia debe estar activa.
 * - El destinatario debe seguir siendo miembro activo de la agencia.
 * - La transferencia cambia `owner`, pero conserva intacta la autoría histórica (`user`)
 *   y la pertenencia (`agency`) de todos los viajes, itinerarios y gastos.
 * - El dueño anterior pasa a ser un miembro normal sin privilegios exclusivos de dueño.
 */
export async function aceptarTransferencia({ agencyId, actor }) {
  const ahora = new Date();

  const agencia = await Agency.findById(agencyId);
  if (!agencia) throw ApiError.notFound('Agencia no encontrada.');

  if (agencia.status !== 'activa') {
    throw ApiError.badRequest('La agencia no se encuentra activa.');
  }

  const transfer = agencia.transferenciaPendiente;
  if (!transfer || !transfer.destinatario) {
    throw ApiError.notFound('No hay ninguna solicitud de transferencia pendiente para esta agencia.');
  }

  if (String(transfer.destinatario) !== String(actor._id)) {
    throw ApiError.forbidden('Solo el usuario destinatario puede aceptar la transferencia.');
  }

  if (transfer.expiraEn <= ahora) {
    agencia.transferenciaPendiente = null;
    await agencia.save();
    throw ApiError.badRequest('La solicitud de transferencia ha expirado.');
  }

  if (!actor.agency || String(actor.agency) !== String(agencyId)) {
    throw ApiError.forbidden('Ya no perteneces a esta agencia.');
  }

  const antiguoDueno = await User.findById(agencia.owner);

  const agenciaActualizada = await Agency.findOneAndUpdate(
    {
      _id: agencyId,
      status: 'activa',
      'transferenciaPendiente.destinatario': actor._id,
      'transferenciaPendiente.expiraEn': { $gt: ahora },
    },
    {
      $set: {
        owner: actor._id,
        transferenciaPendiente: null,
      },
      $inc: { version: 1 },
    },
    { new: true }
  );

  if (!agenciaActualizada) {
    throw ApiError.conflict('La transferencia ya fue procesada, expiró o la agencia cambió de estado.');
  }

  await AuditLog.registrar({
    agency: agencyId,
    actor,
    accion: 'agencia.transferencia_aceptada',
    detalle: `Aceptó la propiedad de la agencia transferida por ${antiguoDueno?.name || 'dueño anterior'} (${antiguoDueno?.email || 'N/A'}).`,
  });

  return { agency: agenciaActualizada };
}

/**
 * Cancela una transferencia pendiente.
 * Solo puede ser cancelada por el dueño actual de la agencia.
 */
export async function cancelarTransferencia({ agencyId, actor }) {
  const agencia = await Agency.findById(agencyId);
  if (!agencia) throw ApiError.notFound('Agencia no encontrada.');

  if (String(agencia.owner) !== String(actor._id)) {
    throw ApiError.forbidden('Solo el dueño de la agencia puede cancelar la transferencia.');
  }

  if (!agencia.transferenciaPendiente?.destinatario) {
    throw ApiError.notFound('No hay ninguna solicitud de transferencia pendiente.');
  }

  const agenciaActualizada = await Agency.findOneAndUpdate(
    { _id: agencyId, owner: actor._id },
    {
      $set: { transferenciaPendiente: null },
      $inc: { version: 1 },
    },
    { new: true }
  );

  await AuditLog.registrar({
    agency: agencyId,
    actor,
    accion: 'agencia.transferencia_cancelada',
    detalle: 'Canceló la solicitud de transferencia pendiente.',
  });

  return { agency: agenciaActualizada };
}

/**
 * Rechaza una transferencia pendiente.
 * Solo puede ser rechazada por el destinatario de la solicitud.
 */
export async function rechazarTransferencia({ agencyId, actor }) {
  const agencia = await Agency.findById(agencyId);
  if (!agencia) throw ApiError.notFound('Agencia no encontrada.');

  const transfer = agencia.transferenciaPendiente;
  if (!transfer || !transfer.destinatario) {
    throw ApiError.notFound('No hay ninguna solicitud de transferencia pendiente.');
  }

  if (String(transfer.destinatario) !== String(actor._id)) {
    throw ApiError.forbidden('Solo el destinatario puede rechazar la transferencia.');
  }

  const agenciaActualizada = await Agency.findOneAndUpdate(
    { _id: agencyId, 'transferenciaPendiente.destinatario': actor._id },
    {
      $set: { transferenciaPendiente: null },
      $inc: { version: 1 },
    },
    { new: true }
  );

  await AuditLog.registrar({
    agency: agencyId,
    actor,
    accion: 'agencia.transferencia_rechazada',
    detalle: `Rechazó la solicitud de transferencia de la agencia.`,
  });

  return { agency: agenciaActualizada };
}

/**
 * Archiva la agencia.
 * Reglas de negocio (P02):
 * - Acción explícita y separada de la baja de cuenta.
 * - Solo el dueño actual puede archivar.
 * - Requiere confirmación con contraseña y palabra 'ARCHIVAR'.
 * - Conserva físicamente los documentos corporativos (viajes, gastos, plantillas, clientes).
 * - Conserva las membresías de los agentes restantes (en modo solo lectura / exportación).
 * - Suspende escrituras corporativas (status = 'archivada').
 * - Invalida invitaciones y transferencias pendientes.
 * - Invalida/revoca el acceso a enlaces públicos de propuestas de la agencia.
 */
export async function archivarAgencia({ agencyId, actor, password, confirmacion }) {
  if (confirmacion !== 'ARCHIVAR') {
    throw ApiError.badRequest('Debes confirmar escribiendo "ARCHIVAR".');
  }

  const user = await User.findById(actor._id).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('La contraseña no es correcta.');
  }

  const agencia = await Agency.findById(agencyId);
  if (!agencia) throw ApiError.notFound('Agencia no encontrada.');

  if (String(agencia.owner) !== String(actor._id)) {
    throw ApiError.forbidden('Solo el dueño puede archivar la agencia.');
  }

  if (agencia.status === 'archivada') {
    throw ApiError.badRequest('La agencia ya se encuentra archivada.');
  }

  const ahora = new Date();

  // Atomically update to archived status, clear pending transfers, regenerate invite code
  const agenciaActualizada = await Agency.findOneAndUpdate(
    { _id: agencyId, owner: actor._id, status: 'activa' },
    {
      $set: {
        status: 'archivada',
        archivedAt: ahora,
        archivedBy: actor._id,
        transferenciaPendiente: null,
      },
      $inc: { version: 1 },
    },
    { new: true }
  );

  if (!agenciaActualizada) {
    throw ApiError.conflict('La agencia ya fue archivada o cambió de dueño.');
  }

  agenciaActualizada.regenerarCodigo();
  await agenciaActualizada.save();

  await AuditLog.registrar({
    agency: agencyId,
    actor,
    accion: 'agencia.archivada',
    detalle: 'Archivó la agencia. Las operaciones corporativas de escritura quedan suspendidas.',
  });

  return { agency: agenciaActualizada };
}
