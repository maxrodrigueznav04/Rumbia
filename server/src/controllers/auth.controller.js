import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Trip from '../models/Trip.js';
import Itinerary from '../models/Itinerary.js';
import Expense from '../models/Expense.js';
import Agency from '../models/Agency.js';
import Client from '../models/Client.js';
import TripChat from '../models/TripChat.js';
import ItineraryTemplate from '../models/ItineraryTemplate.js';
import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { setAuthCookie, clearAuthCookie } from '../middleware/auth.js';
import { enviarCorreo, correoRecuperacion } from '../services/email.service.js';
import { subirLogo } from '../services/logo.service.js';
import stripeService from '../services/stripe.service.js';
import { usuarioConAgencia } from './agency.controller.js';

/** Cuanto vive un enlace de recuperacion. Corto a proposito: es una llave. */
const RESET_MINUTOS = 30;

// El rate-limit por IP (authLimiter) no frena un ataque distribuido en varias
// IPs contra un mismo correo. Este bloqueo es POR CUENTA, no por IP.
const MAX_INTENTOS_LOGIN = 6;
const BLOQUEO_LOGIN_MINUTOS = 15;

/** Lo que se guarda en la base es esto, nunca el token que viaja en el correo. */
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// Hash valido pero de nadie, con el mismo costo (12 rondas) que los de verdad.
// Cuando el email no existe, login igual corre un bcrypt.compare contra este
// en vez de saltarselo: si no, responder "no existe" tarda medible-mente menos
// que "password incorrecta", y ese tiempo delata que correos estan
// registrados aunque el mensaje de error sea identico.
const HASH_SENUELO = bcrypt.hashSync('nadie-tiene-esta-contrasena', 12);

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, perfilUso, referenciaContacto } = req.body;

  // Honeypot: un humano nunca llena este campo porque no lo ve. Se corta
  // antes de tocar la base, con el mismo tipo de error que vería alguien de
  // verdad, para no dejar pistas de que existe un señuelo.
  if (referenciaContacto) {
    console.warn(`[honeypot] registro bloqueado (ip=${req.ip})`);
    throw ApiError.badRequest('No pudimos crear la cuenta. Intenta de nuevo.');
  }

  const exists = await User.findOne({ email });
  if (exists) throw ApiError.conflict('Ese email ya está registrado.');

  const user = await User.create({
    name,
    email,
    password,
    ...(perfilUso ? { preferences: { perfilUso } } : {}),
  });

  res.status(201).json({
    success: true,
    message: 'Cuenta creada.',
    // "token" se mantiene en la respuesta solo por compatibilidad temporal
    // con el cliente anterior (que lo guardaba a mano): quitarlo en un PR
    // aparte una vez que nadie siga corriendo esa version. La cookie ya
    // quedo puesta por setAuthCookie, que es lo que usa el cliente actual.
    data: { user: await usuarioConAgencia(user), token: setAuthCookie(res, user._id) },
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // El password tiene select:false, hay que pedirlo explicitamente.
  const user = await User.findOne({ email }).select('+password +failedLoginAttempts +lockUntil');

  if (user?.lockUntil && user.lockUntil > new Date()) {
    const minutos = Math.ceil((user.lockUntil - Date.now()) / 60000);
    throw ApiError.unauthorized(
      `Demasiados intentos fallidos. Espera ${minutos} minuto(s) e intenta de nuevo.`
    );
  }

  // Siempre corre un bcrypt.compare, exista o no la cuenta: contra la de
  // verdad si existe, contra el señuelo si no. Así "no existe" y "password
  // incorrecta" tardan lo mismo (ver HASH_SENUELO arriba).
  const valido = user ? await user.comparePassword(password) : await bcrypt.compare(password, HASH_SENUELO);

  if (!valido) {
    if (user) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= MAX_INTENTOS_LOGIN) {
        user.lockUntil = new Date(Date.now() + BLOQUEO_LOGIN_MINUTOS * 60 * 1000);
        user.failedLoginAttempts = 0; // el contador se reinicia al bloquear
      }
      await user.save({ validateBeforeSave: false });
    }
    // Mismo mensaje para email inexistente y password malo: no revela que emails existen.
    throw ApiError.unauthorized('Email o contraseña incorrectos.');
  }

  if (user.failedLoginAttempts || user.lockUntil) {
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
  }
  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  res.json({
    success: true,
    message: 'Sesión iniciada.',
    data: { user: await usuarioConAgencia(user), token: setAuthCookie(res, user._id) },
  });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { user: await usuarioConAgencia(req.user) } });
});

