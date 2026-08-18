/**
 * Cliente HTTP minimo sobre fetch.
 * - Adjunta el JWT automaticamente.
 * - Normaliza los errores del backend en un objeto Error con .status y .details.
 * - Si el token expira (401) limpia la sesion y avisa para redirigir al login.
 */

const BASE_URL = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'rumbo_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

/** Evento que escucha AuthContext para cerrar sesion si el token caduca. */
export const SESION_EXPIRADA = 'rumbo:sesion-expirada';

/**
 * Eventos para avisar que el servidor está tardando.
 *
 * En el plan gratuito de Render el servicio se duerme tras 15 minutos sin
 * tráfico y la primera petición tarda ~30-50 s en despertarlo. Sin avisar,
 * el usuario solo ve un spinner eterno y asume que la app está rota.
 */
export const SERVIDOR_LENTO = 'rumbo:servidor-lento';
export const SERVIDOR_LISTO = 'rumbo:servidor-listo';

const MS_ANTES_DE_AVISAR = 4000;
// Suficiente para cubrir el arranque en frío de Render sin colgarse para siempre.
const TIMEOUT_MS = 70000;

let peticionesEnVuelo = 0;

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request(path, { method = 'GET', body, signal, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const token = tokenStore.get();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  // Timeout propio, combinado con el signal que traiga quien llama (para cancelar
  // al desmontar el componente).
  const controlador = new AbortController();
  const alTiempo = setTimeout(() => controlador.abort('timeout'), TIMEOUT_MS);
  signal?.addEventListener('abort', () => controlador.abort(signal.reason), { once: true });

  // Si tarda, se avisa; el banner desaparece cuando ya no queda nada en vuelo.
  peticionesEnVuelo += 1;
  const avisoLento = setTimeout(
    () => window.dispatchEvent(new CustomEvent(SERVIDOR_LENTO)),
    MS_ANTES_DE_AVISAR
  );

  const limpiar = () => {
    clearTimeout(alTiempo);
    clearTimeout(avisoLento);
    peticionesEnVuelo = Math.max(0, peticionesEnVuelo - 1);
    if (peticionesEnVuelo === 0) window.dispatchEvent(new CustomEvent(SERVIDOR_LISTO));
  };

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controlador.signal,
    });
  } catch (err) {
    limpiar();
    // Cancelación del componente: se propaga tal cual para que nadie la trate como error.
    if (signal?.aborted) throw Object.assign(new Error('Cancelado'), { name: 'AbortError' });
    if (controlador.signal.reason === 'timeout') {
      throw new ApiError(
        'El servidor tardó demasiado en responder. Si es la primera petición del día, puede estar despertando: intenta de nuevo.',
        0
      );
    }
    // Servidor caido, sin internet o CORS: mensaje util, no un "Failed to fetch" pelado.
    throw new ApiError('No se pudo conectar con el servidor. Revisa tu conexión.', 0);
  }

  limpiar();

  if (res.status === 204) return null;

  const texto = await res.text();
  let data = null;
  try {
    data = texto ? JSON.parse(texto) : null;
  } catch {
    throw new ApiError('El servidor devolvio una respuesta ilegible.', res.status);
  }

  if (!res.ok) {
    if (res.status === 401 && token) {
      tokenStore.clear();
      window.dispatchEvent(new CustomEvent(SESION_EXPIRADA));
    }
    throw new ApiError(data?.message || `Error ${res.status}.`, res.status, data?.details);
  }

  return data?.data !== undefined ? data.data : data;
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
  delete: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
};

export default api;
