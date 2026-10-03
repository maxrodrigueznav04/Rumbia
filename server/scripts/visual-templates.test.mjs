import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultVisualDesign, visualDesignSchema, VISUAL_PRESET_IDS, VISUAL_ART_IDS, visualPresetDesign, createVisualTemplateSchema } from '../src/validators/visualTemplate.js';
import { visualTemplateCanEdit, visualTemplateLimit } from '../src/services/visualTemplates.service.js';
import { renderVisualProposalHtml } from '../src/services/visualProposalHtml.service.js';
import { visualPresetArt } from '../src/services/visualPresetArt.service.js';

test('el diseño de partida es válido y no exige imagen interior', () => {
  const design = visualDesignSchema.parse(defaultVisualDesign());
  assert.equal(design.pages[0].kind, 'cover');
  assert.equal(design.pages[1].kind, 'narrative');
  assert.equal(design.pages.flatMap((page) => page.elements).filter((item) => item.type === 'image').length, 0);
});

test('los diseños listos se pueden publicar y conservar sin imágenes obligatorias', () => {
  assert.equal(VISUAL_PRESET_IDS.length, 13);
  const backgrounds = new Set();
  const headings = new Set();
  for (const id of VISUAL_PRESET_IDS) {
    const design = visualDesignSchema.parse(visualPresetDesign(id));
    backgrounds.add(design.pages[0].background);
    headings.add(design.itinerary.heading);
    assert.equal(design.pages.flatMap((page) => page.elements).filter((item) => item.type === 'image').length, 0);
    const includedArt = design.pages[0].elements.filter((item) => item.type === 'artwork');
    assert.equal(includedArt.length, 1);
    assert(VISUAL_ART_IDS.includes(includedArt[0].artId));
    assert(!includedArt[0].assetId);
    assert.equal(createVisualTemplateSchema.safeParse({ name: id, presetId: id, status: 'published' }).success, true);
  }
  assert(backgrounds.size >= 10);
  assert(headings.size >= 10);
  for (const id of VISUAL_ART_IDS) assert(visualPresetArt(id).length > 10000);
  assert.equal(visualPresetArt('../secret'), null);
  assert.equal(createVisualTemplateSchema.safeParse({ name: 'No válido', presetId: 'desconocido' }).success, false);
});

test('rechaza campos internos y elementos que desbordan la página', () => {
  const privateField = defaultVisualDesign();
  privateField.pages[0].elements[0].field = 'trip.margen';
  assert.equal(visualDesignSchema.safeParse(privateField).success, false);

  const overflow = defaultVisualDesign();
  overflow.pages[0].elements[0].x = 900;
  assert.equal(visualDesignSchema.safeParse(overflow).success, false);
});

test('los límites acordados dependen del plan activo', () => {
  const agency = (plan, active = true, trial = false) => ({
    tieneAccesoActivo: active, esTrialActivo: trial, billing: { plan },
  });
  assert.equal(visualTemplateLimit(agency('inicio_mensual')), 1);
  assert.equal(visualTemplateLimit(agency('agencia_anual')), 5);
  assert.equal(visualTemplateLimit(agency('pro_mensual')), 15);
  assert.equal(visualTemplateLimit(agency('vitalicio')), 5);
  assert.equal(visualTemplateLimit(agency(null, true, true)), 1);
  assert.equal(visualTemplateLimit(agency('pro_mensual', false)), 0);
});

test('solo el dueño de esa agencia edita la plantilla maestra', () => {
  assert.equal(visualTemplateCanEdit({ owner: 'a1' }, { _id: 'a1' }), true);
  assert.equal(visualTemplateCanEdit({ owner: 'a1' }, { _id: 'a2' }), false);
});

