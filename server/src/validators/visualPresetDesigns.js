export const VISUAL_PRESET_IDS = [
  'editorial', 'minimal', 'aventura', 'romance', 'familia', 'lujo', 'costa',
  'ciudad', 'naturaleza', 'sabores', 'celebracion', 'ruta', 'bienestar',
];
export const VISUAL_ART_IDS = ['horizon', 'city', 'journal', 'arch', 'forest', 'dinner'];

const field = (id, name, x, y, width, height, color, fontSize, extra = {}) => ({
  id, type: 'field', field: name, x, y, width, height, style: { color, fontSize, ...extra },
});
const text = (id, value, x, y, width, height, color, fontSize, extra = {}) => ({
  id, type: 'text', text: value, x, y, width, height, style: { color, fontSize, ...extra },
});
const shape = (id, x, y, width, height, background) => ({
  id, type: 'shape', x, y, width, height, style: { background },
});
const art = (id, artId, x, y, width, height, overlay = false) => ({
  id, type: 'artwork', artId, x, y, width, height, style: { overlay },
});
const highlights = (x, y, width, height, background, layout = 'columns') => ({
  id: 'intro-highlights', type: 'highlights', x, y, width, height,
  style: { background, color: '#ffffff', layout },
});

const PRESETS = {
  editorial: { cover: 'immersive', introLayout: 'editorial', artId: 'horizon', background: '#f8f7f3', ink: '#182d46', accent: '#c4775c', soft: '#eee4d8', muted: '#637285', headingFont: 'editorial', kicker: 'PARA REVISAR CONTIGO', intro: 'Así imaginamos el viaje', copy: 'Te compartimos una primera ruta. Mírala con calma; si algo no encaja, lo cambiamos antes de reservar.', cta: 'Si te gusta, revisamos disponibilidad.', itinerary: 'Los días del viaje' },
  minimal: { cover: 'folio', introLayout: 'letter', artId: 'journal', background: '#f7f5ee', ink: '#283a42', accent: '#aa8064', soft: '#ebe5da', muted: '#69787b', headingFont: 'modern', kicker: 'ITINERARIO Y PRESUPUESTO', intro: 'Un plan claro, sin vueltas', copy: 'Aquí están los días y el precio para que puedas decidir con toda la información a la vista.', cta: 'Dinos qué cambiarías y lo ajustamos.', itinerary: 'El itinerario' },
  aventura: { cover: 'window', introLayout: 'bold', artId: 'forest', background: '#f1f3eb', ink: '#173e39', accent: '#b89258', soft: '#dde8d8', muted: '#61766c', headingFont: 'editorial', kicker: 'RUTA PROPUESTA', intro: 'La ruta empieza a tomar forma', copy: 'Ordenamos las paradas para que te hagas una idea del recorrido. Si alguna actividad te interesa más, hacemos espacio.', cta: 'Cuéntanos qué parte te entusiasma.', itinerary: 'El recorrido, día a día' },
  romance: { cover: 'immersive', introLayout: 'editorial', artId: 'dinner', background: '#fcf6f2', ink: '#542e3d', accent: '#bc7572', soft: '#f0d9cf', muted: '#86636b', headingFont: 'classic', kicker: 'PARA VIAJAR JUNTOS', intro: 'Unos días solo para ustedes', copy: 'Les dejamos una idea de viaje para compartir. Si prefieren un día más libre o cambiar alguna parada, lo vemos.', cta: 'Si les encaja, revisamos fechas.', itinerary: 'Los días del viaje' },
  familia: { cover: 'postcard', introLayout: 'route', artId: 'journal', background: '#fff9ef', ink: '#193b4a', accent: '#dc795b', soft: '#dfebe5', muted: '#5a7079', headingFont: 'modern', kicker: 'PLAN FAMILIAR', intro: 'Para verlo entre todos', copy: 'Aquí tienen el viaje día por día. Revísenlo juntos y cuéntennos qué cambiarían antes de hacer reservas.', cta: 'Nos cuentan y lo afinamos.', itinerary: 'Un día a la vez' },
  lujo: { cover: 'folio', introLayout: 'letter', artId: 'arch', background: '#f6f1e8', ink: '#29282d', accent: '#9f7b4e', soft: '#e5dac5', muted: '#716c65', headingFont: 'classic', kicker: 'PROPUESTA PERSONAL', intro: 'Cada parte del viaje, a la vista', copy: 'Esta propuesta reúne el recorrido y el presupuesto. Tómate el tiempo de verla; podemos ajustar los detalles contigo.', cta: 'Cuando quieras, lo revisamos juntos.', itinerary: 'El recorrido' },
  costa: { cover: 'window', introLayout: 'bold', artId: 'horizon', background: '#eef4f0', ink: '#123e52', accent: '#bd8f65', soft: '#dce9e2', muted: '#5f7b80', headingFont: 'editorial', kicker: 'UNOS DÍAS JUNTO AL MAR', intro: 'La idea es bajar el ritmo', copy: 'Te dejamos una primera propuesta para los días de playa. Si prefieres menos traslados o más tiempo libre, la ajustamos.', cta: 'Si te encaja, revisamos las fechas.', itinerary: 'Días junto al mar' },
  ciudad: { cover: 'immersive', introLayout: 'editorial', artId: 'city', background: '#f5f0ea', ink: '#222d3b', accent: '#d57e5e', soft: '#eadccc', muted: '#687584', headingFont: 'modern', kicker: 'UNA ESCAPADA URBANA', intro: 'Una ciudad por recorrer', copy: 'Aquí puedes ver cómo quedarían los días. Si hay un barrio, museo o restaurante que quieras sumar, lo hablamos.', cta: 'Dinos qué te gustaría añadir.', itinerary: 'La ciudad, día a día' },
  naturaleza: { cover: 'postcard', introLayout: 'route', artId: 'forest', background: '#f3f4eb', ink: '#254238', accent: '#81996c', soft: '#dfe8d0', muted: '#657a67', headingFont: 'editorial', kicker: 'DÍAS AL AIRE LIBRE', intro: 'Salir a tomar aire', copy: 'Esta es una primera ruta para pasar tiempo fuera. Si quieres caminar más o dejar un día tranquilo, movemos el plan.', cta: 'La afinamos contigo antes de reservar.', itinerary: 'Los días al aire libre' },
  sabores: { cover: 'window', introLayout: 'bold', artId: 'dinner', background: '#f7f0e9', ink: '#542e38', accent: '#bd8b67', soft: '#f1e1d2', muted: '#806b70', headingFont: 'classic', kicker: 'UNA RUTA PARA COMER BIEN', intro: 'También se viaja a la mesa', copy: 'Te compartimos las paradas de esta ruta. Si tienes algún mercado, cocina o restaurante en mente, buscamos cómo incluirlo.', cta: 'Cuéntanos qué te apetece probar.', itinerary: 'Las paradas de la ruta' },
  celebracion: { cover: 'immersive', introLayout: 'editorial', artId: 'arch', background: '#faf5ec', ink: '#422f4d', accent: '#ae8b60', soft: '#ebdfd0', muted: '#756b7a', headingFont: 'classic', kicker: 'UN VIAJE PARA CELEBRAR', intro: 'Un viaje por una buena razón', copy: 'Esta propuesta es un punto de partida. Si hay algo importante para la ocasión, cuéntanoslo y lo añadimos al plan.', cta: 'Hablemos de los detalles.', itinerary: 'Los días de la celebración' },
  ruta: { cover: 'postcard', introLayout: 'route', artId: 'city', background: '#f5eee5', ink: '#293e49', accent: '#b16b4c', soft: '#ead9c6', muted: '#69777b', headingFont: 'modern', kicker: 'DE UN LUGAR A OTRO', intro: 'El recorrido, parada por parada', copy: 'Te dejamos los días ordenados para que veas cuánto tiempo habría en cada lugar. Podemos mover las etapas.', cta: 'Dinos dónde te quedarías más.', itinerary: 'La ruta, paso a paso' },
  bienestar: { cover: 'folio', introLayout: 'letter', artId: 'forest', background: '#f4f4ef', ink: '#374b47', accent: '#927d9b', soft: '#e2e8dd', muted: '#718079', headingFont: 'classic', kicker: 'UNOS DÍAS DE PAUSA', intro: 'Dejar sitio para descansar', copy: 'Aquí tienes una idea de viaje con tiempo para desconectar. Si quieres algún día sin planes, lo dejamos libre.', cta: 'Cuéntanos qué ritmo prefieres.', itinerary: 'Día por día' },
};

