import crypto from 'node:crypto';
import User from '../models/User.js';
import Trip from '../models/Trip.js';
import Itinerary from '../models/Itinerary.js';
import Expense from '../models/Expense.js';
import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { signToken } from '../middleware/auth.js';
import { enviarCorreo, correoRecuperacion } from '../services/email.service.js';

/** Cuanto vive un enlace de recuperacion. Corto a proposito: es una llave. */
const RESET_MINUTOS = 30;

/** Lo que se guarda en la base es esto, nunca el token que viaja en el correo. */
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const exists = await User.findOne({ email });
  if (exists) throw ApiError.conflict('Ese email ya está registrado.');

  const user = await User.create({ name, email, password });

  res.status(201).json({
    success: true,
    message: 'Cuenta creada.',
    data: { user: user.toJSON(), token: signToken(user._id) },
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // El password tiene select:false, hay que pedirlo explicitamente.
  const user = await User.findOne({ email }).select('+password');

  // Mismo mensaje para email inexistente y password malo: no revela que emails existen.
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Email o contraseña incorrectos.');
  }

  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  res.json({
    success: true,
    message: 'Sesión iniciada.',
    data: { user: user.toJSON(), token: signToken(user._id) },
  });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { user: req.user.toJSON() } });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const { name, avatarUrl, preferences, branding } = req.body;
  const user = req.user;

  if (name !== undefined) user.name = name;
  if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
  if (preferences) {
    // Merge parcial: no borra las preferencias que no vinieron en el body.
    user.preferences = { ...user.preferences.toObject(), ...preferences };
  }
  if (branding) {
    // Mismo merge parcial. El ?. cubre a los usuarios creados antes de que
    // existiera el campo, que lo traen undefined hasta que se guardan.
    user.branding = { ...(user.branding?.toObject?.() || {}), ...branding };
  }

  await user.save();
  res.json({ success: true, message: 'Perfil actualizado.', data: { user: user.toJSON() } });
});

/**
 * Paso 1: pedir el enlace de recuperacion.
 *
 * Responde exactamente lo mismo exista o no la cuenta, y salga o no el correo.
 * Si respondiera distinto, cualquiera podria averiguar que direcciones estan
 * registradas probandolas una por una; y ese listado es justo lo que se vende
 * para hacer phishing dirigido.
 */
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const respuesta = {
    success: true,
    message: 'Si esa dirección tiene una cuenta, te enviamos un enlace para recuperarla.',
  };

  const user = await User.findOne({ email });

  // La cuenta demo esta publicada en el README con su contrasena. No se le
  // manda nada: su buzon no es de nadie y no tiene sentido dejar que alguien
  // intente apoderarse de la demo del portafolio.
  if (!user || user.email === env.demoEmail) return res.json(respuesta);

  const token = crypto.randomBytes(32).toString('hex');
  user.resetTokenHash = hashToken(token);
  user.resetTokenExpires = new Date(Date.now() + RESET_MINUTOS * 60 * 1000);
  await user.save({ validateBeforeSave: false });

  const enlace = `${env.clientUrl}/restablecer/${token}`;
  const { asunto, html, texto } = correoRecuperacion({
    nombre: user.name,
    enlace,
    minutos: RESET_MINUTOS,
  });

  const salio = await enviarCorreo({ para: user.email, asunto, html, texto });

  // En local casi nunca hay clave de correo configurada, y sin esto no habria
  // forma de probar el flujo entero. En produccion NO se imprime: el enlace es
  // una credencial y los logs de Render los ve cualquiera con acceso al panel.
  if (!salio && !env.isProd) {
    console.log(`
[correo] Enlace de recuperación para ${user.email}:
  ${enlace}
`);
  }

  return res.json(respuesta);
});

/**
 * Paso 2: fijar la contrasena nueva con el token del correo.
 *
 * El token es de un solo uso y se borra al gastarlo. Al guardar, el hook del
 * modelo sella passwordChangedAt, y eso tumba cualquier sesion anterior.
 */
export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  const user = await User.findOne({
    resetTokenHash: hashToken(token),
    resetTokenExpires: { $gt: new Date() },
  }).select('+resetTokenHash +resetTokenExpires');

  // Un solo mensaje para "no existe", "ya se uso" y "caduco": los tres se
  // arreglan igual, pidiendo otro enlace.
  if (!user) {
    throw ApiError.badRequest(
      'Este enlace ya no sirve. Pide uno nuevo y ábrelo antes de que caduque.'
    );
  }

  user.password = password;
  user.resetTokenHash = undefined;
  user.resetTokenExpires = undefined;
  await user.save();

  res.json({
    success: true,
    message: 'Contraseña actualizada.',
    data: { user: user.toJSON(), token: signToken(user._id) },
  });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(currentPassword))) {
    throw ApiError.unauthorized('La contraseña actual no es correcta.');
  }

  user.password = newPassword; // el hook pre-save la hashea
  await user.save();

  res.json({ success: true, message: 'Contraseña actualizada.', data: { token: signToken(user._id) } });
});

/**
 * Baja de cuenta. Es el derecho de cancelación de la LFPDPPP, y la política de
 * privacidad lo promete, así que borra de verdad: no marca la cuenta como
 * inactiva ni la conserva "por si acaso".
 *
 * Pide la contraseña aunque ya haya sesión: un token robado o una sesión
 * abierta en un equipo ajeno no deberían bastar para borrarlo todo.
 */
export const deleteAccount = asyncHandler(async (req, res) => {
  const { password } = req.body;

  const user = await User.findById(req.user._id).select('+password');
  if (!user) throw ApiError.notFound('La cuenta ya no existe.');

  if (!(await user.comparePassword(password))) {
    throw ApiError.unauthorized('La contraseña no es correcta.');
  }

  // La cuenta demo esta publicada en el README: si un reclutador la borrara,
  // se llevaria la demo entera por delante.
  if (user.email === env.demoEmail) {
    throw ApiError.forbidden(
      'La cuenta de demostración no se puede eliminar: la usan otras personas para probar la app.'
    );
  }

  // Sin transacciones (no damos por hecho el replica set): primero los hijos,
  // para que un fallo a media operacion no deje viajes sin dueno.
  const viajes = await Trip.find({ user: user._id }).select('_id');
  const idsViajes = viajes.map((v) => v._id);

  await Itinerary.deleteMany({ user: user._id });
  await Expense.deleteMany({ user: user._id });
  await Trip.deleteMany({ _id: { $in: idsViajes } });
  await user.deleteOne();

  res.json({
    success: true,
    message: 'Tu cuenta y todos tus viajes se eliminaron.',
    data: { viajesEliminados: idsViajes.length },
  });
});
