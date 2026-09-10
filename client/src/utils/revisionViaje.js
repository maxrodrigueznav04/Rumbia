/**
 * Revisión automática de fechas del viaje: cruza los datos que ya vive en
 * Trip (transporte de ida/vuelta, hospedajes, rango de fechas del viaje) para
 * detectar inconsistencias de captura -- el regreso agendado antes que la
 * ida, una llegada antes que su propia salida, o un hospedaje cuyas fechas no
 * caen dentro del viaje. Mismo espíritu que utils/revisionItinerario.js: solo
 * datos que la app ya tiene, nada que dependa de la IA.
 */

const fechaISO = (valor) => {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

/**
 * @param {object} viaje - trip con transport.outbound/inbound y lodging[]
 * @returns {Array<{id: string, tipo: string, datos: object}>}
 *   `datos` trae los valores para interpolar en la traduccion (ver
 *   DetalleViaje.jsx / locales/*​/detalleViaje.json#revisionFechas) -- este
 *   modulo no es un componente y no puede llamar al hook de traduccion.
 */
export function revisarFechasViaje(viaje) {
  if (!viaje) return [];

  const avisos = [];
  const inicioViaje = fechaISO(viaje.startDate);
  const finViaje = fechaISO(viaje.endDate);
  const ida = viaje.transport?.outbound;
  const vuelta = viaje.transport?.inbound;

  const revisarTramo = (tramo, etiqueta) => {
    if (tramo?.departureAt && tramo?.arrivalAt && new Date(tramo.arrivalAt) < new Date(tramo.departureAt)) {
      avisos.push({ id: `llegada-antes-salida-${etiqueta}`, tipo: 'llegadaAntesSalida', datos: { tramo: etiqueta } });
    }
  };
  revisarTramo(ida, 'outbound');
  revisarTramo(vuelta, 'inbound');

  if (ida?.departureAt && vuelta?.departureAt && new Date(vuelta.departureAt) < new Date(ida.departureAt)) {
    avisos.push({ id: 'regreso-antes-ida', tipo: 'regresoAntesIda', datos: {} });
  }

  (viaje.lodging || []).forEach((l, i) => {
    const datosBase = { indice: i + 1, nombre: l.name || '', tipo: l.type };

    if (l.checkIn && l.checkOut && new Date(l.checkOut) < new Date(l.checkIn)) {
      avisos.push({ id: `hospedaje-invertido-${i}`, tipo: 'hospedajeInvertido', datos: datosBase });
    }

    const checkInISO = fechaISO(l.checkIn);
    const checkOutISO = fechaISO(l.checkOut);
    const fueraAntes = checkInISO && inicioViaje && checkInISO < inicioViaje;
    const fueraDespues = checkOutISO && finViaje && checkOutISO > finViaje;
    if (fueraAntes || fueraDespues) {
      avisos.push({ id: `hospedaje-fuera-rango-${i}`, tipo: 'hospedajeFueraDeRango', datos: datosBase });
    }
  });

  return avisos;
}
