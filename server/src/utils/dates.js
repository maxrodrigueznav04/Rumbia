export const MS_PER_DAY = 86400000;

export function toUTCDate(value) {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Dias inclusivos entre dos fechas (mismo dia = 1). */
export function daysBetween(start, end) {
  const s = toUTCDate(start);
  const e = toUTCDate(end);
  if (!s || !e) return 0;
  return Math.max(1, Math.round((e - s) / MS_PER_DAY) + 1);
}

/** Suma dias a una fecha sin mutar la original. */
export function addDays(date, days) {
  const d = toUTCDate(date);
  if (!d) return null;
  return new Date(d.getTime() + days * MS_PER_DAY);
}

/** "2026-09-14" a partir de un Date. */
export function isoDay(date) {
  const d = toUTCDate(date);
  return d ? d.toISOString().slice(0, 10) : null;
}

export function isPast(date) {
  const d = toUTCDate(date);
  return d ? d.getTime() < Date.now() : false;
}
