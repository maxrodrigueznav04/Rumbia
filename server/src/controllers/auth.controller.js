import User from '../models/User.js';
import Trip from '../models/Trip.js';
import Itinerary from '../models/Itinerary.js';
import Expense from '../models/Expense.js';
import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { signToken } from '../middleware/auth.js';

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
