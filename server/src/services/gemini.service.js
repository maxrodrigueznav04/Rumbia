import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import { ACTIVITY_CATEGORIES } from '../models/Itinerary.js';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
// Un itinerario de 2 dias tarda ~20 s; uno de dos semanas se acerca al minuto.
// 90 s da margen sin dejar la peticion colgada para siempre.
const TIMEOUT_MS = 90000;

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

function buildPrompt(ctx) {
  const interests = ctx.interests?.length ? ctx.interests.join(', ') : 'sin preferencia declarada';
  const budgetLine = ctx.budgetAmount
    ? `Presupuesto total aproximado del viaje: ${ctx.budgetAmount} ${ctx.currency} para ${ctx.travelers} viajero(s). Ajusta las sugerencias a ese rango.`
    : `Nivel de gasto preferido: ${ctx.budgetHint || 'medio'}.`;

  return `Eres un planificador de viajes experto en ${ctx.destination}. Disena un itinerario dia por dia.

DATOS DEL VIAJE
- Destino: ${ctx.destination}
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
6. Usa lugares reales y existentes de ${ctx.destination}. Incluye lat/lng aproximados de cada lugar.
7. estimatedCost es el costo POR PERSONA en ${ctx.currency}. Usa 0 si la actividad es gratuita.
8. El dia 1 debe considerar que el viajero llega ese dia (no lo satures por la manana).
9. El ultimo dia debe ser ligero, considerando la salida.
10. Escribe todo en espanol, en tono cercano y practico. Evita relleno generico tipo "explora la ciudad".`;
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
function normalizeDays(raw, expectedDays) {
  const days = Array.isArray(raw?.days) ? raw.days : [];

  return days.slice(0, expectedDays).map((day, dayIdx) => ({
    dayNumber: Number(day.dayNumber) || dayIdx + 1,
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

/**
 * Llama a Gemini y devuelve { days, summary, model }.
 * Lanza ApiError 503 si la API falla: el cliente muestra el fallback y el
 * usuario siempre puede armar el itinerario a mano.
 */
export async function generateItinerary(ctx) {
  if (!env.gemini.enabled) {
    throw ApiError.serviceUnavailable(
      'La generación con IA no está configurada. Agrega GEMINI_API_KEY en el .env del servidor.'
    );
  }

  const url = `${API_BASE}/${env.gemini.model}:generateContent`;
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
        contents: [{ role: 'user', parts: [{ text: buildPrompt(ctx) }] }],
        generationConfig: {
          temperature: 0.9,
          responseMimeType: 'application/json',
          responseSchema: ITINERARY_SCHEMA,
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      if (res.status === 429) {
        throw ApiError.serviceUnavailable(
          'La cuota de la API de Gemini se agotó por ahora. Intenta en unos minutos.'
        );
      }
      if (res.status === 400 || res.status === 403) {
        // Google usa el mismo par de códigos para "la key no existe", "la key
        // está restringida por IP/referrer" y "falta habilitar la API", y el
        // mensaje suelto no deja distinguirlos. Se adjunta el suyo: sin esto
        // hay que adivinar cuál de los tres es, sobre todo cuando la key del
        // servidor desplegado no es la misma que la del .env local.
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
      if (res.status === 404) {
        // Google retira modelos viejos para keys nuevas y el 404 no lo deja claro.
        throw ApiError.serviceUnavailable(
          `El modelo "${env.gemini.model}" no está disponible para esta API key. Cambia GEMINI_MODEL en el .env del servidor.`,
          body.slice(0, 300)
        );
      }
      if (res.status === 503) {
        throw ApiError.serviceUnavailable(
          'El modelo de Gemini está saturado en este momento. Vuelve a intentar en un minuto.'
        );
      }
      throw ApiError.serviceUnavailable(`Gemini respondió ${res.status}.`, body.slice(0, 300));
    }

    const data = await res.json();

    // Google no cobra el nivel gratuito, pero para saber si el negocio cierra
    // hay que conocer el costo por generacion ANTES de tener trafico. Este es
    // el unico punto donde existe el dato por itinerario: la consola de AI
    // Studio agrega por dia y ahi ya no se puede separar una generacion suelta.
    const uso = data?.usageMetadata;
    if (uso) {
      console.log(
        `[gemini] ${env.gemini.model} | ${ctx.days} dias | entrada ${uso.promptTokenCount ?? 0}` +
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

    const normalized = normalizeDays(parsed, ctx.days);
    if (!normalized.length) {
      throw ApiError.serviceUnavailable('Gemini no generó ningún día de itinerario.');
    }

    return {
      days: normalized,
      summary: parsed.summary || '',
      model: env.gemini.model,
      uso: uso || null,
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      throw ApiError.serviceUnavailable('Gemini tardó demasiado en responder. Intenta de nuevo.');
    }
    if (err instanceof ApiError) throw err;
    throw ApiError.serviceUnavailable(`No se pudo contactar a Gemini: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }
}

export default { generateItinerary };
