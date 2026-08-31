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
 * Chat de un agente con el asistente de IA, siempre atado a un viaje
 * concreto (le da contexto: destino, fechas, hospedajes, itinerario). Un
 * documento por viaje, igual que Itinerary. El asistente solo aconseja: no
 * hay ningun mecanismo aqui ni en chat.controller.js para que sus
 * respuestas escriban de vuelta al viaje.
 */
const tripChatSchema = new mongoose.Schema(
  {
    trip: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      required: true,
      unique: true,
      index: true,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    messages: { type: [chatMessageSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model('TripChat', tripChatSchema);
