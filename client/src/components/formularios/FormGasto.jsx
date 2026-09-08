import { useTranslation } from 'react-i18next';
import { expensesApi } from '../../api/index.js';
import useFormulario from '../../hooks/useFormulario.js';
import { reglas } from '../../utils/validacion.js';
import { Boton, Campo, Modal, Aviso } from '../ui.jsx';
import { paraInputFecha, desdeInputFecha } from '../../utils/format.js';

const EMOJI_CATEGORIA = {
  comida: '🍽️',
  actividades: '🎟️',
  compras: '🛍️',
  transporte: '✈️',
  hospedaje: '🏨',
  'transporte-local': '🚕',
  otros: '📌',
};
const CATEGORIAS = Object.keys(EMOJI_CATEGORIA);

/** Gasto suelto: entradas, comidas, souvenirs, propinas. */
export default function FormGasto({ abierto, onCerrar, viaje, gasto, onGuardado }) {
  const { t } = useTranslation(['formularios', 'dominio']);
  const editando = Boolean(gasto);

  const form = useFormulario(
    {
      category: gasto?.category || 'comida',
      description: gasto?.description || '',
      amount: gasto?.amount ?? '',
      date: paraInputFecha(gasto?.date || viaje.startDate),
      isPaid: gasto?.isPaid ?? false,
      notes: gasto?.notes || '',
    },
    {
      description: reglas.requerido('La descripción'),
      amount: (v) => (v === '' || v == null ? 'Escribe el monto.' : reglas.numeroPositivo(v)),
    }
  );

  const guardar = form.enviar(async (v) => {
    const payload = {
      category: v.category,
      description: v.description.trim(),
      amount: Number(v.amount),
      date: desdeInputFecha(v.date),
      isPaid: v.isPaid,
      notes: v.notes.trim(),
    };

    if (editando) await expensesApi.update(gasto._id, payload);
    else await expensesApi.create({ ...payload, trip: viaje._id });

    onGuardado();
    onCerrar();
  });

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={editando ? t('formularios:gasto.editar') : t('formularios:gasto.agregar')}
      ancho={460}
    >
      <form onSubmit={guardar} className="pila" noValidate>
        {form.errorServidor && <Aviso tipo="error">{form.errorServidor.mensaje}</Aviso>}

        <Campo label={t('formularios:gasto.categoria')}>
          <select {...form.props('category')}>
            {CATEGORIAS.map((valor) => (
              <option key={valor} value={valor}>
                {EMOJI_CATEGORIA[valor]} {t(`dominio:${valor}`)}
              </option>
            ))}
          </select>
        </Campo>

        <Campo
          label={t('formularios:gasto.enQueFue')}
          placeholder={t('formularios:gasto.enQueFuePlaceholder')}
          autoFocus
          {...form.props('description')}
        />

        <div className="campos-2">
          <Campo
            label={t('formularios:gasto.monto')}
            type="number"
            min="0"
            step="1"
            placeholder="0"
            ayuda={t('formularios:gasto.montoAyuda', { moneda: viaje.budget?.currency || 'MXN' })}
            {...form.props('amount')}
          />
          <Campo label={t('formularios:gasto.fecha')} type="date" {...form.props('date')} />
        </div>

        <Campo label={t('formularios:comun.notas')}>
          <textarea placeholder={t('formularios:comun.opcional')} {...form.props('notes')} />
        </Campo>

        <label className="campo-check">
          <input type="checkbox" name="isPaid" checked={form.valores.isPaid} onChange={form.cambiar} />
          {t('formularios:gasto.yaLoPague')}
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
