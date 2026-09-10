import { useTranslation } from 'react-i18next';
import { Modal, Tarjeta, Boton, Aviso } from './ui.jsx';
import ResumenViaje from './ResumenViaje.jsx';
import { EncabezadoImpresion, PieImpresion, estiloPersonalizado } from './HojaImpresion.jsx';
import { calcularCotizacion, viajeParaCliente } from '../utils/cotizacion.js';
import { formatoMonedaConCodigo as formatoMoneda, formatoFecha } from '../utils/format.js';

export default function VistaPreviaPropuesta({ viaje, itinerario, marca, onCerrar, onCompartir, compartiendo, error }) {
  const { t } = useTranslation('itinerario');
  const q = calcularCotizacion(viaje, itinerario);
  const moneda = viaje.budget?.currency || 'MXN';
  return <Modal abierto onCerrar={onCerrar} titulo={t('vistaPrevia.titulo')} ancho={920}>
    <p className="suave">{t('vistaPrevia.texto')}</p>
    {error && <Aviso tipo="error">{error}</Aviso>}
    <div className="pila vista-previa-propuesta" style={estiloPersonalizado(marca)}>
      <EncabezadoImpresion marca={marca} viaje={viaje} />
      <ResumenViaje viaje={viajeParaCliente(viaje)} personas={viaje.travelers} />
      {itinerario?.days?.map((dia) => <Tarjeta key={dia._id || dia.dayNumber} titulo={t('vistaPrevia.dia', { numero: dia.dayNumber, titulo: dia.title })}>
        <p className="tenue">{formatoFecha(dia.date)}</p><p>{dia.summary}</p>
        <div className="pila-sm">{dia.activities.map((act, index) => <article key={act._id || index} className="actividad-previa">
          <strong>{act.time} · {act.title}</strong><p>{act.description}</p>
          {act.location?.name && <p className="suave">{act.location.name}</p>}
          {!viaje.ocultarDesglose && act.estimatedCost > 0 && <span>{formatoMoneda(act.estimatedCost, moneda)} {t('vistaPrevia.porPersona')}</span>}
        </article>)}</div>
      </Tarjeta>)}
      <Tarjeta titulo={t('vistaPrevia.precioPropuesto')}>
        {!viaje.ocultarDesglose && <p>{t('vistaPrevia.servicios', { servicios: formatoMoneda(q.servicios, moneda), actividades: formatoMoneda(q.actividades, moneda), margen: formatoMoneda(q.margen, moneda) })}</p>}
        <p className="numero grande">{formatoMoneda(q.total, moneda)}</p>
        <p>{t('vistaPrevia.totalPorPersona', { monto: formatoMoneda(q.porPersona, moneda), viajeros: viaje.travelers })}</p>
        <p className="tenue">{t('vistaPrevia.notaFinal')}</p>
      </Tarjeta>
      <PieImpresion marca={marca} siempre />
    </div>
    <div className="modal-acciones"><Boton variante="secundario" onClick={onCerrar}>{t('vistaPrevia.volverAEditar')}</Boton>{onCompartir && <Boton onClick={onCompartir} cargando={compartiendo}>{t('vistaPrevia.crearEnlace')}</Boton>}</div>
  </Modal>;
}
