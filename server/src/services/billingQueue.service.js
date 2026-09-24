import { PendingBillingJob, AuditLog } from '../models/index.js';
import stripeService from './stripe.service.js';

/**
 * Encola una operación externa de facturación para ejecución diferida o reintento.
 * Regla P02: Ningún fallo externo de Stripe puede dejar cancelaciones o renovaciones huérfanas.
 */
export async function encolarPendienteBilling({ agencyId, tipo, datos = {}, actor = null }) {
  const job = await PendingBillingJob.create({
    agency: agencyId,
    tipo,
    datos,
    status: 'pendiente',
    proximoIntentoEn: new Date(),
  });

  await AuditLog.registrar({
    agency: agencyId,
    actor: actor || agencyId,
    accion: 'agencia.trabajo_billing_encolado',
    detalle: `Encoló tarea de facturación pendiente: ${tipo} (${datos.stripeSubscriptionId || datos.checkoutSessionId || 'sin id'}).`,
  });

  return job;
}

/**
 * Procesa la cola de trabajos de facturación pendientes.
 * Se puede invocar periódicamente o desde un script operativo.
 */
export async function procesarPendientesBilling({ limite = 20 } = {}) {
  const ahora = new Date();
  const pendientes = await PendingBillingJob.find({
    status: 'pendiente',
    proximoIntentoEn: { $lte: ahora },
  })
    .sort({ proximoIntentoEn: 1 })
    .limit(limite);

  const resultados = {
    procesados: pendientes.length,
    completados: 0,
    fallidosReintentables: 0,
    fallidosDefinitivos: 0,
  };

  for (const job of pendientes) {
    try {
      if (job.tipo === 'cancelar_suscripcion') {
        const subId = job.datos?.stripeSubscriptionId;
        if (subId) {
          await stripeService.cancelarSuscripcionDirecto(subId);
        }
      } else if (job.tipo === 'detener_renovacion') {
        const subId = job.datos?.stripeSubscriptionId;
        if (subId) {
          await stripeService.detenerRenovacionDirecto(subId);
        }
      } else if (job.tipo === 'expirar_checkout') {
        const sessionId = job.datos?.checkoutSessionId;
        if (sessionId) {
          await stripeService.expirarSesionCheckout(sessionId);
        }
      }

      job.status = 'completado';
      await job.save();
      resultados.completados += 1;

      await AuditLog.registrar({
        agency: job.agency,
        actor: job.agency,
        accion: 'agencia.trabajo_billing_completado',
        detalle: `Trabajo de facturación completado con éxito: ${job.tipo}.`,
      });
    } catch (err) {
      job.intentos += 1;
      job.ultimoError = err.message || 'Error desconocido';

      if (job.intentos >= job.maxIntentos) {
        job.status = 'fallido_definitivo';
        resultados.fallidosDefinitivos += 1;

        await AuditLog.registrar({
          agency: job.agency,
          actor: job.agency,
          accion: 'agencia.trabajo_billing_fallido',
          detalle: `ALERTA: Trabajo de facturación falló definitivamente tras ${job.intentos} intentos: ${job.tipo}. Error: ${job.ultimoError}`,
        });
      } else {
        // Backoff exponencial: 1m, 2m, 4m, 8m...
        const minutosEspera = Math.pow(2, job.intentos);
        job.proximoIntentoEn = new Date(Date.now() + minutosEspera * 60 * 1000);
        resultados.fallidosReintentables += 1;
      }

      await job.save();
    }
  }

  return resultados;
}

export default {
  encolarPendienteBilling,
  procesarPendientesBilling,
};
