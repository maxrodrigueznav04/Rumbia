import multer from 'multer';
import ApiError from '../utils/ApiError.js';

/**
 * Middleware de subida del logo, un solo archivo en el campo "logo".
 *
 * memoryStorage a proposito: el archivo va directo de la peticion a un Buffer
 * en RAM y de ahi a Cloudinary, sin tocar el disco de Render. Es efimero de
 * todas formas (se borra en cada despliegue), asi que escribir ahi solo
 * agregaria un paso inutil.
 */
const TIPOS_PERMITIDOS = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB: un logo no necesita mas, y cada MB de mas es credito de Cloudinary gastado sin motivo.

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!TIPOS_PERMITIDOS.has(file.mimetype)) {
      return cb(ApiError.badRequest('El logo debe ser PNG, JPEG o WebP.'));
    }
    cb(null, true);
  },
});

/** Envuelve multer para traducir sus errores al formato del resto de la API. */
export default function subirLogo(req, res, next) {
  upload.single('logo')(req, res, (err) => {
    if (!err) {
      if (!req.file) return next(ApiError.badRequest('No se recibió ningún archivo.'));
      return next();
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(ApiError.badRequest('El logo pesa demasiado. El máximo es 2 MB.'));
    }
    return next(err instanceof ApiError ? err : ApiError.badRequest('No se pudo leer el archivo.'));
  });
}
