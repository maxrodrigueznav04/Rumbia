import { useEffect } from 'react';

const SITIO = 'https://rumbiamx.com';
const TITULO_BASE = 'Rumbia — Planeador de viajes y cotizador para agencias';

/**
 * Pone el <title>, la meta description y el <link rel="canonical"> de
 * index.html para una página pública concreta, y los devuelve a su valor
 * base al desmontar (es una SPA: sin esto, cualquier página que no llame a
 * este hook se queda con el título de la última que sí lo hizo).
 *
 * Sin esto, TODAS las rutas se indexaban con el mismo título/descripción de
 * la portada, y peor: con el mismo canonical apuntando a "/" — eso le decía
 * a Google que /acerca y /terminos eran duplicados de la portada, así que
 * nunca se indexaban por separado.
 */
export function useMetaPagina({ titulo, descripcion, ruta }) {
  useEffect(() => {
    const tituloAnterior = document.title;
    if (titulo) document.title = `${titulo} — Rumbia`;

    const metaDescripcion = document.querySelector('meta[name="description"]');
    const descripcionAnterior = metaDescripcion?.getAttribute('content');
    if (metaDescripcion && descripcion) metaDescripcion.setAttribute('content', descripcion);

    const linkCanonical = document.querySelector('link[rel="canonical"]');
    const canonicalAnterior = linkCanonical?.getAttribute('href');
    if (linkCanonical && ruta) linkCanonical.setAttribute('href', `${SITIO}${ruta}`);

    return () => {
      document.title = tituloAnterior || TITULO_BASE;
      if (metaDescripcion && descripcionAnterior) metaDescripcion.setAttribute('content', descripcionAnterior);
      if (linkCanonical && canonicalAnterior) linkCanonical.setAttribute('href', canonicalAnterior);
    };
  }, [titulo, descripcion, ruta]);
}

export default useMetaPagina;
