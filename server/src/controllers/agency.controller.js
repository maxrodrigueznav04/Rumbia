import { Agency, User, Trip, AuditLog, Client, ItineraryTemplate } from '../models/index.js';
import { subirLogo as subirLogoCloudinary, borrarLogo } from '../services/logo.service.js';
import { cancelarSuscripcion } from '../services/stripe.service.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { esAdmin } from '../utils/esAdmin.js';
import { requireEmailVerificado } from '../utils/requireEmailVerificado.js';

/**
 * Selecciona solo lo que un agente cualquiera (no el dueno) puede ver de su
 * agencia. "billing.plan" (no el resto de billing) va incluido a proposito:
 * es lo unico que necesita el virtual marcaBlanca para calcularse bien aqui
 * -- sin el, cualquier agente que no sea el dueno veria el pie de Rumbia en
 * su PDF aunque la agencia si tenga el plan que lo quita.
 */
const AGENCIA_PUBLICA = 'agencyName logoUrl contact colorAcento fuentePdf densidadPdf owner createdAt billing.plan';

/**
 * Recorta el documento de Agency a lo que puede ver un miembro que no es el
 * dueno: sin codigo de invitacion ni ids de Stripe, solo el estado del plan
 * (para saber por que no puede crear/editar, no los detalles de la
 * suscripcion). La usan tanto obtenerAgencia como unirseAgencia.
 */
function vistaAgenciaMiembro(agencia) {
  return {
    _id: agencia._id,
    agencyName: agencia.agencyName,
    logoUrl: agencia.logoUrl,
    contact: agencia.contact,
    colorAcento: agencia.colorAcento,
    fuentePdf: agencia.fuentePdf,
    densidadPdf: agencia.densidadPdf,
    marcaBlanca: agencia.marcaBlanca,
    owner: agencia.owner,
    billing: {
      status: agencia.billing?.status,
      trialHasta: agencia.billing?.trialHasta,
    },
  };
}

/**
 * Crea una agencia y la deja como dueno de inmediato.
 *
 * Un agente solo puede estar en una agencia a la vez: si quiere crear otra,
 * primero tiene que salir de la que ya tiene (endpoint /salir).
 */
export const crearAgencia = asyncHandler(async (req, res) => {
  // Crear una agencia da un trial de 7 dias con acceso completo, gratis: el
  // mismo abuso de correos desechables que se cierra al generar con IA (ver
  // requireEmailVerificado.js) aplica aqui, y con un premio mas grande.
  requireEmailVerificado(req.user);

  if (req.user.agency) {
    throw ApiError.conflict('Ya perteneces a una agencia. Sal de ella antes de crear otra.');
  }

  const { agencyName, contact } = req.body;
  // El trial de 7 dias es un beneficio por USUARIO, no por agencia: sin este
  // chequeo, salir de una agencia y crear otra daba un trial nuevo cada vez.
  // "pendiente" es el mismo bloqueo de escritura que "congelada"
  // (middleware/billing.js) -- solo cambia el texto que ve el dueno.
  const yaUsoTrial = req.user.trialAgenciaUsado;
  const agencia = await Agency.create({
    agencyName,
    contact,
    owner: req.user._id,
    ...(yaUsoTrial ? { billing: { status: 'pendiente', trialHasta: new Date(0) } } : {}),
  });

  req.user.agency = agencia._id;
  req.user.trialAgenciaUsado = true;
  await req.user.save();

  res.status(201).json({
    success: true,
    message: 'Agencia creada.',
    data: { agency: agencia, user: await usuarioConAgencia(req.user) },
  });
});

/**
 * Detalle de la agencia del usuario en sesion.
 *
 * El codigo de invitacion y la lista de miembros solo se mandan al dueno: es
 * quien decide quien mas puede sumar gente. Un miembro cualquiera ve la marca
 * (para saber que esta viendo) pero no puede invitar a nadie mas por su cuenta.
 */
