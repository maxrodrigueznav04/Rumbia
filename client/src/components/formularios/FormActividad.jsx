import { useTranslation } from 'react-i18next';
import { itineraryApi } from '../../api/index.js';
import useFormulario from '../../hooks/useFormulario.js';
import { reglas } from '../../utils/validacion.js';
import { Boton, Campo, Modal, Aviso } from '../ui.jsx';
import { ICONOS_CATEGORIA } from '../../utils/format.js';

const CATEGORIAS = [
  'comida',
  'cultura',
  'naturaleza',
  'aventura',
  'compras',
  'vida-nocturna',
  'descanso',
  'traslado',
  'otro',
];

const horaValida = (v) => {
  if (!v) return null; // la hora es opcional
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? null : 'Usa formato de 24 horas, ej. 14:30.';
};

/** Alta y edición de una actividad dentro de un día del itinerario. */
export default function FormActividad({ abierto, onCerrar, tripId, dia, actividad, onGuardado }) {
  const { t } = useTranslation(['formularios', 'dominio']);
  const editando = Boolean(actividad);

  const form = useFormulario(
    {
      time: actividad?.time || '',
      title: actividad?.title || '',
      description: actividad?.description || '',
      category: actividad?.category || 'otro',
      lugar: actividad?.location?.name || '',
      estimatedCost: actividad?.estimatedCost ?? '',
      durationMinutes: actividad?.durationMinutes ?? 60,
      bookingUrl: actividad?.bookingUrl || '',
    },
    {
      title: reglas.requerido('El título'),
      time: horaValida,
      estimatedCost: reglas.numeroPositivo,
      bookingUrl: reglas.urlOpcional,
    }
  );

  const guardar = form.enviar(async (v) => {
    const payload = {
      time: v.time,
      title: v.title.trim(),
      description: v.description.trim(),
      category: v.category,
      location: { name: v.lugar.trim() },
      estimatedCost: Number(v.estimatedCost) || 0,
      // Number(v.durationMinutes) || 60 forzaba 60 cuando el usuario escribia
      // 0 a proposito (0 || 60 da 60 en JS): Number.isFinite distingue "puso
      // 0" de "no puso nada" o "puso algo invalido".
      durationMinutes: Number.isFinite(Number(v.durationMinutes)) && v.durationMinutes !== ''
        ? Number(v.durationMinutes)
        : 60,
      bookingUrl: v.bookingUrl.trim(),
    };

    if (editando) {
      await itineraryApi.updateActivity(tripId, dia._id, actividad._id, payload);
    } else {
      await itineraryApi.addActivity(tripId, dia._id, payload);
    }

    onGuardado();
    onCerrar();
  });

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={editando ? t('formularios:actividad.editar') : t('formularios:actividad.nueva', { numero: dia.dayNumber })}
    >
      <form onSubmit={guardar} className="pila" noValidate>
        {form.errorServidor && <Aviso tipo="error">{form.errorServidor.mensaje}</Aviso>}

        <Campo
          label={t('formularios:actividad.queVanAHacer')}
          placeholder={t('formularios:actividad.queVanAHacerPlaceholder')}
          autoFocus
          {...form.props('title')}
        />

        <div className="campos-2">
          <Campo label={t('formularios:actividad.hora')} type="time" ayuda={t('formularios:comun.opcional')} {...form.props('time')} />
          <Campo label={t('formularios:actividad.categoria')}>
            <select {...form.props('category')}>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {ICONOS_CATEGORIA[c]} {t(`dominio:${c}`)}
                </option>
              ))}
            </select>
          </Campo>
        </div>

        <Campo label={t('formularios:actividad.detalles')}>
          <textarea
            placeholder={t('formularios:actividad.detallesPlaceholder')}
            {...form.props('description')}
          />
        </Campo>

        <Campo
          label={t('formularios:actividad.lugar')}
          placeholder={t('formularios:actividad.lugarPlaceholder')}
          ayuda={t('formularios:actividad.lugarAyuda')}
          {...form.props('lugar')}
        />

        <div className="campos-2">
          <Campo
            label={t('formularios:actividad.costoPorPersona')}
            type="number"
            min="0"
            step="1"
            placeholder="0"
            {...form.props('estimatedCost')}
          />
          <Campo
            label={t('formularios:actividad.duracion')}
            type="number"
            min="0"
            max="1440"
            step="15"
            {...form.props('durationMinutes')}
          />
        </div>

        <Campo
          label={t('formularios:actividad.linkParaReservar')}
          type="url"
          placeholder="https://..."
          ayuda={t('formularios:actividad.linkAyuda')}
          {...form.props('bookingUrl')}
        />

        <div className="modal-acciones">
          <Boton variante="secundario" type="button" onClick={onCerrar}>
            {t('formularios:comun.cancelar')}
          </Boton>
          <Boton type="submit" cargando={form.enviando}>
            {editando ? t('formularios:actividad.guardarCambios') : t('formularios:actividad.agregar')}
          </Boton>
        </div>
      </form>
    </Modal>
  );
}
