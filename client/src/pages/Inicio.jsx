import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Icono from '../components/Icono.jsx';

/**
 * Portada pública.
 *
 * Antes traía el generador de prueba montado aquí mismo, pero eso mezclaba
 * dos cosas distintas: explicar qué es Rumbia y dejar jugar con una muestra
 * deliberadamente simple del producto (sin presupuesto, sin clima, sin
 * guardar nada) -- quien apenas llega podía quedarse con la idea de que eso
 * es todo lo que hace la app. Ahora la portada es corta a propósito: hero +
 * lo esencial, con un enlace directo a /probar para quien quiere jugar sin
 * cuenta y a /acerca para quien quiere ver todo lo que incluye (viajeros y
 * agencias, planes, CRM, plantillas...) antes de decidirse.
 */
export default function Inicio() {
  const { autenticado, cargando } = useAuth();

  // Con sesión no tiene sentido la portada: se va a sus viajes.
  if (cargando) return null;
  if (autenticado) return <Navigate to="/viajes" replace />;

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
            <Link to="/registro" className="boton">
              Comenzar gratis
            </Link>
            <Link to="/probar" className="boton secundario">
              Pruébalo sin cuenta
            </Link>
          </div>
          <p className="inicio-hero-confianza">
            <Icono nombre="palomita" tamano={14} />
            Sin tarjeta para probarlo
          </p>
        </div>
      </section>

      <section className="inicio-intro">
        <div className="contenedor">
          <p className="inicio-eyebrow">Todo en un solo lugar</p>
          <div className="inicio-puntos">
            {[
              ['chispa', 'Itinerario inteligente', 'Día por día, con horarios, categorías y sugerencias locales automáticas.'],
              ['pin', 'Mapa y clima', 'Las actividades ubicadas en el mapa y el pronóstico de tus fechas.'],
              ['recibo', 'Presupuesto real', 'Transporte, hospedaje y gastos sueltos en un solo total, con divisas convertidas.'],
            ].map(([icono, titulo, texto]) => (
              <div key={titulo} className="inicio-punto">
                <span className="inicio-punto-icono">
                  <Icono nombre={icono} tamano={22} />
                </span>
                <h3>{titulo}</h3>
                <p className="suave">{texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="inicio-perfiles">
        <div className="contenedor">
          <p className="inicio-eyebrow">Para cada tipo de viaje</p>
          <div className="rejilla rejilla-2" style={{ gap: 'var(--e5)' }}>
            <div className="tarjeta">
              <div className="fila" style={{ gap: 8, marginBottom: 10 }}>
                <Icono nombre="brujula" tamano={20} className="icono-seccion" />
                <h3 style={{ margin: 0 }}>Para viajeros</h3>
              </div>
              <p className="suave" style={{ margin: '0 0 10px' }}>
                Planea tus vacaciones o un viaje en grupo, gratis.
              </p>
              <ul className="pila-sm" style={{ paddingLeft: 18, margin: 0, fontSize: '0.92rem' }}>
                <li>Itinerarios con IA, día por día</li>
                <li>Presupuesto y gastos en un solo lugar</li>
                <li>Clima y mapa de cada destino</li>
              </ul>
            </div>

            <div className="tarjeta">
              <div className="fila" style={{ gap: 8, marginBottom: 10 }}>
                <Icono nombre="maleta" tamano={20} className="icono-seccion" />
                <h3 style={{ margin: 0 }}>Para agencias</h3>
              </div>
              <p className="suave" style={{ margin: '0 0 10px' }}>
                Cotiza con tu marca, cobra tu margen y da seguimiento a tus clientes.
              </p>
              <ul className="pila-sm" style={{ paddingLeft: 18, margin: 0, fontSize: '0.92rem' }}>
                <li>Cotizaciones con tu logo y margen comercial</li>
                <li>CRM de clientes y plantillas reutilizables</li>
                <li>Seguimiento del embudo de ventas</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="inicio-cierre">
        <div className="contenedor inicio-cierre-caja">
          <h2>¿Quieres ver todo el detalle?</h2>
          <p className="suave">
            Planes de agencia, cómo funciona la cotización con tu marca, y todo lo demás que
            incluye Rumbia.
          </p>
          <Link to="/acerca" className="boton secundario">
            Ver todo lo que incluye
          </Link>
        </div>
      </section>

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
