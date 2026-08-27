import { useEffect, useRef, useState } from 'react';

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

// Promesa compartida entre instancias: si dos formularios montan el captcha a
// la vez, el script de Cloudflare se inyecta una sola vez.
let cargaScript;

function cargarTurnstile() {
  if (window.turnstile) return Promise.resolve();
  if (!cargaScript) {
    cargaScript = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = () => {
        cargaScript = undefined; // deja reintentar en el siguiente montaje
        reject(new Error('No se pudo cargar Turnstile.'));
      };
      document.head.appendChild(script);
    });
  }
  return cargaScript;
}

/**
 * Verificación humana con Cloudflare Turnstile.
 *
 * Sin VITE_TURNSTILE_SITE_KEY configurada no renderiza nada: el formulario
 * sigue funcionando exactamente igual que antes de que existiera el captcha.
 * Así es en desarrollo local, y así sigue siendo en producción hasta que se
 * dé de alta la cuenta de Cloudflare y se cargue la llave.
 */
export default function Captcha({ onToken }) {
  const contenedorRef = useRef(null);
  const widgetIdRef = useRef(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!SITE_KEY) return undefined;
    let cancelado = false;

    cargarTurnstile()
      .then(() => {
        if (cancelado || !contenedorRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(contenedorRef.current, {
          sitekey: SITE_KEY,
          callback: (token) => onToken(token),
          'expired-callback': () => onToken(''),
          'error-callback': () => {
            onToken('');
            setError(true);
          },
        });
      })
      .catch(() => setError(true));

    return () => {
      cancelado = true;
      if (widgetIdRef.current != null && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!SITE_KEY) return null;

  return (
    <div className="campo">
      <div ref={contenedorRef} />
      {error && (
        <span className="campo-error">
          No pudimos cargar la verificación. Revisa tu conexión e intenta de nuevo.
        </span>
      )}
    </div>
  );
}
