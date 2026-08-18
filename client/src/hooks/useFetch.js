import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Carga datos de la API con estados de carga/error y cancelacion al desmontar.
 *
 * @param {(opts:{signal:AbortSignal}) => Promise<any>} fetcher
 * @param {any[]} deps  dependencias que disparan una recarga
 */
export function useFetch(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // Se guarda en ref para no re-suscribir el efecto en cada render.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const [recargas, setRecargas] = useState(0);
  const recargar = useCallback(() => setRecargas((n) => n + 1), []);

  useEffect(() => {
    const controlador = new AbortController();
    let vivo = true;

    setCargando(true);
    setError(null);

    fetcherRef
      .current({ signal: controlador.signal })
      .then((res) => {
        if (vivo) setData(res);
      })
      .catch((err) => {
        if (vivo && err.name !== 'AbortError') setError(err);
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });

    return () => {
      vivo = false;
      controlador.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, recargas]);

  return { data, cargando, error, recargar, setData };
}

export default useFetch;
