/**
 * Revisión automática del itinerario ya armado: no vuelve a llamar a la IA,
 * solo cruza datos que la app ya tiene (horarios de las actividades, clima
 * por día) para detectar cosas que un agente querría saber antes de
 * entregarle el plan al cliente.
 *
 * A propósito NO intenta adivinar hechos que la app no puede verificar (si un
 * museo cierra tal día, si hace falta visa, etc.): eso es terreno de
 * alucinación de la IA. Todo lo de aquí sale de datos propios: horarios que el
 * mismo itinerario declara, y el pronóstico/estimación de clima que ya se le
 * pide a OpenWeather en otra parte de la app.
 */

const UMBRAL_HUECO_MIN = 240; // 4 horas: menos que eso es un descanso normal, no un pendiente.
const UMBRAL_LLUVIA = 60; // % de probabilidad a partir del cual vale la pena avisar.
const CATEGORIAS_EXTERIOR = ['naturaleza', 'aventura'];

const aMinutos = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const formatoHora = (minutos) => {
  const h = Math.floor(minutos / 60) % 24;
  const m = minutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const fechaISO = (valor) => {
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

/**
 * @param {object} itinerario - itinerario.days con activities (time, durationMinutes, category, title)
 * @param {object} clima - { days: [{ date, precipitationChance }] }, como lo devuelve /trips/:id/weather
 * @returns {Array<{id: string, tipo: 'solape'|'hueco'|'clima', dia: number, mensaje: string}>}
 */
export function revisarItinerario(itinerario, clima) {
  if (!itinerario?.days?.length) return [];

  const climaPorFecha = new Map((clima?.days || []).map((d) => [d.date, d]));
  const avisos = [];

  for (const dia of itinerario.days) {
    const conHora = (dia.activities || [])
      .filter((a) => a.time)
      .map((a) => ({
        ...a,
        inicio: aMinutos(a.time),
        fin: aMinutos(a.time) + (a.durationMinutes || 60),
      }))
      .sort((a, b) => a.inicio - b.inicio);

    for (let i = 1; i < conHora.length; i++) {
      const prev = conHora[i - 1];
      const cur = conHora[i];

      if (cur.inicio < prev.fin) {
        avisos.push({
          id: `solape-${dia.dayNumber}-${i}`,
          tipo: 'solape',
          dia: dia.dayNumber,
          mensaje: `Día ${dia.dayNumber}: "${prev.title}" termina hasta las ${formatoHora(prev.fin)}, pero "${cur.title}" empieza a las ${cur.time} — se encima.`,
        });
        continue; // si ya se encima, el hueco no aplica entre este par
      }

      const hueco = cur.inicio - prev.fin;
      if (hueco >= UMBRAL_HUECO_MIN) {
        avisos.push({
          id: `hueco-${dia.dayNumber}-${i}`,
          tipo: 'hueco',
          dia: dia.dayNumber,
          mensaje: `Día ${dia.dayNumber}: quedan ${(hueco / 60).toFixed(1)} horas libres entre "${prev.title}" y "${cur.title}".`,
        });
      }
    }

    const fecha = dia.date ? fechaISO(dia.date) : null;
    const climaDia = fecha ? climaPorFecha.get(fecha) : null;
    if (climaDia?.precipitationChance != null && climaDia.precipitationChance >= UMBRAL_LLUVIA) {
      for (const act of dia.activities || []) {
        if (!CATEGORIAS_EXTERIOR.includes(act.category)) continue;
        avisos.push({
          id: `clima-${dia.dayNumber}-${act._id || act.title}`,
          tipo: 'clima',
          dia: dia.dayNumber,
          mensaje: `Día ${dia.dayNumber}: ${climaDia.precipitationChance}% de probabilidad de lluvia y "${act.title}" es al aire libre.`,
        });
      }
    }
  }

  return avisos.sort((a, b) => a.dia - b.dia);
}
