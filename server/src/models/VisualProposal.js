import mongoose from 'mongoose';

// La colección admite varias propuestas por viaje. La primera interfaz usa
// solo una activa; no hay índice único en trip que impida variantes futuras.
const visualProposalSchema = new mongoose.Schema({
  agency: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency', required: true, index: true },
  trip: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  template: { type: mongoose.Schema.Types.ObjectId, ref: 'VisualTemplate', required: true },
  templateRevision: { type: Number, required: true, min: 1 },
  design: { type: mongoose.Schema.Types.Mixed, required: true },
  revision: { type: Number, min: 1, default: 1 },
  active: { type: Boolean, default: true, index: true },
  variantSlot: { type: Number, min: 1, default: 1 },
}, { timestamps: true, optimisticConcurrency: true });

visualProposalSchema.index({ trip: 1, active: 1, updatedAt: -1 });
visualProposalSchema.index({ trip: 1, variantSlot: 1 }, {
  unique: true,
  partialFilterExpression: { active: true },
});

export default mongoose.model('VisualProposal', visualProposalSchema);
