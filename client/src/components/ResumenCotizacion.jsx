import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Boton, Tarjeta } from './ui.jsx';
import { formatoMonedaConCodigo as formatoMoneda } from '../utils/format.js';
import { calcularCotizacion } from '../utils/cotizacion.js';

export default function ResumenCotizacion({ viaje, onEditar, onVistaPrevia }) {
  const { t } = useTranslation('itinerario');
  const q = calcularCotizacion(viaje);
  const precioPendiente = q.base === 0 && q.pendientes.length > 0;
  const moneda = viaje.budget?.currency || 'MXN';
  const dinero = (n) => formatoMoneda(n, moneda);
  return <Tarjeta titulo={t('cotizacion.titulo')} className="resumen-cotizacion">
    <div className="metricas-cotizacion">
      <div><span>{t('cotizacion.serviciosCapturados')}</span><strong>{q.servicios > 0 ? dinero(q.servicios) : t('cotizacion.pendienteDeConfirmar')}</strong></div>
      <div><span>{t('cotizacion.actividadesSugeridas')}</span><strong>{viaje.itinerary ? dinero(q.actividades) : t('cotizacion.sinItinerario')}</strong></div>
      <div><span>{t('cotizacion.margen')}</span><strong>{dinero(q.margen)}</strong></div>
      <div className="precio-cliente"><span>{q.pendientes.length ? t('cotizacion.precioPorCompletar') : t('cotizacion.precioPropuesto')} · {viaje.travelers} {viaje.travelers === 1 ? t('cotizacion.viajero') : t('cotizacion.viajeros')}</span><strong>{precioPendiente ? t('cotizacion.pendienteDeCotizar') : dinero(q.total)}</strong>{!precioPendiente && <span>{dinero(q.porPersona)} {t('cotizacion.porPersona')}</span>}</div>
    </div>
    <p className="suave">{t('cotizacion.explicacion')}</p>
    {q.pendientes.length > 0 && <p className="pendientes-cotizacion" role="status"><strong>{t('cotizacion.porConfirmar')}</strong> {q.pendientes.map((clave) => t(`cotizacion.pendientes.${clave}`)).join(' · ')}. {t('cotizacion.revisaSiAplican')}</p>}
    <nav className="pasos-propuesta" aria-label={t('cotizacion.pasos.aria')}>
      <a href="#costos-viaje" className="boton secundario">{t('cotizacion.pasos.completarCostos')}</a>
      <Boton variante="secundario" onClick={onEditar}>{t('cotizacion.pasos.clienteYMargen')}</Boton>
      {viaje.itinerary ? <Boton onClick={onVistaPrevia}>{t('cotizacion.pasos.vistaPrevia')}</Boton> : <Link className="boton" to={`/viajes/${viaje._id}/itinerario`}>{t('cotizacion.pasos.crear')}</Link>}
      {viaje.itinerary && <Link className="boton secundario" to={`/viajes/${viaje._id}/itinerario?entregar=1`}>{t('cotizacion.pasos.prepararEntrega')}</Link>}
    </nav>
  </Tarjeta>;
}
