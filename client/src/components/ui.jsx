import { cloneElement, isValidElement, useEffect, useId, useRef, useState } from 'react';
import { fuerzaPassword } from '../utils/validacion.js';
import Icono from './Icono.jsx';

/** Kit de componentes base. Todo apoyado en las clases de global.css. */

export function Boton({ variante = 'primario', chico, ancho, cargando, children, ...props }) {
  const clases = [
    'boton',
    variante !== 'primario' ? variante : '',
    chico ? 'chico' : '',
    ancho ? 'ancho' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={clases} disabled={cargando || props.disabled} {...props}>
      {cargando && <span className="spinner" style={{ width: 15, height: 15, borderWidth: 2 }} />}
      {children}
    </button>
  );
}

export function Campo({ label, error, ayuda, id, children, ...props }) {
  // Cuando el control va como hijo (select, textarea), el name viaja en el hijo
  // y no en Campo, así que hay que leerlo de ahí para poder ligar la etiqueta.
  const campoId = id || props.name || (isValidElement(children) ? children.props.name : undefined);
  const errorId = error ? `${campoId}-error` : undefined;

  // Cuando el control viene como hijo (select, textarea), hay que pasarle el id
  // igual: si no, el htmlFor del label apunta a un elemento que no existe y ni
  // el clic en la etiqueta ni el lector de pantalla funcionan.
  const control =
    isValidElement(children) && !children.props.id
      ? cloneElement(children, {
          id: campoId,
          'aria-invalid': error ? true : undefined,
          'aria-describedby': errorId,
        })
      : children;

  return (
    <div className="campo">
      {label && <label htmlFor={campoId}>{label}</label>}
      {control ?? (
        <input id={campoId} aria-invalid={Boolean(error)} aria-describedby={errorId} {...props} />
      )}
      {ayuda && !error && <span className="campo-ayuda">{ayuda}</span>}
      {error && (
        <span className="campo-error" id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

/**
 * Campo de contraseña con botón de ver/ocultar y medidor de fuerza opcional.
 * El toggle importa en móvil, donde escribir a ciegas una contraseña larga
 * es la razón principal por la que la gente elige contraseñas cortas.
 */
export function CampoPassword({ label, error, ayuda, medidor, name = 'password', ...props }) {
  const [visible, setVisible] = useState(false);
  const fuerza = medidor ? fuerzaPassword(props.value || '') : null;
  const errorId = error ? `${name}-error` : undefined;

  return (
    <div className="campo">
      {label && <label htmlFor={name}>{label}</label>}

      <div className="campo-con-boton">
        <input
          id={name}
          name={name}
          type={visible ? 'text' : 'password'}
          aria-invalid={Boolean(error)}
          aria-describedby={errorId}
          {...props}
        />
        <button
          type="button"
          className="campo-boton"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          title={visible ? 'Ocultar' : 'Mostrar'}
        >
          <Icono nombre={visible ? 'ojoTachado' : 'ojo'} tamano={17} />
        </button>
      </div>

      {medidor && props.value && (
        <div className="medidor">
          <div className="medidor-barras" aria-hidden="true">
            {[1, 2, 3, 4].map((n) => (
              <span key={n} className={`medidor-barra ${n <= fuerza.nivel ? fuerza.color : ''}`} />
            ))}
          </div>
          <span className="campo-ayuda">
            <strong>{fuerza.etiqueta}</strong>
            {fuerza.consejo ? ` — ${fuerza.consejo}` : ''}
          </span>
        </div>
      )}

      {ayuda && !error && !(medidor && props.value) && <span className="campo-ayuda">{ayuda}</span>}
      {error && (
        <span className="campo-error" id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

/**
 * Diálogo modal. Cierra con Escape o clic en el fondo, bloquea el scroll de
 * atrás y devuelve el foco al elemento que lo abrió.
 */
export function Modal({ abierto, onCerrar, titulo, children, ancho = 520 }) {
  const cajaRef = useRef(null);
  const focoPrevio = useRef(null);
  const tituloId = useId();

  useEffect(() => {
    if (!abierto) return undefined;

    focoPrevio.current = document.activeElement;
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const alTeclear = (e) => {
      if (e.key === 'Escape') onCerrar();
    };
    document.addEventListener('keydown', alTeclear);

    // Foco al primer control del diálogo, no al fondo.
    const primero = cajaRef.current?.querySelector(
      'input, select, textarea, button:not([data-cerrar])'
    );
    primero?.focus();

    return () => {
      document.removeEventListener('keydown', alTeclear);
      document.body.style.overflow = overflowPrevio;
      focoPrevio.current?.focus?.();
    };
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  return (
    <div className="modal-fondo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div
        className="modal-caja"
        style={{ maxWidth: ancho }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        ref={cajaRef}
      >
        <div className="modal-encabezado">
          <h3 id={tituloId}>{titulo}</h3>
          <button
            type="button"
            className="boton fantasma chico"
            onClick={onCerrar}
            data-cerrar
            aria-label="Cerrar"
          >
            <Icono nombre="cerrar" tamano={16} />
          </button>
        </div>
        <div className="modal-cuerpo">{children}</div>
      </div>
    </div>
  );
}

/** Confirmación destructiva sin usar window.confirm (que no se puede estilizar). */
export function ModalConfirmar({ abierto, onCerrar, onConfirmar, titulo, mensaje, textoConfirmar = 'Eliminar' }) {
  const [procesando, setProcesando] = useState(false);

  const confirmar = async () => {
    setProcesando(true);
    try {
      await onConfirmar();
      onCerrar();
    } finally {
      setProcesando(false);
    }
  };

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={titulo} ancho={420}>
      <p className="suave">{mensaje}</p>
      <div className="modal-acciones">
        <Boton variante="secundario" onClick={onCerrar}>
          Cancelar
        </Boton>
        <Boton variante="peligro" onClick={confirmar} cargando={procesando}>
          {textoConfirmar}
        </Boton>
      </div>
    </Modal>
  );
}

export function Tarjeta({ titulo, accion, children, className = '', ...props }) {
  return (
    <section className={`tarjeta ${className}`} {...props}>
      {(titulo || accion) && (
        <div className="tarjeta-titulo">
          {typeof titulo === 'string' ? <h3>{titulo}</h3> : titulo}
          {accion}
        </div>
      )}
      {children}
    </section>
  );
}

export function Insignia({ color = '', children }) {
  return <span className={`insignia ${color}`}>{children}</span>;
}

export function Aviso({ tipo = 'info', titulo, children }) {
  const iconos = { error: 'alerta', exito: 'palomita', alerta: 'alerta', info: 'info' };
  return (
    <div className={`aviso ${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>
      <Icono nombre={iconos[tipo]} tamano={18} className="aviso-icono" />
      <div>
        {titulo && <strong>{titulo}</strong>}
        {children}
      </div>
    </div>
  );
}

export function Cargando({ texto = 'Cargando...' }) {
  return (
    <div className="cargando">
      <span className="spinner" />
      <span>{texto}</span>
    </div>
  );
}

export function Esqueleto({ alto = 16, ancho = '100%', style }) {
  return <div className="esqueleto" style={{ height: alto, width: ancho, ...style }} />;
}

export function Vacio({ icono = '🧭', titulo, children, accion }) {
  return (
    <div className="vacio">
      <span className="vacio-icono" aria-hidden="true">
        {icono}
      </span>
      <h3>{titulo}</h3>
      {children && <p>{children}</p>}
      {accion}
    </div>
  );
}

/**
 * Muestra el error de una peticion sin dejar la pantalla en blanco,
 * con un boton para reintentar cuando aplica.
 */
export function ErrorCarga({ error, onReintentar, contexto }) {
  const esRed = error?.status === 0;
  const esServicio = error?.status === 503;

  return (
    <Aviso tipo={esServicio ? 'alerta' : 'error'} titulo={contexto || 'Algo salio mal'}>
      <p style={{ margin: '2px 0 0' }}>{error?.message || 'Error inesperado.'}</p>
      {Array.isArray(error?.details) && error.details.length > 0 && (
        <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
          {error.details.map((d, i) => (
            <li key={i}>{d.message}</li>
          ))}
        </ul>
      )}
      {onReintentar && (
        <div style={{ marginTop: 10 }}>
          <Boton variante="secundario" chico onClick={onReintentar}>
            {esRed ? 'Reintentar conexion' : 'Reintentar'}
          </Boton>
        </div>
      )}
    </Aviso>
  );
}
