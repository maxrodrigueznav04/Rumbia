import { Link } from 'react-router-dom';
import { Boton, Tarjeta } from './ui.jsx';
import { formatoMoneda } from '../utils/format.js';
import { calcularCotizacion } from '../utils/cotizacion.js';

export default function ResumenCotizacion({ viaje, onEditar, onVistaPrevia }) {
  const q = calcularCotizacion(viaje);
  const precioPendiente = q.base === 0 && q.pendientes.length > 0;
  const moneda = viaje.budget?.currency || 'MXN';
  const dinero = (n) => `${formatoMoneda(n, moneda)} ${moneda}`;
  return <Tarjeta titulo="Cotización para el cliente" className="resumen-cotizacion">
    <div className="metricas-cotizacion">
      <div><span>Servicios capturados</span><strong>{q.servicios > 0 ? dinero(q.servicios) : 'Pendiente de confirmar'}</strong></div>
      <div><span>Actividades sugeridas incluidas</span><strong>{viaje.itinerary ? dinero(q.actividades) : 'Sin itinerario'}</strong></div>
      <div><span>Margen / cuota de servicio</span><strong>{dinero(q.margen)}</strong></div>
      <div className="precio-cliente"><span>{q.pendientes.length ? 'Precio por completar' : 'Precio propuesto'} · {viaje.travelers} {viaje.travelers === 1 ? 'viajero' : 'viajeros'}</span><strong>{precioPendiente ? 'Pendiente de cotizar' : dinero(q.total)}</strong>{!precioPendiente && <span>{dinero(q.porPersona)} por persona</span>}</div>
    </div>
    <p className="suave">Este es el precio del itinerario, PDF y enlace del cliente. Las actividades son estimadas; los gastos internos se registran por separado.</p>
    {q.pendientes.length > 0 && <p className="pendientes-cotizacion" role="status"><strong>Por confirmar:</strong> {q.pendientes.join(' · ')}. Revisa si aplican antes de entregar.</p>}
    <nav className="pasos-propuesta" aria-label="Preparar propuesta">
      <a href="#costos-viaje" className="boton secundario">1. Completar costos</a>
      <Boton variante="secundario" onClick={onEditar}>2. Cliente y margen</Boton>
      {viaje.itinerary ? <Boton onClick={onVistaPrevia}>3. Vista previa del cliente</Boton> : <Link className="boton" to={`/viajes/${viaje._id}/itinerario`}>3. Crear itinerario</Link>}
      {viaje.itinerary && <Link className="boton secundario" to={`/viajes/${viaje._id}/itinerario?entregar=1`}>4. Preparar entrega</Link>}
    </nav>
  </Tarjeta>;
}
