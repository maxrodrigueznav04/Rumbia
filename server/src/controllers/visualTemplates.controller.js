import mongoose from 'mongoose';
import Agency from '../models/Agency.js';
import VisualTemplate from '../models/VisualTemplate.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { defaultVisualDesign, VISUAL_PRESET_IDS, visualPresetDesign } from '../validators/visualTemplate.js';
import { freeVisualTemplateSlot, visualTemplateCanEdit, visualTemplateLimit } from '../services/visualTemplates.service.js';
import { loadVisualDesignAssets } from '../services/visualDesignAssets.service.js';
import { visualPresetArt } from '../services/visualPresetArt.service.js';

async function currentAgency(user) {
  if (!user.agency) throw ApiError.forbidden('Las plantillas visuales pertenecen a una agencia.');
  const agency = await Agency.findById(user.agency);
  if (!agency) throw ApiError.notFound('Agencia no encontrada.');
  return agency;
}

function requireOwner(agency, user) {
  if (!visualTemplateCanEdit(agency, user)) {
    throw ApiError.forbidden('Solo el dueño de la agencia puede modificar plantillas visuales.');
  }
  if (agency.status === 'archivada') throw ApiError.forbidden('La agencia está archivada.');
}

function requireActive(agency) {
  if (!agency.tieneAccesoActivo) {
    throw ApiError.forbidden('Necesitas una prueba o suscripción activa para guardar plantillas visuales.');
  }
}

async function ownedTemplate(id, agency) {
  if (!mongoose.isValidObjectId(id)) throw ApiError.notFound('Plantilla visual no encontrada.');
  const template = await VisualTemplate.findOne({ _id: id, agency: agency._id });
  if (!template) throw ApiError.notFound('Plantilla visual no encontrada.');
  return template;
}

export const list = asyncHandler(async (req, res) => {
  if (!req.user.agency) {
    return res.json({ success: true, data: { templates: [], canEdit: false, limit: 0, presets: VISUAL_PRESET_IDS.map((id) => ({ id, design: visualPresetDesign(id) })) } });
  }
  const agency = await currentAgency(req.user);
  const templates = await VisualTemplate.find({ agency: agency._id })
    .select('name status revision activeSlot createdBy createdAt updatedAt')
    .sort({ updatedAt: -1 }).lean();
  res.json({ success: true, data: {
    templates,
    canEdit: visualTemplateCanEdit(agency, req.user) && agency.tieneAccesoActivo && agency.status !== 'archivada',
    canArchive: visualTemplateCanEdit(agency, req.user) && agency.status !== 'archivada',
    limit: visualTemplateLimit(agency),
    presets: VISUAL_PRESET_IDS.map((id) => ({ id, design: visualPresetDesign(id) })),
  } });
});

export const art = asyncHandler(async (req, res) => {
  const bytes = visualPresetArt(req.params.artId);
  if (!bytes) throw ApiError.notFound('Arte no encontrado.');
  // The web and API live on sibling subdomains; Helmet's same-origin default blocks these images.
  res.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-cache', 'Cross-Origin-Resource-Policy': 'same-site' }).send(bytes);
});

export const get = asyncHandler(async (req, res) => {
  const agency = await currentAgency(req.user);
  const template = await ownedTemplate(req.params.id, agency);
  res.json({ success: true, data: { template, canEdit: visualTemplateCanEdit(agency, req.user) && agency.tieneAccesoActivo && agency.status !== 'archivada' } });
});

export const create = asyncHandler(async (req, res) => {
  const agency = await currentAgency(req.user);
  requireOwner(agency, req.user);
  requireActive(agency);
  const design = req.body.presetId ? visualPresetDesign(req.body.presetId) : (req.body.design || defaultVisualDesign());
  await loadVisualDesignAssets(design, agency._id);
  const activeSlot = await freeVisualTemplateSlot(agency);
  try {
    const template = await VisualTemplate.create({
      agency: agency._id, createdBy: req.user._id,
      name: req.body.name, design, activeSlot, status: req.body.status || 'draft',
    });
    res.status(201).json({ success: true, data: { template } });
  } catch (err) {
    if (err.code === 11000) throw ApiError.conflict('El cupo de plantillas cambió. Actualiza la lista e inténtalo de nuevo.');
    throw err;
  }
});

export const update = asyncHandler(async (req, res) => {
  const agency = await currentAgency(req.user);
  requireOwner(agency, req.user);
  const template = await ownedTemplate(req.params.id, agency);
  if (template.revision !== req.body.revision) {
    throw ApiError.conflict('Esta plantilla cambió en otra pestaña. Actualízala antes de guardar.');
  }
  const nextStatus = req.body.status || template.status;
  // Archivar libera un cupo incluso si el plan caducó. Cualquier otra
  // modificación espera a que la agencia vuelva a tener acceso activo.
  if (nextStatus !== 'archived' || req.body.name !== undefined || req.body.design !== undefined) requireActive(agency);
  if (template.status === 'archived' && nextStatus !== 'archived') {
    template.activeSlot = await freeVisualTemplateSlot(agency);
  } else if (nextStatus === 'archived') {
    template.activeSlot = null;
  }
  if (req.body.design) {
    await loadVisualDesignAssets(req.body.design, agency._id);
    template.design = req.body.design;
    template.markModified('design');
  }
  if (req.body.name !== undefined) template.name = req.body.name;
  template.status = nextStatus;
  template.revision += 1;
  try {
    await template.save();
  } catch (err) {
    if (err.name === 'VersionError') throw ApiError.conflict('Esta plantilla cambió en otra pestaña. Actualízala antes de guardar.');
    if (err.code === 11000) throw ApiError.conflict('El cupo de plantillas cambió. Actualiza la lista e inténtalo de nuevo.');
    throw err;
  }
  res.json({ success: true, data: { template } });
});

export const duplicate = asyncHandler(async (req, res) => {
  const agency = await currentAgency(req.user);
  requireOwner(agency, req.user);
  requireActive(agency);
  const source = await ownedTemplate(req.params.id, agency);
  const activeSlot = await freeVisualTemplateSlot(agency);
  try {
    const template = await VisualTemplate.create({
      agency: agency._id, createdBy: req.user._id, activeSlot,
      name: `${source.name.slice(0, 70)} (copia)`,
      design: source.design, status: 'draft',
    });
    res.status(201).json({ success: true, data: { template } });
  } catch (err) {
    if (err.code === 11000) throw ApiError.conflict('El cupo de plantillas cambió. Actualiza la lista e inténtalo de nuevo.');
    throw err;
  }
});
