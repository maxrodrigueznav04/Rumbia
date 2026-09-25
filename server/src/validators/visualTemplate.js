import { z } from 'zod';

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const coordinate = z.number().finite().min(0).max(1000);
const field = z.enum([
  'trip.title', 'trip.destination', 'trip.dates', 'trip.travelers',
  'agency.name', 'agency.contact', 'proposal.price',
]);

export const VISUAL_PRESET_IDS = [
  'editorial', 'minimal', 'aventura', 'romance', 'familia', 'lujo', 'costa',
  'ciudad', 'naturaleza', 'sabores', 'celebracion', 'ruta', 'bienestar',
];

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
  presetId: z.enum(VISUAL_PRESET_IDS).optional(),
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
  if (Object.hasOwn(SALES_PRESETS, id)) return salesPresetDesign(SALES_PRESETS[id]);
  throw new Error('Diseño predeterminado desconocido.');
}

const fieldElement = (id, fieldName, x, y, width, height, colorValue, fontSize, extra = {}) => ({
  id, type: 'field', field: fieldName, x, y, width, height,
  style: { color: colorValue, fontSize, ...extra },
});
const textElement = (id, text, x, y, width, height, colorValue, fontSize, extra = {}) => ({
  id, type: 'text', text, x, y, width, height,
  style: { color: colorValue, fontSize, ...extra },
});
const shapeElement = (id, x, y, width, height, background) => ({
  id, type: 'shape', x, y, width: Math.max(width, 10), height: Math.max(height, 10), style: { background },
});

