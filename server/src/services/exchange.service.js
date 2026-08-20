/**
 * Tipos de cambio para sumar gastos en monedas distintas.
 *
 * Usa Frankfurter (datos del Banco Central Europeo): es gratis y no pide API
 * key, asi que no agrega una variable de entorno mas al despliegue.
 *
 * Regla de oro: si no se puede convertir, NO se inventa un numero. El resumen
 * devuelve lo que si pudo sumar y avisa de lo que quedo fuera. Un presupuesto
 * que miente es peor que uno incompleto.
 */

const API = 'https://api.frankfurter.app/latest';
const TIMEOUT_MS = 6000;
// Son tasas diarias del BCE: pedirlas mas seguido no cambia el resultado.
const TTL_MS = 6 * 60 * 60 * 1000;

const cache = new Map(); // base -> { tasas, expira }

/** Vacia la cache. Solo lo usan las pruebas. */
export function limpiarCache() {
  cache.clear();
}

/**
 * Tasas desde una moneda base. Devuelve null si el servicio no responde:
 * quien llama decide que hacer, y en esta app la decision es no convertir.
 */
export async function obtenerTasas(base) {
  const moneda = String(base || '').toUpperCase();
  if (!/^[A-Z]{3}$/.test(moneda)) return null;

  const guardado = cache.get(moneda);
  if (guardado && guardado.expira > Date.now()) return guardado.tasas;

  const controlador = new AbortController();
  const alTiempo = setTimeout(() => controlador.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API}?from=${moneda}`, { signal: controlador.signal });
    if (!res.ok) return null;

    const datos = await res.json();
    if (!datos?.rates) return null;

    const tasas = { ...datos.rates, [moneda]: 1 };
    cache.set(moneda, { tasas, expira: Date.now() + TTL_MS });
    return tasas;
  } catch {
    // Sin red, timeout o respuesta rara: se responde null y no se convierte.
    return null;
  } finally {
    clearTimeout(alTiempo);
  }
}

/**
 * Convierte una lista de { amount, currency } a `destino`.
 *
 * Devuelve el total convertido y la lista de lo que no se pudo convertir, para
 * que la interfaz pueda decir exactamente que quedo fuera de la suma.
 */
export async function convertirTotales(montos, destino) {
  const moneda = String(destino || 'MXN').toUpperCase();
  const otras = [...new Set(montos.map((m) => String(m.currency || moneda).toUpperCase()))].filter(
    (c) => c !== moneda
  );

  // Todo viene en la misma moneda: no hace falta llamar a nadie.
  if (otras.length === 0) {
    return {
      convertido: montos.map((m) => ({ ...m, convertido: m.amount })),
      tasas: {},
      sinConvertir: [],
    };
  }

  const tasas = await obtenerTasas(moneda);
  const usadas = {};
  const sinConvertir = [];

  const convertido = montos.map((m) => {
    const suya = String(m.currency || moneda).toUpperCase();
    if (suya === moneda) return { ...m, convertido: m.amount };

    // tasas[suya] dice cuantas unidades de `suya` da una de `moneda`, asi que
    // para ir en sentido contrario se divide.
    const tasa = tasas?.[suya];
    if (!tasa) {
      sinConvertir.push(suya);
      return { ...m, convertido: 0, noConvertido: true };
    }

    usadas[suya] = Number((1 / tasa).toFixed(6));
    return { ...m, convertido: Number((m.amount / tasa).toFixed(2)) };
  });

  return { convertido, tasas: usadas, sinConvertir: [...new Set(sinConvertir)] };
}
