import mongoose from 'mongoose';

// Las plantillas visuales guardan presentación, no días ni actividades. El
// documento de diseño se valida en la API antes de llegar a este modelo.
const visualTemplateSchema = new mongoose.Schema({
  agency: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency', required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },
  // Cupo activo reservado. El índice único evita superar el plan mediante
  // dos creaciones simultáneas; las archivadas liberan su lugar.
  activeSlot: { type: Number, min: 1, default: null },
  revision: { type: Number, min: 1, default: 1 },
  design: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true, optimisticConcurrency: true });

visualTemplateSchema.index({ agency: 1, status: 1, updatedAt: -1 });
visualTemplateSchema.index({ agency: 1, activeSlot: 1 }, {
  unique: true,
  partialFilterExpression: { activeSlot: { $type: 'number' } },
});

export default mongoose.model('VisualTemplate', visualTemplateSchema);
