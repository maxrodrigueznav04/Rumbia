import { Suspense, lazy, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { publicApi } from '../api/index.js';
import useFetch from '../hooks/useFetch.js';
import EnlacesReserva from '../components/EnlacesReserva.jsx';
import ResumenViaje from '../components/ResumenViaje.jsx';
import SelectorPersonas from '../components/SelectorPersonas.jsx';
import { EncabezadoImpresion, PieImpresion, estiloPersonalizado, cargarFuentePdf } from '../components/HojaImpresion.jsx';
import useMarcaImpresion from '../hooks/useMarcaImpresion.js';
import Icono from '../components/Icono.jsx';
import { Boton, Tarjeta, Insignia, Cargando, ErrorCarga, Vacio, Aviso } from '../components/ui.jsx';
import {
  formatoFecha,
  formatoMoneda,
  rangoFechas,
  traducirDominio,
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
  const { t } = useTranslation('itinerarioCompartido');
  const { t: tItinerario } = useTranslation('itinerario');
  const { t: tDominio } = useTranslation('dominio');
  const { t: tComun } = useTranslation('comun');
  const { token } = useParams();
  const { data, cargando, error, recargar } = useFetch(
    ({ signal }) => publicApi.verCompartido(token, { signal }),
    [token]
  );
  // Para cuántos de los viajeros se ven los precios. null = todos (default).
  const [personas, setPersonas] = useState(null);
  const [aceptando, setAceptando] = useState(false);
  const [errorAceptar, setErrorAceptar] = useState(null);
  const moneda = data?.viaje?.budget?.currency || 'MXN';
  useMarcaImpresion(data?.marca);
  const paraCuantos = data
    ? Math.min(personas ?? data.viaje.travelers, data.viaje.travelers)
    : 1;
  const ocultarCosto = Boolean(data?.viaje?.ocultarDesglose);

  // Descarga la tipografia elegida por quien comparte el enlace, solo si
  // hace falta (no es la de Rumbia).
  useEffect(() => {
    cargarFuentePdf(data?.marca);
  }, [data?.marca?.marcaBlanca, data?.marca?.fuentePdf]);

  const aceptarPropuesta = async () => {
    setAceptando(true);
    setErrorAceptar(null);
    try {
      await publicApi.aceptarPropuesta(token);
      recargar();
    } catch (err) {
      setErrorAceptar(err.message || t('noSePudoAceptar'));
    } finally {
      setAceptando(false);
    }
  };

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
            {t('planearMiViaje')}
          </Link>
        </div>
      </header>

      <main className="contenedor pagina">
        {cargando && <Cargando texto={t('abriendoItinerario')} />}

        {error && !cargando && (
          error.status === 404 ? (
            <Vacio titulo={t('enlaceNoFunciona.titulo')}>
              {t('enlaceNoFunciona.texto')}
            </Vacio>
          ) : (
            <ErrorCarga error={error} onReintentar={recargar} contexto={t('noPudimosAbrirlo')} />
          )
        )}

        {data && (
          <div className="pila" style={estiloPersonalizado(data.marca)}>
            {/* Solo se ve al imprimir; en pantalla lo oculta global.css. Es la
                marca de quien compartio el enlace, no de quien lo abre. */}
            <EncabezadoImpresion marca={data.marca} viaje={data.viaje} />

            <header className="fila-entre no-imprimir">
              <div>
                <span className="etiqueta">{t('itinerarioCompartido')}</span>
                <h1 style={{ margin: '4px 0' }}>{data.viaje.title}</h1>
                <p className="suave" style={{ margin: 0 }}>
                  {nombreDestino(data.viaje)} · {rangoFechas(data.viaje.startDate, data.viaje.endDate)} ·{' '}
                  {data.viaje.durationDays} {tItinerario('diasPlural')} · {data.viaje.travelers}{' '}
                  {data.viaje.travelers === 1 ? t('viajero') : t('viajeros')}
                </p>
              </div>
              <Boton variante="secundario" chico onClick={() => window.print()}>
                <Icono nombre="descarga" tamano={15} /> {tItinerario('descargarPdf')}
              </Boton>
            </header>

            <SelectorPersonas personas={paraCuantos} maximo={data.viaje.travelers} onCambio={setPersonas} />
            <ResumenViaje viaje={data.viaje} personas={paraCuantos} />

            <div className="rejilla rejilla-detalle">
              <div className="pila">
                {data.itinerary.days.map((dia) => (
                  <Tarjeta
                    key={dia._id || dia.dayNumber}
                    titulo={t('dia', { numero: dia.dayNumber, fecha: formatoFecha(dia.date) })}
                  >
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
                              <Insignia>{traducirDominio(tDominio, a.category)}</Insignia>
                              {!ocultarCosto && a.estimatedCost > 0 && (
                                <Insignia color="ambar">
                                  ≈ {formatoMoneda(a.estimatedCost, moneda)} {tItinerario('porPersona')}
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
                {/* Con el desglose oculto, el servidor ya no manda totalEstimatedCost
                    ni coreCosts.total (ver public.controller.js): precioTotalPorPersona
                    es la señal de que hay un precio que mostrar en ese caso. */}
                {(data.viaje.precioTotalPorPersona > 0 ||
                  data.itinerary.totalEstimatedCost > 0 ||
                  data.viaje.coreCosts?.total > 0) && (
                  <Tarjeta titulo={tItinerario('precioPropuestoMoneda', { moneda })}>
                    {!ocultarCosto && (
                      <div className="pila-sm">
                        <div className="linea-gasto">
                          <span className="suave">{tItinerario('actividadesLinea')}</span>
                          <span className="numero">
                            {formatoMoneda(data.itinerary.totalEstimatedCost, moneda)}
                          </span>
                        </div>
                        <div className="linea-gasto">
                          <span className="suave">{tItinerario('idaYVueltaHospedaje')}</span>
                          <span className="numero">
                            {formatoMoneda(
                              porPersonas(data.viaje.coreCosts?.total || 0, data.viaje.travelers, 1),
                              moneda
                            )}
                          </span>
                        </div>
                        {data.viaje.margenPorPersona > 0 && (
                          <div className="linea-gasto">
                            <span className="suave">{tItinerario('cuotaDeServicio')}</span>
                            <span className="numero">
                              {formatoMoneda(data.viaje.margenPorPersona, moneda)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="fila-entre" style={{ marginTop: 12 }}>
                      <span className="suave">{tItinerario('porPersonaLinea')}</span>
                      <span className="numero grande">
                        {formatoMoneda(data.viaje.precioTotalPorPersona, moneda)}
                      </span>
                    </div>
                    <div className="fila-entre" style={{ marginTop: 6 }}>
                      <span className="suave">
                        {paraCuantos} {paraCuantos === 1 ? t('viajero') : t('viajeros')}
                      </span>
                      <span className="numero">
                        {formatoMoneda(data.viaje.precioTotalPorPersona * paraCuantos, moneda)}
                      </span>
                    </div>
                    <p className="tenue" style={{ margin: '12px 0 0', fontSize: '0.8rem' }}>
                      {t('notaEstimacion')}
                    </p>

                    {['borrador', 'enviada'].includes(data.viaje.estadoPropuesta) && (
                      <div style={{ marginTop: 14 }}>
                        {errorAceptar && <Aviso tipo="error">{errorAceptar}</Aviso>}
                        <Boton ancho cargando={aceptando} onClick={aceptarPropuesta}>
                          <Icono nombre="palomita" tamano={16} /> {t('aceptarPropuesta')}
                        </Boton>
                      </div>
                    )}

                    {['aceptada', 'pagada'].includes(data.viaje.estadoPropuesta) && (
                      <div style={{ marginTop: 14 }}>
                        <Aviso tipo="exito" titulo={t('propuestaAceptada.titulo')}>
                          {t('propuestaAceptada.texto')}
                        </Aviso>
                      </div>
                    )}
                  </Tarjeta>
                )}

                {data.pins?.length > 0 && (
                  <Tarjeta titulo={tItinerario('actividadesEnElMapa')} className="no-imprimir">
                    <Suspense fallback={<Cargando texto="Cargando mapa..." />}>
                      <MapaDestino
                        pines={data.pins}
                        destinosExtra={data.viaje.additionalDestinations?.map((p) => p.place)}
                      />
                    </Suspense>
                  </Tarjeta>
                )}

                <Tarjeta titulo={t('buscarYReservar.titulo')} className="no-imprimir">
                  <p className="suave">
                    {t('buscarYReservar.texto')}
                  </p>
                  {Object.entries(data.links || {}).map(([seccion, enlaces]) => (
                    <div key={seccion} style={{ marginBottom: 'var(--e4)' }}>
                      <span className="etiqueta">{traducirDominio(tDominio, seccion)}</span>
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
                  <h3>{t('ctaFinal.titulo')}</h3>
                  <p className="suave">{t('ctaFinal.texto')}</p>
                  <Link to="/" className="boton">
                    {t('ctaFinal.boton')}
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
            {t('pie.aviso')}
          </p>
          <nav className="pie-enlaces" aria-label={t('pie.ariaEnlaces')}>
            <Link to="/acerca">{tComun('piePagina.acercaDe')}</Link>
            <Link to="/privacidad">{tComun('piePagina.privacidad')}</Link>
            <Link to="/cookies">{tComun('piePagina.cookies')}</Link>
            <Link to="/terminos">{tComun('piePagina.terminos')}</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
