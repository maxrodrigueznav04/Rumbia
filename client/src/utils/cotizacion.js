import { conMargen } from './format.js';

const redondear = (n) => Number(n.toFixed(2));

// Misma base que el enlace público: servicios + actividades del itinerario.
// Los gastos registrados pertenecen al control interno y no se suman otra vez.
export function calcularCotizacion(viaje, itinerario = viaje?.itinerary) {
  const viajeros = Math.max(1, viaje?.travelers || 1);
  const servicios = viaje?.coreCosts?.total || 0;
  const actividades = (itinerario?.totalEstimatedCost || 0) * viajeros;
  const base = servicios + actividades;
  const porPersona = redondear(conMargen(base / viajeros, viaje?.margen, viajeros));
  const total = redondear(porPersona * viajeros);
  const pendientes = [];
  for (const [tramo, nombre] of [['outbound', 'Transporte de ida'], ['inbound', 'Transporte de vuelta']]) {
    const datos = viaje?.transport?.[tramo];
    if (!datos?.provider && !datos?.bookingRef && !(datos?.cost > 0)) pendientes.push(nombre);
  }
  if ((viaje?.durationDays || 1) > 1 && !viaje?.lodging?.length) pendientes.push('Hospedaje');
  if (!itinerario) pendientes.push('Itinerario');
  return { servicios, actividades, base, margen: redondear(conMargen(base / viajeros, viaje?.margen, viajeros) * viajeros - base), porPersona, total, pendientes };
}

export function viajeParaCliente(viaje) {
  const limpiar = (dato) => {
    if (!dato || !viaje.ocultarCodigos) return dato;
    const { bookingRef, externalUrl, notes, ...visible } = dato;
    return visible;
  };
  return { ...viaje, notes: undefined,
    transport: { outbound: limpiar(viaje.transport?.outbound), inbound: limpiar(viaje.transport?.inbound) },
    lodging: viaje.lodging?.map(limpiar), localTransport: viaje.localTransport?.map(limpiar) };
}
