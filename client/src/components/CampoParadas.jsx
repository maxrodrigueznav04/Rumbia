import { useTranslation } from 'react-i18next';
import CampoDestino from './CampoDestino.jsx';
import CampoFechas from './CampoFechas.jsx';
import { Boton } from './ui.jsx';
import { reglas } from '../utils/validacion.js';
import { paraInputFecha } from '../utils/format.js';

/** Una parada vacia, lista para llenar. */
export const paradaVacia = () => ({ destino: '', lugarElegido: null, startDate: '', endDate: '' });

/**
 * Lista editable de paradas adicionales, para viajes de mas de una ciudad.
 * Reusa CampoDestino y CampoFechas por fila -- ninguno de los dos sabe que
 * esta dentro de una lista, cada instancia es independiente.
 *
 * `paradas` es un array de { destino, lugarElegido, startDate, endDate } (el
 * mismo shape que ya usan NuevoViaje/FormViaje para el destino principal,
 * solo que aqui hay N). El padre decide como convertir esto al payload que
 * espera el backend (additionalDestinations) al enviar el formulario.
 */
export default function CampoParadas({ paradas, onCambio, tripStart, tripEnd }) {
  const { t } = useTranslation('campos');
  // Actualizador funcional a proposito: CampoDestino dispara onChange y
  // onSeleccionar seguidos al elegir una sugerencia (uno pone el texto, el
  // otro las coordenadas), los dos dentro del mismo evento de click. Con un
  // `paradas.map(...)` armado contra el array capturado en el closure, la
  // segunda llamada se le adelanta a la primera con datos viejos y pisa el
  // cambio recien hecho. `onCambio` es el setState del padre: pasarle una
  // funcion en vez del array ya resuelto hace que cada actualizacion parta
  // siempre del estado mas reciente, no del que habia al renderizar.
  const actualizar = (i, cambios) => {
    onCambio((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...cambios } : p)));
  };
  const quitar = (i) => onCambio((prev) => prev.filter((_, idx) => idx !== i));
  const agregar = () => onCambio((prev) => [...prev, paradaVacia()]);

  return (
    <div className="campo">
      <label>{t('paradas.label')}</label>
      <p className="campo-ayuda" style={{ marginTop: 0 }}>
        {t('paradas.ayuda')}
      </p>

      <div className="pila-sm">
        {paradas.map((parada, i) => {
          const errorFechas = tripStart && tripEnd
            ? reglas.paradaEnRango(parada.startDate, parada.endDate, tripStart, tripEnd)
            : null;

          return (
            <div key={i} className="tarjeta" style={{ padding: 'var(--e3)' }}>
              <div className="fila-entre" style={{ marginBottom: 'var(--e2)' }}>
                <strong style={{ fontSize: '0.9rem' }}>{t('paradas.parada', { numero: i + 1 })}</strong>
                <button
                  type="button"
                  className="boton fantasma chico"
                  onClick={() => quitar(i)}
                  aria-label={t('paradas.quitarParada', { numero: i + 1 })}
                >
                  {t('paradas.quitar')}
                </button>
              </div>

              <div className="pila-sm">
                <CampoDestino
                  label={t('paradas.otraCiudad')}
                  name={`parada-${i}`}
                  placeholder={t('paradas.placeholder')}
                  value={parada.destino}
                  onChange={(e) => actualizar(i, { destino: e.target.value, lugarElegido: null })}
                  onSeleccionar={(lugar) => actualizar(i, { lugarElegido: lugar })}
                />

                <CampoFechas
                  inicio={parada.startDate}
                  fin={parada.endDate}
                  minimo={tripStart || undefined}
                  etiquetaInicio={t('fechas.llegada')}
                  etiquetaFin={t('fechas.salida')}
                  onCambio={({ inicio, fin }) => actualizar(i, { startDate: inicio, endDate: fin })}
                  errorFin={errorFechas}
                />
              </div>
            </div>
          );
        })}
      </div>

      <Boton type="button" variante="secundario" chico onClick={agregar} style={{ marginTop: 'var(--e2)' }}>
        {t('paradas.agregar')}
      </Boton>
    </div>
  );
}

/**
 * Convierte las filas del formulario al shape que espera el backend
 * (additionalDestinations). Descarta filas incompletas en silencio -- son
 * paradas a medio llenar que el usuario todavia no termino, no un error.
 */
export function paradasAPayload(paradas) {
  return paradas
    .filter((p) => p.destino.trim() && p.startDate && p.endDate)
    .map((p) => ({
      place: p.lugarElegido
        ? { name: p.lugarElegido.name, lat: p.lugarElegido.lat, lng: p.lugarElegido.lng, country: p.lugarElegido.country }
        : { name: p.destino.trim() },
      startDate: p.startDate,
      endDate: p.endDate,
    }));
}

/** Direccion inversa: additionalDestinations del backend -> filas editables del formulario. */
export function payloadAParadas(additionalDestinations) {
  return (additionalDestinations || []).map((p) => ({
    destino: [p.place?.name, p.place?.country].filter(Boolean).join(', '),
    lugarElegido: p.place?.lat != null ? { ...p.place } : null,
    startDate: paraInputFecha(p.startDate),
    endDate: paraInputFecha(p.endDate),
  }));
}
