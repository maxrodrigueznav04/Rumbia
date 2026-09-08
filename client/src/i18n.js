import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import comunEs from './locales/es/comun.json';
import comunEn from './locales/en/comun.json';
import inicioEs from './locales/es/inicio.json';
import inicioEn from './locales/en/inicio.json';
import acercaEs from './locales/es/acerca.json';
import acercaEn from './locales/en/acerca.json';
import authEs from './locales/es/auth.json';
import authEn from './locales/en/auth.json';
import layoutEs from './locales/es/layout.json';
import layoutEn from './locales/en/layout.json';

export const IDIOMAS = ['es', 'en'];

/**
 * Todo cargado de una vez, sin backend HTTP ni import() dinamico: los
 * textos de la app pesan poco (unos KB por idioma) comparado con lo que ya
 * se descarga en fuentes/mapas, y evita el parpadeo de "texto sin traducir"
 * que trae la carga diferida mientras crece el numero de paginas cubiertas.
 */
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: { comun: comunEs, inicio: inicioEs, acerca: acercaEs, auth: authEs, layout: layoutEs },
      en: { comun: comunEn, inicio: inicioEn, acerca: acercaEn, auth: authEn, layout: layoutEn },
    },
    fallbackLng: 'es',
    supportedLngs: IDIOMAS,
    ns: ['comun', 'inicio', 'acerca', 'auth', 'layout'],
    defaultNS: 'comun',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'rumbia-idioma',
    },
    react: { useSuspense: false },
  });

export default i18n;
