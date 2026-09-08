import { useTranslation } from 'react-i18next';
import { Boton } from './ui.jsx';

/**
 * Deja ver los costos como si se pagara por menos gente de la que viaja: un
 * papá que cubre a todos, una pareja que solo paga lo suyo, alguien que viaja
 * solo dentro de un grupo más grande. No cambia nada guardado, solo cómo se
 * muestran los números en esta pantalla — por eso vive en cada página que lo
 * usa y no en el viaje mismo.
 *
 * Con un solo viajero no hay nada que elegir: no se muestra.
 *
 * Los botones de +/- se ocultan solos al imprimir (regla global para todo
 * boton), pero el texto se queda: en el PDF sirve para dejar claro para
 * cuantas personas se calculo lo que se esta mostrando.
 */
export default function SelectorPersonas({ personas, maximo, onCambio }) {
  const { t } = useTranslation('campos');
  if (!maximo || maximo <= 1) return null;

  return (
    <div className="selector-personas no-imprimir">
      <span className="etiqueta">{t('personas.verPreciosPara')}</span>
      <div className="fila" style={{ gap: 8 }}>
        <Boton
          variante="fantasma"
          chico
          onClick={() => onCambio(Math.max(1, personas - 1))}
          disabled={personas <= 1}
          aria-label={t('personas.menosPersonas')}
        >
          −
        </Boton>
        <strong>
          {personas} {personas === 1 ? t('personas.persona') : t('personas.personas')}
        </strong>
        <Boton
          variante="fantasma"
          chico
          onClick={() => onCambio(Math.min(maximo, personas + 1))}
          disabled={personas >= maximo}
          aria-label={t('personas.masPersonas')}
        >
          +
        </Boton>
        {personas !== maximo && (
          <span className="tenue" style={{ fontSize: '0.8rem' }}>
            {t('personas.deEnElViaje', { maximo })}
          </span>
        )}
      </div>
    </div>
  );
}
