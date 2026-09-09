/**
 * Datos de contacto de los documentos legales.
 *
 * Van aquí y no dentro del texto para que cambiar el correo no obligue a tocar
 * dos páginas y arriesgarse a dejar una desactualizada.
 */
export const RESPONSABLE = 'Maximiliano Rodríguez Navarro';
export const CONTACTO_PRIVACIDAD = 'contacto@rumbiamx.com';

/**
 * Domicilio del responsable, requerido por el art. 15 de la LFPDPPP en el
 * aviso de privacidad. No es la dirección de un local comercial: es el dato
 * legal del responsable del tratamiento de datos.
 */
export const DOMICILIO = 'Villa Lagunas 2965-1, Villas del Río Elite, 80050, Culiacán, Sinaloa, México';

/**
 * Fecha que se muestra en el encabezado, en formato ISO para poder pasarla
 * por formatoFecha() y que salga en el idioma elegido (5 de septiembre de
 * 2026 / September 5, 2026) en vez de un string fijo en español. La política
 * dice que se actualiza cuando cambia el tratamiento de los datos, así que
 * hay que moverla cuando se edite el contenido, no cuando se toque el estilo.
 */
export const ULTIMA_ACTUALIZACION = '2026-09-05';

/**
 * Detecta los marcadores sin sustituir para avisar en pantalla. Cubre tanto el
 * texto de ejemplo como el caso de dejar los corchetes puestos alrededor del
 * valor bueno, que es lo que pasa en la práctica.
 */
const esMarcador = (valor) => !valor || /^\[|\]$/.test(valor.trim()) || valor.includes('EJEMPLO');

export const FALTAN_DATOS = esMarcador(RESPONSABLE) || esMarcador(CONTACTO_PRIVACIDAD) || esMarcador(DOMICILIO);
