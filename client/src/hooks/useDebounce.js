import { useEffect, useState } from 'react';

/**
 * Retrasa la propagación de un valor que cambia rápido.
 * En el buscador evita disparar una petición por cada tecla.
 */
export function useDebounce(valor, ms = 350) {
  const [retrasado, setRetrasado] = useState(valor);

  useEffect(() => {
    const id = setTimeout(() => setRetrasado(valor), ms);
    return () => clearTimeout(id);
  }, [valor, ms]);

  return retrasado;
}

export default useDebounce;
