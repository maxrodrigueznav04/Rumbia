import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ApiError from '../utils/ApiError.js';

const workerPath = fileURLToPath(new URL('../workers/visualPdf.worker.js', import.meta.url));
const MAX_PDF_BYTES = 25 * 1024 * 1024;
let activeRenders = 0;

export function renderVisualPdf(html) {
  if (activeRenders >= 2) return Promise.reject(ApiError.tooMany('El generador de PDF está ocupado. Intenta de nuevo en un momento.'));
  activeRenders += 1;
  return new Promise((resolve, reject) => {
    if (Buffer.byteLength(html, 'utf8') > 2 * 1024 * 1024) {
      reject(ApiError.badRequest('La propuesta es demasiado grande para generar el PDF.'));
      return;
    }
    const child = spawn(process.execPath, [workerPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_OPTIONS: '' },
      windowsHide: true,
    });
    const chunks = [];
    let bytes = 0;
    let errors = '';
    let done = false;
    const timeout = setTimeout(() => child.kill(), 45000);
    const finish = (err, buffer) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      if (err) reject(err);
      else resolve(buffer);
    };
    child.stdout.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_PDF_BYTES) child.kill();
      else chunks.push(chunk);
    });
    child.stderr.on('data', (chunk) => { errors = (errors + chunk.toString()).slice(-1500); });
    child.on('error', () => finish(ApiError.serviceUnavailable('No se pudo iniciar el generador de PDF.')));
    child.on('close', (code) => {
      if (bytes > MAX_PDF_BYTES) return finish(ApiError.badRequest('El PDF generado es demasiado grande.'));
      if (code !== 0) {
        console.error('[propuestas] Renderizador PDF:', errors || `salida ${code}`);
        if (errors.includes('Hay contenido que no cabe')) {
          return finish(ApiError.badRequest('Hay texto que no cabe en una página fija. Ajusta su tamaño o el cuadro de texto en la propuesta.'));
        }
        if (errors.includes('No se pudo cargar una imagen')) {
          return finish(ApiError.badRequest('Una imagen de la propuesta no pudo cargarse. Revísala antes de emitir el PDF.'));
        }
        return finish(ApiError.serviceUnavailable('No se pudo generar el PDF de la propuesta.'));
      }
      return finish(null, Buffer.concat(chunks));
    });
    child.stdin.on('error', () => {});
    child.stdin.end(html);
  }).finally(() => { activeRenders -= 1; });
}
