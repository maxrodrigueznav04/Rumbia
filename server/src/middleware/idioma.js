const IDIOMAS_SOPORTADOS = ['es', 'en'];

/**
 * Idioma de la UI del cliente que hizo la petición, para traducir mensajes
 * de error y el idioma en que la IA responde. Viene del header que manda
 * client/src/api/client.js con el idioma activo de i18next -- no del
 * Accept-Language del navegador, que no cambia cuando alguien usa el
 * selector de idioma de la app sin cambiar el idioma del sistema.
 */
export function idioma(req, _res, next) {
  const pedido = (req.get('X-Rumbia-Idioma') || '').toLowerCase().slice(0, 2);
  req.idioma = IDIOMAS_SOPORTADOS.includes(pedido) ? pedido : 'es';
  next();
}

export default idioma;
