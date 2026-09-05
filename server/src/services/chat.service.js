import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import { isoDay } from '../utils/dates.js';
import { obtenerCadenaModelos } from './gemini.service.js';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
// Es texto libre, no un itinerario completo en JSON: una respuesta tarda
// bastante menos que una generacion. 60 s deja margen de sobra sin colgar
// la conversacion si Gemini esta lento.
const TIMEOUT_MS = 60000;
// Cuantos turnos guardados se mandan como contexto de la conversacion. El
// historial completo se queda en la DB de todas formas; esto solo limita el
// costo en tokens de conversaciones largas.
const TURNOS_DE_CONTEXTO = 20;

/** "hotel" -> "Hotel" para que el resumen se lea natural en la instruccion. */
function capitalizar(texto = '') {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Ciudad real de un item de lodging/localTransport via su destinationIndex.
 * Mismo patron clampeado a la defensiva que bookingLinks.service.js: un
 * indice huerfano (parada borrada) cae al destino principal, nunca truena.
 */
function ciudadDeItem(trip, item) {
  const idx = Math.min(
    Math.max(0, Number(item.destinationIndex) || 0),
    (trip.additionalDestinations || []).length
  );
  if (idx === 0) return trip.destination?.name || '';
  return trip.additionalDestinations?.[idx - 1]?.place?.name || trip.destination?.name || '';
}

/**
 * Arma el bloque de contexto del viaje en español: lo que el asistente
 * necesita para responder con datos reales en vez de inventar. Pura y
 * testeable sin llamar a Gemini. Se reconstruye en cada turno para reflejar
 * el estado actual del viaje (fechas, hospedajes, etc. pueden cambiar entre
 * un mensaje y el siguiente).
 */
export function buildTripContext(trip, itinerary) {
  if (!trip) return 'Sin viaje seleccionado.';

  const lineas = [];

  lineas.push(`Viaje: "${trip.title}"`);
  lineas.push(
    `Destino principal: ${trip.destination?.name || 'sin definir'}${
      trip.destination?.country ? `, ${trip.destination.country}` : ''
    }`
  );

  if (trip.additionalDestinations?.length) {
    const paradas = trip.additionalDestinations
      .map((p) => `${p.place?.name || 'sin nombre'} (${isoDay(p.startDate)} a ${isoDay(p.endDate)})`)
      .join('; ');
    lineas.push(`Es un viaje de varias ciudades. Paradas adicionales: ${paradas}.`);
  }

  lineas.push(
    `Fechas del viaje: ${isoDay(trip.startDate)} a ${isoDay(trip.endDate)} (${trip.durationDays || '?'} dias).`
  );
  lineas.push(`Viajeros: ${trip.travelers || 1}.`);

  if (trip.budget?.amount > 0) {
    lineas.push(`Presupuesto: ${trip.budget.amount} ${trip.budget.currency || 'MXN'}.`);
  }

  const ida = trip.transport?.outbound;
  const vuelta = trip.transport?.inbound;
  if (ida?.provider || ida?.cost > 0) {
    lineas.push(`Vuelo/transporte de ida: ${ida.provider || capitalizar(ida.mode)}, costo ${ida.cost || 0}.`);
  }
  if (vuelta?.provider || vuelta?.cost > 0) {
    lineas.push(
      `Vuelo/transporte de vuelta: ${vuelta.provider || capitalizar(vuelta.mode)}, costo ${vuelta.cost || 0}.`
    );
  }

  if (trip.lodging?.length) {
    const hospedajes = trip.lodging
      .map((l) => {
        const ciudad = ciudadDeItem(trip, l);
        const fechas = l.checkIn && l.checkOut ? ` (${isoDay(l.checkIn)} a ${isoDay(l.checkOut)})` : '';
        return `${l.name || capitalizar(l.type)} en ${ciudad}${fechas} (${l.type})`;
      })
      .join('; ');
    lineas.push(`Hospedajes ya capturados: ${hospedajes}.`);
  } else {
    lineas.push('Todavia no hay hospedaje capturado en el viaje.');
  }

  if (itinerary?.days?.length) {
    const titulos = itinerary.days.map((d) => `Dia ${d.dayNumber}: ${d.title || 'sin titulo'}`).join('; ');
    lineas.push(
      `Ya existe un itinerario ${itinerary.generatedBy === 'ia' ? 'generado con IA' : 'armado a mano'} de ${
        itinerary.days.length
      } dia(s). ${titulos}.`
    );
  } else {
    lineas.push('Todavia no hay itinerario armado para este viaje.');
  }

  return lineas.join('\n');
}

function buildSystemInstruction(trip, itinerary) {
  const contexto = trip
    ? `CONTEXTO ACTUAL DEL VIAJE\n${buildTripContext(trip, itinerary)}`
    : `Esta conversacion NO esta atada a ningun viaje en particular (modo general): no inventes datos de un viaje concreto. Si la pregunta claramente depende de datos de un viaje especifico (sus fechas, hospedajes, presupuesto), decile al agente que seleccione ese viaje en el chat para poder ayudarle con precision.`;

  return `Eres el asistente de viajes de Rumbia, una app que usan agentes de viajes para armar y vender viajes a sus clientes.

Estas hablando con el AGENTE, nunca con su cliente final. Podes:
- Dar consejo de planeacion: rutas para minimizar vuelos en viajes de varias ciudades, en que orden visitar los destinos, que tan realista es un plan.
- Responder preguntas generales de viaje: mejores epocas para volar a un destino, clima tipico, costumbres locales, documentacion, etc.
- Servir de ayuda/soporte sobre como usar Rumbia (donde esta cada seccion, como agregar un hospedaje, como compartir el itinerario, etc).
- Ayudar a decidir como ajustar el itinerario o la logistica de un viaje, cuando hay uno seleccionado.

Reglas importantes:
1. NO podes modificar ningun viaje. Si el agente pide un cambio, dale tu recomendacion y decile exactamente que pantalla o campo de Rumbia tiene que tocar para aplicarlo el mismo (ej. "abre Hospedaje, edita ese hotel y cambia las fechas de check-in/check-out").
2. Cuando dieras un dato que no es informacion en vivo (precios de vuelos, mejores fechas historicas, disponibilidad), aclaralo brevemente y sugiere verificarlo en un comparador real antes de decidir. No inventes cifras exactas de precio.
3. Respondes siempre en español, con tono cercano y practico, en respuestas cortas (unos parrafos como mucho, no ensayos).
4. Si la pregunta no tiene nada que ver con viajes ni con Rumbia, contesta con calidez y redirige a tu proposito.

${contexto}`;
}

/**
 * Manda un mensaje al asistente de chat y devuelve el texto de su respuesta.
 * `messages` es el historial completo guardado (role: 'user'|'model', text);
 * solo se manda a Gemini como contexto de conversacion, no como campo de
 * respuesta.
 */
export async function sendChatMessage({ trip, itinerary, messages }) {
  if (!env.gemini.enabled) {
    throw ApiError.serviceUnavailable(
      'El chat con IA no está configurado. Agrega GEMINI_API_KEY en el .env del servidor.'
    );
  }

  const systemInstructionText = buildSystemInstruction(trip, itinerary);
  const contents = messages.slice(-TURNOS_DE_CONTEXTO).map((m) => ({
    role: m.role,
    parts: [{ text: m.text }],
  }));

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
          systemInstruction: { parts: [{ text: systemInstructionText }] },
          contents,
          generationConfig: { temperature: 0.7 },
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        const body = await res.text().catch(() => '');

        // 400 y 403 corresponden a problemas con la API key en sí
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

        // 429, 503, 500, 502, 504 y 404: conmutar al modelo de respaldo
        const esRecuperable = [429, 503, 500, 502, 504, 404].includes(res.status);
        if (esRecuperable && !esUltimo) {
          console.warn(
            `[chat] Modelo "${modelo}" respondió ${res.status}. Conmutando a fallback "${modelos[i + 1]}"...`
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
            'El asistente está saturado en este momento. Vuelve a intentar en un minuto.'
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
          `[chat] ${modelo} | entrada ${uso.promptTokenCount ?? 0}` +
            ` | salida ${uso.candidatesTokenCount ?? 0} | total ${uso.totalTokenCount ?? 0}`
        );
      }

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        const reason = data?.candidates?.[0]?.finishReason;
        throw ApiError.serviceUnavailable(
          reason === 'SAFETY'
            ? 'El asistente bloqueó la respuesta por filtros de contenido. Prueba reformular la pregunta.'
            : 'El asistente devolvió una respuesta vacía.'
        );
      }

      return { text: text.trim(), model: modelo, uso: uso || null };
    } catch (err) {
      clearTimeout(timer);
      ultimoError = err;
      const esTimeout = err.name === 'AbortError';
      const esSaturado = err instanceof ApiError && (err.statusCode === 503 || err.statusCode === 429);

      if ((esTimeout || esSaturado) && !esUltimo) {
        console.warn(
          `[chat] Modelo "${modelo}" falló (${err.message}). Conmutando a fallback "${modelos[i + 1]}"...`
        );
        await new Promise((r) => setTimeout(r, 600));
        continue;
      }

      if (err.name === 'AbortError') {
        throw ApiError.serviceUnavailable('El asistente tardó demasiado en responder. Intenta de nuevo.');
      }
      if (err instanceof ApiError) throw err;
      throw ApiError.serviceUnavailable(`No se pudo contactar al asistente: ${err.message}`);
    }
  }

  if (ultimoError) throw ultimoError;
}

export default { sendChatMessage, buildTripContext };
