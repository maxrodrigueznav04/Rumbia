import { precioTotalPorPersonaDe } from '../controllers/public.controller.js';

const dateLong = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const dateShort = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const range = (start, end) => `${dateLong.format(new Date(start))} — ${dateLong.format(new Date(end))}`;

export function buildVisualProposalData({ trip, itinerary, agency, assets = [] }) {
  const currency = trip.budget?.currency || 'MXN';
  const price = precioTotalPorPersonaDe(trip, itinerary);
  const destinations = [trip.destination?.name, ...(trip.additionalDestinations || []).map((stop) => stop.place?.name)].filter(Boolean);
  const days = (itinerary.days || []).map((day) => ({
    number: day.dayNumber,
    date: day.date ? dateShort.format(new Date(day.date)) : '',
    title: day.title || `${destinations[0] || 'Viaje'} · día ${day.dayNumber}`,
    summary: day.summary || '',
    activities: (day.activities || []).map((activity) => ({
      time: activity.time || '', title: activity.title || '', description: activity.description || '',
    })),
  }));
  const candidates = days.filter((day) => day.title && day.activities.length);
  const indexes = candidates.length <= 3 ? candidates.map((_, index) => index) : [0, Math.floor((candidates.length - 1) / 2), candidates.length - 1];
  const highlights = indexes.map((index) => ({
    date: candidates[index].date,
    title: candidates[index].title,
    summary: candidates[index].summary || candidates[index].activities[0]?.title || '',
  }));
  return {
    fields: {
      'trip.title': trip.title,
      'trip.destination': destinations.join(' → '),
      'trip.dates': range(trip.startDate, trip.endDate),
      'trip.travelers': `${trip.travelers || 1} ${(trip.travelers || 1) === 1 ? 'viajero' : 'viajeros'}`,
      'agency.name': agency.agencyName,
      'agency.contact': agency.contact || '',
      'proposal.price': price > 0 ? `${new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(price)} ${currency} por persona` : 'Precio por confirmar',
    },
    days,
    highlights,
    assets: Object.fromEntries(assets.map((asset) => [String(asset._id), { url: asset.url }])),
    showBrandCredit: !agency.marcaBlanca,
  };
}
