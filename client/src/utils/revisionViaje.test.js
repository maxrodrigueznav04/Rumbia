import { describe, it, expect } from 'vitest';
import { revisarFechasViaje } from './revisionViaje.js';

const viajeBase = {
  startDate: '2026-03-01',
  endDate: '2026-03-10',
  transport: {
    outbound: { departureAt: '2026-03-01T08:00:00.000Z', arrivalAt: '2026-03-01T12:00:00.000Z' },
    inbound: { departureAt: '2026-03-10T08:00:00.000Z', arrivalAt: '2026-03-10T20:00:00.000Z' },
  },
  lodging: [{ name: 'Hotel Centro', type: 'hotel', checkIn: '2026-03-01', checkOut: '2026-03-05' }],
};

describe('revisarFechasViaje', () => {
  it('sin viaje no truena', () => {
    expect(revisarFechasViaje(null)).toEqual([]);
  });

  it('un viaje consistente no genera avisos', () => {
    expect(revisarFechasViaje(viajeBase)).toEqual([]);
  });

  it('detecta la vuelta agendada antes que la ida', () => {
    const viaje = {
      ...viajeBase,
      transport: {
        outbound: { departureAt: '2026-03-05T08:00:00.000Z' },
        inbound: { departureAt: '2026-03-02T08:00:00.000Z' },
      },
    };
    const avisos = revisarFechasViaje(viaje);
    expect(avisos.some((a) => a.tipo === 'regresoAntesIda')).toBe(true);
  });

  it('detecta una llegada anterior a su propia salida', () => {
    const viaje = {
      ...viajeBase,
      transport: {
        outbound: { departureAt: '2026-03-01T12:00:00.000Z', arrivalAt: '2026-03-01T08:00:00.000Z' },
      },
    };
    const avisos = revisarFechasViaje(viaje);
    expect(avisos).toEqual([
      { id: 'llegada-antes-salida-outbound', tipo: 'llegadaAntesSalida', datos: { tramo: 'outbound' } },
    ]);
  });

  it('detecta un hospedaje con check-out antes del check-in', () => {
    const viaje = {
      ...viajeBase,
      lodging: [{ name: 'Hotel X', type: 'hotel', checkIn: '2026-03-05', checkOut: '2026-03-02' }],
    };
    const avisos = revisarFechasViaje(viaje);
    expect(avisos.some((a) => a.tipo === 'hospedajeInvertido')).toBe(true);
  });

  it('detecta un hospedaje fuera del rango de fechas del viaje', () => {
    const viaje = {
      ...viajeBase,
      lodging: [{ name: 'Hotel Y', type: 'hotel', checkIn: '2026-02-25', checkOut: '2026-03-03' }],
    };
    const avisos = revisarFechasViaje(viaje);
    expect(avisos).toEqual([
      { id: 'hospedaje-fuera-rango-0', tipo: 'hospedajeFueraDeRango', datos: { indice: 1, nombre: 'Hotel Y', tipo: 'hotel' } },
    ]);
  });

  it('no avisa por un hospedaje sin fechas capturadas', () => {
    const viaje = { ...viajeBase, lodging: [{ name: 'Sin fechas', type: 'hotel' }] };
    expect(revisarFechasViaje(viaje)).toEqual([]);
  });
});
