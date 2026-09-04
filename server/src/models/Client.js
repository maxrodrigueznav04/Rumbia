import mongoose from 'mongoose';

/**
 * Cliente registrado en el CRM de un asesor o agencia.
 * Permite mantener un historial de viajeros frecuentes o familias,
 * con sus datos de contacto, preferencias y viajes cotizados/realizados.
 */
const clientSchema = new mongoose.Schema(
  {
    // Usuario creador del cliente
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Si el usuario pertenece a una agencia, se asocia para que el equipo pueda compartir cartera
    agency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agency',
      default: null,
      index: true,
    },
    nombre: {
      type: String,
      required: [true, 'El nombre del cliente es obligatorio.'],
      trim: true,
      maxlength: [160, 'El nombre no puede superar los 160 caracteres.'],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: [160, 'El correo no puede superar los 160 caracteres.'],
      default: '',
    },
    telefono: {
      type: String,
      trim: true,
      maxlength: [40, 'El teléfono no puede superar los 40 caracteres.'],
      default: '',
    },
    notas: {
      type: String,
      trim: true,
      maxlength: [2000, 'Las notas no pueden superar los 2000 caracteres.'],
      default: '',
    },
    origen: {
      type: String,
      trim: true,
      maxlength: [80, 'El origen no puede superar los 80 caracteres.'],
      default: '',
    },
    etiquetas: {
      type: [{ type: String, trim: true, maxlength: 40 }],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Índice de búsqueda rápida por nombre
clientSchema.index({ user: 1, nombre: 1 });
clientSchema.index({ agency: 1, nombre: 1 });

const Client = mongoose.model('Client', clientSchema);
export default Client;
