import { describe, it, expect } from 'vitest';
import {
  formatoMoneda,
  formatoMonedaConCodigo,
  rangoFechas,
  nochesEntre,
  paraInputFecha,
  desdeInputFecha,
  humanizar,
  nombreDestino,
  ciudadDeHospedaje,
} from './format.js';

describe('formatoMoneda', () => {
  it.each(['MXN', 'USD', 'EUR'])('identifica %s exactamente una vez en precios explícitos', (moneda) => {
    const resultado = formatoMonedaConCodigo(57000.5, moneda);
    expect(resultado.split(moneda)).toHaveLength(2);
    expect(resultado).toContain('57,000.50');
  });
  it('no muestra centavos: en un presupuesto de viaje estorban', () => {
    expect(formatoMoneda(5760, 'MXN')).not.toMatch(/[.,]\d{2}\b/);
    expect(formatoMoneda(5760, 'MXN')).toMatch(/5,760/);
  });

  it('trata null y undefined como cero en vez de romper', () => {
    expect(formatoMoneda(null)).toMatch(/0/);
    expect(formatoMoneda(undefined)).toMatch(/0/);
  });

  it('respeta la moneda que se le pasa', () => {
    expect(formatoMoneda(100, 'USD')).not.toEqual(formatoMoneda(100, 'EUR'));
  });
});

describe('nochesEntre', () => {
  it('cuenta noches, no dias: del 1 al 4 son 3 noches', () => {
    expect(nochesEntre('2026-09-01', '2026-09-04')).toBe(3);
  });

  it('devuelve 0 si la salida es anterior a la entrada', () => {
    expect(nochesEntre('2026-09-10', '2026-09-04')).toBe(0);
  });

  it('devuelve 0 con fechas faltantes', () => {
    expect(nochesEntre(null, '2026-09-04')).toBe(0);
    expect(nochesEntre('2026-09-04', null)).toBe(0);
  });
});

describe('rangoFechas', () => {
  it('no repite el mes cuando las dos fechas caen en el mismo', () => {
    const r = rangoFechas('2026-09-17', '2026-09-21');
    expect(r.match(/sep/gi)).toHaveLength(1);
  });

  it('nombra los dos meses cuando el viaje los cruza', () => {
    const r = rangoFechas('2026-08-30', '2026-09-02');
    expect(r).toMatch(/ago/i);
    expect(r).toMatch(/sep/i);
  });
});

describe('paraInputFecha / desdeInputFecha', () => {
  it('sobreviven la ida y vuelta sin correrse un dia por zona horaria', () => {
    const original = '2026-09-17';
    const ida = desdeInputFecha(original);
    expect(paraInputFecha(ida)).toBe(original);
  });

  it('devuelven cadena vacia con entrada vacia', () => {
    expect(paraInputFecha('')).toBe('');
    expect(paraInputFecha(null)).toBe('');
  });
});

describe('nombreDestino', () => {
  it('solo el destino principal cuando no hay paradas', () => {
    expect(nombreDestino({ destination: { name: 'Roma' } })).toBe('Roma');
    expect(nombreDestino({ destination: { name: 'Roma' }, additionalDestinations: [] })).toBe('Roma');
  });

  it('agrega "+N más" cuando hay paradas adicionales', () => {
    expect(
      nombreDestino({
        destination: { name: 'Roma' },
        additionalDestinations: [{ place: { name: 'Berlín' } }, { place: { name: 'París' } }],
      })
    ).toBe('Roma + 2 más');
  });

  it('aguanta un viaje sin datos', () => {
    expect(nombreDestino()).toBe('');
    expect(nombreDestino({})).toBe('');
  });
});

describe('ciudadDeHospedaje', () => {
  const viaje = {
    destination: { name: 'Madrid' },
    additionalDestinations: [{ place: { name: 'Barcelona' } }, { place: { name: 'Lisboa' } }],
  };

  it('sin destinationIndex (o 0) cae al destino principal', () => {
    expect(ciudadDeHospedaje(viaje, {})).toBe('Madrid');
    expect(ciudadDeHospedaje(viaje, { destinationIndex: 0 })).toBe('Madrid');
  });

  it('usa la parada correspondiente al indice', () => {
    expect(ciudadDeHospedaje(viaje, { destinationIndex: 1 })).toBe('Barcelona');
    expect(ciudadDeHospedaje(viaje, { destinationIndex: 2 })).toBe('Lisboa');
  });

  it('un indice huerfano (parada borrada) cae al destino principal sin tronar', () => {
    expect(ciudadDeHospedaje(viaje, { destinationIndex: 5 })).toBe('Madrid');
    expect(ciudadDeHospedaje({ destination: { name: 'Madrid' } }, { destinationIndex: 1 })).toBe('Madrid');
  });

  it('aguanta un viaje sin datos', () => {
    expect(ciudadDeHospedaje()).toBe('');
    expect(ciudadDeHospedaje({}, {})).toBe('');
  });
});

describe('humanizar', () => {
  it('convierte el slug del backend en algo legible', () => {
    expect(humanizar('transporte-local')).toBe('Transporte local');
    expect(humanizar('vida-nocturna')).toBe('Vida nocturna');
  });

  it('aguanta cadena vacia', () => {
    expect(humanizar()).toBe('');
  });
});
