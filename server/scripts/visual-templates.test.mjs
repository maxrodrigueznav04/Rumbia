import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultVisualDesign, visualDesignSchema } from '../src/validators/visualTemplate.js';
import { visualTemplateCanEdit, visualTemplateLimit } from '../src/services/visualTemplates.service.js';
import { renderVisualProposalHtml } from '../src/services/visualProposalHtml.service.js';

test('el diseño de partida es válido y no exige imagen interior', () => {
  const design = visualDesignSchema.parse(defaultVisualDesign());
  assert.equal(design.pages[0].kind, 'cover');
  assert.equal(design.pages[1].kind, 'narrative');
  assert.equal(design.pages.flatMap((page) => page.elements).filter((item) => item.type === 'image').length, 0);
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
