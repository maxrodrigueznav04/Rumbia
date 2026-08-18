import { expensesApi } from '../../api/index.js';
import useFormulario from '../../hooks/useFormulario.js';
import { reglas } from '../../utils/validacion.js';
import { Boton, Campo, Modal, Aviso } from '../ui.jsx';
import { paraInputFecha, desdeInputFecha } from '../../utils/format.js';

const CATEGORIAS = [
  { valor: 'comida', texto: '🍽️ Comida' },
  { valor: 'actividades', texto: '🎟️ Actividades' },
  { valor: 'compras', texto: '🛍️ Compras' },
  { valor: 'transporte', texto: '✈️ Transporte' },
  { valor: 'hospedaje', texto: '🏨 Hospedaje' },
  { valor: 'transporte-local', texto: '🚕 Transporte local' },
  { valor: 'otros', texto: '📌 Otros' },
];

/** Gasto suelto: entradas, comidas, souvenirs, propinas. */
export default function FormGasto({ abierto, onCerrar, viaje, gasto, onGuardado }) {
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
      titulo={editando ? 'Editar gasto' : 'Agregar gasto'}
      ancho={460}
    >
      <form onSubmit={guardar} className="pila" noValidate>
        {form.errorServidor && <Aviso tipo="error">{form.errorServidor.mensaje}</Aviso>}

        <Campo label="Categoría">
          <select {...form.props('category')}>
            {CATEGORIAS.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.texto}
              </option>
            ))}
          </select>
        </Campo>

        <Campo
          label="¿En qué fue?"
          placeholder="Cena en el mercado"
          autoFocus
          {...form.props('description')}
        />

        <div className="campos-2">
          <Campo
            label="Monto"
            type="number"
            min="0"
            step="1"
            placeholder="0"
            ayuda={`En ${viaje.budget?.currency || 'MXN'}.`}
            {...form.props('amount')}
          />
          <Campo label="Fecha" type="date" {...form.props('date')} />
        </div>

        <Campo label="Notas">
          <textarea placeholder="Opcional" {...form.props('notes')} />
        </Campo>

        <label className="campo-check">
          <input type="checkbox" name="isPaid" checked={form.valores.isPaid} onChange={form.cambiar} />
          Ya lo pagué
        </label>

        <div className="fila" style={{ justifyContent: 'flex-end' }}>
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
