import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { tripsApi } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import useFetch from '../hooks/useFetch.js';
import useDebounce from '../hooks/useDebounce.js';
import TarjetaViaje from '../components/TarjetaViaje.jsx';
import { ReporteAgencia } from '../components/TarjetaAgencia.jsx';
import { Boton, Vacio, ErrorCarga, Esqueleto } from '../components/ui.jsx';
import Icono from '../components/Icono.jsx';
import { localeDeFecha } from '../utils/format.js';

const FILTROS = ['proximos', 'pasados', 'borrador', ''];
const CLAVES_FILTRO = { proximos: 'proximos', pasados: 'pasados', borrador: 'borrador', '': 'todos' };

// Embudo de ventas: en que va la propuesta con el cliente, no en que va el
// viaje en si (eso lo filtra FILTROS de arriba). Solo tiene sentido para
// quien cotiza para clientes.
const FILTROS_PROPUESTA = ['', 'borrador', 'enviada', 'aceptada', 'pagada', 'cancelada'];
const CLAVES_FILTRO_PROPUESTA = {
  '': 'cualquiera', borrador: 'sinEnviar', enviada: 'enviadas',
  aceptada: 'aceptadas', pagada: 'pagadas', cancelada: 'canceladas',
};

function EsqueletoTarjetas() {
  return (
    <div className="rejilla rejilla-2 rejilla-3">
      {[0, 1, 2].map((i) => (
        <div className="tarjeta" key={i}>
          <Esqueleto alto={14} ancho="35%" />
          <Esqueleto alto={22} ancho="75%" style={{ margin: '10px 0 8px' }} />
          <Esqueleto alto={14} ancho="55%" />
          <Esqueleto alto={30} style={{ marginTop: 14 }} />
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { t } = useTranslation('viajes');
  const { user } = useAuth();
  const esAgencia = user?.preferences?.perfilUso !== 'personal';
  const [filtro, setFiltro] = useState('proximos');
  const [filtroPropuesta, setFiltroPropuesta] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [atencion, setAtencion] = useState('');
  const [ambito, setAmbito] = useState('mios');
  const esDueno = user?.agency && String(user.agency.owner) === String(user._id);
  const panel = useFetch(({ signal }) => esAgencia ? tripsApi.panel({ signal }) : Promise.resolve(null), [esAgencia]);
  const verAtencion = (propuesta, estado, pendiente = '') => {
    setFiltroPropuesta(propuesta); setFiltro(estado); setAtencion(pendiente); setBusqueda(''); setPagina(1);
  };

  // Sin debounce se dispararía una petición por cada tecla.
  const consulta = useDebounce(busqueda.trim(), 350);

  // La API pagina de 20 en 20; el dashboard traía todo de golpe.
  const [pagina, setPagina] = useState(1);

  // Cambiar de filtro o de búsqueda reinicia la página: si estabas en la 3 y
  // el nuevo filtro solo tiene una, la vista quedaría vacía sin explicación.
  useEffect(() => {
    setPagina(1);
  }, [filtro, filtroPropuesta, consulta, atencion]);

  const { data, cargando, error, recargar } = useFetch(
    ({ signal }) =>
      tripsApi.list(
        {
          status: filtro || undefined,
          atencion: atencion || undefined,
          estadoPropuesta: filtroPropuesta || undefined,
          q: consulta || undefined,
          page: pagina,
        },
        { signal }
      ),
    [filtro, filtroPropuesta, consulta, pagina, atencion]
  );

  const viajes = data?.trips || [];
  const paginacion = data?.pagination;
  const totalPaginas = paginacion?.pages || 1;
  const totalViajes = paginacion?.total ?? viajes.length;

  const irAPagina = (n) => {
    setPagina(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const nombre = user?.name?.split(' ')[0] || t('viajes').toLowerCase();
  const buscando = consulta.length > 0;

  const subtitulo = () => {
    if (cargando) return t('subtitulo.cargando');
    // Se cuenta el total del filtro, no lo que cabe en esta página.
    if (buscando) {
      if (totalViajes === 0) return t('subtitulo.sinResultados', { consulta });
      return t(totalViajes === 1 ? 'subtitulo.resultadoSingular' : 'subtitulo.resultadoPlural', { total: totalViajes, consulta });
    }
    if (totalViajes > 0) {
      return esAgencia
        ? t(totalViajes === 1 ? 'subtitulo.clienteSingular' : 'subtitulo.clientePlural', { total: totalViajes })
        : t(totalViajes === 1 ? 'subtitulo.viajeSingular' : 'subtitulo.viajePlural', { total: totalViajes });
    }
    return esAgencia ? t('subtitulo.vacioAgencia') : t('subtitulo.vacioPersonal');
  };

  return (
    <div className="pila">
      <header className="portada">
        <div>
          <span className="etiqueta">
            {new Intl.DateTimeFormat(localeDeFecha(), { weekday: 'long', day: 'numeric', month: 'long' })
              .format(new Date())}
          </span>
          <h1 className="portada-titulo">
            {t('hola')} <span className="portada-nombre">{nombre}</span>
          </h1>
          <p className="suave" style={{ margin: 0 }}>
            {subtitulo()}
          </p>
        </div>
        <Link to="/viajes/nuevo" className="boton">
          <Icono nombre="mas" tamano={16} /> {t('nuevoViaje')}
        </Link>
      </header>

      {esDueno && <div className="fila" aria-label={t('ambitoDeTrabajo')}>
        <Boton variante={ambito === 'mios' ? 'primario' : 'secundario'} onClick={() => setAmbito('mios')} aria-pressed={ambito === 'mios'}>{t('viajes')}</Boton>
        <Boton variante={ambito === 'equipo' ? 'primario' : 'secundario'} onClick={() => setAmbito('equipo')} aria-pressed={ambito === 'equipo'}>{t('reporteDelEquipo')}</Boton>
      </div>}
      {ambito === 'equipo' ? <><p className="suave">{t('productividadEquipo')}</p><ReporteAgencia /></> : <>
      {esAgencia && panel.error && <ErrorCarga error={panel.error} onReintentar={panel.recargar} contexto={t('pendientesDelDia')} />}
      {esAgencia && <div className="panel-trabajo" aria-label={t('pendientesDelDia')}>
        {[
          ['porEnviar', 'porEnviarTitulo', 'porEnviarAyuda', () => verAtencion('borrador', 'proximos')],
          ['seguimiento', 'seguimientoTitulo', 'seguimientoAyuda', () => verAtencion('enviada', '')],
          ['proximasSalidas', 'proximasSalidasTitulo', 'proximasSalidasAyuda', () => verAtencion('', '', 'salidas')],
          ['pendientes', 'pendientesTitulo', 'pendientesAyuda', () => verAtencion('', '', 'pendientes')],
        ].map(([key, claveTitulo, claveAyuda, accion]) => <button key={key} className="tarjeta metrica-trabajo" onClick={accion}>
          <span>{t(`panel.${claveTitulo}`)}</span><strong>{panel.data?.[key] ?? '—'}</strong><small>{t(`panel.${claveAyuda}`)}</small>
        </button>)}
      </div>}
      {atencion && <div className="fila"><span>{atencion === 'salidas' ? t('salidasProximas') : t('viajesConDatosPendientes')}</span><Boton chico variante="secundario" onClick={() => setAtencion('')}>{t('quitarFiltro')}</Boton></div>}

      <div className="fila-entre" style={{ gap: 10, flexWrap: 'wrap' }}>
        <div className="fila" style={{ gap: 6, flexWrap: 'wrap' }} role="tablist" aria-label={t('filtrarViajes')}>
          {FILTROS.map((valor) => (
            <button
              key={valor || 'todos'}
              role="tab"
              aria-selected={filtro === valor}
              onClick={() => { setFiltro(valor); setAtencion(''); }}
              className={`insignia ${filtro === valor ? 'marca' : ''}`}
            >
              {t(`filtros.${CLAVES_FILTRO[valor]}`)}
            </button>
          ))}

          {/* Embudo de ventas: solo le importa a quien cotiza para clientes. */}
          {esAgencia && (
            <select
              className="filtro-propuesta"
              value={filtroPropuesta}
              onChange={(e) => setFiltroPropuesta(e.target.value)}
              aria-label={t('filtrarPorPropuesta')}
              style={{ marginLeft: 4 }}
            >
              {FILTROS_PROPUESTA.map((valor) => (
                <option key={valor || 'cualquiera'} value={valor}>
                  {t(`filtrosPropuesta.${CLAVES_FILTRO_PROPUESTA[valor]}`)}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="buscador">
          <span className="buscador-icono">
            <Icono nombre="buscar" tamano={17} />
          </span>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={esAgencia ? t('buscarConCliente') : t('buscarSinCliente')}
            aria-label={t('buscarViajes')}
          />
          {busqueda && (
            <button
              type="button"
              className="buscador-limpiar"
              onClick={() => setBusqueda('')}
              aria-label={t('limpiarBusqueda')}
            >
              <Icono nombre="cerrar" tamano={15} />
            </button>
          )}
        </div>
      </div>

      {error && (
        <ErrorCarga error={error} onReintentar={recargar} contexto={t('noPudimosCargar')} />
      )}

      {cargando && <EsqueletoTarjetas />}

      {!cargando && !error && viajes.length === 0 && (
        <Vacio
          icono={buscando ? '🔍' : filtro === 'pasados' ? '📸' : '🧭'}
          titulo={
            buscando
              ? t('sinResultados.conBusqueda')
              : filtro === 'pasados'
                ? t('sinResultados.pasados')
                : esAgencia
                  ? t('sinResultados.agencia')
                  : t('sinResultados.personal')
          }
          accion={
            buscando ? (
              <Boton variante="secundario" onClick={() => setBusqueda('')}>
                {t('limpiarBusqueda')}
              </Boton>
            ) : (
              filtro !== 'pasados' && (
                <Link to="/viajes/nuevo" className="boton">
                  {esAgencia ? t('crearPrimero.agencia') : t('crearPrimero.personal')}
                </Link>
              )
            )
          }
        >
          {buscando
            ? t(esAgencia ? 'vacio.busquedaConCliente' : 'vacio.busquedaSinCliente', {
                consulta,
                filtro: filtro ? t('vacio.dentroDelFiltro') : '',
              })
            : filtro === 'pasados'
              ? t('vacio.pasados')
              : esAgencia
                ? t('vacio.agencia')
                : t('vacio.personal')}
        </Vacio>
      )}

      {!cargando && viajes.length > 0 && (
        <div className="rejilla rejilla-2 rejilla-3">
          {viajes.map((v) => (
            <TarjetaViaje key={v._id} viaje={v} />
          ))}
        </div>
      )}

      {!cargando && totalPaginas > 1 && (
        <nav className="paginacion" aria-label={t('paginacion.aria')}>
          <Boton
            variante="secundario"
            chico
            onClick={() => irAPagina(pagina - 1)}
            disabled={pagina <= 1}
          >
            {t('paginacion.anterior')}
          </Boton>

          <span className="tenue" aria-live="polite">
            {t('paginacion.paginaDe', { pagina, total: totalPaginas })}
          </span>

          <Boton
            variante="secundario"
            chico
            onClick={() => irAPagina(pagina + 1)}
            disabled={pagina >= totalPaginas}
          >
            {t('paginacion.siguiente')}
          </Boton>
        </nav>
      )}
      </>}
    </div>
  );
}
