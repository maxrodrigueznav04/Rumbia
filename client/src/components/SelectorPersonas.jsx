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
  if (!maximo || maximo <= 1) return null;

  return (
    <div className="selector-personas">
      <span className="etiqueta">Ver precios para</span>
      <div className="fila" style={{ gap: 8 }}>
        <Boton
          variante="fantasma"
          chico
          onClick={() => onCambio(Math.max(1, personas - 1))}
          disabled={personas <= 1}
          aria-label="Menos personas"
        >
          −
        </Boton>
        <strong>
          {personas} {personas === 1 ? 'persona' : 'personas'}
        </strong>
        <Boton
          variante="fantasma"
          chico
          onClick={() => onCambio(Math.min(maximo, personas + 1))}
          disabled={personas >= maximo}
          aria-label="Más personas"
        >
          +
        </Boton>
        {personas !== maximo && (
          <span className="tenue" style={{ fontSize: '0.8rem' }}>
            de {maximo} en el viaje
          </span>
        )}
      </div>
    </div>
  );
}
