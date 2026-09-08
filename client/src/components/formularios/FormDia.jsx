import { useTranslation } from 'react-i18next';
import { itineraryApi } from '../../api/index.js';
import useFormulario from '../../hooks/useFormulario.js';
import { Boton, Campo, Modal, Aviso } from '../ui.jsx';

/** Título y resumen de un día del itinerario. */
export default function FormDia({ abierto, onCerrar, tripId, dia, onGuardado }) {
  const { t } = useTranslation('formularios');
  const form = useFormulario({
    title: dia.title || '',
    summary: dia.summary || '',
  });

  const guardar = form.enviar(async (v) => {
    await itineraryApi.updateDay(tripId, dia._id, {
      title: v.title.trim(),
      summary: v.summary.trim(),
    });
    onGuardado();
    onCerrar();
  });

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={t('dia.titulo', { numero: dia.dayNumber })} ancho={460}>
      <form onSubmit={guardar} className="pila" noValidate>
        {form.errorServidor && <Aviso tipo="error">{form.errorServidor.mensaje}</Aviso>}

        <Campo
          label={t('dia.tituloDelDia')}
          placeholder={t('dia.tituloPlaceholder')}
          autoFocus
          {...form.props('title')}
        />

        <Campo label={t('dia.resumen')}>
          <textarea
            placeholder={t('dia.resumenPlaceholder')}
            maxLength={600}
            {...form.props('summary')}
          />
        </Campo>

        <div className="modal-acciones">
          <Boton variante="secundario" type="button" onClick={onCerrar}>
            {t('comun.cancelar')}
          </Boton>
          <Boton type="submit" cargando={form.enviando}>
            {t('comun.guardar')}
          </Boton>
        </div>
      </form>
    </Modal>
  );
}
