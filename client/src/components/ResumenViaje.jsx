import { Tarjeta } from './ui.jsx';
import { formatoMoneda, formatoFecha, formatoFechaHora, humanizar, porPersonas } from '../utils/format.js';

const ICONO_MODO = {
  avion: '✈️',
  autobus: '🚌',
  'auto-propio': '🚗',
  tren: '🚆',
  otro: '🧭',
};

function Tramo({ etiqueta, datos, moneda, travelers, personas, ocultarDesglose }) {
  const hayDatos = datos?.provider || datos?.cost > 0 || datos?.departureAt || datos?.notes;
  if (!hayDatos) return null;

  return (
    <div className="linea-gasto">
      <span className="crece" style={{ minWidth: 0 }}>
        <strong>
          {ICONO_MODO[datos.mode] || '🧭'} {etiqueta}
        </strong>{' '}
        <span className="tenue">
          {humanizar(datos.mode || '')}
          {datos.provider ? ` · ${datos.provider}` : ''}
          {datos.departureAt ? ` · ${formatoFechaHora(datos.departureAt)}` : ''}
        </span>
        {datos.bookingRef && (
          <span className="tenue" style={{ display: 'block', fontSize: '0.8rem' }}>
            Confirmación: {datos.bookingRef}
          </span>
        )}
        {datos.notes && (
          <span className="tenue" style={{ display: 'block', fontSize: '0.8rem' }}>
            {datos.notes}
          </span>
        )}
      </span>

      {!ocultarDesglose && datos.cost > 0 && (
        <span className="numero">
          {formatoMoneda(porPersonas(datos.cost, travelers, personas), moneda)}
          {datos.isEstimate && <span className="tenue" style={{ fontWeight: 400 }}> est.</span>}
        </span>
      )}
    </div>
  );
}

function Hospedaje({ items, moneda, travelers, personas, ocultarDesglose }) {
  return (
    <div className="pila-sm">
      {items.map((l, i) => (
        <div className="linea-gasto" key={l._id || i}>
          <span className="crece" style={{ minWidth: 0 }}>
            <strong>🏨 {l.name || humanizar(l.type)}</strong>
            <span className="tenue" style={{ display: 'block', fontSize: '0.82rem' }}>
              {humanizar(l.type)}
              {l.place?.name ? ` · ${l.place.name}` : ''}
              {l.checkIn && l.checkOut ? ` · ${formatoFecha(l.checkIn)} – ${formatoFecha(l.checkOut)}` : ''}
              {l.nights ? ` · ${l.nights} ${l.nights === 1 ? 'noche' : 'noches'}` : ''}
              {l.isEstimate ? ' · estimado' : ''}
            </span>
            {l.bookingRef && (
              <span className="tenue" style={{ display: 'block', fontSize: '0.78rem' }}>
                Confirmación: {l.bookingRef}
              </span>
            )}
          </span>
          {!ocultarDesglose && l.subtotal > 0 && (
            <span className="numero">{formatoMoneda(porPersonas(l.subtotal, travelers, personas), moneda)}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function TransporteLocal({ items, moneda, travelers, personas, ocultarDesglose }) {
  return (
    <div className="pila-sm">
      {items.map((t, i) => (
        <div className="linea-gasto" key={t._id || i}>
          <span className="crece" style={{ minWidth: 0 }}>
            <strong>🚕 {humanizar(t.type)}</strong>
            {(t.provider || t.notes) && (
              <span className="tenue" style={{ display: 'block', fontSize: '0.82rem' }}>
                {[t.provider, t.notes].filter(Boolean).join(' · ')}
              </span>
            )}
          </span>
          {!ocultarDesglose && t.estimatedCost > 0 && (
            <span className="numero">
              {formatoMoneda(porPersonas(t.estimatedCost, travelers, personas), moneda)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Vuelos, hospedaje y transporte local del viaje: lo que le falta al
 * itinerario para que quien lo lea vea el viaje completo, no solo las
 * actividades del día a día. Solo lectura: se usa tanto en el PDF privado
 * como en el enlace público, donde nadie edita nada.
 *
 * `personas` es cuántas de las `viaje.travelers` se están mostrando (por
 * default, todas): un padre viendo el total de la familia, o alguien viendo
 * solo lo que le toca a su pareja y a él. Los montos ya vienen capturados
 * como total del grupo, así que se escalan con `porPersonas`.
 */
export default function ResumenViaje({ viaje, personas }) {
  const moneda = viaje.budget?.currency || 'MXN';
  const travelers = viaje.travelers || 1;
  const paraCuantos = personas || travelers;
  const ocultarDesglose = Boolean(viaje.ocultarDesglose);
  const ida = viaje.transport?.outbound;
  const vuelta = viaje.transport?.inbound;
  const hayTransporte =
    ida?.provider ||
    ida?.cost > 0 ||
    ida?.departureAt ||
    ida?.notes ||
    vuelta?.provider ||
    vuelta?.cost > 0 ||
    vuelta?.departureAt ||
    vuelta?.notes;
  const hayHospedaje = viaje.lodging?.length > 0;
  const hayLocal = viaje.localTransport?.length > 0;

  if (!hayTransporte && !hayHospedaje && !hayLocal) return null;

  const titulo =
    !ocultarDesglose && paraCuantos !== travelers
      ? `Vuelos, hospedaje y transporte · para ${paraCuantos} de ${travelers}`
      : 'Vuelos, hospedaje y transporte';

  return (
    <Tarjeta titulo={titulo}>
      {hayTransporte && (
        <div className="pila-sm" style={{ marginBottom: hayHospedaje || hayLocal ? 'var(--e4)' : 0 }}>
          <span className="etiqueta">Transporte de ida y vuelta</span>
          <Tramo
            etiqueta="Ida"
            datos={ida}
            moneda={moneda}
            travelers={travelers}
            personas={paraCuantos}
            ocultarDesglose={ocultarDesglose}
          />
          <Tramo
            etiqueta="Vuelta"
            datos={vuelta}
            moneda={moneda}
            travelers={travelers}
            personas={paraCuantos}
            ocultarDesglose={ocultarDesglose}
          />
        </div>
      )}

      {hayHospedaje && (
        <div className="pila-sm" style={{ marginBottom: hayLocal ? 'var(--e4)' : 0 }}>
          <span className="etiqueta">Hospedaje</span>
          <Hospedaje
            items={viaje.lodging}
            moneda={moneda}
            travelers={travelers}
            personas={paraCuantos}
            ocultarDesglose={ocultarDesglose}
          />
        </div>
      )}

      {hayLocal && (
        <div className="pila-sm">
          <span className="etiqueta">Transporte en el destino</span>
          <TransporteLocal
            items={viaje.localTransport}
            moneda={moneda}
            travelers={travelers}
            personas={paraCuantos}
            ocultarDesglose={ocultarDesglose}
          />
        </div>
      )}

      {ocultarDesglose && (
        <p className="tenue" style={{ margin: '12px 0 0', fontSize: '0.8rem' }}>
          El total de todo esto está incluido en el costo del viaje, más abajo.
        </p>
      )}
    </Tarjeta>
  );
}
