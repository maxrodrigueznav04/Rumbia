import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Insignia } from './ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  formatoMonedaConCodigo as formatoMoneda,
  rangoFechas,
  tiempoRelativo,
  ETIQUETAS_ESTADO,
  ETIQUETAS_ESTADO_PROPUESTA,
  nombreDestino,
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
  const { t } = useTranslation('viaje');
  const { t: tDominio } = useTranslation('dominio');
  const { user } = useAuth();
  // El embudo de ventas (estadoPropuesta) solo le importa a quien cotiza
  // para clientes; un viajero planeando lo suyo no tiene "propuesta" que enviar.
  const esAgencia = user?.preferences?.perfilUso !== 'personal';
  const estado = ETIQUETAS_ESTADO[viaje.status] || ETIQUETAS_ESTADO.borrador;
  const estadoPropuesta = ETIQUETAS_ESTADO_PROPUESTA[viaje.estadoPropuesta] || ETIQUETAS_ESTADO_PROPUESTA.borrador;
  const textoEstado = tDominio(`estadoViaje.${viaje.status}`, { defaultValue: estado.texto });
  const textoEstadoPropuesta = tDominio(`estadoPropuesta.${viaje.estadoPropuesta}`, { defaultValue: estadoPropuesta.texto });
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
          <span className="fila" style={{ gap: 6, flexWrap: 'wrap' }}>
            <Insignia color={estado.color}>{textoEstado}</Insignia>
            {esAgencia && <Insignia color={estadoPropuesta.color}>{textoEstadoPropuesta}</Insignia>}
          </span>
          {esFuturo && <span className="tenue">{tiempoRelativo(viaje.startDate)}</span>}
        </div>

        <h3 className="viaje-destino">{nombreDestino(viaje)}</h3>
        <p className="viaje-titulo">{viaje.title}</p>
        {esAgencia && <p className="tenue">{t('tarjetaViaje.creadoPor', { nombre: String(viaje.user?._id || viaje.user) === String(user?._id) ? user?.name : t('tarjetaViaje.integranteDelEquipo') })}{!viaje.cliente?.nombre && t('tarjetaViaje.clientePorAsignar')}</p>}
        {viaje.cliente?.nombre && (
          <p className="tenue" style={{ margin: '2px 0 0', fontSize: '0.85rem' }}>
            {t('tarjetaViaje.para', { nombre: viaje.cliente.nombre })}
          </p>
        )}

        <div className="viaje-meta">
          <span className="viaje-fechas">{rangoFechas(viaje.startDate, viaje.endDate)}</span>
          <span aria-hidden="true">·</span>
          <span>
            {viaje.durationDays} {viaje.durationDays === 1 ? t('tarjetaViaje.dia') : t('tarjetaViaje.dias')}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {viaje.travelers} {viaje.travelers === 1 ? t('tarjetaViaje.viajero') : t('tarjetaViaje.viajeros')}
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
                {presupuesto > 0 ? t('tarjetaViaje.porcentajeDelPresupuesto', { porcentaje: Math.round(porcentaje) }) : t('tarjetaViaje.capturado')}
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
