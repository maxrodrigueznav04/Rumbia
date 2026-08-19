import { formatoDiaSemana } from '../utils/format.js';
import Icono from './Icono.jsx';

// Codigo de OpenWeather -> icono de linea. El 01 y el 02 son cielo despejado
// o casi; del 09 al 11 llueve; el 13 es nieve; el 50 es niebla.
const ICONOS = {
  '01': 'sol', '02': 'sol', '03': 'nube', '04': 'nube',
  '09': 'lluvia', '10': 'lluvia', '11': 'lluvia', '13': 'nieve', '50': 'nube',
};

// Los dias estimados no traen codigo de OpenWeather: se muestran con nube
// apagada (el color lo pone .clima-dia.estimado), no con un calendario.
const iconoDe = (dia) => (dia.icon ? ICONOS[dia.icon.slice(0, 2)] || 'nube' : 'nube');

/** Tira horizontal con el clima de cada dia del viaje. */
export default function TiraClima({ clima }) {
  if (!clima?.days?.length) return null;

  const { days, meta } = clima;
  const todoEstimado = meta?.estimatedDays === days.length;

  return (
    <div>
      <div className="clima-tira">
        {days.map((d) => (
          <div
            className={`clima-dia ${d.source === 'estimacion-historica' ? 'estimado' : ''}`}
            key={d.date}
          >
            <div className="etiqueta" style={{ fontSize: '0.66rem' }}>
              {formatoDiaSemana(d.date)}
            </div>
            <Icono nombre={iconoDe(d)} tamano={20} className="clima-icono" />
            <div className="temp">
              {Math.round(d.tempMax)}° <span className="tenue">{Math.round(d.tempMin)}°</span>
            </div>
            <div className="cond">
              {d.precipitationChance !== null && d.precipitationChance > 20
                ? `${d.precipitationChance}% lluvia`
                : d.condition}
            </div>
          </div>
        ))}
      </div>

      <p className="tenue" style={{ margin: '8px 0 0', fontSize: '0.78rem' }}>
        {!meta?.configured
          ? 'Estimación por temporada. Configura OPENWEATHER_API_KEY para ver el pronóstico real.'
          : todoEstimado
            ? 'Tu viaje está a más de 5 días: estos valores son una estimación según la temporada, no un pronóstico.'
            : meta?.estimatedDays > 0
              ? `Pronóstico real para los primeros días; los últimos ${meta.estimatedDays} son estimación por temporada.`
              : 'Pronóstico de OpenWeatherMap.'}
      </p>
    </div>
  );
}
