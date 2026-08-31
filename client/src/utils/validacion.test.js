import { describe, it, expect } from 'vitest';
import { reglas, fuerzaPassword, validarFormulario } from './validacion.js';

describe('reglas.email', () => {
  it('acepta correos normales', () => {
    expect(reglas.email('ana@ejemplo.com')).toBeNull();
    expect(reglas.email('  ana@ejemplo.com  ')).toBeNull();
  });

  it('rechaza lo que no lo es', () => {
    for (const malo of ['', 'ana', 'ana@', '@ejemplo.com', 'ana@ejemplo', 'a n@a.com']) {
      expect(reglas.email(malo)).toBeTruthy();
    }
  });
});

describe('reglas.password', () => {
  it('dice cuantos caracteres faltan, no solo que es corta', () => {
    expect(reglas.password('abc')).toMatch(/5/);
  });

  it('acepta desde 8 caracteres', () => {
    expect(reglas.password('12345678')).toBeNull();
  });
});

describe('reglas.nombre', () => {
  it('no acepta solo espacios', () => {
    expect(reglas.nombre('   ')).toBeTruthy();
  });

  it('exige al menos dos caracteres', () => {
    expect(reglas.nombre('A')).toBeTruthy();
    expect(reglas.nombre('Ana')).toBeNull();
  });
});

describe('reglas.paradaEnRango', () => {
  const viaje = ['2026-09-10', '2026-09-18'];

  it('acepta una parada dentro del rango del viaje', () => {
    expect(reglas.paradaEnRango('2026-09-12', '2026-09-14', ...viaje)).toBeNull();
  });

  it('rechaza una parada que termina antes de empezar', () => {
    expect(reglas.paradaEnRango('2026-09-14', '2026-09-12', ...viaje)).toBeTruthy();
  });

  it('rechaza una parada que se sale del rango del viaje', () => {
    expect(reglas.paradaEnRango('2026-09-05', '2026-09-14', ...viaje)).toBeTruthy();
    expect(reglas.paradaEnRango('2026-09-12', '2026-09-20', ...viaje)).toBeTruthy();
  });

  it('no valida nada mientras algun dato este incompleto', () => {
    expect(reglas.paradaEnRango('', '', ...viaje)).toBeNull();
    expect(reglas.paradaEnRango('2026-09-12', '2026-09-14', '', '')).toBeNull();
  });
});

describe('fuerzaPassword', () => {
  it('sube de nivel conforme la contrasena mejora', () => {
    const debil = fuerzaPassword('12345678');
    const fuerte = fuerzaPassword('Tr3n-Oaxaca!2026');
    expect(fuerte.nivel).toBeGreaterThan(debil.nivel);
  });

  it('siempre trae etiqueta y nivel dentro de rango', () => {
    for (const p of ['', 'a', 'abcdefgh', 'Abcdefgh1', 'Abcdefgh1!xyz']) {
      const r = fuerzaPassword(p);
      expect(r.nivel).toBeGreaterThanOrEqual(0);
      expect(r.nivel).toBeLessThanOrEqual(4);
      expect(typeof r.etiqueta).toBe('string');
    }
  });
});

describe('validarFormulario', () => {
  it('junta solo los campos con error', () => {
    const errores = validarFormulario(
      { email: 'no-sirve', password: '12345678' },
      { email: reglas.email, password: reglas.password }
    );
    expect(Object.keys(errores)).toEqual(['email']);
  });

  it('devuelve objeto vacio cuando todo esta bien', () => {
    const errores = validarFormulario(
      { email: 'ana@ejemplo.com' },
      { email: reglas.email }
    );
    expect(errores).toEqual({});
  });
});
