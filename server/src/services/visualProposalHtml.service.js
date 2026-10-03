import { fittedFieldFontSize } from './visualFieldSizing.js';
import { visualPresetArtDataUri } from './visualPresetArt.service.js';
import { visualFontCss } from './visualFonts.service.js';
import ApiError from '../utils/ApiError.js';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

const headingFont = { editorial: "'Playfair Display', serif", classic: "'Libre Baskerville', serif", modern: "'Work Sans', sans-serif" };
const bodyFont = { modern: "'Work Sans', sans-serif", classic: "'Libre Baskerville', serif" };
const mmX = (n) => `${(n / 1000 * 210).toFixed(3)}mm`;
const mmY = (n) => `${(n / 1000 * 297).toFixed(3)}mm`;
const pt = (n) => `${n || 18}pt`;

function fixedElement(element, page, data, design) {
  const style = element.style || {};
  const box = `left:${mmX(element.x)};top:${mmY(element.y)};width:${mmX(element.width)};height:${mmY(element.height)};`;
  if (element.type === 'image') {
    const asset = data.assets[element.assetId];
    if (!asset) return '';
    return `<div class="fixed-element image" style="${box}"><img src="${esc(asset.url)}" alt="" style="${page.kind === 'cover' ? 'filter:brightness(.58);' : ''}"></div>`;
  }
  if (element.type === 'artwork') {
    const src = (element.assetId && data.assets[element.assetId]?.url) || visualPresetArtDataUri(element.artId);
    if (!src) return '';
    return `<div class="fixed-element artwork" style="${box}"><img src="${esc(src)}" alt="">${style.overlay ? '<span class="artwork-shade"></span>' : ''}</div>`;
  }
  if (element.type === 'shape') return `<div class="fixed-element" style="${box}background:${style.background || design.theme.accent};"></div>`;
  if (element.type === 'highlights') {
    const items = data.highlights.slice(0, 3).map((item) => `<div><small>${esc(item.date)}</small><strong>${esc(item.title)}</strong><p>${esc(item.summary)}</p></div>`).join('');
    return `<div class="fixed-element highlights${style.layout === 'stack' ? ' stack' : ''}" style="${box}background:${style.background || design.theme.ink};color:${style.color || '#ffffff'};">${items}</div>`;
  }
  const text = element.type === 'field' ? data.fields[element.field] : element.text;
  const font = (style.fontSize || 18) >= 25 ? headingFont[design.theme.headingFont] : bodyFont[design.theme.bodyFont];
  const fontSize = fittedFieldFontSize(element, text);
  return `<div class="fixed-element text" style="${box}color:${style.color || design.theme.ink};font:${style.weight === 'bold' ? 'bold ' : ''}${pt(fontSize)} ${font};text-align:${style.align || 'left'};">${esc(text)}</div>`;
}

