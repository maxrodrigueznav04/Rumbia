import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import { ACTIVITY_CATEGORIES } from '../models/Itinerary.js';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
// Un itinerario de 2 dias tarda ~20 s; uno de dos semanas de un solo destino
// se acerca al minuto. Uno de varias ciudades le pide al modelo mas trabajo
// por dia (ubicar cada actividad en la ciudad correcta segun el rango de
// dias, no solo generar texto suelto), asi que puede tardar mas todavia.
// 150 s da margen para el caso mas pesado que de verdad se probo (~21 dias,
// varias ciudades) sin dejar la peticion colgada para siempre. El limite de
// MAX_DIAS_GENERAR_IA (itinerary.controller.js) es 30 -- un margen modesto
// sobre ese caso probado, no una cifra que ya se haya medido aparte. Si algun
// dia se sube mucho mas alla de 30, hay que volver a medir tiempos reales (y
// probablemente partir la generacion en varias llamadas en vez de una sola).
// El timeout del cliente para generaciones (TIMEOUT_IA_MS en client.js) es
// 180 s, siempre mayor a este.
const TIMEOUT_MS = 150000;

/**
 * Esquema que se le impone a Gemini via responseSchema. Con esto la respuesta
 * llega como JSON valido y no hay que parsear texto libre ni limpiar cercas de codigo.
 */
const ITINERARY_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING', description: 'Resumen de 1-2 frases del viaje completo.' },
    days: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          dayNumber: { type: 'INTEGER' },
          // Solo se pide cuando el viaje tiene mas de una ciudad (ver
          // buildPrompt). 0 = destino principal, 1..N = parada N de la ruta.
          destinationIndex: { type: 'INTEGER', description: '0 = destino principal; 1..N = la N-esima parada de la ruta, en el orden dado.' },
          title: { type: 'STRING', description: 'Titulo corto del dia, ej. "Centro historico y mercados".' },
          summary: { type: 'STRING' },
          activities: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                time: { type: 'STRING', description: 'Hora local en formato HH:mm de 24 horas.' },
                title: { type: 'STRING' },
                description: { type: 'STRING' },
                category: { type: 'STRING', enum: ACTIVITY_CATEGORIES },
                locationName: { type: 'STRING' },
                lat: { type: 'NUMBER' },
                lng: { type: 'NUMBER' },
                estimatedCost: { type: 'NUMBER', description: 'Costo por persona en la moneda indicada.' },
                durationMinutes: { type: 'INTEGER' },
              },
              required: ['title', 'description', 'category', 'time'],
            },
          },
        },
        required: ['dayNumber', 'title', 'activities'],
      },
    },
  },
  required: ['days'],
};

/**
 * Arma la ruta completa dia por dia: destino principal + paradas, en orden
 * cronologico, rellenando los huecos entre paradas (y antes/despues de
 * todas) con el destino principal. Pura y testeable sin llamar a Gemini.
 *
 * `paradas` ya viene ordenada por startDay (itinerary.controller.js arma
 * ese orden a partir de additionalDestinations). Devuelve un tramo por
 * grupo de dias consecutivos de la misma ciudad, cada uno con
 * `destinationIndex` (0 = principal, 1..N = la N-esima parada de la ruta).
 */
export function buildRouteLines(destination, totalDays, paradas) {
  if (!paradas?.length) return [{ nombre: destination, startDay: 1, endDay: totalDays, destinationIndex: 0 }];

  const tramos = [];
  let cursor = 1;
  paradas.forEach((p, i) => {
    if (p.startDay > cursor) {
      tramos.push({ nombre: destination, startDay: cursor, endDay: p.startDay - 1, destinationIndex: 0 });
    }
    tramos.push({ nombre: p.nombre, startDay: p.startDay, endDay: p.endDay, destinationIndex: i + 1 });
    cursor = p.endDay + 1;
  });
  if (cursor <= totalDays) {
    tramos.push({ nombre: destination, startDay: cursor, endDay: totalDays, destinationIndex: 0 });
  }
  return tramos;
}

