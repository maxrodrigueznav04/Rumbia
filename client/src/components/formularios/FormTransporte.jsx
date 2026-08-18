import { tripsApi } from '../../api/index.js';
import useFormulario from '../../hooks/useFormulario.js';
import { reglas } from '../../utils/validacion.js';
import { Boton, Campo, Modal, Aviso } from '../ui.jsx';
import { paraInputFechaHora, desdeInputFecha } from '../../utils/format.js';

const MODOS = [
  { valor: 'avion', texto: '✈️ Avión' },
  { valor: 'autobus', texto: '🚌 Autobús' },
  { valor: 'tren', texto: '🚆 Tren' },
  { valor: 'auto-propio', texto: '🚗 Auto propio' },
  { valor: 'otro', texto: '🧭 Otro' },
];

/**
 * Captura un tramo (ida o vuelta). No reserva nada: guarda lo que el usuario
 * ya reservó por fuera, o su estimación mientras decide.
 */
export default function FormTransporte({ abierto, onCerrar, viaje, tramo, onGuardado }) {
  const datos = viaje.transport?.[tramo] || {};
  const esIda = tramo === 'outbound';

  const form = useFormulario(
    {
      mode: datos.mode || 'avion',
      provider: datos.provider || '',
      departureAt: paraInputFechaHora(datos.departureAt),
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
      titulo={esIda ? 'Transporte de ida' : 'Transporte de vuelta'}
    >
      <form onSubmit={guardar} className="pila" noValidate>
        {form.errorServidor && <Aviso tipo="error">{form.errorServidor.mensaje}</Aviso>}

        <Campo label="¿Cómo te vas?">
          <select {...form.props('mode')}>
            {MODOS.map((m) => (
              <option key={m.valor} value={m.valor}>
                {m.texto}
              </option>
            ))}
          </select>
        </Campo>

        {!esAutoPropio && (
          <Campo
            label="Aerolínea o línea"
            placeholder="Viva Aerobus, ETN, Primera Plus..."
            {...form.props('provider')}
          />
        )}

        <div className="campos-2">
          <Campo
            label={esIda ? 'Salida' : 'Regreso'}
            type="datetime-local"
            {...form.props('departureAt')}
          />
          <Campo
            label={`Costo ${esAutoPropio ? '(gasolina y casetas)' : ''}`}
            type="number"
            min="0"
            step="1"
            placeholder="0"
            ayuda={`En ${viaje.budget?.currency || 'MXN'}, total del tramo.`}
            {...form.props('cost')}
          />
        </div>

        {!esAutoPropio && (
          <Campo
            label="Clave de reservación"
            placeholder="La que te dio la aerolínea"
            ayuda="Opcional. Para tenerla a la mano el día del viaje."
            {...form.props('bookingRef')}
          />
        )}

        <Campo label="Notas">
          <textarea placeholder="Terminal, equipaje incluido, escalas..." {...form.props('notes')} />
        </Campo>

        <label className="campo-check">
          <input
            type="checkbox"
            name="isEstimate"
            checked={form.valores.isEstimate}
            onChange={form.cambiar}
          />
          Es un estimado, todavía no lo reservo
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
