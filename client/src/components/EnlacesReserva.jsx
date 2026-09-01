import Icono from './Icono.jsx';
import { avisarClick } from '../api/index.js';

/**
 * Enlaces de salida hacia los comparadores.
 * La app no reserva: se deja explicito para no confundir al usuario.
 */
export default function EnlacesReserva({ enlaces = [], compacto, seccion, destino, origen }) {
  if (!enlaces.length) return null;

  const hayAfiliados = enlaces.some((l) => l.esAfiliado);

  return (
    <div className="pila-sm">
      {enlaces.slice(0, compacto ? 2 : enlaces.length).map((l) => (
        <a
          key={l.provider + l.url}
          href={l.url}
          target="_blank"
          /*
           * Google pide marcar los enlaces pagados con rel="sponsored": si no,
           * cuentan como esquema de enlaces y penalizan el sitio. Se marca solo
           * el que de verdad lleva identificador de afiliado, no todos.
           */
          rel={l.esAfiliado ? 'sponsored noopener noreferrer' : 'noopener noreferrer'}
          className="link-externo"
          onClick={() =>
            avisarClick({
              provider: l.provider,
              section: seccion,
              destination: destino,
              esAfiliado: Boolean(l.esAfiliado),
              origen,
            })
          }
        >
          <span>
            <strong>{l.provider}</strong>
            <span className="tenue" style={{ display: 'block', fontWeight: 400 }}>
              {l.label}
            </span>
          </span>
          {l.esAfiliado && (
            <span className="insignia" title="Si reservas aquí, Rumbia puede ganar una comisión">
              Afiliado
            </span>
          )}
          <Icono nombre="flechaSalida" tamano={15} className="flecha" />
          <span className="oculto-visual">
            (abre en una pestaña nueva{l.esAfiliado ? ', enlace de afiliado' : ''})
          </span>
        </a>
      ))}

      {/*
        La divulgacion va junto a los enlaces y no solo en la pagina legal:
        tanto la FTC como los terminos de las redes de afiliados piden que se
        vea donde esta el enlace, antes de dar clic.
      */}
      {hayAfiliados && (
        <p className="tenue" style={{ margin: '2px 0 0', fontSize: '0.78rem' }}>
          Los enlaces marcados como afiliado pueden generarnos una comisión si reservas. No te
          cuesta nada extra ni cambia el precio.
        </p>
      )}
    </div>
  );
}
