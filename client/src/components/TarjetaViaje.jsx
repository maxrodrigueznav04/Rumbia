import { Link } from 'react-router-dom';
import { Insignia } from './ui.jsx';
import {
  formatoMoneda,
  rangoFechas,
  tiempoRelativo,
  ETIQUETAS_ESTADO,
} from '../utils/format.js';

/** Tarjeta de viaje del dashboard: escaneable de un vistazo. */
export default function TarjetaViaje({ viaje }) {
  const estado = ETIQUETAS_ESTADO[viaje.status] || ETIQUETAS_ESTADO.borrador;
  const esFuturo = new Date(viaje.startDate) > new Date();
  const moneda = viaje.budget?.currency || 'MXN';

  return (
    <Link to={`/viajes/${viaje._id}`} className="tarjeta tarjeta-link tarjeta-viaje">
      <div className={`viaje-franja ${viaje.status}`} aria-hidden="true" />

      <div className="viaje-cuerpo">
        <div className="fila-entre" style={{ marginBottom: 8 }}>
          <Insignia color={estado.color}>{estado.texto}</Insignia>
          {esFuturo && <span className="tenue">{tiempoRelativo(viaje.startDate)}</span>}
        </div>

        <h3 style={{ marginBottom: 4 }}>{viaje.title}</h3>
        <p className="tenue" style={{ margin: '0 0 12px' }}>
          📍 {viaje.destination?.name}
          {viaje.destination?.country ? `, ${viaje.destination.country}` : ''}
        </p>

        <div className="fila" style={{ gap: 8, fontSize: '0.85rem' }}>
          <Insignia>{rangoFechas(viaje.startDate, viaje.endDate)}</Insignia>
          <Insignia>
            {viaje.durationDays} {viaje.durationDays === 1 ? 'día' : 'días'}
          </Insignia>
          <Insignia>
            {viaje.travelers} {viaje.travelers === 1 ? 'viajero' : 'viajeros'}
          </Insignia>
        </div>

        {(viaje.budget?.amount > 0 || viaje.coreCosts?.total > 0) && (
          <div
            className="fila-entre"
            style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}
          >
            <span className="tenue">Capturado</span>
            <span className="numero">
              {formatoMoneda(viaje.coreCosts?.total || 0, moneda)}
              {viaje.budget?.amount > 0 && (
                <span className="tenue" style={{ fontWeight: 400 }}>
                  {' '}
                  / {formatoMoneda(viaje.budget.amount, moneda)}
                </span>
              )}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
