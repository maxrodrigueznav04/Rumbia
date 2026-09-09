import { useTranslation } from 'react-i18next';
import { authApi } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Boton } from './ui.jsx';

// Banderas dibujadas a mano, no el emoji 🇲🇽/🇺🇸: el emoji de bandera depende
// de que la fuente del sistema tenga ese glifo, y Windows (entre otros) no lo
// trae -- ahi se veia el codigo de pais en texto plano o nada. Un SVG propio
// se ve igual en cualquier navegador y sistema operativo.
function BanderaMx() {
  return (
    <svg width="20" height="14" viewBox="0 0 20 14" role="img" aria-hidden="true">
      <g clipPath="url(#recorte-bandera-mx)">
        <rect width="20" height="14" fill="#fff" />
        <rect width="6.667" height="14" fill="#006341" />
        <rect x="13.333" width="6.667" height="14" fill="#CE1126" />
        <circle cx="10" cy="7" r="1.6" fill="none" stroke="#8B5E1F" strokeWidth="0.6" />
      </g>
      <clipPath id="recorte-bandera-mx">
        <rect width="20" height="14" rx="2" />
      </clipPath>
    </svg>
  );
}

function BanderaUs() {
  return (
    <svg width="20" height="14" viewBox="0 0 20 14" role="img" aria-hidden="true">
      <g clipPath="url(#recorte-bandera-us)">
        <rect width="20" height="14" fill="#fff" />
        {[0, 2, 4, 6, 8, 10, 12].map((y) => (
          <rect key={y} y={y} width="20" height="1" fill="#B22234" />
        ))}
        <rect width="9" height="7" fill="#3C3B6E" />
      </g>
      <clipPath id="recorte-bandera-us">
        <rect width="20" height="14" rx="2" />
      </clipPath>
    </svg>
  );
}

/**
 * Alterna es/en, persistido por i18next-browser-languagedetector en
 * localStorage (misma idea que useTema.js, pero sin duplicar esa logica
 * aqui: i18next ya la trae integrada via el plugin de deteccion).
 *
 * Con sesion iniciada, ademas se guarda en preferences.idioma del usuario:
 * es lo unico que le permite al servidor saber en que idioma escribirle un
 * correo transaccional que dispara OTRA persona (ver correoPropuestaAceptada
 * en public.controller.js) -- localStorage no sirve para eso, vive solo en
 * este navegador.
 */
export default function SelectorIdioma() {
  const { i18n } = useTranslation();
  const { autenticado, actualizarUsuario } = useAuth();
  const idioma = i18n.resolvedLanguage === 'en' ? 'en' : 'es';
  const siguiente = idioma === 'es' ? 'en' : 'es';
  const etiqueta = idioma === 'es' ? 'Idioma: Español · toca para English' : 'Language: English · tap for Español';

  const cambiar = () => {
    i18n.changeLanguage(siguiente);
    if (autenticado) {
      authApi
        .updateProfile({ preferences: { idioma: siguiente } })
        .then((data) => actualizarUsuario(data.user))
        .catch(() => {
          /* no es critico: el cambio de idioma en pantalla ya se aplico */
        });
    }
  };

  return (
    <Boton variante="fantasma" chico onClick={cambiar} title={etiqueta} aria-label={etiqueta}>
      {idioma === 'es' ? <BanderaMx /> : <BanderaUs />}
    </Boton>
  );
}