function buildPrompt(ctx) {
  const interests = ctx.interests?.length ? ctx.interests.join(', ') : 'sin preferencia declarada';
  const budgetLine = ctx.budgetAmount
    ? `Presupuesto total aproximado del viaje: ${ctx.budgetAmount} ${ctx.currency} para ${ctx.travelers} viajero(s). Ajusta las sugerencias a ese rango.`
    : `Nivel de gasto preferido: ${ctx.budgetHint || 'medio'}.`;

  // Viaje multi-ciudad: ctx.paradas trae [{ nombre, startDay, endDay }], ya
  // ordenadas por dia de inicio (itinerary.controller.js las arma asi desde
  // trip.additionalDestinations).
  const esMultiCiudad = Boolean(ctx.paradas?.length);
  const ruta = buildRouteLines(ctx.destination, ctx.days, ctx.paradas);
  const destinoLinea = esMultiCiudad
    ? `Este es un viaje de varias ciudades. Ruta, en orden:\n${ruta.map((t) => `- Dias ${t.startDay}-${t.endDay}: ${t.nombre}`).join('\n')}`
    : `Destino: ${ctx.destination}`;

  return `Eres un planificador de viajes experto${esMultiCiudad ? '' : ` en ${ctx.destination}`}. Disena un itinerario dia por dia.

DATOS DEL VIAJE
- ${destinoLinea}
- Fechas: del ${ctx.startDate} al ${ctx.endDate} (${ctx.days} dias)
- Viajeros: ${ctx.travelers}
- Intereses: ${interests}
- Ritmo deseado: ${ctx.pace || 'moderado'}
- ${budgetLine}
${ctx.extraNotes ? `- Notas del usuario: ${ctx.extraNotes}` : ''}

REGLAS
1. Genera exactamente ${ctx.days} dias, numerados del 1 al ${ctx.days}.
2. Entre 3 y 5 actividades por dia, en orden cronologico, con hora en formato HH:mm.
3. Un dia con ritmo "relajado" lleva 3 actividades; "intenso" lleva 5.
4. Agrupa geograficamente: las actividades de un mismo dia deben quedar cerca entre si para no perder tiempo en traslados.
5. Incluye al menos una comida local recomendada por dia (categoria "comida") con un lugar concreto, no generico.
6. Usa lugares reales y existentes de ${esMultiCiudad ? 'la ciudad que le toca a cada dia segun la ruta de arriba' : ctx.destination}. Incluye lat/lng aproximados de cada lugar.
7. estimatedCost es el costo POR PERSONA en ${ctx.currency}. Usa 0 si la actividad es gratuita.
8. El dia 1 debe considerar que el viajero llega ese dia (no lo satures por la manana).
9. El ultimo dia debe ser ligero, considerando la salida.
10. Escribe todo en espanol, en tono cercano y practico. Evita relleno generico tipo "explora la ciudad".${
    esMultiCiudad
      ? `\n11. Respeta estrictamente la ruta: cada dia usa SOLO lugares de la ciudad que le corresponde segun el rango de dias de arriba, nunca lugares de otra ciudad de la ruta.\n12. En cada dia, incluye destinationIndex con el valor de la ruta de arriba: 0 para los dias de "${ctx.destination}", o el numero de la parada (1 para la primera, 2 para la segunda, etc.) para los dias de esa parada.`
      : ''
  }`;
}

/**
 * Rescata una hora HH:mm de lo que sea que haya devuelto el modelo.
 * Algunos modelos ignoran la instruccion y mandan rangos ("09:00 - 13:00"),
 * formato de 12 horas ("9:00 AM") o texto suelto. Antes de descartar la hora
 * se intenta recuperar el inicio, que es lo unico que el itinerario necesita.
 */
