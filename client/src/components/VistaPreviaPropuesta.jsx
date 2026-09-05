import { Modal, Tarjeta, Boton, Aviso } from './ui.jsx';
import ResumenViaje from './ResumenViaje.jsx';
import { EncabezadoImpresion, PieImpresion, estiloPersonalizado } from './HojaImpresion.jsx';
import { calcularCotizacion, viajeParaCliente } from '../utils/cotizacion.js';
import { formatoMoneda, formatoFecha } from '../utils/format.js';

export default function VistaPreviaPropuesta({ viaje, itinerario, marca, onCerrar, onCompartir, compartiendo, error }) {
  const q = calcularCotizacion(viaje, itinerario);
  const moneda = viaje.budget?.currency || 'MXN';
  return <Modal abierto onCerrar={onCerrar} titulo="Vista previa del cliente" ancho={920}>
    <p className="suave">Revisa el contenido antes de crear o copiar el enlace para tu cliente.</p>
    {error && <Aviso tipo="error">{error}</Aviso>}
    <div className="pila vista-previa-propuesta" style={estiloPersonalizado(marca)}>
      <EncabezadoImpresion marca={marca} viaje={viaje} />
      <ResumenViaje viaje={viajeParaCliente(viaje)} personas={viaje.travelers} />
      {itinerario?.days?.map((dia) => <Tarjeta key={dia._id || dia.dayNumber} titulo={`Día ${dia.dayNumber} · ${dia.title}`}>
        <p className="tenue">{formatoFecha(dia.date)}</p><p>{dia.summary}</p>
        <div className="pila-sm">{dia.activities.map((act, index) => <article key={act._id || index} className="actividad-previa">
          <strong>{act.time} · {act.title}</strong><p>{act.description}</p>
          {act.location?.name && <p className="suave">{act.location.name}</p>}
          {!viaje.ocultarDesglose && act.estimatedCost > 0 && <span>{formatoMoneda(act.estimatedCost, moneda)} {moneda} por persona</span>}
        </article>)}</div>
      </Tarjeta>)}
      <Tarjeta titulo="Precio propuesto">
        {!viaje.ocultarDesglose && <p>Servicios: {formatoMoneda(q.servicios, moneda)} · Actividades: {formatoMoneda(q.actividades, moneda)} · Cuota de servicio: {formatoMoneda(q.margen, moneda)} {moneda}</p>}
        <p className="numero grande">{formatoMoneda(q.total, moneda)} {moneda}</p>
        <p>{formatoMoneda(q.porPersona, moneda)} {moneda} por persona · {viaje.travelers} viajeros</p>
        <p className="tenue">Incluye los servicios capturados y las actividades sugeridas. Precios y disponibilidad sujetos a confirmación.</p>
      </Tarjeta>
      <PieImpresion marca={marca} siempre />
    </div>
    <div className="modal-acciones"><Boton variante="secundario" onClick={onCerrar}>Volver a editar</Boton>{onCompartir && <Boton onClick={onCompartir} cargando={compartiendo}>Crear enlace para compartir</Boton>}</div>
  </Modal>;
}
