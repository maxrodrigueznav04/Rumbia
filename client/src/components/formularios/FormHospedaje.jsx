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
  // Viajes de un solo destino no ven ningun campo nuevo: el selector solo
  // aparece cuando de verdad hay entre que ciudad elegir.
  const paradas = viaje.additionalDestinations || [];

  const form = useFormulario(
    {
      type: datos.type || 'hotel',
      name: datos.name || '',
      lugar: datos.place?.name || '',
      // 0 = destino principal, 1..N = indice en paradas. Mismo indice
      // informativo que Itinerary.days, nunca validado contra el largo de
      // paradas (ver Trip.js): un dato huerfano simplemente cae de vuelta a 0.
      destinationIndex: datos.destinationIndex ?? 0,
      checkIn: paraInputFecha(datos.checkIn || viaje.startDate),
      checkOut: paraInputFecha(datos.checkOut || viaje.endDate),
      // Al abrir un hospedaje guardado antes del cambio no hay totalCost: se
      // reconstruye desde la tarifa por noche para no mostrar el campo vacío.
      totalCost: datos.totalCost ?? (datos.nightlyRate ? datos.nightlyRate * (datos.nights || 0) : ''),
      nights: datos.nights ?? nochesEntre(viaje.startDate, viaje.endDate),
      bookingRef: datos.bookingRef || '',
      isEstimate: datos.isEstimate ?? true,
      notes: datos.notes || '',
    },
    { totalCost: reglas.numeroPositivo, nights: reglas.numeroPositivo }
  );

  const { valores, fijar } = form;

  // Al elegir la ciudad, sugiere (no obliga) las fechas de esa parada: pasa
  // por los mismos setters que ya recalculan noches, asi que el usuario
  // sigue pudiendo ajustarlas despues.
  const cambiarCiudad = (e) => {
    form.cambiar(e);
    const idx = Number(e.target.value) || 0;
    const parada = idx > 0 ? paradas[idx - 1] : null;
    if (parada?.startDate) fijar('checkIn', paraInputFecha(parada.startDate));
    if (parada?.endDate) fijar('checkOut', paraInputFecha(parada.endDate));
  };

  // Las noches se recalculan solas al mover las fechas: nadie quiere hacer esa resta.
  useEffect(() => {
    const calculadas = nochesEntre(valores.checkIn, valores.checkOut);
    if (calculadas > 0 && String(calculadas) !== String(valores.nights)) {
      fijar('nights', calculadas);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valores.checkIn, valores.checkOut]);

  const subtotal = Number(valores.totalCost) || 0;
  const noches = Number(valores.nights) || 0;
  const porNoche = noches > 0 ? subtotal / noches : 0;

  const guardar = form.enviar(async (v) => {
    const item = {
      type: v.type,
      name: v.name.trim(),
      place: v.lugar.trim() ? { name: v.lugar.trim() } : undefined,
      destinationIndex: Number(v.destinationIndex) || 0,
      checkIn: desdeInputFecha(v.checkIn),
      checkOut: desdeInputFecha(v.checkOut),
      totalCost: Number(v.totalCost) || 0,
      nights: Number(v.nights) || 0,
      bookingRef: v.bookingRef.trim(),
      isEstimate: v.isEstimate,
      notes: v.notes.trim(),
    };

    // Guardar manda la lista completa, así que hay que reenviar los demás
    // hospedajes intactos. Enumerar los campos a mano hacía que cualquiera que
    // el formulario no tocara (externalUrl, y ahora totalCost) se perdiera al
    // editar otro elemento: se conserva todo y solo se quitan los calculados.
    const lista = (viaje.lodging || []).map((l) => {
      const { _id, id: _ignorado, subtotal, perNight, ...resto } = l;
      return { ...resto, totalCost: l.totalCost || (l.nightlyRate || 0) * (l.nights || 0) };
    });

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

        {paradas.length > 0 && (
          <Campo label="¿Para qué ciudad es?">
            <select name="destinationIndex" value={valores.destinationIndex} onChange={cambiarCiudad}>
              <option value={0}>{viaje.destination?.name || 'Destino principal'}</option>
              {paradas.map((p, i) => (
                <option key={i} value={i + 1}>
                  {p.place?.name || `Parada ${i + 1}`}
                </option>
              ))}
            </select>
          </Campo>
        )}

        <div className="campos-2">
          <Campo
            label="Llegada"
            type="date"
            onClick={(e) => e.currentTarget.showPicker?.()}
            {...form.props('checkIn')}
          />
          <Campo
            label="Salida"
            type="date"
            min={valores.checkIn || undefined}
            onClick={(e) => e.currentTarget.showPicker?.()}
            {...form.props('checkOut')}
          />
        </div>

        <div className="campos-2">
          <Campo
            label="Costo total de la estancia"
            type="number"
            min="0"
            step="1"
            placeholder="0"
            ayuda={`En ${moneda}, por las noches completas.`}
            {...form.props('totalCost')}
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
            <span className="etiqueta">
              {porNoche > 0 ? `≈ ${formatoMoneda(porNoche, moneda)} por noche` : 'Total'}
            </span>
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
