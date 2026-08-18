import { Component } from 'react';

/**
 * Atrapa errores de render para que un fallo en una pantalla no deje la app en
 * blanco. React solo permite hacer esto con un componente de clase.
 *
 * No sustituye al manejo de errores de las peticiones (eso lo hace ErrorCarga):
 * esto es la red de seguridad para lo que nadie previó.
 */
export default class LimiteDeError extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // En un proyecto real aquí iría el reporte a Sentry o similar.
    console.error('[render]', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="auth-pantalla">
        <div className="auth-caja centrado">
          <span style={{ fontSize: '2.4rem' }} aria-hidden="true">
            🧭
          </span>
          <h1 style={{ fontSize: '1.25rem', marginTop: 10 }}>Se nos perdió el rumbo</h1>
          <p className="suave">
            Algo falló al dibujar esta pantalla. Tus viajes están a salvo: nada se guardó a medias.
          </p>

          <div className="fila" style={{ justifyContent: 'center', marginTop: 16 }}>
            <button className="boton" onClick={() => window.location.assign('/viajes')}>
              Ir a mis viajes
            </button>
            <button className="boton secundario" onClick={() => window.location.reload()}>
              Recargar
            </button>
          </div>

          {import.meta.env.DEV && (
            <details style={{ marginTop: 18, textAlign: 'left' }}>
              <summary className="campo-ayuda" style={{ cursor: 'pointer' }}>
                Detalle del error (solo en desarrollo)
              </summary>
              <pre
                style={{
                  fontSize: '0.72rem',
                  overflowX: 'auto',
                  background: 'var(--surface-alt)',
                  padding: 10,
                  borderRadius: 8,
                  marginTop: 8,
                }}
              >
                {error.message}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}
