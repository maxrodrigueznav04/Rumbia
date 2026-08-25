import { Agency, User } from '../models/index.js';
import { subirLogo as subirLogoCloudinary } from '../services/logo.service.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

/** Selecciona solo lo que un agente cualquiera (no el dueno) puede ver de su agencia. */
const AGENCIA_PUBLICA = 'agencyName logoUrl contact owner createdAt';

/**
 * Crea una agencia y la deja como dueno de inmediato.
 *
 * Un agente solo puede estar en una agencia a la vez: si quiere crear otra,
 * primero tiene que salir de la que ya tiene (endpoint /salir).
 */
export const crearAgencia = asyncHandler(async (req, res) => {
  if (req.user.agency) {
    throw ApiError.conflict('Ya perteneces a una agencia. Sal de ella antes de crear otra.');
  }

  const { agencyName, contact } = req.body;
  const agencia = await Agency.create({ agencyName, contact, owner: req.user._id });

  req.user.agency = agencia._id;
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
  const agenciaVisible = esDueno
    ? agencia.toObject()
    : {
        _id: agencia._id,
        agencyName: agencia.agencyName,
        logoUrl: agencia.logoUrl,
        contact: agencia.contact,
        owner: agencia.owner,
      };

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

/** Solo el dueno edita nombre y contacto. */
export const actualizarAgencia = asyncHandler(async (req, res) => {
  const agencia = await agenciaComoDueno(req);
  const { agencyName, contact, logoUrl } = req.body;
  if (agencyName !== undefined) agencia.agencyName = agencyName;
  if (contact !== undefined) agencia.contact = contact;
  if (logoUrl !== undefined) agencia.logoUrl = logoUrl;
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

  req.user.agency = agencia._id;
  await req.user.save();

  res.json({
    success: true,
    message: `Te uniste a ${agencia.agencyName}.`,
    data: { agency: agencia, user: await usuarioConAgencia(req.user) },
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

  res.json({ success: true, message: 'Agente eliminado de la agencia.' });
});

/** Invalida el codigo anterior. Util si se compartio por error o ya no se quiere que circule. */
export const regenerarCodigo = asyncHandler(async (req, res) => {
  const agencia = await agenciaComoDueno(req);
  agencia.regenerarCodigo();
  await agencia.save();

  res.json({ success: true, message: 'Código regenerado.', data: { agency: agencia } });
});

/** Carga la agencia del usuario en sesion y revienta si no es el dueno. */
async function agenciaComoDueno(req) {
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
