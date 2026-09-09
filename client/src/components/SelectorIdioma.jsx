import { useTranslation } from 'react-i18next';
import { authApi } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Boton } from './ui.jsx';

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
      {idioma.toUpperCase()}
    </Boton>
  );
}
