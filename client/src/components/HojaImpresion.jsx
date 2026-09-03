import { rangoFechas, nombreDestino } from '../utils/format.js';

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

  return (
    <footer className="hoja-pie">
      <p>
        Los costos son estimaciones para orientar el presupuesto, no precios en firme, y pueden
        cambiar según la temporada y la disponibilidad.
      </p>
      <p>{nombre ? `${nombre} · Propuesta preparada con Rumbia.` : 'Itinerario preparado con Rumbia.'}</p>
    </footer>
  );
}