// El texto comercial invita a conversar; no afirma disponibilidad, inclusiones ni descuentos.
const SALES_PRESETS = {
  romance: { layout: 'frame', background: '#fff6f1', ink: '#542d3c', accent: '#ca766e', soft: '#f3d4c7', muted: '#855f68', headingFont: 'editorial', kicker: 'UN VIAJE PARA DOS', intro: 'El tiempo juntos empieza aquí', copy: 'Una propuesta para imaginar lo que viene y disfrutar cada momento a su ritmo.', cta: '¿Lo hacemos realidad? Hablemos de los detalles.', itinerary: 'Momentos para compartir' },
  familia: { layout: 'tiles', background: '#fff9ed', ink: '#173c4a', accent: '#e27a55', soft: '#83bdb4', muted: '#526b72', headingFont: 'modern', kicker: 'RECUERDOS EN FAMILIA', intro: 'La próxima historia que contarán juntos', copy: 'Un plan para descubrir, reír y tener tiempo de disfrutar en compañía.', cta: '¿Les gusta este plan? Revisemos juntos los detalles.', itinerary: 'Un día a la vez, juntos' },
  lujo: { layout: 'frame', background: '#f6f1e7', ink: '#25252b', accent: '#a47b45', soft: '#d9c6a3', muted: '#69635c', headingFont: 'classic', kicker: 'UNA EXPERIENCIA A TU MEDIDA', intro: 'Cada detalle cuenta', copy: 'Una propuesta para viajar con intención y dedicar tiempo a lo que más disfrutas.', cta: 'Conversemos sobre los detalles de tu viaje.', itinerary: 'El arte de viajar' },
  costa: { layout: 'split', background: '#f8f4e9', ink: '#123f53', accent: '#167f89', soft: '#d4e6df', muted: '#527078', headingFont: 'editorial', kicker: 'EL MAR TE ESPERA', intro: 'Días para cambiar de ritmo', copy: 'Una invitación a disfrutar el destino, con espacio para parar y mirar alrededor.', cta: 'Si te ves ahí, hablemos para darle forma.', itinerary: 'Días junto al mar' },
  ciudad: { layout: 'poster', background: '#222d3b', ink: '#222d3b', accent: '#ed765b', soft: '#e8d6be', muted: '#65727e', headingFont: 'modern', kicker: 'TU PRÓXIMA ESCAPADA', intro: 'Una ciudad, muchas maneras de vivirla', copy: 'Calles, sabores y momentos para descubrir a tu manera.', cta: '¿La recorremos? Revisemos el siguiente paso.', itinerary: 'La ciudad, día a día' },
  naturaleza: { layout: 'offset', background: '#f5f4e9', ink: '#254439', accent: '#9aaf73', soft: '#dae4c6', muted: '#5e7666', headingFont: 'editorial', kicker: 'VUELVE A LO ESENCIAL', intro: 'Un viaje para respirar distinto', copy: 'Tiempo para explorar, detenerse y conectar con cada lugar.', cta: '¿Te imaginas aquí? Conversemos sobre el plan.', itinerary: 'El camino, día a día' },
  sabores: { layout: 'banner', background: '#692f3c', ink: '#542b36', accent: '#d8a572', soft: '#f2dfc7', muted: '#796069', headingFont: 'classic', kicker: 'SABORES QUE SE RECUERDAN', intro: 'El destino también se descubre en la mesa', copy: 'Un recorrido para probar, conversar y recordar cada parada.', cta: '¿Te abre el apetito? Planeemos los detalles.', itinerary: 'Un recorrido para saborear' },
  celebracion: { layout: 'poster', background: '#402c52', ink: '#402c52', accent: '#d7b779', soft: '#f1e5d7', muted: '#736780', headingFont: 'editorial', kicker: 'HAY VIAJES QUE SE CELEBRAN', intro: 'Una ocasión para recordar', copy: 'Porque algunos momentos merecen un escenario nuevo y tiempo para disfrutarlos.', cta: 'Cuéntanos qué celebras y afinamos el viaje.', itinerary: 'Los momentos de tu viaje' },
  ruta: { layout: 'tiles', background: '#f5ede1', ink: '#293e4a', accent: '#bb6948', soft: '#d9ba96', muted: '#697077', headingFont: 'modern', kicker: 'EL VIAJE EMPIEZA EN EL CAMINO', intro: 'Cada parada tiene algo que contar', copy: 'Una ruta para disfrutar el trayecto tanto como el destino.', cta: '¿Listos para partir? Hablemos del recorrido.', itinerary: 'La ruta, paso a paso' },
  bienestar: { layout: 'split', background: '#f4f3ef', ink: '#374b47', accent: '#987da1', soft: '#d9e0d3', muted: '#6e7b76', headingFont: 'classic', kicker: 'TIEMPO PARA TI', intro: 'Haz espacio para lo que te hace bien', copy: 'Una propuesta para bajar el ritmo y disfrutar el viaje a tu manera.', cta: 'Si este plan resuena contigo, conversemos.', itinerary: 'A tu propio ritmo' },
};

