/**
 * Iconos de línea, como en el mockup de Bitácora.
 *
 * Todos comparten el mismo lienzo de 24x24 y usan `currentColor`, así que el
 * color lo decide el CSS de alrededor y no hay que tocar el SVG. El trazo va a
 * 1.8 para que a 16-18px se lea sin engordar.
 *
 * Los emoji siguen vivos en un sitio a propósito: dentro de <option>. Un
 * <select> nativo no admite SVG entre sus opciones, y cambiarlo por un
 * desplegable propio costaría el comportamiento nativo en móvil, que es mejor
 * que cualquier réplica.
 */

const TRAZOS = {
  // --- Navegación ---
  maleta: (
    <>
      <rect x="3" y="7.5" width="18" height="13" rx="2.5" />
      <path d="M9 7.5V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2.5" />
    </>
  ),
  mas: <path d="M12 5v14M5 12h14" />,
  descarga: (
    <>
      <path d="M12 3v12" />
      <path d="M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4 17.5v1.5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1.5" />
    </>
  ),
  persona: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </>
  ),

  // --- Sesión y formularios ---
  ojo: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  ojoTachado: (
    <>
      <path d="M2 12s3.5-7 10-7c2 0 3.7.6 5.1 1.5M22 12s-3.5 7-10 7c-2 0-3.7-.6-5.1-1.5" />
      <path d="M4 4l16 16" />
    </>
  ),
  buscar: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  cerrar: <path d="M6 6l12 12M18 6L6 18" />,
  lapiz: <path d="M4 20l1-4 11-11 3 3-11 11-4 1z" />,
  flechaSalida: <path d="M7 17L17 7M9 7h8v8" />,
  flechaIzq: <path d="M19 12H5M11 6l-6 6 6 6" />,
  arrastrar: (
    <>
      <circle cx="9" cy="6" r="1.2" />
      <circle cx="15" cy="6" r="1.2" />
      <circle cx="9" cy="12" r="1.2" />
      <circle cx="15" cy="12" r="1.2" />
      <circle cx="9" cy="18" r="1.2" />
      <circle cx="15" cy="18" r="1.2" />
    </>
  ),

  // --- Secciones del viaje ---
  avion: <path d="M12.5 3.5l7 7-4 1.4 1.5 5.6-2.7 1-2.6-5.4-3 1v3.4l-1.8 1v-4.9l-6-1.6 1-2.6 5.6 1.5 1-4-5.5-2.9 1-2.7z" />,
  cama: (
    <>
      <path d="M2.5 20v-9a2 2 0 0 1 2-2h15a2 2 0 0 1 2 2v9M2.5 20h19M2.5 15h19" />
      <circle cx="7" cy="12" r="1.6" />
    </>
  ),
  auto: (
    <>
      <path d="M3 17v-4l2-5h14l2 5v4M3 17h18M3 17v2.5M21 17v2.5" />
      <circle cx="7.5" cy="14.5" r="1.3" />
      <circle cx="16.5" cy="14.5" r="1.3" />
    </>
  ),
  recibo: (
    <>
      <path d="M6 3h12v18l-3-1.6-3 1.6-3-1.6L6 21z" />
      <path d="M9.5 8.5h5M9.5 12.5h5" />
    </>
  ),
  brujula: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M15 9l-1.5 4.5L9 15l1.5-4.5z" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z" />
      <circle cx="12" cy="9" r="2.3" />
    </>
  ),
  calendario: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  chispa: <path d="M12 3l2 6.2 6.2 2-6.2 2-2 6.2-2-6.2-6.2-2 6.2-2z" />,

  // --- Clima ---
  sol: (
    <>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M5 5l1.8 1.8M17.2 17.2L19 19M19 5l-1.8 1.8M6.8 17.2L5 19" />
    </>
  ),
  nube: <path d="M17 18a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.7A3.5 3.5 0 0 0 7 18h10z" />,
  lluvia: (
    <>
      <path d="M17 15.5a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.7A3.5 3.5 0 0 0 7 15.5h10z" />
      <path d="M9 18.5l-1 2.5M13 18.5l-1 2.5M17 18.5l-1 2.5" />
    </>
  ),
  nieve: (
    <>
      <path d="M17 15.5a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.7A3.5 3.5 0 0 0 7 15.5h10z" />
      <path d="M9 19h.01M13 20h.01M17 19h.01" />
    </>
  ),

  // --- Avisos ---
  alerta: (
    <>
      <path d="M12 3.5L22 20H2z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 11v5M12 7.8h.01" />
    </>
  ),
  palomita: <path d="M4.5 12.5l5 5 10-11" />,
};

export default function Icono({ nombre, tamano = 18, className = '', titulo, ...props }) {
  const trazo = TRAZOS[nombre];
  if (!trazo) return null;

  return (
    <svg
      className={`icono ${className}`.trim()}
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={titulo ? 'img' : undefined}
      aria-hidden={titulo ? undefined : 'true'}
      focusable="false"
      {...props}
    >
      {titulo && <title>{titulo}</title>}
      {trazo}
    </svg>
  );
}

/** Nombres válidos, para no adivinar desde fuera. */
export const ICONOS = Object.keys(TRAZOS);
