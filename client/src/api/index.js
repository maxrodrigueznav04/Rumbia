import api, { TIMEOUT_IA_MS, BASE_URL } from './client.js';

/** Un lugar por endpoint del backend: los componentes no arman URLs a mano. */

export const authApi = {
  register: (payload) => api.post('/auth/register', payload, { auth: false }),
  login: (payload) => api.post('/auth/login', payload, { auth: false }),
  me: (opts) => api.get('/auth/me', opts),
  updateProfile: (payload) => api.patch('/auth/me', payload),
  changePassword: (payload) => api.patch('/auth/me/password', payload),
  // El DELETE lleva cuerpo: la contraseña va como confirmación.
  deleteAccount: (payload) => api.delete('/auth/me', { body: payload }),
};

const qs = (params) => {
  const limpio = Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== '');
  return limpio.length ? `?${new URLSearchParams(limpio)}` : '';
};

export const tripsApi = {
  list: (params, opts) => api.get(`/trips${qs(params)}`, opts),
  get: (id, opts) => api.get(`/trips/${id}`, opts),
  create: (payload) => api.post('/trips', payload),
  update: (id, payload) => api.patch(`/trips/${id}`, payload),
  remove: (id) => api.delete(`/trips/${id}`),
  summary: (id, opts) => api.get(`/trips/${id}/summary`, opts),
  bookingLinks: (id, params, opts) => api.get(`/trips/${id}/booking-links${qs(params)}`, opts),
  weather: (id, opts) => api.get(`/trips/${id}/weather`, opts),
  expenses: (id, opts) => api.get(`/trips/${id}/expenses`, opts),
};

/**
 * Avisa que se pulso un enlace de salida.
 *
 * Va con sendBeacon a proposito: el navegador lo entrega aunque la pagina se
 * este descargando, asi que el usuario no espera nada y el dato no se pierde
 * al saltar al sitio del proveedor. fetch normal se cancelaria a media
 * navegacion.
 *
 * Falla en silencio: perder una metrica jamas puede estorbar el clic.
 */
export function avisarClick(evento) {
  try {
    const url = `${BASE_URL}/public/click`;
    const cuerpo = new Blob([JSON.stringify(evento)], { type: 'application/json' });
    if (navigator.sendBeacon?.(url, cuerpo)) return;
    // Navegadores sin sendBeacon: se intenta igual, sin esperar respuesta.
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(evento), keepalive: true }).catch(() => {});
  } catch {
    /* sin metrica, pero el enlace abre igual */
  }
}

export const publicApi = {
  // Sin sesion y con su propio timeout: es la misma llamada a Gemini.
  generarItinerario: (payload) =>
    api.post('/public/itinerary', payload, { auth: false, timeout: TIMEOUT_IA_MS }),
  verCompartido: (token, opts) => api.get(`/public/itinerary/${token}`, { ...opts, auth: false }),
};

export const itineraryApi = {
  get: (tripId, opts) => api.get(`/trips/${tripId}/itinerary`, opts),
  createBlank: (tripId) => api.post(`/trips/${tripId}/itinerary`),
  // Timeout propio: es la unica llamada que puede tardar minutos.
  generate: (tripId, payload) =>
    api.post(`/trips/${tripId}/itinerary/generate`, payload, { timeout: TIMEOUT_IA_MS }),
  remove: (tripId) => api.delete(`/trips/${tripId}/itinerary`),
  compartir: (tripId) => api.post(`/trips/${tripId}/itinerary/share`),
  dejarDeCompartir: (tripId) => api.delete(`/trips/${tripId}/itinerary/share`),
  updateDay: (tripId, dayId, payload) => api.patch(`/trips/${tripId}/itinerary/days/${dayId}`, payload),
  removeDay: (tripId, dayId) => api.delete(`/trips/${tripId}/itinerary/days/${dayId}`),
  reorder: (tripId, dayId, activityIds) =>
    api.patch(`/trips/${tripId}/itinerary/days/${dayId}/reorder`, { activityIds }),
  addActivity: (tripId, dayId, payload) =>
    api.post(`/trips/${tripId}/itinerary/days/${dayId}/activities`, payload),
  updateActivity: (tripId, dayId, activityId, payload) =>
    api.patch(`/trips/${tripId}/itinerary/days/${dayId}/activities/${activityId}`, payload),
  moveActivity: (tripId, dayId, activityId, payload) =>
    api.patch(`/trips/${tripId}/itinerary/days/${dayId}/activities/${activityId}/move`, payload),
  removeActivity: (tripId, dayId, activityId) =>
    api.delete(`/trips/${tripId}/itinerary/days/${dayId}/activities/${activityId}`),
};

export const expensesApi = {
  list: (params, opts) => api.get(`/expenses${qs(params)}`, opts),
  create: (payload) => api.post('/expenses', payload),
  update: (id, payload) => api.patch(`/expenses/${id}`, payload),
  remove: (id) => api.delete(`/expenses/${id}`),
};

export const weatherApi = {
  forRange: (params, opts) => api.get(`/weather${qs(params)}`, opts),
  geocode: (q, opts) => api.get(`/weather/geocode${qs({ q })}`, opts),
};

export { ApiError } from './client.js';
