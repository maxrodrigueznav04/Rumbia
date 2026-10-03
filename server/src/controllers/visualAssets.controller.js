import mongoose from 'mongoose';
import Agency from '../models/Agency.js';
import VisualAsset from '../models/VisualAsset.js';
import VisualTemplate from '../models/VisualTemplate.js';
import VisualProposal from '../models/VisualProposal.js';
import VisualProposalIssue from '../models/VisualProposalIssue.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { inspectProposalImage, uploadProposalImage, deleteProposalImage } from '../services/visualAssets.service.js';

async function agencyOf(user, requireActive = false) {
  if (!user.agency) throw ApiError.forbidden('Necesitas pertenecer a una agencia.');
  const agency = await Agency.findById(user.agency);
  if (!agency) throw ApiError.notFound('Agencia no encontrada.');
  if (requireActive && agency.status === 'archivada') throw ApiError.forbidden('La agencia está archivada.');
  if (requireActive && !agency.tieneAccesoActivo) throw ApiError.forbidden('Tu agencia necesita una prueba o plan activo para subir imágenes.');
  return agency;
}

export const list = asyncHandler(async (req, res) => {
  if (!req.user.agency) return res.json({ success: true, data: { assets: [] } });
  const assets = await VisualAsset.find({ agency: req.user.agency })
    .select('url width height origin licenseRef uploadedBy createdAt')
    .sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: { assets } });
});

export const upload = asyncHandler(async (req, res) => {
  const agency = await agencyOf(req.user, true);
  if (req.body.rightsConfirmed !== 'true') throw ApiError.badRequest('Confirma que tienes derecho a usar esta imagen en propuestas comerciales.');
  if (!['own', 'licensed'].includes(req.body.origin)) throw ApiError.badRequest('Indica si la imagen es propia o cuenta con licencia.');
  const licenseRef = String(req.body.licenseRef || '').trim();
  if (licenseRef.length > 300) throw ApiError.badRequest('La referencia de licencia es demasiado larga.');
  if (req.body.origin === 'licensed' && !licenseRef) throw ApiError.badRequest('Agrega una referencia de la licencia.');
  const { mimeType, width, height } = inspectProposalImage(req.file.buffer);
  if (mimeType !== req.file.mimetype) throw ApiError.badRequest('El archivo no coincide con su tipo declarado.');
  const count = await VisualAsset.countDocuments({ agency: agency._id });
  if (count >= 100) throw ApiError.conflict('La biblioteca de la agencia llegó a 100 imágenes.');
  const result = await uploadProposalImage({ buffer: req.file.buffer, mimeType, agencyId: agency._id });
  let asset;
  try {
    asset = await VisualAsset.create({
      agency: agency._id, uploadedBy: req.user._id, publicId: result.publicId, url: result.url,
      width: result.width || width, height: result.height || height, mimeType,
      origin: req.body.origin, licenseRef, rightsConfirmedAt: new Date(),
    });
  } catch (err) {
    await deleteProposalImage(result.publicId).catch((cleanup) => console.error('[propuestas] No se pudo limpiar imagen huérfana:', cleanup));
    throw err;
  }
  res.status(201).json({ success: true, data: { asset } });
});

export const remove = asyncHandler(async (req, res) => {
  const agency = await agencyOf(req.user, true);
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.notFound('Imagen no encontrada.');
  const asset = await VisualAsset.findOne({ _id: req.params.id, agency: agency._id });
  if (!asset) throw ApiError.notFound('Imagen no encontrada.');
  if (String(agency.owner) !== String(req.user._id) && String(asset.uploadedBy) !== String(req.user._id)) {
    throw ApiError.forbidden('Solo quien subió la imagen o el dueño de la agencia puede eliminarla.');
  }
  const templates = await VisualTemplate.find({ agency: agency._id }).select('design').lean();
  if (templates.some((template) => template.design?.pages?.some((page) => page.elements?.some((element) => element.assetId === String(asset._id))))) {
    throw ApiError.conflict('Esta imagen está en una plantilla. Quítala de la plantilla antes de borrarla.');
  }
  const proposals = await VisualProposal.find({ agency: agency._id }).select('design').lean();
  if (proposals.some((proposal) => proposal.design?.pages?.some((page) => page.elements?.some((element) => element.assetId === String(asset._id))))) {
    throw ApiError.conflict('Esta imagen está en una propuesta de viaje. Quítala antes de borrarla.');
  }
  const issued = await VisualProposalIssue.exists({ agency: agency._id, [`data.assets.${asset._id}`]: { $exists: true } });
  if (issued) throw ApiError.conflict('Esta imagen forma parte de una propuesta ya emitida y debe conservarse.');
  await deleteProposalImage(asset.publicId);
  await asset.deleteOne();
  res.json({ success: true, message: 'Imagen eliminada.' });
});
