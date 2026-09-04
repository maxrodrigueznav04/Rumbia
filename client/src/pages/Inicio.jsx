import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { publicApi, despertarServidor } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import CampoFechas from '../components/CampoFechas.jsx';
import EnlacesReserva from '../components/EnlacesReserva.jsx';
import Icono from '../components/Icono.jsx';
import { Boton, Campo, Tarjeta, Aviso, Insignia } from '../components/ui.jsx';
import { formatoFecha, humanizar, ICONOS_CATEGORIA } from '../utils/format.js';

const ESTILOS = ['aventura', 'cultura', 'relax', 'gastronomia', 'naturaleza', 'vida-nocturna'];

const hoyMas = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
};

/**
 * Portada pública y generador de prueba.
 *
 * Antes la raíz mandaba directo al login: quien llegaba veía un formulario y
 * ninguna explicación de qué es esto. Aquí cualquiera puede armar un itinerario
 * con IA y ver los enlaces de reserva sin cuenta; la cuenta se pide solo para
 * guardarlo, que es cuando de verdad aporta algo.
 */
export default function Inicio() {
  const { autenticado, cargando } = useAuth();

  const [destino, setDestino] = useState('');
  const [fechas, setFechas] = useState({ inicio: hoyMas(30), fin: hoyMas(33) });
  const [viajeros, setViajeros] = useState(2);
  const [estilos, setEstilos] = useState(['cultura', 'gastronomia']);

  // Se despierta la API en cuanto se abre la portada: el visitante tarda al
  // menos medio minuto en llenar el formulario, y ese tiempo alcanza de sobra.
  useEffect(() => {
    despertarServidor();
  }, []);

  const [resultado, setResultado] = useState(null);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState(null);

  // Con sesión no tiene sentido la portada: se va a sus viajes.
  if (cargando) return null;
  if (autenticado) return <Navigate to="/viajes" replace />;

  const alternar = (v) =>
    setEstilos((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : prev.length < 5 ? [...prev, v] : prev
    );

  const generar = async (e) => {
    e.preventDefault();
    if (destino.trim().length < 2) {
      setError({ message: 'Escribe a dónde quieres ir.' });
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
          <span className="marca">
            <span className="marca-punto" aria-hidden="true">
              R
            </span>
            Rumbia
          </span>
          <div className="fila" style={{ gap: 8, alignItems: 'center' }}>
            <Link to="/acerca" className="boton fantasma chico">
              Acerca de
            </Link>
            <Link to="/entrar" className="boton secundario chico">
              Entrar
            </Link>
            <Link to="/registro" className="boton chico">
              Crear cuenta
            </Link>
          </div>
        </div>
      </header>

      <section className="inicio-hero">
        <div className="contenedor">
          <h1>Planea tu viaje completo en un solo lugar</h1>
          <p>
            Transporte, hospedaje, presupuesto e itinerario día por día, armado con asistencia
            inteligente en minutos.
          </p>
          <div className="fila inicio-hero-acciones">
            <a href="#probar" className="boton">
              Pruébalo gratis, sin cuenta
            </a>
          </div>
        </div>
      </section>

      <section className="inicio-intro">
        <div className="contenedor inicio-puntos">
          {[
            ['chispa', 'Itinerario inteligente', 'Día por día, con horarios, categorías y sugerencias locales automáticas.'],
            ['pin', 'Mapa y clima', 'Las actividades ubicadas en el mapa y el pronóstico de tus fechas.'],
            ['recibo', 'Presupuesto real', 'Transporte, hospedaje y gastos sueltos en un solo total, con divisas convertidas.'],
          ].map(([icono, titulo, texto]) => (
            <div key={titulo}>
              <Icono nombre={icono} tamano={26} className="icono-seccion" />
              <h3>{titulo}</h3>
              <p className="suave">{texto}</p>
            </div>
          ))}
        </div>
      </section>

      <main className="contenedor inicio-cuerpo">
        <div id="probar" className="inicio-probar-encabezado">
          <h2>Pruébalo tú mismo</h2>
          <p className="suave">Sin cuenta: escribe a dónde quieres ir y arma un itinerario en segundos.</p>
        </div>

        <Tarjeta titulo="Arma un itinerario ahora" className="inicio-form">
          <form onSubmit={generar} className="pila" noValidate>
            <Campo
              label="¿A dónde vas?"
              placeholder="Oaxaca, Ciudad de México, Cancún..."
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              autoFocus
            />

            <CampoFechas
              inicio={fechas.inicio}
              fin={fechas.fin}
              onCambio={setFechas}
            />

            <Campo
              label="¿Cuántos viajan?"
              type="number"
              min="1"
              max="20"
              value={viajeros}
              onChange={(e) => setViajeros(e.target.value)}
            />

            <div className="campo">
              <label>¿Qué te interesa? (hasta 5)</label>
              <div className="fila" style={{ gap: 6 }}>
                {ESTILOS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`insignia ${estilos.includes(v) ? 'marca' : ''}`}
                    aria-pressed={estilos.includes(v)}
                    onClick={() => alternar(v)}
                  >
                    {humanizar(v)}
                  </button>
                ))}
              </div>
            </div>

            {error && <Aviso tipo="error">{error.message}</Aviso>}

            <Boton type="submit" ancho cargando={generando}>
              {generando ? 'Armando tu itinerario...' : 'Generar itinerario gratis'}
            </Boton>
            <p className="tenue centrado" style={{ margin: 0, fontSize: '0.8rem' }}>
              Tarda entre 20 y 60 segundos. No se guarda nada hasta que tú quieras.
            </p>
          </form>
        </Tarjeta>

        {resultado && (
          <div className="pila" style={{ marginTop: 'var(--e6)' }}>
            <Aviso tipo="exito" titulo="Listo, este es tu itinerario">
              Es una muestra: no se guardó en ningún lado.{' '}
              <Link to="/registro">Crea una cuenta gratis</Link> para guardarlo, editarlo, sumarle
              presupuesto y ver el clima del destino.
            </Aviso>

            {resultado.itinerary.summary && <p className="suave">{resultado.itinerary.summary}</p>}

            {resultado.itinerary.days.map((dia) => (
              <Tarjeta
                key={dia.dayNumber}
                titulo={`Día ${dia.dayNumber} · ${formatoFecha(dia.date)}`}
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

            <Tarjeta titulo="Buscar y reservar">
              <p className="suave">
                Rumbia no reserva ni cobra: estos enlaces te llevan al sitio del proveedor con tu
                búsqueda ya prellenada.
              </p>
              {Object.entries(resultado.links).map(([seccion, enlaces]) => (
                <div key={seccion} style={{ marginBottom: 'var(--e4)' }}>
                  <span className="etiqueta">{humanizar(seccion)}</span>
                  <div style={{ marginTop: 8 }}>
                    <EnlacesReserva enlaces={enlaces} seccion={seccion} destino={destino.trim()} origen="invitado" />
                  </div>
                </div>
              ))}
            </Tarjeta>

            <Tarjeta className="centrado">
              <h3>¿Te sirve? Guárdalo antes de que se pierda</h3>
              <p className="suave">
                Con una cuenta gratis puedes editarlo, mover actividades, sumar tus gastos y llevar
                el control del presupuesto.
              </p>
              <Link to="/registro" className="boton">
                Crear cuenta gratis
              </Link>
            </Tarjeta>
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
