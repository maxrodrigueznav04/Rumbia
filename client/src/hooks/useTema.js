import { useCallback, useEffect, useState } from 'react';

const CLAVE = 'rumbo-tema';
export const TEMAS = ['sistema', 'claro', 'oscuro'];

const leerGuardado = () => {
  try {
    const guardado = localStorage.getItem(CLAVE);
    return TEMAS.includes(guardado) ? guardado : 'sistema';
  } catch {
    // Navegacion privada estricta puede bloquear localStorage: se sigue al
    // sistema, sin que la app truene por esto.
    return 'sistema';
  }
};

const aplicar = (tema) => {
  if (tema === 'sistema') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', tema);
  }
};

/**
 * Tema claro/oscuro/sistema, persistido en localStorage.
 *
 * "sistema" no guarda nada (se borra el atributo): el CSS ya sigue
 * prefers-color-scheme por su cuenta sin ayuda de JS. Solo una eleccion
 * explicita necesita el atributo data-theme para ganarle al sistema.
 */
export function useTema() {
  const [tema, setTemaState] = useState(leerGuardado);

  useEffect(() => {
    aplicar(tema);
  }, [tema]);

  const cambiarTema = useCallback((nuevo) => {
    if (!TEMAS.includes(nuevo)) return;
    setTemaState(nuevo);
    try {
      if (nuevo === 'sistema') localStorage.removeItem(CLAVE);
      else localStorage.setItem(CLAVE, nuevo);
    } catch {
      /* sin guardar persiste solo en lo que dure la pestaña, no es grave */
    }
  }, []);

  return { tema, cambiarTema };
}

export default useTema;
