import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authApi, despertarServidor } from '../api/index.js';
import useFormulario from '../hooks/useFormulario.js';
import { reglas } from '../utils/validacion.js';
import { Boton, Campo, Aviso } from '../components/ui.jsx';
import Captcha from '../components/Captcha.jsx';

const CAPTCHA_ACTIVO = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY);

/**
 * Pedir el enlace de recuperación.
 *
 * La pantalla de éxito dice lo mismo exista o no la cuenta, igual que el
 * backend. Si dijera "no encontramos ese correo", esta página se convertiría en
 * un buscador de direcciones registradas para quien quiera hacer phishing.
 */
export default function Recuperar() {
  const { t } = useTranslation('auth');
  useEffect(() => {
    despertarServidor();
  }, []);

  const [enviado, setEnviado] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');

  const form = useFormulario({ email: '' }, { email: reglas.email });

  const pedir = form.enviar(async (valores) => {
    await authApi.forgotPassword({ ...valores, turnstileToken });
    setEnviado(true);
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
          <h1 style={{ fontSize: '1.35rem' }}>{t('recuperar.titulo')}</h1>
          <p>{t('recuperar.texto')}</p>
        </div>

        {enviado ? (
          <div className="pila">
            <Aviso tipo="exito" titulo={t('recuperar.revisaTuCorreo')}>
              {t('recuperar.revisaTuCorreoTexto')}
            </Aviso>
            <p className="tenue" style={{ margin: 0, fontSize: '0.85rem' }}>
              {t('recuperar.noLlega')}
            </p>
            <Boton variante="secundario" ancho onClick={() => setEnviado(false)}>
              {t('recuperar.probarOtroCorreo')}
            </Boton>
          </div>
        ) : (
          <form onSubmit={pedir} className="pila" noValidate>
            {form.errorServidor && <Aviso tipo="error">{form.errorServidor.mensaje}</Aviso>}

            <Campo
              label={t('recuperar.email')}
              type="email"
              autoComplete="email"
              placeholder="tu@email.com"
              autoFocus
              {...form.props('email')}
            />

            <Captcha onToken={setTurnstileToken} />

            <Boton
              type="submit"
              ancho
              cargando={form.enviando}
              disabled={CAPTCHA_ACTIVO && !turnstileToken}
            >
              {form.enviando ? t('recuperar.enviando') : t('recuperar.enviarEnlace')}
            </Boton>
          </form>
        )}

        <p className="auth-pie">
          <Link to="/entrar">{t('recuperar.volverAIniciar')}</Link>
        </p>
      </div>
    </div>
  );
}
