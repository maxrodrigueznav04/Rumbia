// Aplica el tema guardado ANTES de que cargue el resto de la pagina: sin
// esto, quien eligio "oscuro" a mano (distinto de lo que ya trae su
// sistema) ve un parpadeo claro->oscuro apenas perceptible en cada carga.
// El caso "seguir al sistema" no lo necesita — eso ya lo resuelve
// prefers-color-scheme en el CSS, sin JS de por medio.
//
// Vive en un archivo aparte (no inline en index.html) para poder correr con
// una Content-Security-Policy sin `unsafe-inline` en script-src: un script
// inline necesitaria un hash o nonce que se rompe en cuanto alguien edite el
// texto sin tocar el header, y un archivo con `script-src 'self'` no tiene
// ese problema.
(function () {
  try {
    var t = localStorage.getItem('rumbo-tema');
    if (t === 'claro' || t === 'oscuro') {
      document.documentElement.setAttribute('data-theme', t);
    }
  } catch (e) {
    /* localStorage bloqueado (navegacion privada estricta): sigue al sistema, sin romper nada. */
  }
})();
