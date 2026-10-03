import env from '../config/env.js';

// Production stays closed until individual agency IDs (or an explicit *) are set.
export function hasVisualTemplateAccess(agency, config = env) {
  const id = agency?._id || agency;
  if (!config.visualTemplatesEnabled || !id) return false;
  const allowed = config.visualTemplateAgencies;
  return allowed.includes('*') || allowed.includes(String(id));
}
