import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTema } from '../hooks/useTema.js';
import { useMetaPagina } from '../hooks/useMetaPagina.js';
import { useJsonLd } from '../hooks/useJsonLd.js';

// Fuera del componente para que sea la misma referencia en cada render: si
// viviera adentro, cada vez que se toca el toggle mensual/anual el hook de
// abajo la tomaria como "datos nuevos" y reescribiria el <script> sin
// necesidad. Precios mensuales (los que se ven por default al entrar), no
// los de los tres planes en las dos frecuencias -- Google solo quiere UNA
// oferta representativa por producto, no las seis combinaciones.
const DATOS_ESTRUCTURADOS_PRECIOS = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Rumbia',
  url: 'https://rumbiamx.com/acerca',
  applicationCategory: 'TravelApplication',
  operatingSystem: 'Web',
  description:
    'Cotizador y planeador de viajes para agencias: itinerarios con asistencia inteligente, cotizaciones en PDF con margen y logo propio, presupuesto y gastos.',
  offers: [
    { '@type': 'Offer', name: 'Uso personal', price: '0', priceCurrency: 'MXN' },
    { '@type': 'Offer', name: 'Inicio / Solo (mensual)', price: '190', priceCurrency: 'MXN' },
    { '@type': 'Offer', name: 'Agencia (mensual)', price: '450', priceCurrency: 'MXN' },
    { '@type': 'Offer', name: 'Agencia Pro (mensual)', price: '750', priceCurrency: 'MXN' },
  ],
};
import Icono from '../components/Icono.jsx';
import { Boton, Tarjeta, Insignia } from '../components/ui.jsx';

const ORDEN_TEMA = ['sistema', 'claro', 'oscuro'];
const ICONO_TEMA = { sistema: 'monitor', claro: 'sol', oscuro: 'luna' };
const ETIQUETA_TEMA = { sistema: 'Tema: siguiendo al sistema', claro: 'Tema: claro', oscuro: 'Tema: oscuro' };

function ToggleTema() {
  const { tema, cambiarTema } = useTema();
  const siguiente = ORDEN_TEMA[(ORDEN_TEMA.indexOf(tema) + 1) % ORDEN_TEMA.length];

  return (
    <Boton
      variante="fantasma"
      chico
      onClick={() => cambiarTema(siguiente)}
      title={`${ETIQUETA_TEMA[tema]} · toca para cambiar a ${siguiente}`}
      aria-label={`${ETIQUETA_TEMA[tema]}. Cambiar a ${siguiente}`}
    >
      <Icono nombre={ICONO_TEMA[tema]} tamano={17} />
    </Boton>
  );
}

