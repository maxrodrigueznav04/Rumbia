import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { tripsApi, weatherApi } from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import useFormulario from '../../hooks/useFormulario.js';
import { reglas } from '../../utils/validacion.js';
import { Boton, Campo, Modal, Aviso } from '../ui.jsx';
import ClienteDelViaje from '../ClienteDelViaje.jsx';
import CampoFechas from '../CampoFechas.jsx';
import CampoDestino from '../CampoDestino.jsx';
import CampoParadas, { paradasAPayload, payloadAParadas } from '../CampoParadas.jsx';
import { paraInputFecha, desdeInputFecha } from '../../utils/format.js';

const ESTADOS = ['borrador', 'planeado', 'aprobado', 'en-curso', 'completado'];

const diasEntre = (a, b) => {
  if (!a || !b) return 0;
  const ms = new Date(b) - new Date(a);
  return Number.isNaN(ms) ? 0 : Math.max(1, Math.round(ms / 86400000) + 1);
};

/** Edición del viaje: título, destino, fechas, viajeros, presupuesto y estado. */
export default function FormViaje({ abierto, onCerrar, viaje, onGuardado }) {
  const { t } = useTranslation(['formularios', 'dominio']);
  const { user } = useAuth();
  // Quien viaja por su cuenta no necesita cliente, margen ni ocultar precios:
  // eso es para quien arma el viaje para alguien más.
  const esAgencia = user?.preferences?.perfilUso !== 'personal';
  // Coordenadas de la sugerencia elegida en el autocompletado, si eligió una.
  const [clienteId, setClienteId] = useState(viaje.client?._id || viaje.client || '');
  const [lugarElegido, setLugarElegido] = useState(null);
  const [paradas, setParadas] = useState(() => payloadAParadas(viaje.additionalDestinations));

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
      clienteNombre: viaje.client?.nombre || viaje.cliente?.nombre || '',
      clienteContacto: viaje.client?.telefono || viaje.client?.email || viaje.cliente?.contacto || '',
      ocultarDesglose: viaje.ocultarDesglose ?? false,
      ocultarCodigos: viaje.ocultarCodigos ?? true,
      margenTipo: viaje.margen?.tipo || 'fijo',
      margenMonto: viaje.margen?.monto || '',
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
      client: clienteId || null,
      cliente: { nombre: v.clienteNombre.trim(), contacto: v.clienteContacto.trim() },
      ocultarDesglose: v.ocultarDesglose,
      ocultarCodigos: v.ocultarCodigos,
      margen: { tipo: v.margenTipo, monto: Number(v.margenMonto) || 0 },
      additionalDestinations: paradasAPayload(paradas),
    };

    // Si cambió el destino hay que volver a geocodificar: si no, el mapa y el
    // clima seguirían apuntando a la ciudad anterior. Si ya eligió una
    // sugerencia del autocompletado, esas coordenadas ya son las correctas.
    if (destinoCambio) {
      let coords = {};
      if (lugarElegido) {
        coords = { lat: lugarElegido.lat, lng: lugarElegido.lng, country: lugarElegido.country };
      } else {
        try {
          const geo = await weatherApi.geocode(v.destino.trim());
          coords = { lat: geo.place.lat, lng: geo.place.lng, country: geo.place.country };
        } catch {
          coords = {};
        }
      }
      // Igual que al crear: si vino de una sugerencia, se guarda solo el
      // nombre del lugar. Estado y pais ya viajan en `coords` y la pantalla
      // los vuelve a pegar al mostrar el destino.
      payload.destination = { name: lugarElegido?.name || v.destino.trim(), ...coords };
    }

    if (v.origen.trim() !== (viaje.origin?.name || '')) {
      payload.origin = { name: v.origen.trim() };
    }

    const res = await tripsApi.update(viaje._id, payload);
    onGuardado(res.itinerario);
    onCerrar();
  });

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={t('formularios:viaje.titulo')}>
      <form onSubmit={guardar} className="pila" noValidate>
        {form.errorServidor && <Aviso tipo="error">{form.errorServidor.mensaje}</Aviso>}

        <Campo label={t('formularios:viaje.nombreDelViaje')} {...form.props('title')} />

        {esAgencia && <ClienteDelViaje value={{ id: clienteId, nombre: valores.clienteNombre, contacto: valores.clienteContacto }} onChange={(c) => { setClienteId(c.id); form.fijar('clienteNombre', c.nombre); form.fijar('clienteContacto', c.contacto); }} />}

        <CampoDestino
          label={t('formularios:viaje.destino')}
          ayuda={destinoCambio ? t('formularios:viaje.destinoAyuda') : undefined}
          name={form.props('destino').name}
          value={form.props('destino').value}
          error={form.props('destino').error}
          onBlur={form.props('destino').onBlur}
          onChange={(e) => {
            setLugarElegido(null);
            form.props('destino').onChange(e);
          }}
          onSeleccionar={setLugarElegido}
        />

        <Campo label={t('formularios:viaje.origen')} placeholder={t('formularios:viaje.origenPlaceholder')} {...form.props('origen')} />

        <CampoFechas
          inicio={valores.startDate}
          fin={valores.endDate}
          // null, no undefined: el default de CampoFechas (minimo = HOY) solo
          // se salta con null, undefined lo dispara igual por como funcionan
          // los parametros por defecto en JS — con undefined, un viaje que ya
          // empezo no dejaba corregir la fecha de salida a algo anterior a hoy.
          minimo={null}
          onCambio={({ inicio, fin }) => {
            form.fijar('startDate', inicio);
            form.fijar('endDate', fin);
          }}
          errorInicio={form.errores.startDate}
          errorFin={form.errores.endDate}
        />

        <CampoParadas
          paradas={paradas}
          onCambio={setParadas}
          tripStart={valores.startDate}
          tripEnd={valores.endDate}
        />

        {cambioFechas && diasNuevos > 0 && (
          <Aviso tipo={seAcorta ? 'alerta' : 'info'}>
            {seAcorta ? (
              <>
                {t('formularios:viaje.seAcortaPre')} <strong>{t('formularios:viaje.seAcortaDias', { dias: diasNuevos })}</strong>{' '}
                {t('formularios:viaje.seAcortaPost', { diasItinerario })}
              </>
            ) : diasItinerario > 0 && diasNuevos > diasItinerario ? (
              <>
                {t('formularios:viaje.seAlargaPre')} <strong>{t('formularios:viaje.seAlargaDias', { dias: diasNuevos })}</strong>.{' '}
                {t('formularios:viaje.seAlargaPost', { diferencia: diasNuevos - diasItinerario })}
              </>
            ) : (
              <>
                {t('formularios:viaje.quedaDePre')} <strong>{t('formularios:viaje.quedaDeDias', { dias: diasNuevos })}</strong>.
              </>
            )}
          </Aviso>
        )}

        <div className="campos-2">
          <Campo label={t('formularios:viaje.viajeros')} type="number" min="1" max="30" {...form.props('travelers')} />
          <Campo
            label={t('formularios:viaje.presupuesto')}
            type="number"
            min="0"
            step="100"
            placeholder="0"
            ayuda={t('formularios:viaje.presupuestoAyuda', { moneda: viaje.budget?.currency || 'MXN' })}
            {...form.props('presupuesto')}
          />
        </div>

        <Campo label={t('formularios:viaje.estadoOperativo')} ayuda={t('formularios:viaje.estadoOperativoAyuda')}>
          <select {...form.props('status')}>
            {ESTADOS.map((valor) => (
              <option key={valor} value={valor}>
                {t(`dominio:estadoViaje.${valor}`)}
              </option>
            ))}
          </select>
        </Campo>

        <Campo label={t('formularios:comun.notas')}>
          <textarea placeholder={t('formularios:viaje.notasPlaceholder')} {...form.props('notes')} />
        </Campo>

        <label className="campo-check">
          <input
            type="checkbox"
            name="ocultarCodigos"
            checked={form.valores.ocultarCodigos}
            onChange={form.cambiar}
          />
          {t('formularios:viaje.ocultarCodigos')}
        </label>
        <p className="tenue" style={{ margin: '-8px 0 0', fontSize: '0.82rem' }}>
          {form.valores.ocultarCodigos
            ? t('formularios:viaje.ocultarCodigosSiTexto')
            : t('formularios:viaje.ocultarCodigosNoTexto')}
        </p>

        {esAgencia && (
          <>
            <div className="campos-2">
              <Campo label={t('formularios:viaje.margen')}>
                <select {...form.props('margenTipo')}>
                  <option value="fijo">{t('formularios:viaje.montoFijo')}</option>
                  <option value="porcentaje">{t('formularios:viaje.porcentajeSobreCosto')}</option>
                </select>
              </Campo>
              <Campo
                label={valores.margenTipo === 'porcentaje' ? t('formularios:viaje.porcentaje') : t('formularios:viaje.monto')}
                type="number"
                min="0"
                step={valores.margenTipo === 'porcentaje' ? '1' : '100'}
                placeholder="0"
                ayuda={
                  valores.margenTipo === 'porcentaje'
                    ? t('formularios:viaje.margenPorcentajeAyuda')
                    : t('formularios:viaje.margenMontoAyuda', { moneda: viaje.budget?.currency || 'MXN' })
                }
                {...form.props('margenMonto')}
              />
            </div>

            <label className="campo-check">
              <input
                type="checkbox"
                name="ocultarDesglose"
                checked={form.valores.ocultarDesglose}
                onChange={form.cambiar}
              />
              {t('formularios:viaje.ocultarDesglose')}
            </label>
            {form.valores.ocultarDesglose && (
              <p className="tenue" style={{ margin: '-8px 0 0', fontSize: '0.82rem' }}>
                {t('formularios:viaje.ocultarDesgloseTexto')}
              </p>
            )}
          </>
        )}

        <div className="modal-acciones">
          <Boton variante="secundario" type="button" onClick={onCerrar}>
            {t('formularios:comun.cancelar')}
          </Boton>
          <Boton type="submit" cargando={form.enviando}>
            {t('formularios:viaje.guardarCambios')}
          </Boton>
        </div>
      </form>
    </Modal>
  );
}
