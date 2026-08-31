import mongoose from 'mongoose';

/** Un turno de la conversacion con el asistente de IA. */
const chatMessageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'model'], required: true },
    text: { type: String, required: true, trim: true, maxlength: 4000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

/**
 * Chat de un agente con el asistente de IA. `trip` es opcional: con un
 * viaje, el asistente conoce su contexto completo (destino, fechas,
 * hospedajes, itinerario); sin el (trip: null), es una conversacion general
 * -- util desde pantallas donde no hay ningun viaje abierto (Mis viajes,
 * Perfil, etc). Cada usuario tiene como mucho un documento general
 * (trip: null) y uno por cada viaje suyo, igual que Itinerary pero
 * indexado por (user, trip) en vez de solo por trip, ya que ahora varios
 * documentos comparten trip: null.
 *
 * El asistente solo aconseja: no hay ningun mecanismo aqui ni en
 * chat.controller.js para que sus respuestas escriban de vuelta al viaje.
 */
const tripChatSchema = new mongoose.Schema(
  {
    trip: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', default: null },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    messages: { type: [chatMessageSchema], default: [] },
  },
  { timestamps: true }
);

tripChatSchema.index({ user: 1, trip: 1 }, { unique: true });

export default mongoose.model('TripChat', tripChatSchema);