function coverPage(preset) {
  const { cover, artId, background, ink, accent, soft, kicker } = preset;
  let elements;
  if (cover === 'immersive') {
    elements = [
      art('cover-art', artId, 45, 40, 910, 920, true),
      shape('brand-plate', 80, 80, 440, 75, '#ffffff'),
      field('agency', 'agency.name', 105, 98, 390, 45, ink, 19, { weight: 'bold' }),
      text('edition', 'PROPUESTA DE VIAJE', 625, 100, 290, 40, '#ffffff', 12, { align: 'right', weight: 'bold' }),
      text('kicker', kicker, 90, 555, 790, 40, soft, 14, { weight: 'bold' }),
      field('title', 'trip.title', 90, 615, 810, 185, '#ffffff', 52),
      field('destination', 'trip.destination', 90, 820, 760, 55, '#ffffff', 20),
      shape('footer-rule', 90, 890, 820, 10, '#ffffff'),
      field('dates', 'trip.dates', 90, 910, 790, 35, '#ffffff', 13),
    ];
  } else if (cover === 'folio') {
    elements = [
      art('cover-art', artId, 435, 65, 510, 770),
      field('agency', 'agency.name', 65, 75, 350, 55, ink, 19, { weight: 'bold' }),
      shape('top-rule', 65, 165, 130, 10, accent),
      text('kicker', kicker, 65, 340, 340, 65, accent, 14, { weight: 'bold' }),
      field('title', 'trip.title', 65, 445, 345, 220, ink, 45),
      field('destination', 'trip.destination', 65, 715, 350, 95, ink, 19),
      shape('bottom-rule', 65, 905, 880, 10, accent),
      field('dates', 'trip.dates', 65, 932, 760, 40, ink, 13),
    ];
  } else if (cover === 'window') {
    elements = [
      art('cover-art', artId, 65, 135, 870, 540),
      field('agency', 'agency.name', 65, 60, 720, 55, ink, 19, { weight: 'bold' }),
      shape('paper-panel', 65, 675, 870, 285, background),
      text('kicker', kicker, 95, 710, 790, 40, accent, 14, { weight: 'bold' }),
      field('title', 'trip.title', 95, 755, 780, 135, ink, 45),
      field('destination', 'trip.destination', 95, 887, 780, 42, ink, 18),
      field('dates', 'trip.dates', 95, 930, 780, 28, accent, 12),
    ];
  } else {
    elements = [
      field('agency', 'agency.name', 70, 35, 700, 50, ink, 18, { weight: 'bold' }),
      art('cover-art', artId, 70, 100, 860, 520),
      shape('accent-rule', 70, 660, 120, 10, accent),
      text('kicker', kicker, 70, 690, 820, 40, accent, 14, { weight: 'bold' }),
      field('title', 'trip.title', 70, 750, 850, 135, ink, 45),
      field('destination', 'trip.destination', 70, 885, 800, 45, ink, 19),
      field('dates', 'trip.dates', 70, 940, 790, 32, accent, 12),
    ];
  }
  return { id: 'cover', label: 'Portada', kind: 'cover', background: cover === 'window' ? '#ffffff' : background, elements };
}

