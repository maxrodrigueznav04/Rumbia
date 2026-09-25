import multer from 'multer';
import ApiError from '../utils/ApiError.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 3 },
  fileFilter: (_req, file, callback) => {
    if (!['image/png', 'image/jpeg'].includes(file.mimetype)) {
      return callback(ApiError.badRequest('La imagen debe ser PNG o JPEG.'));
    }
    callback(null, true);
  },
});

export default function subirImagenPropuesta(req, res, next) {
  upload.single('image')(req, res, (err) => {
    if (err?.code === 'LIMIT_FILE_SIZE') return next(ApiError.badRequest('La imagen supera el límite de 8 MB.'));
    if (err) return next(err instanceof ApiError ? err : ApiError.badRequest('No se pudo leer la imagen.'));
    if (!req.file) return next(ApiError.badRequest('Selecciona una imagen.'));
    return next();
  });
}
