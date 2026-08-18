import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
// Fuentes autoalojadas: sin CDN externo, sin bloquear el render y sin que el
// deploy dependa de que Google Fonts responda.
// Las declaraciones traen unicode-range, asi que el navegador solo descarga el
// alfabeto que la pagina realmente usa: los subconjuntos cirilico, griego y
// vietnamita quedan en el bundle pero nunca se piden en una app en español.
import '@fontsource-variable/fraunces';
import '@fontsource-variable/inter';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
