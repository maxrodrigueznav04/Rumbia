import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { authApi } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Aviso, Cargando } from '../components/ui.jsx';

/**
 * Confirma el correo con el token del enlace que manda register().
 *
 * Sin RutaPublica ni RutaProtegida a propósito, mismo criterio que
 * Restablecer.jsx: quien abre el enlace puede o no tener sesión en ESTE
 * navegador (lo normal es que sí, register() ya la deja puesta, pero puede
 * abrirlo desde el teléfono sin haber iniciado sesión ahí).
 */
export default function VerificarCorreo() {
  const { token } = useParams();
  const { actualizarUsuario } = useAuth();
  const [estado, setEstado] = useState('cargando'); // cargando | exito | error
  const [mensaje, setMensaje] = useState('');
  // El efecto puede correr dos veces en desarrollo (StrictMode): un token de
  // un solo uso tronaria la segunda llamada con "ya no sirve" aunque la
  // primera si funciono. Se manda una sola vez de verdad por token.
  const yaEnviado = useRef(false);

  useEffect(() => {
    if (yaEnviado.current) return;
    yaEnviado.current = true;

    let cancelado = false;
    authApi
      .verifyEmail({ token })
      .then(() => {
        if (cancelado) return;
        actualizarUsuario({ emailVerified: true });
        setEstado('exito');
      })
      .catch((err) => {
        if (cancelado) return;
        setMensaje(err.message);
        setEstado('error');
      });

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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
          <h1 style={{ fontSize: '1.35rem' }}>Verificar tu correo</h1>
        </div>

        {estado === 'cargando' && <Cargando texto="Verificando..." />}

        {estado === 'exito' && (
          <>
            <Aviso tipo="exito">
              Tu correo quedó verificado. Ya puedes generar itinerarios con IA, usar el chat y crear
              una agencia.
            </Aviso>
            <p className="auth-pie">
              <Link to="/viajes">Ir a mis viajes</Link>
            </p>
          </>
        )}

        {estado === 'error' && (
          <>
            <Aviso tipo="error">{mensaje}</Aviso>
            <p className="auth-pie">
              Inicia sesión y pide un enlace nuevo desde el aviso en la parte de arriba, o{' '}
              <Link to="/entrar">vuelve a iniciar sesión</Link>.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
