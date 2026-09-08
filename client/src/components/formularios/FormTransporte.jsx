import { useTranslation } from 'react-i18next';
import { tripsApi } from '../../api/index.js';
import useFormulario from '../../hooks/useFormulario.js';
import { reglas } from '../../utils/validacion.js';
import { Boton, Campo, Modal, Aviso } from '../ui.jsx';
import { paraInputFechaHora, desdeInputFecha } from '../../utils/format.js';

const EMOJI_MODO = {
  avion: '✈️',
  autobus: '🚌',
  tren: '🚆',
  'auto-propio': '🚗',
  otro: '🧭',
};
const MODOS = Object.keys(EMOJI_MODO);

/**
 * Captura un tramo (ida o vuelta). No reserva nada: guarda lo que el usuario
 * ya reservó por fuera, o su estimación mientras decide.
 */
export default function FormTransporte({ abierto, onCerrar, viaje, tramo, onGuardado }) {
  const { t } = useTranslation(['formularios', 'dominio']);
  const datos = viaje.transport?.[tramo] || {};
  const esIda = tramo === 'outbound';

  const form = useFormulario(
    {
      mode: datos.mode || 'avion',
      provider: datos.provider || '',
      // Sin fecha capturada, el calendario abre en la fecha del viaje, no en
      // "hoy": si el viaje es del 25 de enero, ahi es donde tiene sentido que
      // el vuelo empiece a buscarse, no en el mes en el que estas editando.
      departureAt: paraInputFechaHora(datos.departureAt || (esIda ? viaje.startDate : viaje.endDate)),
      cost: datos.cost ?? '',
      bookingRef: datos.bookingRef || '',
      isEstimate: datos.isEstimate ?? true,
      notes: datos.notes || '',
    },
    { cost: reglas.numeroPositivo }
  );

  const guardar = form.enviar(async (v) => {
    await tripsApi.update(viaje._id, {
      transport: {
        [tramo]: {
          mode: v.mode,
          provider: v.provider.trim(),
          departureAt: desdeInputFecha(v.departureAt),
          cost: Number(v.cost) || 0,
          bookingRef: v.bookingRef.trim(),
          isEstimate: v.isEstimate,
          notes: v.notes.trim(),
        },
      },
    });
    onGuardado();
    onCerrar();
  });

  const esAutoPropio = form.valores.mode === 'auto-propio';

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={esIda ? t('formularios:transporte.editarIda') : t('formularios:transporte.editarVuelta')}
    >
      <form onSubmit={guardar} className="pila" noValidate>
        {form.errorServidor && <Aviso tipo="error">{form.errorServidor.mensaje}</Aviso>}

        <Campo label={t('formularios:transporte.comoTeVas')}>
          <select {...form.props('mode')}>
            {MODOS.map((valor) => (
              <option key={valor} value={valor}>
                {EMOJI_MODO[valor]} {t(`dominio:${valor}`)}
              </option>
            ))}
          </select>
        </Campo>

        {!esAutoPropio && (
          <Campo
            label={t('formularios:transporte.aerolinea')}
            placeholder={t('formularios:transporte.aerolineaPlaceholder')}
            {...form.props('provider')}
          />
        )}

        <div className="campos-2">
          <Campo
            label={esIda ? t('formularios:transporte.salida') : t('formularios:transporte.regreso')}
            type="datetime-local"
            onClick={(e) => e.currentTarget.showPicker?.()}
            {...form.props('departureAt')}
          />
          <Campo
            label={`${t('formularios:transporte.costo')} ${esAutoPropio ? t('formularios:transporte.costoGasolina') : ''}`}
            type="number"
            min="0"
            step="1"
            placeholder="0"
            ayuda={t('formularios:transporte.costoAyuda', { moneda: viaje.budget?.currency || 'MXN' })}
            {...form.props('cost')}
          />
        </div>

        {!esAutoPropio && (
          <Campo
            label={t('formularios:transporte.claveReservacion')}
            placeholder={t('formularios:transporte.claveReservacionPlaceholder')}
            ayuda={t('formularios:transporte.claveReservacionAyuda')}
            {...form.props('bookingRef')}
          />
        )}

        <Campo label={t('formularios:comun.notas')}>
          <textarea placeholder={t('formularios:transporte.notasPlaceholder')} {...form.props('notes')} />
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
