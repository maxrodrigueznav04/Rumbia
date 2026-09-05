import { describe, it, expect } from 'vitest';
import { calcularCotizacion, viajeParaCliente } from './cotizacion.js';

describe('precio de la propuesta', () => {
  const viaje = { travelers: 10, coreCosts: { total: 57000 }, itinerary: { totalEstimatedCost: 1970 }, expenses: [{ amount: 19700 }] };
  it('suma actividades y servicios sin duplicar gastos internos', () => {
    expect(calcularCotizacion(viaje)).toMatchObject({ servicios: 57000, actividades: 19700, total: 76700, porPersona: 7670, margen: 0 });
  });
  it('reparte la cuota fija entre viajeros y aplica porcentajes sobre la base completa', () => {
    expect(calcularCotizacion({ ...viaje, margen: { tipo: 'fijo', monto: 1000 } }).total).toBe(77700);
    expect(calcularCotizacion({ ...viaje, margen: { tipo: 'porcentaje', monto: 10 } }).total).toBe(84370);
  });
  it('usa el redondeo por persona del enlace público', () => {
    expect(calcularCotizacion({ travelers: 3, coreCosts: { total: 100 } })).toMatchObject({ porPersona: 33.33, total: 99.99 });
  });
  it('distingue secciones sin capturar de un servicio registrado de costo cero', () => {
    expect(calcularCotizacion({ durationDays: 3 }).pendientes).toContain('Hospedaje');
    expect(calcularCotizacion({ transport: { outbound: { provider: 'Traslado incluido', cost: 0 } } }).pendientes).not.toContain('Transporte de ida');
  });
  it('la vista previa respeta la ocultación de códigos sin modificar el viaje', () => {
    const original = { ocultarCodigos: true, transport: { outbound: { provider: 'Prueba', bookingRef: 'PRIVADO', notes: 'Interno', externalUrl: 'https://example.test/reserva' } }, lodging: [{ name: 'Hotel', notes: 'Interno' }] };
    const publico = viajeParaCliente(original);
    expect(publico.transport.outbound).toEqual({ provider: 'Prueba' });
    expect(publico.lodging[0]).toEqual({ name: 'Hotel' });
    expect(original.transport.outbound.bookingRef).toBe('PRIVADO');
  });
});
