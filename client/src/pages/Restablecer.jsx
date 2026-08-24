import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
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
        valor === todos.password ? null : 'Las dos contraseñas no coinciden.',
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
            Rumbo
          </div>
          <h1 style={{ fontSize: '1.35rem' }}>Elige una contraseña nueva</h1>
          <p>Al guardarla entras directo, y se cierran las demás sesiones.</p>
        </div>

        <form onSubmit={guardar} className="pila" noValidate>
          {form.errorServidor && (
            <Aviso tipo="error">
              {form.errorServidor.mensaje}
              {form.errorServidor.status === 400 && (
                <>
                  {' '}
                  <Link to="/recuperar">Pedir un enlace nuevo</Link>.
                </>
              )}
            </Aviso>
          )}

          <CampoPassword
            label="Contraseña nueva"
            autoComplete="new-password"
            placeholder="Al menos 8 caracteres"
            autoFocus
            {...form.props('password')}
          />

          <CampoPassword
            label="Repítela"
            autoComplete="new-password"
            placeholder="••••••••"
            {...form.props('repetir')}
          />

          <Boton type="submit" ancho cargando={form.enviando}>
            {form.enviando ? 'Guardando...' : 'Guardar y entrar'}
          </Boton>
        </form>

        <p className="auth-pie">
          <Link to="/entrar">Volver a iniciar sesión</Link>
        </p>
      </div>
    </div>
  );
}
