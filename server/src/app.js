import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import env from './config/env.js';
import routes from './routes/index.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiters.js';

const app = express();

// Render/Railway van detras de proxy: sin esto el rate limit lee la IP del proxy.
app.set('trust proxy', 1);

app.use(helmet());
app.use(compression());

// La barra final es el error de configuracion mas comun al capturar CLIENT_URL
// en el panel de Render: "https://app.vercel.app/" nunca casaria con el Origin
// que manda el navegador, que jamas la lleva.
const normalizar = (url) => (url || '').trim().replace(/\/+$/, '');

// En produccion solo se acepta el origen del front desplegado.
const allowedOrigins = (
  env.isProd
    ? [env.clientUrl]
    : [env.clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173']
).map(normalizar).filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Sin origin: curl, Postman, health checks de Render.
      if (!origin || allowedOrigins.includes(normalizar(origin))) return callback(null, true);

      // Negar NO es un error del servidor: se responde sin cabeceras CORS y el
      // navegador bloquea. Lanzar aqui producia un 500 por cada bot que pasara.
      if (!env.isProd) console.warn(`[cors] origen no permitido: ${origin}`);
      return callback(null, false);
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.isProd ? 'combined' : 'dev'));

app.use('/api', apiLimiter, routes);

app.get('/', (_req, res) => {
  res.json({ name: 'Rumbo API', version: '1.0.0', docs: '/api/health' });
});

app.use(notFound);
app.use(errorHandler);

export default app;
