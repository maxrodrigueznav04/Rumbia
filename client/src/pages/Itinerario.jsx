import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { tripsApi, itineraryApi } from '../api/index.js';
import useFetch from '../hooks/useFetch.js';
import FormActividad from '../components/formularios/FormActividad.jsx';
import FormDia from '../components/formularios/FormDia.jsx';
import {
  Boton,
  Campo,
  Tarjeta,
  Insignia,
  Vacio,
  ErrorCarga,
  Esqueleto,
  Aviso,
  Modal,
  ModalConfirmar,
} from '../components/ui.jsx';
import Icono from '../components/Icono.jsx';
import ResumenViaje from '../components/ResumenViaje.jsx';
import VistaPreviaPropuesta from '../components/VistaPreviaPropuesta.jsx';
import { viajeParaCliente } from '../utils/cotizacion.js';
import SelectorPersonas from '../components/SelectorPersonas.jsx';
import RevisionItinerario from '../components/RevisionItinerario.jsx';
import { EncabezadoImpresion, PieImpresion, estiloPersonalizado, cargarFuentePdf } from '../components/HojaImpresion.jsx';
import useMarcaImpresion from '../hooks/useMarcaImpresion.js';
import { useAuth } from '../context/AuthContext.jsx';
import { revisarItinerario } from '../utils/revisionItinerario.js';
import {
  formatoMoneda,
  formatoFecha,
  traducirDominio,
  porPersonas,
  conMargen,
  ICONOS_CATEGORIA,
} from '../utils/format.js';

const MapaDestino = lazy(() => import('../components/MapaDestino.jsx'));

// Debe coincidir con MAX_DIAS_GENERAR_IA (itinerary.controller.js): ahi es
// donde de verdad se hace cumplir. Aqui solo evita que alguien llene el
// formulario, espere la generacion y hasta el final se entere del rechazo.
const LIMITE_DIAS_IA = 30;

