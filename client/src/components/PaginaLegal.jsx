import { Link, NavLink } from 'react-router-dom';
import { Aviso } from './ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { ULTIMA_ACTUALIZACION, FALTAN_DATOS } from '../config/legal.js';

/**
 * Marco compartido de los documentos legales.
 *
 * Van fuera de <Layout> porque tienen que abrirse sin sesión: alguien que
 * todavía no se registra necesita poder leerlos antes de dar sus datos.
 * Por eso traen su propio encabezado en lugar de la navegación de la app.
 */
export default function PaginaLegal({ titulo, entrada, children }) {
  const { autenticado } = useAuth();

  return (
    <div className="legal">
      <header className="legal-nav">
        <div className="contenedor fila-entre">
          <Link to={autenticado ? '/viajes' : '/entrar'} className="marca">
            <span className="marca-punto" aria-hidden="true">
              R
            </span>
            Rumbo
          </Link>
          <Link to={autenticado ? '/viajes' : '/entrar'} className="volver">
            {autenticado ? 'Volver a mis viajes' : 'Ir a entrar'}
          </Link>
        </div>
      </header>

      <main className="contenedor legal-cuerpo">
        <span className="etiqueta">Documento legal</span>
        <h1>{titulo}</h1>
        <p className="tenue">Última actualización: {ULTIMA_ACTUALIZACION}</p>

        {FALTAN_DATOS && (
          <Aviso tipo="alerta" titulo="Falta completar los datos de contacto">
            Este documento todavía trae marcadores en el nombre del responsable y en el correo de
            contacto. Hay que sustituirlos en <code>client/src/config/legal.js</code> antes de
            publicarlo.
          </Aviso>
        )}

        {entrada && <p className="legal-entrada">{entrada}</p>}

        <div className="prosa">{children}</div>

        <nav className="legal-pie" aria-label="Otros documentos">
          <NavLink to="/privacidad">Política de privacidad</NavLink>
          <NavLink to="/cookies">Cookies y rastreo</NavLink>
        </nav>
      </main>
    </div>
  );
}
