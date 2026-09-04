import { useEffect, useState } from 'react';
import { SERVIDOR_LENTO, SERVIDOR_LISTO } from '../api/client.js';

/**
 * Banner que aparece cuando el servidor tarda más de unos segundos.
 *
 * Existe por el plan gratuito de Render: tras 15 minutos sin tráfico el
 * servicio se duerme y la primera petición tarda ~30-50 s. Sin este aviso el
 * visitante ve un spinner eterno y se va pensando que la demo está rota.
 */
export default function AvisoServidor() {
  const [lento, setLento] = useState(false);

  useEffect(() => {
    const encender = () => setLento(true);
    const apagar = () => setLento(false);

    window.addEventListener(SERVIDOR_LENTO, encender);
    window.addEventListener(SERVIDOR_LISTO, apagar);
    return () => {
      window.removeEventListener(SERVIDOR_LENTO, encender);
      window.removeEventListener(SERVIDOR_LISTO, apagar);
    };
  }, []);

  if (!lento) return null;

  return (
    <div className="aviso-servidor" role="status">
      <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
      Despertando el servidor... la primera carga del día puede tardar hasta un minuto.
    </div>
  );
}
