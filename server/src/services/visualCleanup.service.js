import mongoose from 'mongoose';
import { VisualAsset, VisualTemplate, VisualProposal, VisualProposalIssue } from '../models/index.js';
import { deleteProposalImage } from './visualAssets.service.js';
import { deleteArchivedVisualPdf } from './visualPdfArchive.service.js';

async function deletePdfs(metadataFilter) {
  // Includes files left by an interrupted issue request, not just published revisions.
  const files = mongoose.connection.db.collection('visualProposalPdfs.files');
  for await (const file of files.find(metadataFilter, { projection: { _id: 1 } })) {
    await deleteArchivedVisualPdf(file._id);
  }
}

export async function deleteVisualTripData(tripId) {
  await deletePdfs({ 'metadata.tripId': String(tripId) });
  await VisualProposalIssue.deleteMany({ trip: tripId });
  await VisualProposal.deleteMany({ trip: tripId });
}

export async function deleteVisualAgencyData(agencyId) {
  // Keep the record when remote deletion fails so a retry can still find the file.
  for await (const asset of VisualAsset.find({ agency: agencyId }).cursor()) {
    await deleteProposalImage(asset.publicId);
    await asset.deleteOne();
  }
  await deletePdfs({ 'metadata.agencyId': String(agencyId) });
  await VisualProposalIssue.deleteMany({ agency: agencyId });
  await VisualProposal.deleteMany({ agency: agencyId });
  await VisualTemplate.deleteMany({ agency: agencyId });
}
