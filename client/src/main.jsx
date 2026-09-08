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

// Un deploy nuevo borra los chunks de la build anterior (MapaDestino.jsx y
// cualquier otra ruta con code-splitting). Si alguien tenia la pestana
// abierta desde antes del deploy y navega a una pantalla que carga un chunk
// que ya no existe, el import() falla con "Failed to fetch dynamically
// imported module" -- Vite emite este evento especificamente para ese caso.
// Recargar la pagina trae el index.html nuevo, que ya apunta a los chunks
// correctos: no hace falta que la persona entienda el error ni recargue a mano.
window.addEventListener('vite:preloadError', () => {
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
