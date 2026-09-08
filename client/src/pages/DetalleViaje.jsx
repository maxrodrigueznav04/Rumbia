import { Fragment, Suspense, lazy, useCallback, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { tripsApi } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import useFetch from '../hooks/useFetch.js';
import EnlacesReserva from '../components/EnlacesReserva.jsx';
import TiraClima from '../components/TiraClima.jsx';
import ResumenPresupuesto from '../components/ResumenPresupuesto.jsx';
import ResumenCotizacion from '../components/ResumenCotizacion.jsx';
import VistaPreviaPropuesta from '../components/VistaPreviaPropuesta.jsx';
import ListaGastos from '../components/ListaGastos.jsx';
import SelectorPersonas from '../components/SelectorPersonas.jsx';
import FormViaje from '../components/formularios/FormViaje.jsx';
import FormTransporte from '../components/formularios/FormTransporte.jsx';
import FormHospedaje from '../components/formularios/FormHospedaje.jsx';
import FormTransporteLocal from '../components/formularios/FormTransporteLocal.jsx';
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
  traducirDominio,
  porPersonas,
  ciudadDeHospedaje,
  ETIQUETAS_ESTADO,
  ETIQUETAS_ESTADO_PROPUESTA,
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
  t,
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
            <span className="etiqueta">{t('buscarYReservar')}</span>
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
          {t('noPudimosCargarEnlaces')}
          {onReintentarEnlaces && (
            <Boton variante="fantasma" chico onClick={onReintentarEnlaces}>
              {t('reintentar')}
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
function EnlacesHospedaje({ tripId, indice, destino, t }) {
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
        <span className="etiqueta">{t('buscarYReservarEsteHospedaje')}</span>
        <Icono nombre="chevronAbajo" tamano={16} className="chevron" />
      </summary>
      {estado.cargando && (
        <p className="tenue" style={{ margin: '8px 0 0', fontSize: '0.85rem' }}>
          {t('cargandoEnlaces')}
        </p>
      )}
      {estado.error && (
        <p className="tenue" style={{ margin: '8px 0 0', fontSize: '0.85rem' }}>
          {t('noPudimosCargarEnlacesCorto')}
        </p>
      )}
      {estado.enlaces && (
        <EnlacesReserva enlaces={estado.enlaces} seccion="hospedaje" destino={destino} origen="app" />
      )}
    </details>
  );
}

export default function DetalleViaje() {
  const { t } = useTranslation('detalleViaje');
  const { t: tDominio } = useTranslation('dominio');
  const td = (slug) => traducirDominio(tDominio, slug);
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
  const [confirmar, setConfirmar] = useState(null);
  const [duplicando, setDuplicando] = useState(false);
  const [errorDuplicar, setErrorDuplicar] = useState(null);
  // Para cuántos de los viajeros se ven los precios. null = todos (default).
  const [personas, setPersonas] = useState(null);
  // Resultado de sincronizar el itinerario cuando cambian las fechas del viaje.
  const [avisoItinerario, setAvisoItinerario] = useState(null);
  const [guardandoPropuesta, setGuardandoPropuesta] = useState(false);
  const [vistaPrevia, setVistaPrevia] = useState(false);
  const [errorPropuesta, setErrorPropuesta] = useState(null);

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
          {t('misViajes')}
        </Link>
        <ErrorCarga
          error={viajeReq.error}
          onReintentar={viajeReq.recargar}
          contexto={t('noPudimosCargarViaje')}
        />
      </div>
    );
  }

  const viaje = viajeReq.data.trip;
  const variantes = viajeReq.data.variantes || [];
  const estado = ETIQUETAS_ESTADO[viaje.status] || ETIQUETAS_ESTADO.borrador;
  const textoEstado = tDominio(`estadoViaje.${viaje.status}`, { defaultValue: estado.texto });
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

  /** El agente marca a mano "pagada"/"cancelada", o revierte un cambio. Los
      pasos "enviada"/"aceptada" normalmente los mueve solo el flujo del
      enlace publico (compartir/aceptarPropuesta), pero este select siempre
      queda editable por si hace falta corregirlo. */
  const cambiarEstadoPropuesta = async (e) => {
    setGuardandoPropuesta(true);
    setErrorPropuesta(null);
    try {
      await tripsApi.update(id, { estadoPropuesta: e.target.value });
      refrescar();
    } catch (err) {
      setErrorPropuesta(err.message);
    } finally {
      setGuardandoPropuesta(false);
    }
  };

  /** Copia el viaje completo (logistica, margen, itinerario) para armar una
      variante — "Opcion Economica" vs "Premium" del mismo prospecto. */
  const duplicarViaje = async () => {
    setDuplicando(true);
    setErrorDuplicar(null);
    try {
      const res = await tripsApi.duplicar(id);
      navigate(`/viajes/${res.trip._id}`);
    } catch (err) {
      setErrorDuplicar(err.message || t('noSePudoDuplicar'));
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
          {t('misViajes')}
        </Link>
      </div>

      <header className="tarjeta tarjeta-encabezado fila-entre">
        <div>
          <div className="fila" style={{ gap: 8, marginBottom: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <Insignia color={estado.color}>{textoEstado}</Insignia>
            {esAgencia && (
              <label className="tenue fila" style={{ gap: 6, fontSize: '0.85rem', alignItems: 'center' }}>
                {t('propuesta')}
                <select
                  value={viaje.estadoPropuesta || 'borrador'}
                  onChange={cambiarEstadoPropuesta}
                  disabled={guardandoPropuesta}
                  aria-label={t('estadoDeLaPropuesta')}
                  title={t('loMarcasTuAMano')}
                  style={{ padding: '3px 6px', fontSize: '0.85rem' }}
                >
                  {Object.keys(ETIQUETAS_ESTADO_PROPUESTA).map((valor) => (
                    <option key={valor} value={valor}>
                      {tDominio(`estadoPropuesta.${valor}`, { defaultValue: ETIQUETAS_ESTADO_PROPUESTA[valor].texto })}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <span className="tenue">{tiempoRelativo(viaje.startDate)}</span>
          </div>
          <h1 style={{ marginBottom: 4 }}>{viaje.title}</h1>
          {viaje.client ? (
            <p className="suave" style={{ margin: '0 0 4px', fontSize: '0.92rem' }}>
              {t('clienteCrm')} <strong>{viaje.client.nombre}</strong>
              {viaje.client.telefono ? ` · ${viaje.client.telefono}` : viaje.client.email ? ` · ${viaje.client.email}` : ''}
              {' · '}
              <Link to="/clientes" style={{ color: 'var(--marca)', fontWeight: 500, fontSize: '0.82rem' }}>
                {t('verEnCrm')}
              </Link>
            </p>
          ) : esAgencia && viaje.cliente?.nombre ? (
            <p className="suave" style={{ margin: '0 0 2px' }}>
              {t('para')} <strong>{viaje.cliente.nombre}</strong>
              {viaje.cliente.contacto ? ` · ${viaje.cliente.contacto}` : ''}
            </p>
          ) : null}
          <p className="suave" style={{ margin: 0 }}>
            <Icono nombre="pin" tamano={15} />{' '}
            {viaje.destination?.name}
            {viaje.destination?.country ? `, ${viaje.destination.country}` : ''} ·{' '}
            {rangoFechas(viaje.startDate, viaje.endDate)} · {viaje.durationDays} {t('dias')} ·{' '}
            {viaje.travelers} {viaje.travelers === 1 ? t('viajero') : t('viajeros')}
          </p>
          {viaje.createdAt && (
            <p className="tenue" style={{ margin: '4px 0 0', fontSize: '0.8rem' }}>
              {t('creadoEl', { fecha: formatoFecha(viaje.createdAt) })}
            </p>
          )}
        </div>

        <div className="fila">
          <Link to={`/viajes/${id}/itinerario`} className="boton">
            {itinerario ? t('verItinerario') : t('crearItinerario')}
          </Link>
          <Boton variante="secundario" chico onClick={() => setModal({ tipo: 'viaje' })}>
            <Icono nombre="lapiz" tamano={15} /> {t('editar')}
          </Boton>
          {esAgencia && (
            <Boton variante="secundario" chico onClick={duplicarViaje} cargando={duplicando}>
              {t('duplicar')}
            </Boton>
          )}
          <Boton variante="peligro-texto" chico onClick={() => setConfirmar('viaje')}>
            {t('eliminar')}
          </Boton>
        </div>
      </header>

      {errorDuplicar && <Aviso tipo="error">{errorDuplicar}</Aviso>}

      {avisoItinerario && (
        <Aviso tipo={avisoItinerario.diasSobrantes > 0 ? 'alerta' : 'info'} titulo={t('itinerarioAjustado')}>
          {avisoItinerario.diasAgregados > 0 && t('diasAgregados', { cantidad: avisoItinerario.diasAgregados })}
          {avisoItinerario.diasSobrantes > 0
            ? t('diasSobrantes', { cantidad: avisoItinerario.diasSobrantes, actividades: avisoItinerario.actividadesEnSobrantes })
            : t('fechasActualizadas')}
        </Aviso>
      )}

      {esAgencia && variantes.length > 0 && (
        <Tarjeta
          titulo={viaje.cliente?.nombre ? t('otrasOpcionesPara', { nombre: viaje.cliente.nombre }) : t('otrasOpciones')}
        >
          <div className="fila" style={{ gap: 8, flexWrap: 'wrap' }}>
            {variantes.map((v) => {
              const estadoV = ETIQUETAS_ESTADO[v.status] || ETIQUETAS_ESTADO.borrador;
              const textoEstadoV = tDominio(`estadoViaje.${v.status}`, { defaultValue: estadoV.texto });
              return (
                <Link
                  key={v._id}
                  to={`/viajes/${v._id}`}
                  className="tarjeta-plana fila"
                  style={{ gap: 8, textDecoration: 'none' }}
                >
                  {v.title}
                  <Insignia color={estadoV.color}>{textoEstadoV}</Insignia>
                </Link>
              );
            })}
          </div>
        </Tarjeta>
      )}

      {errorPropuesta && <Aviso tipo="error">{errorPropuesta}</Aviso>}
      {esAgencia && <ResumenCotizacion viaje={viaje} onEditar={() => setModal({ tipo: 'viaje' })} onVistaPrevia={() => setVistaPrevia(true)} />}
      {vistaPrevia && <VistaPreviaPropuesta viaje={viaje} itinerario={itinerario} marca={user?.agency || user?.branding} onCerrar={() => setVistaPrevia(false)} />}
      <div id="costos-viaje" />
      <SelectorPersonas personas={paraCuantos} maximo={viaje.travelers} onCambio={setPersonas} />

      <div className="rejilla rejilla-detalle">
        {/* ----------------- Columna principal ----------------- */}
        <div className="pila">
          <SeccionGasto
            seccion="transporte"
            destino={viaje.destination?.name}
            titulo={t('secciones.transporte')}
            icono={ICONO_MODO[ida?.mode] || 'avion'}
            monto={escalar((ida?.cost || 0) + (vuelta?.cost || 0))}
            moneda={moneda}
            enlaces={enlaces.transporte}
            errorEnlaces={enlacesReq.error}
            onReintentarEnlaces={enlacesReq.recargar}
            vacio={t('secciones.transporteVacio')}
            t={t}
          >
            <div className="pila-sm">
              {[
                { etiqueta: t('secciones.ida'), tramo: 'outbound', datos: ida },
                { etiqueta: t('secciones.vuelta'), tramo: 'inbound', datos: vuelta },
              ].map(({ etiqueta, tramo, datos }) => (
                <div className="linea-gasto" key={tramo}>
                  <span className="crece" style={{ minWidth: 0 }}>
                    <strong>{etiqueta}</strong>{' '}
                    <span className="tenue">
                      {datos?.provider || datos?.cost > 0 ? (
                        <>
                          {td(datos?.mode || '')}
                          {datos?.provider ? ` · ${datos.provider}` : ''}
                          {datos?.bookingRef ? ` · ${datos.bookingRef}` : ''}
                        </>
                      ) : (
                        t('secciones.sinCapturar')
                      )}
                    </span>
                  </span>

                  <span className="numero">
                    {datos?.provider || datos?.cost > 0 ? formatoMoneda(escalar(datos?.cost || 0), moneda) : t('secciones.pendiente')}
                    {datos?.isEstimate && datos?.cost > 0 && (
                      <span className="tenue" style={{ fontWeight: 400 }}> {t('secciones.est')}</span>
                    )}
                  </span>

                  <Boton
                    variante="fantasma"
                    chico
                    onClick={() => setModal({ tipo: 'transporte', tramo })}
                    aria-label={t('secciones.editarTransporteDe', { etiqueta: etiqueta.toLowerCase() })}
                  >
                    <Icono nombre={datos?.cost > 0 || datos?.provider ? 'lapiz' : 'mas'} tamano={15} />
                  </Boton>
                </div>
              ))}
            </div>
            {!hayTransporte && (
              <p className="tenue" style={{ margin: '10px 0 0', fontSize: '0.85rem' }}>
                {t('secciones.buscaEnComparadores')}
              </p>
            )}
          </SeccionGasto>

          <SeccionGasto
            seccion="hospedaje"
            destino={viaje.destination?.name}
            titulo={t('secciones.hospedaje')}
            icono="cama"
            monto={escalar(viaje.coreCosts?.lodging)}
            moneda={moneda}
            enlaces={enlaces.hospedaje}
            errorEnlaces={enlacesReq.error}
            onReintentarEnlaces={enlacesReq.recargar}
            accion={
              <Boton chico variante="secundario" onClick={() => setModal({ tipo: 'hospedaje' })}>
                {t('secciones.agregar')}
              </Boton>
            }
            vacio={t('secciones.necesitasNoches', { cantidad: viaje.nightsCount, unidad: viaje.nightsCount === 1 ? t('secciones.noche') : t('secciones.noches') })}
            t={t}
          >
            {viaje.lodging?.length > 0 && (
              <div className="pila-sm">
                {viaje.lodging.map((l, i) => (
                  <Fragment key={l._id || i}>
                    <div className="linea-gasto">
                      <span className="crece" style={{ minWidth: 0 }}>
                        <strong>{l.name || td(l.type)}</strong>
                        {viaje.additionalDestinations?.length > 0 && (
                          <span style={{ marginLeft: 8 }}>
                            <Insignia color="cielo">{ciudadDeHospedaje(viaje, l)}</Insignia>
                          </span>
                        )}
                        <span className="tenue" style={{ display: 'block', fontSize: '0.82rem' }}>
                          {td(l.type)} · {l.nights} {l.nights === 1 ? t('secciones.noche') : t('secciones.noches')}
                          {l.perNight > 0 ? ` · ${formatoMoneda(l.perNight, moneda)} ${t('secciones.porNoche')}` : ''}
                          {l.isEstimate ? ` · ${t('secciones.estimado')}` : ''}
                        </span>
                      </span>
                      <span className="numero">{formatoMoneda(escalar(l.subtotal), moneda)}</span>
                      <span className="fila" style={{ gap: 0, flexWrap: 'nowrap' }}>
                        <Boton
                          variante="fantasma"
                          chico
                          onClick={() => setModal({ tipo: 'hospedaje', indice: i })}
                          aria-label={t('secciones.editarHospedaje')}
                        >
                          <Icono nombre="lapiz" tamano={14} />
                        </Boton>
                        <Boton
                          variante="fantasma"
                          chico
                          onClick={() => setConfirmar({ campo: 'lodging', indice: i, nombre: l.name || td(l.type) })}
                          aria-label={t('secciones.eliminarHospedaje')}
                        >
                          <Icono nombre="cerrar" tamano={14} />
                        </Boton>
                      </span>
                    </div>
                    {/* Con 2+ hospedajes el bloque general de arriba (lodging[0])
                        ya no basta para saber donde reservar cada uno. */}
                    {viaje.lodging.length > 1 && (
                      <EnlacesHospedaje tripId={id} indice={i} destino={ciudadDeHospedaje(viaje, l)} t={t} />
                    )}
                  </Fragment>
                ))}
              </div>
            )}
          </SeccionGasto>

          <SeccionGasto
            seccion="transporte-local"
            destino={viaje.destination?.name}
            titulo={t('secciones.transporteLocal')}
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
                {t('secciones.agregar')}
              </Boton>
            }
            vacio={t('secciones.transporteLocalVacio')}
            t={t}
          >
            {viaje.localTransport?.length > 0 && (
              <div className="pila-sm">
                {viaje.localTransport.map((tr, i) => (
                  <div className="linea-gasto" key={tr._id || i}>
                    <span className="crece" style={{ minWidth: 0 }}>
                      <strong>{td(tr.type)}</strong>
                      {(tr.provider || tr.notes) && (
                        <span className="tenue" style={{ display: 'block', fontSize: '0.82rem' }}>
                          {[tr.provider, tr.notes].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </span>
                    <span className="numero">{formatoMoneda(escalar(tr.estimatedCost), moneda)}</span>
                    <span className="fila" style={{ gap: 0, flexWrap: 'nowrap' }}>
                      <Boton
                        variante="fantasma"
                        chico
                        onClick={() => setModal({ tipo: 'transporte-local', indice: i })}
                        aria-label={t('secciones.editarTransporteLocal')}
                      >
                        <Icono nombre="lapiz" tamano={14} />
                      </Boton>
                      <Boton
                        variante="fantasma"
                        chico
                        onClick={() => setConfirmar({ campo: 'localTransport', indice: i, nombre: td(tr.type) })}
                        aria-label={t('secciones.eliminarTransporteLocal')}
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
            titulo={t('secciones.itinerario')}
            accion={
              <Link to={`/viajes/${id}/itinerario`} className="boton secundario chico">
                {itinerario ? t('secciones.abrir') : t('secciones.crear')}
              </Link>
            }
          >
            {itinerario ? (
              <div className="fila" style={{ gap: 8 }}>
                <Insignia color="marca">
                  {itinerario.days?.length} {itinerario.days?.length === 1 ? t('secciones.dia') : t('dias')}
                </Insignia>
                <Insignia>{itinerario.activityCount} {t('secciones.actividades')}</Insignia>
                <Insignia color={itinerario.generatedBy === 'ia' ? 'cielo' : ''}>
                  {itinerario.generatedBy === 'ia' ? <><Icono nombre="chispa" tamano={14} /> {t('secciones.asistidoConIA')}</> : t('secciones.armadoAMano')}
                </Insignia>
              </div>
            ) : (
              <Vacio icono={<Icono nombre="chispa" tamano={28} />} titulo={t('secciones.sinItinerario')}>
                {t('secciones.sinItinerarioTexto')}
              </Vacio>
            )}
          </Tarjeta>
        </div>

        {/* ----------------- Columna lateral ----------------- */}
        <div className="pila">
          <Tarjeta titulo={t('secciones.dondeQueda')}>
            <Suspense fallback={<div className="mapa" />}>
              <MapaDestino
                destino={viaje.destination}
                destinosExtra={viaje.additionalDestinations?.map((p) => p.place)}
              />
            </Suspense>
          </Tarjeta>

          <Tarjeta titulo={t('secciones.climaDuranteElViaje')}>
            {climaReq.cargando && <Cargando texto={t('secciones.consultandoClima')} />}
            {climaReq.error && (
              <p className="tenue" style={{ margin: 0 }}>
                {t('secciones.noPudimosTraerClima')} {climaReq.error.message}
              </p>
            )}
            {climaReq.data && <TiraClima clima={climaReq.data} />}
          </Tarjeta>

          {climaReq.data?.paradas?.map((parada, i) => (
            <Tarjeta key={i} titulo={t('secciones.climaEnParada', { lugar: parada.place?.name || t('secciones.laParada') })}>
              {parada.error ? (
                <p className="tenue" style={{ margin: 0 }}>
                  {t('secciones.noPudimosTraerClimaParada')} {parada.error}
                </p>
              ) : (
                <TiraClima clima={parada} />
              )}
            </Tarjeta>
          ))}



          {resumenReq.cargando && <Esqueleto alto={280} />}
          {resumenReq.error && (
            <ErrorCarga
              error={resumenReq.error}
              onReintentar={resumenReq.recargar}
              contexto={t('secciones.presupuesto')}
            />
          )}
          {resumenReq.data && <ResumenPresupuesto resumen={resumenReq.data} />}
        </div>
      </div>



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

      <ModalConfirmar
        abierto={confirmar === 'viaje'}
        onCerrar={() => setConfirmar(null)}
        onConfirmar={eliminarViaje}
        titulo={t('eliminarViajeTitulo')}
        mensaje={t('eliminarViajeMensaje', { titulo: viaje.title })}
      />

      <ModalConfirmar
        abierto={Boolean(confirmar?.campo)}
        onCerrar={() => setConfirmar(null)}
        onConfirmar={() => quitarDeLista(confirmar.campo, confirmar.indice)}
        titulo={t('eliminar')}
        mensaje={t('eliminarMensaje', { nombre: confirmar?.nombre })}
      />
    </div>
  );
}
