import { useTranslation } from 'react-i18next';
import { Boton } from './ui.jsx';

/**
 * Alterna es/en, persistido por i18next-browser-languagedetector en
 * localStorage (misma idea que useTema.js, pero sin duplicar esa logica
 * aqui: i18next ya la trae integrada via el plugin de deteccion).
 */
export default function SelectorIdioma() {
  const { i18n } = useTranslation();
  const idioma = i18n.resolvedLanguage === 'en' ? 'en' : 'es';
  const siguiente = idioma === 'es' ? 'en' : 'es';
  const etiqueta = idioma === 'es' ? 'Idioma: Español · toca para English' : 'Language: English · tap for Español';

  return (
    <Boton
      variante="fantasma"
      chico
      onClick={() => i18n.changeLanguage(siguiente)}
      title={etiqueta}
      aria-label={etiqueta}
    >
      {idioma.toUpperCase()}
    </Boton>
  );
}
