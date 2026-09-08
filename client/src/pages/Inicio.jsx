import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import Icono from '../components/Icono.jsx';
import SelectorIdioma from '../components/SelectorIdioma.jsx';
import { CORREO_SOPORTE, ENLACE_WHATSAPP } from '../config/contacto.js';

/**
 * Portada pública.
 *
 * Antes traía el generador de prueba montado aquí mismo, pero eso mezclaba
 * dos cosas distintas: explicar qué es Rumbia y dejar jugar con una muestra
 * deliberadamente simple del producto (sin presupuesto, sin clima, sin
 * guardar nada) -- quien apenas llega podía quedarse con la idea de que eso
 * es todo lo que hace la app. Ahora la portada es corta a propósito: hero +
 * lo esencial, con un enlace directo a /probar para quien quiere jugar sin
 * cuenta y a /acerca para quien quiere ver todo lo que incluye (viajeros y
 * agencias, planes, CRM, plantillas...) antes de decidirse.
 */
export default function Inicio() {
  const { t } = useTranslation('inicio');
  const { autenticado, cargando } = useAuth();

  // Con sesión no tiene sentido la portada: se va a sus viajes.
  if (cargando) return null;
  if (autenticado) return <Navigate to="/viajes" replace />;

  return (
    <div className="inicio">
      <header className="inicio-nav">
        <div className="contenedor fila-entre">
          <span className="marca">
            <span className="marca-punto" aria-hidden="true">
              R
            </span>
            Rumbia
          </span>
          <div className="fila" style={{ gap: 8, alignItems: 'center' }}>
            <SelectorIdioma />
            <Link to="/acerca" className="boton fantasma chico">
              {t('comun:piePagina.acercaDe')}
            </Link>
            <Link to="/entrar" className="boton secundario chico">
              {t('comun:nav.entrar')}
            </Link>
            <Link to="/registro" className="boton chico">
              {t('comun:nav.crearCuenta')}
            </Link>
          </div>
        </div>
      </header>

      <section className="inicio-hero">
        <div className="contenedor">
          <h1>{t('hero.titulo')}</h1>
          <p>{t('hero.texto')}</p>
          <div className="fila inicio-hero-acciones">
            <Link to="/registro" className="boton">
              {t('hero.comenzarGratis')}
            </Link>
            <Link to="/probar" className="boton secundario">
              {t('hero.probarloSinCuenta')}
            </Link>
          </div>
          <p className="inicio-hero-confianza">
            <Icono nombre="palomita" tamano={14} />
            {t('hero.sinTarjeta')}
          </p>
        </div>
      </section>

      <section className="inicio-intro">
        <div className="contenedor">
          <p className="inicio-eyebrow">{t('intro.eyebrow')}</p>
          <div className="inicio-puntos">
            {[
              ['chispa', 'itinerario'],
              ['pin', 'mapaClima'],
              ['recibo', 'presupuesto'],
            ].map(([icono, clave]) => (
              <div key={clave} className="inicio-punto">
                <span className="inicio-punto-icono">
                  <Icono nombre={icono} tamano={22} />
                </span>
                <h3>{t(`intro.${clave}.titulo`)}</h3>
                <p className="suave">{t(`intro.${clave}.texto`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="inicio-perfiles">
        <div className="contenedor">
          <p className="inicio-eyebrow">{t('perfiles.eyebrow')}</p>
          <div className="rejilla rejilla-2" style={{ gap: 'var(--e5)' }}>
            <div className="tarjeta">
              <div className="fila" style={{ gap: 8, marginBottom: 10 }}>
                <Icono nombre="brujula" tamano={20} className="icono-seccion" />
                <h3 style={{ margin: 0 }}>{t('perfiles.viajeros.titulo')}</h3>
              </div>
              <p className="suave" style={{ margin: '0 0 10px' }}>
                {t('perfiles.viajeros.texto')}
              </p>
              <ul className="pila-sm" style={{ paddingLeft: 18, margin: 0, fontSize: '0.92rem' }}>
                {t('perfiles.viajeros.puntos', { returnObjects: true }).map((punto) => (
                  <li key={punto}>{punto}</li>
                ))}
              </ul>
            </div>

            <div className="tarjeta">
              <div className="fila" style={{ gap: 8, marginBottom: 10 }}>
                <Icono nombre="maleta" tamano={20} className="icono-seccion" />
                <h3 style={{ margin: 0 }}>{t('perfiles.agencias.titulo')}</h3>
              </div>
              <p className="suave" style={{ margin: '0 0 10px' }}>
                {t('perfiles.agencias.texto')}
              </p>
              <ul className="pila-sm" style={{ paddingLeft: 18, margin: 0, fontSize: '0.92rem' }}>
                {t('perfiles.agencias.puntos', { returnObjects: true }).map((punto) => (
                  <li key={punto}>{punto}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="inicio-cierre">
        <div className="contenedor inicio-cierre-caja">
          <h2>{t('cierre.titulo')}</h2>
          <p className="suave">{t('cierre.texto')}</p>
          <Link to="/acerca" className="boton secundario">
            {t('cierre.boton')}
          </Link>
        </div>
      </section>

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
    </div>
  );
}
