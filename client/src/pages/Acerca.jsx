import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import { useTema } from '../hooks/useTema.js';
import { useMetaPagina } from '../hooks/useMetaPagina.js';
import { useJsonLd } from '../hooks/useJsonLd.js';
import { CORREO_SOPORTE, ENLACE_WHATSAPP } from '../config/contacto.js';

// Fuera del componente para que sea la misma referencia en cada render: si
// viviera adentro, cada vez que se toca el toggle mensual/anual el hook de
// abajo la tomaria como "datos nuevos" y reescribiria el <script> sin
// necesidad. Precios mensuales (los que se ven por default al entrar), no
// los de los tres planes en las dos frecuencias -- Google solo quiere UNA
// oferta representativa por producto, no las seis combinaciones.
//
// Se queda en español a proposito, sin importar el idioma elegido en
// pantalla: es el dato que Google indexa para /acerca, y esa URL es la
// version en español del sitio (la version en ingles todavia no tiene su
// propia ruta/hreflang -- ver Fase 2 del plan de traduccion).
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
import TextoConEnfasis from '../components/TextoConEnfasis.jsx';
import SelectorIdioma from '../components/SelectorIdioma.jsx';
import { Boton, Tarjeta, Insignia } from '../components/ui.jsx';

// Mismos montos que TarjetaAgencia.jsx (checkout real) y stripe-setup.mjs
// (Price reales en Stripe): duplicado a proposito para no acoplar la pagina
// publica al componente de facturacion del perfil, que vive detras de login.
const PRECIOS_AGENCIA = {
  inicio: { mxn: { mensual: '$190 MXN', anual: '$1,950 MXN' }, usd: { mensual: '$10 USD', anual: '$104 USD' } },
  agencia: { mxn: { mensual: '$450 MXN', anual: '$4,650 MXN' }, usd: { mensual: '$25 USD', anual: '$260 USD' } },
  pro: { mxn: { mensual: '$750 MXN', anual: '$7,800 MXN' }, usd: { mensual: '$40 USD', anual: '$416 USD' } },
};
const PRECIO_AGENTE_EXTRA_PRO = {
  mxn: { mensual: '+$75 MXN/mes por agente extra (16+)', anual: '+$780 MXN/año por agente extra (16+)' },
  usd: { mensual: '+$4 USD/mes por agente extra (16+)', anual: '+$42 USD/año por agente extra (16+)' },
};

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
  const { t } = useTranslation('acerca');
  const { autenticado } = useAuth();
  useMetaPagina({
    titulo: t('meta.titulo'),
    descripcion: t('meta.descripcion'),
    ruta: '/acerca',
  });
  useJsonLd('jsonld-precios-acerca', DATOS_ESTRUCTURADOS_PRECIOS);

  // Estado para el simulador interactivo de propuesta
  const [modoDesglose, setModoDesglose] = useState('total'); // 'total' | 'desglose'

  // Estado para la frecuencia de cobro: 'mensual' | 'anual'
  const [frecuencia, setFrecuencia] = useState('mensual');

  // Divisa en la que se muestran los planes de agencia: 'mxn' | 'usd'. MXN
  // sigue siendo el default -- es la divisa que de verdad cobra la mayoria
  // de las tarjetas mexicanas hoy.
  const [moneda, setMoneda] = useState('mxn');

  const puntosViajeros = t('dosMundos.viajeros.puntos', { returnObjects: true });
  const puntosAgencias = t('dosMundos.agencias.puntos', { returnObjects: true });
  const puntosInicio = t('planes.inicio.puntos', { returnObjects: true });
  const puntosAgencia = t('planes.agencia.puntos', { returnObjects: true });
  const puntosPro = t('planes.pro.puntos', { returnObjects: true });
  const puntosCalculos = t('finanzas.calculos.puntos', { returnObjects: true });
  const puntosStripe = t('finanzas.stripe.puntos', { returnObjects: true });

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
            <SelectorIdioma />
            <ToggleTema />
            {autenticado ? (
              <Link to="/viajes" className="boton chico">
                {t('nav.irAMisViajes')}
              </Link>
            ) : (
              <>
                <Link to="/entrar" className="boton secundario chico">
                  {t('comun:nav.entrar')}
                </Link>
                <Link to="/registro" className="boton chico">
                  {t('comun:nav.crearCuenta')}
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
            <Insignia color="marca">{t('hero.insignia')}</Insignia>
          </div>
          <h1 style={{ fontSize: '2.5rem', lineHeight: 1.18, marginBottom: 16 }}>{t('hero.titulo')}</h1>
          <p style={{ fontSize: '1.18rem', lineHeight: 1.6, maxWidth: 720, margin: '0 auto 28px' }}>
            {t('hero.texto')}
          </p>
          <div className="fila" style={{ justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Link to={autenticado ? '/viajes/nuevo' : '/registro'} className="boton">
              <Icono nombre="chispa" tamano={16} />{' '}
              {autenticado ? t('hero.crearViaje') : t('hero.comenzarGratis')}
            </Link>
            {!autenticado && (
              <Link to="/probar" className="boton secundario">
                {t('hero.probarSinCuenta')}
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
              <span className="etiqueta">{t('dosMundos.etiqueta')}</span>
              <h2 style={{ fontSize: '1.9rem', marginTop: 4 }}>{t('dosMundos.titulo')}</h2>
              <p className="suave" style={{ maxWidth: 660, margin: '6px auto 0' }}>
                {t('dosMundos.texto')}
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
                      <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{t('dosMundos.viajeros.titulo')}</h3>
                    </div>
                    <Insignia color="verde">{t('dosMundos.viajeros.insignia')}</Insignia>
                  </div>

                  <p className="suave" style={{ fontSize: '0.94rem', margin: '0 0 16px' }}>
                    {t('dosMundos.viajeros.texto')}
                  </p>

                  <ul className="pila-sm" style={{ paddingLeft: 18, margin: '0 0 20px', fontSize: '0.92rem' }}>
                    {puntosViajeros.map((p) => (
                      <li key={p.fuerte}>
                        <strong>{p.fuerte}:</strong> {p.texto}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Límites claros para viajeros */}
                <div
                  style={{
                    background: 'var(--arena-200)',
                    padding: '12px 14px',
                    borderRadius: 'var(--radio-sm)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div className="fila" style={{ gap: 6, marginBottom: 4 }}>
                    <Icono nombre="info" tamano={15} />
                    <strong style={{ fontSize: '0.85rem' }}>{t('dosMundos.viajeros.limites.titulo')}</strong>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.82rem', color: 'var(--texto-suave)' }}>
                    <li>
                      <strong>{t('dosMundos.viajeros.limites.itinerarios')}</strong>{' '}
                      {t('dosMundos.viajeros.limites.itinerariosNota')}
                    </li>
                    <li>
                      <strong>{t('dosMundos.viajeros.limites.chat')}</strong>
                    </li>
                    <li>
                      <em>{t('dosMundos.viajeros.limites.sinLimite')}</em>
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
                  borderTop: '4px solid var(--verde-800)',
                }}
              >
                <div>
                  <div className="fila-entre" style={{ marginBottom: 12 }}>
                    <div className="fila" style={{ gap: 8 }}>
                      <Icono nombre="maleta" tamano={22} className="icono-seccion" />
                      <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{t('dosMundos.agencias.titulo')}</h3>
                    </div>
                    <Insignia color="marca">{t('dosMundos.agencias.insignia')}</Insignia>
                  </div>

                  <p className="suave" style={{ fontSize: '0.94rem', margin: '0 0 16px' }}>
                    {t('dosMundos.agencias.texto')}
                  </p>

                  <ul className="pila-sm" style={{ paddingLeft: 18, margin: '0 0 20px', fontSize: '0.92rem' }}>
                    {puntosAgencias.map((p) => (
                      <li key={p.fuerte}>
                        <strong>{p.fuerte}:</strong> {p.texto}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Resumen de planes y botón para desplegar */}
                <div
                  style={{
                    background: 'var(--arena-200)',
                    padding: '12px 14px',
                    borderRadius: 'var(--radio-sm)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div className="fila-entre" style={{ alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: '0.85rem', display: 'block' }}>
                        {t('dosMundos.agencias.resumen.titulo')}
                      </strong>
                      <span className="tenue" style={{ fontSize: '0.8rem' }}>
                        {t('dosMundos.agencias.resumen.texto')}
                      </span>
                    </div>
                    <a
                      href="#planes-agencia"
                      className="boton chico secundario"
                      style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                    >
                      {t('dosMundos.agencias.resumen.verPlanes')}
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
                      {t('simulador.etiqueta')}
                    </span>
                  </div>
                  <h3 style={{ margin: '4px 0 0', fontSize: '1.35rem' }}>{t('simulador.titulo')}</h3>
                  <p className="suave" style={{ margin: 0, fontSize: '0.92rem' }}>
                    {t('simulador.texto')}
                  </p>
                </div>

                {/* Selector interactivo */}
                <div className="fila" style={{ background: 'var(--arena-300)', padding: 4, borderRadius: 'var(--radio-sm)' }}>
                  <button
                    type="button"
                    className={`boton chico ${modoDesglose === 'total' ? '' : 'fantasma'}`}
                    onClick={() => setModoDesglose('total')}
                    style={{ fontSize: '0.82rem' }}
                  >
                    {t('simulador.soloTotal')}
                  </button>
                  <button
                    type="button"
                    className={`boton chico ${modoDesglose === 'desglose' ? '' : 'fantasma'}`}
                    onClick={() => setModoDesglose('desglose')}
                    style={{ fontSize: '0.82rem' }}
                  >
                    {t('simulador.desgloseCompleto')}
                  </button>
                </div>
              </div>

              {/* Vista simulada de la cotización */}
              <div
                style={{
                  border: '1.5px solid var(--border)',
                  borderRadius: 'var(--radio)',
                  padding: '20px',
                  background: 'var(--surface)',
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
                      <strong style={{ fontSize: '1.05rem', display: 'block' }}>{t('simulador.demo.agencia')}</strong>
                      <span className="tenue" style={{ fontSize: '0.8rem' }}>
                        {t('simulador.demo.contacto')}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Insignia color="marca">{t('simulador.demo.insignia')}</Insignia>
                    <span className="tenue" style={{ display: 'block', fontSize: '0.78rem', marginTop: 3 }}>
                      {t('simulador.demo.cliente')}
                    </span>
                  </div>
                </div>

                {/* Contenido según el modo */}
                {modoDesglose === 'desglose' ? (
                  <div className="pila-sm">
                    <div className="fila-entre" style={{ padding: '6px 0', borderBottom: '1px dashed var(--border)' }}>
                      <span className="suave">{t('simulador.demo.vuelos')}</span>
                      <span className="numero">$9,600 MXN</span>
                    </div>
                    <div className="fila-entre" style={{ padding: '6px 0', borderBottom: '1px dashed var(--border)' }}>
                      <span className="suave">{t('simulador.demo.hotel')}</span>
                      <span className="numero">$18,400 MXN</span>
                    </div>
                    <div className="fila-entre" style={{ padding: '6px 0', borderBottom: '1px dashed var(--border)' }}>
                      <span className="suave">{t('simulador.demo.transporte')}</span>
                      <span className="numero">$3,200 MXN</span>
                    </div>
                    <div className="fila-entre" style={{ padding: '6px 0', borderBottom: '1px dashed var(--border)' }}>
                      <span className="suave">{t('simulador.demo.actividades')}</span>
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
                      <span>{t('simulador.demo.cuotaServicio')}</span>
                      <span className="numero">+$5,490 MXN</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '10px 0', textAlign: 'center' }}>
                    <p className="suave" style={{ margin: '0 0 10px', fontSize: '0.92rem' }}>
                      {t('simulador.demo.incluye')}
                    </p>
                    <span className="insignia" style={{ fontSize: '0.8rem' }}>
                      {t('simulador.demo.tarifaPreferencial')}
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
                      {t('simulador.demo.precioFinal')}
                    </span>
                    <span className="tenue" style={{ display: 'block', fontSize: '0.82rem' }}>
                      {t('simulador.demo.totalViaje')}
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
                {t('simulador.ayuda')}
              </p>
            </Tarjeta>
          </section>

          {/* 3. SECCIÓN: Planes Detallados de Agencia con Selector de Frecuencia */}
          <section id="planes-agencia">
            <div style={{ textAlign: 'center', marginBottom: 'var(--e4)' }}>
              <span className="etiqueta">{t('planes.etiqueta')}</span>
              <h2 style={{ fontSize: '1.8rem', marginTop: 4 }}>{t('planes.titulo')}</h2>
              <p className="suave" style={{ maxWidth: 640, margin: '6px auto 18px' }}>
                {t('planes.texto')}
              </p>

              {/* Selector Mensual / Anual */}
              <div
                className="fila"
                style={{
                  justifyContent: 'center',
                  background: 'var(--arena-300)',
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
                  {t('planes.pagoMensual')}
                </button>
                <button
                  type="button"
                  className={`boton chico ${frecuencia === 'anual' ? '' : 'fantasma'}`}
                  onClick={() => setFrecuencia('anual')}
                  style={{ fontSize: '0.88rem' }}
                >
                  {t('planes.pagoAnual')} <Insignia color="verde" style={{ marginLeft: 6 }}>{t('planes.ahorra')}</Insignia>
                </button>
              </div>

              {/* Selector MXN / USD */}
              <div
                className="fila"
                style={{
                  justifyContent: 'center',
                  background: 'var(--arena-300)',
                  display: 'inline-flex',
                  padding: '4px',
                  borderRadius: 'var(--radio)',
                  gap: 4,
                  marginTop: 8,
                }}
              >
                <button
                  type="button"
                  className={`boton chico ${moneda === 'mxn' ? '' : 'fantasma'}`}
                  onClick={() => setMoneda('mxn')}
                  style={{ fontSize: '0.88rem' }}
                >
                  {t('planes.pesos')}
                </button>
                <button
                  type="button"
                  className={`boton chico ${moneda === 'usd' ? '' : 'fantasma'}`}
                  onClick={() => setMoneda('usd')}
                  style={{ fontSize: '0.88rem' }}
                >
                  {t('planes.dolares')}
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
                  <h3 style={{ margin: '0 0 6px', fontSize: '1.25rem' }}>{t('planes.inicio.nombre')}</h3>
                  <p className="suave" style={{ fontSize: '0.85rem', margin: '0 0 16px' }}>
                    {t('planes.inicio.texto')}
                  </p>

                  <div style={{ marginBottom: 16 }}>
                    <div className="numero grande" style={{ fontSize: '1.9rem', color: 'var(--marca)' }}>
                      {PRECIOS_AGENCIA.inicio[moneda][frecuencia]}
                    </div>
                    <span className="tenue" style={{ fontSize: '0.8rem' }}>
                      {frecuencia === 'mensual' ? t('planes.alMes') : t('planes.alAnio')}
                    </span>
                  </div>

                  <div
                    style={{
                      background: 'var(--arena-200)',
                      padding: '8px 12px',
                      borderRadius: 'var(--radio-xs)',
                      marginBottom: 16,
                      fontSize: '0.85rem',
                    }}
                  >
                    <strong>{t('planes.inicio.agentes')}</strong>
                  </div>

                  <ul className="pila-sm" style={{ paddingLeft: 18, margin: 0, fontSize: '0.88rem' }}>
                    {puntosInicio.map((p) => (
                      <li key={p}><TextoConEnfasis texto={p} /></li>
                    ))}
                  </ul>
                </div>

                <div style={{ marginTop: 24 }}>
                  <Link to="/registro" className="boton secundario ancho chico">
                    {t('planes.inicio.elegir')}
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
                    <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{t('planes.agencia.nombre')}</h3>
                    <Insignia color="marca">{t('planes.agencia.masPopular')}</Insignia>
                  </div>
                  <p className="suave" style={{ fontSize: '0.85rem', margin: '0 0 16px' }}>
                    {t('planes.agencia.texto')}
                  </p>

                  <div style={{ marginBottom: 16 }}>
                    <div className="numero grande" style={{ fontSize: '1.9rem', color: 'var(--marca)' }}>
                      {PRECIOS_AGENCIA.agencia[moneda][frecuencia]}
                    </div>
                    <span className="tenue" style={{ fontSize: '0.8rem' }}>
                      {frecuencia === 'mensual' ? t('planes.alMes') : t('planes.alAnio')}
                    </span>
                  </div>

                  <div
                    style={{
                      background: 'var(--arena-200)',
                      padding: '8px 12px',
                      borderRadius: 'var(--radio-xs)',
                      marginBottom: 16,
                      fontSize: '0.85rem',
                    }}
                  >
                    <strong>{t('planes.agencia.agentes')}</strong>
                  </div>

                  <ul className="pila-sm" style={{ paddingLeft: 18, margin: 0, fontSize: '0.88rem' }}>
                    {puntosAgencia.map((p) => (
                      <li key={p}><TextoConEnfasis texto={p} /></li>
                    ))}
                  </ul>
                </div>

                <div style={{ marginTop: 24 }}>
                  <Link to="/registro" className="boton ancho chico">
                    {t('planes.agencia.elegir')}
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
                  <h3 style={{ margin: '0 0 6px', fontSize: '1.25rem' }}>{t('planes.pro.nombre')}</h3>
                  <p className="suave" style={{ fontSize: '0.85rem', margin: '0 0 16px' }}>
                    {t('planes.pro.texto')}
                  </p>

                  <div style={{ marginBottom: 16 }}>
                    <div className="numero grande" style={{ fontSize: '1.9rem', color: 'var(--marca)' }}>
                      {PRECIOS_AGENCIA.pro[moneda][frecuencia]}
                    </div>
                    <span className="tenue" style={{ fontSize: '0.8rem' }}>
                      {frecuencia === 'mensual' ? t('planes.alMes') : t('planes.alAnio')}
                    </span>
                  </div>

                  <div
                    style={{
                      background: 'var(--arena-200)',
                      padding: '8px 12px',
                      borderRadius: 'var(--radio-xs)',
                      marginBottom: 16,
                      fontSize: '0.85rem',
                    }}
                  >
                    <strong>{t('planes.pro.agentes')}</strong>
                    <span className="tenue" style={{ display: 'block', fontSize: '0.75rem' }}>
                      {PRECIO_AGENTE_EXTRA_PRO[moneda][frecuencia]}
                    </span>
                  </div>

                  <ul className="pila-sm" style={{ paddingLeft: 18, margin: 0, fontSize: '0.88rem' }}>
                    {puntosPro.map((p) => (
                      <li key={p}><TextoConEnfasis texto={p} /></li>
                    ))}
                  </ul>
                </div>

                <div style={{ marginTop: 24 }}>
                  <Link to="/registro" className="boton secundario ancho chico">
                    {t('planes.pro.elegir')}
                  </Link>
                </div>
              </div>
            </div>

            <p className="tenue centrado" style={{ margin: '20px 0 0', fontSize: '0.85rem' }}>
              {t('planes.avisoStripe')}
            </p>
          </section>

          {/* 4. SECCIÓN: Finanzas Claras y Cero Intermediación (Stripe) */}
          <section>
            <div className="rejilla rejilla-2" style={{ gap: 20 }}>
              <Tarjeta
                titulo={
                  <div className="fila" style={{ gap: 8 }}>
                    <Icono nombre="recibo" tamano={22} className="icono-seccion" />
                    <span>{t('finanzas.calculos.titulo')}</span>
                  </div>
                }
              >
                <p className="suave" style={{ margin: '0 0 12px' }}>
                  {t('finanzas.calculos.texto')}
                </p>
                <ul className="pila-sm" style={{ paddingLeft: 18, margin: 0, fontSize: '0.92rem' }}>
                  {puntosCalculos.map((p) => (
                    <li key={p.fuerte}>
                      <strong>{p.fuerte}:</strong> {p.texto}
                    </li>
                  ))}
                </ul>
              </Tarjeta>

              <Tarjeta
                titulo={
                  <div className="fila" style={{ gap: 8 }}>
                    <Icono nombre="palomita" tamano={22} className="icono-seccion" />
                    <span>{t('finanzas.stripe.titulo')}</span>
                  </div>
                }
              >
                <p className="suave" style={{ margin: '0 0 12px' }}>
                  {t('finanzas.stripe.texto')}
                </p>
                <ul className="pila-sm" style={{ paddingLeft: 18, margin: 0, fontSize: '0.92rem' }}>
                  {puntosStripe.map((p) => (
                    <li key={p.fuerte}>
                      <strong>{p.fuerte}:</strong> {p.texto}
                    </li>
                  ))}
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
                    <h3 style={{ margin: 0, fontSize: '1.35rem' }}>{t('ia.titulo')}</h3>
                    <p className="suave" style={{ margin: '3px 0 0', fontSize: '0.92rem' }}>
                      {t('ia.texto')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rejilla rejilla-3" style={{ gap: 16 }}>
                <div className="tarjeta-plana">
                  <div className="fila" style={{ gap: 6, marginBottom: 6 }}>
                    <Icono nombre="chispa" tamano={17} />
                    <h4 style={{ margin: 0 }}>{t('ia.itinerarios.titulo')}</h4>
                  </div>
                  <p className="tenue" style={{ fontSize: '0.88rem', margin: 0 }}>
                    {t('ia.itinerarios.texto')}
                  </p>
                </div>

                <div className="tarjeta-plana">
                  <div className="fila" style={{ gap: 6, marginBottom: 6 }}>
                    <Icono nombre="arrastrar" tamano={17} />
                    <h4 style={{ margin: 0 }}>{t('ia.edicion.titulo')}</h4>
                  </div>
                  <p className="tenue" style={{ fontSize: '0.88rem', margin: 0 }}>
                    {t('ia.edicion.texto')}
                  </p>
                </div>

                <div className="tarjeta-plana">
                  <div className="fila" style={{ gap: 6, marginBottom: 6 }}>
                    <Icono nombre="buscar" tamano={17} />
                    <h4 style={{ margin: 0 }}>{t('ia.chatbot.titulo')}</h4>
                  </div>
                  <p className="tenue" style={{ fontSize: '0.88rem', margin: 0 }}>
                    {t('ia.chatbot.texto')}
                  </p>
                </div>
              </div>
            </Tarjeta>
          </section>

          {/* 6. SECCIÓN: CRM, plantillas y viajes multi-destino */}
          <section>
            <Tarjeta>
              <div className="fila-entre" style={{ flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
                <div className="fila" style={{ gap: 10 }}>
                  <Icono nombre="persona" tamano={24} className="icono-seccion" />
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.35rem' }}>{t('crm.titulo')}</h3>
                    <p className="suave" style={{ margin: '3px 0 0', fontSize: '0.92rem' }}>
                      {t('crm.texto')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rejilla rejilla-3" style={{ gap: 16 }}>
                <div className="tarjeta-plana">
                  <div className="fila" style={{ gap: 6, marginBottom: 6 }}>
                    <Icono nombre="persona" tamano={17} />
                    <h4 style={{ margin: 0 }}>{t('crm.clientes.titulo')}</h4>
                  </div>
                  <p className="tenue" style={{ fontSize: '0.88rem', margin: 0 }}>
                    {t('crm.clientes.texto')}
                  </p>
                </div>

                <div className="tarjeta-plana">
                  <div className="fila" style={{ gap: 6, marginBottom: 6 }}>
                    <Icono nombre="calendario" tamano={17} />
                    <h4 style={{ margin: 0 }}>{t('crm.plantillas.titulo')}</h4>
                  </div>
                  <p className="tenue" style={{ fontSize: '0.88rem', margin: 0 }}>
                    {t('crm.plantillas.texto')}
                  </p>
                </div>

                <div className="tarjeta-plana">
                  <div className="fila" style={{ gap: 6, marginBottom: 6 }}>
                    <Icono nombre="pin" tamano={17} />
                    <h4 style={{ margin: 0 }}>{t('crm.multiDestino.titulo')}</h4>
                  </div>
                  <p className="tenue" style={{ fontSize: '0.88rem', margin: 0 }}>
                    {t('crm.multiDestino.texto')}
                  </p>
                </div>
              </div>
            </Tarjeta>
          </section>

          {/* CTA Final */}
          <section style={{ textAlign: 'center', padding: 'var(--e4) 0 var(--e2)' }}>
            <Tarjeta className="centrado" style={{ padding: 'var(--e6) var(--e4)' }}>
              <h2 style={{ fontSize: '2.1rem', marginBottom: 10 }}>{t('cta.titulo')}</h2>
              <p className="suave" style={{ maxWidth: 580, margin: '0 auto 24px', fontSize: '1.05rem' }}>
                {t('cta.texto')}
              </p>
              <div className="fila" style={{ justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
                <Link to={autenticado ? '/viajes' : '/registro'} className="boton">
                  {autenticado ? t('cta.irAMisViajes') : t('cta.crearCuentaGratis')}
                </Link>
                {!autenticado && (
                  <Link to="/probar" className="boton secundario">
                    {t('cta.generarSinCuenta')}
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
          <p className="tenue">{t('pie.aviso')}</p>
          <p className="tenue">
            {t('pie.contactoIntro')}{' '}
            <a href={`mailto:${CORREO_SOPORTE}`}>{CORREO_SOPORTE}</a> {t('pie.contactoOPor')}{' '}
            <a href={ENLACE_WHATSAPP} target="_blank" rel="noopener noreferrer">
              {t('pie.whatsapp')}
            </a>
            .
          </p>
          <nav className="pie-enlaces" aria-label={t('pie.ariaEnlaces')}>
            <Link to="/acerca">{t('comun:piePagina.acercaDe')}</Link>
            <Link to="/privacidad">{t('comun:piePagina.privacidad')}</Link>
            <Link to="/cookies">{t('comun:piePagina.cookies')}</Link>
            <Link to="/terminos">{t('comun:piePagina.terminos')}</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
