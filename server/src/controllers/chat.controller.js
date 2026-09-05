import { Itinerary, TripChat, Agency, User } from '../models/index.js';
import { LIMITE_MENSAJES_CHAT_PERSONAL } from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendChatMessage } from '../services/chat.service.js';
import { findOwnedTrip } from './trip.controller.js';
import { esAdmin } from '../utils/esAdmin.js';
import { requireEmailVerificado } from '../utils/requireEmailVerificado.js';
import { incrementarUsoIAMensual } from '../utils/cupoIA.js';

// Cuantos mensajes se conservan por viaje. Recortar el historial guardado
// evita que un documento crezca sin limite; el chat sigue funcionando bien
// con menos contexto porque cada turno ya manda un resumen fresco del viaje
// (ver chat.service.js buildSystemInstruction).
const MAX_MENSAJES_GUARDADOS = 100;

// Debe coincidir con el maxlength de chatMessageSchema.text (TripChat.js). El
// system prompt le pide respuestas cortas a Gemini, pero es una instruccion
// de estilo, no un limite duro -- sin este recorte, una respuesta larga de
// verdad tronaba el guardado completo del turno con un 400 generico.
const MAX_LARGO_MENSAJE = 4000;

/**
 * Mismo patron de dos pasos que verificarCupoPersonal/consumirCupoPersonal
 * en itinerary.controller.js, con su propio contador (usoIA.mensajesChat)
 * para no compartir cupo con generar itinerarios.
 */
export function verificarCupoChat(user) {
  if (user.agency || esAdmin(user)) return;

  const mesActual = new Date().toISOString().slice(0, 7);
  const mensajesEsteMes = user.usoIA?.mes === mesActual ? user.usoIA.mensajesChat : 0;
  if (mensajesEsteMes >= LIMITE_MENSAJES_CHAT_PERSONAL) {
    throw ApiError.forbidden(
      `Llegaste al límite de ${LIMITE_MENSAJES_CHAT_PERSONAL} mensajes al chat este mes en el plan personal. Vuelve el próximo mes, o crea una agencia si necesitas más.`
    );
  }
}

export async function consumirCupoChat(user) {
  if (user.agency || esAdmin(user)) return;
  await incrementarUsoIAMensual(User, { _id: user._id }, 'usoIA', 'mensajesChat', 'generaciones');
}

/**
 * Carga el viaje (validando que sea del usuario) si viene tripId, o null
 * para modo general: el chat es global, no siempre esta atado a un viaje.
 */
async function resolveTrip(tripId, user) {
  if (!tripId) return null;
  return findOwnedTrip(tripId, user);
}

/** Historial de este chat (general o de un viaje), o vacio si nunca se le escribio. */
export const getChat = asyncHandler(async (req, res) => {
  const { tripId } = req.validatedQuery;
  const trip = await resolveTrip(tripId, req.user);
  const chat = await TripChat.findOne({ user: req.user._id, trip: trip?._id || null });

  res.json({ success: true, data: { messages: chat?.messages || [] } });
});

/** Manda un mensaje y guarda tanto la pregunta como la respuesta. */
export const sendMessage = asyncHandler(async (req, res) => {
  requireEmailVerificado(req.user);

  const { message, tripId } = req.body;
  const trip = await resolveTrip(tripId, req.user);

  verificarCupoChat(req.user); // no-op si tiene agencia (ver arriba)

  // Con agencia, Inicio topa a 60 mensajes/mes; Agencia y Pro no tienen tope
  // de chat (limitesDePlan devuelve null para 'chat' en esos tiers).
  let agenciaParaCupo = null;
  if (req.user.agency && !esAdmin(req.user)) {
    agenciaParaCupo = await Agency.findById(req.user.agency).select('billing');
    if (agenciaParaCupo) agenciaParaCupo.verificarCupoIA('chat');
  }

  const [chat, itinerary] = await Promise.all([
    TripChat.findOne({ user: req.user._id, trip: trip?._id || null }),
    trip ? Itinerary.findOne({ trip: trip._id }) : null,
  ]);

  const doc = chat || new TripChat({ trip: trip?._id || null, user: req.user._id, messages: [] });
  doc.messages.push({ role: 'user', text: message });

  const respuesta = await sendChatMessage({ trip, itinerary, messages: doc.messages });

  const textoModelo =
    respuesta.text.length > MAX_LARGO_MENSAJE
      ? `${respuesta.text.slice(0, MAX_LARGO_MENSAJE - 1)}…`
      : respuesta.text;
  doc.messages.push({ role: 'model', text: textoModelo });
  if (doc.messages.length > MAX_MENSAJES_GUARDADOS) {
    doc.messages = doc.messages.slice(-MAX_MENSAJES_GUARDADOS);
  }
  await doc.save();

  // Recien aqui, con la respuesta y el guardado ya confirmados, se gasta el
  // cupo mensual: un intento fallido (Gemini saturado, timeout) no lo gasta.
  await consumirCupoChat(req.user);
  if (agenciaParaCupo) await agenciaParaCupo.consumirCupoIA('chat');

  res.json({ success: true, data: { messages: doc.messages } });
});

/** Borra el historial de este chat (general o de un viaje) para empezar de cero. */
export const clearChat = asyncHandler(async (req, res) => {
  const { tripId } = req.validatedQuery;
  const trip = await resolveTrip(tripId, req.user);
  await TripChat.deleteOne({ user: req.user._id, trip: trip?._id || null });

  res.json({ success: true, message: 'Chat reiniciado.' });
});
