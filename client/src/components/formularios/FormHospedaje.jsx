import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { tripsApi } from '../../api/index.js';
import useFormulario from '../../hooks/useFormulario.js';
import { reglas } from '../../utils/validacion.js';
import { Boton, Campo, Modal, Aviso } from '../ui.jsx';
import {
  paraInputFecha,
  desdeInputFecha,
  nochesEntre,
  formatoMoneda,
} from '../../utils/format.js';

const EMOJI_TIPO = {
  hotel: '🏨',
  airbnb: '🏠',
  hostal: '🛏️',
  cabana: '🌲',
  'casa-amigos': '👋',
  camping: '⛺',
  otro: '📍',
};
const TIPOS = Object.keys(EMOJI_TIPO);

/**
 * Alta y edición de un hospedaje. El backend reemplaza el arreglo completo,
 * así que aquí se reconstruye con el elemento nuevo o editado.
 */
export default function FormHospedaje({ abierto, onCerrar, viaje, indice, onGuardado }) {
  const { t } = useTranslation(['formularios', 'dominio']);
  const editando = indice != null;
  const datos = editando ? viaje.lodging[indice] : {};
  const moneda = viaje.budget?.currency || 'MXN';
  // Viajes de un solo destino no ven ningun campo nuevo: el selector solo
  // aparece cuando de verdad hay entre que ciudad elegir.
  const paradas = viaje.additionalDestinations || [];

  const form = useFormulario(
    {
      type: datos.type || 'hotel',
      name: datos.name || '',
      lugar: datos.place?.name || '',
      // 0 = destino principal, 1..N = indice en paradas. Mismo indice
      // informativo que Itinerary.days, nunca validado contra el largo de
      // paradas (ver Trip.js): un dato huerfano simplemente cae de vuelta a 0.
      destinationIndex: datos.destinationIndex ?? 0,
      checkIn: paraInputFecha(datos.checkIn || viaje.startDate),
      checkOut: paraInputFecha(datos.checkOut || viaje.endDate),
      // Al abrir un hospedaje guardado antes del cambio no hay totalCost: se
      // reconstruye desde la tarifa por noche para no mostrar el campo vacío.
      totalCost: datos.totalCost ?? (datos.nightlyRate ? datos.nightlyRate * (datos.nights || 0) : ''),
      nights: datos.nights ?? nochesEntre(viaje.startDate, viaje.endDate),
      bookingRef: datos.bookingRef || '',
      isEstimate: datos.isEstimate ?? true,
      notes: datos.notes || '',
    },
    { totalCost: reglas.numeroPositivo, nights: reglas.numeroPositivo }
  );

  const { valores, fijar } = form;

  // Al elegir la ciudad, sugiere (no obliga) las fechas de esa parada: pasa
  // por los mismos setters que ya recalculan noches, asi que el usuario
  // sigue pudiendo ajustarlas despues.
  const cambiarCiudad = (e) => {
    form.cambiar(e);
    const idx = Number(e.target.value) || 0;
    const parada = idx > 0 ? paradas[idx - 1] : null;
    if (parada?.startDate) fijar('checkIn', paraInputFecha(parada.startDate));
    if (parada?.endDate) fijar('checkOut', paraInputFecha(parada.endDate));
  };

  // Las noches se recalculan solas al mover las fechas: nadie quiere hacer esa resta.
  useEffect(() => {
    const calculadas = nochesEntre(valores.checkIn, valores.checkOut);
    if (calculadas > 0 && String(calculadas) !== String(valores.nights)) {
      fijar('nights', calculadas);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valores.checkIn, valores.checkOut]);

  const subtotal = Number(valores.totalCost) || 0;
  const noches = Number(valores.nights) || 0;
  const porNoche = noches > 0 ? subtotal / noches : 0;

  const guardar = form.enviar(async (v) => {
    const item = {
      type: v.type,
      name: v.name.trim(),
      place: v.lugar.trim() ? { name: v.lugar.trim() } : undefined,
      destinationIndex: Number(v.destinationIndex) || 0,
      checkIn: desdeInputFecha(v.checkIn),
      checkOut: desdeInputFecha(v.checkOut),
      totalCost: Number(v.totalCost) || 0,
      nights: Number(v.nights) || 0,
      bookingRef: v.bookingRef.trim(),
      isEstimate: v.isEstimate,
      notes: v.notes.trim(),
    };

    // Guardar manda la lista completa, así que hay que reenviar los demás
    // hospedajes intactos. Enumerar los campos a mano hacía que cualquiera que
    // el formulario no tocara (externalUrl, y ahora totalCost) se perdiera al
    // editar otro elemento: se conserva todo y solo se quitan los calculados.
    const lista = (viaje.lodging || []).map((l) => {
      // resto ya trae totalCost tal cual lo mando la API: recalcularlo aqui
      // con "||" pisaba un totalCost:0 legitimo (hospedaje regalado) con la
      // tarifa x noches vieja de un registro anterior al cambio, cada vez que
      // se editaba OTRO hospedaje del mismo viaje.
      const { _id, id: _ignorado, subtotal, perNight, ...resto } = l;
      return resto;
    });

    if (editando) lista[indice] = item;
    else lista.push(item);

    await tripsApi.update(viaje._id, { lodging: lista });
    onGuardado();
    onCerrar();
  });

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={editando ? t('formularios:hospedaje.editar') : t('formularios:hospedaje.agregar')}
    >
      <form onSubmit={guardar} className="pila" noValidate>
        {form.errorServidor && <Aviso tipo="error">{form.errorServidor.mensaje}</Aviso>}

        <Campo label={t('formularios:hospedaje.tipo')}>
          <select {...form.props('type')}>
            {TIPOS.map((valor) => (
              <option key={valor} value={valor}>
                {EMOJI_TIPO[valor]} {t(`dominio:${valor}`)}
              </option>
            ))}
          </select>
        </Campo>

        <Campo label={t('formularios:hospedaje.nombreDelLugar')} placeholder={t('formularios:hospedaje.nombreDelLugarPlaceholder')} {...form.props('name')} />

        <Campo
          label={t('formularios:hospedaje.zonaODireccion')}
          placeholder={t('formularios:hospedaje.zonaODireccionPlaceholder')}
          ayuda={t('formularios:hospedaje.zonaODireccionAyuda')}
          {...form.props('lugar')}
        />

        {paradas.length > 0 && (
          <Campo label={t('formularios:hospedaje.paraQueCiudad')}>
            <select name="destinationIndex" value={valores.destinationIndex} onChange={cambiarCiudad}>
              <option value={0}>{viaje.destination?.name || t('formularios:hospedaje.destinoPrincipal')}</option>
              {paradas.map((p, i) => (
                <option key={i} value={i + 1}>
                  {p.place?.name || t('formularios:hospedaje.parada', { numero: i + 1 })}
                </option>
              ))}
            </select>
          </Campo>
        )}

        <div className="campos-2">
          <Campo
            label={t('formularios:hospedaje.llegada')}
            type="date"
            onClick={(e) => e.currentTarget.showPicker?.()}
            {...form.props('checkIn')}
          />
          <Campo
            label={t('formularios:hospedaje.salida')}
            type="date"
            min={valores.checkIn || undefined}
            onClick={(e) => e.currentTarget.showPicker?.()}
            {...form.props('checkOut')}
          />
        </div>

        <div className="campos-2">
          <Campo
            label={t('formularios:hospedaje.costoTotal')}
            type="number"
            min="0"
            step="1"
            placeholder="0"
            ayuda={t('formularios:hospedaje.costoTotalAyuda', { moneda })}
            {...form.props('totalCost')}
          />
          <Campo
            label={t('formularios:hospedaje.noches')}
            type="number"
            min="0"
            step="1"
            ayuda={t('formularios:hospedaje.nochesAyuda')}
            {...form.props('nights')}
          />
        </div>

        {subtotal > 0 && (
          <div className="tarjeta-plana fila-entre">
            <span className="etiqueta">
              {porNoche > 0 ? t('formularios:hospedaje.porNoche', { monto: formatoMoneda(porNoche, moneda) }) : t('formularios:hospedaje.total')}
            </span>
            <span className="numero">{formatoMoneda(subtotal, moneda)}</span>
          </div>
        )}

        <Campo
          label={t('formularios:hospedaje.claveReservacion')}
          placeholder={t('formularios:hospedaje.claveReservacionPlaceholder')}
          {...form.props('bookingRef')}
        />

        <Campo label={t('formularios:comun.notas')}>
          <textarea placeholder={t('formularios:hospedaje.notasPlaceholder')} {...form.props('notes')} />
        </Campo>

        <label className="campo-check">
          <input
            type="checkbox"
            name="isEstimate"
            checked={form.valores.isEstimate}
            onChange={form.cambiar}
          />
          {t('formularios:comun.esEstimado')}
        </label>

        <div className="modal-acciones">
          <Boton variante="secundario" type="button" onClick={onCerrar}>
            {t('formularios:comun.cancelar')}
          </Boton>
          <Boton type="submit" cargando={form.enviando}>
            {t('formularios:comun.guardar')}
          </Boton>
        </div>
      </form>
    </Modal>
  );
}
