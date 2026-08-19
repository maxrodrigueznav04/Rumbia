import { formatoDiaSemana } from '../utils/format.js';

const ICONOS = {
  '01': '☀️', '02': '🌤️', '03': '⛅', '04': '☁️',
  '09': '🌧️', '10': '🌦️', '11': '⛈️', '13': '❄️', '50': '🌫️',
};

const iconoDe = (dia) => {
  if (!dia.icon) return '📅';
  return ICONOS[dia.icon.slice(0, 2)] || '🌡️';
};

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
            <div style={{ fontSize: '1.35rem', lineHeight: 1.3 }} aria-hidden="true">
              {iconoDe(d)}
            </div>
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
