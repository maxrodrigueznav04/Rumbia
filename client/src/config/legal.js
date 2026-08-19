/**
 * Datos de contacto de los documentos legales.
 *
 * OJO: los dos valores de abajo son marcadores. Hay que ponerlos antes de
 * publicar la política, porque la ley pide un canal real para ejercer los
 * derechos ARCO y CJ Affiliate revisa que la página exista y sea accesible.
 */
export const RESPONSABLE = '[NOMBRE O RAZÓN SOCIAL DEL RESPONSABLE]';
export const CONTACTO_PRIVACIDAD = '[CORREO-DE-CONTACTO@EJEMPLO.COM]';

/** Se muestra en el encabezado de cada documento. */
export const ULTIMA_ACTUALIZACION = '18 de agosto de 2026';

/** true cuando ya haya marcadores sin sustituir, para avisar en pantalla. */
export const FALTAN_DATOS =
  RESPONSABLE.startsWith('[') || CONTACTO_PRIVACIDAD.startsWith('[');
