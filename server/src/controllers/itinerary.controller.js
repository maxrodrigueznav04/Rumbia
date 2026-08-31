import { randomBytes } from 'node:crypto';
import { Itinerary, Trip, ItineraryTemplate } from '../models/index.js';
import { LIMITE_GENERACIONES_PERSONAL } from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { generateItinerary as callGemini } from '../services/gemini.service.js';
import { findOwnedTrip } from './trip.controller.js';
import { addDays, isoDay } from '../utils/dates.js';

/**
 * Sin agencia, hasta LIMITE_GENERACIONES_PERSONAL generaciones por mes.
 * Con agencia el cupo lo cubre el plan de la agencia (o el candado de
 * soloLecturaSiCongelada si no esta activo), asi que aqui no aplica.
 */
async function revisarCupoPersonal(user) {
  if (user.agency) return;

  const mesActual = new Date().toISOString().slice(0, 7);
  if (user.usoIA?.mes !== mesActual) {
    user.usoIA = { mes: mesActual, generaciones: 0 };
  }
  if (user.usoIA.generaciones >= LIMITE_GENERACIONES_PERSONAL) {
    throw ApiError.forbidden(
      `Llegaste al límite de ${LIMITE_GENERACIONES_PERSONAL} itinerarios generados con IA este mes en el plan personal. Vuelve el próximo mes, o crea una agencia si necesitas más.`
    );
  }
  user.usoIA.generaciones += 1;
  await user.save();
}

/** Localiza dia + actividad dentro del itinerario, o lanza 404. */
function locate(itinerary, dayId, activityId) {
  const day = itinerary.days.id(dayId);
  if (!day) throw ApiError.notFound('Día no encontrado en el itinerario.');
  if (!activityId) return { day, activity: null };

  const activity = day.activities.id(activityId);
  if (!activity) throw ApiError.notFound('Actividad no encontrada.');
  return { day, activity };
}

/** Renumera el campo order tras insertar, mover o borrar. */
function resequence(day) {
  day.activities.forEach((act, idx) => {
    act.order = idx;
  });
}

/**
 * Reordena las actividades del dia por hora tras editar la de una de ellas.
 * Las que no tienen hora se van al final, en el orden en que ya estaban entre
 * si (sort es estable). Es lo unico que dispara este reordenamiento: arrastrar
 * (reorderActivities) sigue sin tocar la hora, a proposito, para poder acomodar
 * actividades fuera de su orden cronologico sin que un guardado cualquiera lo
 * deshaga.
 */
export function reorderByTime(day) {
  const conHora = day.activities.filter((a) => a.time);
  const sinHora = day.activities.filter((a) => !a.time);
  conHora.sort((a, b) => a.time.localeCompare(b.time));
  day.activities = [...conHora, ...sinHora];
  resequence(day);
}

export const getItinerary = asyncHandler(async (req, res) => {
  await findOwnedTrip(req.params.id, req.user._id);
  const itinerary = await Itinerary.findOne({ trip: req.params.id });

  if (!itinerary) {
    return res.json({ success: true, data: { itinerary: null, pins: [] } });
  }

  return res.json({
    success: true,
    data: { itinerary, pins: itinerary.mapPins() },
  });
});

