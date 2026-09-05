import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
// Fuentes autoalojadas: sin CDN externo, sin bloquear el render y sin que el
// deploy dependa de que Google Fonts responda.
// Las declaraciones traen unicode-range, asi que el navegador solo descarga el
// alfabeto que la pagina realmente usa: los subconjuntos cirilico, griego y
// vietnamita quedan en el bundle pero nunca se piden en una app en español.
import '@fontsource-variable/sora';
import '@fontsource-variable/manrope';
import './styles/global.css';
import { initSentry, instalarListenersGlobales } from './config/sentry.js';

// Antes de montar la app: sin VITE_SENTRY_DSN, ambas son no-ops (ver sentry.js).
initSentry();
instalarListenersGlobales();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
