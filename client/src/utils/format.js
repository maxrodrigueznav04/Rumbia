/** Formateo consistente de dinero y fechas en toda la app (es-MX). */

export function formatoMoneda(monto, moneda = 'MXN') {
  const n = Number(monto) || 0;
  try {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: moneda,
      maximumFractionDigits: n % 1 === 0 ? 0 : 2,
    }).format(n);
  } catch {
    // Codigo de moneda desconocido: no romper la vista por un dato malo.
    return `${n.toLocaleString('es-MX')} ${moneda}`;
  }
}

const parse = (valor) => {
  if (!valor) return null;
  const d = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
};

export function formatoFecha(valor, opciones = {}) {
  const d = parse(valor);
  if (!d) return '';
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC', // las fechas se guardan a mediodia UTC: evita corrimientos de un dia
    ...opciones,
  }).format(d);
}

export function formatoFechaCorta(valor) {
  return formatoFecha(valor, { day: 'numeric', month: 'short', year: undefined });
}

export function formatoDiaSemana(valor) {
  return formatoFecha(valor, { weekday: 'short', day: 'numeric', month: undefined, year: undefined });
}

/** "12 – 16 sep 2026", colapsando lo que se repite. */
export function rangoFechas(inicio, fin) {
  const a = parse(inicio);
  const b = parse(fin);
  if (!a || !b) return '';

  const mismoAnio = a.getUTCFullYear() === b.getUTCFullYear();
  const mismoMes = mismoAnio && a.getUTCMonth() === b.getUTCMonth();

  if (mismoMes) {
    const dia = new Intl.DateTimeFormat('es-MX', { day: 'numeric', timeZone: 'UTC' });
    return `${dia.format(a)} – ${formatoFecha(b)}`;
  }
  if (mismoAnio) {
    return `${formatoFechaCorta(a)} – ${formatoFecha(b)}`;
  }
  return `${formatoFecha(a)} – ${formatoFecha(b)}`;
}

/** "en 12 dias", "hoy", "hace 3 meses". */
export function tiempoRelativo(valor) {
  const d = parse(valor);
  if (!d) return '';

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const objetivo = new Date(d);
  objetivo.setHours(0, 0, 0, 0);

  const dias = Math.round((objetivo - hoy) / 86400000);
  const rtf = new Intl.RelativeTimeFormat('es-MX', { numeric: 'auto' });

  if (Math.abs(dias) < 30) return rtf.format(dias, 'day');
  if (Math.abs(dias) < 365) return rtf.format(Math.round(dias / 30), 'month');
  return rtf.format(Math.round(dias / 365), 'year');
}

/* ---------------- Conversión para inputs de formulario ----------------
   Todo se maneja en UTC. Las fechas de un viaje son "fecha de calendario",
   no instantes: si se convierten a hora local, un usuario en GMT-6 ve el
   día anterior. Trabajar en UTC de ida y vuelta evita ese corrimiento. */

/** Date -> "2026-09-14" para <input type="date">. */
export function paraInputFecha(valor) {
  const d = parse(valor);
  return d ? d.toISOString().slice(0, 10) : '';
}

/** Date -> "2026-09-14T13:45" para <input type="datetime-local">. */
export function paraInputFechaHora(valor) {
  const d = parse(valor);
  return d ? d.toISOString().slice(0, 16) : '';
}

/** Valor de un input date/datetime-local -> ISO para el backend. */
export function desdeInputFecha(texto) {
  if (!texto) return null;
  // Se le pega la Z para que se interprete como UTC y no como hora local.
  const iso = texto.length === 10 ? `${texto}T12:00:00.000Z` : `${texto}:00.000Z`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Noches entre dos fechas de calendario (para el subtotal de hospedaje). */
export function nochesEntre(checkIn, checkOut) {
  const a = parse(checkIn);
  const b = parse(checkOut);
  if (!a || !b) return 0;
  return Math.max(0, Math.round((b - a) / 86400000));
}

/** "transporte-local" -> "Transporte local" */
export function humanizar(slug = '') {
  const texto = String(slug).replace(/-/g, ' ');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export const ETIQUETAS_ESTADO = {
  borrador: { texto: 'Borrador', color: '' },
  planeado: { texto: 'Planeado', color: 'terracota' },
  'en-curso': { texto: 'En curso', color: 'mostaza' },
  completado: { texto: 'Completado', color: 'salvia' },
};

export const ICONOS_CATEGORIA = {
  comida: '🍽️',
  cultura: '🏛️',
  naturaleza: '🌿',
  aventura: '🧗',
  compras: '🛍️',
  'vida-nocturna': '🌙',
  descanso: '☕',
  traslado: '🚗',
  otro: '📍',
};

/** Colores de la grafica de presupuesto, alineados con la paleta de la app. */
export const COLORES_CATEGORIA = {
  transporte: '#b85c38',
  hospedaje: '#6e8b6a',
  'transporte-local': '#4f8fb5',
  comida: '#cc9544',
  actividades: '#8a6ba8',
  compras: '#c47f8f',
  otros: '#8a7e73',
};
