import { useTranslation } from 'react-i18next';
import { tripsApi } from '../../api/index.js';
import useFormulario from '../../hooks/useFormulario.js';
import { reglas } from '../../utils/validacion.js';
import { Boton, Campo, Modal, Aviso } from '../ui.jsx';

const EMOJI_TIPO = {
  'transporte-publico': '🚇',
  'app-transporte': '📱',
  'renta-auto': '🚗',
  taxi: '🚕',
  bicicleta: '🚲',
  'a-pie': '🚶',
};
const TIPOS = Object.keys(EMOJI_TIPO);

/** Cómo te mueves ya estando en el destino. */
export default function FormTransporteLocal({ abierto, onCerrar, viaje, indice, onGuardado }) {
  const { t } = useTranslation(['formularios', 'dominio']);
  const editando = indice != null;
  const datos = editando ? viaje.localTransport[indice] : {};

  const form = useFormulario(
    {
      type: datos.type || 'transporte-publico',
      provider: datos.provider || '',
      estimatedCost: datos.estimatedCost ?? '',
      notes: datos.notes || '',
    },
    { estimatedCost: reglas.numeroPositivo }
  );

  const guardar = form.enviar(async (v) => {
    const item = {
      type: v.type,
      provider: v.provider.trim(),
      estimatedCost: Number(v.estimatedCost) || 0,
      notes: v.notes.trim(),
    };

    // Mismo caso que en hospedaje: se manda la lista completa, así que enumerar
    // campos a mano perdía externalUrl de los elementos que no se editaron.
    const lista = (viaje.localTransport || []).map((t) => {
      const { _id, id: _ignorado, ...resto } = t;
      return resto;
    });

    if (editando) lista[indice] = item;
    else lista.push(item);

    await tripsApi.update(viaje._id, { localTransport: lista });
    onGuardado();
    onCerrar();
  });

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={editando ? t('formularios:transporteLocal.editar') : t('formularios:transporteLocal.agregar')}
      ancho={460}
    >
      <form onSubmit={guardar} className="pila" noValidate>
        {form.errorServidor && <Aviso tipo="error">{form.errorServidor.mensaje}</Aviso>}

        <Campo label={t('formularios:transporteLocal.comoTeVasAMover')}>
          <select {...form.props('type')}>
            {TIPOS.map((valor) => (
              <option key={valor} value={valor}>
                {EMOJI_TIPO[valor]} {t(`dominio:${valor}`)}
              </option>
            ))}
          </select>
        </Campo>

        <Campo
          label={t('formularios:transporteLocal.proveedor')}
          placeholder={t('formularios:transporteLocal.proveedorPlaceholder')}
          ayuda={t('formularios:comun.opcional')}
          {...form.props('provider')}
        />

        <Campo
          label={t('formularios:transporteLocal.costoEstimado')}
          type="number"
          min="0"
          step="1"
          placeholder="0"
          ayuda={t('formularios:transporteLocal.costoAyuda', { moneda: viaje.budget?.currency || 'MXN' })}
          {...form.props('estimatedCost')}
        />

        <Campo label={t('formularios:comun.notas')}>
          <textarea placeholder={t('formularios:transporteLocal.notasPlaceholder')} {...form.props('notes')} />
        </Campo>

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
