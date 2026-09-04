import { Trip, Itinerary, ItineraryTemplate } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { addDays } from '../utils/dates.js';

/**
 * Con agencia, las plantillas se comparten con todo el equipo (esa es la
 * gracia: un destino que arma seguido cualquier agente no lo vuelve a armar
 * nadie desde cero). Sin agencia, son privadas: nadie mas comparte el filtro.
 */
function filtroVisible(user) {
  return user.agency ? { agency: user.agency } : { user: user._id, agency: null };
}

/** GET /api/templates — vista ligera, sin el detalle de cada actividad. */
export const listar = asyncHandler(async (req, res) => {
  const plantillas = await ItineraryTemplate.find(filtroVisible(req.user))
    .select('name destination additionalDestinations days.dayNumber user createdAt')
    .populate({ path: 'user', select: 'name' })
    .sort({ createdAt: -1 })
    .lean();

  const data = plantillas.map((p) => ({
    _id: p._id,
    name: p.name,
    destination: p.destination,
    additionalDestinations: p.additionalDestinations || [],
    dayCount: p.days?.length || 0,
    creadaPorId: p.user?._id,
    creadaPor: p.user?.name || '',
    createdAt: p.createdAt,
  }));

  res.json({ success: true, data: { templates: data } });
});

/**
 * Carga una plantilla y revienta si quien pide no puede verla.
 *
 * "esDueña" solo cuenta cuando la plantilla NUNCA tuvo agencia: antes
 * bastaba con haberla creado, sin importar si desde entonces se salio de la
 * agencia con la que se compartia -- ese es justo el mismo escape que
 * filtroPertenencia (client.controller.js) tenia para clientes del CRM.
 */
async function plantillaVisible(id, user) {
  const plantilla = await ItineraryTemplate.findById(id);
  if (!plantilla) throw ApiError.notFound('Plantilla no encontrada.');

  const esPersonalPropia = !plantilla.agency && String(plantilla.user) === String(user._id);
  const esDeLaAgencia = plantilla.agency && user.agency && String(plantilla.agency) === String(user.agency);
  if (!esPersonalPropia && !esDeLaAgencia) throw ApiError.forbidden();

  return plantilla;
}

/** DELETE /api/templates/:id — solo quien la guardo, aunque se comparta con la agencia. */
export const eliminar = asyncHandler(async (req, res) => {
  const plantilla = await ItineraryTemplate.findById(req.params.id);
  if (!plantilla) throw ApiError.notFound('Plantilla no encontrada.');
  if (String(plantilla.user) !== String(req.user._id)) {
    throw ApiError.forbidden('Solo quien guardó la plantilla puede eliminarla.');
  }

  await plantilla.deleteOne();
  res.json({ success: true, message: 'Plantilla eliminada.' });
});

/**
 * POST /api/templates/:id/aplicar — crea un viaje y su itinerario a partir
 * de la plantilla. No pasa por Gemini: no cuenta contra el cupo de
 * generaciones con IA del plan personal.
 */
export const aplicar = asyncHandler(async (req, res) => {
  const plantilla = await plantillaVisible(req.params.id, req.user);
  const { title, startDate, endDate, travelers, budget, cliente } = req.body;

  const trip = await Trip.create({
    user: req.user._id,
    title,
    destination: plantilla.destination,
    // La plantilla guarda dias relativos (startDayNumber/endDayNumber); aqui
    // se traducen a fechas absolutas con la fecha de salida del viaje nuevo.
    additionalDestinations: (plantilla.additionalDestinations || []).map((p) => ({
      place: p.place,
      startDate: addDays(startDate, p.startDayNumber - 1),
      endDate: addDays(startDate, p.endDayNumber - 1),
    })),
    startDate,
    endDate,
    travelers,
    budget: {
      amount: budget?.amount ?? 0,
      currency: budget?.currency || req.user.preferences?.currency || 'MXN',
    },
    cliente,
  });

  const days = plantilla.days.map((d) => ({
    dayNumber: d.dayNumber,
    destinationIndex: d.destinationIndex,
    date: addDays(trip.startDate, d.dayNumber - 1),
    title: d.title,
    summary: d.summary,
    activities: d.activities.map((a) => ({
      time: a.time,
      title: a.title,
      description: a.description,
      category: a.category,
      location: a.location,
      estimatedCost: a.estimatedCost,
      durationMinutes: a.durationMinutes,
      source: 'usuario',
    })),
  }));

  const itinerary = await Itinerary.create({
    trip: trip._id,
    user: req.user._id,
    generatedBy: 'manual',
    promptContext: {
      destination: plantilla.destination?.name,
      paradas: (plantilla.additionalDestinations || []).map((p) => ({
        nombre: p.place?.name,
        startDay: p.startDayNumber,
        endDay: p.endDayNumber,
      })),
      days: days.length,
    },
    days,
  });

  res.status(201).json({
    success: true,
    message: 'Viaje creado desde la plantilla.',
    data: { trip, itinerary },
  });
});
