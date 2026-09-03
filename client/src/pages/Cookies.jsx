import { Tarjeta } from '../components/ui.jsx';
import PaginaLegal from '../components/PaginaLegal.jsx';
import { CONTACTO_PRIVACIDAD } from '../config/legal.js';

/**
 * Aviso de cookies y rastreo de terceros.
 *
 * Rumbia SI coloca una cookie propia: la de sesion (tecnica, estrictamente
 * necesaria, httpOnly -- nada de analitica ni publicidad). El resto sigue
 * igual: no hay rastreo propio, pero los sitios de reserva a los que sales
 * si usan las suyas.
 */
export default function Cookies() {
  return (
    <PaginaLegal
      titulo="Cookies y rastreo"
      entrada="Resumen corto: Rumbia usa una sola cookie propia, técnica y necesaria para mantener tu sesión iniciada — nada de rastreo ni publicidad. Pero los sitios de reserva a los que te mandamos sí usan las suyas, y eso conviene que lo sepas antes de dar clic."
    >
      <Tarjeta titulo="Lo esencial, en tres líneas">
        <ul>
          <li>La única cookie que instalamos es la de tu sesión — ninguna de analítica ni publicidad.</li>
          <li>Es técnica y necesaria: por eso no hace falta pedirte consentimiento para ella.</li>
          <li>Al salir por un enlace de reserva entras a las reglas del proveedor, no a las nuestras.</li>
        </ul>
      </Tarjeta>

      <h2>1. La única cookie que instalamos: la de tu sesión</h2>
      <p>
        Rumbia coloca una sola cookie propia, <code>rumbia_token</code>, para mantener tu sesión
        iniciada sin que tengas que escribir tu contraseña en cada pantalla. Es una cookie{' '}
        <strong>técnica y estrictamente necesaria</strong>: no rastrea tu actividad, no identifica
        tus visitas a otros sitios y no se usa para publicidad. Además es <code>httpOnly</code>, lo
        que significa que ni siquiera el propio código de esta aplicación puede leer su contenido —
        solo la usa el navegador, en automático, para hablar con nuestro servidor.
      </p>
      <p>
        Por ser de ese tipo (esencial para que el servicio funcione), la mayoría de las leyes de
        privacidad no exige pedir tu consentimiento para ella — por eso no verás en esta aplicación
        un banner de cookies. Tampoco usamos Google Analytics, píxeles de redes sociales ni ninguna
        herramienta de publicidad.
      </p>
      <p>
        Sí contamos los clics en los enlaces de reserva, con una medición propia y{' '}
        <strong>sin cookies ni identificadores</strong>: se registra el proveedor, la sección y el
        destino, nunca quién pulsó. El detalle está en la{' '}
        <a href="/privacidad">política de privacidad</a>.
      </p>

      <h2>2. Qué más guardamos en tu navegador y por qué</h2>
      <p>
        Aparte de la cookie de sesión, guardamos dos datos sueltos en el{' '}
        <strong>almacenamiento local</strong> (<code>localStorage</code>) de tu navegador:
      </p>
      <ul>
        <li>
          <code>rumbia_tuvo_sesion</code> — no es un dato sensible ni sirve para identificarte: solo
          recuerda que este navegador inició sesión alguna vez, para poder avisarte &quot;tu sesión
          expiró&quot; en vez de mandarte al login sin explicación. Por sí solo no permite entrar a
          ningún lado.
        </li>
        <li>
          <code>rumbia-tema</code> — si elegiste modo claro u oscuro a mano (en vez de seguir el de tu
          sistema), para recordarlo en tu próxima visita. No dice nada de ti, solo la preferencia.
        </li>
      </ul>
      <p>
        A diferencia de la cookie de sesión, estos datos <strong>no se envían solos</strong> con cada
        petición ni pueden ser leídos por otros sitios: solo los usa esta aplicación, en tu propio
        navegador.
      </p>
      <p>
        <strong>Cómo eliminarlos:</strong> al cerrar sesión desde el menú, se borran al instante (y
        la cookie de sesión se cancela también del lado del servidor). También puedes borrarlos
        desde tu navegador, en las opciones de &quot;borrar datos del sitio&quot;. Si lo haces,
        simplemente tendrás que volver a iniciar sesión.
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
