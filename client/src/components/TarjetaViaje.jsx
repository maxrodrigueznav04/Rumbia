import { Link } from 'react-router-dom';
import { Insignia } from './ui.jsx';
import {
  formatoMoneda,
  rangoFechas,
  tiempoRelativo,
  ETIQUETAS_ESTADO,
} from '../utils/format.js';

/**
 * Tarjeta de viaje del dashboard.
 *
 * La jerarquía la manda el destino, no el título: cuando alguien busca entre
 * sus viajes piensa "el de Oaxaca", no "el que llamé "escapada de mezcal"".
 * La franja superior codifica el estado y la barra inferior deja ver de un
 * vistazo qué tanto del presupuesto ya está comprometido.
 */
export default function TarjetaViaje({ viaje }) {
  const estado = ETIQUETAS_ESTADO[viaje.status] || ETIQUETAS_ESTADO.borrador;
  const esFuturo = new Date(viaje.startDate) > new Date();
  const moneda = viaje.budget?.currency || 'MXN';

  const gastado = viaje.coreCosts?.total || 0;
  const presupuesto = viaje.budget?.amount || 0;
  const porcentaje = presupuesto > 0 ? Math.min(100, (gastado / presupuesto) * 100) : 0;
  const excedido = presupuesto > 0 && gastado > presupuesto;

  return (
    <Link to={`/viajes/${viaje._id}`} className="tarjeta tarjeta-link tarjeta-viaje">
      <div className={`viaje-franja ${viaje.status}`} aria-hidden="true" />

      <div className="viaje-cuerpo">
        <div className="fila-entre" style={{ marginBottom: 'var(--e3)' }}>
          <Insignia color={estado.color}>{estado.texto}</Insignia>
          {esFuturo && <span className="tenue">{tiempoRelativo(viaje.startDate)}</span>}
        </div>

        <h3 className="viaje-destino">{viaje.destination?.name}</h3>
        <p className="viaje-titulo">{viaje.title}</p>

        <div className="viaje-meta">
          <span className="viaje-fechas">{rangoFechas(viaje.startDate, viaje.endDate)}</span>
          <span aria-hidden="true">·</span>
          <span>
            {viaje.durationDays} {viaje.durationDays === 1 ? 'día' : 'días'}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {viaje.travelers} {viaje.travelers === 1 ? 'viajero' : 'viajeros'}
          </span>
        </div>

        {(presupuesto > 0 || gastado > 0) && (
          <div className="viaje-presupuesto">
            {presupuesto > 0 && (
              <div className="barra" style={{ height: 6 }}>
                <div
                  className={`barra-relleno ${excedido ? 'excedido' : porcentaje > 80 ? 'alerta' : ''}`}
                  style={{ width: `${porcentaje}%` }}
                />
              </div>
            )}
            <div className="fila-entre" style={{ marginTop: 7 }}>
              <span className="tenue">
                {presupuesto > 0 ? `${Math.round(porcentaje)}% del presupuesto` : 'Capturado'}
              </span>
              <span className="numero" style={{ fontSize: '0.92rem' }}>
                {formatoMoneda(gastado, moneda)}
                {presupuesto > 0 && (
                  <span className="tenue" style={{ fontWeight: 400 }}>
                    {' / '}
                    {formatoMoneda(presupuesto, moneda)}
                  </span>
                )}
              </span>
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}