function salesCover(preset) {
  const { layout, background, ink, accent, soft, kicker } = preset;
  const light = ['poster', 'banner'].includes(layout);
  const foreground = light ? '#ffffff' : ink;
  const secondary = light ? soft : accent;
  const elements = [];
  if (layout === 'frame') elements.push(
    shapeElement('frame-top', 55, 45, 890, 7, accent),
    shapeElement('frame-left', 55, 45, 7, 900, accent),
    shapeElement('frame-bottom', 55, 938, 890, 7, accent),
  );
  if (layout === 'split') elements.push(
    shapeElement('split-panel', 0, 0, 340, 1000, ink),
    shapeElement('split-rule', 340, 0, 10, 1000, accent),
    shapeElement('split-corner', 785, 85, 135, 135, soft),
  );
  if (layout === 'tiles') elements.push(
    shapeElement('tile-top', 640, 0, 360, 245, soft),
    shapeElement('tile-side', 0, 590, 110, 410, accent),
    shapeElement('tile-line', 155, 365, 170, 10, accent),
  );
  if (layout === 'poster') elements.push(
    shapeElement('poster-top', 0, 0, 1000, 26, accent),
    shapeElement('poster-side', 760, 160, 175, 490, accent),
    shapeElement('poster-cut', 800, 195, 135, 420, background),
    shapeElement('poster-bottom', 70, 950, 860, 10, soft),
  );
  if (layout === 'offset') elements.push(
    shapeElement('offset-side', 0, 0, 205, 1000, ink),
    shapeElement('offset-top', 250, 165, 655, 12, accent),
    shapeElement('offset-square', 720, 165, 185, 185, soft),
  );
  if (layout === 'banner') elements.push(
    shapeElement('banner-top', 0, 0, 1000, 215, accent),
    shapeElement('banner-rule', 70, 575, 215, 9, soft),
    shapeElement('banner-bottom', 0, 945, 1000, 55, ink),
  );
  const left = layout === 'split' ? 410 : layout === 'offset' ? 265 : layout === 'tiles' ? 155 : 80;
  const width = layout === 'split' ? 525 : layout === 'offset' ? 650 : layout === 'tiles' ? 760 : 835;
  const titleY = layout === 'banner' ? 625 : layout === 'poster' ? 635 : layout === 'frame' ? 555 : 525;
  const destinationY = ['poster', 'banner'].includes(layout) ? 835 : titleY + 225;
  const datesY = ['poster', 'banner'].includes(layout) ? 900 : 865;
  const agencyColor = layout === 'banner' ? ink : foreground;
  elements.push(
    fieldElement('agency', 'agency.name', left, 75, width, 55, agencyColor, 18, { weight: 'bold' }),
    textElement('kicker', kicker, left, titleY - 120, width, 60, secondary, 15, { weight: 'bold' }),
    fieldElement('title', 'trip.title', left, titleY, width, 190, foreground, layout === 'split' ? 45 : 51),
    fieldElement('destination', 'trip.destination', left, destinationY, width, ['poster', 'banner'].includes(layout) ? 55 : 75, foreground, 20),
    fieldElement('dates', 'trip.dates', left, datesY, width, 35, secondary, 13),
  );
  return { id: 'cover', label: 'Portada', kind: 'cover', background, elements };
}

function salesIntro(preset) {
  const { ink, accent, soft, muted, intro, copy, cta } = preset;
  return { id: 'intro', label: 'Presentación', kind: 'narrative', background: '#fffdf9', elements: [
    shapeElement('intro-top', 0, 0, 1000, 18, accent),
    fieldElement('intro-agency', 'agency.name', 75, 65, 800, 45, muted, 14, { weight: 'bold' }),
    textElement('intro-heading', intro, 75, 145, 850, 135, ink, 38),
    textElement('intro-copy', copy, 75, 315, 850, 100, muted, 19),
    shapeElement('intro-rule', 75, 435, 160, 8, accent),
    { id: 'intro-highlights', type: 'highlights', x: 75, y: 475, width: 850, height: 230, style: { background: ink, color: '#ffffff' } },
    textElement('price-label', 'Tu propuesta', 75, 745, 800, 36, muted, 13, { weight: 'bold' }),
    fieldElement('intro-price', 'proposal.price', 75, 785, 850, 70, ink, 32),
    shapeElement('cta-panel', 75, 865, 850, 70, soft),
    textElement('intro-cta', cta, 100, 882, 790, 42, ink, 17, { weight: 'bold' }),
    fieldElement('intro-contact', 'agency.contact', 75, 955, 850, 30, muted, 12),
  ] };
}

function salesPresetDesign(preset) {
  return {
    schemaVersion: 1, pageSize: 'A4',
    theme: { ink: preset.ink, accent: preset.accent, muted: preset.muted, headingFont: preset.headingFont, bodyFont: 'modern' },
    pages: [salesCover(preset), salesIntro(preset)],
    itinerary: { accent: preset.accent, heading: preset.itinerary, headingFontSize: 30, dayFontSize: 18, bodyFontSize: 8, showTimes: true, showDescriptions: true },
  };
}
