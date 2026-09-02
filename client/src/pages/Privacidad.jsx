import { Tarjeta } from '../components/ui.jsx';
import PaginaLegal from '../components/PaginaLegal.jsx';
import { RESPONSABLE, CONTACTO_PRIVACIDAD } from '../config/legal.js';

/**
 * Política de privacidad.
 *
 * El contenido describe lo que el código hace hoy, ni más ni menos: los campos
 * salen de los modelos (User, Trip, Itinerary, Expense) y los terceros de los
 * servicios que realmente se llaman. Si cambia alguno de esos archivos, hay que
 * actualizar esta página.
 */
export default function Privacidad() {
  return (
    <PaginaLegal
      titulo="Política de privacidad"
      entrada="Rumbia guarda la información de tus viajes para poder planearlos contigo. Esta página explica qué datos se guardan, con quién se comparten y cómo puedes pedir que se borren. Está escrita para que se entienda, no para cubrirnos las espaldas."
    >
      <Tarjeta titulo="Lo esencial, en tres líneas">
        <ul>
          <li>Tus datos se usan para prestarte el servicio. No se venden ni se usan para publicidad.</li>
          <li>Rumbia no cobra ni procesa reservas: cuando reservas, sales a otro sitio.</li>
          <li>Puedes pedir acceso, corrección o borrado de tus datos escribiendo a{' '}
            <strong><a href={`mailto:${CONTACTO_PRIVACIDAD}`}>{CONTACTO_PRIVACIDAD}</a></strong>.
          </li>
        </ul>
      </Tarjeta>

      <h2>1. Quién es responsable de tus datos</h2>
      <p>
        El responsable del tratamiento de los datos personales que recabamos es{' '}
        <strong>{RESPONSABLE}</strong>. Para cualquier asunto relacionado con esta política puedes
        escribir a <strong><a href={`mailto:${CONTACTO_PRIVACIDAD}`}>{CONTACTO_PRIVACIDAD}</a></strong>.
      </p>
      <p>
        Rumbia es un planeador de viajes: centraliza la información de tu viaje y te ayuda a armar un
        itinerario. <strong>No vende vuelos ni hospedaje, no procesa pagos y no cobra comisiones al
        usuario.</strong>
      </p>

      <h2>2. Qué datos recabamos</h2>
      <p>Solo lo que tú escribes en la aplicación, más lo que cualquier servidor registra al operar.</p>

      <h3>Datos de tu cuenta</h3>
      <ul>
        <li><strong>Nombre y correo electrónico</strong>, para identificarte y para que puedas iniciar sesión.</li>
        <li>
          <strong>Contraseña</strong>. Nunca se guarda tal cual: se almacena únicamente su hash
          calculado con bcrypt, y está marcada en la base de datos para que no salga en las
          respuestas de la API. Ni siquiera nosotros podemos leerla.
        </li>
        <li><strong>Fecha de tu último inicio de sesión.</strong></li>
      </ul>

      <h3>Tus preferencias de viaje</h3>
      <ul>
        <li>Estilos de viaje que eliges (hasta cinco), ritmo preferido y nivel de gasto.</li>
        <li>Ciudad de origen y moneda con la que trabajas.</li>
      </ul>
      <p className="tenue">
        Estas preferencias existen para que el itinerario que genera la IA se parezca a lo que te
        gusta. No se usan para segmentarte ni para mostrarte publicidad.
      </p>

      <h3>Los viajes que creas</h3>
      <ul>
        <li>Título, origen y destino (nombre del lugar y sus coordenadas), fechas, número de viajeros y estado del viaje.</li>
        <li>Presupuesto y moneda.</li>
        <li>Transporte de ida y vuelta: medio, aerolínea o línea, horario, costo y la clave de reservación si decides guardarla.</li>
        <li>Hospedaje: nombre, zona, fechas de entrada y salida, número de noches y costo total.</li>
        <li>Transporte en el destino y las notas que escribas en cualquiera de estas secciones.</li>
      </ul>

      <h3>Itinerarios y gastos</h3>
      <ul>
        <li>Los días y actividades del itinerario: título, descripción, categoría, lugar con sus coordenadas, costo estimado y duración.</li>
        <li>Los gastos que registres: categoría, descripción, monto, moneda, fecha, si ya está pagado y tus notas.</li>
      </ul>

      <h3>Medición de los enlaces de salida</h3>
      <p>
        Cuando pulsas un enlace de reserva registramos el hecho de que se pulsó, para saber qué
        proveedores le sirven a la gente. Se guarda únicamente <strong>el nombre del proveedor, la
        sección, el destino del viaje y la fecha</strong>.
      </p>
      <p>
        <strong>Ese registro es anónimo y no se puede ligar contigo:</strong> no se guarda tu
        usuario, ni tu dirección IP, ni tu navegador, ni ninguna cookie o identificador. No hay forma
        de reconstruir a partir de él quién pulsó qué. Se conserva 180 días y después se borra solo.
      </p>

      <h3>Datos técnicos</h3>
      <p>
        Rumbia no usa Google Analytics ni ninguna herramienta de analítica de terceros: la medición
        anterior es propia y vive en nuestra base de datos. Los servicios
        donde está alojada la aplicación (Render y Cloudflare) registran de forma automática datos
        técnicos propios de cualquier servidor web —como la dirección IP, el navegador y la fecha y
        hora de cada petición— para poder operar y detectar abusos. Ese registro lo hacen ellos bajo
        sus propias políticas.
      </p>

      <h2>3. Para qué usamos tus datos</h2>
      <p>
        Para prestarte el servicio que pediste al registrarte, y para nada más. En concreto: mantener
        tu sesión abierta, guardar y mostrarte tus viajes, generar itinerarios con IA a partir de lo
        que capturaste, calcular tu presupuesto, mostrarte el clima estimado del destino y armar los
        enlaces de búsqueda hacia los proveedores.
      </p>
      <p>
        <strong>No vendemos tus datos, no los rentamos y no los usamos para publicidad</strong>{' '}
        dirigida. Tampoco construimos perfiles tuyos con fines comerciales.
      </p>

      <h2>4. Con quién se comparten</h2>
      <p>
        Rumbia se apoya en servicios de terceros para funcionar. Esto es exactamente qué recibe cada
        uno:
      </p>

      <h3>Google (Gemini) — generación del itinerario</h3>
      <p>
        Cuando pides generar un itinerario, se envía a la API de Gemini el <strong>destino, las
        fechas, el número de días y de viajeros, tus intereses, el ritmo, el presupuesto o nivel de
        gasto y las notas adicionales que hayas escrito</strong> para esa generación.
      </p>
      <p>
        <strong>No se envía tu nombre, tu correo ni ningún identificador de tu cuenta.</strong> Ten
        en cuenta, eso sí, que las notas adicionales son texto libre: lo que escribas ahí se manda
        tal cual, así que conviene no poner datos personales que no quieras compartir.
      </p>

      <h3>OpenWeatherMap — clima del destino</h3>
      <p>
        Recibe el <strong>nombre del destino o sus coordenadas</strong> para devolver el pronóstico.
        No recibe nada que te identifique.
      </p>

      <h3>MongoDB Atlas, Render y Cloudflare — infraestructura</h3>
      <p>
        La base de datos está alojada en MongoDB Atlas; la API corre en Render y la interfaz en
        Cloudflare Workers. Almacenan y procesan la información por cuenta nuestra para que la
        aplicación funcione.
      </p>

      <h3>Enlaces de reserva y programas de afiliados</h3>
      <p>
        Rumbia arma enlaces de búsqueda hacia proveedores como Skyscanner, Google Flights, Kayak,
        Rome2Rio, Busbud, Booking.com, Airbnb, Hostelworld, DiscoverCars, Uber, DiDi y Moovit. Esos
        enlaces llevan en su dirección únicamente los <strong>datos del viaje: origen, destino,
        fechas y número de viajeros</strong>.
      </p>
      <p>
        <strong>En ningún caso viaja tu nombre, tu correo ni tu identificador de usuario en esas
        direcciones.</strong>
      </p>
      <p>
        Rumbia participa o podrá participar en programas de afiliados —entre ellos CJ Affiliate
        (Commission Junction, operado por Epsilon International UK Ltd)— lo que significa que
        algunos de esos enlaces llevarán un identificador de afiliado. Si haces una reserva después
        de dar clic, el proveedor puede pagarnos una comisión, <strong>sin ningún costo adicional
        para ti</strong>. Ese identificador señala de qué sitio venías, no quién eres. El detalle de
        qué ocurre al hacer clic está en el{' '}
        <a href="/cookies">aviso de cookies y rastreo</a>.
      </p>

      <h2>5. Cuánto tiempo se conservan y cómo se borran</h2>
      <p>
        Tus datos se conservan mientras tu cuenta exista. No hay borrado automático por antigüedad.
      </p>
      <ul>
        <li>
          <strong>Al eliminar un viaje</strong> se borran también, en la misma operación, su
          itinerario completo y todos los gastos asociados. La eliminación es inmediata y no
          reversible: no hay papelera.
        </li>
        <li>
          <strong>Al eliminar una actividad o un día</strong> del itinerario, se borra de la base de
          datos.
        </li>
        <li>
          <strong>Para eliminar tu cuenta completa</strong>, entra a <em>Perfil</em> y usa
          &quot;Eliminar mi cuenta&quot;. Te pedimos tu contraseña para confirmar. Se borran en el
          momento tu cuenta y todos tus viajes, itinerarios y gastos: no queda copia ni forma de
          recuperarlos. Si prefieres pedirlo por escrito, también puedes escribir a{' '}
          <strong><a href={`mailto:${CONTACTO_PRIVACIDAD}`}>{CONTACTO_PRIVACIDAD}</a></strong>.
        </li>
      </ul>
      <p className="tenue">
        Después del borrado, los datos pueden permanecer un tiempo limitado en las copias de
        respaldo de nuestro proveedor de base de datos hasta que estas se rotan.
      </p>

      <h2>6. Tus derechos ARCO</h2>
      <p>
        Conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares,
        tienes derecho a:
      </p>
      <ul>
        <li><strong>Acceso:</strong> saber qué datos tuyos tenemos y para qué los usamos.</li>
        <li><strong>Rectificación:</strong> corregirlos si están mal o incompletos. Tu nombre, correo y preferencias los puedes editar tú mismo desde <em>Perfil</em>.</li>
        <li>
          <strong>Cancelación:</strong> pedir que se borren. Puedes hacerlo tú mismo desde{' '}
          <em>Perfil → Eliminar mi cuenta</em>.
        </li>
        <li><strong>Oposición:</strong> pedir que dejemos de usarlos para un fin determinado.</li>
      </ul>
      <p>
        Para ejercer cualquiera de ellos, escribe a <strong><a href={`mailto:${CONTACTO_PRIVACIDAD}`}>{CONTACTO_PRIVACIDAD}</a></strong> desde el
        correo con el que te registraste, indicando qué derecho quieres ejercer. Responderemos a la
        dirección desde la que nos escribas.
      </p>

      <h2>7. Cómo protegemos tu información</h2>
      <p>Estas son las medidas que la aplicación aplica hoy:</p>
      <ul>
        <li>Las contraseñas se guardan como hash bcrypt, nunca en texto legible.</li>
        <li>La sesión usa un token JWT firmado y con fecha de expiración.</li>
        <li>Todo el tráfico entre tu navegador, la API y la base de datos viaja por HTTPS.</li>
        <li>La API solo acepta peticiones desde el dominio de la aplicación y limita el número de intentos de inicio de sesión y de generaciones con IA.</li>
        <li>Cada petición comprueba que el viaje que pides sea tuyo antes de devolverlo.</li>
      </ul>
      <p>
        Con la misma honestidad: el token de sesión se guarda en el <code>localStorage</code> de tu
        navegador. Es una decisión común en aplicaciones como esta, pero implica que quien tenga
        acceso físico a tu dispositivo desbloqueado podría leerlo. Cierra sesión si usas una
        computadora compartida.
      </p>
      <p>
        Ningún sistema es completamente infalible, y no podemos garantizar una seguridad absoluta.
      </p>

      <h2>8. Menores de edad</h2>
      <p>
        Rumbia no está dirigido a menores de 18 años y no recabamos datos de forma consciente de
        ellos. Si detectamos una cuenta de un menor, la eliminaremos. Si eres madre, padre o tutor y
        crees que un menor a tu cargo creó una cuenta, escríbenos a{' '}
        <strong><a href={`mailto:${CONTACTO_PRIVACIDAD}`}>{CONTACTO_PRIVACIDAD}</a></strong> y la borraremos.
      </p>

      <h2>9. Cambios a esta política</h2>
      <p>
        Si cambia la forma en que tratamos los datos, actualizaremos esta página y la fecha de
        &quot;última actualización&quot; que aparece arriba. Cuando el cambio sea importante —por
        ejemplo, si se suma un tercero nuevo que reciba datos— lo avisaremos también dentro de la
        aplicación. Te recomendamos revisarla de vez en cuando.
      </p>
    </PaginaLegal>
  );
}
