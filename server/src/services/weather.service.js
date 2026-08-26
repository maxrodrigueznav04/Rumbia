import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import { isoDay } from '../utils/dates.js';

const GEO_URL = 'https://api.openweathermap.org/geo/1.0/direct';
const FORECAST_URL = 'https://api.openweathermap.org/data/2.5/forecast';
// Photon (proyecto de OpenStreetMap/Komoot) resuelve nombres parciales
// ("Guadalaj" -> Guadalajara); la API de geocodificacion de OpenWeatherMap
// no: exige el nombre casi completo, asi que sirve para resolver un lugar al
// guardar pero no para sugerir mientras se escribe. Es publica y sin llave.
const PHOTON_URL = 'https://photon.komoot.io/api/';
const TIMEOUT_MS = 10000;
const FORECAST_HORIZON_DAYS = 5; // el tier gratuito solo pronostica 5 dias

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      if (res.status === 401) throw ApiError.serviceUnavailable('La API key de OpenWeatherMap es inválida.');
      if (res.status === 429) throw ApiError.serviceUnavailable('Se agotó la cuota diaria de OpenWeatherMap.');
      throw ApiError.serviceUnavailable(`OpenWeatherMap respondió ${res.status}.`);
    }
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') throw ApiError.serviceUnavailable('OpenWeatherMap tardó demasiado en responder.');
    if (err instanceof ApiError) throw err;
    throw ApiError.serviceUnavailable(`No se pudo contactar a OpenWeatherMap: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Convierte "Oaxaca, Mexico" en coordenadas. Devuelve null si no hay match. */
export async function geocode(query) {
  if (!env.openWeather.enabled) return null;
  const url = `${GEO_URL}?q=${encodeURIComponent(query)}&limit=1&appid=${env.openWeather.apiKey}`;
  const data = await fetchJson(url);
  if (!Array.isArray(data) || !data.length) return null;
  const [hit] = data;
  return { name: hit.name, country: hit.country, state: hit.state, lat: hit.lat, lng: hit.lon };
}

/**
 * Varios lugares que podrian coincidir con lo que se esta escribiendo, para
 * un autocompletado. A diferencia de geocode() (que resuelve UN lugar al
 * guardar, con OpenWeatherMap), aqui interesa dejar que la persona elija
 * entre "Guadalajara, Mexico" y "Guadalajara, Spain" mientras todavia esta
 * escribiendo — para eso hace falta Photon, no OpenWeatherMap.
 *
 * No depende de que OpenWeatherMap este configurado: Photon es publico y no
 * pide llave. Si Photon no responde (esta caido, tarda, lo que sea), aqui se
 * traga el error y regresa una lista vacia: el campo de destino sigue
 * funcionando como texto libre, la sugerencia es un plus, no un requisito.
 */
export async function geocodeSugerencias(query, limit = 5) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // Photon solo acepta "default", "de", "en" o "fr" como idioma: "es" tira
    // un 400. "en" da nombres de pais en ingles (Mexico, Spain), que aqui es
    // solo la etiqueta de la sugerencia, no el texto final que se guarda.
    const url = `${PHOTON_URL}?q=${encodeURIComponent(query)}&limit=${limit}&lang=en&osm_tag=place`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.features || [])
      .filter((f) => f.properties?.name)
      .map((f) => ({
        name: f.properties.name,
        country: f.properties.country,
        state: f.properties.state,
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
      }));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Climatologia aproximada por latitud y mes.
 *
 * OpenWeatherMap solo da pronostico real a 5 dias en el tier gratuito, y la API
 * de promedios historicos es de pago. Para viajes lejanos en el tiempo se estima
 * la temperatura con un modelo estacional sencillo: temperatura base segun la
 * latitud + oscilacion sinusoidal segun el mes (invertida en el hemisferio sur).
 * Es una ESTIMACION y la respuesta lo marca como tal para no enganar al usuario.
 */
function climateEstimate(lat, date) {
  const absLat = Math.abs(lat);
  const month = new Date(date).getUTCMonth(); // 0-11

  // Media anual aproximada: ~27 C en el ecuador bajando hasta ~-15 C en los polos.
  const annualMean = 27 - 0.42 * absLat;

  // Amplitud estacional: casi nula en el tropico, fuerte en latitudes altas.
  const amplitude = 1 + 0.28 * absLat;

  // Julio (mes 6) es el pico en el hemisferio norte; enero en el sur.
  const phase = lat >= 0 ? 6 : 0;
  const seasonal = Math.cos(((month - phase) / 12) * 2 * Math.PI) * amplitude;

  const mean = annualMean + seasonal;
  return {
    tempMin: Number((mean - 5).toFixed(1)),
    tempMax: Number((mean + 5).toFixed(1)),
    tempAvg: Number(mean.toFixed(1)),
  };
}

/**
 * Minimo de lecturas de 3 h para caracterizar un dia (12 horas de cobertura).
 * El ultimo dia de la ventana suele traer una o dos lecturas sueltas: sacar
 * min/max de ahi da rangos absurdos (25.1/25.1 con una sola muestra nocturna),
 * peores que la propia climatologia. Esos dias se degradan a estimacion.
 */
const MIN_MUESTRAS_POR_DIA = 4;

/** Agrupa el forecast de 3 horas en un resumen por dia. */
function groupForecastByDay(list) {
  const byDay = new Map();

  for (const entry of list) {
    const day = entry.dt_txt.slice(0, 10);
    if (!byDay.has(day)) {
      byDay.set(day, { date: day, temps: [], conditions: [], pops: [], icons: [] });
    }
    const bucket = byDay.get(day);
    bucket.temps.push(entry.main.temp);
    bucket.conditions.push(entry.weather?.[0]?.description || '');
    bucket.icons.push(entry.weather?.[0]?.icon || '');
    bucket.pops.push(entry.pop ?? 0);
  }

  return [...byDay.values()]
    // Dias con muy pocas lecturas quedan fuera: el consumidor los rellena con
    // la estimacion climatologica, que para un dia incompleto es mas fiel.
    .filter((b) => b.temps.length >= MIN_MUESTRAS_POR_DIA)
    .map((b) => {
      // La condicion mas repetida del dia representa mejor que la de una hora suelta.
      const counts = b.conditions.reduce((acc, c) => acc.set(c, (acc.get(c) || 0) + 1), new Map());
      const dominant = [...counts.entries()].sort((a, z) => z[1] - a[1])[0]?.[0] || '';
      const iconIdx = b.conditions.indexOf(dominant);

      return {
        date: b.date,
        tempMin: Number(Math.min(...b.temps).toFixed(1)),
        tempMax: Number(Math.max(...b.temps).toFixed(1)),
        tempAvg: Number((b.temps.reduce((s, t) => s + t, 0) / b.temps.length).toFixed(1)),
        condition: dominant,
        icon: b.icons[iconIdx >= 0 ? iconIdx : 0] || '01d',
        precipitationChance: Math.round(Math.max(...b.pops) * 100),
        source: 'pronostico',
        muestras: b.temps.length,
      };
    });
}

/**
 * Clima para un rango de fechas. Combina pronostico real (proximos 5 dias) con
 * estimacion climatologica para el resto. Nunca lanza por falta de datos: si
 * OpenWeather no esta configurado devuelve solo estimaciones.
 */
export async function getWeatherForRange({ lat, lng, startDate, endDate }) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const today = new Date();
  const horizon = new Date(today.getTime() + FORECAST_HORIZON_DAYS * 86400000);

  const days = [];
  for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 86400000)) {
    days.push(new Date(d));
  }

  let forecastByDate = new Map();
  let forecastError = null;
  const rangeOverlapsForecast = start <= horizon && end >= today;

  if (env.openWeather.enabled && rangeOverlapsForecast) {
    try {
      const url = `${FORECAST_URL}?lat=${lat}&lon=${lng}&units=metric&lang=es&appid=${env.openWeather.apiKey}`;
      const data = await fetchJson(url);
      forecastByDate = new Map(groupForecastByDay(data.list || []).map((d) => [d.date, d]));
    } catch (err) {
      // Degradar con elegancia: se cae a estimacion y se avisa en la respuesta.
      forecastError = err.message;
    }
  }

  const result = days.map((date) => {
    const key = isoDay(date);
    if (forecastByDate.has(key)) return forecastByDate.get(key);

    const est = climateEstimate(lat, date);
    return {
      date: key,
      ...est,
      condition: 'estimación según la temporada',
      icon: null,
      precipitationChance: null,
      source: 'estimacion-historica',
    };
  });

  return {
    days: result,
    meta: {
      forecastAvailable: forecastByDate.size > 0,
      estimatedDays: result.filter((d) => d.source === 'estimacion-historica').length,
      configured: env.openWeather.enabled,
      ...(forecastError ? { warning: forecastError } : {}),
    },
  };
}

export default { geocode, geocodeSugerencias, getWeatherForRange };
