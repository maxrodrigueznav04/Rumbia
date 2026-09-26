import { readFileSync } from 'node:fs';
import { VISUAL_ART_IDS } from '../validators/visualTemplate.js';

const art = new Map(VISUAL_ART_IDS.map((id) => [
  id,
  readFileSync(new URL(`../../assets/visual-presets/${id}.jpg`, import.meta.url)),
]));

export function visualPresetArt(id) {
  return art.get(id) || null;
}

export function visualPresetArtDataUri(id) {
  const bytes = visualPresetArt(id);
  return bytes ? `data:image/jpeg;base64,${bytes.toString('base64')}` : null;
}
