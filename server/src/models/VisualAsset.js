import mongoose from 'mongoose';

const visualAssetSchema = new mongoose.Schema({
  agency: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency', required: true, index: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  publicId: { type: String, required: true, unique: true },
  url: { type: String, required: true },
  width: { type: Number, required: true, min: 1 },
  height: { type: Number, required: true, min: 1 },
  mimeType: { type: String, enum: ['image/png', 'image/jpeg'], required: true },
  origin: { type: String, enum: ['own', 'licensed'], required: true },
  licenseRef: { type: String, trim: true, maxlength: 300, default: '' },
  rightsConfirmedAt: { type: Date, required: true },
}, { timestamps: true });

visualAssetSchema.index({ agency: 1, createdAt: -1 });

export default mongoose.model('VisualAsset', visualAssetSchema);
