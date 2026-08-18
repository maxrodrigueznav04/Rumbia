import { isoDay } from '../utils/dates.js';

/**
 * Constructor de enlaces de salida hacia comparadores reales.
 *
 * IMPORTANTE: la app no reserva ni cobra nada. Solo arma la URL de busqueda con
 * los datos del viaje ya prellenados y manda al usuario al sitio del proveedor,
 * donde completa la reserva. Son links publicos de busqueda, sin afiliados.
 */

const enc = encodeURIComponent;

/** Skyscanner usa el formato aaMMdd en la ruta de fechas. */
function skyscannerDate(date) {
  const iso = isoDay(date);
  return iso ? iso.slice(2).replace(/-/g, '') : '';
}

/** Slug para rutas tipo Rome2Rio: "Ciudad de Mexico" -> "Ciudad-de-Mexico". */
function slug(text = '') {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function flightLinks({ origin, destination, startDate, endDate, travelers, originCode, destCode }) {
  const links = [];

  // Con codigos IATA se puede llegar directo a resultados; si no, a la busqueda general.
  if (originCode && destCode && startDate && endDate) {
    links.push({
      provider: 'Skyscanner',
      label: 'Ver vuelos redondos',
      url: `https://www.skyscanner.com.mx/transport/flights/${enc(originCode.toLowerCase())}/${enc(
        destCode.toLowerCase()
      )}/${skyscannerDate(startDate)}/${skyscannerDate(endDate)}/?adults=${travelers || 1}`,
    });
  } else {
    links.push({
      provider: 'Skyscanner',
      label: 'Buscar vuelos',
      url: 'https://www.skyscanner.com.mx/transport/vuelos/',
    });
  }

  links.push({
    provider: 'Google Flights',
    label: 'Comparar precios',
    url: `https://www.google.com/travel/flights?q=${enc(
      `vuelos de ${origin || ''} a ${destination || ''} ${isoDay(startDate) || ''} regreso ${
        isoDay(endDate) || ''
      }`
    )}`,
  });

  links.push({
    provider: 'Kayak',
    label: 'Ver alternativas',
    url: `https://www.kayak.com.mx/flight-routes?search=${enc(destination || '')}`,
  });

  return links;
}

function busLinks({ origin, destination, startDate }) {
  return [
    {
      provider: 'Rome2Rio',
      label: 'Rutas y lineas disponibles',
      url: `https://www.rome2rio.com/es/map/${slug(origin) || 'origen'}/${slug(destination) || 'destino'}`,
    },
    {
      provider: 'Busbud',
      label: 'Buscar autobuses',
      url: `https://www.busbud.com/es/autobus-${slug(origin).toLowerCase()}-${slug(
        destination
      ).toLowerCase()}${startDate ? `?outbound_date=${isoDay(startDate)}` : ''}`,
    },
    {
      provider: 'ClickBus',
      label: 'Boletos de autobus (MX)',
      url: 'https://www.clickbus.com.mx/',
    },
  ];
}

function carLinks({ origin, destination }) {
  return [
    {
      provider: 'Google Maps',
      label: 'Ver ruta y distancia',
      url: `https://www.google.com/maps/dir/${enc(origin || '')}/${enc(destination || '')}`,
    },
    {
      provider: 'Gasolina',
      label: 'Calcular costo de casetas y combustible',
      url: 'https://app.sct.gob.mx/sibuac_internet/ControllerUI?action=cmdEscogeRuta',
    },
  ];
}

function lodgingLinks({ destination, checkIn, checkOut, travelers, type }) {
  const inDay = isoDay(checkIn) || '';
  const outDay = isoDay(checkOut) || '';
  const guests = travelers || 1;

  const all = {
    hotel: {
      provider: 'Booking.com',
      label: 'Buscar hoteles',
      url: `https://www.booking.com/searchresults.es.html?ss=${enc(
        destination || ''
      )}&checkin=${inDay}&checkout=${outDay}&group_adults=${guests}&no_rooms=1`,
    },
    airbnb: {
      provider: 'Airbnb',
      label: 'Buscar alojamientos completos',
      url: `https://www.airbnb.mx/s/${enc(destination || '')}/homes?checkin=${inDay}&checkout=${outDay}&adults=${guests}`,
    },
    hostal: {
      provider: 'Hostelworld',
      label: 'Buscar hostales',
      url: `https://www.hostelworld.com/search?search_keywords=${enc(
        destination || ''
      )}&date_from=${inDay}&date_to=${outDay}&number_of_guests=${guests}`,
    },
    cabana: {
      provider: 'Airbnb',
      label: 'Buscar cabanas',
      url: `https://www.airbnb.mx/s/${enc(destination || '')}/homes?checkin=${inDay}&checkout=${outDay}&adults=${guests}&amenities%5B%5D=8`,
    },
  };

  // El tipo elegido va primero; los demas quedan como alternativas.
  const preferred = all[type];
  const rest = Object.entries(all)
    .filter(([key]) => key !== type)
    .map(([, v]) => v);

  return preferred ? [preferred, ...rest] : Object.values(all);
}

function localTransportLinks({ destination, startDate, endDate, type }) {
  const map = {
    'renta-auto': [
      {
        provider: 'DiscoverCars',
        label: 'Comparar rentadoras',
        url: `https://www.discovercars.com/es?filterCity=${enc(destination || '')}&from=${isoDay(startDate) || ''}&to=${
          isoDay(endDate) || ''
        }`,
      },
      { provider: 'Kayak', label: 'Ver autos disponibles', url: 'https://www.kayak.com.mx/cars' },
    ],
    'app-transporte': [
      { provider: 'Uber', label: 'Estimar tarifas', url: 'https://www.uber.com/global/es/price-estimate/' },
      { provider: 'DiDi', label: 'Cobertura por ciudad', url: 'https://web.didiglobal.com/mx/' },
    ],
    taxi: [
      {
        provider: 'Google Maps',
        label: 'Ver sitios de taxi cercanos',
        url: `https://www.google.com/maps/search/${enc(`sitio de taxis ${destination || ''}`)}`,
      },
    ],
    'transporte-publico': [
      {
        provider: 'Moovit',
        label: 'Rutas de transporte publico',
        url: `https://moovitapp.com/?q=${enc(destination || '')}`,
      },
      {
        provider: 'Google Maps',
        label: 'Planear trayectos',
        url: `https://www.google.com/maps/search/${enc(`transporte publico ${destination || ''}`)}`,
      },
    ],
    bicicleta: [
      {
        provider: 'Google Maps',
        label: 'Renta de bicicletas cercana',
        url: `https://www.google.com/maps/search/${enc(`renta de bicicletas ${destination || ''}`)}`,
      },
    ],
    'a-pie': [
      {
        provider: 'Google Maps',
        label: 'Ver zona caminable',
        url: `https://www.google.com/maps/search/${enc(destination || '')}`,
      },
    ],
  };

  return map[type] || map['transporte-publico'];
}

/** Punto de entrada unico: arma todos los links relevantes para un viaje. */
export function buildLinksForTrip(trip, { section, type } = {}) {
  const origin = trip.origin?.name || '';
  const destination = trip.destination?.name || '';
  const base = {
    origin,
    destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    travelers: trip.travelers,
  };

  const sections = {
    transporte: () => {
      const mode = type || trip.transport?.outbound?.mode || 'avion';
      if (mode === 'avion') return flightLinks(base);
      if (mode === 'autobus' || mode === 'tren') return busLinks(base);
      if (mode === 'auto-propio') return carLinks(base);
      return [...flightLinks(base), ...busLinks(base)];
    },
    hospedaje: () =>
      lodgingLinks({
        destination,
        checkIn: trip.lodging?.[0]?.checkIn || trip.startDate,
        checkOut: trip.lodging?.[0]?.checkOut || trip.endDate,
        travelers: trip.travelers,
        type: type || trip.lodging?.[0]?.type || 'hotel',
      }),
    'transporte-local': () =>
      localTransportLinks({ ...base, type: type || trip.localTransport?.[0]?.type }),
  };

  if (section && sections[section]) {
    return { [section]: sections[section]() };
  }

  return {
    transporte: sections.transporte(),
    hospedaje: sections.hospedaje(),
    'transporte-local': sections['transporte-local'](),
  };
}

export default { buildLinksForTrip };