function introPage(preset) {
  const { introLayout, background, ink, accent, soft, muted, intro, copy, cta } = preset;
  const agency = field('intro-agency', 'agency.name', 70, 65, 650, 48, ink, 17, { weight: 'bold' });
  let elements;
  if (introLayout === 'editorial') {
    elements = [agency,
      text('folio', 'PROPUESTA PERSONAL', 700, 75, 230, 30, muted, 11, { align: 'right', weight: 'bold' }),
      shape('head-rule', 70, 130, 860, 10, soft),
      text('intro-heading', intro, 70, 175, 530, 180, ink, 40),
      text('intro-copy', copy, 620, 190, 300, 195, muted, 17),
      highlights(70, 410, 860, 275, ink),
      text('price-label', 'TU PROPUESTA', 70, 760, 450, 35, accent, 13, { weight: 'bold' }),
      field('intro-price', 'proposal.price', 70, 805, 470, 105, ink, 28),
      shape('cta-panel', 565, 750, 365, 165, soft),
      text('intro-cta', cta, 590, 795, 315, 110, ink, 17, { weight: 'bold' }),
      field('intro-contact', 'agency.contact', 70, 955, 800, 30, muted, 12),
    ];
  } else if (introLayout === 'letter') {
    elements = [agency,
      shape('head-rule', 70, 125, 860, 10, accent),
      text('intro-heading', intro, 70, 190, 430, 175, ink, 40),
      text('intro-copy', copy, 70, 395, 420, 145, muted, 18),
      highlights(525, 190, 405, 515, ink, 'stack'),
      text('price-label', 'TU PROPUESTA', 70, 665, 400, 34, accent, 13, { weight: 'bold' }),
      field('intro-price', 'proposal.price', 70, 715, 430, 100, ink, 28),
      shape('cta-panel', 70, 850, 860, 85, soft),
      text('intro-cta', cta, 95, 875, 800, 55, ink, 17, { weight: 'bold' }),
      field('intro-contact', 'agency.contact', 70, 955, 800, 30, muted, 12),
    ];
  } else if (introLayout === 'bold') {
    elements = [shape('top-band', 0, 0, 1000, 25, accent), agency,
      text('intro-heading', intro, 75, 155, 850, 145, ink, 42),
      text('intro-copy', copy, 75, 325, 800, 95, muted, 19),
      highlights(75, 455, 850, 260, ink),
      shape('price-panel', 75, 755, 850, 155, soft),
      text('price-label', 'TU PROPUESTA', 100, 770, 760, 30, accent, 13, { weight: 'bold' }),
      field('intro-price', 'proposal.price', 100, 815, 780, 75, ink, 30),
      text('intro-cta', cta, 75, 930, 850, 40, ink, 16, { weight: 'bold' }),
      field('intro-contact', 'agency.contact', 75, 970, 800, 25, muted, 10),
    ];
  } else {
    elements = [shape('side-band', 0, 0, 80, 1000, accent),
      field('intro-agency', 'agency.name', 130, 70, 760, 48, ink, 17, { weight: 'bold' }),
      text('intro-heading', intro, 130, 160, 790, 150, ink, 40),
      text('intro-copy', copy, 130, 330, 790, 100, muted, 19),
      highlights(130, 470, 420, 420, ink, 'stack'),
      shape('price-panel', 585, 470, 345, 420, soft),
      text('price-label', 'TU PROPUESTA', 610, 510, 290, 35, accent, 13, { weight: 'bold' }),
      field('intro-price', 'proposal.price', 610, 585, 290, 145, ink, 27),
      text('intro-cta', cta, 610, 760, 285, 110, ink, 17, { weight: 'bold' }),
      field('intro-contact', 'agency.contact', 130, 950, 780, 30, muted, 12),
    ];
  }
  return { id: 'intro', label: 'Presentación', kind: 'narrative', background: introLayout === 'letter' ? background : '#fffdfa', elements };
}

export function visualPresetDesign(id) {
  if (!Object.hasOwn(PRESETS, id)) throw new Error('Diseño predeterminado desconocido.');
  const preset = PRESETS[id];
  return {
    schemaVersion: 1, pageSize: 'A4',
    theme: { ink: preset.ink, accent: preset.accent, muted: preset.muted, headingFont: preset.headingFont, bodyFont: 'modern' },
    pages: [coverPage(preset), introPage(preset)],
    itinerary: { accent: preset.accent, heading: preset.itinerary, headingFontSize: 30, dayFontSize: 18, bodyFontSize: 8, showTimes: true, showDescriptions: true },
  };
}
