import mongoose from 'mongoose';

const issueSchema = new mongoose.Schema({
  agency: { type: mongoose.Schema.Types.ObjectId, ref: 'Agency', required: true, index: true },
  trip: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true, index: true },
  proposal: { type: mongoose.Schema.Types.ObjectId, ref: 'VisualProposal', required: true, index: true },
  sequence: { type: Number, required: true, min: 1 },
  issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  templateRevision: { type: Number, required: true, min: 1 },
  design: { type: mongoose.Schema.Types.Mixed, required: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  pdfFileId: { type: mongoose.Schema.Types.ObjectId, required: true },
  pdfSha256: { type: String, required: true },
  pdfBytes: { type: Number, required: true },
}, { timestamps: true });

issueSchema.index({ proposal: 1, sequence: 1 }, { unique: true });

export default mongoose.model('VisualProposalIssue', issueSchema);
