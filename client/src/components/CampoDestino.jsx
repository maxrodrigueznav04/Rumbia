import { useEffect, useRef, useState } from 'react';
import { Campo } from './ui.jsx';
import { weatherApi } from '../api/index.js';

/**
 * Campo de destino con sugerencias en vivo, para no descubrir hasta guardar
 * que el lugar no existe o quedó mal escrito.
 *
 * El texto sigue siendo libre a propósito: si la persona no elige ninguna
 * sugerencia, lo que escribió se manda igual y se resuelve al guardar, como
 * ya pasaba antes de esto. Elegir una sugerencia solo adelanta ese trabajo y
 * evita la ambigüedad ("Guadalajara" ¿de México o de España?).
 */
export default function CampoDestino({
  label = 'Destino',
  name = 'destino',
  value,
  onChange,
  onBlur,
  onSeleccionar,
  error,
  ayuda,
  placeholder,
}) {
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrando, setMostrando] = useState(false);
  const [indiceActivo, setIndiceActivo] = useState(-1);
  const timerRef = useRef(null);
  const blurTimerRef = useRef(null);

  useEffect(
    () => () => {
      clearTimeout(timerRef.current);
      clearTimeout(blurTimerRef.current);
    },
    []
  );

  const buscar = (texto) => {
    clearTimeout(timerRef.current);
    if (texto.trim().length < 3) {
      setSugerencias([]);
      return;
    }
    // Debounce: sin esto, cada tecla dispara una llamada.
    timerRef.current = setTimeout(async () => {
      try {
        const datos = await weatherApi.sugerencias(texto.trim());
        setSugerencias(datos.lugares || []);
        setIndiceActivo(-1);
      } catch {
        // Sin sugerencias no se rompe nada: el texto libre sigue funcionando.
        setSugerencias([]);
      }
    }, 300);
  };

  const cambiar = (e) => {
    onChange(e);
    setMostrando(true);
    buscar(e.target.value);
  };

  const elegir = (lugar) => {
    const etiqueta = [lugar.name, lugar.state, lugar.country].filter(Boolean).join(', ');
    onChange({ target: { name, value: etiqueta } });
    onSeleccionar?.(lugar);
    setSugerencias([]);
    setMostrando(false);
  };

  const alTeclear = (e) => {
    if (!mostrando || sugerencias.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndiceActivo((i) => Math.min(i + 1, sugerencias.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndiceActivo((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && indiceActivo >= 0) {
      e.preventDefault();
      elegir(sugerencias[indiceActivo]);
    } else if (e.key === 'Escape') {
      setMostrando(false);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <Campo
        label={label}
        name={name}
        value={value}
        onChange={cambiar}
        onFocus={() => value?.trim().length >= 3 && sugerencias.length > 0 && setMostrando(true)}
        // El clic en una sugerencia dispara mousedown antes que este blur; con
        // preventDefault en el boton (abajo) ni siquiera llega a ocurrir. El
        // timeout es respaldo para cuando el foco se pierde de otra forma.
        onBlur={(e) => {
          blurTimerRef.current = setTimeout(() => setMostrando(false), 150);
          onBlur?.(e);
        }}
        onKeyDown={alTeclear}
        autoComplete="off"
        placeholder={placeholder}
        error={error}
        ayuda={ayuda}
      />

      {mostrando && sugerencias.length > 0 && (
        <ul className="sugerencias-destino" role="listbox">
          {sugerencias.map((s, i) => (
            <li key={`${s.name}-${s.lat}-${s.lng}`}>
              <button
                type="button"
                role="option"
                aria-selected={i === indiceActivo}
                className={i === indiceActivo ? 'activo' : ''}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elegir(s)}
              >
                <span>{s.name}</span>
                <span className="tenue">{[s.state, s.country].filter(Boolean).join(', ')}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
