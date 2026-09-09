import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { publicApi, despertarServidor } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useMetaPagina } from '../hooks/useMetaPagina.js';
import CampoFechas from '../components/CampoFechas.jsx';
import EnlacesReserva from '../components/EnlacesReserva.jsx';
import Icono from '../components/Icono.jsx';
import { Boton, Campo, Tarjeta, Aviso, Insignia } from '../components/ui.jsx';
import { formatoFecha, traducirDominio, ICONOS_CATEGORIA } from '../utils/format.js';

const ESTILOS = ['aventura', 'cultura', 'relax', 'gastronomia', 'naturaleza', 'vida-nocturna'];

// Guarda lo que escribió (no el itinerario generado, que sigue sin
// persistir en ningún lado) para que Registro.jsx pueda prellenar el
// formulario real con lo mismo, en vez de que tenga que retecleario todo
// tras crear su cuenta. Ver LEE_BORRADOR_INVITADO en NuevoViaje.jsx.
const CLAVE_BORRADOR = 'rumbia_borrador_invitado';

function guardarBorrador({ destino, fechas, viajeros, estilos }) {
  try {
    localStorage.setItem(
      CLAVE_BORRADOR,
      JSON.stringify({ destino, inicio: fechas.inicio, fin: fechas.fin, viajeros, estilos })
    );
  } catch {
    /* localStorage puede fallar en navegacion privada; no es critico. */
  }
}

const hoyMas = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
};

/**
 * Generador de prueba, sin cuenta.
 *
 * Vivía dentro de la portada (Inicio.jsx), pero mezclaba dos cosas: explicar
 * qué es Rumbia y dejar jugar con una muestra deliberadamente simple del
 * producto real (sin presupuesto, sin clima, sin mapa, sin guardar nada).
 * Aquí vive aparte, enlazado desde la portada y desde Acerca, para que quien
 * apenas llega vea primero qué es la app completa y no una versión reducida
 * que puede dar una idea equivocada.
 */
