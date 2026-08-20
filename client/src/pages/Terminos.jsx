import { Tarjeta } from '../components/ui.jsx';
import PaginaLegal from '../components/PaginaLegal.jsx';
import { RESPONSABLE, CONTACTO_PRIVACIDAD } from '../config/legal.js';

/**
 * Términos y condiciones.
 *
 * Lo importante aquí no es cubrirse: es dejar claras dos cosas que la app hace
 * y que pueden causar un problema real —que la IA se equivoca, y que reservar
 * ocurre fuera de Rumbo—, para que nadie llegue al aeropuerto creyendo que
 * tenía un vuelo comprado.
 */
export default function Terminos() {
  return (
    <PaginaLegal
      titulo="Términos y condiciones"
      entrada="Qué puedes esperar de Rumbo, qué no, y bajo qué reglas se usa. Está escrito para que se entienda a la primera."
    >
      <Tarjeta titulo="Lo esencial, en tres líneas">
        <ul>
          <li>Rumbo organiza y estima. No vende, no reserva y no cobra nada.</li>
          <li>La IA se equivoca: verifica horarios, precios y disponibilidad antes de contar con ellos.</li>
          <li>Es gratis. Si algún día deja de serlo, se avisa antes y nunca de forma retroactiva.</li>
        </ul>
      </Tarjeta>

      <h2>1. Qué es Rumbo</h2>
      <p>
        Rumbo es una herramienta para planear viajes: guarda la información de tu viaje, te ayuda a
        armar un itinerario con inteligencia artificial, estima costos y te lleva a los sitios de
        los proveedores para que reserves ahí.
      </p>
      <p>
        <strong>Rumbo no es una agencia de viajes.</strong> No vende vuelos, hospedaje ni
        actividades; no procesa pagos; no emite boletos ni confirmaciones; y no es parte de ningún
        contrato entre tú y el proveedor con el que reserves. Al usar la aplicación aceptas estos
        términos.
      </p>
      <p>El servicio lo ofrece {RESPONSABLE}.</p>

      <h2>2. Lo que genera la IA es una sugerencia, no un dato verificado</h2>
      <p>
        Los itinerarios los genera un modelo de lenguaje. Eso significa que puede{' '}
        <strong>equivocarse en horarios, precios, días de cierre, ubicaciones y disponibilidad</strong>,
        e incluso sugerir lugares que ya cerraron o que no existen.
      </p>
      <p>
        <strong>Verifica siempre con la fuente oficial</strong> antes de tomar una decisión que
        dependa de esa información: comprar un boleto, reservar una mesa o presentarte en un museo.
        Los costos que ves son estimaciones para ayudarte a presupuestar, no cotizaciones.
      </p>
      <p>
        Lo mismo aplica al clima: cuando tu viaje está a más de cinco días, lo que se muestra es una
        estimación por temporada, y la aplicación lo indica en pantalla.
      </p>

      <h2>3. Reservar ocurre fuera de Rumbo</h2>
      <p>
        Los enlaces de búsqueda te llevan al sitio del proveedor con tus datos ya prellenados. A
        partir de ese clic <strong>sales de Rumbo</strong>: el precio, la disponibilidad, las
        condiciones de cancelación y el contrato son del proveedor, y con él tienes que resolver
        cualquier problema con tu reserva.
      </p>
      <p>
        Algunos de esos enlaces pueden ser de afiliado, es decir, generarnos una comisión si
        reservas. <strong>Nunca supone un costo extra para ti</strong> ni cambia el precio que te
        ofrecen, y los enlaces afectados se marcan como tales. El detalle está en el{' '}
        <a href="/cookies">aviso de cookies y rastreo</a>.
      </p>

      <h2>4. Tu cuenta</h2>
      <ul>
        <li>Necesitas ser mayor de 18 años para crear una cuenta.</li>
        <li>Los datos que des al registrarte deben ser reales, y tu contraseña es tu responsabilidad. Avísanos si crees que alguien más entró a tu cuenta.</li>
        <li>El contenido que capturas —viajes, notas, gastos— es tuyo. Solo se usa para prestarte el servicio, como explica la <a href="/privacidad">política de privacidad</a>.</li>
        <li>Puedes eliminar tu cuenta cuando quieras desde <em>Perfil</em>. Al hacerlo se borran también todos tus viajes, itinerarios y gastos, sin posibilidad de recuperarlos.</li>
      </ul>

      <h2>5. Uso aceptable</h2>
      <p>Al usar Rumbo te comprometes a no:</p>
      <ul>
        <li>Automatizar el uso del generador de itinerarios ni intentar saltarte los límites de uso.</li>
        <li>Revender, redistribuir o presentar como propio el contenido que genera la aplicación con fines comerciales.</li>
        <li>Intentar acceder a datos de otras personas, ni a partes del sistema para las que no tienes permiso.</li>
        <li>Usar el servicio para algo ilegal, o capturar contenido que infrinja derechos de terceros.</li>
      </ul>
      <p>
        Hay límites de uso por hora en la generación con IA. Existen para proteger el servicio y
        repartirlo entre todos, y pueden ajustarse sin previo aviso.
      </p>

      <h2>6. Disponibilidad y cambios</h2>
      <p>
        Rumbo se ofrece <strong>tal cual está</strong> y de forma gratuita. No se garantiza que esté
        siempre disponible, ni libre de errores, ni que los servicios de terceros de los que depende
        —el modelo de IA, el proveedor del clima, los mapas— funcionen en todo momento.
      </p>
      <p>
        Se pueden cambiar, suspender o retirar funciones. Si en el futuro alguna parte del servicio
        pasa a ser de paga, se avisará con antelación y no se aplicará de forma retroactiva a lo que
        ya guardaste.
      </p>
      <p>
        Te recomendamos conservar por tu cuenta la información importante de tu viaje: claves de
        reservación, comprobantes y horarios confirmados.
      </p>

      <h2>7. Responsabilidad</h2>
      <p>
        En la medida que la ley lo permita, no somos responsables de pérdidas derivadas de decisiones
        que tomes con base en la información de la aplicación, de errores u omisiones de los
        contenidos generados por IA, ni de fallos, cambios de precio o incumplimientos de los
        proveedores con los que reserves.
      </p>
      <p>
        Nada en estos términos limita los derechos que te reconoce la legislación de protección al
        consumidor.
      </p>

      <h2>8. Propiedad</h2>
      <p>
        El nombre, el diseño y el código de Rumbo pertenecen a su autor. El contenido de tus viajes
        te pertenece a ti; al usarlo en la aplicación solo nos autorizas a procesarlo para prestarte
        el servicio.
      </p>

      <h2>9. Terminación</h2>
      <p>
        Puedes dejar de usar Rumbo cuando quieras y eliminar tu cuenta desde <em>Perfil</em>.
        Podemos suspender una cuenta que incumpla estos términos, especialmente si pone en riesgo el
        servicio para los demás.
      </p>

      <h2>10. Cambios a estos términos</h2>
      <p>
        Si cambian, se actualizará esta página y la fecha que aparece arriba. Cuando el cambio sea
        importante se avisará también dentro de la aplicación.
      </p>

      <h2>11. Ley aplicable y contacto</h2>
      <p>
        Estos términos se rigen por la legislación mexicana. Para cualquier duda, aclaración o
        reclamación puedes escribir a{' '}
        <strong>
          <a href={`mailto:${CONTACTO_PRIVACIDAD}`}>{CONTACTO_PRIVACIDAD}</a>
        </strong>
        .
      </p>
    </PaginaLegal>
  );
}
