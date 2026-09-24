import { Agency, User, AuditLog } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import stripeService from './stripe.service.js';
import { encolarPendienteBilling } from './billingQueue.service.js';

const DIAS_VIGENCIA_TRANSFERENCIA = 7;

/**
 * Solicita la transferencia de propiedad de la agencia a un miembro activo.
 * Reglas de negocio (P02):
 * - Solo el dueño actual puede solicitar la transferencia.
 * - Requiere confirmación con la contraseña actual del dueño.
 * - La agencia debe estar activa.
 * - El destinatario debe existir, no ser el dueño actual y pertenecer a la misma agencia.
 * - Solo se permite una solicitud vigente a la vez (vigencia: 7 días).
 * - Concurrencia: optimismo por version y atomicidad.
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

  if (agencia.status === 'archivada') {
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

  // Control de concurrencia optimista por versión y validación de transferencia existente
  const agenciaActualizada = await Agency.findOneAndUpdate(
    {
      _id: agencyId,
      owner: actor._id,
      version: agencia.version,
      $and: [
        { $or: [{ status: 'activa' }, { status: { $exists: false } }] },
        {
          $or: [
            { 'transferenciaPendiente.destinatario': { $exists: false } },
            { 'transferenciaPendiente.destinatario': null },
            { 'transferenciaPendiente.expiraEn': { $lte: ahora } },
          ],
        },
      ],
    },
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
    throw ApiError.conflict('Ya existe una solicitud de transferencia pendiente o la agencia cambió de estado concurrente.');
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
 * - El destinatario debe seguir siendo miembro activo de la agencia (revalidado en DB).
 * - La transferencia cambia `owner`, pero conserva intacta la autoría histórica (`user`)
 *   y la pertenencia (`agency`) de todos los viajes, itinerarios y gastos.
 * - Facturación: el pagador anterior se disocia a historialPagadores, no renueva,
 *   y el nuevo dueño no hereda acceso al Customer Portal ni métodos de pago del anterior.
 * - El dueño anterior pasa a ser un miembro normal sin privilegios exclusivos de dueño.
 */
export async function aceptarTransferencia({ agencyId, actor }) {
  const ahora = new Date();

  const agencia = await Agency.findById(agencyId);
  if (!agencia) throw ApiError.notFound('Agencia no encontrada.');

  if (agencia.status === 'archivada') {
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

  // Revalidar que el destinatario siga perteneciendo a la agencia (previene carreras con expulsión)
  const miembroActivo = await User.findOne({ _id: actor._id, agency: agencyId });
  if (!miembroActivo) {
    throw ApiError.forbidden('Ya no perteneces a esta agencia.');
  }

  const antiguoDueno = await User.findById(agencia.owner);

  // Detener la renovación del acuerdo anterior en Stripe (P02)
  if (agencia.billing?.stripeSubscriptionId) {
    const resRenovacion = await stripeService.detenerRenovacion({ agencia });
    if (!resRenovacion.ok) {
      await encolarPendienteBilling({
        agencyId,
        tipo: 'detener_renovacion',
        datos: {
          stripeSubscriptionId: agencia.billing.stripeSubscriptionId,
          stripeCustomerId: agencia.billing.stripeCustomerId,
        },
        actor: actor._id,
      });
    }
  }

  const pagadorAnterior = {
    stripeCustomerId: agencia.billing?.stripeCustomerId || '',
    stripeSubscriptionId: agencia.billing?.stripeSubscriptionId || '',
    transferidoEn: ahora,
    desasociadoPor: actor._id,
  };

  const agenciaActualizada = await Agency.findOneAndUpdate(
    {
      _id: agencyId,
      $or: [{ status: 'activa' }, { status: { $exists: false } }],
      version: agencia.version,
      'transferenciaPendiente.destinatario': actor._id,
      'transferenciaPendiente.expiraEn': { $gt: ahora },
    },
    {
      $set: {
        owner: actor._id,
        transferenciaPendiente: null,
        'billing.stripeCustomerId': '',
        'billing.stripeSubscriptionId': '',
        'billing.checkoutSessionId': '',
        'billing.cancelaAlFinalizarPeriodo': true,
      },
      $push: {
        'billing.historialPagadores': pagadorAnterior,
      },
      $inc: { version: 1 },
    },
    { new: true }
  );

  if (!agenciaActualizada) {
    throw ApiError.conflict('La transferencia ya fue procesada, expiró o la agencia cambió de estado concurrente.');
  }

  await AuditLog.registrar({
    agency: agencyId,
    actor,
    accion: 'agencia.transferencia_aceptada',
    detalle: `Aceptó la propiedad de la agencia transferida por ${antiguoDueno?.name || 'dueño anterior'} (${antiguoDueno?.email || 'N/A'}). Pagador anterior desasociado.`,
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
    {
      _id: agencyId,
      owner: actor._id,
      version: agencia.version,
      'transferenciaPendiente.destinatario': { $ne: null },
    },
    {
      $set: { transferenciaPendiente: null },
      $inc: { version: 1 },
    },
    { new: true }
  );

  if (!agenciaActualizada) {
    throw ApiError.conflict('La solicitud de transferencia ya cambió de estado.');
  }

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
    {
      _id: agencyId,
      version: agencia.version,
      'transferenciaPendiente.destinatario': actor._id,
    },
    {
      $set: { transferenciaPendiente: null },
      $inc: { version: 1 },
    },
    { new: true }
  );

  if (!agenciaActualizada) {
    throw ApiError.conflict('La solicitud de transferencia ya cambió de estado.');
  }

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
 * - Facturación: cancela suscripción activa en Stripe o encola reintento si falla; expira checkout abierto.
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

  // Cancelar suscripción activa en Stripe (P02)
  if (agencia.billing?.stripeSubscriptionId) {
    const resCancel = await stripeService.cancelarSuscripcion({ agencia });
    if (!resCancel.ok) {
      await encolarPendienteBilling({
        agencyId,
        tipo: 'cancelar_suscripcion',
        datos: {
          stripeSubscriptionId: agencia.billing.stripeSubscriptionId,
          stripeCustomerId: agencia.billing.stripeCustomerId,
        },
        actor: actor._id,
      });
    }
  }

  // Expirar checkout abierto si existe (P02)
  if (agencia.billing?.checkoutSessionId) {
    const resExp = await stripeService.expirarSesionCheckout(agencia.billing.checkoutSessionId);
    if (!resExp.ok) {
      await encolarPendienteBilling({
        agencyId,
        tipo: 'expirar_checkout',
        datos: {
          checkoutSessionId: agencia.billing.checkoutSessionId,
        },
        actor: actor._id,
      });
    }
  }

  // Actualización atómica del estado a archivada con control de versión
  const agenciaActualizada = await Agency.findOneAndUpdate(
    {
      _id: agencyId,
      owner: actor._id,
      status: { $ne: 'archivada' },
      version: agencia.version,
    },
    {
      $set: {
        status: 'archivada',
        archivedAt: ahora,
        archivedBy: actor._id,
        transferenciaPendiente: null,
        'billing.checkoutSessionId': '',
      },
      $inc: { version: 1 },
    },
    { new: true }
  );

  if (!agenciaActualizada) {
    throw ApiError.conflict('La agencia ya fue archivada o cambió de estado concurrentemente.');
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