export default function Probar() {
  const { t } = useTranslation('probar');
  const { t: tDominio } = useTranslation('dominio');
  const { t: tComun } = useTranslation('comun');
  const { autenticado, cargando } = useAuth();
  useMetaPagina({
    titulo: t('meta.titulo'),
    descripcion: t('meta.descripcion'),
    ruta: '/probar',
  });

  // Sin cuenta, el servidor limita a 7 dias (MAX_DIAS_INVITADO en
  // public.controller.js): sin este recorte, el atajo "Dos semanas" del
  // selector normal proponia algo que el servidor iba a rechazar despues.
  const ATAJOS_INVITADO = [
    { texto: t('atajos.finDeSemana'), noches: 2 },
    { texto: t('atajos.cincoDias'), noches: 4 },
    { texto: t('atajos.unaSemana'), noches: 6 },
  ];

  const [destino, setDestino] = useState('');
  const [fechas, setFechas] = useState({ inicio: hoyMas(30), fin: hoyMas(33) });
  const [viajeros, setViajeros] = useState(2);
  const [estilos, setEstilos] = useState(['cultura', 'gastronomia']);

  // Se despierta la API en cuanto se abre esta pagina: el visitante tarda al
  // menos medio minuto en llenar el formulario, y ese tiempo alcanza de sobra.
  useEffect(() => {
    despertarServidor();
  }, []);

  const [resultado, setResultado] = useState(null);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState(null);

  if (cargando) return null;

  const alternar = (v) =>
    setEstilos((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : prev.length < 5 ? [...prev, v] : prev
    );

  const generar = async (e) => {
    e.preventDefault();
    if (destino.trim().length < 2) {
      setError({ message: t('errorDestino') });
      return;
    }
    setError(null);
    setGenerando(true);
    try {
      const datos = await publicApi.generarItinerario({
        destination: destino.trim(),
        startDate: fechas.inicio,
        endDate: fechas.fin,
        // El input es type="number" min="1" max="20", pero el <form> tiene
        // noValidate: un valor tecleado a mano fuera de ese rango (o
        // negativo) llegaba tal cual, y "-5" || 1 da -5 porque es un numero
        // truthy en JS.
        travelers: Math.min(20, Math.max(1, Number(viajeros) || 1)),
        interests: estilos,
      });
      setResultado(datos);
      guardarBorrador({ destino, fechas, viajeros, estilos });
    } catch (err) {
      setError(err);
    } finally {
      setGenerando(false);
    }
  };

  return (
    <div className="inicio">
      <header className="inicio-nav">
        <div className="contenedor fila-entre">
          <Link to="/" className="marca">
            <span className="marca-punto" aria-hidden="true">
              R
            </span>
            Rumbia
          </Link>
          <div className="fila" style={{ gap: 8, alignItems: 'center' }}>
            <Link to="/acerca" className="boton fantasma chico">
              {tComun('nav.acercaDe')}
            </Link>
            {autenticado ? (
              <Link to="/viajes" className="boton chico">
                {t('nav.irAMisViajes')}
              </Link>
            ) : (
              <>
                <Link to="/entrar" className="boton secundario chico">
                  {tComun('nav.entrar')}
                </Link>
                <Link to="/registro" className="boton chico">
                  {tComun('nav.crearCuenta')}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="contenedor inicio-cuerpo" style={{ paddingTop: 'var(--e6)' }}>
        <div className="inicio-probar-encabezado">
          <h1 style={{ fontSize: 'clamp(1.6rem, 1.3rem + 1vw, 2rem)' }}>{t('encabezado.titulo')}</h1>
          <p className="suave">
            {t('encabezado.textoPre')}
            <Link to="/registro">{t('encabezado.crearCuentaGratis')}</Link>
            {t('encabezado.textoPost')}
          </p>
        </div>

        <Tarjeta titulo={t('form.tituloTarjeta')} className="inicio-form">
          <form onSubmit={generar} className="pila" noValidate>
            <Campo
              label={t('form.aDondeVas')}
              placeholder={t('form.aDondeVasPlaceholder')}
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
            />

            <CampoFechas
              inicio={fechas.inicio}
              fin={fechas.fin}
              onCambio={setFechas}
              atajos={ATAJOS_INVITADO}
            />

            <Campo
              label={t('form.cuantosViajan')}
              type="number"
              min="1"
              max="20"
              value={viajeros}
              onChange={(e) => setViajeros(e.target.value)}
            />

            <div className="campo">
              <label>{t('form.queTeInteresa')}</label>
              <div className="fila" style={{ gap: 6 }}>
                {ESTILOS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`insignia ${estilos.includes(v) ? 'marca' : ''}`}
                    aria-pressed={estilos.includes(v)}
                    onClick={() => alternar(v)}
                  >
                    {traducirDominio(tDominio, v)}
                  </button>
                ))}
              </div>
            </div>

            {error && <Aviso tipo="error">{error.message}</Aviso>}

            <Boton type="submit" ancho cargando={generando}>
              {generando ? t('form.generando') : t('form.generarGratis')}
            </Boton>
            <p className="tenue centrado" style={{ margin: 0, fontSize: '0.8rem' }}>
              {t('form.ayudaTiempo')}
            </p>
          </form>
        </Tarjeta>

        {resultado && (
          <div className="pila" style={{ marginTop: 'var(--e6)' }}>
            <Aviso tipo="exito" titulo={t('resultado.avisoTitulo')}>
              {t('resultado.avisoPre')}
              <Link to="/registro">{t('resultado.crearCuentaGratis')}</Link>
              {t('resultado.avisoPost')}
            </Aviso>

            {resultado.itinerary.summary && <p className="suave">{resultado.itinerary.summary}</p>}

            {resultado.itinerary.days.map((dia) => (
              <Tarjeta
                key={dia.dayNumber}
                titulo={t('resultado.dia', { numero: dia.dayNumber, fecha: formatoFecha(dia.date) })}
              >
                {dia.title && <h4 style={{ marginTop: 0 }}>{dia.title}</h4>}
                <div className="pila-sm">
                  {dia.activities.map((a, i) => (
                    <div className="actividad" key={i}>
                      <div className="actividad-hora">{a.time || '—'}</div>
                      <div className="actividad-cuerpo">
                        <h4>
                          <span aria-hidden="true">{ICONOS_CATEGORIA[a.category] || '📍'}</span>{' '}
                          {a.title}
                        </h4>
                        {a.description && <p>{a.description}</p>}
                        <div className="fila" style={{ gap: 6 }}>
                          <Insignia>{traducirDominio(tDominio, a.category)}</Insignia>
                          {a.estimatedCost > 0 && (
                            <Insignia color="ambar">≈ ${a.estimatedCost} {t('resultado.porPersona')}</Insignia>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Tarjeta>
            ))}

            <Tarjeta titulo={t('resultado.buscarYReservar.titulo')}>
              <p className="suave">
                {t('resultado.buscarYReservar.texto')}
              </p>
              {Object.entries(resultado.links).map(([seccion, enlaces]) => (
                <div key={seccion} style={{ marginBottom: 'var(--e4)' }}>
                  <span className="etiqueta">{traducirDominio(tDominio, seccion)}</span>
                  <div style={{ marginTop: 8 }}>
                    <EnlacesReserva enlaces={enlaces} seccion={seccion} destino={destino.trim()} origen="invitado" />
                  </div>
                </div>
              ))}
            </Tarjeta>

            <Tarjeta className="centrado">
              <h3>{t('resultado.ctaFinal.titulo')}</h3>
              <p className="suave">
                {t('resultado.ctaFinal.texto')}
              </p>
              <Link to="/registro" className="boton">
                {t('resultado.ctaFinal.boton')}
              </Link>
            </Tarjeta>
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
