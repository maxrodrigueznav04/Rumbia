import { ClickSalida, AuditLog } from '../models/index.js';
import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * Reporte de clics de salida.
 *
 * Cerrado a ADMIN_EMAIL. No hay concepto de rol en la app, y estos numeros son
 * del negocio, no de cada usuario: sin la variable puesta no lo ve nadie.
 */
export const reporteClicks = asyncHandler(async (req, res) => {
  if (!env.adminEmail || req.user.email !== env.adminEmail) {
    throw ApiError.forbidden('Este reporte no esta disponible para tu cuenta.');
  }

  const dias = Math.min(Math.max(Number(req.query.dias) || 30, 1), 180);
  const desde = new Date(Date.now() - dias * 86400000);
  const enRango = { createdAt: { $gte: desde } };

  const [porProveedor, porSeccion, porOrigen, porDestino, total] = await Promise.all([
    ClickSalida.aggregate([
      { $match: enRango },
      {
        $group: {
          _id: '$provider',
          clicks: { $sum: 1 },
          afiliado: { $sum: { $cond: ['$esAfiliado', 1, 0] } },
        },
      },
      { $sort: { clicks: -1 } },
    ]),
    ClickSalida.aggregate([
      { $match: enRango },
      { $group: { _id: '$section', clicks: { $sum: 1 } } },
      { $sort: { clicks: -1 } },
    ]),
    ClickSalida.aggregate([
      { $match: enRango },
      { $group: { _id: '$origen', clicks: { $sum: 1 } } },
      { $sort: { clicks: -1 } },
    ]),
    ClickSalida.aggregate([
      { $match: { ...enRango, destination: { $nin: [null, ''] } } },
      { $group: { _id: '$destination', clicks: { $sum: 1 } } },
      { $sort: { clicks: -1 } },
      { $limit: 15 },
    ]),
    ClickSalida.countDocuments(enRango),
  ]);

  const limpiar = (filas) => filas.map((f) => ({ nombre: f._id || 'sin dato', ...f, _id: undefined }));

  res.json({
    success: true,
    data: {
      dias,
      total,
      porProveedor: limpiar(porProveedor),
      porSeccion: limpiar(porSeccion),
      porOrigen: limpiar(porOrigen),
      porDestino: limpiar(porDestino),
    },
  });
});

/**
 * Registro de auditoria de TODAS las agencias, no solo la propia -- a
 * diferencia de GET /api/agency/auditoria (que un dueno usa para la suya).
 * Sirve ademas para revisar el evento "agencia.eliminada": una vez borrada
 * la agencia, su dueno ya no tiene forma de pedir su propio registro, pero
 * el evento sigue vivo aqui hasta que cumple su año de retencion.
 */
export const reporteAuditoria = asyncHandler(async (req, res) => {
  if (!env.adminEmail || req.user.email !== env.adminEmail) {
    throw ApiError.forbidden('Este reporte no esta disponible para tu cuenta.');
  }

  const eventos = await AuditLog.find({})
    .sort({ createdAt: -1 })
    .limit(200)
    .populate('agency', 'agencyName')
    .lean();

  res.json({ success: true, data: { eventos } });
});
