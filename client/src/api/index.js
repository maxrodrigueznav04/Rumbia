import api, { TIMEOUT_IA_MS, BASE_URL } from './client.js';

/** Un lugar por endpoint del backend: los componentes no arman URLs a mano. */

export const authApi = {
  register: (payload) => api.post('/auth/register', payload),
  login: (payload) => api.post('/auth/login', payload),
  me: (opts) => api.get('/auth/me', opts),
  // Cierra sesion del lado del servidor (borra la cookie httpOnly): a
  // diferencia de localStorage, el cliente no puede limpiarla el solo.
  logout: () => api.post('/auth/logout'),
  forgotPassword: (payload) => api.post('/auth/forgot-password', payload),
  resetPassword: (payload) => api.post('/auth/reset-password', payload),
  updateProfile: (payload) => api.patch('/auth/me', payload),
  uploadLogo: (archivo) => {
    const form = new FormData();
    form.append('logo', archivo);
    return api.post('/auth/me/logo', form);
  },
  changePassword: (payload) => api.patch('/auth/me/password', payload),
  // El DELETE lleva cuerpo: la contraseña va como confirmación.
  deleteAccount: (payload) => api.delete('/auth/me', { body: payload }),
};

export const agencyApi = {
  crear: (payload) => api.post('/agency', payload),
  obtener: (opts) => api.get('/agency', opts),
  actualizar: (payload) => api.patch('/agency', payload),
  subirLogo: (archivo) => {
    const form = new FormData();
    form.append('logo', archivo);
    return api.post('/agency/logo', form);
  },
  unirse: (payload) => api.post('/agency/unirse', payload),
  salir: () => api.post('/agency/salir'),
  regenerarCodigo: () => api.post('/agency/codigo'),
  eliminarMiembro: (userId) => api.delete(`/agency/miembros/${userId}`),
  reporte: (opts) => api.get('/agency/reporte', opts),
};

export const billingApi = {
  obtener: (opts) => api.get('/agency/billing', opts),
  // Redirige de inmediato a la sesion de Checkout de Stripe; no hay nada mas
  // que hacer con la respuesta que ir a data.url.
  checkout: (payload) => api.post('/agency/billing/checkout', payload),
  portal: () => api.post('/agency/billing/portal'),
  cambiarAgentes: (payload) => api.patch('/agency/billing/agentes', payload),
};

const qs = (params) => {
  const limpio = Object.entries(params || {}).filter(
    ([, v]) => v !== undefined && v !== null && v !== '' && v !== 'null' && v !== 'undefined'
  );
  return limpio.length ? `?${new URLSearchParams(limpio)}` : '';
};

export const tripsApi = {
  list: (params, opts) => api.get(`/trips${qs(params)}`, opts),
  get: (id, opts) => api.get(`/trips/${id}`, opts),
  create: (payload) => api.post('/trips', payload),
  update: (id, payload) => api.patch(`/trips/${id}`, payload),
  remove: (id) => api.delete(`/trips/${id}`),
  duplicar: (id) => api.post(`/trips/${id}/duplicar`),
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

/**
 * Despierta la API sin bloquear nada.
 *
 * Render duerme el plan gratuito tras 15 minutos sin trafico y tarda ~50 s en
 * levantarse. Ese retraso caia justo sobre la primera peticion real del
 * visitante, que ademas es la mas lenta (la generacion con IA).
 *
 * Llamando a /health al abrir la pantalla, el servidor se despierta mientras la
 * persona lee y llena el formulario: para cuando pulsa el boton, ya esta listo.
 * No arregla el arranque en frio, lo mueve a un momento en que no molesta.
 */
export function despertarServidor() {
  fetch(`${BASE_URL}/health`, { method: 'GET', keepalive: true }).catch(() => {});
}

export const publicApi = {
  // Sin sesion y con su propio timeout: es la misma llamada a Gemini.
  generarItinerario: (payload) =>
    api.post('/public/itinerary', payload, { auth: false, timeout: TIMEOUT_IA_MS }),
  verCompartido: (token, opts) => api.get(`/public/itinerary/${token}`, { ...opts, auth: false }),
  aceptarPropuesta: (token) => api.post(`/public/itinerary/${token}/aceptar`, undefined, { auth: false }),
};

export const clientsApi = {
  list: (params, opts) => api.get(`/clients${qs(params)}`, opts),
  get: (id, opts) => api.get(`/clients/${id}`, opts),
  create: (payload) => api.post('/clients', payload),
  update: (id, payload) => api.patch(`/clients/${id}`, payload),
  remove: (id) => api.delete(`/clients/${id}`),
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
  guardarComoPlantilla: (tripId, payload) => api.post(`/trips/${tripId}/itinerary/plantilla`, payload),
};

// Chat global (/api/chat, no anidado bajo un viaje): tripId es opcional. Sin
// el, es una conversacion general; con el, el asistente conoce ese viaje.
export const chatApi = {
  get: (tripId, opts) => api.get(`/chat${qs({ tripId })}`, opts),
  // Timeout propio: llama a Gemini igual que generar itinerario.
  send: (payload) => api.post('/chat', payload, { timeout: TIMEOUT_IA_MS }),
  clear: (tripId) => api.delete(`/chat${qs({ tripId })}`),
};

export const templatesApi = {
  listar: (opts) => api.get('/templates', opts),
  eliminar: (id) => api.delete(`/templates/${id}`),
  aplicar: (id, payload) => api.post(`/templates/${id}/aplicar`, payload),
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
  sugerencias: (q, opts) => api.get(`/weather/geocode/sugerencias${qs({ q })}`, opts),
};

export { ApiError } from './client.js';
