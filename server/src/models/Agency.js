import mongoose from 'mongoose';
import crypto from 'node:crypto';

/**
 * Agencia: la marca que comparten varios agentes sin compartir cuenta.
 *
 * Cada agente sigue teniendo su propio login, sus propios viajes y su propia
 * contrasena — lo unico que la agencia centraliza es el membrete del PDF
 * (nombre, logo, contacto). La pertenencia vive en User.agency (un ref),
 * no en un arreglo de miembros aqui: asi hay un solo lugar de verdad y no dos
 * listas que se puedan desincronizar.
 */

const generarCodigo = () => crypto.randomBytes(4).toString('hex');

const agencySchema = new mongoose.Schema(
  {
    agencyName: { type: String, required: true, trim: true, maxlength: 80 },
    logoUrl: { type: String, trim: true, default: '' },
    contact: { type: String, trim: true, maxlength: 160, default: '' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Se comparte fuera de la app (whatsapp, correo) para que un agente se una
    // sin que el dueno tenga que invitarlo uno por uno desde un panel.
    inviteCode: { type: String, required: true, unique: true, default: generarCodigo },
  },
  { timestamps: true }
);

agencySchema.methods.regenerarCodigo = function regenerarCodigo() {
  this.inviteCode = generarCodigo();
  return this.inviteCode;
};

export default mongoose.model('Agency', agencySchema);
