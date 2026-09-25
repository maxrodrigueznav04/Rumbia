import { z } from 'zod';

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const coordinate = z.number().finite().min(0).max(1000);
const field = z.enum([
  'trip.title', 'trip.destination', 'trip.dates', 'trip.travelers',
  'agency.name', 'agency.contact', 'proposal.price',
]);

const element = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/),
  type: z.enum(['text', 'field', 'shape', 'image', 'highlights']),
  field: field.optional(),
  text: z.string().max(700).optional(),
  assetId: z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
  x: coordinate,
  y: coordinate,
  width: coordinate.min(10),
  height: coordinate.min(10),
  style: z.object({
    color: color.optional(),
    background: color.optional(),
    fontSize: z.number().finite().min(7).max(80).optional(),
    align: z.enum(['left', 'center', 'right']).optional(),
    weight: z.enum(['normal', 'bold']).optional(),
  }).strict().default({}),
}).strict().superRefine((value, ctx) => {
  if (value.x + value.width > 1000 || value.y + value.height > 1000) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'El elemento sale de la página.' });
  }
  if (value.type === 'field' && !value.field) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecciona un campo permitido.' });
  }
  if (value.type === 'image' && !value.assetId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'La imagen debe pertenecer a la biblioteca de la agencia.' });
  }
});

const page = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/),
  label: z.string().trim().min(1).max(60),
  kind: z.enum(['cover', 'narrative']),
  background: color,
  elements: z.array(element).max(50),
}).strict().superRefine((value, ctx) => {
  const ids = value.elements.map((item) => item.id);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Hay elementos repetidos.' });
});

export const visualDesignSchema = z.object({
  schemaVersion: z.literal(1),
  pageSize: z.literal('A4'),
  theme: z.object({
    ink: color,
    accent: color,
    muted: color,
    headingFont: z.enum(['editorial', 'modern', 'classic']),
    bodyFont: z.enum(['modern', 'classic']),
  }).strict(),
  pages: z.array(page).min(1).max(5),
  itinerary: z.object({
    accent: color,
    heading: z.string().trim().min(1).max(80).default('El viaje, día a día'),
    headingFontSize: z.number().finite().min(18).max(40).default(30),
    dayFontSize: z.number().finite().min(12).max(28).default(18),
    bodyFontSize: z.number().finite().min(7).max(14).default(8),
    showTimes: z.boolean(),
    showDescriptions: z.boolean(),
  }).strict(),
}).strict().superRefine((value, ctx) => {
  const ids = value.pages.map((item) => item.id);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Hay páginas repetidas.' });
  if (value.pages[0]?.kind !== 'cover') ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'La primera página debe ser la portada.' });
  const imageCount = value.pages.flatMap((item) => item.elements).filter((item) => item.type === 'image').length;
  if (imageCount > 10) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Máximo 10 imágenes por plantilla.' });
});

export const createVisualTemplateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  design: visualDesignSchema.optional(),
  presetId: z.enum(['editorial', 'minimal', 'aventura']).optional(),
  status: z.enum(['draft', 'published']).optional(),
}).strict().refine((value) => !value.design || !value.presetId, {
  message: 'Elige un diseño predeterminado o envía uno propio.',
});

export const updateVisualTemplateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  design: visualDesignSchema.optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  revision: z.number().int().positive(),
}).strict().refine((value) => value.name !== undefined || value.design !== undefined || value.status !== undefined, {
  message: 'No hay cambios para guardar.',
});

export const selectVisualTemplateSchema = z.object({
  templateId: z.string().regex(/^[a-fA-F0-9]{24}$/),
}).strict();

export const updateVisualProposalSchema = z.object({
  design: visualDesignSchema,
  revision: z.number().int().positive(),
}).strict();

