import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { chatApi, tripsApi } from '../api/index.js';
import { Modal, Boton, Aviso, Cargando } from './ui.jsx';
import Icono from './Icono.jsx';

const EJEMPLOS = [
  '¿Qué ruta me conviene para minimizar vuelos en un viaje de varias ciudades?',
  '¿Cuáles son históricamente las mejores fechas para volar a este destino?',
  '¿Cómo agrego un hospedaje en otra ciudad del viaje?',
];

/** "/viajes/64f.../itinerario" o "/viajes/64f..." -> "64f...". Nunca "nuevo" ni la lista. */
function tripIdDesdeRuta(pathname) {
  const m = pathname.match(/^\/viajes\/([^/]+)(?:\/itinerario)?\/?$/);
  return m && m[1] !== 'nuevo' ? m[1] : null;
}

/**
 * Chat de IA disponible en toda la app (montado una sola vez en Layout.jsx),
 * solo para el agente -- nunca lo ve el cliente. Puede platicar en general o,
 * si hay un viaje elegido, con su contexto completo (destino, fechas,
 * hospedajes, itinerario). Solo aconseja: no hay ningun mecanismo aqui ni en
 * chat.service.js/chat.controller.js que escriba de vuelta a ningun viaje.
 */
export default function ChatFlotante() {
  const location = useLocation();
  const [abierto, setAbierto] = useState(false);
  const [tripId, setTripId] = useState(null); // null = modo general
  const [viajes, setViajes] = useState(null); // lista para el selector; null = todavia no se pidio
  const [mensajes, setMensajes] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [reiniciando, setReiniciando] = useState(false);
  const finRef = useRef(null);

  const abrir = () => {
    // Cada vez que se abre desde el boton flotante, arranca en el contexto
    // de la pantalla actual: dentro de un viaje habla de ESE viaje, en
    // cualquier otra pantalla arranca en modo general. El selector de abajo
    // deja cambiarlo en cualquier momento.
    setTripId(tripIdDesdeRuta(location.pathname));
    setAbierto(true);
  };

  useEffect(() => {
    if (!abierto) return undefined;
    let cancelado = false;
    setCargando(true);
    setError(null);
    chatApi
      .get(tripId)
      .then((data) => {
        if (!cancelado) setMensajes(data.messages || []);
      })
      .catch((err) => {
        if (!cancelado) setError(err);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [abierto, tripId]);

  // La lista de viajes para el selector se pide una sola vez, la primera
  // vez que se abre el panel -- no hace falta refrescarla en cada mensaje.
  useEffect(() => {
    if (!abierto || viajes) return;
    tripsApi
      .list({ limit: 50 })
      .then((data) => setViajes(data.trips || []))
      .catch(() => setViajes([])); // sin selector no truena el chat, solo se queda vacio
  }, [abierto, viajes]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ block: 'end' });
  }, [mensajes, enviando]);

  const cambiarViaje = (e) => {
    setTripId(e.target.value || null);
  };

  const enviar = async (e) => {
    e?.preventDefault?.();
    const mensaje = texto.trim();
    if (!mensaje || enviando) return;

    setError(null);
    setEnviando(true);
    setMensajes((prev) => [...prev, { role: 'user', text: mensaje }]);
    setTexto('');

    try {
      const data = await chatApi.send({ message: mensaje, tripId: tripId || undefined });
      setMensajes(data.messages || []);
    } catch (err) {
      // status===0 = se cayo la conexion o el cliente se rindio, pero el
      // servidor puede haber terminado igual (mismo patron que generar
      // itinerarios): se revisa el historial real antes de darlo por fallido.
      if (err.status === 0) {
        try {
          const datos = await chatApi.get(tripId);
          const ultimo = datos.messages?.[datos.messages.length - 1];
          if (ultimo?.role === 'model') {
            setMensajes(datos.messages);
            return;
          }
        } catch {
          // cae al error de abajo
        }
      }
      setError(err);
      setTexto(mensaje); // no se pierde lo escrito
      setMensajes((prev) => prev.slice(0, -1)); // quita el mensaje optimista sin respuesta
    } finally {
      setEnviando(false);
    }
  };

  const reiniciar = async () => {
    setReiniciando(true);
    try {
      await chatApi.clear(tripId);
      setMensajes([]);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setReiniciando(false);
    }
  };

  return (
    <>
      {!abierto && (
        <button
          type="button"
          className="chat-flotante-boton"
          onClick={abrir}
          aria-label="Abrir chat con el asistente"
        >
          <Icono nombre="chispa" tamano={22} />
        </button>
      )}

      <Modal abierto={abierto} onCerrar={() => setAbierto(false)} titulo="Chat con el asistente" ancho={640}>
        <div className="chat-panel">
          <div className="fila-entre" style={{ marginBottom: 10, gap: 8 }}>
            <select value={tripId || ''} onChange={cambiarViaje} aria-label="¿De qué viaje quieres hablar?">
              <option value="">General (sin viaje)</option>
              {viajes?.map((v) => (
                <option key={v._id} value={v._id}>
                  {v.title}
                </option>
              ))}
            </select>
            {mensajes.length > 0 && (
              <Boton variante="fantasma" chico onClick={reiniciar} cargando={reiniciando}>
                Reiniciar
              </Boton>
            )}
          </div>

          <div className="chat-mensajes">
            {cargando && <Cargando texto="Cargando conversación..." />}

            {!cargando && mensajes.length === 0 && (
              <div className="pila-sm">
                <p className="tenue" style={{ margin: 0 }}>
                  Puedo ayudarte a planear rutas, comparar fechas de vuelo, resolver dudas del viaje o
                  de cómo usar Rumbo.
                </p>
                <div className="chat-ejemplos">
                  {EJEMPLOS.map((ejemplo) => (
                    <button key={ejemplo} type="button" onClick={() => setTexto(ejemplo)}>
                      {ejemplo}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mensajes.map((m, i) => (
              <div key={i} className={`chat-burbuja ${m.role === 'user' ? 'usuario' : 'modelo'}`}>
                {m.text}
              </div>
            ))}

            {enviando && (
              <div className="chat-burbuja modelo pensando">
                <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                Pensando...
              </div>
            )}

            <div ref={finRef} />
          </div>

          {error && (
            <Aviso tipo="error" titulo="No se pudo enviar">
              {error.message}
            </Aviso>
          )}

          <form className="chat-form" onSubmit={enviar}>
            <textarea
              placeholder="Escribe tu pregunta..."
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  enviar();
                }
              }}
              disabled={enviando}
            />
            <Boton type="submit" cargando={enviando} disabled={!texto.trim()}>
              Enviar
            </Boton>
          </form>
        </div>

        <p className="tenue" style={{ margin: '10px 0 0', fontSize: '0.78rem' }}>
          Las respuestas son generadas por IA y pueden no ser exactas, sobre todo en precios y
          disponibilidad — confírmalo en un comparador real.
        </p>
      </Modal>
    </>
  );
}
