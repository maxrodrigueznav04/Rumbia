import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import i18n from '../i18n.js';

// jsdom trae navigator.language en ingles por default: sin esto,
// i18next-browser-languagedetector detectaba "en" en las pruebas y las que
// esperan meses en español (rangoFechas, etc) fallaban por el entorno, no
// por el codigo. Las pruebas asumen español salvo que digan lo contrario.
i18n.changeLanguage('es');

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

// jsdom no implementa estas dos y varios componentes las llaman: sin los stubs
// las pruebas fallan por el entorno, no por el codigo.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  });
}

if (!window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = () => {};
}
