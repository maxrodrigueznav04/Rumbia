import crypto from 'node:crypto';
import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';

const API = (name, action) => `https://api.cloudinary.com/v1_1/${name}/image/${action}`;
const TIMEOUT_MS = 20000;

function signature(params) {
  return crypto.createHash('sha1').update(
    Object.keys(params).sort().map((key) => `${key}=${params[key]}`).join('&') + env.cloudinary.apiSecret
  ).digest('hex');
}

export function inspectProposalImage(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 32) throw ApiError.badRequest('La imagen está vacía o dañada.');
  let mimeType;
  let width;
  let height;
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    mimeType = 'image/png';
    width = buffer.readUInt32BE(16);
    height = buffer.readUInt32BE(20);
  } else if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    mimeType = 'image/jpeg';
    let cursor = 2;
    while (cursor + 9 < buffer.length) {
      if (buffer[cursor] !== 0xff) break;
      const marker = buffer[cursor + 1];
      if (marker === 0xd9 || marker === 0xda) break;
      const size = buffer.readUInt16BE(cursor + 2);
      if (size < 2 || cursor + 2 + size > buffer.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        height = buffer.readUInt16BE(cursor + 5);
        width = buffer.readUInt16BE(cursor + 7);
        break;
      }
      cursor += 2 + size;
    }
  }
  if (!mimeType || !width || !height) throw ApiError.badRequest('La imagen debe ser PNG o JPEG válido.');
  if (width < 300 || height < 300 || width > 6000 || height > 6000 || width * height > 20000000) {
    throw ApiError.badRequest('La imagen debe medir entre 300 y 6000 píxeles por lado y no superar 20 megapíxeles.');
  }
  return { mimeType, width, height };
}

export async function uploadProposalImage({ buffer, mimeType, agencyId }) {
  if (!env.cloudinary.enabled) throw ApiError.serviceUnavailable('La biblioteca de imágenes no está configurada.');
  const params = {
    folder: `rumbia/propuestas/${agencyId}`,
    public_id: crypto.randomUUID(),
    timestamp: Math.floor(Date.now() / 1000),
    transformation: 'c_limit,w_2400,h_2400,q_auto,f_auto',
  };
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimeType }), 'propuesta');
  form.append('api_key', env.cloudinary.apiKey);
  form.append('signature', signature(params));
  for (const [key, value] of Object.entries(params)) form.append(key, String(value));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(API(env.cloudinary.cloudName, 'upload'), { method: 'POST', body: form, signal: controller.signal });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.secure_url || !result?.public_id) throw new Error(result?.error?.message || 'Respuesta de Cloudinary incompleta');
    return { url: result.secure_url, publicId: result.public_id, width: result.width, height: result.height };
  } catch (err) {
    console.error('[propuestas] Falló la subida de imagen:', err.message);
    throw ApiError.serviceUnavailable('No se pudo subir la imagen. Intenta de nuevo.');
  } finally {
    clearTimeout(timer);
  }
}

export async function deleteProposalImage(publicId) {
  if (!env.cloudinary.enabled) return;
  const params = { public_id: publicId, timestamp: Math.floor(Date.now() / 1000) };
  const form = new FormData();
  form.append('public_id', publicId);
  form.append('api_key', env.cloudinary.apiKey);
  form.append('timestamp', String(params.timestamp));
  form.append('signature', signature(params));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(API(env.cloudinary.cloudName, 'destroy'), { method: 'POST', body: form, signal: controller.signal });
    if (!response.ok) throw new Error(`Cloudinary ${response.status}`);
  } finally {
    clearTimeout(timer);
  }
}
