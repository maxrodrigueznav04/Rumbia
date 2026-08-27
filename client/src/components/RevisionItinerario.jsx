import { Tarjeta } from './ui.jsx';
import Icono from './Icono.jsx';

const ICONO_TIPO = { solape: 'alerta', hueco: 'calendario', clima: 'lluvia' };
const ETIQUETA_TIPO = { solape: 'Horario encimado', hueco: 'Hueco grande', clima: 'Riesgo de lluvia' };

/**
 * Pendientes detectados en el itinerario ya armado: horarios que se encimen,
 * huecos largos sin nada planeado, y actividades al aire libre en un día con
 * alta probabilidad de lluvia. No es un aviso de la IA: son cruces de datos
 * que la propia app ya tiene (ver utils/revisionItinerario.js).
 */
export default function RevisionItinerario({ avisos }) {
  if (!avisos.length) {
    return (
      <div className="no-imprimir">
        <Tarjeta className="revision-itinerario ok">
          <p className="fila" style={{ gap: 8, margin: 0 }}>
            <Icono nombre="palomita" tamano={16} />
            Sin huecos largos, horarios encimados ni actividades al aire libre en riesgo de lluvia.
          </p>
        </Tarjeta>
      </div>
    );
  }

  return (
    <div className="no-imprimir">
      <Tarjeta titulo="Antes de entregarlo, revisa esto" className="revision-itinerario">
        <ul className="pila-sm revision-lista">
          {avisos.map((a) => (
            <li key={a.id} className={`revision-item ${a.tipo}`}>
              <Icono nombre={ICONO_TIPO[a.tipo]} tamano={16} />
              <span>
                <strong className="revision-etiqueta">{ETIQUETA_TIPO[a.tipo]}.</strong> {a.mensaje}
              </span>
            </li>
          ))}
        </ul>
      </Tarjeta>
    </div>
  );
}
