/**
 * Enlaces de afiliado.
 *
 * La configuracion vive en una variable de entorno y no en el codigo, para que
 * cuando una red apruebe la cuenta baste con pegar el identificador en el panel
 * del servidor: no hay que tocar codigo ni volver a desplegar el cliente.
 *
 * Formato de AFFILIATE_LINKS (JSON, una entrada por proveedor):
 *
 *   {
 *     "Booking.com": { "tipo": "param", "clave": "aid", "valor": "1234567" },
 *     "Skyscanner":  { "tipo": "envoltura",
 *                      "plantilla": "https://www.anrdoezrs.net/links/PID/type/dlg/{url}" }
 *   }
 *
 * - "param" agrega un parametro a la URL del proveedor. Lo usan los programas
 *   propios (Booking, Airbnb).
 * - "envoltura" mete la URL dentro de un enlace de redireccion. Es lo que usa
 *   CJ Affiliate, que no rastrea con un parametro sino con su propio dominio;
 *   {url} se sustituye por la URL destino codificada.
 *
 * Mientras la variable no exista, todo sale sin tocar: los enlaces siguen
 * siendo busquedas publicas y la app no dice que gana comision, porque no la
 * gana.
 */

let configCache;
let crudoCache;

function leerConfig() {
  const crudo = process.env.AFFILIATE_LINKS || '';
  if (crudo === crudoCache) return configCache;

  crudoCache = crudo;
  configCache = {};

  if (!crudo.trim()) return configCache;

  try {
    const datos = JSON.parse(crudo);
    for (const [proveedor, cfg] of Object.entries(datos)) {
      // Se descarta lo que no se pueda aplicar en vez de generar un enlace roto:
      // un enlace de reserva que no abre es peor que uno sin comision.
      if (cfg?.tipo === 'param' && cfg.clave && cfg.valor) {
        configCache[proveedor] = cfg;
      } else if (cfg?.tipo === 'envoltura' && String(cfg.plantilla || '').includes('{url}')) {
        configCache[proveedor] = cfg;
      } else {
        console.warn(`[afiliados] configuracion ignorada para "${proveedor}": le falta algo`);
      }
    }
  } catch {
    console.warn('[afiliados] AFFILIATE_LINKS no es JSON valido; se ignora');
  }

  return configCache;
}

/** True si hay al menos un proveedor configurado. */
export function hayAfiliados() {
  return Object.keys(leerConfig()).length > 0;
}

/** Solo para pruebas: olvida lo leido de la variable de entorno. */
export function limpiarCache() {
  crudoCache = undefined;
  configCache = undefined;
}

/**
 * Devuelve el enlace con el identificador de afiliado puesto, o el original si
 * ese proveedor no esta configurado. Nunca lanza: si algo sale mal se devuelve
 * la URL tal cual, que es el comportamiento seguro.
 */
export function decorarEnlace(enlace) {
  const cfg = leerConfig()[enlace?.provider];
  if (!cfg || !enlace?.url) return enlace;

  try {
    if (cfg.tipo === 'param') {
      const u = new URL(enlace.url);
      u.searchParams.set(cfg.clave, cfg.valor);
      return { ...enlace, url: u.toString(), esAfiliado: true };
    }
    return {
      ...enlace,
      url: cfg.plantilla.replace('{url}', encodeURIComponent(enlace.url)),
      esAfiliado: true,
    };
  } catch {
    return enlace;
  }
}

/** Aplica decorarEnlace a las tres secciones que devuelve buildLinksForTrip. */
export function decorarSecciones(secciones) {
  if (!hayAfiliados()) return secciones;

  const salida = {};
  for (const [seccion, enlaces] of Object.entries(secciones)) {
    salida[seccion] = Array.isArray(enlaces) ? enlaces.map(decorarEnlace) : enlaces;
  }
  return salida;
}