export const issueVisualProposalSchema = z.object({
  revision: z.number().int().positive(),
  previewHash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

export function defaultVisualDesign() {
  return {
    schemaVersion: 1,
    pageSize: 'A4',
    theme: { ink: '#172b48', accent: '#bc6954', muted: '#5e6c7d', headingFont: 'editorial', bodyFont: 'modern' },
    pages: [
      { id: 'cover', label: 'Portada', kind: 'cover', background: '#172b48', elements: [
        { id: 'agency', type: 'field', field: 'agency.name', x: 70, y: 65, width: 490, height: 65, style: { color: '#ffffff', fontSize: 20, weight: 'bold' } },
        { id: 'dates', type: 'field', field: 'trip.dates', x: 70, y: 615, width: 650, height: 35, style: { color: '#f1b99c', fontSize: 12 } },
        { id: 'title', type: 'field', field: 'trip.title', x: 70, y: 665, width: 850, height: 165, style: { color: '#ffffff', fontSize: 54 } },
        { id: 'destination', type: 'field', field: 'trip.destination', x: 70, y: 850, width: 760, height: 55, style: { color: '#ffffff', fontSize: 20 } },
      ] },
      { id: 'intro', label: 'Presentación', kind: 'narrative', background: '#ffffff', elements: [
        { id: 'intro-heading', type: 'text', text: 'Un viaje pensado para ti', x: 70, y: 95, width: 820, height: 105, style: { color: '#172b48', fontSize: 42 } },
        { id: 'intro-destination', type: 'field', field: 'trip.destination', x: 70, y: 235, width: 820, height: 60, style: { color: '#bc6954', fontSize: 25 } },
        { id: 'intro-dates', type: 'field', field: 'trip.dates', x: 70, y: 320, width: 820, height: 45, style: { color: '#5e6c7d', fontSize: 18 } },
        { id: 'intro-highlights', type: 'highlights', x: 70, y: 410, width: 860, height: 270, style: { background: '#172b48', color: '#ffffff' } },
        { id: 'intro-price', type: 'field', field: 'proposal.price', x: 70, y: 760, width: 820, height: 75, style: { color: '#172b48', fontSize: 34 } },
      ] },
    ],
    itinerary: { accent: '#bc6954', heading: 'El viaje, día a día', headingFontSize: 30, dayFontSize: 18, bodyFontSize: 8, showTimes: true, showDescriptions: true },
  };
}

export const VISUAL_PRESET_IDS = ['editorial', 'minimal', 'aventura'];

export function visualPresetDesign(id) {
  const design = defaultVisualDesign();
  if (id === 'editorial') return design;
  if (id === 'minimal') {
    design.theme = { ink: '#253744', accent: '#a97054', muted: '#65747a', headingFont: 'modern', bodyFont: 'modern' };
    design.pages[0] = { id: 'cover', label: 'Portada', kind: 'cover', background: '#f7f5ef', elements: [
      { id: 'agency', type: 'field', field: 'agency.name', x: 70, y: 65, width: 680, height: 55, style: { color: '#253744', fontSize: 18, weight: 'bold' } },
      { id: 'accent-line', type: 'shape', x: 70, y: 370, width: 160, height: 10, style: { background: '#a97054' } },
      { id: 'dates', type: 'field', field: 'trip.dates', x: 70, y: 440, width: 750, height: 40, style: { color: '#a97054', fontSize: 13 } },
      { id: 'title', type: 'field', field: 'trip.title', x: 70, y: 515, width: 860, height: 235, style: { color: '#253744', fontSize: 52 } },
      { id: 'destination', type: 'field', field: 'trip.destination', x: 70, y: 790, width: 820, height: 70, style: { color: '#65747a', fontSize: 22 } },
      { id: 'bottom-line', type: 'shape', x: 70, y: 930, width: 860, height: 10, style: { background: '#253744' } },
    ] };
    design.pages[1].background = '#ffffff';
    design.pages[1].elements.find((item) => item.id === 'intro-heading').style.color = '#253744';
    design.pages[1].elements.find((item) => item.id === 'intro-destination').style.color = '#a97054';
    design.pages[1].elements.find((item) => item.id === 'intro-highlights').style.background = '#253744';
    design.pages[1].elements.find((item) => item.id === 'intro-price').style.color = '#253744';
    design.itinerary.accent = '#a97054';
    return design;
  }
  if (id === 'aventura') {
    design.theme = { ink: '#173e3b', accent: '#d9a957', muted: '#5e716b', headingFont: 'editorial', bodyFont: 'modern' };
    design.pages[0] = { id: 'cover', label: 'Portada', kind: 'cover', background: '#173e3b', elements: [
      { id: 'top-band', type: 'shape', x: 0, y: 0, width: 1000, height: 20, style: { background: '#d9a957' } },
      { id: 'agency', type: 'field', field: 'agency.name', x: 70, y: 70, width: 700, height: 60, style: { color: '#ffffff', fontSize: 20, weight: 'bold' } },
      { id: 'accent-line', type: 'shape', x: 70, y: 535, width: 180, height: 10, style: { background: '#d9a957' } },
      { id: 'dates', type: 'field', field: 'trip.dates', x: 70, y: 580, width: 700, height: 40, style: { color: '#e7c88d', fontSize: 13 } },
      { id: 'title', type: 'field', field: 'trip.title', x: 70, y: 650, width: 860, height: 180, style: { color: '#ffffff', fontSize: 50 } },
      { id: 'destination', type: 'field', field: 'trip.destination', x: 70, y: 860, width: 820, height: 65, style: { color: '#e7e9d6', fontSize: 21 } },
    ] };
    design.pages[1].background = '#f8f6ee';
    design.pages[1].elements.find((item) => item.id === 'intro-heading').style.color = '#173e3b';
    design.pages[1].elements.find((item) => item.id === 'intro-destination').style.color = '#a66a3c';
    design.pages[1].elements.find((item) => item.id === 'intro-highlights').style.background = '#173e3b';
    design.pages[1].elements.find((item) => item.id === 'intro-price').style.color = '#173e3b';
    design.itinerary.accent = '#a66a3c';
    return design;
  }
  throw new Error('Diseño predeterminado desconocido.');
}
