import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { tripsApi } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import useFetch from '../hooks/useFetch.js';
import useDebounce from '../hooks/useDebounce.js';
import TarjetaViaje from '../components/TarjetaViaje.jsx';
import { ReporteAgencia } from '../components/TarjetaAgencia.jsx';
import { Boton, Vacio, ErrorCarga, Esqueleto } from '../components/ui.jsx';
import Icono from '../components/Icono.jsx';

const FILTROS = [
  { valor: 'proximos', texto: 'Próximos' },
  { valor: 'pasados', texto: 'Pasados' },
  { valor: 'borrador', texto: 'Borradores' },
  { valor: '', texto: 'Todos' },
];

// Embudo de ventas: en que va la propuesta con el cliente, no en que va el
// viaje en si (eso lo filtra FILTROS de arriba). Solo tiene sentido para
// quien cotiza para clientes.
const FILTROS_PROPUESTA = [
  { valor: '', texto: 'Cualquier propuesta' },
  { valor: 'borrador', texto: 'Sin enviar' },
  { valor: 'enviada', texto: 'Enviadas' },
  { valor: 'aceptada', texto: 'Aceptadas' },
  { valor: 'pagada', texto: 'Pagadas' },
  { valor: 'cancelada', texto: 'Canceladas' },
];

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
  const nombre = user?.name?.split(' ')[0] || 'viajero';
  const buscando = consulta.length > 0;

  const subtitulo = () => {
    if (cargando) return 'Cargando tus viajes...';
    // Se cuenta el total del filtro, no lo que cabe en esta página.
    if (buscando) {
      return totalViajes > 0
        ? `${totalViajes} ${totalViajes === 1 ? 'resultado' : 'resultados'} para "${consulta}".`
        : `Sin resultados para "${consulta}".`;
    }
    if (totalViajes > 0) {
      return esAgencia
        ? `Tienes ${totalViajes} ${totalViajes === 1 ? 'viaje de cliente' : 'viajes de clientes'} en esta vista.`
        : `Tienes ${totalViajes} ${totalViajes === 1 ? 'viaje' : 'viajes'} en esta vista.`;
    }
    return esAgencia
      ? 'Aquí vas a ver los viajes que armes para tus clientes.'
      : 'Aquí vas a ver todos tus viajes.';
  };

  return (
    <div className="pila">
      <header className="portada">
        <div>
          <span className="etiqueta">
            {new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
              .format(new Date())}
          </span>
          <h1 className="portada-titulo">
            Hola, <span className="portada-nombre">{nombre}</span>
          </h1>
          <p className="suave" style={{ margin: 0 }}>
            {subtitulo()}
          </p>
        </div>
        <Link to="/viajes/nuevo" className="boton">
          <Icono nombre="mas" tamano={16} /> Nuevo viaje
        </Link>
      </header>

      {esDueno && <div className="fila" aria-label="Ámbito de trabajo">
        <Boton variante={ambito === 'mios' ? 'primario' : 'secundario'} onClick={() => setAmbito('mios')} aria-pressed={ambito === 'mios'}>Viajes</Boton>
        <Boton variante={ambito === 'equipo' ? 'primario' : 'secundario'} onClick={() => setAmbito('equipo')} aria-pressed={ambito === 'equipo'}>Reporte del equipo</Boton>
      </div>}
      {ambito === 'equipo' ? <><p className="suave">Productividad de tu equipo. Los viajes de la agencia se comparten entre sus integrantes.</p><ReporteAgencia /></> : <>
      {esAgencia && panel.error && <ErrorCarga error={panel.error} onReintentar={panel.recargar} contexto="Pendientes del día" />}
      {esAgencia && <div className="panel-trabajo" aria-label="Pendientes del día">
        {[
          ['porEnviar', 'Por preparar', 'Propuestas próximas sin enviar', () => verAtencion('borrador', 'proximos')],
          ['seguimiento', 'Dar seguimiento', 'Propuestas enviadas', () => verAtencion('enviada', '')],
          ['proximasSalidas', 'Próximas salidas', 'Durante los siguientes 7 días', () => verAtencion('', '', 'salidas')],
          ['pendientes', 'Completar datos', 'Falta cliente u hospedaje', () => verAtencion('', '', 'pendientes')],
        ].map(([key, titulo, ayuda, accion]) => <button key={key} className="tarjeta metrica-trabajo" onClick={accion}>
          <span>{titulo}</span><strong>{panel.data?.[key] ?? '—'}</strong><small>{ayuda}</small>
        </button>)}
      </div>}
      {atencion && <div className="fila"><span>{atencion === 'salidas' ? 'Salidas en los próximos 7 días' : 'Viajes con datos pendientes'}</span><Boton chico variante="secundario" onClick={() => setAtencion('')}>Quitar filtro</Boton></div>}

      <div className="fila-entre" style={{ gap: 10, flexWrap: 'wrap' }}>
        <div className="fila" style={{ gap: 6, flexWrap: 'wrap' }} role="tablist" aria-label="Filtrar viajes">
          {FILTROS.map((f) => (
            <button
              key={f.valor || 'todos'}
              role="tab"
              aria-selected={filtro === f.valor}
              onClick={() => { setFiltro(f.valor); setAtencion(''); }}
              className={`insignia ${filtro === f.valor ? 'marca' : ''}`}
            >
              {f.texto}
            </button>
          ))}

          {/* Embudo de ventas: solo le importa a quien cotiza para clientes. */}
          {esAgencia && (
            <select
              className="filtro-propuesta"
              value={filtroPropuesta}
              onChange={(e) => setFiltroPropuesta(e.target.value)}
              aria-label="Filtrar por estado de la propuesta"
              style={{ marginLeft: 4 }}
            >
              {FILTROS_PROPUESTA.map((f) => (
                <option key={f.valor || 'cualquiera'} value={f.valor}>
                  {f.texto}
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
            placeholder={esAgencia ? 'Buscar por nombre, destino o cliente' : 'Buscar por nombre o destino'}
            aria-label="Buscar viajes"
          />
          {busqueda && (
            <button
              type="button"
              className="buscador-limpiar"
              onClick={() => setBusqueda('')}
              aria-label="Limpiar búsqueda"
            >
              <Icono nombre="cerrar" tamano={15} />
            </button>
          )}
        </div>
      </div>

      {error && (
        <ErrorCarga error={error} onReintentar={recargar} contexto="No pudimos cargar tus viajes" />
      )}

      {cargando && <EsqueletoTarjetas />}

      {!cargando && !error && viajes.length === 0 && (
        <Vacio
          icono={buscando ? '🔍' : filtro === 'pasados' ? '📸' : '🧭'}
          titulo={
            buscando
              ? 'Nada coincide con tu búsqueda'
              : filtro === 'pasados'
                ? 'Todavía no tienes viajes pasados'
                : esAgencia
                  ? 'Aún no tienes viajes de clientes'
                  : 'Aún no hay viajes por aquí'
          }
          accion={
            buscando ? (
              <Boton variante="secundario" onClick={() => setBusqueda('')}>
                Limpiar búsqueda
              </Boton>
            ) : (
              filtro !== 'pasados' && (
                <Link to="/viajes/nuevo" className="boton">
                  {esAgencia ? 'Crear el primer viaje' : 'Planear mi primer viaje'}
                </Link>
              )
            )
          }
        >
          {buscando
            ? `Probamos con "${consulta}" en el nombre${esAgencia ? ', el destino y el cliente' : ' y el destino'} de tus viajes${filtro ? ', dentro del filtro activo' : ''}.`
            : filtro === 'pasados'
              ? 'Cuando termine un viaje aparecerá aquí, con su itinerario y sus gastos.'
              : esAgencia
                ? 'Crea el viaje de tu cliente con destino y fechas, y deja que la IA te arme el itinerario día por día.'
                : 'Crea un viaje con destino y fechas, y deja que la IA te arme el itinerario día por día.'}
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
        <nav className="paginacion" aria-label="Paginación de viajes">
          <Boton
            variante="secundario"
            chico
            onClick={() => irAPagina(pagina - 1)}
            disabled={pagina <= 1}
          >
            ← Anterior
          </Boton>

          <span className="tenue" aria-live="polite">
            Página {pagina} de {totalPaginas}
          </span>

          <Boton
            variante="secundario"
            chico
            onClick={() => irAPagina(pagina + 1)}
            disabled={pagina >= totalPaginas}
          >
            Siguiente →
          </Boton>
        </nav>
      )}
      </>}
    </div>
  );
}
