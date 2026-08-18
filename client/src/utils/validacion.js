/**
 * Validación del lado del cliente. Refleja las reglas del backend (Zod) para dar
 * feedback inmediato, pero NO las sustituye: el servidor sigue siendo la autoridad.
 */

export const reglas = {
  nombre: (v) => {
    const t = (v || '').trim();
    if (!t) return 'Escribe tu nombre.';
    if (t.length < 2) return 'Debe tener al menos 2 caracteres.';
    if (t.length > 80) return 'Máximo 80 caracteres.';
    return null;
  },

  email: (v) => {
    const t = (v || '').trim();
    if (!t) return 'Escribe tu email.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t)) return 'Ese email no se ve bien.';
    return null;
  },

  password: (v) => {
    if (!v) return 'Escribe una contraseña.';
    if (v.length < 8) return `Faltan ${8 - v.length} caracteres (mínimo 8).`;
    if (v.length > 72) return 'Máximo 72 caracteres.';
    return null;
  },

  passwordLogin: (v) => (v ? null : 'Escribe tu contraseña.'),

  requerido: (etiqueta) => (v) => (String(v ?? '').trim() ? null : `${etiqueta} es obligatorio.`),

  numeroPositivo: (v) => {
    if (v === '' || v == null) return null; // opcional
    const n = Number(v);
    if (Number.isNaN(n)) return 'Debe ser un número.';
    if (n < 0) return 'No puede ser negativo.';
    return null;
  },

  urlOpcional: (v) => {
    const t = (v || '').trim();
    if (!t) return null;
    try {
      new URL(t);
      return null;
    } catch {
      return 'Debe ser una URL completa (https://...).';
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
    { etiqueta: 'Muy débil', color: 'error', consejo: 'Alárgala: junta tres o cuatro palabras.' },
    { etiqueta: 'Débil', color: 'alerta', consejo: 'Con 12 caracteres o más mejora bastante.' },
    { etiqueta: 'Buena', color: 'cielo', consejo: '' },
    { etiqueta: 'Muy buena', color: 'exito', consejo: '' },
  ];

  return { nivel, ...escala[nivel] };
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