/** POST /api/trips/:id/itinerary/generate — rate-limitado por usuario. */
export const generate = asyncHandler(async (req, res) => {
  const trip = await findOwnedTrip(req.params.id, req.user._id);
  const { extraNotes, pace, interests, force } = req.body;

  const existing = await Itinerary.findOne({ trip: trip._id });
  if (existing && !force) {
    throw ApiError.conflict(
      'Este viaje ya tiene un itinerario. Envía force:true para regenerarlo (se perderá el actual).'
    );
  }

  const days = trip.durationDays;
  if (days > 21) {
    throw ApiError.badRequest('Por ahora la IA genera itinerarios de máximo 21 días.');
  }

  await revisarCupoPersonal(req.user);

  const context = {
    destination: [trip.destination?.name, trip.destination?.country].filter(Boolean).join(', '),
    startDate: isoDay(trip.startDate),
    endDate: isoDay(trip.endDate),
    days,
    travelers: trip.travelers,
    // Orden: lo que mande esta generacion puntual, despues lo que se guardo
    // en el viaje (el gusto del viajero/cliente), y solo al final el perfil
    // de quien genera — que es el gusto del AGENTE, no del cliente al que le
    // esta armando el viaje. Antes se saltaba directo al perfil, asi que
    // todos los clientes de un mismo agente salian con el gusto del agente.
    interests: interests?.length ? interests : trip.interests?.length ? trip.interests : req.user.preferences?.travelStyles || [],
    pace: pace || trip.pace || req.user.preferences?.pace || 'moderado',
    budgetHint: trip.budgetLevel || req.user.preferences?.budgetLevel || 'medio',
    budgetAmount: trip.budget?.amount || 0,
    currency: trip.budget?.currency || req.user.preferences?.currency || 'MXN',
    extraNotes,
  };

  const result = await callGemini(context);

  // Se le pone fecha real a cada dia para poder cruzarlo con el clima.
  const daysWithDates = result.days.map((day) => ({
    ...day,
    date: addDays(trip.startDate, day.dayNumber - 1),
  }));

  const payload = {
    trip: trip._id,
    user: req.user._id,
    generatedBy: 'ia',
    model: result.model,
    promptContext: {
      destination: context.destination,
      days: context.days,
      travelers: context.travelers,
      interests: context.interests,
      budgetHint: context.budgetHint,
      pace: context.pace,
      extraNotes: context.extraNotes,
    },
    days: daysWithDates,
    version: existing ? existing.version + 1 : 1,
  };

  let itinerary;
  let huboCarrera = false;
  try {
    itinerary = existing
      ? await Itinerary.findOneAndUpdate({ trip: trip._id }, payload, { new: true, runValidators: true })
      : await Itinerary.create(payload);
  } catch (err) {
    // Dos generaciones a la vez para el mismo viaje (doble clic, dos pestañas):
    // ambas ven `existing` en null y ambas intentan crear. La que pierde la
    // carrera choca contra el indice unico de `trip`; en vez de tronar con un
    // error de Mongo crudo, se queda con lo que la otra ya guardo.
    if (err.code === 11000 && !existing) {
      itinerary = await Itinerary.findOne({ trip: trip._id });
      huboCarrera = true;
      if (!itinerary) throw err;
    } else {
      throw err;
    }
  }

  // Un viaje con itinerario ya no es un borrador.
  if (trip.status === 'borrador') {
    trip.status = 'planeado';
    await trip.save({ validateBeforeSave: false });
  }

  res.status(existing || huboCarrera ? 200 : 201).json({
    success: true,
    message: existing ? 'Itinerario regenerado.' : 'Itinerario generado.',
    data: { itinerary, pins: itinerary.mapPins(), summary: result.summary },
  });
});

/** Crea un itinerario vacio con un dia por fecha, para armarlo a mano. */
export const createBlank = asyncHandler(async (req, res) => {
  const trip = await findOwnedTrip(req.params.id, req.user._id);

  const existing = await Itinerary.findOne({ trip: trip._id });
  if (existing) throw ApiError.conflict('Este viaje ya tiene un itinerario.');

  const days = Array.from({ length: trip.durationDays }, (_, i) => ({
    dayNumber: i + 1,
    date: addDays(trip.startDate, i),
    title: `Día ${i + 1}`,
    summary: '',
    activities: [],
  }));

  const itinerary = await Itinerary.create({
    trip: trip._id,
    user: req.user._id,
    generatedBy: 'manual',
    days,
  });

  res.status(201).json({ success: true, message: 'Itinerario creado.', data: { itinerary } });
});

/**
 * Crea (o devuelve) el enlace publico de solo lectura.
 *
 * El token es aleatorio de 32 caracteres hex: no se puede adivinar recorriendo
 * ids, que es justo lo que pasaria si el enlace usara el id del viaje.
 */
