import { generateItinerary as callGemini } from '../services/gemini.service.js';
import { buildLinksForTrip } from '../services/bookingLinks.service.js';
import { decorarSecciones, hayAfiliados } from '../services/affiliates.service.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { isoDay, addDays } from '../utils/dates.js';

// Un invitado no puede pedir un viaje de tres semanas: cada dia extra cuesta
// tiempo de Gemini, y esto se sirve sin cuenta ni limite por usuario.
const MAX_DIAS_INVITADO = 7;

/**
 * Genera un itinerario de muestra SIN cuenta y SIN guardar nada.
 *
 * Existe porque pedir registro antes de enseñar el producto es lo que mas
 * usuarios pierde: nadie crea una cuenta para averiguar si algo le sirve. Aqui
 * el visitante ve el itinerario y los enlaces de reserva, y la cuenta se le
 * pide solo cuando quiere guardarlo.
 *
 * Nada de esto toca la base de datos: si el visitante cierra la pestaña, no
 * queda rastro suyo en ningun lado.
 */
export const generarItinerarioInvitado = asyncHandler(async (req, res) => {
  const { destination, country, startDate, endDate, travelers, interests, pace } = req.body;

  const inicio = new Date(startDate);
  const fin = new Date(endDate);
  const dias = Math.round((fin - inicio) / 86400000) + 1;

  if (dias < 1) throw ApiError.badRequest('La fecha de regreso no puede ser anterior a la de salida.');
  if (dias > MAX_DIAS_INVITADO) {
    throw ApiError.badRequest(
      `Sin cuenta se pueden probar viajes de hasta ${MAX_DIAS_INVITADO} días. Crea una cuenta gratis para planear viajes más largos.`
    );
  }

  const contexto = {
    destination: [destination, country].filter(Boolean).join(', '),
    startDate: isoDay(inicio),
    endDate: isoDay(fin),
    days: dias,
    travelers,
    interests: interests || [],
    pace: pace || 'moderado',
    budgetHint: 'medio',
    budgetAmount: 0,
    currency: 'MXN',
  };

  const resultado = await callGemini(contexto);

  const diasConFecha = resultado.days.map((d) => ({
    ...d,
    date: addDays(inicio, d.dayNumber - 1),
  }));

  // Se arma un viaje "de mentira" en memoria solo para reusar el constructor de
  // enlaces: es la misma logica que ve un usuario registrado, sin duplicarla.
  const viajeFicticio = {
    destination: { name: destination, country },
    origin: {},
    startDate: inicio,
    endDate: fin,
    travelers,
    lodging: [],
    localTransport: [],
    transport: {},
  };

  res.json({
    success: true,
    data: {
      itinerary: {
        days: diasConFecha,
        summary: resultado.summary,
        model: resultado.model,
        generatedBy: 'ia',
      },
      links: decorarSecciones(buildLinksForTrip(viajeFicticio)),
      conAfiliados: hayAfiliados(),
      // El cliente lo usa para explicar por que conviene crear una cuenta.
      guardado: false,
      maxDias: MAX_DIAS_INVITADO,
    },
  });
});