/**
 * Cierra sesion del lado del servidor: borra la cookie httpOnly. Sin
 * protect() a proposito -- limpiar una cookie que ya no existe o que ya
 * vencio no es un error, es lo mismo que pedia el usuario.
 */
export const logout = asyncHandler(async (_req, res) => {
  clearAuthCookie(res);
  res.json({ success: true, message: 'Sesión cerrada.' });
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
  res.json({ success: true, message: 'Perfil actualizado.', data: { user: await usuarioConAgencia(user) } });
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
    data: { user: await usuarioConAgencia(user), token: setAuthCookie(res, user._id) },
  });
});

/**
 * Sube el logo de la marca y lo deja guardado en branding.logoUrl.
 *
 * Reemplaza lo que hubiera antes: es la misma decision que ya tomaba el campo
 * de URL manual, solo que ahora la URL la genera Cloudinary en vez de pedirla
 * copiada de otro sitio.
 */
export const uploadLogo = asyncHandler(async (req, res) => {
  const url = await subirLogo({
    buffer: req.file.buffer,
    mimeType: req.file.mimetype,
    userId: req.user._id,
  });

  req.user.branding = { ...(req.user.branding?.toObject?.() || {}), logoUrl: url };
  await req.user.save();

  res.json({
    success: true,
    message: 'Logo actualizado.',
    data: { user: await usuarioConAgencia(req.user) },
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

  res.json({ success: true, message: 'Contraseña actualizada.', data: { token: setAuthCookie(res, user._id) } });
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

  // Si es dueño de una agencia, esta se borra con el en vez de quedar
  // huerfana: sin esto, nadie mas podria editarla ni sacar a sus miembros,
  // porque agenciaComoDueno compara contra un owner que ya no existe. A los
  // demas agentes se les limpia el agency para que vuelvan a su marca propia,
  // igual que cuando el dueño sale por la via normal (salirAgencia).
  const agenciaPropia = await Agency.findOne({ owner: user._id });
  if (agenciaPropia) {
    await User.updateMany({ agency: agenciaPropia._id }, { agency: null });
    // Sin esto Stripe seguiria cobrando la suscripcion aunque la agencia ya
    // no exista en Rumbia.
    await stripeService.cancelarSuscripcion({ agencia: agenciaPropia });
    await Agency.deleteOne({ _id: agenciaPropia._id });
  }

  // Sin transacciones (no damos por hecho el replica set): primero los hijos,
  // para que un fallo a media operacion no deje viajes sin dueno.
  const viajes = await Trip.find({ user: user._id }).select('_id');
  const idsViajes = viajes.map((v) => v._id);

  await Itinerary.deleteMany({ user: user._id });
  await Expense.deleteMany({ user: user._id });
  await TripChat.deleteMany({ user: user._id });
  // Los clientes del CRM compartidos con una agencia son cartera del EQUIPO,
  // no de quien los registro -- si se borran solo porque un agente elimino su
  // cuenta, el resto de la agencia pierde ese historial. Solo se borran los
  // clientes personales (sin agencia): ahi si son enteramente del usuario que
  // se esta dando de baja, y conservarlos violaria la promesa de "se borra de
  // verdad" de arriba.
  await Client.deleteMany({ user: user._id, agency: null });
  // Mismo criterio que Client: una plantilla compartida con una agencia se
  // queda con el equipo, solo se borran las personales (sin agencia).
  await ItineraryTemplate.deleteMany({ user: user._id, agency: null });
  await Trip.deleteMany({ _id: { $in: idsViajes } });
  await user.deleteOne();

  res.json({
    success: true,
    message: 'Tu cuenta y todos tus viajes se eliminaron.',
    data: { viajesEliminados: idsViajes.length },
  });
});