export const compartir = asyncHandler(async (req, res) => {
  const trip = await findOwnedTrip(req.params.id, req.user._id);
  const itinerary = await Itinerary.findOne({ trip: trip._id }).select('+shareToken');
  if (!itinerary) throw ApiError.notFound('Este viaje todavia no tiene itinerario.');

  if (!itinerary.shareToken) {
    itinerary.shareToken = randomBytes(16).toString('hex');
    itinerary.sharedAt = new Date();
    await itinerary.save();
  }

  res.json({
    success: true,
    message: 'Enlace listo.',
    data: { token: itinerary.shareToken, sharedAt: itinerary.sharedAt },
  });
});

/** Revoca el enlace: a partir de aqui deja de abrir para todo el mundo. */
export const dejarDeCompartir = asyncHandler(async (req, res) => {
  const trip = await findOwnedTrip(req.params.id, req.user._id);
  const itinerary = await Itinerary.findOne({ trip: trip._id }).select('+shareToken');
  if (!itinerary) throw ApiError.notFound('Este viaje todavia no tiene itinerario.');

  itinerary.shareToken = undefined;
  itinerary.sharedAt = undefined;
  await itinerary.save();

  res.json({ success: true, message: 'El enlace dejo de funcionar.' });
});

export const deleteItinerary = asyncHandler(async (req, res) => {
  await findOwnedTrip(req.params.id, req.user._id);
  const deleted = await Itinerary.findOneAndDelete({ trip: req.params.id });
  if (!deleted) throw ApiError.notFound('Este viaje no tiene itinerario.');

  res.json({ success: true, message: 'Itinerario eliminado.' });
});

/**
 * Copia el itinerario de este viaje en una plantilla reutilizable: mismo
 * destino y actividades, sin fechas (dias relativos). Si quien la guarda
 * tiene agencia, queda visible para todo el equipo — ver ItineraryTemplate.js.
 */
export const crearPlantilla = asyncHandler(async (req, res) => {
  const trip = await findOwnedTrip(req.params.id, req.user._id);
  const itinerary = await Itinerary.findOne({ trip: trip._id });
  if (!itinerary) throw ApiError.notFound('Este viaje no tiene itinerario que convertir en plantilla.');

  const plantilla = await ItineraryTemplate.create({
    user: req.user._id,
    agency: req.user.agency || null,
    name: req.body.name,
    destination: trip.destination,
    days: itinerary.days.map((d) => ({
      dayNumber: d.dayNumber,
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
      })),
    })),
  });

  res.status(201).json({ success: true, message: 'Plantilla guardada.', data: { template: plantilla } });
});

export const updateDay = asyncHandler(async (req, res) => {
  await findOwnedTrip(req.params.id, req.user._id);
  const itinerary = await Itinerary.findOne({ trip: req.params.id });
  if (!itinerary) throw ApiError.notFound('Este viaje no tiene itinerario.');

  const { day } = locate(itinerary, req.params.dayId);
  Object.assign(day, req.body);
  await itinerary.save();

  res.json({ success: true, message: 'Día actualizado.', data: { day } });
});

/**
 * Elimina un dia completo del itinerario y renumera los siguientes.
 *
 * Hace falta sobre todo cuando se acorta un viaje: la sincronizacion deja los
 * dias sobrantes a proposito (para no borrar actividades en silencio), y este
 * endpoint es la forma de limpiarlos cuando el usuario ya los reviso.
 */
export const deleteDay = asyncHandler(async (req, res) => {
  const trip = await findOwnedTrip(req.params.id, req.user._id);
  const itinerary = await Itinerary.findOne({ trip: req.params.id });
  if (!itinerary) throw ApiError.notFound('Este viaje no tiene itinerario.');

  const { day } = locate(itinerary, req.params.dayId);

  if (itinerary.days.length === 1) {
    throw ApiError.badRequest('No puedes quedarte sin días. Elimina el itinerario completo.');
  }

  day.deleteOne();

  // Renumerar y reasignar fechas para que dia N siga siendo salida + (N-1).
  itinerary.days.forEach((d, idx) => {
    d.dayNumber = idx + 1;
    d.date = addDays(trip.startDate, idx);
  });

  await itinerary.save();

  res.json({
    success: true,
    message: 'Día eliminado.',
    data: { itinerary, pins: itinerary.mapPins() },
  });
});

