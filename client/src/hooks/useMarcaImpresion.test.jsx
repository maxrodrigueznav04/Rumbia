import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import useMarcaImpresion from './useMarcaImpresion.js';

const marca = {
  marcaBlanca: true, colorAcento: '#f90606', fondoPdf: 'morado',
  fuentePdf: 'corporativa', densidadPdf: 'grande',
};
const raiz = document.documentElement.style;
const imprimir = () => window.dispatchEvent(new Event('beforeprint'));
const terminar = () => window.dispatchEvent(new Event('afterprint'));

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('style');
});

describe('marca del documento impreso', () => {
  it('hace accesibles las cuatro preferencias a html/body solo al imprimir', () => {
    renderHook(() => useMarcaImpresion(marca));
    expect(raiz.getPropertyValue('--marca-agencia')).toBe('');
    imprimir();
    expect(raiz.getPropertyValue('--marca-agencia')).toBe('#f90606');
    expect(raiz.getPropertyValue('--fondo-agencia')).toBe('#F3EEFA');
    expect(raiz.getPropertyValue('--fuente-agencia')).toContain('Montserrat');
    expect(raiz.getPropertyValue('--escala-pdf')).toBe('1.12');
    terminar();
    expect(raiz.length).toBe(0);
  });

  it('restaura estilos previos incluso con beforeprint repetido y al salir de la pagina', () => {
    raiz.setProperty('--marca-agencia', 'blue', 'important');
    const { unmount } = renderHook(() => useMarcaImpresion(marca));
    imprimir();
    imprimir();
    unmount();
    expect(raiz.getPropertyValue('--marca-agencia')).toBe('blue');
    expect(raiz.getPropertyPriority('--marca-agencia')).toBe('important');
    expect(raiz.getPropertyValue('--fondo-agencia')).toBe('');
    imprimir();
    expect(raiz.getPropertyValue('--marca-agencia')).toBe('blue');
  });

  it('usa cambios recien guardados y no conserva la marca al quitar marca blanca', () => {
    const { rerender } = renderHook((valor) => useMarcaImpresion(valor), { initialProps: marca });
    imprimir();
    terminar();
    rerender({ ...marca, colorAcento: '#123456', fondoPdf: '' });
    imprimir();
    expect(raiz.getPropertyValue('--marca-agencia')).toBe('#123456');
    expect(raiz.getPropertyValue('--fondo-agencia')).toBe('');
    terminar();
    rerender({ ...marca, marcaBlanca: false });
    imprimir();
    expect(raiz.length).toBe(0);
  });

  it('conserva los valores predeterminados sin agencia ni preferencias', () => {
    const { rerender } = renderHook((valor) => useMarcaImpresion(valor));
    imprimir();
    expect(raiz.length).toBe(0);
    terminar();
    rerender({ marcaBlanca: true });
    imprimir();
    expect(raiz.length).toBe(0);
  });
});
