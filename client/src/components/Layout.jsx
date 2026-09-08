import { useEffect, useState } from 'react';
import { NavLink, Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import { useTema } from '../hooks/useTema.js';
import { Aviso, Boton } from './ui.jsx';
import Icono from './Icono.jsx';
import ChatFlotante from './ChatFlotante.jsx';
import AvisoVerificarCorreo from './AvisoVerificarCorreo.jsx';
import SelectorIdioma from './SelectorIdioma.jsx';
import { CORREO_SOPORTE, ENLACE_WHATSAPP } from '../config/contacto.js';

// Las claves (to/icono) son fijas; el texto se resuelve con t() adentro del
// componente -- un arreglo modulo-level no puede llamar al hook de traduccion.
const ENLACES = [
  { to: '/viajes', clave: 'misViajes', icono: 'maleta' },
  { to: '/clientes', clave: 'clientes', icono: 'persona' },
  { to: '/viajes/nuevo', clave: 'nuevoViaje', icono: 'mas' },
  { to: '/plantillas', clave: 'plantillas', icono: 'recibo' },
  { to: '/perfil', clave: 'perfil', icono: 'persona' },
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
  const { t } = useTranslation('layout');
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);
  const [errorSalir, setErrorSalir] = useState(null);
  const [saliendo, setSaliendo] = useState(false);
  const rol = user?.agency
    ? (String(user.agency.owner) === String(user._id) ? t('roles.dueno') : t('roles.agente'))
    : user?.preferences?.perfilUso === 'personal' ? t('roles.viajero') : t('roles.agenteIndependiente');

  const cerrarSesion = async () => {
    setSaliendo(true);
    setErrorSalir(null);
    try { await logout(); navigate('/entrar', { replace: true }); }
    catch (err) { setErrorSalir(err.message); }
    finally { setSaliendo(false); }
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

          <nav className="nav-links" aria-label={t('nav.ariaPrincipal')}>
            {ENLACES.map((e) => (
              <NavLink
                key={e.to}
                to={e.to}
                end={e.to === '/viajes'}
                className={({ isActive }) => `nav-link ${isActive ? 'activo' : ''}`}
              >
                {t(`nav.${e.clave}`)}
              </NavLink>
            ))}
          </nav>

          <div className="fila" style={{ gap: 6 }}>
            <Link to="/perfil" className="identidad-sesion" title={user?.email}>
              <strong>{user?.name}</strong>
              <span>{user?.agency?.agencyName || t('miEspacio')} · {rol}</span>
            </Link>
            <SelectorIdioma />
            <ToggleTema />
            <Boton variante="fantasma" chico onClick={cerrarSesion} cargando={saliendo}>
              {t('salir')}
            </Boton>
          </div>
        </div>
      </header>

      <main className="contenedor pagina">
        {user && !user.emailVerified && <AvisoVerificarCorreo />}
        {errorSalir && <Aviso tipo="error">{errorSalir}</Aviso>}
        <div key={location.pathname}><Outlet /></div>
      </main>

      <footer className="pie">
        <div className="contenedor">
          <p className="tenue">{t('pie.aviso')}</p>
          <p className="tenue">
            {t('pie.contactoIntro')}{' '}
            <a href={`mailto:${CORREO_SOPORTE}`}>{CORREO_SOPORTE}</a> {t('pie.contactoOPor')}{' '}
            <a href={ENLACE_WHATSAPP} target="_blank" rel="noopener noreferrer">
              {t('pie.whatsapp')}
            </a>
            .
          </p>
          <nav className="pie-enlaces" aria-label={t('pie.ariaEnlaces')}>
            <Link to="/acerca">{t('comun:piePagina.acercaDe')}</Link>
            <Link to="/privacidad">{t('comun:piePagina.privacidad')}</Link>
            <Link to="/cookies">{t('comun:piePagina.cookies')}</Link>
            <Link to="/terminos">{t('comun:piePagina.terminos')}</Link>
          </nav>
        </div>
      </footer>

      {/* Navegacion inferior: el patron que la gente espera en el celular. */}
      <nav className="tabbar" aria-label={t('nav.ariaMovil')}>
        {ENLACES.map((e) => (
          <NavLink
            key={e.to}
            to={e.to}
            end={e.to === '/viajes'}
            className={({ isActive }) => (isActive ? 'activo' : '')}
          >
            <Icono nombre={e.icono} tamano={20} />
            {t(`nav.${e.clave}`)}
          </NavLink>
        ))}
      </nav>

      {/* Un solo chat, disponible en toda la app: dentro de un viaje habla
          de ese viaje, en cualquier otra pantalla arranca en modo general. */}
      <ChatFlotante />
    </>
  );
}
