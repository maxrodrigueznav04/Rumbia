import { tripsApi, weatherApi } from '../../api/index.js';
import useFormulario from '../../hooks/useFormulario.js';
import { reglas } from '../../utils/validacion.js';
import { Boton, Campo, Modal, Aviso } from '../ui.jsx';
import CampoFechas from '../CampoFechas.jsx';
import { paraInputFecha, desdeInputFecha } from '../../utils/format.js';

const ESTADOS = [
  { valor: 'borrador', texto: 'Borrador' },
  { valor: 'planeado', texto: 'Planeado' },
  { valor: 'en-curso', texto: 'En curso' },
  { valor: 'completado', texto: 'Completado' },
];

const diasEntre = (a, b) => {
  if (!a || !b) return 0;
  const ms = new Date(b) - new Date(a);
  return Number.isNaN(ms) ? 0 : Math.max(1, Math.round(ms / 86400000) + 1);
};

/** Edición del viaje: título, destino, fechas, viajeros, presupuesto y estado. */
export default function FormViaje({ abierto, onCerrar, viaje, onGuardado }) {
  const form = useFormulario(
    {
      title: viaje.title || '',
      destino: viaje.destination?.name || '',
      origen: viaje.origin?.name || '',
      startDate: paraInputFecha(viaje.startDate),
      endDate: paraInputFecha(viaje.endDate),
      travelers: viaje.travelers ?? 1,
      presupuesto: viaje.budget?.amount || '',
      status: viaje.status || 'borrador',
      notes: viaje.notes || '',
    },
    {
      title: reglas.requerido('El título'),
      destino: reglas.requerido('El destino'),
      presupuesto: reglas.numeroPositivo,
      endDate: (v, todos) =>
        v && todos.startDate && new Date(v) < new Date(todos.startDate)
          ? 'El regreso no puede ser antes de la salida.'
          : null,
    }
  );

  const { valores } = form;
  const diasNuevos = diasEntre(valores.startDate, valores.endDate);
  const cambioFechas =
    valores.startDate !== paraInputFecha(viaje.startDate) ||
    valores.endDate !== paraInputFecha(viaje.endDate);
  const diasItinerario = viaje.itinerary?.days?.length || 0;
  const seAcorta = diasItinerario > 0 && diasNuevos < diasItinerario;
  const destinoCambio = valores.destino.trim() !== (viaje.destination?.name || '');

  const guardar = form.enviar(async (v) => {
    const payload = {
      title: v.title.trim(),
      startDate: desdeInputFecha(v.startDate),
      endDate: desdeInputFecha(v.endDate),
      travelers: Number(v.travelers) || 1,
      budget: { amount: Number(v.presupuesto) || 0 },
      status: v.status,
      notes: v.notes.trim(),
    };

    // Si cambió el destino hay que volver a geocodificar: si no, el mapa y el
    // clima seguirían apuntando a la ciudad anterior.
    if (destinoCambio) {
      let coords = {};
      try {
        const geo = await weatherApi.geocode(v.destino.trim());
        coords = { lat: geo.place.lat, lng: geo.place.lng, country: geo.place.country };
      } catch {
        coords = {};
      }
      payload.destination = { name: v.destino.trim(), ...coords };
    }

    if (v.origen.trim() !== (viaje.origin?.name || '')) {
      payload.origin = { name: v.origen.trim() };
    }

    const res = await tripsApi.update(viaje._id, payload);
    onGuardado(res.itinerario);
    onCerrar();
  });

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Editar viaje">
      <form onSubmit={guardar} className="pila" noValidate>
        {form.errorServidor && <Aviso tipo="error">{form.errorServidor.mensaje}</Aviso>}

        <Campo label="Nombre del viaje" {...form.props('title')} />

        <Campo
          label="Destino"
          ayuda={destinoCambio ? 'Se volverá a ubicar en el mapa al guardar.' : undefined}
          {...form.props('destino')}
        />

        <Campo label="Origen" placeholder="Monterrey" {...form.props('origen')} />

        <CampoFechas
          inicio={valores.startDate}
          fin={valores.endDate}
          minimo={undefined}
          onCambio={({ inicio, fin }) => {
            form.fijar('startDate', inicio);
            form.fijar('endDate', fin);
          }}
          errorInicio={form.errores.startDate}
          errorFin={form.errores.endDate}
        />

        {cambioFechas && diasNuevos > 0 && (
          <Aviso tipo={seAcorta ? 'alerta' : 'info'}>
            {seAcorta ? (
              <>
                El viaje pasa a <strong>{diasNuevos} días</strong> pero el itinerario tiene{' '}
                {diasItinerario}. No vamos a borrar nada: los días de más se quedan y los puedes
                quitar tú desde el itinerario.
              </>
            ) : diasItinerario > 0 && diasNuevos > diasItinerario ? (
              <>
                El viaje pasa a <strong>{diasNuevos} días</strong>. Se agregarán{' '}
                {diasNuevos - diasItinerario} día(s) vacío(s) al itinerario.
              </>
            ) : (
              <>
                El viaje queda de <strong>{diasNuevos} días</strong>.
              </>
            )}
          </Aviso>
        )}

        <div className="campos-2">
          <Campo label="Viajeros" type="number" min="1" max="30" {...form.props('travelers')} />
          <Campo
            label="Presupuesto"
            type="number"
            min="0"
            step="100"
            placeholder="0"
            ayuda={`En ${viaje.budget?.currency || 'MXN'}.`}
            {...form.props('presupuesto')}
          />
        </div>

        <Campo label="Estado">
          <select {...form.props('status')}>
            {ESTADOS.map((e) => (
              <option key={e.valor} value={e.valor}>
                {e.texto}
              </option>
            ))}
          </select>
        </Campo>

        <Campo label="Notas">
          <textarea placeholder="Cosas que no quieres olvidar..." {...form.props('notes')} />
        </Campo>

        <div className="fila" style={{ justifyContent: 'flex-end' }}>
          <Boton variante="secundario" type="button" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={form.enviando}>
            Guardar cambios
          </Boton>
        </div>
      </form>
    </Modal>
  );
}
