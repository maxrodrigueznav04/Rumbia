import ApiError from '../utils/ApiError.js';
import VisualTemplate from '../models/VisualTemplate.js';

export function visualTemplateLimit(agency) {
  if (!agency?.tieneAccesoActivo) return 0;
  if (agency.esTrialActivo) return 1;
  const plan = agency.billing?.plan || '';
  if (plan.startsWith('inicio')) return 1;
  if (plan.startsWith('pro')) return 15;
  if (plan.startsWith('agencia') || ['mensual', 'anual', 'vitalicio'].includes(plan)) return 5;
  return 0;
}

export async function freeVisualTemplateSlot(agency) {
  const limit = visualTemplateLimit(agency);
  if (!limit) throw ApiError.forbidden('Tu agencia necesita una prueba o suscripción activa para crear plantillas visuales.');
  const used = await VisualTemplate.find({ agency: agency._id, activeSlot: { $ne: null } }).select('activeSlot').lean();
  if (used.length >= limit) throw ApiError.conflict(`Tu plan permite ${limit} plantilla(s) visual(es) activa(s). Archiva una para crear otra.`);
  const taken = new Set(used.map((entry) => entry.activeSlot));
  for (let slot = 1; slot <= limit; slot += 1) if (!taken.has(slot)) return slot;
  // Al bajar de plan, una plantilla conservada puede ocupar una posición alta.
  // La posición solo evita creaciones simultáneas; el cupo lo decide el conteo.
  for (let slot = limit + 1; slot <= 15; slot += 1) if (!taken.has(slot)) return slot;
  throw ApiError.conflict('No hay posiciones disponibles para otra plantilla visual.');
}

export async function ensureVisualTemplateAllowance(agency) {
  const limit = visualTemplateLimit(agency);
  const active = await VisualTemplate.countDocuments({ agency: agency._id, activeSlot: { $ne: null } });
  if (active > limit) {
    throw ApiError.conflict(`Tu plan permite ${limit} plantilla(s) visual(es) activa(s). Archiva ${active - limit} antes de emitir propuestas nuevas.`);
  }
}

export function visualTemplateCanEdit(agency, user) {
  return Boolean(agency && String(agency.owner) === String(user._id));
}
