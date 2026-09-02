import { Tarjeta } from '../components/ui.jsx';
import PaginaLegal from '../components/PaginaLegal.jsx';
import { CONTACTO_PRIVACIDAD } from '../config/legal.js';

/**
 * Aviso de cookies y rastreo de terceros.
 *
 * Rumbia no coloca cookies propias: la sesión vive en localStorage. Lo que sí
 * hay es rastreo de terceros en cuanto sales por un enlace de reserva, y eso es
 * lo que este documento tiene que dejar claro.
 */
export default function Cookies() {
  return (
    <PaginaLegal
      titulo="Cookies y rastreo"
      entrada="Resumen corto: Rumbia no te pone cookies. Pero los sitios de reserva a los que te mandamos sí usan las suyas, y eso conviene que lo sepas antes de dar clic."
    >
      <Tarjeta titulo="Lo esencial, en tres líneas">
        <ul>
          <li>Rumbia no instala cookies propias ni herramientas de analítica.</li>
          <li>Tu sesión se guarda en el almacenamiento local de tu navegador, no en una cookie.</li>
          <li>Al salir por un enlace de reserva entras a las reglas del proveedor, no a las nuestras.</li>
        </ul>
      </Tarjeta>

      <h2>1. Rumbia no usa cookies propias</h2>
      <p>
        No colocamos cookies en tu navegador. Tampoco usamos Google Analytics, píxeles de redes
        sociales ni ninguna herramienta de publicidad. Por eso no verás en esta aplicación un banner
        de consentimiento de cookies: no hay nada que consentir.
      </p>
      <p>
        Sí contamos los clics en los enlaces de reserva, con una medición propia y{' '}
        <strong>sin cookies ni identificadores</strong>: se registra el proveedor, la sección y el
        destino, nunca quién pulsó. El detalle está en la{' '}
        <a href="/privacidad">política de privacidad</a>.
      </p>

      <h2>2. Qué guardamos en tu navegador y por qué</h2>
      <p>
        Para mantener tu sesión abierta guardamos un dato en el{' '}
        <strong>almacenamiento local</strong> (<code>localStorage</code>) de tu navegador:
      </p>
      <ul>
        <li>
          <code>rumbia_token</code> — el token de sesión que demuestra que ya iniciaste sesión, para
          que no tengas que escribir tu contraseña en cada pantalla.
        </li>
        <li>
          <code>rumbia-tema</code> — si elegiste modo claro u oscuro a mano (en vez de seguir el de tu
          sistema), para recordarlo en tu próxima visita. No dice nada de ti, solo la preferencia.
        </li>
      </ul>
      <p>
        A diferencia de una cookie, estos datos <strong>no se envían solos</strong> con cada petición
        ni pueden ser leídos por otros sitios: solo los usa esta aplicación, y el token únicamente
        para hablar con su propia API.
      </p>
      <p>
        <strong>Cómo eliminarlo:</strong> al cerrar sesión desde el menú, se borra al instante.
        También puedes borrarlo desde tu navegador, en las opciones de &quot;borrar datos del
        sitio&quot;. Si lo haces, simplemente tendrás que volver a iniciar sesión.
      </p>

      <h2>3. Los enlaces de reserva sí llevan a sitios que rastrean</h2>
      <p>
        Rumbia no vende vuelos ni hospedaje. Lo que hace es armar el enlace de búsqueda ya lleno con
        los datos de tu viaje y mandarte al sitio del proveedor —Skyscanner, Booking.com, Airbnb,
        Kayak, Rome2Rio, Busbud, Hostelworld, DiscoverCars, Uber, DiDi, Moovit y similares.
      </p>
      <p>
        <strong>Al hacer clic en uno de esos enlaces sales de Rumbia y entras a un sitio de terceros,
        con sus propias reglas de privacidad y sus propias cookies.</strong> Esos sitios pueden
        colocar cookies de sesión, de preferencias, de análisis y de publicidad en tu navegador. Eso
        ocurre fuera de nuestro control y no tenemos forma de verlo, desactivarlo ni consultarlo.
      </p>
      <p>
        Si quieres saber qué hace cada uno con tus datos, revisa la política de privacidad del
        proveedor en cuestión antes de continuar.
      </p>

      <h2>4. Programas de afiliados</h2>
      <p>
        Rumbia podrá participar en programas de afiliados. En la práctica esto significa que
        algunos de los enlaces de reserva podrían llevar un identificador que indica que la
        visita vino de Rumbia. Cuando eso pase, el enlace se marca como "Afiliado" en pantalla.
      </p>
      <p>Cuando das clic en uno de esos enlaces:</p>
      <ul>
        <li>La red de afiliados puede colocar una cookie en tu navegador para reconocer que llegaste desde aquí, normalmente durante un periodo limitado.</li>
        <li>Si terminas reservando, el proveedor puede pagarnos una comisión. <strong>Nunca supone un costo extra para ti</strong>, ni cambia el precio que te ofrecen.</li>
        <li>Ese identificador dice de dónde vienes, <strong>no quién eres</strong>: en la dirección del enlace solo viajan datos del viaje (origen, destino, fechas y número de viajeros), nunca tu nombre, tu correo ni tu identificador de cuenta.</li>
      </ul>
      <p>
        Las cookies que coloque la red de afiliados o el proveedor las controlas desde tu navegador,
        igual que las de cualquier otro sitio: puedes bloquear cookies de terceros o borrarlas
        cuando quieras. Bloquearlas no afecta el funcionamiento de Rumbia.
      </p>

      <h2>5. Preguntas</h2>
      <p>
        Si algo de esto no queda claro o quieres saber exactamente qué se envía en un enlace
        concreto, escríbenos a <strong><a href={`mailto:${CONTACTO_PRIVACIDAD}`}>{CONTACTO_PRIVACIDAD}</a></strong>. También puedes revisar la{' '}
        <a href="/privacidad">política de privacidad</a>, donde está el detalle de qué datos se
        guardan y con quién se comparten.
      </p>
    </PaginaLegal>
  );
}
