import { Agency, Trip, Expense, Client, ItineraryTemplate } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { esAdmin } from '../utils/esAdmin.js';

/**
 * Bloquea crear o editar contenido corporativo (viajes, itinerarios y gastos)
 * si la agencia del usuario no tiene un plan activo o está archivada.
 *
 * Reglas P02:
 * 1. Pertenecer a una agencia archivada o congelada NO debe impedir editar o
 *    borrar viajes, gastos, clientes o plantillas verdaderamente personales (agency === null).
 * 2. Si la agencia está archivada, ninguna operación corporativa está permitida,
 *    y la cuenta administradora (admin) NUNCA debe saltarse el archivo.
 */
export const soloLecturaSiCongelada = asyncHandler(async (req, res, next) => {
  // Revocar un enlace compartido es una acción de seguridad/privacidad
  const esRevocarCompartir = req.method === 'DELETE' && req.originalUrl.endsWith('/itinerary/share');
  if (!req.user.agency || req.method === 'GET' || esRevocarCompartir) return next();

  // P02: Si la petición está operando sobre un recurso por :id, verificar si es personal
  const path = req.path || '';
  const matchId = path.match(/^\/([0-9a-fA-F]{24})/);
  if (matchId) {
    const id = matchId[1];
    const baseUrl = req.baseUrl || '';
    if (baseUrl.includes('trips')) {
      const trip = await Trip.findById(id).select('agency');
      if (trip && !trip.agency) return next();
    } else if (baseUrl.includes('expenses')) {
      const exp = await Expense.findById(id).select('trip');
      if (exp) {
        const trip = await Trip.findById(exp.trip).select('agency');
        if (trip && !trip.agency) return next();
      }
    } else if (baseUrl.includes('clients')) {
      const client = await Client.findById(id).select('agency');
      if (client && !client.agency) return next();
    } else if (baseUrl.includes('templates')) {
      const tpl = await ItineraryTemplate.findById(id).select('agency');
      if (tpl && !tpl.agency) return next();
    }
  }

  // P02: Creaciones personales
  if (req.method === 'POST') {
    if (req.body?.esPersonal === true || req.body?.personal === true) {
      return next();
    }
    const baseUrl = req.baseUrl || '';
    if (baseUrl.includes('expenses') && req.body?.trip) {
      const trip = await Trip.findById(req.body.trip).select('agency');
      if (trip && !trip.agency) return next();
    }
  }

  const agencia = await Agency.findById(req.user.agency).select('status billing createdAt');
  if (!agencia) return next();

  // Regla P02: Si la agencia está archivada, ninguna operación de escritura corporativa está permitida.
  // El bypass administrativo no debe saltarse el archivo bajo ninguna circunstancia.
  if (agencia.status === 'archivada') {
    throw ApiError.forbidden(
      'Esta agencia se encuentra archivada. No se permite crear, editar ni eliminar contenido corporativo.'
    );
  }

  // Bypass de admin solo aplica a restricciones comerciales de facturación
  if (esAdmin(req.user)) return next();
  if (agencia.tieneAccesoActivo) return next();

  const finTrial =
    agencia.billing?.trialHasta ||
    (agencia.billing?.status === 'trial' && agencia.createdAt
      ? new Date(new Date(agencia.createdAt).getTime() + 7 * 86400000)
      : null);
  const esTrial = agencia.billing?.status === 'trial' || Boolean(finTrial);
  throw ApiError.forbidden(
    esTrial
      ? 'El periodo de prueba gratuita de tu agencia ha concluido. Tus viajes siguen guardados, pero necesitas activar un plan para crear o editar contenido.'
      : 'La suscripción de tu agencia no está activa. Tus viajes siguen ahí, pero no puedes crear ni editar nada hasta que se active un plan.'
  );
});

export default soloLecturaSiCongelada;
