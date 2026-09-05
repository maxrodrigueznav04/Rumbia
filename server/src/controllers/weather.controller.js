import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { getWeatherForRange, getWeatherForStops, geocode, geocodeSugerencias } from '../services/weather.service.js';
import { findOwnedTrip } from './trip.controller.js';

/** GET /api/weather?lat&lng&startDate&endDate */
export const getWeather = asyncHandler(async (req, res) => {
  const { lat, lng, startDate, endDate } = req.validatedQuery;
  const weather = await getWeatherForRange({ lat, lng, startDate, endDate });
  res.json({ success: true, data: weather });
});

/**
 * GET /api/trips/:id/weather
 * Si el destino no trae coordenadas, intenta geocodificarlas y las guarda
 * en el viaje para no repetir la llamada en cada visita.
 */
export const getTripWeather = asyncHandler(async (req, res) => {
  const trip = await findOwnedTrip(req.params.id, req.user);

  let { lat, lng } = trip.destination || {};

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    const hit = await geocode(
      [trip.destination?.name, trip.destination?.country].filter(Boolean).join(', ')
    );
    if (!hit) {
      throw ApiError.serviceUnavailable(
        'No se pudieron obtener las coordenadas del destino. Edítalo y agrega su ubicación.'
      );
    }
    lat = hit.lat;
    lng = hit.lng;
    trip.destination.lat = lat;
    trip.destination.lng = lng;
    if (!trip.destination.country && hit.country) trip.destination.country = hit.country;
    await trip.save({ validateBeforeSave: false });
  }

  const weather = await getWeatherForRange({
    lat,
    lng,
    startDate: trip.startDate,
    endDate: trip.endDate,
  });

  // Clima por parada, si el viaje tiene mas de un destino. A diferencia del
  // destino principal (estricto arriba), una parada que falla no tumba el
  // resto: ver getWeatherForStops en weather.service.js.
  const paradas = await getWeatherForStops(trip.additionalDestinations);

  res.json({
    success: true,
    data: { ...weather, location: { lat, lng, name: trip.destination?.name }, paradas },
  });
});

/** GET /api/weather/geocode?q=Oaxaca — usado por el buscador de destino. */
export const geocodePlace = asyncHandler(async (req, res) => {
  const { q } = req.validatedQuery;
  const hit = await geocode(q);
  if (!hit) throw ApiError.notFound(`No se encontró el lugar "${q}".`);
  res.json({ success: true, data: { place: hit } });
});

/** GET /api/weather/geocode/sugerencias?q=Guada — autocompletado del destino. */
export const sugerirLugares = asyncHandler(async (req, res) => {
  const { q } = req.validatedQuery;
  const lugares = await geocodeSugerencias(q);
  res.json({ success: true, data: { lugares } });
});
