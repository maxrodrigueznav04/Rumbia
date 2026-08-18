/**
 * Enlaces de salida hacia los comparadores.
 * La app no reserva: se deja explicito para no confundir al usuario.
 */
export default function EnlacesReserva({ enlaces = [], compacto }) {
  if (!enlaces.length) return null;

  return (
    <div className="pila-sm">
      {enlaces.slice(0, compacto ? 2 : enlaces.length).map((l) => (
        <a
          key={l.provider + l.url}
          href={l.url}
          target="_blank"
          rel="noopener noreferrer"
          className="link-externo"
        >
          <span>
            <strong>{l.provider}</strong>
            <span className="tenue" style={{ display: 'block', fontWeight: 400 }}>
              {l.label}
            </span>
          </span>
          <span className="flecha" aria-hidden="true">
            ↗
          </span>
          <span className="oculto-visual">(abre en una pestaña nueva)</span>
        </a>
      ))}
    </div>
  );
}
