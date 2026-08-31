import { Fragment, Suspense, lazy, useCallback, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { tripsApi } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import useFetch from '../hooks/useFetch.js';
import EnlacesReserva from '../components/EnlacesReserva.jsx';
import TiraClima from '../components/TiraClima.jsx';
import ResumenPresupuesto from '../components/ResumenPresupuesto.jsx';
import ResumenGastosFijos from '../components/ResumenGastosFijos.jsx';
import ListaGastos from '../components/ListaGastos.jsx';
import SelectorPersonas from '../components/SelectorPersonas.jsx';
import FormViaje from '../components/formularios/FormViaje.jsx';
import FormTransporte from '../components/formularios/FormTransporte.jsx';
import FormHospedaje from '../components/formularios/FormHospedaje.jsx';
import FormTransporteLocal from '../components/formularios/FormTransporteLocal.jsx';
import ChatAsistente from '../components/ChatAsistente.jsx';
import {
  Boton,
  Tarjeta,
  Insignia,
  Vacio,
  Aviso,
  ErrorCarga,
  Cargando,
  Esqueleto,
  ModalConfirmar,
} from '../components/ui.jsx';
import Icono from '../components/Icono.jsx';
import {
  formatoMoneda,
  formatoFecha,
  rangoFechas,
  tiempoRelativo,
  humanizar,
  porPersonas,
  ciudadDeHospedaje,
  ETIQUETAS_ESTADO,
} from '../utils/format.js';

// Leaflet pesa: se carga solo cuando esta pantalla se abre.
const MapaDestino = lazy(() => import('../components/MapaDestino.jsx'));

// El transporte de ida manda el icono de la seccion: si vas en autobus, ver un
// avion ahi confunde.
const ICONO_MODO = {
  avion: 'avion',
  autobus: 'auto',
  'auto-propio': 'auto',
  tren: 'auto',
  otro: 'brujula',
};

function SeccionGasto({
  titulo,
  icono,
  monto,
  moneda,
  accion,
  children,
  enlaces,
  vacio,
  seccion,
  destino,
  errorEnlaces,
  onReintentarEnlaces,
}) {
  return (
    <Tarjeta
      titulo={
        <h3 className="fila" style={{ gap: 8 }}>
          <Icono nombre={icono} tamano={18} className="icono-seccion" />
          {titulo}
        </h3>
      }
      accion={
        <span className="fila" style={{ gap: 8 }}>
          {monto > 0 && <span className="numero">{formatoMoneda(monto, moneda)}</span>}
          {accion}
        </span>
      }
    >
      {children || (
        <p className="tenue" style={{ margin: '0 0 12px' }}>
          {vacio}
        </p>
      )}

      {enlaces?.length > 0 && (
        <details className="enlaces-desplegable">
          <summary>
            <span className="etiqueta">Buscar y reservar</span>
            <span className="tenue">({enlaces.length})</span>
            <Icono nombre="chevronAbajo" tamano={16} className="chevron" />
          </summary>
          <EnlacesReserva enlaces={enlaces} seccion={seccion} destino={destino} origen="app" />
        </details>
      )}

      {/* Sin esto, si tripsApi.bookingLinks() fallaba, la seccion de enlaces
          simplemente desaparecia (enlaces?.length es undefined) sin ningun
          aviso ni forma de reintentar. */}
      {!enlaces?.length && errorEnlaces && (
        <p className="tenue fila" style={{ margin: '10px 0 0', gap: 6, fontSize: '0.85rem' }}>
          No se pudieron cargar los enlaces de reserva.
          {onReintentarEnlaces && (
            <Boton variante="fantasma" chico onClick={onReintentarEnlaces}>
              Reintentar
            </Boton>
          )}
        </p>
      )}
    </Tarjeta>
  );
}

/**
 * "Buscar y reservar" para un hospedaje especifico, dentro de su propia
 * fila. Ademas del bloque general de la seccion (que sigue intacto y sigue
 * usando lodging[0]), este pide los enlaces de ESTE hospedaje via
 * lodgingIndex — pero solo al abrirse, para no disparar N peticiones al
 * cargar la pantalla si hay N hospedajes.
 */
function EnlacesHospedaje({ tripId, indice, destino }) {
  const [estado, setEstado] = useState({ cargando: false, enlaces: null, error: false });

  const alAbrirCerrar = async (e) => {
    if (!e.target.open || estado.enlaces || estado.cargando) return;
    setEstado({ cargando: true, enlaces: null, error: false });
    try {
      const res = await tripsApi.bookingLinks(tripId, { section: 'hospedaje', lodgingIndex: indice });
      setEstado({ cargando: false, enlaces: res.links?.hospedaje || [], error: false });
    } catch {
      setEstado({ cargando: false, enlaces: null, error: true });
    }
  };

  return (
    <details className="enlaces-desplegable" onToggle={alAbrirCerrar}>
      <summary>
        <span className="etiqueta">Buscar y reservar este hospedaje</span>
        <Icono nombre="chevronAbajo" tamano={16} className="chevron" />
      </summary>
      {estado.cargando && (
        <p className="tenue" style={{ margin: '8px 0 0', fontSize: '0.85rem' }}>
          Cargando enlaces…
        </p>
      )}
      {estado.error && (
        <p className="tenue" style={{ margin: '8px 0 0', fontSize: '0.85rem' }}>
          No se pudieron cargar los enlaces.
        </p>
      )}
      {estado.enlaces && (
        <EnlacesReserva enlaces={estado.enlaces} seccion="hospedaje" destino={destino} origen="app" />
      )}
    </details>
  );
}

export default function DetalleViaje() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const esAgencia = user?.preferences?.perfilUso !== 'personal';

  const viajeReq = useFetch(({ signal }) => tripsApi.get(id, { signal }), [id]);
  const resumenReq = useFetch(({ signal }) => tripsApi.summary(id, { signal }), [id]);
  const enlacesReq = useFetch(({ signal }) => tripsApi.bookingLinks(id, {}, { signal }), [id]);
  const climaReq = useFetch(({ signal }) => tripsApi.weather(id, { signal }), [id]);

  // Qué modal está abierto: { tipo, tramo?, indice? }
  const [modal, setModal] = useState(null);
  // Aparte del resto de modales: el chat se puede querer dejar abierto
  // mientras se consulta o edita otra cosa de la pantalla.
  const [chatAbierto, setChatAbierto] = useState(false);
  const [confirmar, setConfirmar] = useState(null);
  const [duplicando, setDuplicando] = useState(false);
  // Para cuántos de los viajeros se ven los precios. null = todos (default).
  const [personas, setPersonas] = useState(null);
  // Resultado de sincronizar el itinerario cuando cambian las fechas del viaje.
  const [avisoItinerario, setAvisoItinerario] = useState(null);

  // Tras guardar hay que refrescar el viaje y el resumen: los costos cambian juntos.
  const refrescar = useCallback(() => {
    viajeReq.recargar();
    resumenReq.recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (viajeReq.cargando) {
    return (
      <div className="pila">
        <Esqueleto alto={26} ancho="45%" />
        <Esqueleto alto={16} ancho="30%" />
        <Esqueleto alto={180} />
        <Esqueleto alto={140} />
      </div>
    );
  }

  if (viajeReq.error) {
    return (
      <div className="pila">
        <Link to="/viajes" className="volver">
          ← Mis viajes
        </Link>
        <ErrorCarga
          error={viajeReq.error}
          onReintentar={viajeReq.recargar}
          contexto="No pudimos cargar este viaje"
        />
      </div>
    );
  }

  const viaje = viajeReq.data.trip;
  const variantes = viajeReq.data.variantes || [];
  const estado = ETIQUETAS_ESTADO[viaje.status] || ETIQUETAS_ESTADO.borrador;
  const moneda = viaje.budget?.currency || 'MXN';
  const enlaces = enlacesReq.data?.links || {};
  const itinerario = viaje.itinerary;
  const gastos = viaje.expenses || [];
  const ida = viaje.transport?.outbound;
  const vuelta = viaje.transport?.inbound;
  const hayTransporte = ida?.cost > 0 || vuelta?.cost > 0 || ida?.provider || vuelta?.provider;
  const paraCuantos = Math.min(personas ?? viaje.travelers, viaje.travelers);
  const escalar = (monto) => porPersonas(monto, viaje.travelers, paraCuantos);

  const eliminarViaje = async () => {
    await tripsApi.remove(id);
    navigate('/viajes', { replace: true });
  };

  /** Copia el viaje completo (logistica, margen, itinerario) para armar una
      variante — "Opcion Economica" vs "Premium" del mismo prospecto. */
  const duplicarViaje = async () => {
    setDuplicando(true);
    try {
      const res = await tripsApi.duplicar(id);
      navigate(`/viajes/${res.trip._id}`);
    } catch (err) {
      window.alert(err.message);
    } finally {
      setDuplicando(false);
    }
  };

  /** Quita un elemento de lodging o localTransport y guarda el arreglo resultante. */
  const quitarDeLista = async (campo, indice) => {
    const lista = viaje[campo].filter((_, i) => i !== indice).map((item) => {
      // subtotal y perNight son virtuales del modelo: se calculan al leer y no
      // deben viajar de vuelta al guardar.
      const { _id, id: _ignorado, subtotal, perNight, ...limpio } = item;
      return limpio;
    });
    await tripsApi.update(id, { [campo]: lista });
    refrescar();
  };

  return (
    <div className="pila">
      {/* Banda de atardecer con la tarjeta del encabezado montada encima. */}
      <div className="portada-viaje">
        <svg
          width="90"
          height="90"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#FBF6EC"
          strokeWidth="1.4"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M15 9l-1.5 4.5L9 15l1.5-4.5z" fill="#FBF6EC" stroke="none" />
        </svg>
        <Link to="/viajes" className="volver">
          ← Mis viajes
        </Link>
      </div>

      <header className="tarjeta tarjeta-encabezado fila-entre">
        <div>
          <div className="fila" style={{ gap: 8, marginBottom: 6 }}>
            <Insignia color={estado.color}>{estado.texto}</Insignia>
            <span className="tenue">{tiempoRelativo(viaje.startDate)}</span>
          </div>
          <h1 style={{ marginBottom: 4 }}>{viaje.title}</h1>
          {esAgencia && viaje.cliente?.nombre && (
            <p className="suave" style={{ margin: '0 0 2px' }}>
              Para <strong>{viaje.cliente.nombre}</strong>
              {viaje.cliente.contacto ? ` · ${viaje.cliente.contacto}` : ''}
            </p>
          )}
          <p className="suave" style={{ margin: 0 }}>
            <Icono nombre="pin" tamano={15} />{' '}
            {viaje.destination?.name}
            {viaje.destination?.country ? `, ${viaje.destination.country}` : ''} ·{' '}
            {rangoFechas(viaje.startDate, viaje.endDate)} · {viaje.durationDays} días ·{' '}
            {viaje.travelers} {viaje.travelers === 1 ? 'viajero' : 'viajeros'}
          </p>
          {viaje.createdAt && (
            <p className="tenue" style={{ margin: '4px 0 0', fontSize: '0.8rem' }}>
              Creado el {formatoFecha(viaje.createdAt)}
            </p>
          )}
        </div>

        <div className="fila">
          <Link to={`/viajes/${id}/itinerario`} className="boton">
            {itinerario ? 'Ver itinerario' : 'Crear itinerario'}
          </Link>
          <Boton variante="secundario" chico onClick={() => setModal({ tipo: 'viaje' })}>
            <Icono nombre="lapiz" tamano={15} /> Editar
          </Boton>
          <Boton variante="secundario" chico onClick={() => setChatAbierto(true)}>
            <Icono nombre="chispa" tamano={15} /> Chat
          </Boton>
          {esAgencia && (
            <Boton variante="secundario" chico onClick={duplicarViaje} cargando={duplicando}>
              Duplicar
            </Boton>
          )}
          <Boton variante="peligro-texto" chico onClick={() => setConfirmar('viaje')}>
            Eliminar
          </Boton>
        </div>
      </header>

      {avisoItinerario && (
        <Aviso tipo={avisoItinerario.diasSobrantes > 0 ? 'alerta' : 'info'} titulo="Itinerario ajustado">
          {avisoItinerario.diasAgregados > 0 &&
            `Se agregaron ${avisoItinerario.diasAgregados} día(s) vacío(s). `}
          {avisoItinerario.diasSobrantes > 0
            ? `Hay ${avisoItinerario.diasSobrantes} día(s) que ya quedan fuera del viaje, con ${avisoItinerario.actividadesEnSobrantes} actividad(es). No se borraron: revísalos en el itinerario.`
            : 'Las fechas de cada día se actualizaron.'}
        </Aviso>
      )}

      {esAgencia && variantes.length > 0 && (
        <Tarjeta
          titulo={viaje.cliente?.nombre ? `Otras opciones para ${viaje.cliente.nombre}` : 'Otras opciones para este cliente'}
        >
          <div className="fila" style={{ gap: 8, flexWrap: 'wrap' }}>
            {variantes.map((v) => {
              const estadoV = ETIQUETAS_ESTADO[v.status] || ETIQUETAS_ESTADO.borrador;
              return (
                <Link
                  key={v._id}
                  to={`/viajes/${v._id}`}
                  className="tarjeta-plana fila"
                  style={{ gap: 8, textDecoration: 'none' }}
                >
                  {v.title}
                  <Insignia color={estadoV.color}>{estadoV.texto}</Insignia>
                </Link>
              );
            })}
          </div>
        </Tarjeta>
      )}

      <SelectorPersonas personas={paraCuantos} maximo={viaje.travelers} onCambio={setPersonas} />

      <div className="rejilla rejilla-detalle">
        {/* ----------------- Columna principal ----------------- */}
        <div className="pila">
          <SeccionGasto
            seccion="transporte"
            destino={viaje.destination?.name}
            titulo="Transporte de ida y vuelta"
            icono={ICONO_MODO[ida?.mode] || 'avion'}
            monto={escalar((ida?.cost || 0) + (vuelta?.cost || 0))}
            moneda={moneda}
            enlaces={enlaces.transporte}
            errorEnlaces={enlacesReq.error}
            onReintentarEnlaces={enlacesReq.recargar}
            vacio="Aún no registras cómo llegas ni cómo regresas."
          >
            <div className="pila-sm">
              {[
                { etiqueta: 'Ida', tramo: 'outbound', datos: ida },
                { etiqueta: 'Vuelta', tramo: 'inbound', datos: vuelta },
              ].map(({ etiqueta, tramo, datos }) => (
                <div className="linea-gasto" key={tramo}>
                  <span className="crece" style={{ minWidth: 0 }}>
                    <strong>{etiqueta}</strong>{' '}
                    <span className="tenue">
                      {datos?.provider || datos?.cost > 0 ? (
                        <>
                          {humanizar(datos?.mode || '')}
                          {datos?.provider ? ` · ${datos.provider}` : ''}
                          {datos?.bookingRef ? ` · ${datos.bookingRef}` : ''}
                        </>
                      ) : (
                        'sin capturar'
                      )}
                    </span>
                  </span>

                  <span className="numero">
                    {formatoMoneda(escalar(datos?.cost || 0), moneda)}
                    {datos?.isEstimate && datos?.cost > 0 && (
                      <span className="tenue" style={{ fontWeight: 400 }}> est.</span>
                    )}
                  </span>

                  <Boton
                    variante="fantasma"
                    chico
                    onClick={() => setModal({ tipo: 'transporte', tramo })}
                  >
                    <Icono nombre={datos?.cost > 0 || datos?.provider ? 'lapiz' : 'mas'} tamano={15} />
                  </Boton>
                </div>
              ))}
            </div>
            {!hayTransporte && (
              <p className="tenue" style={{ margin: '10px 0 0', fontSize: '0.85rem' }}>
                Busca en los comparadores de abajo y regresa a capturar el costo.
              </p>
            )}
          </SeccionGasto>

          <SeccionGasto
            seccion="hospedaje"
            destino={viaje.destination?.name}
            titulo="Hospedaje"
            icono="cama"
            monto={escalar(viaje.coreCosts?.lodging)}
            moneda={moneda}
            enlaces={enlaces.hospedaje}
            errorEnlaces={enlacesReq.error}
            onReintentarEnlaces={enlacesReq.recargar}
            accion={
              <Boton chico variante="secundario" onClick={() => setModal({ tipo: 'hospedaje' })}>
                + Agregar
              </Boton>
            }
            vacio={`Necesitas ${viaje.nightsCount} ${viaje.nightsCount === 1 ? 'noche' : 'noches'}. Busca opciones y registra el costo aquí.`}
          >
            {viaje.lodging?.length > 0 && (
              <div className="pila-sm">
                {viaje.lodging.map((l, i) => (
                  <Fragment key={l._id || i}>
                    <div className="linea-gasto">
                      <span className="crece" style={{ minWidth: 0 }}>
                        <strong>{l.name || humanizar(l.type)}</strong>
                        {viaje.additionalDestinations?.length > 0 && (
                          <span style={{ marginLeft: 8 }}>
                            <Insignia color="cielo">{ciudadDeHospedaje(viaje, l)}</Insignia>
                          </span>
                        )}
                        <span className="tenue" style={{ display: 'block', fontSize: '0.82rem' }}>
                          {humanizar(l.type)} · {l.nights} {l.nights === 1 ? 'noche' : 'noches'}
                          {l.perNight > 0 ? ` · ${formatoMoneda(l.perNight, moneda)} por noche` : ''}
                          {l.isEstimate ? ' · estimado' : ''}
                        </span>
                      </span>
                      <span className="numero">{formatoMoneda(escalar(l.subtotal), moneda)}</span>
                      <span className="fila" style={{ gap: 0, flexWrap: 'nowrap' }}>
                        <Boton
                          variante="fantasma"
                          chico
                          onClick={() => setModal({ tipo: 'hospedaje', indice: i })}
                          aria-label="Editar hospedaje"
                        >
                          <Icono nombre="lapiz" tamano={14} />
                        </Boton>
                        <Boton
                          variante="fantasma"
                          chico
                          onClick={() => setConfirmar({ campo: 'lodging', indice: i, nombre: l.name || humanizar(l.type) })}
                          aria-label="Eliminar hospedaje"
                        >
                          <Icono nombre="cerrar" tamano={14} />
                        </Boton>
                      </span>
                    </div>
                    {/* Con 2+ hospedajes el bloque general de arriba (lodging[0])
                        ya no basta para saber donde reservar cada uno. */}
                    {viaje.lodging.length > 1 && (
                      <EnlacesHospedaje tripId={id} indice={i} destino={ciudadDeHospedaje(viaje, l)} />
                    )}
                  </Fragment>
                ))}
              </div>
            )}
          </SeccionGasto>

          <SeccionGasto
            seccion="transporte-local"
            destino={viaje.destination?.name}
            titulo="Transporte en el destino"
            icono="auto"
            monto={escalar(viaje.coreCosts?.localTransport)}
            moneda={moneda}
            enlaces={enlaces['transporte-local']}
            errorEnlaces={enlacesReq.error}
            onReintentarEnlaces={enlacesReq.recargar}
            accion={
              <Boton
                chico
                variante="secundario"
                onClick={() => setModal({ tipo: 'transporte-local' })}
              >
                + Agregar
              </Boton>
            }
            vacio="¿Cómo te vas a mover allá? Renta de auto, apps, taxi o transporte público."
          >
            {viaje.localTransport?.length > 0 && (
              <div className="pila-sm">
                {viaje.localTransport.map((t, i) => (
                  <div className="linea-gasto" key={t._id || i}>
                    <span className="crece" style={{ minWidth: 0 }}>
                      <strong>{humanizar(t.type)}</strong>
                      {(t.provider || t.notes) && (
                        <span className="tenue" style={{ display: 'block', fontSize: '0.82rem' }}>
                          {[t.provider, t.notes].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </span>
                    <span className="numero">{formatoMoneda(escalar(t.estimatedCost), moneda)}</span>
                    <span className="fila" style={{ gap: 0, flexWrap: 'nowrap' }}>
                      <Boton
                        variante="fantasma"
                        chico
                        onClick={() => setModal({ tipo: 'transporte-local', indice: i })}
                        aria-label="Editar transporte local"
                      >
                        <Icono nombre="lapiz" tamano={14} />
                      </Boton>
                      <Boton
                        variante="fantasma"
                        chico
                        onClick={() => setConfirmar({ campo: 'localTransport', indice: i, nombre: humanizar(t.type) })}
                        aria-label="Eliminar transporte local"
                      >
                        <Icono nombre="cerrar" tamano={14} />
                      </Boton>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SeccionGasto>

          <ListaGastos viaje={viaje} gastos={gastos} onCambio={refrescar} />

          <Tarjeta
            titulo="Itinerario"
            accion={
              <Link to={`/viajes/${id}/itinerario`} className="boton secundario chico">
                {itinerario ? 'Abrir' : 'Crear'}
              </Link>
            }
          >
            {itinerario ? (
              <div className="fila" style={{ gap: 8 }}>
                <Insignia color="marca">
                  {itinerario.days?.length} {itinerario.days?.length === 1 ? 'día' : 'días'}
                </Insignia>
                <Insignia>{itinerario.activityCount} actividades</Insignia>
                <Insignia color={itinerario.generatedBy === 'ia' ? 'cielo' : ''}>
                  {itinerario.generatedBy === 'ia' ? <><Icono nombre="chispa" tamano={14} /> Generado con IA</> : 'Armado a mano'}
                </Insignia>
              </div>
            ) : (
              <Vacio icono={<Icono nombre="chispa" tamano={28} />} titulo="Sin itinerario todavía">
                Deja que la IA te proponga un plan día por día según tus intereses, o ármalo tú
                mismo.
              </Vacio>
            )}
          </Tarjeta>
        </div>

        {/* ----------------- Columna lateral ----------------- */}
        <div className="pila">
          <Tarjeta titulo="Dónde queda">
            <Suspense fallback={<div className="mapa" />}>
              <MapaDestino
                destino={viaje.destination}
                destinosExtra={viaje.additionalDestinations?.map((p) => p.place)}
              />
            </Suspense>
          </Tarjeta>

          <Tarjeta titulo="Clima durante el viaje">
            {climaReq.cargando && <Cargando texto="Consultando el clima..." />}
            {climaReq.error && (
              <p className="tenue" style={{ margin: 0 }}>
                No pudimos traer el clima ahora. {climaReq.error.message}
              </p>
            )}
            {climaReq.data && <TiraClima clima={climaReq.data} />}
          </Tarjeta>

          {climaReq.data?.paradas?.map((parada, i) => (
            <Tarjeta key={i} titulo={`Clima en ${parada.place?.name || 'la parada'}`}>
              {parada.error ? (
                <p className="tenue" style={{ margin: 0 }}>
                  No pudimos traer el clima de esta parada. {parada.error}
                </p>
              ) : (
                <TiraClima clima={parada} />
              )}
            </Tarjeta>
          ))}

          <ResumenGastosFijos viaje={viaje} personas={paraCuantos} />

          {resumenReq.cargando && <Esqueleto alto={280} />}
          {resumenReq.error && (
            <ErrorCarga
              error={resumenReq.error}
              onReintentar={resumenReq.recargar}
              contexto="Presupuesto"
            />
          )}
          {resumenReq.data && <ResumenPresupuesto resumen={resumenReq.data} />}
        </div>
      </div>

      <p className="tenue centrado" style={{ fontSize: '0.78rem', marginTop: 8 }}>
        Rumbo no procesa reservas ni pagos. Los enlaces te llevan al sitio del proveedor, donde
        completas la reserva; aquí solo guardas los datos y los costos.
      </p>

      {/* ----------------- Modales ----------------- */}
      {modal?.tipo === 'viaje' && (
        <FormViaje
          abierto
          onCerrar={() => setModal(null)}
          viaje={viaje}
          onGuardado={(info) => {
            setAvisoItinerario(info || null);
            refrescar();
            climaReq.recargar(); // el destino o las fechas pudieron cambiar
            enlacesReq.recargar(); // los enlaces de reserva se arman con el destino
          }}
        />
      )}
      {modal?.tipo === 'transporte' && (
        <FormTransporte
          abierto
          onCerrar={() => setModal(null)}
          viaje={viaje}
          tramo={modal.tramo}
          onGuardado={refrescar}
        />
      )}
      {modal?.tipo === 'hospedaje' && (
        <FormHospedaje
          abierto
          onCerrar={() => setModal(null)}
          viaje={viaje}
          indice={modal.indice}
          onGuardado={refrescar}
        />
      )}
      {modal?.tipo === 'transporte-local' && (
        <FormTransporteLocal
          abierto
          onCerrar={() => setModal(null)}
          viaje={viaje}
          indice={modal.indice}
          onGuardado={refrescar}
        />
      )}

      <ChatAsistente abierto={chatAbierto} onCerrar={() => setChatAbierto(false)} tripId={id} />

      <ModalConfirmar
        abierto={confirmar === 'viaje'}
        onCerrar={() => setConfirmar(null)}
        onConfirmar={eliminarViaje}
        titulo="Eliminar viaje"
        mensaje={`Se va a borrar "${viaje.title}" junto con su itinerario y sus gastos. Esta acción no se puede deshacer.`}
      />

      <ModalConfirmar
        abierto={Boolean(confirmar?.campo)}
        onCerrar={() => setConfirmar(null)}
        onConfirmar={() => quitarDeLista(confirmar.campo, confirmar.indice)}
        titulo="Eliminar"
        mensaje={`Se va a quitar "${confirmar?.nombre}" del viaje.`}
      />
    </div>
  );
}
