import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { despertarServidor } from '../api/index.js';
import useFormulario from '../hooks/useFormulario.js';
import { reglas } from '../utils/validacion.js';
import { Boton, Campo, CampoPassword, Aviso } from '../components/ui.jsx';

export default function Entrar() {
  // Render duerme el plan gratuito: se despierta mientras el usuario escribe,
  // asi el login no carga con los ~50 s del arranque en frio.
  useEffect(() => {
    despertarServidor();
  }, []);

  const { login, sesionExpirada } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const form = useFormulario(
    { email: '', password: '' },
    { email: reglas.email, password: reglas.passwordLogin }
  );

  const entrar = form.enviar(async (valores) => {
    await login(valores);
    // Vuelve a donde el usuario quería ir antes de que lo mandaran al login.
    navigate(location.state?.desde || '/viajes', { replace: true });
  });

  return (
    <div className="auth-pantalla">
      <div className="auth-caja">
        <div className="auth-encabezado">
          <div className="marca" style={{ justifyContent: 'center', marginBottom: 10 }}>
            <span className="marca-punto" aria-hidden="true">
              R
            </span>
            Rumbo
          </div>
          <h1 style={{ fontSize: '1.35rem' }}>Bienvenido de vuelta</h1>
          <p>Tus viajes te están esperando.</p>
        </div>

        <form onSubmit={entrar} className="pila" noValidate>
          {sesionExpirada && !form.errorServidor && (
            <Aviso tipo="alerta">Tu sesión expiró por seguridad. Entra de nuevo para continuar.</Aviso>
          )}
          {form.errorServidor && <Aviso tipo="error">{form.errorServidor.mensaje}</Aviso>}

          <Campo
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="tu@email.com"
            autoFocus
            {...form.props('email')}
          />

          <CampoPassword
            label="Contraseña"
            autoComplete="current-password"
            placeholder="••••••••"
            {...form.props('password')}
          />

          <Boton type="submit" ancho cargando={form.enviando}>
            {form.enviando ? 'Entrando...' : 'Entrar'}
          </Boton>
        </form>

        <p className="auth-pie">
          ¿No tienes cuenta? <Link to="/registro">Crea una gratis</Link>
        </p>

        <div className="demo-caja">
          <strong>Cuenta de demostración</strong>
          <div style={{ marginTop: 4 }}>
            <code>demo@rumbo.app</code> / <code>demo1234</code>
          </div>
          <Boton
            variante="secundario"
            chico
            ancho
            style={{ marginTop: 10 }}
            onClick={() => {
              form.fijar('email', 'demo@rumbo.app');
              form.fijar('password', 'demo1234');
            }}
          >
            Llenar con la cuenta demo
          </Boton>
        </div>
      </div>
    </div>
  );
}
