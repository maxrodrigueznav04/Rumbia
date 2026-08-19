import { NavLink, Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Boton } from './ui.jsx';
import Icono from './Icono.jsx';

const enlaces = [
  { to: '/viajes', texto: 'Mis viajes', icono: 'maleta' },
  { to: '/viajes/nuevo', texto: 'Nuevo viaje', icono: 'mas' },
  { to: '/perfil', texto: 'Perfil', icono: 'persona' },
];

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
            Rumbo
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
            Rumbo no procesa reservas ni pagos. Los enlaces te llevan al sitio del proveedor, donde
            completas la reserva.
          </p>
          <nav className="pie-enlaces" aria-label="Enlaces legales">
            <Link to="/privacidad">Privacidad</Link>
            <Link to="/cookies">Cookies y rastreo</Link>
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
    </>
  );
}
