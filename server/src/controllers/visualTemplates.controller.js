import mongoose from 'mongoose';
import Agency from '../models/Agency.js';
import VisualTemplate from '../models/VisualTemplate.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { defaultVisualDesign } from '../validators/visualTemplate.js';
import { freeVisualTemplateSlot, visualTemplateCanEdit, visualTemplateLimit } from '../services/visualTemplates.service.js';

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

function rejectUnavailableAssets(design) {
  // El esquema conoce el tipo imagen para no tener que migrar todos los
  // diseños cuando llegue la biblioteca. Hasta entonces, no se acepta un id
  // inventado que después podría resolver a un archivo de otra agencia.
  if (design.pages.some((page) => page.elements.some((element) => element.type === 'image'))) {
    throw ApiError.badRequest('La biblioteca de imágenes todavía no está disponible en el editor.');
  }
}

export const list = asyncHandler(async (req, res) => {
  if (!req.user.agency) {
    return res.json({ success: true, data: { templates: [], canEdit: false, limit: 0 } });
  }
  const agency = await currentAgency(req.user);
  const templates = await VisualTemplate.find({ agency: agency._id })
    .select('name status revision activeSlot createdBy createdAt updatedAt')
    .sort({ updatedAt: -1 }).lean();
  res.json({ success: true, data: {
    templates,
    canEdit: visualTemplateCanEdit(agency, req.user) && agency.tieneAccesoActivo,
    limit: visualTemplateLimit(agency),
  } });
});

export const get = asyncHandler(async (req, res) => {
  const agency = await currentAgency(req.user);
  const template = await ownedTemplate(req.params.id, agency);
  res.json({ success: true, data: { template, canEdit: visualTemplateCanEdit(agency, req.user) && agency.tieneAccesoActivo } });
});

export const create = asyncHandler(async (req, res) => {
  const agency = await currentAgency(req.user);
  requireOwner(agency, req.user);
  requireActive(agency);
  const design = req.body.design || defaultVisualDesign();
  rejectUnavailableAssets(design);
  const activeSlot = await freeVisualTemplateSlot(agency);
  try {
    const template = await VisualTemplate.create({
      agency: agency._id, createdBy: req.user._id,
      name: req.body.name, design, activeSlot,
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
  if (nextStatus === 'published') {
    throw ApiError.conflict('La publicación estará disponible cuando la exportación PDF esté lista.');
  }
  // Archivar libera un cupo incluso si el plan caducó. Cualquier otra
  // modificación espera a que la agencia vuelva a tener acceso activo.
  if (nextStatus !== 'archived' || req.body.name !== undefined || req.body.design !== undefined) requireActive(agency);
  if (template.status === 'archived' && nextStatus !== 'archived') {
    template.activeSlot = await freeVisualTemplateSlot(agency);
  } else if (nextStatus === 'archived') {
    template.activeSlot = null;
  }
  if (req.body.design) {
    rejectUnavailableAssets(req.body.design);
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
