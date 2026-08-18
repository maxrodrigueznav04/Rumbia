import { itineraryApi } from '../../api/index.js';
import useFormulario from '../../hooks/useFormulario.js';
import { Boton, Campo, Modal, Aviso } from '../ui.jsx';

/** Título y resumen de un día del itinerario. */
export default function FormDia({ abierto, onCerrar, tripId, dia, onGuardado }) {
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
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={`Día ${dia.dayNumber}`} ancho={460}>
      <form onSubmit={guardar} className="pila" noValidate>
        {form.errorServidor && <Aviso tipo="error">{form.errorServidor.mensaje}</Aviso>}

        <Campo
          label="Título del día"
          placeholder="Centro histórico y mercados"
          autoFocus
          {...form.props('title')}
        />

        <Campo label="Resumen">
          <textarea
            placeholder="De qué va el día, a grandes rasgos."
            maxLength={600}
            {...form.props('summary')}
          />
        </Campo>

        <div className="modal-acciones">
          <Boton variante="secundario" type="button" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={form.enviando}>
            Guardar
          </Boton>
        </div>
      </form>
    </Modal>
  );
}