function Actividad({ actividad, moneda, ocultarCosto, onEditar, onEliminar, dnd, t, td }) {
  // La IA a veces repite el título como nombre del lugar: no vale la pena mostrarlo dos veces.
  const lugar = actividad.location?.name;
  const mostrarLugar = lugar && lugar.trim().toLowerCase() !== actividad.title.trim().toLowerCase();

  return (
    <article
      className={`actividad ${dnd.arrastrando ? 'arrastrando' : ''} ${dnd.encima ? 'encima' : ''}`}
      data-dia={dnd.diaId}
      data-indice={dnd.indice}
      draggable
      onDragStart={dnd.onDragStart}
      onDragOver={dnd.onDragOver}
      onDrop={dnd.onDrop}
      onDragEnd={dnd.onDragEnd}
    >
      {/* Boton, no un span decorativo: con teclado se enfoca y se mueve con las
          flechas, y en tactil es el unico punto por el que se arrastra (asi la
          tarjeta entera sigue permitiendo desplazar la pagina). */}
      <button
        type="button"
        className="agarradera"
        aria-label={t('actividad.reordenar', { titulo: actividad.title })}
        onPointerDown={dnd.onPointerDown}
        onKeyDown={dnd.onKeyDown}
      >
        <Icono nombre="arrastrar" tamano={16} />
      </button>

      <div className="actividad-hora">{actividad.time || '—'}</div>

      <div className="actividad-cuerpo">
        <h4>
          <span aria-hidden="true">{ICONOS_CATEGORIA[actividad.category] || '📍'}</span>{' '}
          {actividad.title}
        </h4>
        {actividad.description && <p>{actividad.description}</p>}

        <div className="fila" style={{ gap: 6 }}>
          <Insignia>{td(actividad.category)}</Insignia>
          {!ocultarCosto && actividad.estimatedCost > 0 && (
            <Insignia color="ambar">{formatoMoneda(actividad.estimatedCost, moneda)}</Insignia>
          )}
          {actividad.durationMinutes > 0 && (
            // Envuelta para poder ocultarla solo al imprimir (ver .duracion-actividad
            // en global.css): en el PDF ya es la cuarta etiqueta de la fila
            // (categoria + precio + duracion + lugar) y sobra -- categoria y precio
            // son lo que de verdad importa ahi. En pantalla, editando, si es util.
            <span className="duracion-actividad">
              <Insignia>
                {actividad.durationMinutes >= 60
                  ? `${Math.round((actividad.durationMinutes / 60) * 10) / 10} h`
                  : `${actividad.durationMinutes} min`}
              </Insignia>
            </span>
          )}
          {mostrarLugar && (
            <span className="tenue" style={{ fontSize: '0.8rem' }}>
              📍 {lugar}
            </span>
          )}
          {actividad.bookingUrl && (
            <a href={actividad.bookingUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem' }}>
              {t('actividad.reservar')}
            </a>
          )}
        </div>
      </div>

      <div className="actividad-acciones">
        <Boton variante="fantasma" chico onClick={onEditar} aria-label={t('actividad.editarAria', { titulo: actividad.title })} title={t('actividad.editar')}>
          ✎
        </Boton>
        <Boton variante="fantasma" chico onClick={onEliminar} aria-label={t('actividad.eliminarAria', { titulo: actividad.title })} title={t('actividad.eliminar')}>
          ✕
        </Boton>
      </div>
    </article>
  );
}

export default function Itinerario() {
  const { t } = useTranslation('itinerario');
  const { t: tDominio } = useTranslation('dominio');
  const td = (slug) => traducirDominio(tDominio, slug);
  const { id } = useParams();
  const [params] = useSearchParams();
  const [vistaPrevia, setVistaPrevia] = useState(params.get('entregar') === '1');
  // Solo para el membrete del PDF: si el usuario pertenece a una agencia, su
  // marca gana sobre la personal (mismo criterio que el enlace compartido).
  const { user } = useAuth();
  const marca = user?.agency ?? user?.branding;
  useMarcaImpresion(marca);

  // Descarga la tipografia elegida solo si hace falta (no es la de Rumbia).
  useEffect(() => {
    cargarFuentePdf(marca);
  }, [marca?.marcaBlanca, marca?.fuentePdf]);

  const viajeReq = useFetch(({ signal }) => tripsApi.get(id, { signal }), [id]);
  const itinReq = useFetch(({ signal }) => itineraryApi.get(id, { signal }), [id]);
  const climaReq = useFetch(({ signal }) => tripsApi.weather(id, { signal }), [id]);

  const [generando, setGenerando] = useState(false);
  const [errorGen, setErrorGen] = useState(null);
  const [notas, setNotas] = useState('');
  const [modal, setModal] = useState(null); // { dia, actividad? }
  const [porEliminar, setPorEliminar] = useState(null);
  const [diaPorEliminar, setDiaPorEliminar] = useState(null);
  const [diaEnEdicion, setDiaEnEdicion] = useState(null);
  const [confirmarRegenerar, setConfirmarRegenerar] = useState(false);
  const [compartir, setCompartir] = useState(null); // { token } | null
  const [copiado, setCopiado] = useState(false);
  const [trabajandoEnlace, setTrabajandoEnlace] = useState(false);
  const [arrastre, setArrastre] = useState(null); // { diaId, indice }
  const [destino, setDestino] = useState(null); // { diaId, indice }
  // Para cuántos de los viajeros se ven los precios. null = todos (default).
  const [personas, setPersonas] = useState(null);
  const [plantillaAbierta, setPlantillaAbierta] = useState(params.get('plantilla') === '1');
  const [nombrePlantilla, setNombrePlantilla] = useState('');
  const [guardandoPlantilla, setGuardandoPlantilla] = useState(false);
  const [errorPlantilla, setErrorPlantilla] = useState(null);
  const [plantillaGuardada, setPlantillaGuardada] = useState(false);

  const viaje = viajeReq.data?.trip;
  const itinerario = itinReq.data?.itinerary;
  const pines = itinReq.data?.pins || [];
  const avisosRevision = useMemo(
    () => revisarItinerario(itinerario, climaReq.data),
    [itinerario, climaReq.data]
  );
  const moneda = viaje?.budget?.currency || 'MXN';
  const paraCuantos = Math.min(personas ?? viaje?.travelers ?? 1, viaje?.travelers || 1);
  const ocultarCosto = Boolean(viaje?.ocultarDesglose);
  const hayMargen = Boolean(viaje?.margen?.monto > 0);
  const costoSinMargen =
    (itinerario?.totalEstimatedCost || 0) + porPersonas(viaje?.coreCosts?.total || 0, viaje?.travelers, 1);
  const precioBasePorPersona = Number(conMargen(costoSinMargen, viaje?.margen, viaje?.travelers).toFixed(2));

  const generar = async (regenerar = false) => {
    setErrorGen(null);
    setGenerando(true);
    try {
      await itineraryApi.generate(id, {
        extraNotes: notas.trim() || undefined,
        force: regenerar,
      });
      itinReq.recargar();
      viajeReq.recargar();
      setNotas('');
    } catch (err) {
      // Si el navegador cortó la espera (status 0), el servidor pudo haber
      // terminado igual: sin esto el reintento choca con un 409 "ya tiene
      // itinerario" y el usuario ve un error sobre algo que sí funcionó.
      if (err.status === 0) {
        try {
          const datos = await itineraryApi.get(id);
          if (datos?.itinerary) {
            itinReq.recargar();
            viajeReq.recargar();
            setNotas('');
            return;
          }
        } catch {
          /* si tampoco responde, se muestra el error original */
        }
      }
      setErrorGen(err);
    } finally {
      setGenerando(false);
    }
  };

  const armarEnBlanco = async () => {
    setErrorGen(null);
    try {
      await itineraryApi.createBlank(id);
      itinReq.recargar();
    } catch (err) {
      setErrorGen(err);
    }
  };

  const enlacePublico = compartir ? `${window.location.origin}/i/${compartir.token}` : null;
  const destinoWhatsApp = viaje?.destination?.name ? t('compartirWhatsapp.aDestino', { nombre: viaje.destination.name }) : '';
  const mensajeWhatsApp = enlacePublico
    ? t(viaje?.cliente?.nombre ? 'compartirWhatsapp.conCliente' : 'compartirWhatsapp.sinCliente', {
        nombre: viaje?.cliente?.nombre,
        destino: destinoWhatsApp,
        enlace: enlacePublico,
      })
    : '';

  const generarEnlace = async () => {
    setTrabajandoEnlace(true);
    setErrorGen(null);
    try {
      const datos = await itineraryApi.compartir(id);
      setCompartir({ token: datos.token });
      setCopiado(false);
      return true;
    } catch (err) {
      setErrorGen(err);
      return false;
    } finally {
      setTrabajandoEnlace(false);
    }
  };

  const revocarEnlace = async () => {
    setTrabajandoEnlace(true);
    try {
      await itineraryApi.dejarDeCompartir(id);
      setCompartir(null);
    } catch (err) {
      setErrorGen(err);
    } finally {
      setTrabajandoEnlace(false);
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(enlacePublico);
      setCopiado(true);
    } catch {
      // Sin permiso de portapapeles (o sin HTTPS) el input sigue ahi para
      // seleccionarlo a mano: no se deja al usuario sin salida.
      setCopiado(false);
    }
  };

  const guardarComoPlantilla = async (e) => {
    e.preventDefault();
    setErrorPlantilla(null);
    setGuardandoPlantilla(true);
    try {
      await itineraryApi.guardarComoPlantilla(id, { name: nombrePlantilla.trim() });
      setPlantillaAbierta(false);
      setNombrePlantilla('');
      setPlantillaGuardada(true);
      setTimeout(() => setPlantillaGuardada(false), 4000);
    } catch (err) {
      setErrorPlantilla(err.message);
    } finally {
      setGuardandoPlantilla(false);
    }
  };

  /* ---------- Arrastrar y soltar ----------
     Dentro del mismo día se reordena; entre días se mueve la actividad al día
     destino. Son dos endpoints distintos porque el backend los trata distinto:
     reordenar solo permuta ids, mover recrea el subdocumento en otro día. */

  /**
   * El origen llega como parametro y no se lee del estado a proposito: el
   * arrastre tactil resuelve el destino dentro de un manejador creado en el
   * pointerdown, cuando React todavia no habia aplicado setArrastre. Leyendo
   * `arrastre` ahi se veia null y el movimiento se descartaba en silencio.
   */
  const moverActividad = async (origen, diaDestino, indiceDestino) => {
    if (!origen || !diaDestino) return;

    const mismoDia = origen.diaId === diaDestino._id;
    if (mismoDia && origen.indice === indiceDestino) return;

    try {
      if (mismoDia) {
        const ids = diaDestino.activities.map((a) => a._id);
        const [movido] = ids.splice(origen.indice, 1);
        ids.splice(indiceDestino, 0, movido);
        await itineraryApi.reorder(id, diaDestino._id, ids);
      } else {
        await itineraryApi.moveActivity(id, origen.diaId, origen.actividadId, {
          targetDayNumber: diaDestino.dayNumber,
          position: indiceDestino,
        });
      }
      itinReq.recargar();
    } catch (err) {
      setErrorGen(err);
    } finally {
      setArrastre(null);
      setDestino(null);
    }
  };

  /** Con raton el estado ya esta aplicado cuando se suelta. */
  const alSoltar = (diaDestino, indiceDestino) =>
    moverActividad(arrastre, diaDestino, indiceDestino);

  /**
   * Mueve una actividad dentro de su dia. Es lo que usan las flechas del
   * teclado, y lo que hace falta para que reordenar no dependa del raton.
   */
  const moverEnDia = async (dia, desde, hasta) => {
    if (hasta < 0 || hasta >= dia.activities.length || desde === hasta) return;
    const ids = dia.activities.map((a) => a._id);
    const [movido] = ids.splice(desde, 1);
    ids.splice(hasta, 0, movido);
    try {
      await itineraryApi.reorder(id, dia._id, ids);
      itinReq.recargar();
    } catch (err) {
      setErrorGen(err);
    }
  };

  /**
   * Arrastre tactil. El API de drag-and-drop de HTML5 no dispara con el dedo,
   * asi que en tactil se sigue el puntero a mano: se busca la fila que hay bajo
   * el dedo y esa marca el destino.
   */
  const arrastreTactil = (dia, indice, actividad) => (e) => {
    if (e.pointerType === 'mouse') return; // con raton manda el drag nativo
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    const origen = { diaId: dia._id, indice, actividadId: actividad._id };
    setArrastre(origen);
    let ultimo = null;

    const alMover = (ev) => {
      const bajo = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.actividad');
      if (!bajo?.dataset.dia) return;
      ultimo = { diaId: bajo.dataset.dia, indice: Number(bajo.dataset.indice) };
      setDestino(ultimo);
    };

    const alSoltarDedo = () => {
      window.removeEventListener('pointermove', alMover);
      window.removeEventListener('pointerup', alSoltarDedo);
      window.removeEventListener('pointercancel', alSoltarDedo);

      const diaDestino = ultimo && itinerario?.days?.find((d) => d._id === ultimo.diaId);
      if (diaDestino) {
        moverActividad(origen, diaDestino, ultimo.indice);
      } else {
        setArrastre(null);
        setDestino(null);
      }
    };

    window.addEventListener('pointermove', alMover);
    window.addEventListener('pointerup', alSoltarDedo);
    window.addEventListener('pointercancel', alSoltarDedo);
  };

  const dndProps = (dia, indice, actividad) => ({
    diaId: dia._id,
    indice,
    onPointerDown: arrastreTactil(dia, indice, actividad),
    onKeyDown: (e) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      moverEnDia(dia, indice, indice + (e.key === 'ArrowUp' ? -1 : 1));
    },
    arrastrando: arrastre?.actividadId === actividad._id,
    encima:
      destino?.diaId === dia._id &&
      destino.indice === indice &&
      !(arrastre?.diaId === dia._id && arrastre.indice === indice),
    onDragStart: (e) => {
      // Firefox no inicia el arrastre sin datos en el dataTransfer.
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', actividad._id);
      setArrastre({ diaId: dia._id, indice, actividadId: actividad._id });
    },
    onDragOver: (e) => {
      if (!arrastre) return;
      e.preventDefault();
      e.stopPropagation(); // que no lo capture también el contenedor del día
      e.dataTransfer.dropEffect = 'move';
      setDestino({ diaId: dia._id, indice });
    },
    onDrop: (e) => {
      e.preventDefault();
      e.stopPropagation();
      alSoltar(dia, indice);
    },
    onDragEnd: () => {
      setArrastre(null);
      setDestino(null);
    },
  });

  /** El día completo también acepta soltar: así se puede mover a un día vacío. */
  const dndDia = (dia) => ({
    onDragOver: (e) => {
      if (!arrastre) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDestino({ diaId: dia._id, indice: dia.activities.length });
    },
    onDrop: (e) => {
      e.preventDefault();
      alSoltar(dia, dia.activities.length);
    },
  });

  if (viajeReq.cargando || itinReq.cargando) {
    return (
      <div className="pila">
        <Esqueleto alto={24} ancho="40%" />
        <Esqueleto alto={160} />
        <Esqueleto alto={160} />
      </div>
    );
  }

  if (viajeReq.error) {
    return <ErrorCarga error={viajeReq.error} onReintentar={viajeReq.recargar} contexto={t('contextoViaje')} />;
  }

  // Sin esto, si fallaba la peticion del itinerario (pero la del viaje si
  // cargaba) la pantalla mostraba "Deja que la IA arme tu plan" como si el
  // viaje de verdad no tuviera itinerario, en vez de avisar del error.
  if (itinReq.error) {
    return <ErrorCarga error={itinReq.error} onReintentar={itinReq.recargar} contexto={t('titulo')} />;
  }

  return (
    <div className="pila" style={estiloPersonalizado(marca)}>
      {/* Solo se ve al imprimir; en pantalla lo oculta global.css. */}
      {itinerario && <EncabezadoImpresion marca={marca} viaje={viaje} />}

      <div className="no-imprimir">
        <Link to={`/viajes/${id}`} className="volver">
          {t('volver', { titulo: viaje.title })}
        </Link>
      </div>

      <header className="fila-entre no-imprimir">
        <div>
          <h1 style={{ marginBottom: 4 }}>{t('titulo')}</h1>
          <p className="suave" style={{ margin: 0 }}>
            {viaje.destination?.name} · {viaje.durationDays} {t('diasPlural')}
            {itinerario && ` · ${itinerario.activityCount} ${t('actividades')}`}
          </p>
        </div>

        {itinerario && (
          <div className="fila" style={{ gap: 8 }}>
            <Boton variante="secundario" onClick={() => window.print()}>
              <Icono nombre="descarga" tamano={15} /> {t('descargarPdf')}
            </Boton>
            <Boton variante="secundario" onClick={() => setVistaPrevia(true)} cargando={trabajandoEnlace}>
              <Icono nombre="flechaSalida" tamano={15} /> {t('revisarYCompartir')}
            </Boton>
            {viaje.durationDays <= LIMITE_DIAS_IA && (
              <Boton
                variante="secundario"
                onClick={() => setConfirmarRegenerar(true)}
                cargando={generando}
              >
                <Icono nombre="chispa" tamano={15} /> {t('regenerar')}
              </Boton>
            )}
            <Boton variante="secundario" onClick={() => setPlantillaAbierta(true)}>
              <Icono nombre="recibo" tamano={15} /> {t('guardarComoPlantilla')}
            </Boton>
          </div>
        )}
      </header>

      {vistaPrevia && itinerario && <VistaPreviaPropuesta viaje={viaje} itinerario={itinerario} marca={marca} onCerrar={() => setVistaPrevia(false)} compartiendo={trabajandoEnlace} error={errorGen?.message} onCompartir={async () => { if (await generarEnlace()) setVistaPrevia(false); }} />}
      {plantillaGuardada && (
        <Aviso tipo="exito" titulo={t('plantillaGuardada')}>
          {t('plantillaGuardadaTexto')}{' '}
          <Link to="/plantillas">{t('plantillas')}</Link>.
        </Aviso>
      )}

      {enlacePublico && (
        <div className="no-imprimir">
          <Aviso tipo="exito" titulo={t('enlaceListo')}>
            <p style={{ margin: '2px 0 8px' }}>
              {t('enlaceListoTexto')}
            </p>
            <div className="fila" style={{ gap: 8 }}>
              <input
                className="enlace-compartir"
                readOnly
                value={enlacePublico}
                onFocus={(e) => e.target.select()}
                aria-label={t('enlacePublicoAria')}
              />
              <Boton chico onClick={copiar}>
                {copiado ? t('copiado') : t('copiar')}
              </Boton>
              <a
                className="boton secundario chico"
                href={`https://wa.me/?text=${encodeURIComponent(mensajeWhatsApp)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp
              </a>
              <Boton variante="peligro-texto" chico onClick={revocarEnlace} cargando={trabajandoEnlace}>
                {t('dejarDeCompartir')}
              </Boton>
            </div>
          </Aviso>
        </div>
      )}

      {errorGen && (
        <ErrorCarga
          error={errorGen}
          contexto={
            errorGen.status === 429
              ? t('limiteAlcanzado')
              : t('noPudimosGenerar')
          }
        />
      )}

      <SelectorPersonas personas={paraCuantos} maximo={viaje.travelers} onCambio={setPersonas} />
      <div className="no-imprimir"><ResumenViaje viaje={viaje} personas={paraCuantos} /></div>
      <div className="solo-imprimir"><ResumenViaje viaje={viajeParaCliente(viaje)} personas={paraCuantos} /></div>

      {/* ---------- Sin itinerario: invitación a generarlo ---------- */}
      {!itinerario && viaje.durationDays > LIMITE_DIAS_IA && (
        <Tarjeta>
          <Vacio
            icono="✨"
            titulo={t('muyLargoTitulo')}
            accion={
              <div className="fila" style={{ justifyContent: 'center' }}>
                <Boton onClick={armarEnBlanco}>{t('armarloYoMismo')}</Boton>
              </div>
            }
          >
            {t('muyLargoTexto', { limite: LIMITE_DIAS_IA, dias: viaje.durationDays })}
          </Vacio>
        </Tarjeta>
      )}

      {!itinerario && viaje.durationDays <= LIMITE_DIAS_IA && (
        <Tarjeta>
          <Vacio
            icono="✨"
            titulo={t('dejaQueLaIA')}
            accion={
              <div className="fila" style={{ justifyContent: 'center' }}>
                <Boton onClick={() => generar(false)} cargando={generando}>
                  {generando ? t('generando') : t('generarItinerario')}
                </Boton>
                <Boton variante="secundario" onClick={armarEnBlanco}>
                  {t('armarloYo')}
                </Boton>
              </div>
            }
          >
            {t('conIaTexto')}
          </Vacio>

          <div className="campo" style={{ marginTop: 18 }}>
            <label htmlFor="notas">{t('algoQueConsiderar')}</label>
            <textarea
              id="notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              maxLength={500}
              placeholder={t('notasPlaceholder')}
            />
            <span className="campo-ayuda">{notas.length}/500</span>
          </div>

          {generando && (
            <Aviso tipo="info" titulo={t('generandoTuItinerario')}>
              {t('generandoTexto')}
            </Aviso>
          )}
        </Tarjeta>
      )}

      {/* ---------- Con itinerario ---------- */}
      {itinerario && (
        <div className="rejilla rejilla-detalle">
          <div className="pila">
            {itinerario.generatedBy === 'ia' && (
              <div className="no-imprimir">
                <Aviso tipo="info">
                  {t('asistidoConIaAviso')}
                </Aviso>
              </div>
            )}

            <RevisionItinerario avisos={avisosRevision} />

            {itinerario.days.length > viaje.durationDays && (
              <Aviso tipo="alerta" titulo={t('diasFueraDelViaje')}>
                {t('diasFueraTexto', { diasItinerario: itinerario.days.length, diasViaje: viaje.durationDays })}
              </Aviso>
            )}

            {itinerario.days.map((dia) => (
              <div
                className={`dia ${dia.dayNumber > viaje.durationDays ? 'fuera-de-rango' : ''} ${
                  arrastre && destino?.diaId === dia._id && arrastre.diaId !== dia._id
                    ? 'dia-destino'
                    : ''
                }`}
                key={dia._id}
                {...dndDia(dia)}
              >
                <div className="dia-encabezado">
                  <div className="fila-entre">
                    <div className="dia-num">
                      {t('dia', { numero: dia.dayNumber })}
                      {dia.date && ` · ${formatoFecha(dia.date, { weekday: 'long', year: undefined })}`}
                    </div>
                    {(dia.dayNumber > viaje.durationDays || itinerario.days.length > 1) && (
                      <span className="fila" style={{ gap: 6 }}>
                        {dia.dayNumber > viaje.durationDays && <Insignia color="error">{t('fueraDelViaje')}</Insignia>}
                        <Boton
                          variante="fantasma"
                          chico
                          onClick={() => setDiaPorEliminar(dia)}
                          title={t('quitarEsteDia')}
                        >
                          ✕
                        </Boton>
                      </span>
                    )}
                  </div>
                  <h3 style={{ margin: '2px 0 2px' }}>
                    {dia.title}{' '}
                    <button
                      type="button"
                      className="editar-inline"
                      onClick={() => setDiaEnEdicion(dia)}
                      aria-label={t('editarTituloDia', { numero: dia.dayNumber })}
                      title={t('editarTituloYResumen')}
                    >
                      ✎
                    </button>
                  </h3>
                  {dia.summary && (
                    <p className="tenue" style={{ margin: 0 }}>
                      {dia.summary}
                    </p>
                  )}
                  {!ocultarCosto && dia.estimatedCost > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <Insignia color="ambar">
                        ≈ {formatoMoneda(dia.estimatedCost, moneda)} {t('porPersona')}
                      </Insignia>
                    </div>
                  )}
                </div>

                {dia.activities.length === 0 ? (
                  <p className="tenue" style={{ fontSize: '0.88rem' }}>
                    {arrastre
                      ? t('sueltaAqui')
                      : t('diaLibre')}
                  </p>
                ) : (
                  dia.activities.map((a, i) => (
                    <Actividad
                      key={a._id}
                      actividad={a}
                      moneda={moneda}
                      ocultarCosto={ocultarCosto}
                      dnd={dndProps(dia, i, a)}
                      onEditar={() => setModal({ dia, actividad: a })}
                      onEliminar={() => setPorEliminar({ dia, actividad: a })}
                      t={t}
                      td={td}
                    />
                  ))
                )}

                <Boton
                  variante="fantasma"
                  chico
                  onClick={() => setModal({ dia })}
                  style={{ marginTop: 4 }}
                >
                  {t('agregarActividad')}
                </Boton>
              </div>
            ))}
          </div>

          <div className="pila">
            <Tarjeta titulo={t('actividadesEnElMapa')} className="no-imprimir">
              <Suspense fallback={<div className="mapa" />}>
                <MapaDestino destino={viaje.destination} pines={pines} alto={340} />
              </Suspense>
              <p className="tenue" style={{ margin: '10px 0 0', fontSize: '0.8rem' }}>
                {pines.length > 0
                  ? t('conUbicacion', { conPin: pines.length, total: itinerario.activityCount })
                  : t('sinCoordenadas')}
              </p>
            </Tarjeta>

            <Tarjeta titulo={t('precioPropuestoMoneda', { moneda })}>
              {!ocultarCosto && (
                <div className="pila-sm">
                  <div className="linea-gasto">
                    <span className="suave">{t('actividadesLinea')}</span>
                    <span className="numero">{formatoMoneda(itinerario.totalEstimatedCost, moneda)}</span>
                  </div>
                  <div className="linea-gasto">
                    <span className="suave">{t('idaYVueltaHospedaje')}</span>
                    <span className="numero">
                      {formatoMoneda(porPersonas(viaje.coreCosts?.total || 0, viaje.travelers, 1), moneda)}
                    </span>
                  </div>
                  {hayMargen && (
                    <div className="linea-gasto">
                      <span className="suave">{t('cuotaDeServicio')}</span>
                      <span className="numero">{formatoMoneda(precioBasePorPersona - costoSinMargen, moneda)}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="fila-entre" style={{ marginTop: 12 }}>
                <span className="suave">{t('porPersonaLinea')}</span>
                <span className="numero grande">{formatoMoneda(precioBasePorPersona, moneda)}</span>
              </div>
              <div className="fila-entre" style={{ marginTop: 6 }}>
                <span className="suave">
                  {paraCuantos} {paraCuantos === 1 ? t('viajero') : t('viajeros')}
                </span>
                <span className="numero">{formatoMoneda(precioBasePorPersona * paraCuantos, moneda)}</span>
              </div>
              <p className="tenue" style={{ margin: '12px 0 0', fontSize: '0.8rem' }}>
                {t('notaEstimacion')}
              </p>
            </Tarjeta>
          </div>
        </div>
      )}

      {itinerario && <PieImpresion marca={marca} />}

      {/* ----------------- Modales ----------------- */}
      {modal && (
        <FormActividad
          abierto
          onCerrar={() => setModal(null)}
          tripId={id}
          dia={modal.dia}
          actividad={modal.actividad}
          onGuardado={() => {
            itinReq.recargar();
            viajeReq.recargar();
          }}
        />
      )}

      <ModalConfirmar
        abierto={Boolean(porEliminar)}
        onCerrar={() => setPorEliminar(null)}
        onConfirmar={async () => {
          await itineraryApi.removeActivity(id, porEliminar.dia._id, porEliminar.actividad._id);
          itinReq.recargar();
          viajeReq.recargar();
        }}
        titulo={t('quitarActividad')}
        mensaje={t('quitarActividadMensaje', { titulo: porEliminar?.actividad?.title, numero: porEliminar?.dia?.dayNumber })}
        textoConfirmar={t('quitar')}
      />

      {diaEnEdicion && (
        <FormDia
          abierto
          onCerrar={() => setDiaEnEdicion(null)}
          tripId={id}
          dia={diaEnEdicion}
          onGuardado={() => itinReq.recargar()}
        />
      )}

      <ModalConfirmar
        abierto={Boolean(diaPorEliminar)}
        onCerrar={() => setDiaPorEliminar(null)}
        onConfirmar={async () => {
          await itineraryApi.removeDay(id, diaPorEliminar._id);
          itinReq.recargar();
          viajeReq.recargar();
        }}
        titulo={t('quitarDia', { numero: diaPorEliminar?.dayNumber })}
        mensaje={
          diaPorEliminar?.activities?.length
            ? t('quitarDiaConActividades', { cantidad: diaPorEliminar.activities.length })
            : t('quitarDiaVacio')
        }
        textoConfirmar={t('quitarDiaBoton')}
      />

      <Modal
        abierto={confirmarRegenerar}
        onCerrar={() => setConfirmarRegenerar(false)}
        titulo={t('regenerarTitulo')}
        ancho={440}
      >
        <p className="suave" style={{ marginTop: 0 }}>
          {t('regenerarTexto')}
        </p>

        <div className="campo">
          <label htmlFor="notas-regenerar">{t('algoQueConsiderar')}</label>
          <textarea
            id="notas-regenerar"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            maxLength={500}
            placeholder={t('notasPlaceholder')}
          />
          <span className="campo-ayuda">{notas.length}/500</span>
        </div>

        <div className="modal-acciones">
          <Boton variante="secundario" onClick={() => setConfirmarRegenerar(false)}>
            {t('cancelar')}
          </Boton>
          <Boton
            variante="peligro"
            cargando={generando}
            onClick={async () => {
              await generar(true);
              setConfirmarRegenerar(false);
            }}
          >
            {t('regenerar')}
          </Boton>
        </div>
      </Modal>

      <Modal
        abierto={plantillaAbierta}
        onCerrar={() => setPlantillaAbierta(false)}
        titulo={t('guardarComoPlantillaTitulo')}
        ancho={440}
      >
        <form onSubmit={guardarComoPlantilla} className="pila">
          <p className="suave" style={{ marginTop: 0 }}>
            {t('guardarComoPlantillaTexto')}{' '}
            <Link to="/plantillas">{t('plantillas')}</Link>
            {user?.agency ? t('yLoVeraTuEquipo') : t('puntoFinal')}
          </p>

          {errorPlantilla && <Aviso tipo="error">{errorPlantilla}</Aviso>}

          <Campo
            label={t('nombreDeLaPlantilla')}
            name="nombrePlantilla"
            value={nombrePlantilla}
            onChange={(e) => setNombrePlantilla(e.target.value)}
            placeholder={t('nombrePlantillaPlaceholder', { destino: viaje?.destination?.name || t('destino') })}
            autoFocus
          />

          <div className="modal-acciones">
            <Boton type="button" variante="secundario" onClick={() => setPlantillaAbierta(false)}>
              {t('cancelar')}
            </Boton>
            <Boton type="submit" cargando={guardandoPlantilla} disabled={nombrePlantilla.trim().length < 2}>
              {t('guardarPlantilla')}
            </Boton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