test('la propuesta escapa texto externo y conserva solo campos públicos', () => {
  const data = {
    fields: {
      'trip.title': '<script>alert(1)</script>', 'trip.destination': 'La Jolla',
      'trip.dates': '15 oct', 'trip.travelers': '2 viajeros',
      'agency.name': 'Agencia', 'agency.contact': '', 'proposal.price': '$100 MXN',
    },
    days: [{ number: 1, date: '15 oct', title: 'Día <privado>', summary: '', activities: [] }],
    highlights: [], assets: {}, showBrandCredit: true,
  };
  const html = renderVisualProposalHtml(defaultVisualDesign(), data);
  assert(!html.includes('<script>alert(1)</script>'));
  assert(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert(!html.includes('trip.margen'));
});

test('una página vacía pide completarla y una actividad sin horario usa todo el ancho', () => {
  const design = defaultVisualDesign();
  const data = { fields: { 'trip.title': 'Oaxaca', 'agency.name': 'Agencia' }, highlights: [], assets: {},
    days: [{ number: 1, title: 'Llegada', activities: [
      { title: 'Paseo sin hora', description: 'Puedes recorrerlo a tu ritmo.' },
      { time: '10:00', title: 'Visita con hora' },
    ] }], showBrandCredit: false };
  const html = renderVisualProposalHtml(design, data);
  assert.match(html, /class="activity"><div><strong>Paseo sin hora/);
  assert.match(html, /class="activity with-time"><time>10:00/);
  design.pages.push({ id: 'empty', label: 'Mi página vacía', background: '#ffffff', elements: [] });
  assert.throws(() => renderVisualProposalHtml(design, data), /Mi página vacía.*no tiene texto ni imagen/);
});

test('falta de precio usa un aviso y los campos privados no llegan al documento', async () => {
  process.env.MONGO_URI ||= 'mongodb://127.0.0.1:27017/rumbia-test';
  process.env.JWT_SECRET ||= 'local-test-secret-only-000000000000000000000';
  const { buildVisualProposalData } = await import('../src/services/visualProposalData.service.js');
  const data = buildVisualProposalData({
    trip: { title: 'Oaxaca', destination: { name: 'Oaxaca' }, startDate: '2026-10-01', endDate: '2026-10-01', budget: { currency: 'MXN' }, coreCosts: { total: 0 }, notasInternas: 'PRIVADO', margen: { tipo: 'fijo', monto: 0 } },
    itinerary: { totalEstimatedCost: 0, days: [{ dayNumber: 1, date: '2026-10-01', title: 'Llegada', activities: [{ title: 'Paseo', description: 'Una tarde libre', notasInternas: 'PRIVADO', costoNeto: 9999 }] }] },
    agency: { agencyName: 'Mi agencia' },
  });
  assert.equal(data.fields['proposal.price'], 'Precio por confirmar');
  assert(!JSON.stringify(data).includes('PRIVADO'));
  assert(!JSON.stringify(data).includes('costoNeto'));
  assert.equal(data.fields['trip.travelers'], '1 viajero');
});

test('el generador recupera su capacidad tras rechazar un documento grande y limita emisiones simultáneas', async () => {
  const { renderVisualPdf } = await import('../src/services/visualPdf.service.js');
  await assert.rejects(renderVisualPdf('x'.repeat(2 * 1024 * 1024 + 1)), /demasiado grande/);
  const first = renderVisualPdf('<html><body><p>Documento válido después de un error</p></body></html>');
  await assert.rejects(renderVisualPdf('<p>Segunda emisión simultánea</p>'), /ocupado/);
  const pdf = await first;
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
});

test('rechaza texto recortado e imágenes inaccesibles y permite emitir después del fallo', async () => {
  const { renderVisualPdf } = await import('../src/services/visualPdf.service.js');
  await assert.rejects(renderVisualPdf('<html><body><div class="fixed-element text" style="width:10px;height:10px;overflow:hidden;font-size:30px">Texto que no cabe en su cuadro</div></body></html>'), /texto que no cabe/);
  await assert.rejects(renderVisualPdf('<html><body><img src="https://example.invalid/photo.png"></body></html>'), /imagen.*no pudo cargarse/);
  const pdf = await renderVisualPdf('<html><body><p>Emisión válida después de corregir la imagen</p></body></html>');
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
});

test('inspección de imágenes rechaza dimensiones peligrosas', async () => {
  process.env.MONGO_URI ||= 'mongodb://127.0.0.1:27017/rumbia-test';
  process.env.JWT_SECRET ||= 'local-test-secret-only-000000000000000000000';
  const { inspectProposalImage } = await import('../src/services/visualAssets.service.js');
  const png = Buffer.alloc(33);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
  png.writeUInt32BE(1080, 16); png.writeUInt32BE(1440, 20);
  assert.deepEqual(inspectProposalImage(png), { mimeType: 'image/png', width: 1080, height: 1440 });
  png.writeUInt32BE(100000, 16);
  assert.throws(() => inspectProposalImage(png));
});
