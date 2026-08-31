import { Itinerary, TripChat } from '../models/index.js';
import { LIMITE_MENSAJES_CHAT_PERSONAL } from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendChatMessage } from '../services/chat.service.js';
import { findOwnedTrip } from './trip.controller.js';
import { esAdmin } from '../utils/esAdmin.js';

// Cuantos mensajes se conservan por viaje. Recortar el historial guardado
// evita que un documento crezca sin limite; el chat sigue funcionando bien
// con menos contexto porque cada turno ya manda un resumen fresco del viaje
// (ver chat.service.js buildSystemInstruction).
const MAX_MENSAJES_GUARDADOS = 100;

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

  const mesActual = new Date().toISOString().slice(0, 7);
  if (user.usoIA?.mes !== mesActual) {
    user.usoIA = { mes: mesActual, generaciones: 0, mensajesChat: 0 };
  }
  user.usoIA.mensajesChat += 1;
  await user.save();
}

/** Historial del chat de este viaje, o vacio si nunca se le escribio. */
export const getChat = asyncHandler(async (req, res) => {
  const trip = await findOwnedTrip(req.params.id, req.user._id);
  const chat = await TripChat.findOne({ trip: trip._id });

  res.json({ success: true, data: { messages: chat?.messages || [] } });
});

/** Manda un mensaje y guarda tanto la pregunta como la respuesta. */
export const sendMessage = asyncHandler(async (req, res) => {
  const trip = await findOwnedTrip(req.params.id, req.user._id);
  const { message } = req.body;

  verificarCupoChat(req.user);

  const [chat, itinerary] = await Promise.all([
    TripChat.findOne({ trip: trip._id }),
    Itinerary.findOne({ trip: trip._id }),
  ]);

  const doc = chat || new TripChat({ trip: trip._id, user: req.user._id, messages: [] });
  doc.messages.push({ role: 'user', text: message });

  const respuesta = await sendChatMessage({ trip, itinerary, messages: doc.messages });

  doc.messages.push({ role: 'model', text: respuesta.text });
  if (doc.messages.length > MAX_MENSAJES_GUARDADOS) {
    doc.messages = doc.messages.slice(-MAX_MENSAJES_GUARDADOS);
  }
  await doc.save();

  // Recien aqui, con la respuesta y el guardado ya confirmados, se gasta el
  // cupo mensual: un intento fallido (Gemini saturado, timeout) no lo gasta.
  await consumirCupoChat(req.user);

  res.json({ success: true, data: { messages: doc.messages } });
});

/** Borra el historial de este viaje para que el agente empiece de cero. */
export const clearChat = asyncHandler(async (req, res) => {
  const trip = await findOwnedTrip(req.params.id, req.user._id);
  await TripChat.deleteOne({ trip: trip._id });

  res.json({ success: true, message: 'Chat reiniciado.' });
});
