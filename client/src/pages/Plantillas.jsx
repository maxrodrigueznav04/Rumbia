import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { templatesApi } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import useFetch from '../hooks/useFetch.js';
import CampoFechas from '../components/CampoFechas.jsx';
import Icono from '../components/Icono.jsx';
import {
  Boton,
  Campo,
  Tarjeta,
  Vacio,
  ErrorCarga,
  Esqueleto,
  Aviso,
  Modal,
  ModalConfirmar,
} from '../components/ui.jsx';

const hoy = new Date().toISOString().slice(0, 10);

/**
 * Plantillas guardadas: destinos que se arman seguido, listos para aplicar a
 * un cliente nuevo sin volver a capturar actividad por actividad. Se guardan
 * desde el botón "Guardar como plantilla" en la pantalla de un itinerario.
 */
export default function Plantillas() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, cargando, error, recargar } = useFetch(
    ({ signal }) => templatesApi.listar({ signal }),
    []
  );

  const [porUsar, setPorUsar] = useState(null); // plantilla elegida para aplicar
  const [porEliminar, setPorEliminar] = useState(null);

  const plantillas = data?.templates || [];

  return (
    <div className="pila">
      <div>
        <h1 style={{ marginBottom: 4 }}>Plantillas</h1>
        <p className="suave" style={{ margin: 0 }}>
          {user?.agency
            ? 'Compartidas con tu equipo: cualquier agente de tu agencia las puede usar.'
            : 'Destinos que armas seguido, listos para aplicar a un viaje nuevo sin empezar de cero.'}
        </p>
      </div>

      {cargando && (
        <div className="rejilla rejilla-2 rejilla-3">
          {[0, 1, 2].map((i) => (
            <div className="tarjeta" key={i}>
              <Esqueleto alto={18} ancho="60%" />
              <Esqueleto alto={14} ancho="40%" style={{ margin: '10px 0' }} />
              <Esqueleto alto={32} />
            </div>
          ))}
        </div>
      )}

      {error && <ErrorCarga error={error} onReintentar={recargar} />}

      {data && plantillas.length === 0 && (
        <Vacio icono="🗂️" titulo="Todavía no tienes plantillas">
          Abre cualquier itinerario ya armado y usa "Guardar como plantilla" para reutilizarlo con el
          próximo cliente que viaje al mismo destino.
        </Vacio>
      )}

      {plantillas.length > 0 && (
        <div className="rejilla rejilla-2 rejilla-3">
          {plantillas.map((p) => (
            <Tarjeta key={p._id} titulo={p.name}>
              <p className="suave" style={{ marginTop: 0 }}>
                <Icono nombre="pin" tamano={14} /> {p.destination?.name || 'Sin destino'}
                <br />
                {p.dayCount} {p.dayCount === 1 ? 'día' : 'días'}
                {user?.agency && p.creadaPor && (
                  <>
                    {' '}
                    · guardada por {p.creadaPorId === user._id ? 'ti' : p.creadaPor}
                  </>
                )}
              </p>
              <div className="fila" style={{ gap: 8 }}>
                <Boton chico onClick={() => setPorUsar(p)}>
                  Usar
                </Boton>
                {p.creadaPorId === user?._id && (
                  <Boton variante="peligro-texto" chico onClick={() => setPorEliminar(p)}>
                    Eliminar
                  </Boton>
                )}
              </div>
            </Tarjeta>
          ))}
        </div>
      )}

      {porUsar && (
        <FormAplicarPlantilla
          plantilla={porUsar}
          onCerrar={() => setPorUsar(null)}
          onCreado={(tripId) => navigate(`/viajes/${tripId}`)}
        />
      )}

      <ModalConfirmar
        abierto={Boolean(porEliminar)}
        onCerrar={() => setPorEliminar(null)}
        onConfirmar={async () => {
          await templatesApi.eliminar(porEliminar._id);
          recargar();
        }}
        titulo="Eliminar plantilla"
        mensaje={`Se va a borrar "${porEliminar?.name}". Los viajes que ya creaste con ella no se tocan.`}
        textoConfirmar="Eliminar"
      />
    </div>
  );
}

/** Modal: título, fechas y viajeros para crear el viaje a partir de la plantilla elegida. */
function FormAplicarPlantilla({ plantilla, onCerrar, onCreado }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    title: `Viaje a ${plantilla.destination?.name || ''}`,
    startDate: '',
    endDate: '',
    travelers: 1,
    presupuesto: '',
  });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [detalles, setDetalles] = useState([]);

  const cambiar = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const errorDe = (campo) =>
    detalles.find((d) => d.field === campo || d.field.startsWith(`${campo}.`))?.message;

  const enviar = async (e) => {
    e.preventDefault();
    setError(null);
    setDetalles([]);
    setEnviando(true);
    try {
      const data = await templatesApi.aplicar(plantilla._id, {
        title: form.title.trim() || `Viaje a ${plantilla.destination?.name}`,
        startDate: form.startDate,
        endDate: form.endDate,
        travelers: Number(form.travelers) || 1,
        budget: {
          amount: Number(form.presupuesto) || 0,
          currency: user?.preferences?.currency || 'MXN',
        },
      });
      onCreado(data.trip._id);
    } catch (err) {
      setError(err.message);
      setDetalles(err.details || []);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal abierto onCerrar={onCerrar} titulo={`Usar "${plantilla.name}"`} ancho={480}>
      <form onSubmit={enviar} className="pila" noValidate>
        <p className="suave" style={{ marginTop: 0 }}>
          Se crea un viaje nuevo a {plantilla.destination?.name} con el mismo itinerario de la
          plantilla. Podrás editarlo después como cualquier otro viaje.
        </p>

        {error && <Aviso tipo="error">{error}</Aviso>}

        <Campo
          label="¿Cómo se llama el viaje?"
          name="title"
          value={form.title}
          onChange={cambiar}
          error={errorDe('title')}
        />

        <CampoFechas
          inicio={form.startDate}
          fin={form.endDate}
          minimo={hoy}
          onCambio={({ inicio, fin }) => setForm((f) => ({ ...f, startDate: inicio, endDate: fin }))}
          errorInicio={errorDe('startDate')}
          errorFin={errorDe('endDate')}
        />

        <div className="rejilla rejilla-2">
          <Campo
            label="¿Cuántos viajan?"
            name="travelers"
            type="number"
            min="1"
            max="30"
            value={form.travelers}
            onChange={cambiar}
            error={errorDe('travelers')}
          />
          <Campo
            label="Presupuesto estimado"
            name="presupuesto"
            type="number"
            min="0"
            step="100"
            placeholder="Opcional"
            value={form.presupuesto}
            onChange={cambiar}
          />
        </div>

        <div className="modal-acciones">
          <Boton type="button" variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={enviando}>
            Crear viaje
          </Boton>
        </div>
      </form>
    </Modal>
  );
}
