import { useEffect } from 'react';
import { tripsApi } from '../../api/index.js';
import useFormulario from '../../hooks/useFormulario.js';
import { reglas } from '../../utils/validacion.js';
import { Boton, Campo, Modal, Aviso } from '../ui.jsx';
import {
  paraInputFecha,
  desdeInputFecha,
  nochesEntre,
  formatoMoneda,
} from '../../utils/format.js';

const TIPOS = [
  { valor: 'hotel', texto: '🏨 Hotel' },
  { valor: 'airbnb', texto: '🏠 Airbnb' },
  { valor: 'hostal', texto: '🛏️ Hostal' },
  { valor: 'cabana', texto: '🌲 Cabaña' },
  { valor: 'casa-amigos', texto: '👋 Casa de amigos' },
  { valor: 'camping', texto: '⛺ Camping' },
  { valor: 'otro', texto: '📍 Otro' },
];

/**
 * Alta y edición de un hospedaje. El backend reemplaza el arreglo completo,
 * así que aquí se reconstruye con el elemento nuevo o editado.
 */
export default function FormHospedaje({ abierto, onCerrar, viaje, indice, onGuardado }) {
  const editando = indice != null;
  const datos = editando ? viaje.lodging[indice] : {};
  const moneda = viaje.budget?.currency || 'MXN';

  const form = useFormulario(
    {
      type: datos.type || 'hotel',
      name: datos.name || '',
      lugar: datos.place?.name || '',
      checkIn: paraInputFecha(datos.checkIn || viaje.startDate),
      checkOut: paraInputFecha(datos.checkOut || viaje.endDate),
      nightlyRate: datos.nightlyRate ?? '',
      nights: datos.nights ?? nochesEntre(viaje.startDate, viaje.endDate),
      bookingRef: datos.bookingRef || '',
      isEstimate: datos.isEstimate ?? true,
      notes: datos.notes || '',
    },
    { nightlyRate: reglas.numeroPositivo, nights: reglas.numeroPositivo }
  );

  const { valores, fijar } = form;

  // Las noches se recalculan solas al mover las fechas: nadie quiere hacer esa resta.
  useEffect(() => {
    const calculadas = nochesEntre(valores.checkIn, valores.checkOut);
    if (calculadas > 0 && String(calculadas) !== String(valores.nights)) {
      fijar('nights', calculadas);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valores.checkIn, valores.checkOut]);

  const subtotal = (Number(valores.nightlyRate) || 0) * (Number(valores.nights) || 0);

  const guardar = form.enviar(async (v) => {
    const item = {
      type: v.type,
      name: v.name.trim(),
      place: v.lugar.trim() ? { name: v.lugar.trim() } : undefined,
      checkIn: desdeInputFecha(v.checkIn),
      checkOut: desdeInputFecha(v.checkOut),
      nightlyRate: Number(v.nightlyRate) || 0,
      nights: Number(v.nights) || 0,
      bookingRef: v.bookingRef.trim(),
      isEstimate: v.isEstimate,
      notes: v.notes.trim(),
    };

    const lista = (viaje.lodging || []).map((l) => ({
      type: l.type,
      name: l.name,
      place: l.place?.name ? { name: l.place.name } : undefined,
      checkIn: l.checkIn,
      checkOut: l.checkOut,
      nightlyRate: l.nightlyRate,
      nights: l.nights,
      bookingRef: l.bookingRef,
      isEstimate: l.isEstimate,
      notes: l.notes,
    }));

    if (editando) lista[indice] = item;
    else lista.push(item);

    await tripsApi.update(viaje._id, { lodging: lista });
    onGuardado();
    onCerrar();
  });

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={editando ? 'Editar hospedaje' : 'Agregar hospedaje'}
    >
      <form onSubmit={guardar} className="pila" noValidate>
        {form.errorServidor && <Aviso tipo="error">{form.errorServidor.mensaje}</Aviso>}

        <Campo label="Tipo">
          <select {...form.props('type')}>
            {TIPOS.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.texto}
              </option>
            ))}
          </select>
        </Campo>

        <Campo label="Nombre del lugar" placeholder="Hotel Casa Antigua" {...form.props('name')} />

        <Campo
          label="Zona o dirección"
          placeholder="Centro histórico"
          ayuda="Opcional, para ubicarlo."
          {...form.props('lugar')}
        />

        <div className="campos-2">
          <Campo label="Llegada" type="date" {...form.props('checkIn')} />
          <Campo label="Salida" type="date" {...form.props('checkOut')} />
        </div>

        <div className="campos-2">
          <Campo
            label="Costo por noche"
            type="number"
            min="0"
            step="1"
            placeholder="0"
            {...form.props('nightlyRate')}
          />
          <Campo
            label="Noches"
            type="number"
            min="0"
            step="1"
            ayuda="Se calcula solo con las fechas."
            {...form.props('nights')}
          />
        </div>

        {subtotal > 0 && (
          <div className="tarjeta-plana fila-entre">
            <span className="etiqueta">Subtotal</span>
            <span className="numero">{formatoMoneda(subtotal, moneda)}</span>
          </div>
        )}

        <Campo
          label="Clave de reservación"
          placeholder="Opcional"
          {...form.props('bookingRef')}
        />

        <Campo label="Notas">
          <textarea placeholder="Desayuno incluido, hora de check-in..." {...form.props('notes')} />
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
