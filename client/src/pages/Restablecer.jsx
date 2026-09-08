import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import { despertarServidor } from '../api/index.js';
import useFormulario from '../hooks/useFormulario.js';
import { reglas } from '../utils/validacion.js';
import { Boton, CampoPassword, Aviso } from '../components/ui.jsx';

/**
 * Elegir la contraseña nueva con el token del correo.
 *
 * Esta ruta NO va envuelta en RutaPublica a propósito. Quien pide recuperar la
 * contraseña puede tener todavía una sesión abierta en el navegador — es
 * justamente el caso de "se metió alguien más" —, y RutaPublica lo mandaría al
 * panel sin dejarlo restablecer nada.
 */
export default function Restablecer() {
  const { t } = useTranslation('auth');
  const { token } = useParams();
  const { restablecer } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    despertarServidor();
  }, []);

  const form = useFormulario(
    { password: '', repetir: '' },
    {
      password: reglas.password,
      repetir: (valor, todos) =>
        valor === todos.password ? null : t('restablecer.noCoinciden'),
    }
  );

  const guardar = form.enviar(async (valores) => {
    await restablecer({ token, password: valores.password });
    navigate('/viajes', { replace: true });
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
          <h1 style={{ fontSize: '1.35rem' }}>{t('restablecer.titulo')}</h1>
          <p>{t('restablecer.texto')}</p>
        </div>

        <form onSubmit={guardar} className="pila" noValidate>
          {form.errorServidor && (
            <Aviso tipo="error">
              {form.errorServidor.mensaje}
              {form.errorServidor.status === 400 && (
                <>
                  {' '}
                  <Link to="/recuperar">{t('restablecer.pedirEnlaceNuevo')}</Link>.
                </>
              )}
            </Aviso>
          )}

          <CampoPassword
            label={t('restablecer.contrasenaNueva')}
            autoComplete="new-password"
            placeholder={t('restablecer.alMenos8')}
            autoFocus
            {...form.props('password')}
          />

          <CampoPassword
            label={t('restablecer.repitela')}
            autoComplete="new-password"
            placeholder="••••••••"
            {...form.props('repetir')}
          />

          <Boton type="submit" ancho cargando={form.enviando}>
            {form.enviando ? t('restablecer.guardando') : t('restablecer.guardarYEntrar')}
          </Boton>
        </form>

        <p className="auth-pie">
          <Link to="/entrar">{t('restablecer.volverAIniciar')}</Link>
        </p>
      </div>
    </div>
  );
}
