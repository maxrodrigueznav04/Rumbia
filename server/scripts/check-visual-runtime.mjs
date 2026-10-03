import { renderVisualPdf } from '../src/services/visualPdf.service.js';

const started = performance.now();
const bytes = await renderVisualPdf('<!doctype html><html lang="es"><meta charset="utf-8"><title>Prueba PDF</title><body><h1>Rumbia · propuesta de viaje</h1><p>Árbol, café, mañana. 1.250,00 MXN.</p></body></html>');
if (bytes.subarray(0, 5).toString() !== '%PDF-') throw new Error('El generador no devolvió un PDF válido.');
console.log(`[visual-pdf] PDF OK: ${bytes.length} bytes, ${Math.round(performance.now() - started)} ms. Chromium disponible.`);
