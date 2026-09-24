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
  const taken = new Set(used.map((entry) => entry.activeSlot));
  for (let slot = 1; slot <= limit; slot += 1) if (!taken.has(slot)) return slot;
  throw ApiError.conflict(`Tu plan permite ${limit} plantilla(s) visual(es) activa(s). Archiva una para crear otra.`);
}

export function visualTemplateCanEdit(agency, user) {
  return Boolean(agency && String(agency.owner) === String(user._id));
}
