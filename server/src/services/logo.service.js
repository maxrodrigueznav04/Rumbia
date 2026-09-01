import crypto from 'node:crypto';
import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';

/**
 * Subida de logos a Cloudinary.
 *
 * Sin SDK, igual que Gemini y Resend: es una sola peticion multipart contra su
 * API REST. Render borra el disco en cada despliegue y Atlas free son 512 MB
 * que ya se usan para datos de viajes, asi que ninguno de los dos es lugar
 * para guardar imagenes.
 *
 * Firmada desde el servidor, no subida directa desde el navegador: la clave
 * secreta de Cloudinary nunca debe llegar al bundle del cliente.
 */

const API = (cloudName) => `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
const TIMEOUT_MS = 15000;

// Un logo no necesita mas resolucion que esta: el membrete lo muestra a 42px
// de alto. Limitar el tamano de entrega ahorra credito de Cloudinary, que se
// gasta tanto en almacenamiento como en transferencia.
const TRANSFORMACION = 'c_limit,w_480,h_240,q_auto,f_auto';

/** Firma de Cloudinary: SHA-1 de los parametros ordenados + la clave secreta. */
function firmar(params) {
  const cadena = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return crypto
    .createHash('sha1')
    .update(cadena + env.cloudinary.apiSecret)
    .digest('hex');
}

/**
 * Sube un logo y devuelve su URL publica.
 *
 * public_id es siempre el mismo para un usuario dado (su id de Mongo), con
 * overwrite:true: cada logo nuevo reemplaza al anterior en Cloudinary en vez
 * de acumular uno distinto por subida.
 */
export async function subirLogo({ buffer, mimeType, userId }) {
  if (!env.cloudinary.enabled) {
    throw ApiError.serviceUnavailable(
      'Subir logos no esta configurado. Agrega las claves de Cloudinary en el .env del servidor.'
    );
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const paramsFirmados = {
    folder: 'rumbia/logos',
    overwrite: 'true',
    public_id: String(userId),
    timestamp,
    transformation: TRANSFORMACION,
  };
  const signature = firmar(paramsFirmados);

  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimeType }), 'logo');
  form.append('api_key', env.cloudinary.apiKey);
  form.append('signature', signature);
  for (const [k, v] of Object.entries(paramsFirmados)) form.append(k, String(v));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(API(env.cloudinary.cloudName), {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      // Cloudinary manda el motivo en claro (clave invalida, cuenta suspendida,
      // firma mal calculada); se adjunta en vez de esconderlo.
      console.error(`[logo] Cloudinary respondio ${res.status}: ${data?.error?.message || ''}`);
      throw ApiError.serviceUnavailable(
        'No se pudo subir el logo. Intenta de nuevo en un momento.'
      );
    }

    return data.secure_url;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    const motivo = err.name === 'AbortError' ? 'tardo demasiado' : err.message;
    console.error(`[logo] Fallo la subida: ${motivo}`);
    throw ApiError.serviceUnavailable('No se pudo subir el logo. Intenta de nuevo en un momento.');
  } finally {
    clearTimeout(timer);
  }
}
