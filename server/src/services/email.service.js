import env from '../config/env.js';

/**
 * Envio de correo transaccional con Resend.
 *
 * Se habla con su API REST por fetch en vez de instalar el SDK: es una sola
 * peticion POST y el resto del proyecto ya resuelve asi lo de Gemini y lo del
 * clima. Una dependencia menos que actualizar.
 *
 * Nada de lo que hay aqui puede tumbar una peticion del usuario. Si el correo
 * falla se registra y se sigue: en la recuperacion de contrasena la respuesta
 * al navegador es la misma pase lo que pase, justamente para no revelar que
 * cuentas existen.
 */

const API = 'https://api.resend.com/emails';
const TIMEOUT_MS = 10000;

/** Escapa lo que venga del usuario antes de meterlo en el HTML del correo. */
const esc = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * @returns {Promise<boolean>} si salio o no. Nunca lanza.
 */
export async function enviarCorreo({ para, asunto, html, texto }) {
  if (!env.resend.enabled) {
    console.warn(`[correo] RESEND_API_KEY sin definir; no se envio "${asunto}" a ${para}.`);
    return false;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.resend.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.resend.from,
        to: [para],
        subject: asunto,
        html,
        // Alternativa en texto plano: hay clientes que no pintan HTML, y los
        // filtros de spam puntúan peor un correo que solo trae una de las dos.
        text: texto,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const cuerpo = await res.text().catch(() => '');
      // El caso mas comun con una cuenta nueva: sin dominio verificado, Resend
      // solo deja enviar al correo con el que te registraste. El mensaje suyo
      // lo dice, asi que se adjunta en vez de resumirlo mal.
      console.error(`[correo] Resend respondio ${res.status}: ${cuerpo.slice(0, 300)}`);
      return false;
    }

    return true;
  } catch (err) {
    const motivo = err.name === 'AbortError' ? 'tardo demasiado' : err.message;
    console.error(`[correo] No se pudo enviar "${asunto}": ${motivo}`);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Correo de recuperacion de contrasena. */
export function correoRecuperacion({ nombre, enlace, minutos }) {
  const saludo = nombre ? `Hola ${esc(nombre)}` : 'Hola';

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#16231D">
  <div style="font-size:20px;font-weight:700;color:#123D32;margin-bottom:24px">Rumbia</div>
  <h1 style="font-size:19px;margin:0 0 12px">${saludo}, ¿olvidaste tu contraseña?</h1>
  <p style="font-size:15px;line-height:1.55;color:#3A433C;margin:0 0 20px">
    Pulsa el botón para elegir una nueva. El enlace sirve una sola vez y caduca en ${minutos} minutos.
  </p>
  <p style="margin:0 0 24px">
    <a href="${esc(enlace)}" style="display:inline-block;background:#1F6F5C;color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:600;font-size:15px">
      Elegir una contraseña nueva
    </a>
  </p>
  <p style="font-size:13px;line-height:1.55;color:#59635A;margin:0 0 8px">
    Si el botón no funciona, copia esta dirección en tu navegador:
  </p>
  <p style="font-size:12px;color:#59635A;word-break:break-all;margin:0 0 24px">${esc(enlace)}</p>
  <hr style="border:none;border-top:1px solid #EFE6D3;margin:24px 0">
  <p style="font-size:13px;line-height:1.55;color:#59635A;margin:0">
    Si no pediste esto, puedes ignorar el correo: tu contraseña sigue igual y nadie ha entrado a tu cuenta.
  </p>
</div>`.trim();

  const texto = [
    `${nombre ? `Hola ${nombre}` : 'Hola'}, ¿olvidaste tu contraseña?`,
    '',
    `Abre esta dirección para elegir una nueva. Sirve una sola vez y caduca en ${minutos} minutos:`,
    enlace,
    '',
    'Si no pediste esto, ignora el correo: tu contraseña sigue igual.',
    '',
    'Rumbia',
  ].join('\n');

  return { asunto: 'Recupera tu contraseña de Rumbia', html, texto };
}

/** Correo de verificacion de cuenta nueva. */
export function correoVerificacion({ nombre, enlace, horas }) {
  const saludo = nombre ? `Hola ${esc(nombre)}` : 'Hola';
  const plazo = horas === 24 ? '24 horas' : `${horas} horas`;

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#16231D">
  <div style="font-size:20px;font-weight:700;color:#123D32;margin-bottom:24px">Rumbia</div>
  <h1 style="font-size:19px;margin:0 0 12px">${saludo}, confirma tu correo</h1>
  <p style="font-size:15px;line-height:1.55;color:#3A433C;margin:0 0 20px">
    Pulsa el botón para activar tu cuenta. El enlace caduca en ${plazo}.
  </p>
  <p style="margin:0 0 24px">
    <a href="${esc(enlace)}" style="display:inline-block;background:#1F6F5C;color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:600;font-size:15px">
      Confirmar mi correo
    </a>
  </p>
  <p style="font-size:13px;line-height:1.55;color:#59635A;margin:0 0 8px">
    Si el botón no funciona, copia esta dirección en tu navegador:
  </p>
  <p style="font-size:12px;color:#59635A;word-break:break-all;margin:0 0 24px">${esc(enlace)}</p>
  <hr style="border:none;border-top:1px solid #EFE6D3;margin:24px 0">
  <p style="font-size:13px;line-height:1.55;color:#59635A;margin:0">
    Si no creaste una cuenta en Rumbia, puedes ignorar este correo.
  </p>
</div>`.trim();

  const texto = [
    `${nombre ? `Hola ${nombre}` : 'Hola'}, confirma tu correo`,
    '',
    `Abre esta dirección para activar tu cuenta. Caduca en ${plazo}:`,
    enlace,
    '',
    'Si no creaste una cuenta en Rumbia, ignora este correo.',
    '',
    'Rumbia',
  ].join('\n');

  return { asunto: 'Confirma tu correo en Rumbia', html, texto };
}

/** Aviso al agente/dueño del viaje cuando el cliente acepta la propuesta desde el enlace público. */
export function correoPropuestaAceptada({ nombre, viaje, enlace }) {
  const saludo = nombre ? `Hola ${esc(nombre)}` : 'Hola';

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#16231D">
  <div style="font-size:20px;font-weight:700;color:#123D32;margin-bottom:24px">Rumbia</div>
  <h1 style="font-size:19px;margin:0 0 12px">${saludo}, ¡tu cliente aceptó una propuesta!</h1>
  <p style="font-size:15px;line-height:1.55;color:#3A433C;margin:0 0 20px">
    Le dio clic a "Aceptar" en el enlace que compartiste de <strong>${esc(viaje)}</strong>.
  </p>
  <p style="margin:0 0 24px">
    <a href="${esc(enlace)}" style="display:inline-block;background:#1F6F5C;color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:600;font-size:15px">
      Ver el viaje en Rumbia
    </a>
  </p>
  <p style="font-size:13px;line-height:1.55;color:#59635A;margin:0 0 8px">
    Si el botón no funciona, copia esta dirección en tu navegador:
  </p>
  <p style="font-size:12px;color:#59635A;word-break:break-all;margin:0">${esc(enlace)}</p>
</div>`.trim();

  const texto = [
    `${nombre ? `Hola ${nombre}` : 'Hola'}, ¡tu cliente aceptó una propuesta!`,
    '',
    `Le dio clic a "Aceptar" en el enlace que compartiste de ${viaje}.`,
    '',
    'Ve el viaje en Rumbia:',
    enlace,
    '',
    'Rumbia',
  ].join('\n');

  return { asunto: `${viaje} · el cliente aceptó la propuesta`, html, texto };
}
