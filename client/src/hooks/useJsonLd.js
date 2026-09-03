import { useEffect } from 'react';

/**
 * Inyecta un bloque JSON-LD (datos estructurados de schema.org) en <head>
 * mientras el componente que lo llama está montado, y lo quita al salir.
 *
 * `id` evita duplicar el script si el componente se vuelve a montar rápido
 * (StrictMode en desarrollo, fast refresh): si ya existe un script con ese
 * id se reusa en vez de crear otro, y solo se borra al desmontar si este
 * hook fue quien lo creó.
 */
export function useJsonLd(id, data) {
  useEffect(() => {
    if (!data) return undefined;

    let script = document.getElementById(id);
    const yaExistia = Boolean(script);
    if (!script) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = id;
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(data);

    return () => {
      if (!yaExistia) script.remove();
    };
  }, [id, data]);
}

export default useJsonLd;
