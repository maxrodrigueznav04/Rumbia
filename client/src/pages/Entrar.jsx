import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import { despertarServidor } from '../api/index.js';
import useFormulario from '../hooks/useFormulario.js';
import { useMetaPagina } from '../hooks/useMetaPagina.js';
import { reglas } from '../utils/validacion.js';
import { Boton, Campo, CampoPassword, Aviso } from '../components/ui.jsx';

export default function Entrar() {
  const { t } = useTranslation('auth');
  useMetaPagina({
    titulo: t('entrar.meta.titulo'),
    descripcion: t('entrar.meta.descripcion'),
    ruta: '/entrar',
  });

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
            Rumbia
          </div>
          <h1 style={{ fontSize: '1.35rem' }}>{t('entrar.titulo')}</h1>
          <p>{t('entrar.texto')}</p>
        </div>

        <form onSubmit={entrar} className="pila" noValidate>
          {sesionExpirada && !form.errorServidor && (
            <Aviso tipo="alerta">{t('entrar.sesionExpirada')}</Aviso>
          )}
          {form.errorServidor && <Aviso tipo="error">{form.errorServidor.mensaje}</Aviso>}

          <Campo
            label={t('entrar.email')}
            type="email"
            autoComplete="email"
            placeholder="tu@email.com"
            autoFocus
            {...form.props('email')}
          />

          <CampoPassword
            label={t('entrar.contrasena')}
            autoComplete="current-password"
            placeholder="••••••••"
            {...form.props('password')}
          />

          <Boton type="submit" ancho cargando={form.enviando}>
            {form.enviando ? t('entrar.entrando') : t('entrar.entrar')}
          </Boton>
        </form>

        <p className="auth-pie" style={{ marginBottom: 0 }}>
          <Link to="/recuperar">{t('entrar.olvidasteContrasena')}</Link>
        </p>

        <p className="auth-pie">
          {t('entrar.noTienesCuenta')} <Link to="/registro">{t('entrar.creaUnaGratis')}</Link>
        </p>

        <div className="demo-caja">
          <strong>{t('entrar.cuentaDemo')}</strong>
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
            {t('entrar.llenarDemo')}
          </Boton>
        </div>
      </div>
    </div>
  );
}
