import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
            Rumbo
          </div>
          <h1 style={{ fontSize: '1.35rem' }}>Recupera tu cuenta</h1>
          <p>Te mandamos un enlace para elegir una contraseña nueva.</p>
        </div>

        {enviado ? (
          <div className="pila">
            <Aviso tipo="exito" titulo="Revisa tu correo">
              Si esa dirección tiene una cuenta, ya va en camino un enlace para recuperarla. Caduca
              en 30 minutos y sirve una sola vez.
            </Aviso>
            <p className="tenue" style={{ margin: 0, fontSize: '0.85rem' }}>
              ¿No llega? Mira en spam, y comprueba que escribiste la dirección con la que te
              registraste.
            </p>
            <Boton variante="secundario" ancho onClick={() => setEnviado(false)}>
              Probar con otro correo
            </Boton>
          </div>
        ) : (
          <form onSubmit={pedir} className="pila" noValidate>
            {form.errorServidor && <Aviso tipo="error">{form.errorServidor.mensaje}</Aviso>}

            <Campo
              label="Email"
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
              {form.enviando ? 'Enviando...' : 'Enviar enlace'}
            </Boton>
          </form>
        )}

        <p className="auth-pie">
          <Link to="/entrar">Volver a iniciar sesión</Link>
        </p>
      </div>
    </div>
  );
}
