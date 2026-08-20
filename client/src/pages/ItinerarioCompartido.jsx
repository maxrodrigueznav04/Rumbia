import { Suspense, lazy } from 'react';
import { Link, useParams } from 'react-router-dom';
import { publicApi } from '../api/index.js';
import useFetch from '../hooks/useFetch.js';
import EnlacesReserva from '../components/EnlacesReserva.jsx';
import { Tarjeta, Insignia, Cargando, ErrorCarga, Vacio } from '../components/ui.jsx';
import { formatoFecha, rangoFechas, humanizar, ICONOS_CATEGORIA } from '../utils/format.js';

const MapaDestino = lazy(() => import('../components/MapaDestino.jsx'));

/**
 * Itinerario compartido por enlace, en solo lectura y sin sesión.
 *
 * Es la vista que ve alguien a quien le pasaron el link: puede leer el plan y
 * salir a reservar, pero no editar nada. No se muestra presupuesto ni gastos
 * porque el backend directamente no los manda.
 */
export default function ItinerarioCompartido() {
  const { token } = useParams();
  const { data, cargando, error, recargar } = useFetch(
    ({ signal }) => publicApi.verCompartido(token, { signal }),
    [token]
  );

  return (
    <div className="inicio">
      <header className="inicio-nav">
        <div className="contenedor fila-entre">
          <Link to="/" className="marca">
            <span className="marca-punto" aria-hidden="true">
              R
            </span>
            Rumbo
          </Link>
          <Link to="/" className="boton secundario chico">
            Arma el tuyo
          </Link>
        </div>
      </header>

      <main className="contenedor pagina">
        {cargando && <Cargando texto="Abriendo el itinerario..." />}

        {error && !cargando && (
          error.status === 404 ? (
            <Vacio titulo="Este enlace ya no funciona">
              Puede que quien lo compartió haya dejado de compartirlo, o que el viaje ya no exista.
            </Vacio>
          ) : (
            <ErrorCarga error={error} onReintentar={recargar} contexto="No pudimos abrirlo" />
          )
        )}

        {data && (
          <div className="pila">
            <header>
              <span className="etiqueta">Itinerario compartido</span>
              <h1 style={{ margin: '4px 0' }}>{data.viaje.title}</h1>
              <p className="suave" style={{ margin: 0 }}>
                {data.viaje.destination?.name} · {rangoFechas(data.viaje.startDate, data.viaje.endDate)} ·{' '}
                {data.viaje.durationDays} días · {data.viaje.travelers}{' '}
                {data.viaje.travelers === 1 ? 'viajero' : 'viajeros'}
              </p>
            </header>

            <div className="rejilla rejilla-detalle">
              <div className="pila">
                {data.itinerary.days.map((dia) => (
                  <Tarjeta key={dia._id || dia.dayNumber} titulo={`Día ${dia.dayNumber} · ${formatoFecha(dia.date)}`}>
                    {dia.title && <h4 style={{ marginTop: 0 }}>{dia.title}</h4>}
                    {dia.summary && <p className="suave">{dia.summary}</p>}
                    <div className="pila-sm">
                      {dia.activities.map((a) => (
                        <div className="actividad" key={a._id}>
                          <div className="actividad-hora">{a.time || '—'}</div>
                          <div className="actividad-cuerpo">
                            <h4>
                              <span aria-hidden="true">{ICONOS_CATEGORIA[a.category] || '📍'}</span>{' '}
                              {a.title}
                            </h4>
                            {a.description && <p>{a.description}</p>}
                            <div className="fila" style={{ gap: 6 }}>
                              <Insignia>{humanizar(a.category)}</Insignia>
                              {a.estimatedCost > 0 && (
                                <Insignia color="ambar">≈ ${a.estimatedCost} por persona</Insignia>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Tarjeta>
                ))}
              </div>

              <div className="pila">
                {data.pins?.length > 0 && (
                  <Tarjeta titulo="Actividades en el mapa">
                    <Suspense fallback={<Cargando texto="Cargando mapa..." />}>
                      <MapaDestino pines={data.pins} />
                    </Suspense>
                  </Tarjeta>
                )}

                <Tarjeta titulo="Buscar y reservar">
                  <p className="suave">
                    Rumbo no reserva ni cobra: estos enlaces llevan al sitio del proveedor con la
                    búsqueda ya prellenada.
                  </p>
                  {Object.entries(data.links || {}).map(([seccion, enlaces]) => (
                    <div key={seccion} style={{ marginBottom: 'var(--e4)' }}>
                      <span className="etiqueta">{humanizar(seccion)}</span>
                      <div style={{ marginTop: 8 }}>
                        <EnlacesReserva
                          enlaces={enlaces}
                          compacto
                          seccion={seccion}
                          destino={data.viaje.destination?.name}
                          origen="compartido"
                        />
                      </div>
                    </div>
                  ))}
                </Tarjeta>

                <Tarjeta className="centrado">
                  <h3>¿Quieres uno así para tu viaje?</h3>
                  <p className="suave">Ármalo con IA en un minuto, sin crear cuenta.</p>
                  <Link to="/" className="boton">
                    Probar Rumbo
                  </Link>
                </Tarjeta>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="pie">
        <div className="contenedor">
          <p className="tenue">
            Rumbo no procesa reservas ni pagos. Los enlaces te llevan al sitio del proveedor.
          </p>
          <nav className="pie-enlaces" aria-label="Enlaces legales">
            <Link to="/privacidad">Privacidad</Link>
            <Link to="/cookies">Cookies y rastreo</Link>
            <Link to="/terminos">Términos</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