export function renderVisualProposalHtml(design, data) {
  const itinerary = design.itinerary;
  for (const page of design.pages) {
    const hasContent = page.elements.some((element) =>
      ['image', 'artwork'].includes(element.type) ||
      (element.type === 'highlights' && data.highlights.length > 0) ||
      (['text', 'field'].includes(element.type) && String(element.type === 'field' ? data.fields[element.field] || '' : element.text || '').trim()));
    if (!hasContent) throw ApiError.badRequest(`La página "${page.label}" no tiene texto ni imagen. Complétala o elimínala antes de emitir.`);
  }
  const pages = design.pages.map((page) => `<section class="fixed-page" style="background:${page.background};">${page.elements.map((element) => fixedElement(element, page, data, design)).join('')}</section>`).join('');
  const days = data.days.map((day) => `<article class="day">
    <div class="day-number">${String(day.number).padStart(2, '0')}</div>
    <div class="day-body"><div class="day-date">${esc(day.date)}</div><h2>${esc(day.title)}</h2>
    ${day.summary ? `<p class="day-summary">${esc(day.summary)}</p>` : ''}
    <div class="activities">${day.activities.map((activity) => `<div class="activity${design.itinerary.showTimes && activity.time ? ' with-time' : ''}">${design.itinerary.showTimes && activity.time ? `<time>${esc(activity.time)}</time>` : ''}<div><strong>${esc(activity.title)}</strong>${design.itinerary.showDescriptions && activity.description ? `<p>${esc(activity.description)}</p>` : ''}</div></div>`).join('')}</div>
    </div></article>`).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(data.fields['trip.title'])}</title><style>
    ${visualFontCss()}
    @page fixed { size:A4; margin:0; }
    @page itinerary { size:A4; margin:14mm; }
    * { box-sizing:border-box; }
    html,body { margin:0; background:white; color:${design.theme.ink}; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .fixed-page { page:fixed; width:210mm; height:297mm; position:relative; break-after:page; page-break-after:always; overflow:hidden; }
    .fixed-element { position:absolute; overflow:hidden; }
    .fixed-element.text { white-space:pre-wrap; line-height:1.12; }
    .fixed-element.image img { display:block; width:100%; height:100%; object-fit:cover; }
    .fixed-element.artwork img { display:block; width:100%; height:100%; object-fit:cover; }
    .artwork-shade { position:absolute; inset:0; background:linear-gradient(180deg,rgba(6,17,27,0) 30%,rgba(6,17,27,.18) 52%,rgba(6,17,27,.82) 100%); }
    .highlights { display:grid; grid-template-columns:repeat(3,1fr); gap:4mm; padding:7mm; font:9pt ${bodyFont[design.theme.bodyFont]}; }
    .highlights>div { border-left:1px solid #ffffff88; padding-left:4mm; }
    .highlights.stack { grid-template-columns:1fr; grid-template-rows:repeat(3,minmax(0,1fr)); gap:0; padding:5mm 7mm; }
    .highlights.stack>div { border-left:0; border-top:1px solid #ffffff88; padding:3mm 0 0; overflow:hidden; }
    .highlights.stack strong { font-size:13pt; }
    .highlights.stack small { margin-bottom:2mm; }
    .highlights.stack p { margin-top:2mm; }
    .highlights small { display:block; font:7pt ${bodyFont[design.theme.bodyFont]}; letter-spacing:.12em; margin-bottom:7mm; text-transform:uppercase; }
    .highlights strong { display:block; font:16pt ${headingFont[design.theme.headingFont]}; line-height:1.15; }
    .highlights p { font:8pt/1.45 ${bodyFont[design.theme.bodyFont]}; margin:4mm 0 0; }
    .itinerary { page:itinerary; font-family:${bodyFont[design.theme.bodyFont]}; }
    .itinerary-heading { border-bottom:1px solid #d8dfe5; padding-bottom:5mm; margin-bottom:10mm; }
    .itinerary-heading small { font:7pt ${bodyFont[design.theme.bodyFont]}; letter-spacing:.12em; text-transform:uppercase; }
    .itinerary-heading h1 { font:${itinerary.headingFontSize || 30}pt ${headingFont[design.theme.headingFont]}; margin:5mm 0 0; }
    .day { display:grid; grid-template-columns:20mm 1fr; gap:5mm; margin-bottom:9mm; break-inside:avoid; page-break-inside:avoid; }
    .day-number { border-top:2px solid ${design.itinerary.accent}; padding-top:2mm; font:24pt ${headingFont[design.theme.headingFont]}; color:${design.itinerary.accent}; }
    .day-body, .activity>div { min-width:0; overflow-wrap:anywhere; }
    .day-date { font-size:7pt; color:${design.theme.muted}; text-transform:uppercase; letter-spacing:.08em; }
    .day h2 { font:${itinerary.dayFontSize || 18}pt ${headingFont[design.theme.headingFont]}; margin:2mm 0 3mm; break-after:avoid; }
    .day-summary { font:9pt/1.45 ${bodyFont[design.theme.bodyFont]}; color:${design.theme.muted}; margin:0 0 4mm; }
    .activity { display:grid; grid-template-columns:1fr; gap:3mm; border-top:1px solid #e2e6ea; padding:2.5mm 0; break-inside:avoid; page-break-inside:avoid; font-size:${itinerary.bodyFontSize || 8}pt; }
    .activity.with-time { grid-template-columns:15mm 1fr; }
    .activity time { color:${design.itinerary.accent}; font-weight:bold; }
    .activity p { margin:1mm 0 0; color:${design.theme.muted}; line-height:1.4; }
    .credit { border-top:1px solid #d8dfe5; padding-top:5mm; margin-top:12mm; color:${design.theme.muted}; font-size:7pt; }
  </style></head><body>${pages}<section class="itinerary"><header class="itinerary-heading"><small>${esc(data.fields['agency.name'])} · ${esc(data.fields['trip.dates'])}</small><h1>${esc(itinerary.heading || 'El viaje, día a día')}</h1></header>${days}${data.showBrandCredit ? '<footer class="credit">Propuesta creada con Rumbia</footer>' : ''}</section></body></html>`;
}
