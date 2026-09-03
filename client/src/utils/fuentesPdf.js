/**
 * Catalogo de tipografias del PDF (beneficio Agencia/Pro). Los ids tienen
 * que coincidir uno a uno con FUENTES_PDF en server/src/models/Agency.js --
 * ahi se valida cual id existe, aqui vive el nombre real de cada fuente y
 * como cargarla.
 *
 * Cada fuente se carga sola, solo cuando alguien de verdad la eligio (ver
 * cargarFuentePdf en HojaImpresion.jsx): son paquetes @fontsource aparte
 * (self-hosted, sin depender de una red externa al imprimir), y Vite los
 * separa en su propio chunk -- nadie descarga las 7 fuentes que no eligio.
 * '' (vacio) es la tipografia de Rumbia de siempre (Sora/Manrope), que ya
 * esta en el bundle principal y no necesita cargarse aparte.
 */
export const FUENTES_PDF = [
  { id: '', etiqueta: 'Rumbia (predeterminada)', pila: null, cargar: null },
  {
    id: 'editorial',
    etiqueta: 'Editorial elegante',
    pila: "'Playfair Display', Georgia, serif",
    cargar: () => Promise.all([import('@fontsource/playfair-display'), import('@fontsource/playfair-display/700.css')]),
  },
  {
    id: 'clasica',
    etiqueta: 'Clásica',
    pila: "'Merriweather', Georgia, serif",
    cargar: () => Promise.all([import('@fontsource/merriweather'), import('@fontsource/merriweather/700.css')]),
  },
  {
    id: 'corporativa',
    etiqueta: 'Corporativa',
    pila: "'Montserrat', ui-sans-serif, sans-serif",
    cargar: () => Promise.all([import('@fontsource/montserrat'), import('@fontsource/montserrat/700.css')]),
  },
  {
    id: 'redondeada',
    etiqueta: 'Redondeada',
    pila: "'Poppins', ui-sans-serif, sans-serif",
    cargar: () => Promise.all([import('@fontsource/poppins'), import('@fontsource/poppins/700.css')]),
  },
  {
    id: 'tradicional',
    etiqueta: 'Tradicional',
    pila: "'Libre Baskerville', Georgia, serif",
    cargar: () =>
      Promise.all([import('@fontsource/libre-baskerville'), import('@fontsource/libre-baskerville/700.css')]),
  },
  {
    id: 'neutra',
    etiqueta: 'Neutra',
    pila: "'Work Sans', ui-sans-serif, sans-serif",
    cargar: () => Promise.all([import('@fontsource/work-sans'), import('@fontsource/work-sans/700.css')]),
  },
  {
    id: 'robusta',
    etiqueta: 'Robusta',
    pila: "'Bitter', Georgia, serif",
    cargar: () => Promise.all([import('@fontsource/bitter'), import('@fontsource/bitter/700.css')]),
  },
];

export const DENSIDADES_PDF = [
  { id: 'compacto', etiqueta: 'Compacto', escala: 0.9 },
  { id: 'normal', etiqueta: 'Normal', escala: 1 },
  { id: 'grande', etiqueta: 'Grande', escala: 1.12 },
];

export const obtenerFuente = (id) => FUENTES_PDF.find((f) => f.id === id) || FUENTES_PDF[0];
export const obtenerDensidad = (id) => DENSIDADES_PDF.find((d) => d.id === id) || DENSIDADES_PDF[1];
