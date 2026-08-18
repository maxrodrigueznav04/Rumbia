import { useEffect } from 'react';
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
      background:${esDestino ? '#b85c38' : '#fff'};
      border:2px solid ${esDestino ? '#a04e2e' : '#b85c38'};
      box-shadow:0 2px 6px rgba(0,0,0,.25);
      display:grid;place-items:center;">
      <span style="transform:rotate(-45deg);font-size:14px;line-height:1">
        ${esDestino ? '📍' : ICONOS_CATEGORIA[categoria] || '📍'}
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
  }, [map, puntos]);

  return null;
}

export default function MapaDestino({ destino, pines = [], alto }) {
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
        scrollWheelZoom={false}
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
                  <span style={{ color: '#8a7e73' }}>Dia {p.dayNumber}</span>
                </>
              )}
            </Popup>
          </Marker>
        ))}

        <Encuadrar puntos={todos} />
      </MapContainer>
    </div>
  );
}