function normalizeTime(valor) {
  if (typeof valor !== 'string') return '';
  const texto = valor.trim();

  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(texto)) return texto;

  const m = texto.match(/(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?|am|pm)?/i);
  if (!m) return '';

  let horas = Number(m[1]);
  const minutos = Number(m[2]);
  const sufijo = m[3]?.toLowerCase().replace(/\./g, '');

  if (sufijo === 'pm' && horas < 12) horas += 12;
  if (sufijo === 'am' && horas === 12) horas = 0;

  if (horas > 23 || minutos > 59) return '';
  return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
}

/** Normaliza la respuesta cruda de Gemini al shape del modelo Itinerary. */
function normalizeDays(raw, expectedDays, maxDestinationIndex = 0) {
  const days = Array.isArray(raw?.days) ? raw.days : [];

  return days.slice(0, expectedDays).map((day, dayIdx) => ({
    dayNumber: Number(day.dayNumber) || dayIdx + 1,
    // Salvaguarda ante alucinaciones del modelo: nunca un indice fuera del
    // rango de paradas reales del viaje.
    destinationIndex: Math.min(Math.max(0, Number(day.destinationIndex) || 0), maxDestinationIndex),
    title: String(day.title || `Día ${dayIdx + 1}`).slice(0, 160),
    summary: String(day.summary || '').slice(0, 600),
    activities: (Array.isArray(day.activities) ? day.activities : []).map((act, actIdx) => {
      const lat = Number(act.lat);
      const lng = Number(act.lng);
      const hasCoords =
        Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

      return {
        time: normalizeTime(act.time),
        title: String(act.title || 'Actividad').slice(0, 160),
        description: String(act.description || '').slice(0, 800),
        category: ACTIVITY_CATEGORIES.includes(act.category) ? act.category : 'otro',
        location: {
          name: String(act.locationName || '').slice(0, 160),
          address: '',
          ...(hasCoords ? { lat, lng } : {}),
        },
        estimatedCost: Math.max(0, Number(act.estimatedCost) || 0),
        durationMinutes: Math.min(1440, Math.max(0, Number(act.durationMinutes) || 60)),
        source: 'ia',
        order: actIdx,
      };
    }),
  }));
}

// "gemini-2.0-flash" y "gemini-1.5-flash" vivian aqui y Google ya los retiro
// (dejaron de existir para generateContent) -- confirmado con
// scripts/gemini-modelos.mjs, que lista los modelos reales de la API key en
// uso. "gemini-flash-latest" es el alias que Google mantiene apuntando al
// flash vigente: se agrega como ultimo respaldo justo para que esta lista no
// vuelva a quedar obsoleta sola con el tiempo.
export const MODELOS_FALLBACK = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest'];

export function obtenerCadenaModelos(modeloPrincipal) {
  const principal = modeloPrincipal || 'gemini-2.5-flash';
  const lista = [principal];
  for (const m of MODELOS_FALLBACK) {
    if (!lista.includes(m)) lista.push(m);
  }
  return lista;
}

/**
 * Llama a Gemini y devuelve { days, summary, model, uso }.
 * Si el modelo principal está saturado (503), sin cuota (429) o tarda demasiado,
 * conmuta automáticamente a los modelos de respaldo (gemini-2.0-flash, etc.)
 * para que el usuario nunca sufra caídas ni demoras.
 */