export const obtenerAgencia = asyncHandler(async (req, res) => {
  if (!req.user.agency) throw ApiError.notFound('No perteneces a ninguna agencia.');

  const agencia = await Agency.findById(req.user.agency);
  if (!agencia) throw ApiError.notFound('No perteneces a ninguna agencia.');

  const esDueno = String(agencia.owner) === String(req.user._id);

  // Mongoose ya trajo el documento completo; se recorta a mano para no
  // filtrar el codigo a quien no deberia poder verlo.
  const agenciaVisible = esDueno ? agencia.toObject() : vistaAgenciaMiembro(agencia);

  let miembros = [];
  if (esDueno) {
    // Sin el propio dueno: la lista es "a quien mas puedo sacar", y el dueno
    // no se saca a si mismo desde aqui (para eso existe /salir).
    miembros = await User.find({ agency: agencia._id, _id: { $ne: agencia.owner } })
      .select('name email')
      .lean();
  }

  res.json({
    success: true,
    data: { agency: agenciaVisible, esDueno, miembros },
  });
});

/** Solo el dueno edita nombre, contacto y personalizacion del PDF. */
export const actualizarAgencia = asyncHandler(async (req, res) => {
  const agencia = await agenciaComoDueno(req);
  const { agencyName, contact, logoUrl, colorAcento, fuentePdf, densidadPdf } = req.body;
  if (agencyName !== undefined) agencia.agencyName = agencyName;
  if (contact !== undefined) agencia.contact = contact;
  if (logoUrl !== undefined) agencia.logoUrl = logoUrl;
  // No se valida marcaBlanca aqui a proposito: guardar estos campos en un
  // plan que no califica no hace nada malo, simplemente no se usan en
  // ningun lado (ver HojaImpresion.jsx) hasta que la agencia suba de plan.
  if (colorAcento !== undefined) agencia.colorAcento = colorAcento;
  if (fuentePdf !== undefined) agencia.fuentePdf = fuentePdf;
  if (densidadPdf !== undefined) agencia.densidadPdf = densidadPdf;
  await agencia.save();

  res.json({ success: true, message: 'Agencia actualizada.', data: { agency: agencia } });
});

/** Mismo servicio de Cloudinary que el logo personal, con su propio espacio de nombres. */
export const subirLogoAgencia = asyncHandler(async (req, res) => {
  const agencia = await agenciaComoDueno(req);

  const url = await subirLogoCloudinary({
    buffer: req.file.buffer,
    mimeType: req.file.mimetype,
    userId: `agencia-${agencia._id}`,
  });

  agencia.logoUrl = url;
  await agencia.save();

  res.json({ success: true, message: 'Logo actualizado.', data: { agency: agencia } });
});

/** Une al usuario en sesion a la agencia dueña del codigo. */
export const unirseAgencia = asyncHandler(async (req, res) => {
  if (req.user.agency) {
    throw ApiError.conflict('Ya perteneces a una agencia. Sal de ella antes de unirte a otra.');
  }

  const agencia = await Agency.findOne({ inviteCode: req.body.inviteCode });
  if (!agencia) throw ApiError.notFound('Ese código no corresponde a ninguna agencia.');

  // Un dueño solo, sin nadie más, no necesita plan (es uso personal con marca
  // de agencia). En cuanto alguien más se une, ya es el producto de pago: no
  // se deja sumar gente a una agencia sin un plan activo. La cuenta admin
  // (ADMIN_EMAIL) no tiene tope de cupo ni necesita plan activo para unirse.
  const esAdminUser = esAdmin(req.user);
  const sinPlanActivo = agencia.billing?.status !== 'activa';
  if (sinPlanActivo && !esAdminUser) {
    throw ApiError.forbidden(
      'Esta agencia todavía no tiene un plan activo. Pídele al dueño que lo active antes de unirte.'
    );
  }

  const cupo = agencia.capacidadAgentes;
  const miembrosActuales = await User.countDocuments({ agency: agencia._id });
  const sinCupo = miembrosActuales >= cupo;
  if (sinCupo && !esAdminUser) {
    throw ApiError.conflict(
      `Esta agencia ya llegó a su límite de ${cupo} agente(s). El dueño puede sumar más asientos desde su plan.`
    );
  }

  req.user.agency = agencia._id;
  await req.user.save();

  // Solo se registra cuando el bypass de admin de verdad importó: si la
  // agencia ya tenia plan y cupo de sobra, unirse como admin es igual que
  // unirse como cualquiera, y no hay nada que auditar.
  if (esAdminUser && (sinPlanActivo || sinCupo)) {
    const motivo = [sinPlanActivo && 'sin plan activo', sinCupo && `superando el cupo de ${cupo}`]
      .filter(Boolean)
      .join(' y ');
    await AuditLog.registrar({
      agency: agencia._id,
      actor: req.user,
      accion: 'agencia.union_admin',
      detalle: `Se unió a "${agencia.agencyName}" ${motivo}.`,
    });
  }

  res.json({
    success: true,
    message: `Te uniste a ${agencia.agencyName}.`,
    // Quien se une no es el dueno: mismo recorte que obtenerAgencia, sin
    // codigo de invitacion ni ids de Stripe.
    data: { agency: vistaAgenciaMiembro(agencia), user: await usuarioConAgencia(req.user) },
  });
});

