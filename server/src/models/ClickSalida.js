import mongoose from 'mongoose';

export const ORIGENES_CLICK = ['app', 'invitado', 'compartido'];

/**
 * Clic en un enlace de salida hacia un proveedor.
 *
 * Existe para responder una sola pregunta: que proveedores se pulsan de verdad,
 * y desde donde. Sin eso no hay forma de saber que enlaces vale la pena tener
 * ni cuales conviene negociar como afiliado.
 *
 * Es deliberadamente ANONIMO. No se guarda usuario, ni IP, ni navegador, ni
 * cookie: solo el proveedor, la seccion, el destino del viaje y la fecha. Con
 * eso alcanza para decidir, y evita convertir una metrica de negocio en un
 * registro de comportamiento de personas.
 */
const clickSalidaSchema = new mongoose.Schema(
  {
    provider: { type: String, required: true, trim: true, maxlength: 60, index: true },
    section: { type: String, trim: true, maxlength: 40 },
    // Sirve para saber si conviene priorizar enlaces por region.
    destination: { type: String, trim: true, maxlength: 120 },
    esAfiliado: { type: Boolean, default: false },
    origen: { type: String, enum: ORIGENES_CLICK, default: 'app' },
    // Se conserva medio ano y se borra solo: para decidir que proveedores
    // funcionan no hace falta un historico eterno.
    createdAt: { type: Date, default: Date.now, expires: '180d' },
  },
  { versionKey: false }
);

// El reporte siempre agrupa por proveedor dentro de un rango de fechas.
clickSalidaSchema.index({ createdAt: -1, provider: 1 });

export default mongoose.model('ClickSalida', clickSalidaSchema);
