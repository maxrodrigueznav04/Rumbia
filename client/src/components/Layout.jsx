import { NavLink, Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Boton } from './ui.jsx';

const enlaces = [
  { to: '/viajes', texto: 'Mis viajes', icono: '🧳' },
  { to: '/viajes/nuevo', texto: 'Nuevo viaje', icono: '➕' },
  { to: '/perfil', texto: 'Perfil', icono: '👤' },
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
              ✦
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

      {/* Navegacion inferior: el patron que la gente espera en el celular. */}
      <nav className="tabbar" aria-label="Navegacion movil">
        {enlaces.map((e) => (
          <NavLink
            key={e.to}
            to={e.to}
            end={e.to === '/viajes'}
            className={({ isActive }) => (isActive ? 'activo' : '')}
          >
            <span aria-hidden="true">{e.icono}</span>
            {e.texto}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