export const addActivity = asyncHandler(async (req, res) => {
  await findOwnedTrip(req.params.id, req.user._id);
  const itinerary = await Itinerary.findOne({ trip: req.params.id });
  if (!itinerary) throw ApiError.notFound('Este viaje no tiene itinerario.');

  const { day } = locate(itinerary, req.params.dayId);
  day.activities.push({ ...req.body, source: 'usuario', order: day.activities.length });
  resequence(day);
  await itinerary.save();

  res.status(201).json({
    success: true,
    message: 'Actividad agregada.',
    data: { activity: day.activities[day.activities.length - 1] },
  });
});

export const updateActivity = asyncHandler(async (req, res) => {
  await findOwnedTrip(req.params.id, req.user._id);
  const itinerary = await Itinerary.findOne({ trip: req.params.id });
  if (!itinerary) throw ApiError.notFound('Este viaje no tiene itinerario.');

  const { day, activity } = locate(itinerary, req.params.dayId, req.params.activityId);
  const { location, ...rest } = req.body;

  const horaCambio = 'time' in rest && rest.time !== activity.time;

  Object.assign(activity, rest);
  if (location) activity.location = { ...activity.location?.toObject(), ...location };
  if (horaCambio) reorderByTime(day);

  await itinerary.save();
  res.json({ success: true, message: 'Actividad actualizada.', data: { activity, day } });
});

export const deleteActivity = asyncHandler(async (req, res) => {
  await findOwnedTrip(req.params.id, req.user._id);
  const itinerary = await Itinerary.findOne({ trip: req.params.id });
  if (!itinerary) throw ApiError.notFound('Este viaje no tiene itinerario.');

  const { day, activity } = locate(itinerary, req.params.dayId, req.params.activityId);
  activity.deleteOne();
  resequence(day);
  await itinerary.save();

  res.json({ success: true, message: 'Actividad eliminada.' });
});

/** Reordena las actividades de un dia segun la lista de ids recibida. */
export const reorderActivities = asyncHandler(async (req, res) => {
  await findOwnedTrip(req.params.id, req.user._id);
  const itinerary = await Itinerary.findOne({ trip: req.params.id });
  if (!itinerary) throw ApiError.notFound('Este viaje no tiene itinerario.');

  const { day } = locate(itinerary, req.params.dayId);
  const { activityIds } = req.body;

  const current = new Map(day.activities.map((a) => [String(a._id), a]));
  // new Set(...).size en vez de activityIds.length: una lista con un id
  // repetido en lugar de otro que falta tenia el mismo largo que current y
  // pasaba la validacion, perdiendo esa actividad en silencio al mapear.
  if (new Set(activityIds).size !== current.size || activityIds.some((id) => !current.has(id))) {
    throw ApiError.badRequest('La lista debe contener exactamente los ids de las actividades del día.');
  }

  day.activities = activityIds.map((id, idx) => {
    const act = current.get(id);
    act.order = idx;
    return act;
  });

  await itinerary.save();
  res.json({ success: true, message: 'Orden actualizado.', data: { day } });
});

/** Mueve una actividad a otro dia (arrastrar entre columnas del timeline). */
export const moveActivity = asyncHandler(async (req, res) => {
  await findOwnedTrip(req.params.id, req.user._id);
  const itinerary = await Itinerary.findOne({ trip: req.params.id });
  if (!itinerary) throw ApiError.notFound('Este viaje no tiene itinerario.');

  const { day: sourceDay, activity } = locate(itinerary, req.params.dayId, req.params.activityId);
  const { targetDayNumber, position } = req.body;

  const targetDay = itinerary.days.find((d) => d.dayNumber === targetDayNumber);
  if (!targetDay) throw ApiError.notFound(`El itinerario no tiene un día ${targetDayNumber}.`);

  const moved = activity.toObject();
  delete moved._id; // se reinserta como subdocumento nuevo en el dia destino
  activity.deleteOne();
  resequence(sourceDay);

  const idx = Math.min(position ?? targetDay.activities.length, targetDay.activities.length);
  targetDay.activities.splice(idx, 0, moved);
  resequence(targetDay);

  await itinerary.save();
  res.json({ success: true, message: 'Actividad movida.', data: { itinerary } });
});
