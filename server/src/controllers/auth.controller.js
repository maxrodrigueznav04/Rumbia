import User from '../models/User.js';
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
  const { name, avatarUrl, preferences } = req.body;
  const user = req.user;

  if (name !== undefined) user.name = name;
  if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
  if (preferences) {
    // Merge parcial: no borra las preferencias que no vinieron en el body.
    user.preferences = { ...user.preferences.toObject(), ...preferences };
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
