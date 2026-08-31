import dotenv from 'dotenv';

dotenv.config();

const required = ['MONGO_URI', 'JWT_SECRET'];
const missing = required.filter((key) => !process.env[key]);

if (missing.length) {
  console.error(`\n[config] Faltan variables de entorno: ${missing.join(', ')}`);
  console.error('[config] Copia server/.env.example a server/.env y llenalas.\n');
  process.exit(1);
}

// Un JWT_SECRET corto o adivinable firma la sesion de todo el mundo. 32
// caracteres son los 256 bits minimos razonables para HMAC-SHA256. El valor
// de ejemplo de .env.example se rechaza aparte, por nombre: es texto publico
// en este mismo repo, asi que su longitud no lo vuelve seguro si alguien lo
// deja puesto sin cambiar.
const JWT_SECRET_DE_EJEMPLO = 'cambia_esto_por_una_cadena_larga_y_aleatoria';
if (process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET === JWT_SECRET_DE_EJEMPLO) {
  console.error('\n[config] JWT_SECRET es invalido: falta, es muy corto, o es el valor de ejemplo del repo.');
  console.error(
    "[config] Genera uno con: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"\n"
  );
  process.exit(1);
}

export const env = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  // .trim() + sin barra final: un espacio o salto de linea de mas al copiar
  // la URL en Render pasa desapercibido en CORS (que ya normalizaba antes de
  // comparar) pero Stripe si lo rechaza de plano al armar success_url/cancel_url.
  clientUrl: (process.env.CLIENT_URL || 'http://localhost:5173').trim().replace(/\/+$/, ''),
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
    enabled: Boolean(process.env.GEMINI_API_KEY),
  },
  openWeather: {
    apiKey: process.env.OPENWEATHER_API_KEY || '',
    enabled: Boolean(process.env.OPENWEATHER_API_KEY),
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
    // Sin dominio verificado, Resend solo acepta su remitente de pruebas y
    // ademas solo entrega al correo con el que se creo la cuenta. Con dominio
    // propio esto pasa a ser algo como "Rumbo <hola@turumbo.com>".
    from: process.env.MAIL_FROM || 'Rumbo <onboarding@resend.dev>',
    enabled: Boolean(process.env.RESEND_API_KEY),
  },
  turnstile: {
    secretKey: process.env.TURNSTILE_SECRET_KEY || '',
    // Sin llave, el captcha queda desactivado y deja pasar todo: asi sigue
    // funcionando el registro en desarrollo o mientras no exista la cuenta
    // de Cloudflare.
    enabled: Boolean(process.env.TURNSTILE_SECRET_KEY),
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    enabled: Boolean(
      process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
    ),
  },
  // Cobro a agencias. Sin STRIPE_SECRET_KEY, /agency/billing responde 503 con
  // un aviso claro: el resto de la app (uso personal, agencia con un solo
  // dueño) sigue funcionando igual.
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    // Un Price de Stripe por casilla: base de cada plan + el costo de un
    // agente extra en ese mismo plan. Los crea `npm run stripe:setup`.
    precios: {
      mensualBase: process.env.STRIPE_PRICE_MENSUAL_BASE || '',
      mensualAgente: process.env.STRIPE_PRICE_MENSUAL_AGENTE || '',
      anualBase: process.env.STRIPE_PRICE_ANUAL_BASE || '',
      anualAgente: process.env.STRIPE_PRICE_ANUAL_AGENTE || '',
      vitalicioBase: process.env.STRIPE_PRICE_VITALICIO_BASE || '',
      vitalicioAgente: process.env.STRIPE_PRICE_VITALICIO_AGENTE || '',
    },
    enabled: Boolean(process.env.STRIPE_SECRET_KEY),
  },
  aiRateLimitPerHour: Number(process.env.AI_RATE_LIMIT_PER_HOUR || 10),
  // Quien puede ver el reporte de clics. Vacio = cerrado para todos, que es el
  // valor seguro por defecto.
  adminEmail: (process.env.ADMIN_EMAIL || '').toLowerCase(),
  // Las credenciales de la cuenta demo estan publicadas en el README, asi que
  // cualquiera puede entrar con ella. Se marca para que no se pueda eliminar y
  // no se lleve por delante la demo del portafolio.
  demoEmail: (process.env.SEED_USER_EMAIL || 'demo@rumbo.app').toLowerCase(),
  isProd: (process.env.NODE_ENV || 'development') === 'production',
};

export default env;
