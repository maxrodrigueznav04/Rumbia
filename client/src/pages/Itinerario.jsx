import { Suspense, lazy, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { tripsApi, itineraryApi } from '../api/index.js';
import useFetch from '../hooks/useFetch.js';
import FormActividad from '../components/formularios/FormActividad.jsx';
import FormDia from '../components/formularios/FormDia.jsx';
import {
  Boton,
  Tarjeta,
  Insignia,
  Vacio,
  ErrorCarga,
  Esqueleto,
  Aviso,
  ModalConfirmar,
} from '../components/ui.jsx';
import Icono from '../components/Icono.jsx';
import ResumenViaje from '../components/ResumenViaje.jsx';
import SelectorPersonas from '../components/SelectorPersonas.jsx';
import { EncabezadoImpresion, PieImpresion } from '../components/HojaImpresion.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { formatoMoneda, formatoFecha, humanizar, porPersonas, ICONOS_CATEGORIA } from '../utils/format.js';

const MapaDestino = lazy(() => import('../components/MapaDestino.jsx'));

function Actividad({ actividad, moneda, onEditar, onEliminar, dnd }) {
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
        aria-label={`Reordenar ${actividad.title}. Usa las flechas arriba y abajo.`}
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
          <Insignia>{humanizar(actividad.category)}</Insignia>
          {actividad.estimatedCost > 0 && (
            <Insignia color="ambar">{formatoMoneda(actividad.estimatedCost, moneda)}</Insignia>
          )}
          {actividad.durationMinutes > 0 && (
            <Insignia>
              {actividad.durationMinutes >= 60
                ? `${Math.round((actividad.durationMinutes / 60) * 10) / 10} h`
                : `${actividad.durationMinutes} min`}
            </Insignia>
          )}
          {mostrarLugar && (
            <span className="tenue" style={{ fontSize: '0.8rem' }}>
              📍 {lugar}
            </span>
          )}
          {actividad.bookingUrl && (
            <a href={actividad.bookingUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem' }}>
              Reservar ↗
            </a>
          )}
        </div>
      </div>

      <div className="actividad-acciones">
        <Boton variante="fantasma" chico onClick={onEditar} aria-label={`Editar ${actividad.title}`} title="Editar">
          ✎
        </Boton>
        <Boton variante="fantasma" chico onClick={onEliminar} aria-label={`Eliminar ${actividad.title}`} title="Eliminar">
          ✕
        </Boton>
      </div>
    </article>
  );
}

export default function Itinerario() {
  const { id } = useParams();
  // Solo para el membrete del PDF: si el usuario pertenece a una agencia, su
  // marca gana sobre la personal (mismo criterio que el enlace compartido).
  const { user } = useAuth();
  const marca = user?.agency ?? user?.branding;

  const viajeReq = useFetch(({ signal }) => tripsApi.get(id, { signal }), [id]);
  const itinReq = useFetch(({ signal }) => itineraryApi.get(id, { signal }), [id]);

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

  const viaje = viajeReq.data?.trip;
  const itinerario = itinReq.data?.itinerary;
  const pines = itinReq.data?.pins || [];
  const moneda = viaje?.budget?.currency || 'MXN';
  const paraCuantos = Math.min(personas ?? viaje?.travelers ?? 1, viaje?.travelers || 1);

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

  const enlacePublico = compartir ? `${window.location.origin}/i/${compartir.token}` : null;

  const generarEnlace = async () => {
    setTrabajandoEnlace(true);
    try {
      const datos = await itineraryApi.compartir(id);
      setCompartir({ token: datos.token });
      setCopiado(false);
    } catch (err) {
      setErrorGen(err);
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
    return <ErrorCarga error={viajeReq.error} onReintentar={viajeReq.recargar} contexto="Viaje" />;
  }

  return (
    <div className="pila">
      {/* Solo se ve al imprimir; en pantalla lo oculta global.css. */}
      {itinerario && <EncabezadoImpresion marca={marca} viaje={viaje} />}

      <div>
        <Link to={`/viajes/${id}`} className="volver">
          ← {viaje.title}
        </Link>
      </div>

      <header className="fila-entre no-imprimir">
        <div>
          <h1 style={{ marginBottom: 4 }}>Itinerario</h1>
          <p className="suave" style={{ margin: 0 }}>
            {viaje.destination?.name} · {viaje.durationDays} días
            {itinerario && ` · ${itinerario.activityCount} actividades`}
          </p>
        </div>

        {itinerario && (
          <div className="fila" style={{ gap: 8 }}>
            <Boton variante="secundario" onClick={() => window.print()}>
              <Icono nombre="descarga" tamano={15} /> Descargar PDF
            </Boton>
            <Boton variante="secundario" onClick={generarEnlace} cargando={trabajandoEnlace}>
              <Icono nombre="flechaSalida" tamano={15} /> Compartir
            </Boton>
            <Boton
              variante="secundario"
              onClick={() => setConfirmarRegenerar(true)}
              cargando={generando}
            >
              <Icono nombre="chispa" tamano={15} /> Regenerar
            </Boton>
          </div>
        )}
      </header>

      {enlacePublico && (
        <Aviso tipo="exito" titulo="Tu itinerario ya se puede compartir">
          <p style={{ margin: '2px 0 8px' }}>
            Quien abra este enlace verá el itinerario en solo lectura. No verá tu presupuesto, tus
            gastos ni tu cuenta.
          </p>
          <div className="fila" style={{ gap: 8 }}>
            <input
              className="enlace-compartir"
              readOnly
              value={enlacePublico}
              onFocus={(e) => e.target.select()}
              aria-label="Enlace público del itinerario"
            />
            <Boton chico onClick={copiar}>
              {copiado ? 'Copiado' : 'Copiar'}
            </Boton>
            <Boton variante="peligro-texto" chico onClick={revocarEnlace} cargando={trabajandoEnlace}>
              Dejar de compartir
            </Boton>
          </div>
        </Aviso>
      )}

      {errorGen && (
        <ErrorCarga
          error={errorGen}
          contexto={
            errorGen.status === 429
              ? 'Alcanzaste el límite de generaciones'
              : 'No pudimos generar el itinerario'
          }
        />
      )}

      <SelectorPersonas personas={paraCuantos} maximo={viaje.travelers} onCambio={setPersonas} />
      <ResumenViaje viaje={viaje} personas={paraCuantos} />

      {/* ---------- Sin itinerario: invitación a generarlo ---------- */}
      {!itinerario && (
        <Tarjeta>
          <Vacio
            icono="✨"
            titulo="Deja que la IA arme tu plan"
            accion={
              <div className="fila" style={{ justifyContent: 'center' }}>
                <Boton onClick={() => generar(false)} cargando={generando}>
                  {generando ? 'Generando...' : 'Generar itinerario'}
                </Boton>
                <Boton
                  variante="secundario"
                  onClick={async () => {
                    try {
                      await itineraryApi.createBlank(id);
                      itinReq.recargar();
                    } catch (err) {
                      window.alert(err.message);
                    }
                  }}
                >
                  Armarlo yo
                </Boton>
              </div>
            }
          >
            Con tu destino, tus fechas y tus intereses, Gemini propone actividades día por día. Todo
            queda editable: puedes cambiar, quitar o agregar lo que quieras.
          </Vacio>

          <div className="campo" style={{ marginTop: 18 }}>
            <label htmlFor="notas">¿Algo que la IA deba tomar en cuenta? (opcional)</label>
            <textarea
              id="notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              maxLength={500}
              placeholder="Viajamos con un niño de 6 años, preferimos lugares poco turísticos, no comemos carne..."
            />
            <span className="campo-ayuda">{notas.length}/500</span>
          </div>

          {generando && (
            <Aviso tipo="info" titulo="Generando tu itinerario">
              Suele tardar entre 20 y 60 segundos, más mientras más días tenga el viaje. No cierres
              la pestaña.
            </Aviso>
          )}
        </Tarjeta>
      )}

      {/* ---------- Con itinerario ---------- */}
      {itinerario && (
        <div className="rejilla rejilla-detalle">
          <div className="pila">
            {itinerario.generatedBy === 'ia' && (
              <Aviso tipo="info">
                Generado con {itinerario.model || 'IA'}. Revisa horarios, precios y disponibilidad
                antes de darlo por hecho: la IA se puede equivocar.
              </Aviso>
            )}

            {itinerario.days.length > viaje.durationDays && (
              <Aviso tipo="alerta" titulo="Hay días fuera del viaje">
                El itinerario tiene {itinerario.days.length} días pero el viaje dura{' '}
                {viaje.durationDays}. Los días de más quedaron cuando acortaste las fechas; puedes
                quitarlos abajo o alargar el viaje de nuevo.
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
                      Día {dia.dayNumber}
                      {dia.date && ` · ${formatoFecha(dia.date, { weekday: 'long', year: undefined })}`}
                    </div>
                    {dia.dayNumber > viaje.durationDays && (
                      <span className="fila" style={{ gap: 6 }}>
                        <Insignia color="error">Fuera del viaje</Insignia>
                        <Boton
                          variante="fantasma"
                          chico
                          onClick={() => setDiaPorEliminar(dia)}
                          title="Quitar este día"
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
                      aria-label={`Editar título del día ${dia.dayNumber}`}
                      title="Editar título y resumen"
                    >
                      ✎
                    </button>
                  </h3>
                  {dia.summary && (
                    <p className="tenue" style={{ margin: 0 }}>
                      {dia.summary}
                    </p>
                  )}
                  {dia.estimatedCost > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <Insignia color="ambar">
                        ≈ {formatoMoneda(dia.estimatedCost, moneda)} por persona
                      </Insignia>
                    </div>
                  )}
                </div>

                {dia.activities.length === 0 ? (
                  <p className="tenue" style={{ fontSize: '0.88rem' }}>
                    {arrastre
                      ? 'Suelta aquí para mover la actividad a este día.'
                      : 'Día libre. Agrega actividades cuando decidas qué hacer.'}
                  </p>
                ) : (
                  dia.activities.map((a, i) => (
                    <Actividad
                      key={a._id}
                      actividad={a}
                      moneda={moneda}
                      dnd={dndProps(dia, i, a)}
                      onEditar={() => setModal({ dia, actividad: a })}
                      onEliminar={() => setPorEliminar({ dia, actividad: a })}
                    />
                  ))
                )}

                <Boton
                  variante="fantasma"
                  chico
                  onClick={() => setModal({ dia })}
                  style={{ marginTop: 4 }}
                >
                  + Agregar actividad
                </Boton>
              </div>
            ))}
          </div>

          <div className="pila">
            <Tarjeta titulo="Actividades en el mapa" className="no-imprimir">
              <Suspense fallback={<div className="mapa" />}>
                <MapaDestino destino={viaje.destination} pines={pines} alto={340} />
              </Suspense>
              <p className="tenue" style={{ margin: '10px 0 0', fontSize: '0.8rem' }}>
                {pines.length > 0
                  ? `${pines.length} de ${itinerario.activityCount} actividades tienen ubicación.`
                  : 'Ninguna actividad trae coordenadas todavía.'}
              </p>
            </Tarjeta>

            <Tarjeta titulo="Costo total estimado">
              <div className="pila-sm">
                <div className="linea-gasto">
                  <span className="suave">Actividades</span>
                  <span className="numero">{formatoMoneda(itinerario.totalEstimatedCost, moneda)}</span>
                </div>
                <div className="linea-gasto">
                  <span className="suave">Transporte, hospedaje y transporte local</span>
                  <span className="numero">
                    {formatoMoneda(porPersonas(viaje.coreCosts?.total || 0, viaje.travelers, 1), moneda)}
                  </span>
                </div>
              </div>

              <div className="fila-entre" style={{ marginTop: 12 }}>
                <span className="suave">Por persona</span>
                <span className="numero grande">
                  {formatoMoneda(
                    itinerario.totalEstimatedCost + porPersonas(viaje.coreCosts?.total || 0, viaje.travelers, 1),
                    moneda
                  )}
                </span>
              </div>
              <div className="fila-entre" style={{ marginTop: 6 }}>
                <span className="suave">
                  {paraCuantos} {paraCuantos === 1 ? 'viajero' : 'viajeros'}
                </span>
                <span className="numero">
                  {formatoMoneda(
                    (itinerario.totalEstimatedCost + porPersonas(viaje.coreCosts?.total || 0, viaje.travelers, 1)) *
                      paraCuantos,
                    moneda
                  )}
                </span>
              </div>
              <p className="tenue" style={{ margin: '12px 0 0', fontSize: '0.8rem' }}>
                Actividades sugeridas por la IA, más lo que ya capturaste en transporte y hospedaje. Son
                estimaciones, no precios en firme.
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
        titulo="Quitar actividad"
        mensaje={`Se va a quitar "${porEliminar?.actividad?.title}" del día ${porEliminar?.dia?.dayNumber}.`}
        textoConfirmar="Quitar"
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
        titulo={`Quitar el día ${diaPorEliminar?.dayNumber}`}
        mensaje={
          diaPorEliminar?.activities?.length
            ? `Ese día tiene ${diaPorEliminar.activities.length} actividad(es) y se van a borrar con él. Los días siguientes se renumeran.`
            : 'El día está vacío. Los días siguientes se renumeran.'
        }
        textoConfirmar="Quitar día"
      />

      <ModalConfirmar
        abierto={confirmarRegenerar}
        onCerrar={() => setConfirmarRegenerar(false)}
        onConfirmar={() => generar(true)}
        titulo="Regenerar itinerario"
        mensaje="La IA va a crear un plan nuevo desde cero. Se pierde el itinerario actual, incluyendo las actividades que hayas editado o agregado a mano."
        textoConfirmar="Regenerar"
      />
    </div>
  );
}
