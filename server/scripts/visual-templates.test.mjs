import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultVisualDesign, visualDesignSchema } from '../src/validators/visualTemplate.js';
import { visualTemplateCanEdit, visualTemplateLimit } from '../src/services/visualTemplates.service.js';

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
