// Verifica el clima a través de la propia API: mezcla de pronóstico real + estimación.
const BASE = 'http://127.0.0.1:4000/api';

const login = await fetch(`${BASE}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'demo@rumbo.app', password: 'demo1234' }),
}).then((r) => r.json());
const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.data.token}` };

const salud = await fetch(`${BASE}/health`).then((r) => r.json());
console.log('health -> openWeather:', salud.services.openWeather);

const dia = (n) => {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// Viaje que arranca mañana y dura 8 días: cruza el límite de los 5 días de pronóstico.
const creado = await fetch(`${BASE}/trips`, {
  method: 'POST', headers: h,
  body: JSON.stringify({
    title: 'Prueba de clima',
    destination: { name: 'Oaxaca de Juarez', country: 'MX' }, // sin coords: fuerza el geocoding
    startDate: dia(1), endDate: dia(8),
    travelers: 1,
  }),
}).then((r) => r.json());

const trip = creado.data.trip;
console.log(`\nViaje creado sin coordenadas: ${trip.destination.lat ?? '(ninguna)'}`);

const clima = await fetch(`${BASE}/trips/${trip._id}/weather`, { headers: h }).then((r) => r.json());

console.log(`\nubicación resuelta: [${clima.data.location.lat}, ${clima.data.location.lng}]`);
console.log(`meta:`, JSON.stringify(clima.data.meta));
console.log('\ndía         fuente                  min/max      condición');
for (const d of clima.data.days) {
  const marca = d.source === 'pronostico' ? '📡' : '📊';
  console.log(
    `${d.date}  ${marca} ${d.source.padEnd(20)} ${String(d.tempMin).padStart(5)}/${String(d.tempMax).padEnd(5)}  ${d.condition}${
      d.precipitationChance !== null ? ` (${d.precipitationChance}% lluvia)` : ''
    }`
  );
}

// Comprobar que las coordenadas quedaron guardadas en el viaje (no se re-geocodifica cada visita).
const relectura = await fetch(`${BASE}/trips/${trip._id}`, { headers: h }).then((r) => r.json());
console.log(`\ncoordenadas persistidas en el viaje: ${relectura.data.trip.destination.lat}, ${relectura.data.trip.destination.lng}`);

const reales = clima.data.days.filter((d) => d.source === 'pronostico').length;
const estimados = clima.data.days.filter((d) => d.source === 'estimacion-historica').length;
console.log(`\nresultado: ${reales} días con pronóstico real, ${estimados} estimados`);

await fetch(`${BASE}/trips/${trip._id}`, { method: 'DELETE', headers: h });
console.log('(viaje de prueba eliminado)');

process.exit(reales > 0 && estimados > 0 ? 0 : 1);
