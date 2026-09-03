import { Tarjeta } from '../components/ui.jsx';
import PaginaLegal from '../components/PaginaLegal.jsx';
import { RESPONSABLE, CONTACTO_PRIVACIDAD } from '../config/legal.js';

/**
 * Términos y condiciones.
 *
 * Lo importante aquí no es cubrirse: es dejar claras dos cosas que la app hace
 * y que pueden causar un problema real —que la IA se equivoca, y que reservar
 * ocurre fuera de Rumbia—, para que nadie llegue al aeropuerto creyendo que
 * tenía un vuelo comprado.
 */
export default function Terminos() {
  return (
    <PaginaLegal
      titulo="Términos y condiciones"
      entrada="Qué puedes esperar de Rumbia, qué no, y bajo qué reglas se usa. Está escrito para que se entienda a la primera."
    >
      <Tarjeta titulo="Lo esencial, en tres líneas">
        <ul>
          <li>Rumbia organiza y estima. No vende, no reserva boletos y no cobra comisiones a los viajeros.</li>
          <li>Las sugerencias y estimaciones son orientativas: verifica siempre horarios, precios y disponibilidad.</li>
          <li>Uso personal gratuito, con planes de suscripción profesionales para agencias de viaje.</li>
        </ul>
      </Tarjeta>

      <h2>1. Qué es Rumbia</h2>
      <p>
        Rumbia es una plataforma tecnológica para planear viajes: guarda la información de tus rutas,
        ofrece asistencia inteligente para estructurar itinerarios día por día, estima costos y te
        conecta con proveedores oficiales de transporte y alojamiento.
      </p>
      <p>
        <strong>Rumbia no es una agencia de viajes operadora ni intermediaria turística directa.</strong> No vende vuelos,
        hospedaje ni actividades directamente; no procesa pagos de reservaciones ni emite boletos. Los
        enlaces de reserva te llevan al sitio del proveedor con tu búsqueda prellenada.
      </p>
      <p>
        Para agencias de viaje y asesores independientes, Rumbia ofrece herramientas avanzadas de cotización,
        membretes oficiales y exportación de propuestas en PDF bajo suscripción mensual o anual.
      </p>
      <p>El servicio lo ofrece {RESPONSABLE}.</p>

      <h2>2. Las sugerencias y estimaciones son orientativas</h2>
      <p>
        Los itinerarios y notas del asistente se elaboran mediante modelos inteligentes de lenguaje.
        Dado que las tarifas, horarios, días de apertura y políticas de viaje cambian de forma constante,
        la información generada puede contener variaciones respecto a la realidad.
      </p>
      <p>
        <strong>Verifica siempre con la fuente oficial o el proveedor correspondiente</strong> antes de
        realizar pagos o tomar decisiones de viaje. Los costos mostrados son referencias estimadas para
        ayudarte a presupuestar.
      </p>
      <p>
        Lo mismo aplica al clima: cuando tu viaje está a más de cinco días, lo que se muestra es una
        estimación estacional histórica, y la aplicación lo indica en pantalla.
      </p>

      <h2>3. Reservar ocurre fuera de Rumbia</h2>
      <p>
        Los enlaces de búsqueda te llevan al sitio del proveedor con tus datos ya prellenados. A
        partir de ese clic <strong>sales de Rumbia</strong>: el precio, la disponibilidad, las
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

      <h2>5. Uso aceptable y licencia para agencias</h2>
      <p>Al usar Rumbia te comprometes a:</p>
      <ul>
        <li>Hacer un uso responsable de las herramientas sin automatizar peticiones abusivas ni intentar vulnerar los límites de uso.</li>
        <li>No intentar acceder a datos de otras personas ni a partes del sistema para las que no tienes autorización.</li>
        <li>No revender ni redistribuir el software o código de Rumbia.</li>
      </ul>
      <p>
        <strong>Licencia comercial para agencias:</strong> Las agencias y agentes de viaje con una suscripción activa
        tienen licencia comercial expresa para utilizar Rumbia como cotizador profesional, personalizar propuestas
        con su membrete y marca comercial, y entregar itinerarios en PDF a sus clientes finales.
      </p>
      <p>
        Existen cuotas y límites mensuales de uso según el plan contratado o el nivel personal gratuito.
        Estos límites protegen la estabilidad del servicio y se recargan el primer día de cada mes.
      </p>

      <h2>6. Planes, facturación y cancelaciones</h2>
      <p>
        <strong>Plan personal:</strong> El uso personal de Rumbia para planear tus propios viajes es gratuito,
        con cuotas mensuales recargables para el uso del asistente inteligente, sin límite en viajes manuales ni notas.
      </p>
      <p>
        <strong>Suscripciones de agencia:</strong> Los planes para agencias (Inicio, Agencia y Agencia Pro) se
        facturan en dólares estadounidenses (USD) de forma periódica (mensual o anual) mediante <strong>Stripe</strong>.
        Puedes cancelar tu suscripción o cambiar de plan en cualquier momento desde el panel de facturación; el servicio
        permanecerá activo hasta el final del ciclo ya pagado y no se realizarán cargos posteriores.
      </p>
      <p>
        Rumbia se ofrece con los mejores estándares de calidad y disponibilidad, apoyándose en infraestructura
        de clase mundial (Cloudflare, Render y MongoDB Atlas). No nos hacemos responsables de interrupciones temporales
        en servicios de terceros (como mapas o clima).
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
        El nombre, el diseño y el código de Rumbia pertenecen a su autor. El contenido de tus viajes
        te pertenece a ti; al usarlo en la aplicación solo nos autorizas a procesarlo para prestarte
        el servicio.
      </p>

      <h2>9. Terminación</h2>
      <p>
        Puedes dejar de usar Rumbia cuando quieras y eliminar tu cuenta desde <em>Perfil</em>.
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
