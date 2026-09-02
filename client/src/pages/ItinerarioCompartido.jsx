import { Suspense, lazy, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { publicApi } from '../api/index.js';
import useFetch from '../hooks/useFetch.js';
import EnlacesReserva from '../components/EnlacesReserva.jsx';
import ResumenViaje from '../components/ResumenViaje.jsx';
import SelectorPersonas from '../components/SelectorPersonas.jsx';
import { EncabezadoImpresion, PieImpresion } from '../components/HojaImpresion.jsx';
import Icono from '../components/Icono.jsx';
import { Boton, Tarjeta, Insignia, Cargando, ErrorCarga, Vacio } from '../components/ui.jsx';
import {
  formatoFecha,
  formatoMoneda,
  rangoFechas,
  humanizar,
  porPersonas,
  ICONOS_CATEGORIA,
  nombreDestino,
} from '../utils/format.js';

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
  // Para cuántos de los viajeros se ven los precios. null = todos (default).
  const [personas, setPersonas] = useState(null);
  const moneda = data?.viaje?.budget?.currency || 'MXN';
  const paraCuantos = data
    ? Math.min(personas ?? data.viaje.travelers, data.viaje.travelers)
    : 1;
  const ocultarCosto = Boolean(data?.viaje?.ocultarDesglose);

  return (
    <div className="inicio">
      <header className="inicio-nav no-imprimir">
        <div className="contenedor fila-entre">
          <Link to="/" className="marca">
            <span className="marca-punto" aria-hidden="true">
              R
            </span>
            Rumbia
          </Link>
          <Link to="/" className="boton secundario chico">
            Planear mi viaje
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
            {/* Solo se ve al imprimir; en pantalla lo oculta global.css. Es la
                marca de quien compartio el enlace, no de quien lo abre. */}
            <EncabezadoImpresion marca={data.marca} viaje={data.viaje} />

            <header className="fila-entre no-imprimir">
              <div>
                <span className="etiqueta">Itinerario compartido</span>
                <h1 style={{ margin: '4px 0' }}>{data.viaje.title}</h1>
                <p className="suave" style={{ margin: 0 }}>
                  {nombreDestino(data.viaje)} · {rangoFechas(data.viaje.startDate, data.viaje.endDate)} ·{' '}
                  {data.viaje.durationDays} días · {data.viaje.travelers}{' '}
                  {data.viaje.travelers === 1 ? 'viajero' : 'viajeros'}
                </p>
              </div>
              <Boton variante="secundario" chico onClick={() => window.print()}>
                <Icono nombre="descarga" tamano={15} /> Descargar PDF
              </Boton>
            </header>

            <SelectorPersonas personas={paraCuantos} maximo={data.viaje.travelers} onCambio={setPersonas} />
            <ResumenViaje viaje={data.viaje} personas={paraCuantos} />

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
                              {!ocultarCosto && a.estimatedCost > 0 && (
                                <Insignia color="ambar">
                                  ≈ {formatoMoneda(a.estimatedCost, moneda)} por persona
                                </Insignia>
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
                {(data.itinerary.totalEstimatedCost > 0 || data.viaje.coreCosts?.total > 0) && (
                  <Tarjeta titulo={data.viaje.hayMargen ? 'Precio total' : 'Costo total estimado'}>
                    {!ocultarCosto && (
                      <div className="pila-sm">
                        <div className="linea-gasto">
                          <span className="suave">Actividades</span>
                          <span className="numero">
                            {formatoMoneda(data.itinerary.totalEstimatedCost, moneda)}
                          </span>
                        </div>
                        <div className="linea-gasto">
                          <span className="suave">Ida y vuelta, hospedaje y transporte local</span>
                          <span className="numero">
                            {formatoMoneda(
                              porPersonas(data.viaje.coreCosts?.total || 0, data.viaje.travelers, 1),
                              moneda
                            )}
                          </span>
                        </div>
                        {data.viaje.margenPorPersona > 0 && (
                          <div className="linea-gasto">
                            <span className="suave">Cuota de servicio</span>
                            <span className="numero">
                              {formatoMoneda(data.viaje.margenPorPersona, moneda)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="fila-entre" style={{ marginTop: 12 }}>
                      <span className="suave">Por persona</span>
                      <span className="numero grande">
                        {formatoMoneda(data.viaje.precioTotalPorPersona, moneda)}
                      </span>
                    </div>
                    <div className="fila-entre" style={{ marginTop: 6 }}>
                      <span className="suave">
                        {paraCuantos} {paraCuantos === 1 ? 'viajero' : 'viajeros'}
                      </span>
                      <span className="numero">
                        {formatoMoneda(data.viaje.precioTotalPorPersona * paraCuantos, moneda)}
                      </span>
                    </div>
                    <p className="tenue" style={{ margin: '12px 0 0', fontSize: '0.8rem' }}>
                      Actividades sugeridas, más lo que ya se capturó en transporte y hospedaje. Son
                      estimaciones, no precios en firme.
                    </p>
                  </Tarjeta>
                )}

                {data.pins?.length > 0 && (
                  <Tarjeta titulo="Actividades en el mapa" className="no-imprimir">
                    <Suspense fallback={<Cargando texto="Cargando mapa..." />}>
                      <MapaDestino
                        pines={data.pins}
                        destinosExtra={data.viaje.additionalDestinations?.map((p) => p.place)}
                      />
                    </Suspense>
                  </Tarjeta>
                )}

                <Tarjeta titulo="Buscar y reservar" className="no-imprimir">
                  <p className="suave">
                    Rumbia no reserva ni cobra: estos enlaces llevan al sitio del proveedor con la
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

                <Tarjeta className="centrado no-imprimir">
                  <h3>¿Quieres uno así para tu viaje?</h3>
                  <p className="suave">Ármalo con IA en un minuto, sin crear cuenta.</p>
                  <Link to="/" className="boton">
                    Probar Rumbia
                  </Link>
                </Tarjeta>
              </div>
            </div>

            <PieImpresion marca={data.marca} />
          </div>
        )}
      </main>

      <footer className="pie">
        <div className="contenedor">
          <p className="tenue">
            Rumbia no procesa reservas ni pagos. Los enlaces te llevan al sitio del proveedor.
          </p>
          <nav className="pie-enlaces" aria-label="Enlaces del sitio">
            <Link to="/acerca">Acerca de</Link>
            <Link to="/privacidad">Privacidad</Link>
            <Link to="/cookies">Cookies y rastreo</Link>
            <Link to="/terminos">Términos</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
