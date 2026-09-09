/**
 * Validación del lado del cliente. Refleja las reglas del backend (Zod) para dar
 * feedback inmediato, pero NO las sustituye: el servidor sigue siendo la autoridad.
 *
 * Importa el singleton de i18n directo (no el hook useTranslation) porque estas
 * son funciones normales, no componentes, y se usan como validadores pasados a
 * useFormulario -- mismo patrón que utils/format.js.
 */
import i18n from '../i18n.js';

const t = (key, params) => i18n.t(key, { ns: 'validacion', ...params });

export const reglas = {
  nombre: (v) => {
    const val = (v || '').trim();
    if (!val) return t('nombre.vacio');
    if (val.length < 2) return t('nombre.corto');
    if (val.length > 80) return t('nombre.largo');
    return null;
  },

  email: (v) => {
    const val = (v || '').trim();
    if (!val) return t('email.vacio');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val)) return t('email.invalido');
    return null;
  },

  password: (v) => {
    if (!v) return t('password.vacio');
    if (v.length < 8) return t('password.corta', { cantidad: 8 - v.length });
    if (v.length > 72) return t('password.larga');
    return null;
  },

  passwordLogin: (v) => (v ? null : t('passwordLogin')),

  requerido: (etiqueta) => (v) => (String(v ?? '').trim() ? null : t('requerido', { etiqueta })),

  numeroPositivo: (v) => {
    if (v === '' || v == null) return null; // opcional
    const n = Number(v);
    if (Number.isNaN(n)) return t('numero.invalido');
    if (n < 0) return t('numero.negativo');
    return null;
  },

  /**
   * Rango de fechas de una parada adicional: tiene que caer dentro de las
   * fechas del viaje completo. CampoFechas no tiene un prop `maximo` para
   * bloquear esto en el propio input, asi que se valida aparte. Devuelve
   * null si algo todavia no esta completo (el input ya avisa lo obvio).
   */
  paradaEnRango: (startDate, endDate, tripStart, tripEnd) => {
    if (!startDate || !endDate || !tripStart || !tripEnd) return null;
    if (endDate < startDate) return t('paradaEnRango.antesDeLlegada');
    if (startDate < tripStart || endDate > tripEnd) {
      return t('paradaEnRango.fueraDelViaje');
    }
    return null;
  },

  urlOpcional: (v) => {
    const val = (v || '').trim();
    if (!val) return null;
    try {
      new URL(val);
      return null;
    } catch {
      return t('urlInvalida');
    }
  },
};

/**
 * Fuerza de una contraseña, de 0 a 4.
 * Prioriza el largo sobre los símbolos: "correcaballobateriagrapa" es más difícil
 * de romper que "P@ss1!", aunque los medidores ingenuos digan lo contrario.
 */
export function fuerzaPassword(pass = '') {
  if (!pass) return { nivel: 0, etiqueta: '', color: '', consejo: '' };

  // El largo pesa más que la variedad de símbolos: una frase larga resiste
  // mucho mejor un ataque de fuerza bruta que "P@ss1!", aunque los medidores
  // ingenuos premien más los símbolos.
  let puntos = 0;
  if (pass.length >= 8) puntos += 1;
  if (pass.length >= 12) puntos += 1;
  if (pass.length >= 16) puntos += 1;
  if (pass.length >= 24) puntos += 1;
  if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) puntos += 1;
  if (/\d/.test(pass)) puntos += 1;
  if (/[^A-Za-z0-9]/.test(pass)) puntos += 1;

  // Patrones obvios: caracteres repetidos o secuencias de teclado.
  const debil =
    /^(.)\1+$/.test(pass) || /12345|qwerty|asdf|password|contrasena|admin/i.test(pass);
  if (debil) puntos = Math.min(puntos, 1);

  const nivel = puntos >= 5 ? 4 : puntos >= 4 ? 3 : puntos >= 2 ? 2 : 1;

  const escala = [
    null,
    { clave: 'muyDebil', color: 'error' },
    { clave: 'debil', color: 'alerta' },
    { clave: 'buena', color: 'cielo' },
    { clave: 'muyBuena', color: 'exito' },
  ];
  const { clave, color } = escala[nivel];

  return {
    nivel,
    etiqueta: t(`fuerzaPassword.${clave}.etiqueta`),
    color,
    consejo: t(`fuerzaPassword.${clave}.consejo`),
  };
}

/**
 * Corre un mapa de validadores sobre un objeto de valores.
 * Devuelve { campo: mensaje } solo con los campos que fallaron.
 */
export function validarFormulario(valores, validadores) {
  const errores = {};
  for (const [campo, validar] of Object.entries(validadores)) {
    const error = validar(valores[campo], valores);
    if (error) errores[campo] = error;
  }
  return errores;
}
