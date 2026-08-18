import { Campo } from './ui.jsx';

const HOY = new Date().toISOString().slice(0, 10);

const sumarDias = (iso, n) => {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const diasEntre = (a, b) => {
  if (!a || !b) return 0;
  const ms = new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`);
  return Number.isNaN(ms) ? 0 : Math.round(ms / 86400000) + 1;
};

const ATAJOS = [
  { texto: 'Fin de semana', noches: 2 },
  { texto: '5 días', noches: 4 },
  { texto: 'Una semana', noches: 6 },
  { texto: 'Dos semanas', noches: 13 },
];

/**
 * Par de fechas salida/regreso.
 *
 * Los <input type="date"> nativos obligan a atinarle al icono del calendario y
 * no comunican la relacion entre las dos fechas. Aqui se resuelve:
 *  - el calendario se abre al hacer clic en cualquier parte del campo
 *  - elegir la salida propone un regreso, en vez de dejar el campo vacio
 *  - el regreso no permite fechas anteriores a la salida
 *  - se muestra la duracion resultante mientras se elige
 *  - hay atajos para las duraciones mas comunes
 */
export default function CampoFechas({
  inicio,
  fin,
  onCambio,
  errorInicio,
  errorFin,
  minimo = HOY,
  etiquetaInicio = 'Salida',
  etiquetaFin = 'Regreso',
}) {
  const dias = diasEntre(inicio, fin);
  const noches = Math.max(0, dias - 1);

  // Chrome y Edge abren el selector con showPicker(); en el resto, el clic
  // normal sobre el input sigue funcionando igual que antes.
  const abrirCalendario = (e) => {
    try {
      e.currentTarget.showPicker?.();
    } catch {
      /* Firefox y Safari lo ignoran: no pasa nada, el input sigue siendo usable. */
    }
  };

  const cambiarInicio = (e) => {
    const nuevo = e.target.value;
    // Si el regreso quedaria antes de la salida (o no hay), se propone uno.
    const necesitaAjuste = !fin || fin < nuevo;
    onCambio({ inicio: nuevo, fin: necesitaAjuste ? sumarDias(nuevo, 3) : fin });
  };

  const aplicarAtajo = (noches) => {
    const desde = inicio || minimo;
    onCambio({ inicio: desde, fin: sumarDias(desde, noches) });
  };

  return (
    <div className="pila-sm">
      <div className="campos-2">
        <Campo
          label={etiquetaInicio}
          name="startDate"
          type="date"
          min={minimo}
          value={inicio || ''}
          onChange={cambiarInicio}
          onClick={abrirCalendario}
          error={errorInicio}
        />
        <Campo
          label={etiquetaFin}
          name="endDate"
          type="date"
          min={inicio || minimo}
          value={fin || ''}
          onChange={(e) => onCambio({ inicio, fin: e.target.value })}
          onClick={abrirCalendario}
          error={errorFin}
        />
      </div>

      <div className="fila" style={{ gap: 6 }}>
        <span className="campo-ayuda" style={{ marginRight: 2 }}>
          Atajos:
        </span>
        {ATAJOS.map((a) => (
          <button
            key={a.texto}
            type="button"
            className={`insignia ${noches === a.noches ? 'marca' : ''}`}
            onClick={() => aplicarAtajo(a.noches)}
          >
            {a.texto}
          </button>
        ))}
      </div>

      {dias > 0 && (
        <p className="campo-ayuda" style={{ margin: 0 }}>
          <strong>
            {dias} {dias === 1 ? 'día' : 'días'}
          </strong>{' '}
          · {noches} {noches === 1 ? 'noche' : 'noches'} de hospedaje
        </p>
      )}
    </div>
  );
}
