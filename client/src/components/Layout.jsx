import { NavLink, Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTema } from '../hooks/useTema.js';
import { Boton } from './ui.jsx';
import Icono from './Icono.jsx';
import ChatFlotante from './ChatFlotante.jsx';

const enlaces = [
  { to: '/viajes', texto: 'Mis viajes', icono: 'maleta' },
  { to: '/viajes/nuevo', texto: 'Nuevo viaje', icono: 'mas' },
  { to: '/plantillas', texto: 'Plantillas', icono: 'recibo' },
  { to: '/perfil', texto: 'Perfil', icono: 'persona' },
];

const ORDEN_TEMA = ['sistema', 'claro', 'oscuro'];
const ICONO_TEMA = { sistema: 'monitor', claro: 'sol', oscuro: 'luna' };
const ETIQUETA_TEMA = { sistema: 'Tema: siguiendo al sistema', claro: 'Tema: claro', oscuro: 'Tema: oscuro' };

/** Cicla sistema -> claro -> oscuro -> sistema. Un solo botón, sin menú, para no ocupar espacio del header. */
function ToggleTema() {
  const { tema, cambiarTema } = useTema();
  const siguiente = ORDEN_TEMA[(ORDEN_TEMA.indexOf(tema) + 1) % ORDEN_TEMA.length];

  return (
    <Boton
      variante="fantasma"
      chico
      onClick={() => cambiarTema(siguiente)}
      title={`${ETIQUETA_TEMA[tema]} · toca para cambiar a ${siguiente}`}
      aria-label={`${ETIQUETA_TEMA[tema]}. Cambiar a ${siguiente}`}
    >
      <Icono nombre={ICONO_TEMA[tema]} tamano={17} />
    </Boton>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const cerrarSesion = () => {
    logout();
    navigate('/entrar', { replace: true });
  };

  return (
    <>
      <header className="nav">
        <div className="contenedor nav-inner">
          <Link to="/viajes" className="marca">
            <span className="marca-punto" aria-hidden="true">
              R
            </span>
            Rumbia
          </Link>

          <nav className="nav-links" aria-label="Navegacion principal">
            {enlaces.map((e) => (
              <NavLink
                key={e.to}
                to={e.to}
                end={e.to === '/viajes'}
                className={({ isActive }) => `nav-link ${isActive ? 'activo' : ''}`}
              >
                {e.texto}
              </NavLink>
            ))}
          </nav>

          <div className="fila" style={{ gap: 6 }}>
            <span className="tenue" style={{ display: 'none' }} data-nombre>
              {user?.name}
            </span>
            <ToggleTema />
            <Boton variante="fantasma" chico onClick={cerrarSesion}>
              Salir
            </Boton>
          </div>
        </div>
      </header>

      <main className="contenedor pagina">
        <Outlet />
      </main>

      <footer className="pie">
        <div className="contenedor">
          <p className="tenue">
            Rumbia no procesa reservas ni pagos. Los enlaces te llevan al sitio del proveedor, donde
            completas la reserva.
          </p>
          <nav className="pie-enlaces" aria-label="Enlaces del sitio">
            <Link to="/acerca">Acerca de</Link>
            <Link to="/privacidad">Privacidad</Link>
            <Link to="/cookies">Cookies y rastreo</Link>
            <Link to="/terminos">Términos</Link>
          </nav>
        </div>
      </footer>

      {/* Navegacion inferior: el patron que la gente espera en el celular. */}
      <nav className="tabbar" aria-label="Navegacion movil">
        {enlaces.map((e) => (
          <NavLink
            key={e.to}
            to={e.to}
            end={e.to === '/viajes'}
            className={({ isActive }) => (isActive ? 'activo' : '')}
          >
            <Icono nombre={e.icono} tamano={20} />
            {e.texto}
          </NavLink>
        ))}
      </nav>

      {/* Un solo chat, disponible en toda la app: dentro de un viaje habla
          de ese viaje, en cualquier otra pantalla arranca en modo general. */}
      <ChatFlotante />
    </>
  );
}
