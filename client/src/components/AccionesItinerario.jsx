import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

/** En móvil, las acciones secundarias se despliegan dentro del flujo de la página. */
export default function AccionesItinerario({ principal, children }) {
  const { t } = useTranslation('itinerario');
  const [abiertas, setAbiertas] = useState(false);
  const id = useId();
  const disparador = useRef(null);

  return <div className="acciones-itinerario" onKeyDown={(event) => {
    if (event.key === 'Escape' && abiertas) {
      setAbiertas(false);
      disparador.current?.focus();
    }
  }}>
    {principal}
    <button ref={disparador} type="button" className="boton secundario acciones-itinerario-toggle"
      aria-expanded={abiertas} aria-controls={id} onClick={() => setAbiertas(!abiertas)}>
      {t('masAcciones')} <span aria-hidden="true">{abiertas ? '−' : '+'}</span>
    </button>
    <div id={id} className={`acciones-itinerario-secundarias${abiertas ? ' abiertas' : ''}`}>
      {children}
    </div>
  </div>;
}
