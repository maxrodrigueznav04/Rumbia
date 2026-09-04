import { Client, Trip } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { escaparRegex } from './trip.controller.js';

/**
 * Resuelve el filtro de pertenencia: si el usuario pertenece a una agencia,
 * comparte la cartera de clientes con sus compañeros de equipo. Si no,
 * solo ve sus clientes propios.
 *
 * "agency: null" en el respaldo personal es a proposito: sin el, alguien que
 * registro un cliente mientras estaba en una agencia lo seguia viendo (via
 * "user: user._id") aunque ya hubiera salido de esa agencia -- ese cliente
 * es cartera del EQUIPO que dejo atras, no algo que se lleve consigo.
 */
function filtroPertenencia(user) {
  if (user.agency) {
    return { $or: [{ agency: user.agency }, { user: user._id, agency: null }] };
  }
  return { user: user._id, agency: null };
}

export const listarClientes = asyncHandler(async (req, res) => {
  const { q, etiqueta, page, limit } = req.validatedQuery;
  // $and de condiciones separadas, nunca reasignando una clave "$or" que ya
  // trae filtroPertenencia: hacer filter.$or = [...] aqui PISABA por
  // completo el $or de pertenencia en cuanto habia busqueda, y devolvia
  // clientes de CUALQUIER agencia que coincidieran con el texto buscado.
  const condiciones = [filtroPertenencia(req.user)];

  if (q) {
    const re = new RegExp(escaparRegex(q), 'i');
    condiciones.push({ $or: [{ nombre: re }, { email: re }, { telefono: re }] });
  }

  if (etiqueta) {
    condiciones.push({ etiquetas: etiqueta });
  }

  const filter = condiciones.length > 1 ? { $and: condiciones } : condiciones[0];

  const [clientes, total] = await Promise.all([
    Client.find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Client.countDocuments(filter),
  ]);

  // Contar viajes asociados a cada cliente devuelto
  const clientIds = clientes.map((c) => c._id);
  const conteos = await Trip.aggregate([
    { $match: { client: { $in: clientIds } } },
    { $group: { _id: '$client', totalViajes: { $sum: 1 } } },
  ]);

  const conteoMap = new Map(conteos.map((c) => [String(c._id), c.totalViajes]));
  const clientesConConteo = clientes.map((c) => ({
    ...c,
    viajesCount: conteoMap.get(String(c._id)) || 0,
  }));

  res.json({
    success: true,
    data: {
      clientes: clientesConConteo,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    },
  });
});

export const obtenerCliente = asyncHandler(async (req, res) => {
  const cliente = await Client.findOne({
    _id: req.params.id,
    ...filtroPertenencia(req.user),
  }).lean();

  if (!cliente) {
    throw ApiError.notFound('Cliente no encontrado.');
  }

  // Traer historial de viajes asociados
  const viajes = await Trip.find({ client: cliente._id })
    .select('title destination startDate endDate budget status coverImage')
    .sort({ startDate: -1 })
    .lean();

  res.json({
    success: true,
    data: {
      cliente,
      viajes,
    },
  });
});

export const crearCliente = asyncHandler(async (req, res) => {
  const payload = {
    ...req.body,
    user: req.user._id,
    agency: req.user.agency || null,
  };

  const cliente = await Client.create(payload);

  res.status(201).json({
    success: true,
    message: 'Cliente registrado exitosamente.',
    data: { cliente },
  });
});

export const actualizarCliente = asyncHandler(async (req, res) => {
  const cliente = await Client.findOne({
    _id: req.params.id,
    ...filtroPertenencia(req.user),
  });

  if (!cliente) {
    throw ApiError.notFound('Cliente no encontrado.');
  }

  const campos = ['nombre', 'email', 'telefono', 'notas', 'origen', 'etiquetas'];
  for (const campo of campos) {
    if (req.body[campo] !== undefined) {
      cliente[campo] = req.body[campo];
    }
  }

  await cliente.save();

  // Si cambiaron nombre o contacto, sincronizar viajes vinculados para mantener coherencia en PDFs
  if (req.body.nombre !== undefined || req.body.telefono !== undefined) {
    const update = {};
    if (req.body.nombre !== undefined) update['cliente.nombre'] = req.body.nombre;
    if (req.body.telefono !== undefined) update['cliente.contacto'] = req.body.telefono;
    await Trip.updateMany({ client: cliente._id }, { $set: update });
  }

  res.json({
    success: true,
    message: 'Cliente actualizado.',
    data: { cliente },
  });
});

export const eliminarCliente = asyncHandler(async (req, res) => {
  const cliente = await Client.findOne({
    _id: req.params.id,
    ...filtroPertenencia(req.user),
  });

  if (!cliente) {
    throw ApiError.notFound('Cliente no encontrado.');
  }

  await cliente.deleteOne();

  // Desvincular viajes sin borrarlos. cliente.nombre/contacto es una COPIA
  // embebida (para que el PDF no dependa de que el Client siga existiendo);
  // sin limpiarla tambien, un viaje viejo seguia mostrando el nombre y
  // telefono de un cliente que se acaba de borrar.
  await Trip.updateMany(
    { client: cliente._id },
    { $set: { client: null, 'cliente.nombre': '', 'cliente.contacto': '' } }
  );

  res.json({
    success: true,
    message: 'Cliente eliminado correctamente.',
  });
});
