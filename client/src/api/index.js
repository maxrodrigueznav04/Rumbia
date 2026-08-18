import api from './client.js';

/** Un lugar por endpoint del backend: los componentes no arman URLs a mano. */

export const authApi = {
  register: (payload) => api.post('/auth/register', payload, { auth: false }),
  login: (payload) => api.post('/auth/login', payload, { auth: false }),
  me: (opts) => api.get('/auth/me', opts),
  updateProfile: (payload) => api.patch('/auth/me', payload),
  changePassword: (payload) => api.patch('/auth/me/password', payload),
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

export const itineraryApi = {
  get: (tripId, opts) => api.get(`/trips/${tripId}/itinerary`, opts),
  createBlank: (tripId) => api.post(`/trips/${tripId}/itinerary`),
  generate: (tripId, payload) => api.post(`/trips/${tripId}/itinerary/generate`, payload),
  remove: (tripId) => api.delete(`/trips/${tripId}/itinerary`),
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
