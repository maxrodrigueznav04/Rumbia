import { useEffect, useRef, useState } from 'react';
import { chatApi } from '../api/index.js';
import { Modal, Boton, Aviso, Cargando } from './ui.jsx';

const EJEMPLOS = [
  '¿Qué ruta me conviene para minimizar vuelos en un viaje de varias ciudades?',
  '¿Cuáles son históricamente las mejores fechas para volar a este destino?',
  '¿Cómo agrego un hospedaje en otra ciudad del viaje?',
];

/**
 * Chat de IA scoped a un viaje, solo para el agente (nunca lo ve el
 * cliente). Solo aconseja: no hay ningun mecanismo aqui que escriba de
 * vuelta al viaje, ver chat.service.js en el servidor.
 */
export default function ChatAsistente({ abierto, onCerrar, tripId }) {
  const [mensajes, setMensajes] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [reiniciando, setReiniciando] = useState(false);
  const finRef = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;
    let cancelado = false;
    setCargando(true);
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

  useEffect(() => {
    finRef.current?.scrollIntoView({ block: 'end' });
  }, [mensajes, enviando]);

  const enviar = async (e) => {
    e?.preventDefault?.();
    const mensaje = texto.trim();
    if (!mensaje || enviando) return;

    setError(null);
    setEnviando(true);
    setMensajes((prev) => [...prev, { role: 'user', text: mensaje }]);
    setTexto('');

    try {
      const data = await chatApi.send(tripId, { message: mensaje });
      setMensajes(data.messages || []);
    } catch (err) {
      // status===0 = se cayo la conexion o el cliente se rindio, pero el
      // servidor puede haber terminado igual (mismo patron que generar
      // itinerario en Itinerario.jsx): se revisa el historial real antes de
      // darlo por fallido.
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
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Chat con el asistente" ancho={640}>
      <div className="chat-panel">
        {mensajes.length > 0 && (
          <Boton
            variante="fantasma"
            chico
            style={{ alignSelf: 'flex-end', marginBottom: 8 }}
            onClick={reiniciar}
            cargando={reiniciando}
          >
            Reiniciar conversación
          </Boton>
        )}

        <div className="chat-mensajes">
          {cargando && <Cargando texto="Cargando conversación..." />}

          {!cargando && mensajes.length === 0 && (
            <div className="pila-sm">
              <p className="tenue" style={{ margin: 0 }}>
                Puedo ayudarte a planear rutas, comparar fechas de vuelo, resolver dudas del viaje o de
                cómo usar Rumbo.
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
  );
}
