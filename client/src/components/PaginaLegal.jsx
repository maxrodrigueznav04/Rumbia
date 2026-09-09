import { Link, NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Aviso } from './ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useMetaPagina } from '../hooks/useMetaPagina.js';
import { formatoFecha } from '../utils/format.js';
import { ULTIMA_ACTUALIZACION, FALTAN_DATOS } from '../config/legal.js';

/**
 * Marco compartido de los documentos legales.
 *
 * Van fuera de <Layout> porque tienen que abrirse sin sesión: alguien que
 * todavía no se registra necesita poder leerlos antes de dar sus datos.
 * Por eso traen su propio encabezado en lugar de la navegación de la app.
 */
export default function PaginaLegal({ titulo, entrada, children }) {
  const { t } = useTranslation(['paginaLegal', 'comun']);
  const { autenticado } = useAuth();
  const { pathname } = useLocation();
  useMetaPagina({ titulo, descripcion: entrada, ruta: pathname });

  return (
    <div className="legal">
      <header className="legal-nav">
        <div className="contenedor fila-entre">
          <Link to={autenticado ? '/viajes' : '/entrar'} className="marca">
            <span className="marca-punto" aria-hidden="true">
              R
            </span>
            Rumbia
          </Link>
          <Link to={autenticado ? '/viajes' : '/entrar'} className="volver">
            {autenticado ? t('paginaLegal:volverAMisViajes') : t('paginaLegal:irAEntrar')}
          </Link>
        </div>
      </header>

      <main className="contenedor legal-cuerpo">
        <span className="etiqueta">{t('paginaLegal:etiqueta')}</span>
        <h1>{titulo}</h1>
        <p className="tenue">
          {t('paginaLegal:ultimaActualizacion', { fecha: formatoFecha(ULTIMA_ACTUALIZACION, { month: 'long' }) })}
        </p>

        {FALTAN_DATOS && (
          <Aviso tipo="alerta" titulo={t('paginaLegal:faltanDatos.titulo')}>
            <span dangerouslySetInnerHTML={{ __html: t('paginaLegal:faltanDatos.texto') }} />
          </Aviso>
        )}

        {entrada && <p className="legal-entrada">{entrada}</p>}

        <div className="prosa">{children}</div>

        <nav className="legal-pie" aria-label={t('paginaLegal:enlacesDelSitio')}>
          <NavLink to="/acerca">{t('comun:piePagina.acercaDe')}</NavLink>
          <NavLink to="/privacidad">{t('comun:piePagina.privacidad')}</NavLink>
          <NavLink to="/cookies">{t('comun:piePagina.cookies')}</NavLink>
          <NavLink to="/terminos">{t('comun:piePagina.terminos')}</NavLink>
        </nav>
      </main>
    </div>
  );
}