export async function generateItinerary(ctx) {
  if (!env.gemini.enabled) {
    throw ApiError.serviceUnavailable(
      'La generación con IA no está configurada. Agrega GEMINI_API_KEY en el .env del servidor.'
    );
  }

  const promptText = buildPrompt(ctx);
  const modelos = obtenerCadenaModelos(env.gemini.model);
  let ultimoError = null;

  for (let i = 0; i < modelos.length; i += 1) {
    const modelo = modelos[i];
    const esUltimo = i === modelos.length - 1;
    const url = `${API_BASE}/${modelo}:generateContent`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': env.gemini.apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: promptText }] }],
          generationConfig: {
            temperature: 0.9,
            responseMimeType: 'application/json',
            responseSchema: ITINERARY_SCHEMA,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        const body = await res.text().catch(() => '');

        // 400 y 403 son problemas de la API key en sí (no del modelo): no tiene caso reintentar.
        if (res.status === 400 || res.status === 403) {
          let motivo = '';
          try {
            motivo = JSON.parse(body)?.error?.message || '';
          } catch {
            motivo = body;
          }
          throw ApiError.serviceUnavailable(
            'La API key de Gemini es inválida o no tiene permisos. Revisa GEMINI_API_KEY donde esté desplegado el servidor.',
            motivo.slice(0, 300) || undefined
          );
        }

        // 429, 503, 500, 502, 504 y 404 (modelo retirado o no disponible): salta a respaldo.
        const esRecuperable = [429, 503, 500, 502, 504, 404].includes(res.status);
        if (esRecuperable && !esUltimo) {
          console.warn(
            `[gemini] Modelo "${modelo}" respondió ${res.status}. Conmutando a fallback "${modelos[i + 1]}"...`
          );
          await new Promise((r) => setTimeout(r, 600));
          continue;
        }

        if (res.status === 429) {
          throw ApiError.serviceUnavailable(
            'La cuota de la API de Gemini se agotó por ahora. Intenta en unos minutos.'
          );
        }
        if (res.status === 503) {
          throw ApiError.serviceUnavailable(
            'El modelo de Gemini está saturado en este momento. Vuelve a intentar en un minuto.'
          );
        }
        if (res.status === 404) {
          throw ApiError.serviceUnavailable(
            `El modelo "${modelo}" no está disponible para esta API key. Cambia GEMINI_MODEL en el .env del servidor.`,
            body.slice(0, 300)
          );
        }
        throw ApiError.serviceUnavailable(`Gemini respondió ${res.status}.`, body.slice(0, 300));
      }

      const data = await res.json();
      const uso = data?.usageMetadata;
      if (uso) {
        console.log(
          `[gemini] ${modelo} | ${ctx.days} dias | entrada ${uso.promptTokenCount ?? 0}` +
            ` | salida ${uso.candidatesTokenCount ?? 0} | total ${uso.totalTokenCount ?? 0}`
        );
      }

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        const reason = data?.candidates?.[0]?.finishReason;
        throw ApiError.serviceUnavailable(
          reason === 'SAFETY'
            ? 'Gemini bloqueó la respuesta por filtros de contenido. Prueba con otras notas.'
            : 'Gemini devolvió una respuesta vacía.'
        );
      }

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw ApiError.serviceUnavailable('Gemini devolvió un JSON malformado.');
      }

      const normalized = normalizeDays(parsed, ctx.days, ctx.paradas?.length || 0);
      if (!normalized.length) {
        throw ApiError.serviceUnavailable('Gemini no generó ningún día de itinerario.');
      }

      return {
        days: normalized,
        summary: parsed.summary || '',
        model: modelo,
        uso: uso || null,
      };
    } catch (err) {
      clearTimeout(timer);
      ultimoError = err;
      const esTimeout = err.name === 'AbortError';
      const esSaturado = err instanceof ApiError && (err.status === 503 || err.status === 429);

      if ((esTimeout || esSaturado) && !esUltimo) {
        console.warn(
          `[gemini] Modelo "${modelo}" falló (${err.message}). Conmutando a fallback "${modelos[i + 1]}"...`
        );
        await new Promise((r) => setTimeout(r, 600));
        continue;
      }

      if (err.name === 'AbortError') {
        throw ApiError.serviceUnavailable('Gemini tardó demasiado en responder. Intenta de nuevo.');
      }
      if (err instanceof ApiError) throw err;
      throw ApiError.serviceUnavailable(`No se pudo contactar a Gemini: ${err.message}`);
    }
  }

  if (ultimoError) throw ultimoError;
}

export default { generateItinerary, MODELOS_FALLBACK, obtenerCadenaModelos };
