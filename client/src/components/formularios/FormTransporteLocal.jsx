import { tripsApi } from '../../api/index.js';
import useFormulario from '../../hooks/useFormulario.js';
import { reglas } from '../../utils/validacion.js';
import { Boton, Campo, Modal, Aviso } from '../ui.jsx';

const TIPOS = [
  { valor: 'transporte-publico', texto: '🚇 Transporte público' },
  { valor: 'app-transporte', texto: '📱 Uber / DiDi' },
  { valor: 'renta-auto', texto: '🚗 Renta de auto' },
  { valor: 'taxi', texto: '🚕 Taxi' },
  { valor: 'bicicleta', texto: '🚲 Bicicleta' },
  { valor: 'a-pie', texto: '🚶 A pie' },
];

/** Cómo te mueves ya estando en el destino. */
export default function FormTransporteLocal({ abierto, onCerrar, viaje, indice, onGuardado }) {
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
      titulo={editando ? 'Editar transporte local' : 'Agregar transporte local'}
      ancho={460}
    >
      <form onSubmit={guardar} className="pila" noValidate>
        {form.errorServidor && <Aviso tipo="error">{form.errorServidor.mensaje}</Aviso>}

        <Campo label="¿Cómo te vas a mover?">
          <select {...form.props('type')}>
            {TIPOS.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.texto}
              </option>
            ))}
          </select>
        </Campo>

        <Campo
          label="Proveedor"
          placeholder="DiDi, Hertz, Metro..."
          ayuda="Opcional."
          {...form.props('provider')}
        />

        <Campo
          label="Costo estimado para todo el viaje"
          type="number"
          min="0"
          step="1"
          placeholder="0"
          ayuda={`En ${viaje.budget?.currency || 'MXN'}.`}
          {...form.props('estimatedCost')}
        />

        <Campo label="Notas">
          <textarea placeholder="Solo para el día de la excursión..." {...form.props('notes')} />
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
