import { rangoFechas, nombreDestino } from '../utils/format.js';
import { obtenerFuente, obtenerDensidad } from '../utils/fuentesPdf.js';
import { obtenerFondo } from '../utils/fondosPdf.js';

/**
 * Variables CSS que ponen la personalizacion de la agencia (color, tipografia,
 * densidad de texto y fondo de pagina -- solo en plan Agencia/Pro) para que
 * todo el PDF las use via var(--marca)/var(--fuente*)/var(--escala-pdf)/
 * var(--fondo-agencia) (ver global.css). Se pasa como estilo inline en el
 * elemento que envuelve encabezado, cuerpo y pie. useMarcaImpresion tambien
 * las publica en html durante la impresion; sin marcaBlanca o sin
 * elegir nada, no define nada y todo cae en el verde/tipografia/tamano/fondo
 * blanco de Rumbia de siempre.
 */
export function estiloPersonalizado(marca) {
  if (!marca?.marcaBlanca) return undefined;

  const estilo = {};
  if (marca.colorAcento) estilo['--marca-agencia'] = marca.colorAcento;

  const fuente = obtenerFuente(marca.fuentePdf);
  if (fuente.pila) estilo['--fuente-agencia'] = fuente.pila;

  const densidad = obtenerDensidad(marca.densidadPdf);
  if (densidad.escala !== 1) estilo['--escala-pdf'] = densidad.escala;

  const fondo = obtenerFondo(marca.fondoPdf);
  if (fondo.color) estilo['--fondo-agencia'] = fondo.color;

  return Object.keys(estilo).length ? estilo : undefined;
}

/**
 * Descarga el archivo de la tipografia elegida (si no es la de Rumbia, que
 * ya viene en el bundle principal). Llamar desde un useEffect en la pagina
 * que imprime -- es un side effect (carga de red), no algo que resolver en
 * cada render.
 */
export function cargarFuentePdf(marca) {
  if (!marca?.marcaBlanca) return;
  obtenerFuente(marca.fuentePdf).cargar?.();
}

/**
 * Membrete y pie que solo existen en la hoja impresa.
 *
 * En pantalla van ocultos (`.hoja-cabecera` / `.hoja-pie` en global.css): la
 * app ya tiene su encabezado y repetirlo seria ruido. Al imprimir pasa lo
 * contrario, porque la navegacion y los botones desaparecen y el papel se
 * quedaria sin decir de quien es el documento ni a que viaje pertenece.
 *
 * Si el usuario no llenó su marca en el perfil se imprime la de Rumbia, que es
 * lo correcto para alguien que viaja por su cuenta.
 */
export function EncabezadoImpresion({ marca, viaje }) {
  const nombre = marca?.agencyName?.trim();

  return (
    <header className="hoja-cabecera">
      <div className="hoja-marca">
        {marca?.logoUrl ? (
          <img src={marca.logoUrl} alt="" className="hoja-logo" />
        ) : (
          <span className="hoja-marca-badge" aria-hidden="true">
            {(nombre || 'R').charAt(0).toUpperCase()}
          </span>
        )}
        <div>
          <strong>{nombre || 'Rumbia'}</strong>
          {marca?.contact && <span className="hoja-contacto">{marca.contact}</span>}
        </div>
      </div>

      <div className="hoja-viaje">
        <strong>{viaje.title}</strong>
        <span>
          {nombreDestino(viaje)} · {rangoFechas(viaje.startDate, viaje.endDate)} ·{' '}
          {viaje.travelers} {viaje.travelers === 1 ? 'viajero' : 'viajeros'}
        </span>
      </div>
    </header>
  );
}

export function PieImpresion({ marca }) {
  const nombre = marca?.agencyName?.trim();
  // Beneficio de los planes Agencia y Agencia Pro (ver Agency.js): el pie
  // deja de mencionar a Rumbia. Uso personal y el plan Inicio se quedan con
  // el credito, igual que antes.
  const marcaBlanca = Boolean(marca?.marcaBlanca);

  return (
    <footer className="hoja-pie">
      <p>
        Los costos son estimaciones para orientar el presupuesto, no precios en firme, y pueden
        cambiar según la temporada y la disponibilidad.
      </p>
      <p>
        {marcaBlanca
          ? `${nombre} · Propuesta de viaje.`
          : nombre
            ? `${nombre} · Propuesta preparada con Rumbia.`
            : 'Itinerario preparado con Rumbia.'}
      </p>
    </footer>
  );
}