export default function Acerca() {
  const { autenticado } = useAuth();
  useMetaPagina({
    titulo: 'Acerca de',
    descripcion:
      'Qué es Rumbia, cómo ayuda a viajeros y agencias a planear viajes completos, y cuánto cuesta.',
    ruta: '/acerca',
  });
  useJsonLd('jsonld-precios-acerca', DATOS_ESTRUCTURADOS_PRECIOS);

  // Estado para el simulador interactivo de propuesta
  const [modoDesglose, setModoDesglose] = useState('total'); // 'total' | 'desglose'

  // Estado para la frecuencia de cobro: 'mensual' | 'anual'
  const [frecuencia, setFrecuencia] = useState('mensual');

  return (
    <div className="inicio">
      {/* Encabezado superior */}
      <header className="inicio-nav">
        <div className="contenedor fila-entre">
          <Link to="/" className="marca">
            <span className="marca-punto" aria-hidden="true">
              R
            </span>
            Rumbia
          </Link>
          <div className="fila" style={{ gap: 8, alignItems: 'center' }}>
            <ToggleTema />
            {autenticado ? (
              <Link to="/viajes" className="boton chico">
                Ir a mis viajes
              </Link>
            ) : (
              <>
                <Link to="/entrar" className="boton secundario chico">
                  Entrar
                </Link>
                <Link to="/registro" className="boton chico">
                  Crear cuenta
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero principal */}
      <section className="inicio-hero">
        <div className="contenedor" style={{ maxWidth: 860, textAlign: 'center', margin: '0 auto' }}>
          <div style={{ marginBottom: 14 }}>
            <Insignia color="marca">La plataforma moderna de viajes</Insignia>
          </div>
          <h1 style={{ fontSize: '2.5rem', lineHeight: 1.18, marginBottom: 16 }}>
            Planea viajes extraordinarios con claridad, control y profesionalismo
          </h1>
          <p style={{ fontSize: '1.18rem', lineHeight: 1.6, maxWidth: 720, margin: '0 auto 28px' }}>
            Desde tu próxima escapada personal hasta la gestión comercial de clientes para agencias
            de viajes. Olvídate de las hojas de cálculo caóticas, notas dispersas y cotizaciones
            interminables.
          </p>
          <div className="fila" style={{ justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Link to={autenticado ? '/viajes/nuevo' : '/registro'} className="boton">
              <Icono nombre="chispa" tamano={16} />{' '}
              {autenticado ? 'Crear un nuevo viaje' : 'Comenzar gratis'}
            </Link>
            {!autenticado && (
              <Link to="/" className="boton secundario">
                Probar generador sin cuenta
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Contenido principal */}
      <main className="contenedor inicio-cuerpo" style={{ maxWidth: 1040, marginTop: 'var(--e6)' }}>
        <div className="pila" style={{ gap: 'var(--e7)' }}>
          {/* 1. SECCIÓN: Dos mundos (Personal vs Agencia) con Límites y Planes Claros */}
          <section>
            <div style={{ textAlign: 'center', marginBottom: 'var(--e5)' }}>
              <span className="etiqueta">Modelos de uso</span>
              <h2 style={{ fontSize: '1.9rem', marginTop: 4 }}>
                Diseñado para viajeros y construido para agencias
              </h2>
              <p className="suave" style={{ maxWidth: 660, margin: '6px auto 0' }}>
                Dos experiencias perfectamente adaptadas. Conoce las capacidades y condiciones de cada perfil:
              </p>
            </div>

            <div className="rejilla rejilla-2" style={{ gap: 24, alignItems: 'stretch' }}>
              {/* Tarjeta: Para Viajeros */}
              <div
                className="tarjeta"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderTop: '4px solid var(--marca)',
                }}
              >
                <div>
                  <div className="fila-entre" style={{ marginBottom: 12 }}>
                    <div className="fila" style={{ gap: 8 }}>
                      <Icono nombre="brujula" tamano={22} className="icono-seccion" />
                      <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Para Viajeros</h3>
                    </div>
                    <Insignia color="verde">100% Gratuito</Insignia>
                  </div>

                  <p className="suave" style={{ fontSize: '0.94rem', margin: '0 0 16px' }}>
                    Ideal para planear tus vacaciones, escapadas en pareja o viajes en grupo con amigos:
                  </p>

                  <ul className="pila-sm" style={{ paddingLeft: 18, margin: '0 0 20px', fontSize: '0.92rem' }}>
                    <li>
                      <strong>Cálculo en vivo de costos:</strong> Suma transporte, hospedaje, comidas y
                      gastos sueltos en un presupuesto unificado.
                    </li>
                    <li>
                      <strong>Itinerarios asistidos:</strong> Propuestas de actividades día por día
                      adaptadas a tus intereses y ritmo preferido.
                    </li>
                    <li>
                      <strong>Clima y mapas:</strong> Pronóstico meteorológico y visualización de tus destinos directo en el celular.
                    </li>
                    <li>
                      <strong>Enlaces directos de reserva:</strong> Sal a Skyscanner, Booking o Airbnb
                      con tus fechas y destino prellenados.
                    </li>
                  </ul>
                </div>

                {/* Límites claros para viajeros */}
                <div
                  style={{
                    background: 'var(--bg-suave, rgba(0,0,0,0.03))',
                    padding: '12px 14px',
                    borderRadius: 'var(--radio-sm)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div className="fila" style={{ gap: 6, marginBottom: 4 }}>
                    <Icono nombre="info" tamano={15} />
                    <strong style={{ fontSize: '0.85rem' }}>Límites del plan personal</strong>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.82rem', color: 'var(--texto-suave)' }}>
                    <li>
                      <strong>5 itinerarios inteligentes por mes</strong> (recarga cada día 1).
                    </li>
                    <li>
                      <strong>60 consultas al asistente virtual por mes</strong>.
                    </li>
                    <li>
                      <em>Viajes guardados, notas, gastos y cálculos manuales sin ningún límite.</em>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Tarjeta: Para Agencias */}
              <div
                className="tarjeta"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderTop: '4px solid var(--marca-oscura, #12513F)',
                }}
              >
                <div>
                  <div className="fila-entre" style={{ marginBottom: 12 }}>
                    <div className="fila" style={{ gap: 8 }}>
                      <Icono nombre="maleta" tamano={22} className="icono-seccion" />
                      <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Para Agencias</h3>
                    </div>
                    <Insignia color="marca">Desde $190 MXN/mes</Insignia>
                  </div>

                  <p className="suave" style={{ fontSize: '0.94rem', margin: '0 0 16px' }}>
                    Herramientas de nivel profesional para armar cotizaciones, cerrar clientes y operar en equipo:
                  </p>

                  <ul className="pila-sm" style={{ paddingLeft: 18, margin: '0 0 20px', fontSize: '0.92rem' }}>
                    <li>
                      <strong>Márgenes comerciales automáticos:</strong> Aplica comisiones fijas o
                      porcentuales y calcula tu ganancia en automático.
                    </li>
                    <li>
                      <strong>PDF con tu propia marca:</strong> Sube tu logo, nombre y contacto; se
                      imprimen en el membrete oficial del cliente.
                    </li>
                    <li>
                      <strong>Privacidad comercial en cotizaciones:</strong> Elige si muestras el
                      desglose o solo el precio total cerrado por persona.
                    </li>
                    <li>
                      <strong>Variantes en 1 clic:</strong> Duplica propuestas para presentar opciones
                      (ej. Económica vs. Premium) sin retrabajo.
                    </li>
                  </ul>
                </div>

                {/* Resumen de planes y botón para desplegar */}
                <div
                  style={{
                    background: 'var(--bg-suave, rgba(0,0,0,0.03))',
                    padding: '12px 14px',
                    borderRadius: 'var(--radio-sm)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div className="fila-entre" style={{ alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: '0.85rem', display: 'block' }}>
                        Planes Inicio, Agencia y Pro
                      </strong>
                      <span className="tenue" style={{ fontSize: '0.8rem' }}>
                        De 1 a 15 agentes · Hasta 500 itinerarios inteligentes · Ahorro anual
                      </span>
                    </div>
                    <a
                      href="#planes-agencia"
                      className="boton chico secundario"
                      style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                    >
                      Ver planes ↓
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 2. SECCIÓN INTERACTIVA: Simulador de Cotización para Clientes */}
          <section>
            <Tarjeta>
              <div className="fila-entre" style={{ flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                <div>
                  <div className="fila" style={{ gap: 8 }}>
                    <Icono nombre="ojo" tamano={20} className="icono-seccion" />
                    <span className="etiqueta" style={{ margin: 0 }}>
                      Simulador interactivo
                    </span>
                  </div>
                  <h3 style={{ margin: '4px 0 0', fontSize: '1.35rem' }}>
                    Así se ve una propuesta para tu cliente
                  </h3>
                  <p className="suave" style={{ margin: 0, fontSize: '0.92rem' }}>
                    Prueba el interruptor para ver cómo cambia la vista entre el desglose interno y la cotización para el cliente:
                  </p>
                </div>

                {/* Selector interactivo */}
                <div className="fila" style={{ background: 'var(--bg-suave, rgba(0,0,0,0.05))', padding: 4, borderRadius: 'var(--radio-sm)' }}>
                  <button
                    type="button"
                    className={`boton chico ${modoDesglose === 'total' ? '' : 'fantasma'}`}
                    onClick={() => setModoDesglose('total')}
                    style={{ fontSize: '0.82rem' }}
                  >
                    Solo Precio Total (Cliente)
                  </button>
                  <button
                    type="button"
                    className={`boton chico ${modoDesglose === 'desglose' ? '' : 'fantasma'}`}
                    onClick={() => setModoDesglose('desglose')}
                    style={{ fontSize: '0.82rem' }}
                  >
                    Desglose Completo (Interno)
                  </button>
                </div>
              </div>

              {/* Vista simulada de la cotización */}
              <div
                style={{
                  border: '1.5px solid var(--border)',
                  borderRadius: 'var(--radio)',
                  padding: '20px',
                  background: 'var(--card-bg, #fff)',
                }}
              >
                {/* Membrete de agencia simulado */}
                <div
                  className="fila-entre"
                  style={{
                    borderBottom: '1.5px solid var(--border)',
                    paddingBottom: 14,
                    marginBottom: 16,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div className="fila" style={{ gap: 10, alignItems: 'center' }}>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 'var(--radio-xs)',
                        background: 'var(--marca)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '1.1rem',
                      }}
                    >
                      VS
                    </div>
                    <div>
                      <strong style={{ fontSize: '1.05rem', display: 'block' }}>
                        Viajes del Sur Boutique
                      </strong>
                      <span className="tenue" style={{ fontSize: '0.8rem' }}>
                        contacto@viajesdelsur.mx · Tel. (55) 8421-9900
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Insignia color="marca">Propuesta Comercial</Insignia>
                    <span className="tenue" style={{ display: 'block', fontSize: '0.78rem', marginTop: 3 }}>
                      Cliente: Familia González (2 viajeros)
                    </span>
                  </div>
                </div>

                {/* Contenido según el modo */}
                {modoDesglose === 'desglose' ? (
                  <div className="pila-sm">
                    <div className="fila-entre" style={{ padding: '6px 0', borderBottom: '1px dashed var(--border)' }}>
                      <span className="suave">Vuelos redondos (CDMX ➔ Oaxaca)</span>
                      <span className="numero">$9,600 MXN</span>
                    </div>
                    <div className="fila-entre" style={{ padding: '6px 0', borderBottom: '1px dashed var(--border)' }}>
                      <span className="suave">Hotel Casa Santo Origen (4 noches)</span>
                      <span className="numero">$18,400 MXN</span>
                    </div>
                    <div className="fila-entre" style={{ padding: '6px 0', borderBottom: '1px dashed var(--border)' }}>
                      <span className="suave">Transporte local y traslados privados</span>
                      <span className="numero">$3,200 MXN</span>
                    </div>
                    <div className="fila-entre" style={{ padding: '6px 0', borderBottom: '1px dashed var(--border)' }}>
                      <span className="suave">Actividades guiadas y catas</span>
                      <span className="numero">$5,400 MXN</span>
                    </div>
                    <div
                      className="fila-entre"
                      style={{
                        padding: '6px 0',
                        color: 'var(--marca)',
                        fontWeight: 600,
                      }}
                    >
                      <span>Cuota de servicio y gestión de agencia (+15%)</span>
                      <span className="numero">+$5,490 MXN</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '10px 0', textAlign: 'center' }}>
                    <p className="suave" style={{ margin: '0 0 10px', fontSize: '0.92rem' }}>
                      Incluye vuelos redondos, 4 noches de hospedaje boutique, traslados privados, tours
                      culturales y asistencia personalizada durante todo el itinerario.
                    </p>
                    <span className="insignia" style={{ fontSize: '0.8rem' }}>
                      Tarifa preferencial cerrada con impuestos incluidos
                    </span>
                  </div>
                )}

                {/* Total por persona */}
                <div
                  className="fila-entre"
                  style={{
                    marginTop: 16,
                    paddingTop: 14,
                    borderTop: '2px solid var(--border)',
                    alignItems: 'baseline',
                  }}
                >
                  <div>
                    <span className="etiqueta" style={{ margin: 0 }}>
                      Precio final por persona
                    </span>
                    <span className="tenue" style={{ display: 'block', fontSize: '0.82rem' }}>
                      Total del viaje (2 personas): $42,090 MXN
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="numero grande" style={{ fontSize: '1.6rem', color: 'var(--marca)' }}>
                      $21,045 MXN
                    </span>
                  </div>
                </div>
              </div>

              <p className="tenue centrado" style={{ margin: '14px 0 0', fontSize: '0.82rem' }}>
                💡 En Rumbia puedes cambiar de un modo a otro con un solo interruptor en la configuración del viaje.
              </p>
            </Tarjeta>
          </section>

          {/* 3. SECCIÓN: Planes Detallados de Agencia con Selector de Frecuencia */}
          <section id="planes-agencia">
            <div style={{ textAlign: 'center', marginBottom: 'var(--e4)' }}>
              <span className="etiqueta">Transparencia comercial</span>
              <h2 style={{ fontSize: '1.8rem', marginTop: 4 }}>
                Planes transparentes para Agencias
              </h2>
              <p className="suave" style={{ maxWidth: 640, margin: '6px auto 18px' }}>
                Elige la modalidad de pago que mejor se ajuste a tu operación. Sin contratos forzosos ni comisiones ocultas:
              </p>

              {/* Selector Mensual / Anual */}
              <div
                className="fila"
                style={{
                  justifyContent: 'center',
                  background: 'var(--bg-suave, rgba(0,0,0,0.05))',
                  display: 'inline-flex',
                  padding: '4px',
                  borderRadius: 'var(--radio)',
                  gap: 4,
                }}
              >
                <button
                  type="button"
                  className={`boton chico ${frecuencia === 'mensual' ? '' : 'fantasma'}`}
                  onClick={() => setFrecuencia('mensual')}
                  style={{ fontSize: '0.88rem' }}
                >
                  Pago Mensual
                </button>
                <button
                  type="button"
                  className={`boton chico ${frecuencia === 'anual' ? '' : 'fantasma'}`}
                  onClick={() => setFrecuencia('anual')}
                  style={{ fontSize: '0.88rem' }}
                >
                  Pago Anual <Insignia color="verde" style={{ marginLeft: 6 }}>Ahorra 1.5 meses</Insignia>
                </button>
              </div>
            </div>

            {/* Rejilla de los 3 planes de agencia */}
            <div className="rejilla rejilla-3" style={{ gap: 20, alignItems: 'stretch' }}>
              {/* PLAN 1: Inicio / Solo */}
              <div
                className="tarjeta"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '24px 20px',
                }}
              >
                <div>
                  <h3 style={{ margin: '0 0 6px', fontSize: '1.25rem' }}>Inicio / Solo</h3>
                  <p className="suave" style={{ fontSize: '0.85rem', margin: '0 0 16px' }}>
                    Para asesores independientes y pequeños equipos que inician.
                  </p>

                  <div style={{ marginBottom: 16 }}>
                    <div className="numero grande" style={{ fontSize: '1.9rem', color: 'var(--marca)' }}>
                      {frecuencia === 'mensual' ? '$190 MXN' : '$1,950 MXN'}
                    </div>
                    <span className="tenue" style={{ fontSize: '0.8rem' }}>
                      {frecuencia === 'mensual' ? 'al mes' : 'al año (10.5 meses)'}
                    </span>
                  </div>

                  <div
                    style={{
                      background: 'var(--bg-suave, rgba(0,0,0,0.03))',
                      padding: '8px 12px',
                      borderRadius: 'var(--radio-xs)',
                      marginBottom: 16,
                      fontSize: '0.85rem',
                    }}
                  >
                    <strong>De 1 a 3 agentes incluidos</strong>
                  </div>

                  <ul className="pila-sm" style={{ paddingLeft: 18, margin: 0, fontSize: '0.88rem' }}>
                    <li><strong>25 itinerarios inteligentes</strong> al mes</li>
                    <li>60 consultas al asistente virtual por mes</li>
                    <li>Viajes y gastos manuales ilimitados</li>
                    <li>Cálculos automáticos de vuelos y hoteles</li>
                    <li>Conversión de divisas y pronóstico del clima</li>
                    <li>PDF con datos de contacto del asesor</li>
                    <li>Enlace interactivo vía WhatsApp</li>
                  </ul>
                </div>

                <div style={{ marginTop: 24 }}>
                  <Link to="/registro" className="boton secundario ancho chico">
                    Elegir Inicio
                  </Link>
                </div>
              </div>

              {/* PLAN 2: Agencia (Destacado) */}
              <div
                className="tarjeta"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '24px 20px',
                  border: '2px solid var(--marca)',
                  boxShadow: '0 4px 20px rgba(31, 111, 92, 0.12)',
                  position: 'relative',
                }}
              >
                <div>
                  <div className="fila-entre" style={{ marginBottom: 6 }}>
                    <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Agencia</h3>
                    <Insignia color="marca">Más Popular</Insignia>
                  </div>
                  <p className="suave" style={{ fontSize: '0.85rem', margin: '0 0 16px' }}>
                    Para agencias de viajes en crecimiento que buscan estandarizar sus ventas.
                  </p>

                  <div style={{ marginBottom: 16 }}>
                    <div className="numero grande" style={{ fontSize: '1.9rem', color: 'var(--marca)' }}>
                      {frecuencia === 'mensual' ? '$450 MXN' : '$4,650 MXN'}
                    </div>
                    <span className="tenue" style={{ fontSize: '0.8rem' }}>
                      {frecuencia === 'mensual' ? 'al mes' : 'al año (10.5 meses)'}
                    </span>
                  </div>

                  <div
                    style={{
                      background: 'var(--bg-suave, rgba(0,0,0,0.03))',
                      padding: '8px 12px',
                      borderRadius: 'var(--radio-xs)',
                      marginBottom: 16,
                      fontSize: '0.85rem',
                    }}
                  >
                    <strong>De 4 a 8 agentes incluidos</strong>
                  </div>

                  <ul className="pila-sm" style={{ paddingLeft: 18, margin: 0, fontSize: '0.88rem' }}>
                    <li><strong>150 itinerarios inteligentes</strong> al mes</li>
                    <li><strong>Asistente virtual de chat ilimitado</strong></li>
                    <li><strong>Logo y membrete oficial</strong> de la agencia en PDF</li>
                    <li><strong>Margen comercial automático</strong> (% o monto fijo)</li>
                    <li><strong>Ocultar desglose de precios</strong> (precio cerrado al cliente)</li>
                    <li><strong>Reporte mensual de productividad</strong> por agente</li>
                    <li><strong>Duplicar propuestas</strong> en 1 clic</li>
                    <li>Banco común de <strong>plantillas compartidas</strong></li>
                  </ul>
                </div>

                <div style={{ marginTop: 24 }}>
                  <Link to="/registro" className="boton ancho chico">
                    Elegir Agencia
                  </Link>
                </div>
              </div>

              {/* PLAN 3: Agencia Pro */}
              <div
                className="tarjeta"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '24px 20px',
                }}
              >
                <div>
                  <h3 style={{ margin: '0 0 6px', fontSize: '1.25rem' }}>Agencia Pro</h3>
                  <p className="suave" style={{ fontSize: '0.85rem', margin: '0 0 16px' }}>
                    Para agencias consolidadas con alto volumen y equipo extendido.
                  </p>

                  <div style={{ marginBottom: 16 }}>
                    <div className="numero grande" style={{ fontSize: '1.9rem', color: 'var(--marca)' }}>
                      {frecuencia === 'mensual' ? '$750 MXN' : '$7,800 MXN'}
                    </div>
                    <span className="tenue" style={{ fontSize: '0.8rem' }}>
                      {frecuencia === 'mensual' ? 'al mes' : 'al año (10.5 meses)'}
                    </span>
                  </div>

                  <div
                    style={{
                      background: 'var(--bg-suave, rgba(0,0,0,0.03))',
                      padding: '8px 12px',
                      borderRadius: 'var(--radio-xs)',
                      marginBottom: 16,
                      fontSize: '0.85rem',
                    }}
                  >
                    <strong>Hasta 15 agentes incluidos</strong>
                    <span className="tenue" style={{ display: 'block', fontSize: '0.75rem' }}>
                      +$75 MXN/mes por agente extra (16+)
                    </span>
                  </div>

                  <ul className="pila-sm" style={{ paddingLeft: 18, margin: 0, fontSize: '0.88rem' }}>
                    <li><strong>500 itinerarios inteligentes</strong> al mes</li>
                    <li><strong>Todo lo del plan Agencia</strong></li>
                    <li><strong>Marca Blanca:</strong> Sin mención de Rumbia en el pie de página de los PDFs</li>
                    <li><strong>Soporte prioritario</strong> directo vía WhatsApp</li>
                    <li>Asistente virtual de chat ilimitado</li>
                    <li>Reportes avanzados de ventas y cotizaciones</li>
                  </ul>
                </div>

                <div style={{ marginTop: 24 }}>
                  <Link to="/registro" className="boton secundario ancho chico">
                    Elegir Agencia Pro
                  </Link>
                </div>
              </div>
            </div>

            <p className="tenue centrado" style={{ margin: '20px 0 0', fontSize: '0.85rem' }}>
              🔒 Pagos procesados de forma 100% segura y encriptada por Stripe. Cancela o cambia de plan en cualquier momento.
            </p>
          </section>

          {/* 4. SECCIÓN: Finanzas Claras y Cero Intermediación (Stripe) */}
          <section>
            <div className="rejilla rejilla-2" style={{ gap: 20 }}>
              <Tarjeta
                titulo={
                  <div className="fila" style={{ gap: 8 }}>
                    <Icono nombre="recibo" tamano={22} className="icono-seccion" />
                    <span>Cálculos en Vivo y Divisas</span>
                  </div>
                }
              >
                <p className="suave" style={{ margin: '0 0 12px' }}>
                  Rumbia suma y convierte tus costos automáticamente en tiempo real:
                </p>
                <ul className="pila-sm" style={{ paddingLeft: 18, margin: 0, fontSize: '0.92rem' }}>
                  <li>
                    <strong>Vuelos, trenes y autos:</strong> Captura salidas, llegadas y claves de reserva.
                  </li>
                  <li>
                    <strong>Hospedaje por parada:</strong> Asigna hoteles a cada ciudad con cálculo automático por noche.
                  </li>
                  <li>
                    <strong>Multi-divisa:</strong> Registra en dólares, euros o moneda local; la app unifica el total.
                  </li>
                  <li>
                    <strong>Selector por persona:</strong> Mira cuánto cuesta el viaje por viajero individual o para el grupo.
                  </li>
                </ul>
              </Tarjeta>

              <Tarjeta
                titulo={
                  <div className="fila" style={{ gap: 8 }}>
                    <Icono nombre="palomita" tamano={22} className="icono-seccion" />
                    <span>Pagos Seguros con Stripe</span>
                  </div>
                }
              >
                <p className="suave" style={{ margin: '0 0 12px' }}>
                  Transparencia financiera absoluta y sin sorpresas:
                </p>
                <ul className="pila-sm" style={{ paddingLeft: 18, margin: 0, fontSize: '0.92rem' }}>
                  <li>
                    <strong>El único cobro en Rumbia:</strong> La suscripción de agencia, gestionada de forma cifrada mediante <strong>Stripe (PCI Nivel 1)</strong>.
                  </li>
                  <li>
                    <strong>Cero comisiones a viajeros:</strong> No cobramos tarifas extras por planear tu viaje.
                  </li>
                  <li>
                    <strong>Reservas directas:</strong> Los enlaces te llevan a proveedores oficiales (Booking, Skyscanner, Airbnb) donde tú o tu cliente pagan sin intermediarios.
                  </li>
                </ul>
              </Tarjeta>
            </div>
          </section>

          {/* 5. SECCIÓN: IA Gemini, Chatbot y Búsqueda Rápida */}
          <section>
            <Tarjeta>
              <div className="fila-entre" style={{ flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
                <div className="fila" style={{ gap: 10 }}>
                  <Icono nombre="chispa" tamano={24} className="icono-seccion" />
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.35rem' }}>
                      Asistencia Inteligente y Organización Total
                    </h3>
                    <p className="suave" style={{ margin: '3px 0 0', fontSize: '0.92rem' }}>
                      Tecnología inteligente y algoritmos avanzados para optimizar cada paso de tu viaje.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rejilla rejilla-3" style={{ gap: 16 }}>
                <div className="tarjeta-plana">
                  <div className="fila" style={{ gap: 6, marginBottom: 6 }}>
                    <Icono nombre="chispa" tamano={17} />
                    <h4 style={{ margin: 0 }}>Itinerarios inteligentes</h4>
                  </div>
                  <p className="tenue" style={{ fontSize: '0.88rem', margin: 0 }}>
                    Genera rutas día por día con actividades sugeridas, horarios, coordenadas para mapas y costos estimados.
                  </p>
                </div>

                <div className="tarjeta-plana">
                  <div className="fila" style={{ gap: 6, marginBottom: 6 }}>
                    <Icono nombre="arrastrar" tamano={17} />
                    <h4 style={{ margin: 0 }}>Edición drag-and-drop</h4>
                  </div>
                  <p className="tenue" style={{ fontSize: '0.88rem', margin: 0 }}>
                    Reordena y mueve actividades entre días con ratón o gestos táctiles en móvil. Ajuste total a tu gusto.
                  </p>
                </div>

                <div className="tarjeta-plana">
                  <div className="fila" style={{ gap: 6, marginBottom: 6 }}>
                    <Icono nombre="buscar" tamano={17} />
                    <h4 style={{ margin: 0 }}>Chatbot contextual</h4>
                  </div>
                  <p className="tenue" style={{ fontSize: '0.88rem', margin: 0 }}>
                    Asistente flotante que conoce los detalles de tu viaje: pregúntale rutas, clima o sugerencias en tiempo real.
                  </p>
                </div>
              </div>
            </Tarjeta>
          </section>

          {/* CTA Final */}
          <section style={{ textAlign: 'center', padding: 'var(--e4) 0 var(--e2)' }}>
            <Tarjeta className="centrado" style={{ padding: 'var(--e6) var(--e4)' }}>
              <h2 style={{ fontSize: '2.1rem', marginBottom: 10 }}>
                Comienza a planear con Rumbia hoy mismo
              </h2>
              <p className="suave" style={{ maxWidth: 580, margin: '0 auto 24px', fontSize: '1.05rem' }}>
                Prueba un itinerario generado por IA gratis y sin crear cuenta, o regístrate para tener control total de tus viajes y cotizaciones.
              </p>
              <div className="fila" style={{ justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
                <Link to={autenticado ? '/viajes' : '/registro'} className="boton">
                  {autenticado ? 'Ir a mis viajes' : 'Crear cuenta gratis'}
                </Link>
                {!autenticado && (
                  <Link to="/" className="boton secundario">
                    Generar itinerario sin cuenta
                  </Link>
                )}
              </div>
            </Tarjeta>
          </section>
        </div>
      </main>

      {/* Pie de página */}
      <footer className="pie">
        <div className="contenedor">
          <p className="tenue">
            Rumbia no procesa reservas ni pagos de viajes. Los enlaces te llevan al sitio del proveedor.
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
