/**
 * Cliente HTTP minimo sobre fetch.
 * - La sesion vive en una cookie httpOnly que pone el servidor: el navegador
 *   la manda solo (credentials:'include'), este archivo nunca la toca ni
 *   podria -- httpOnly la esconde incluso de este mismo codigo.
 * - Normaliza los errores del backend en un objeto Error con .status y .details.
 * - Si la cookie ya vencio (401) avisa para redirigir al login.
 */

export const BASE_URL = import.meta.env.VITE_API_URL || '/api';

// La cookie de sesion es invisible para JS a proposito (httpOnly), asi que
// no hay forma de preguntarle al navegador "¿tengo sesion?" antes de mandar
// una peticion. Esta bandera NO es un secreto -- no sirve para autenticar
// nada, solo recuerda si ESTE navegador inicio sesion alguna vez, para poder
// distinguir "nunca entraste" de "tu sesion vencio" al abrir la app o al
// toparse con un 401. Si alguien la manipulara a mano no ganaria nada: sin
// la cookie de verdad, el servidor sigue rechazando todo.
const FLAG_SESION = 'rumbia_tuvo_sesion';
export const sesionFlag = {
  marcar: () => localStorage.setItem(FLAG_SESION, '1'),
  tuvoSesion: () => localStorage.getItem(FLAG_SESION) === '1',
  limpiar: () => localStorage.removeItem(FLAG_SESION),
};

/** Evento que escucha AuthContext para cerrar sesion si el token caduca. */
export const SESION_EXPIRADA = 'rumbia:sesion-expirada';

/**
 * Eventos para avisar que el servidor está tardando.
 *
 * En el plan gratuito de Render el servicio se duerme tras 15 minutos sin
 * tráfico y la primera petición tarda ~30-50 s en despertarlo. Sin avisar,
 * el usuario solo ve un spinner eterno y asume que la app está rota.
 */
export const SERVIDOR_LENTO = 'rumbia:servidor-lento';
export const SERVIDOR_LISTO = 'rumbia:servidor-listo';

const MS_ANTES_DE_AVISAR = 4000;
// Suficiente para cubrir el arranque en frío de Render sin colgarse para siempre.
const TIMEOUT_MS = 70000;

/**
 * La generación con IA es la única llamada que puede tardar minutos: el
 * servidor le da 90 s a Gemini y encima puede sumarse el arranque en frío de
 * Render (~50 s). Con el timeout general de 70 s el navegador abortaba antes
 * de que el servidor terminara: el itinerario quedaba guardado y aun así se
 * veía un error. El del cliente tiene que ser mayor que el del servidor.
 */
export const TIMEOUT_IA_MS = 180000;

let peticionesEnVuelo = 0;

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request(path, { method = 'GET', body, signal, timeout = TIMEOUT_MS } = {}) {
  const headers = {};
  // FormData (subir un archivo) trae su propio Content-Type con el boundary
  // multipart; si se fija aqui a mano, el navegador no puede completarlo y la
  // peticion llega sin poder separar los campos.
  if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';

  // Timeout propio, combinado con el signal que traiga quien llama (para cancelar
  // al desmontar el componente).
  const controlador = new AbortController();
  const alTiempo = setTimeout(() => controlador.abort('timeout'), timeout);
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
      // Cliente y API viven en subdominios distintos del mismo sitio
      // (rumbiamx.com / api.rumbiamx.com): sin esto el navegador no manda ni
      // guarda la cookie de sesion en una peticion "cross-origin" como esta,
      // aunque sea del mismo sitio.
      credentials: 'include',
      body: body === undefined || body instanceof FormData ? body : JSON.stringify(body),
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
    // Solo avisa "tu sesion vencio" si este navegador de verdad tuvo una: sin
    // eso, la llamada de arranque a /auth/me de un visitante que nunca se
    // registro (que tambien da 401, porque nunca hubo cookie) mostraria el
    // mismo aviso por error.
    if (res.status === 401 && sesionFlag.tuvoSesion()) {
      sesionFlag.limpiar();
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
