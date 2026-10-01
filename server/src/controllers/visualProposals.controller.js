import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { Agency, Trip, User, Itinerary, VisualTemplate, VisualProposal, VisualProposalIssue } from '../models/index.js';
import { findOwnedTrip } from './trip.controller.js';
import { buildVisualProposalData } from '../services/visualProposalData.service.js';
import { renderVisualProposalHtml } from '../services/visualProposalHtml.service.js';
import { renderVisualPdf } from '../services/visualPdf.service.js';
import { archiveVisualPdf, readArchivedVisualPdf, deleteArchivedVisualPdf } from '../services/visualPdfArchive.service.js';
import { loadVisualDesignAssets } from '../services/visualDesignAssets.service.js';
import { ensureVisualTemplateAllowance } from '../services/visualTemplates.service.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

async function context(req, requireActive = false) {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.notFound('Viaje no encontrado.');
  const trip = await findOwnedTrip(req.params.id, req.user);
  if (!trip.agency || String(trip.agency) !== String(req.user.agency)) {
    throw ApiError.forbidden('Las propuestas visuales solo están disponibles para viajes de tu agencia.');
  }
  const agency = await Agency.findById(trip.agency);
  if (!agency) throw ApiError.notFound('Agencia no encontrada.');
  if (requireActive && agency.status === 'archivada') throw ApiError.forbidden('La agencia está archivada.');
  if (requireActive && !agency.tieneAccesoActivo) throw ApiError.forbidden('Necesitas una prueba o suscripción activa para preparar propuestas visuales.');
  return { trip, agency };
}

async function currentProposal(trip, agency) {
  const proposal = await VisualProposal.findOne({ trip: trip._id, agency: agency._id, active: true, variantSlot: 1 });
  if (!proposal) throw ApiError.notFound('Este viaje todavía no tiene propuesta visual.');
  return proposal;
}

async function snapshotData(trip, agency, design) {
  const itinerary = await Itinerary.findOne({ trip: trip._id });
  if (!itinerary || !itinerary.days?.length) throw ApiError.conflict('El viaje necesita un itinerario antes de preparar la propuesta.');
  if (itinerary.days.some((day) => day.dayNumber > trip.durationDays)) {
    throw ApiError.conflict('El itinerario tiene días fuera de las fechas del viaje. Revísalos antes de preparar la propuesta.');
  }
  const assets = await loadVisualDesignAssets(design, agency._id);
  return buildVisualProposalData({ trip, itinerary, agency, assets });
}

function previewHash(design, data) {
  return crypto.createHash('sha256').update(JSON.stringify({ design, data })).digest('hex');
}

export const get = asyncHandler(async (req, res) => {
  const { trip, agency } = await context(req);
  const proposal = await VisualProposal.findOne({ trip: trip._id, agency: agency._id, active: true, variantSlot: 1 })
    .select('template templateRevision revision design createdAt updatedAt').lean();
  const issues = proposal ? await VisualProposalIssue.find({ proposal: proposal._id })
    .select('sequence createdAt templateRevision').sort({ sequence: -1 }).lean() : [];
  res.json({ success: true, data: { proposal, issues, canEdit: agency.status !== 'archivada' && agency.tieneAccesoActivo } });
});

export const selectTemplate = asyncHandler(async (req, res) => {
  const { trip, agency } = await context(req, true);
  await ensureVisualTemplateAllowance(agency);
  const template = await VisualTemplate.findOne({ _id: req.body.templateId, agency: agency._id, status: 'published' });
  if (!template) throw ApiError.notFound('La plantilla publicada no está disponible para tu agencia.');
  let proposal = await VisualProposal.findOne({ trip: trip._id, agency: agency._id, active: true, variantSlot: 1 });
  if (proposal && req.body.revision !== proposal.revision) {
    throw ApiError.conflict('La propuesta cambió en otra pestaña. Actualiza antes de elegir otra plantilla.');
  }
  if (!proposal && req.body.revision > 0) {
    throw ApiError.conflict('La propuesta ya no está disponible. Actualiza la página.');
  }
  if (proposal) {
    proposal.template = template._id;
    proposal.templateRevision = template.revision;
    proposal.design = structuredClone(template.design);
    proposal.markModified('design');
    proposal.revision += 1;
    try { await proposal.save(); }
    catch (err) {
      if (err.name === 'VersionError') throw ApiError.conflict('La propuesta cambió en otra pestaña. Actualiza antes de elegir otra plantilla.');
      throw err;
    }
  } else {
    try {
      proposal = await VisualProposal.create({
        agency: agency._id, trip: trip._id, createdBy: req.user._id,
        template: template._id, templateRevision: template.revision,
        design: structuredClone(template.design),
      });
    } catch (err) {
      if (err.code === 11000) throw ApiError.conflict('Ya se creó una propuesta para este viaje. Actualiza la página.');
      throw err;
    }
  }
  res.json({ success: true, data: { proposal } });
});

