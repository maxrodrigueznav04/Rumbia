/**
 * Renderiza un string con **negritas** estilo Markdown como texto con
 * <strong>. Nada mas: no interpreta enlaces, listas ni el resto de
 * Markdown -- solo lo mínimo que necesitan las listas de features
 * traducidas via i18next (JSON no puede llevar JSX embebido).
 */
export default function TextoConEnfasis({ texto }) {
  if (!texto) return null;
  const partes = texto.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {partes.map((parte, i) =>
        i % 2 === 1 ? <strong key={i}>{parte}</strong> : parte
      )}
    </>
  );
}
