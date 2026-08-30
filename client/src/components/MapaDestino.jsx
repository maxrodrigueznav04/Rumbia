import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ICONOS_CATEGORIA } from '../utils/format.js';

/**
 * Los iconos por defecto de Leaflet se rompen con los bundlers (rutas relativas
 * a imagenes que Vite no resuelve). Se usa un DivIcon con emoji: sin assets,
 * sin CDN y ademas comunica la categoria de la actividad.
 */
function icono(categoria, esDestino) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:30px;height:30px;border-radius:50% 50% 50% 4px;
      transform:rotate(45deg);
      background:${esDestino ? '#05190e' : '#fff'};
      border:2px solid ${esDestino ? '#05190e' : '#51634e'};
      box-shadow:0 2px 6px rgba(5,25,14,.28);
      display:grid;place-items:center;">
      <span style="transform:rotate(-45deg);font-size:14px;line-height:1">
        ${esDestino
          // El marcador del destino va en verde oscuro: un emoji encima quedaria
          // oscuro sobre oscuro, asi que lleva un punto claro dibujado.
          ? '<span style="display:block;width:8px;height:8px;border-radius:50%;background:#f1f7ef"></span>'
          : ICONOS_CATEGORIA[categoria] || '📍'}
      </span>
    </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -28],
  });
}

/** Reencuadra el mapa cuando cambian los pines (p. ej. al generar el itinerario). */
function Encuadrar({ puntos }) {
  const map = useMap();
  // `puntos` es un arreglo literal nuevo en cada render del padre (MapaDestino
  // lo arma con spread), asi que depender de el reencuadraba el mapa en
  // cualquier re-render, no solo cuando los pines de verdad cambiaban —
  // deshaciendo el pan/zoom que el usuario acababa de hacer. Se depende de
  // una clave de coordenadas (valor, no referencia) en su lugar.
  const clave = puntos.map((p) => `${p.lat},${p.lng}`).join(';');

  useEffect(() => {
    if (!puntos.length) return;
    if (puntos.length === 1) {
      map.setView([puntos[0].lat, puntos[0].lng], 13);
      return;
    }
    map.fitBounds(
      L.latLngBounds(puntos.map((p) => [p.lat, p.lng])),
      { padding: [36, 36], maxZoom: 15 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, clave]);

  return null;
}

/**
 * Activa o desactiva el arrastre segun haga falta.
 *
 * En tactil, dejar el arrastre siempre activo hace que un dedo sobre el mapa
 * mueva el mapa en vez de desplazar la pagina, y el usuario queda atrapado.
 * El mapa arranca bloqueado y se desbloquea al tocarlo, como los mapas
 * embebidos de Google.
 */
function ControlArrastre({ activo, esTactil }) {
  const map = useMap();

  useEffect(() => {
    if (!esTactil) return;
    if (activo) {
      map.dragging.enable();
      map.touchZoom.enable();
    } else {
      map.dragging.disable();
      map.touchZoom.disable();
    }
  }, [map, activo, esTactil]);

  // Al cambiar de tamano el contenedor (abrir un modal, rotar el telefono) el
  // mapa queda con las teselas mal colocadas si no se le avisa.
  useEffect(() => {
    const remedir = () => map.invalidateSize();
    window.addEventListener('resize', remedir);
    window.addEventListener('orientationchange', remedir);
    const t = setTimeout(remedir, 250); // tras la animacion de entrada
    return () => {
      window.removeEventListener('resize', remedir);
      window.removeEventListener('orientationchange', remedir);
      clearTimeout(t);
    };
  }, [map]);

  return null;
}

const ES_TACTIL =
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

export default function MapaDestino({ destino, pines = [], alto }) {
  const [interactivo, setInteractivo] = useState(!ES_TACTIL);

  const tieneDestino = Number.isFinite(destino?.lat) && Number.isFinite(destino?.lng);
  const validos = pines.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

  if (!tieneDestino && !validos.length) {
    return (
      <div className="mapa" style={{ display: 'grid', placeItems: 'center', ...(alto && { height: alto }) }}>
        <div className="centrado" style={{ padding: 20 }}>
          <div style={{ fontSize: '1.8rem' }} aria-hidden="true">
            🗺️
          </div>
          <p className="tenue" style={{ margin: '6px 0 0', maxWidth: '30ch' }}>
            Aún no tenemos las coordenadas de este destino. Edítalo para ubicarlo en el mapa.
          </p>
        </div>
      </div>
    );
  }

  const centro = tieneDestino ? [destino.lat, destino.lng] : [validos[0].lat, validos[0].lng];
  const todos = tieneDestino ? [{ ...destino, esDestino: true }, ...validos] : validos;

  return (
    <div className="mapa" style={alto ? { height: alto } : undefined}>
      <MapContainer
        center={centro}
        zoom={12}
        // Sin esto la rueda del raton haria zoom en vez de desplazar la pagina.
        scrollWheelZoom={false}
        dragging={!ES_TACTIL}
        touchZoom={!ES_TACTIL}
        style={{ height: '100%', width: '100%' }}
      >
        {/* OpenStreetMap: gratuito y sin API key. La atribucion es obligatoria. */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {todos.map((p, i) => (
          <Marker
            key={p.id || `punto-${i}`}
            position={[p.lat, p.lng]}
            icon={icono(p.category, p.esDestino)}
          >
            <Popup>
              <strong>{p.title || p.name}</strong>
              {p.dayNumber && (
                <>
                  <br />
                  <span style={{ color: '#6b706b' }}>Día {p.dayNumber}</span>
                </>
              )}
            </Popup>
          </Marker>
        ))}

        <Encuadrar puntos={todos} />
        <ControlArrastre activo={interactivo} esTactil={ES_TACTIL} />
      </MapContainer>

      {ES_TACTIL && !interactivo && (
        <button type="button" className="mapa-bloqueo" onClick={() => setInteractivo(true)}>
          <span>Toca para mover el mapa</span>
        </button>
      )}
    </div>
  );
}