export const update = asyncHandler(async (req, res) => {
  const { trip, agency } = await context(req, true);
  const proposal = await currentProposal(trip, agency);
  if (proposal.revision !== req.body.revision) throw ApiError.conflict('La propuesta cambió en otra pestaña. Actualiza antes de guardar.');
  await loadVisualDesignAssets(req.body.design, agency._id);
  proposal.design = req.body.design;
  proposal.markModified('design');
  proposal.revision += 1;
  try { await proposal.save(); }
  catch (err) {
    if (err.name === 'VersionError') throw ApiError.conflict('La propuesta cambió en otra pestaña. Actualiza antes de guardar.');
    throw err;
  }
  res.json({ success: true, data: { proposal } });
});

export const preview = asyncHandler(async (req, res) => {
  const { trip, agency } = await context(req);
  const proposal = await currentProposal(trip, agency);
  const data = await snapshotData(trip, agency, proposal.design);
  const html = renderVisualProposalHtml(proposal.design, data);
  res.json({ success: true, data: { html, proposalRevision: proposal.revision, previewHash: previewHash(proposal.design, data) } });
});

export const issue = asyncHandler(async (req, res) => {
  const { trip, agency } = await context(req, true);
  await ensureVisualTemplateAllowance(agency);
  const proposal = await currentProposal(trip, agency);
  const reply = (record) => res.status(201).json({ success: true, data: { issue: { _id: record._id, sequence: record.sequence } } });
  if (req.body.requestId) {
    const existing = await VisualProposalIssue.findOne({ proposal: proposal._id, requestId: req.body.requestId });
    if (existing) return reply(existing);
  }
  if (proposal.revision !== req.body.revision) throw ApiError.conflict('La propuesta cambió antes de emitir el PDF. Revisa la vista previa.');
  const data = await snapshotData(trip, agency, proposal.design);
  const design = structuredClone(proposal.design);
  if (previewHash(design, data) !== req.body.previewHash) {
    throw ApiError.conflict('El viaje o la propuesta cambió desde la vista previa. Revísala de nuevo antes de emitir.');
  }
  const html = renderVisualProposalHtml(design, data);
  const pdf = await renderVisualPdf(html);
  const current = await VisualProposal.findById(proposal._id).select('revision');
  if (current?.revision !== proposal.revision) throw ApiError.conflict('La propuesta cambió mientras se generaba el PDF. Revísala de nuevo.');
  const freshTrip = await Trip.findById(trip._id);
  if (!freshTrip) throw ApiError.conflict('El viaje se eliminó mientras se generaba el PDF.');
  const freshAgency = await Agency.findById(agency._id);
  if (!freshAgency || freshAgency.status === 'archivada' || !freshAgency.tieneAccesoActivo ||
    String(freshTrip.agency) !== String(agency._id) || !await User.exists({ _id: req.user._id, agency: agency._id })) {
    throw ApiError.conflict('El acceso a la agencia cambió mientras se generaba el PDF. Actualiza la página.');
  }
  await ensureVisualTemplateAllowance(freshAgency);
  const freshData = await snapshotData(freshTrip, freshAgency, design);
  if (previewHash(design, freshData) !== req.body.previewHash) {
    throw ApiError.conflict('El viaje cambió mientras se generaba el PDF. Revísalo de nuevo.');
  }
  const latest = await VisualProposalIssue.findOne({ proposal: proposal._id }).sort({ sequence: -1 }).select('sequence').lean();
  const archived = await archiveVisualPdf(pdf, { agencyId: agency._id, tripId: trip._id, proposalId: proposal._id });
  let issueRecord;
  try {
    issueRecord = await VisualProposalIssue.create({
      agency: agency._id, trip: trip._id, proposal: proposal._id,
      sequence: (latest?.sequence || 0) + 1, issuedBy: req.user._id,
      requestId: req.body.requestId,
      templateRevision: proposal.templateRevision, design, data,
      pdfFileId: archived.fileId, pdfSha256: archived.sha256, pdfBytes: archived.bytes,
    });
  } catch (err) {
    await deleteArchivedVisualPdf(archived.fileId).catch(() => {});
    if (err.code === 11000 && req.body.requestId) {
      const existing = await VisualProposalIssue.findOne({ proposal: proposal._id, requestId: req.body.requestId });
      if (existing) return reply(existing);
    }
    if (err.code === 11000) throw ApiError.conflict('Se emitió otra revisión al mismo tiempo. Actualiza la lista.');
    throw err;
  }
  reply(issueRecord);
});

export const download = asyncHandler(async (req, res) => {
  const { trip, agency } = await context(req);
  if (!mongoose.isValidObjectId(req.params.issueId)) throw ApiError.notFound('Versión no encontrada.');
  const issueRecord = await VisualProposalIssue.findOne({ _id: req.params.issueId, trip: trip._id, agency: agency._id });
  if (!issueRecord) throw ApiError.notFound('Versión no encontrada.');
  const pdf = await readArchivedVisualPdf(issueRecord.pdfFileId);
  if (crypto.createHash('sha256').update(pdf).digest('hex') !== issueRecord.pdfSha256) {
    throw ApiError.serviceUnavailable('El PDF archivado no coincide con la versión emitida.');
  }
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="propuesta-rumbia-v${issueRecord.sequence}.pdf"`,
    'Content-Length': String(pdf.length),
    'Cache-Control': 'private, no-store',
  });
  res.send(pdf);
});