/**
 * Sale de la agencia actual.
 *
 * El dueno no puede salir mientras queden otros agentes: haria huerfana la
 * agencia, sin nadie que pueda editarla ni sacar a los demas. Si el dueno sale
 * y ya no queda nadie mas, la agencia se borra sola en vez de quedar viva sin
 * dueno ocupando espacio en la base.
 */
export const salirAgencia = asyncHandler(async (req, res) => {
  if (!req.user.agency) throw ApiError.badRequest('No perteneces a ninguna agencia.');

  const agencia = await Agency.findById(req.user.agency);
  const esDueno = agencia && String(agencia.owner) === String(req.user._id);

  if (esDueno) {
    const otrosMiembros = await User.countDocuments({
      agency: agencia._id,
      _id: { $ne: req.user._id },
    });
    if (otrosMiembros > 0) {
      throw ApiError.conflict(
        'Eres el dueño y todavía hay otros agentes en la agencia. Sácalos primero, o pídeles que salgan ellos mismos.'
      );
    }
    // Antes de borrar: el registro necesita agencyName/agencia._id mientras
    // el documento todavia existe.
    await AuditLog.registrar({
      agency: agencia._id,
      actor: req.user,
      accion: 'agencia.eliminada',
      detalle: `"${agencia.agencyName}" se eliminó al salir el dueño sin más agentes.`,
    });
    // Antes de borrar: sin esto, Stripe le seguiria cobrando por una agencia
    // que ya no existe y a la que nadie puede volver a entrar para cancelar.
    await cancelarSuscripcion({ agencia });
    // El dueno esta solo (otrosMiembros === 0): todo lo que quede con este
    // agency._id lo creo el mismo, nunca un companero de equipo. Sin
    // borrarlo aqui, quedaba huerfano -- apuntando a una Agency que ya no
    // existe, invisible para siempre (nada en la app vuelve a consultar por
    // ese agencyId una vez borrado).
    await Client.deleteMany({ agency: agencia._id });
    await ItineraryTemplate.deleteMany({ agency: agencia._id });
    if (agencia.logoUrl) await borrarLogo(`agencia-${agencia._id}`);
    await Agency.deleteOne({ _id: agencia._id });
  }

  req.user.agency = null;
  await req.user.save();

  res.json({
    success: true,
    message: 'Saliste de la agencia.',
    data: { user: await usuarioConAgencia(req.user) },
  });
});

