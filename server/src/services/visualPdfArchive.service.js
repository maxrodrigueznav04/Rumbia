import crypto from 'node:crypto';
import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';

const BUCKET = 'visualProposalPdfs';
const MAX_BYTES = 25 * 1024 * 1024;

function bucket() {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    throw ApiError.serviceUnavailable('El archivo de propuestas no está disponible.');
  }
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: BUCKET });
}

export async function archiveVisualPdf(pdf, { agencyId, tripId, proposalId }) {
  if (!Buffer.isBuffer(pdf) || pdf.length < 5 || pdf.length > MAX_BYTES || pdf.subarray(0, 5).toString() !== '%PDF-') {
    throw ApiError.badRequest('El archivo PDF generado no es válido.');
  }
  const hash = crypto.createHash('sha256').update(pdf).digest('hex');
  const stream = bucket().openUploadStream(`propuesta-${proposalId}.pdf`, {
    contentType: 'application/pdf',
    metadata: { agencyId: String(agencyId), tripId: String(tripId), proposalId: String(proposalId), sha256: hash },
  });
  try {
    await new Promise((resolve, reject) => {
      stream.once('finish', resolve);
      stream.once('error', reject);
      stream.end(pdf);
    });
  } catch (err) {
    try { await deleteArchivedVisualPdf(stream.id); } catch { /* limpieza posterior */ }
    throw ApiError.serviceUnavailable('No se pudo conservar el PDF emitido. Intenta de nuevo.');
  }
  return { fileId: stream.id, sha256: hash, bytes: pdf.length };
}

export async function readArchivedVisualPdf(fileId) {
  const chunks = [];
  let total = 0;
  try {
    for await (const chunk of bucket().openDownloadStream(fileId)) {
      total += chunk.length;
      if (total > MAX_BYTES) throw ApiError.serviceUnavailable('El PDF archivado excede el límite permitido.');
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw ApiError.serviceUnavailable('No se pudo recuperar el PDF emitido.');
  }
}

export async function deleteArchivedVisualPdf(fileId) {
  if (fileId) await bucket().delete(fileId);
}
