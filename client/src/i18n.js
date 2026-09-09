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
import dominioEs from './locales/es/dominio.json';
import dominioEn from './locales/en/dominio.json';
import camposEs from './locales/es/campos.json';
import camposEn from './locales/en/campos.json';
import formulariosEs from './locales/es/formularios.json';
import formulariosEn from './locales/en/formularios.json';
import viajeEs from './locales/es/viaje.json';
import viajeEn from './locales/en/viaje.json';
import viajesEs from './locales/es/viajes.json';
import viajesEn from './locales/en/viajes.json';
import nuevoViajeEs from './locales/es/nuevoViaje.json';
import nuevoViajeEn from './locales/en/nuevoViaje.json';
import itinerarioEs from './locales/es/itinerario.json';
import itinerarioEn from './locales/en/itinerario.json';
import detalleViajeEs from './locales/es/detalleViaje.json';
import detalleViajeEn from './locales/en/detalleViaje.json';
import agenciaEs from './locales/es/agencia.json';
import agenciaEn from './locales/en/agencia.json';
import perfilEs from './locales/es/perfil.json';
import perfilEn from './locales/en/perfil.json';
import clientesEs from './locales/es/clientes.json';
import clientesEn from './locales/en/clientes.json';
import plantillasEs from './locales/es/plantillas.json';
import plantillasEn from './locales/en/plantillas.json';
import impresionEs from './locales/es/impresion.json';
import impresionEn from './locales/en/impresion.json';
import paginaLegalEs from './locales/es/paginaLegal.json';
import paginaLegalEn from './locales/en/paginaLegal.json';
import privacidadEs from './locales/es/privacidad.json';
import privacidadEn from './locales/en/privacidad.json';
import cookiesEs from './locales/es/cookies.json';
import cookiesEn from './locales/en/cookies.json';
import terminosEs from './locales/es/terminos.json';
import terminosEn from './locales/en/terminos.json';
import probarEs from './locales/es/probar.json';
import probarEn from './locales/en/probar.json';
import itinerarioCompartidoEs from './locales/es/itinerarioCompartido.json';
import itinerarioCompartidoEn from './locales/en/itinerarioCompartido.json';
import validacionEs from './locales/es/validacion.json';
import validacionEn from './locales/en/validacion.json';

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
      es: {
        comun: comunEs, inicio: inicioEs, acerca: acercaEs, auth: authEs, layout: layoutEs,
        dominio: dominioEs, campos: camposEs, formularios: formulariosEs, viaje: viajeEs,
        viajes: viajesEs, nuevoViaje: nuevoViajeEs, itinerario: itinerarioEs, detalleViaje: detalleViajeEs,
        agencia: agenciaEs, perfil: perfilEs, clientes: clientesEs, plantillas: plantillasEs,
        impresion: impresionEs, paginaLegal: paginaLegalEs, privacidad: privacidadEs,
        cookies: cookiesEs, terminos: terminosEs, probar: probarEs,
        itinerarioCompartido: itinerarioCompartidoEs, validacion: validacionEs,
      },
      en: {
        comun: comunEn, inicio: inicioEn, acerca: acercaEn, auth: authEn, layout: layoutEn,
        dominio: dominioEn, campos: camposEn, formularios: formulariosEn, viaje: viajeEn,
        viajes: viajesEn, nuevoViaje: nuevoViajeEn, itinerario: itinerarioEn, detalleViaje: detalleViajeEn,
        agencia: agenciaEn, perfil: perfilEn, clientes: clientesEn, plantillas: plantillasEn,
        impresion: impresionEn, paginaLegal: paginaLegalEn, privacidad: privacidadEn,
        cookies: cookiesEn, terminos: terminosEn, probar: probarEn,
        itinerarioCompartido: itinerarioCompartidoEn, validacion: validacionEn,
      },
    },
    fallbackLng: 'es',
    supportedLngs: IDIOMAS,
    ns: [
      'comun', 'inicio', 'acerca', 'auth', 'layout', 'dominio', 'campos',
      'formularios', 'viaje', 'viajes', 'nuevoViaje', 'itinerario', 'detalleViaje',
      'agencia', 'perfil', 'clientes', 'plantillas', 'impresion', 'paginaLegal',
      'privacidad', 'cookies', 'terminos', 'probar', 'itinerarioCompartido', 'validacion',
    ],
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