/** El dueno saca a otro agente. No puede sacarse a si mismo por aqui: para eso existe /salir. */
export const eliminarMiembro = asyncHandler(async (req, res) => {
  const agencia = await agenciaComoDueno(req);

  if (req.params.userId === String(req.user._id)) {
    throw ApiError.badRequest('No puedes eliminarte a ti mismo. Usa la opción de salir.');
  }

  const miembro = await User.findOne({ _id: req.params.userId, agency: agencia._id });
  if (!miembro) throw ApiError.notFound('Ese agente no pertenece a tu agencia.');

  miembro.agency = null;
  await miembro.save();

  await AuditLog.registrar({
    agency: agencia._id,
    actor: req.user,
    accion: 'agencia.miembro_eliminado',
    detalle: `Eliminó a ${miembro.name} (${miembro.email}) de la agencia.`,
  });

  res.json({ success: true, message: 'Agente eliminado de la agencia.' });
});

/** Invalida el codigo anterior. Util si se compartio por error o ya no se quiere que circule. */
export const regenerarCodigo = asyncHandler(async (req, res) => {
  const agencia = await agenciaComoDueno(req);
  agencia.regenerarCodigo();
  await agencia.save();

  await AuditLog.registrar({
    agency: agencia._id,
    actor: req.user,
    accion: 'agencia.codigo_regenerado',
  });

  res.json({ success: true, message: 'Código regenerado.', data: { agency: agencia } });
});

/**
 * Últimas acciones sensibles de la agencia (sacar agente, regenerar código).
 * Solo el dueno, mismo criterio que el reporte de productividad: es
 * informacion sobre el equipo, no algo que un agente cualquiera necesite ver.
 */
export const obtenerAuditoria = asyncHandler(async (req, res) => {
  const agencia = await agenciaComoDueno(req);

  const eventos = await AuditLog.find({ agency: agencia._id })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  res.json({ success: true, data: { eventos } });
});

/**
 * Reporte del mes en curso: cuantos viajes armo cada agente (dueno incluido).
 * Solo lo ve el dueno, igual que la lista de miembros — un agente cualquiera
 * no necesita saber que tanto produce el resto del equipo.
 */
export const obtenerReporte = asyncHandler(async (req, res) => {
  const agencia = await agenciaComoDueno(req);

  const miembros = await User.find({ agency: agencia._id }).select('name email').lean();
  const idsAgentes = miembros.map((m) => m._id);

  const inicioMes = new Date();
  inicioMes.setUTCDate(1);
  inicioMes.setUTCHours(0, 0, 0, 0);

  const conteos = await Trip.aggregate([
    { $match: { user: { $in: idsAgentes }, createdAt: { $gte: inicioMes } } },
    { $group: { _id: '$user', cantidad: { $sum: 1 } } },
  ]);

  const cantidadPorId = new Map(conteos.map((c) => [String(c._id), c.cantidad]));
  const porAgente = miembros
    .map((m) => ({ userId: m._id, name: m.name, cantidad: cantidadPorId.get(String(m._id)) || 0 }))
    .sort((a, b) => b.cantidad - a.cantidad);

  res.json({
    success: true,
    data: {
      mes: inicioMes.toISOString().slice(0, 7),
      totalMes: porAgente.reduce((sum, a) => sum + a.cantidad, 0),
      porAgente,
    },
  });
});

/** Carga la agencia del usuario en sesion y revienta si no es el dueno. */
export async function agenciaComoDueno(req) {
  if (!req.user.agency) throw ApiError.notFound('No perteneces a ninguna agencia.');
  const agencia = await Agency.findById(req.user.agency);
  if (!agencia) throw ApiError.notFound('No perteneces a ninguna agencia.');
  if (String(agencia.owner) !== String(req.user._id)) {
    throw ApiError.forbidden('Solo quien creó la agencia puede hacer esto.');
  }
  return agencia;
}

/**
 * Recarga al usuario con su agencia ya resuelta (solo los campos publicos, sin
 * el codigo de invitacion) para devolverla junto con el resto del perfil.
 */
async function usuarioConAgencia(user) {
  await user.populate({ path: 'agency', select: AGENCIA_PUBLICA });
  return user.toJSON();
}

export { usuarioConAgencia };
