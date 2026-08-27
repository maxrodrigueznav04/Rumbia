import dotenv from 'dotenv';

dotenv.config();

const required = ['MONGO_URI', 'JWT_SECRET'];
const missing = required.filter((key) => !process.env[key]);

if (missing.length) {
  console.error(`\n[config] Faltan variables de entorno: ${missing.join(', ')}`);
  console.error('[config] Copia server/.env.example a server/.env y llenalas.\n');
  process.exit(1);
}

export const env = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
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
