import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/rumbia-visual-test';
process.env.JWT_SECRET = 'visual-integration-test-secret-000000000000000000000';
process.env.VISUAL_TEMPLATES_ENABLED = 'true';
process.env.VISUAL_TEMPLATES_AGENCIES = '*';

test('plantillas de agencia y archivo PDF conservan permisos y versiones', async () => {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  const [{ default: app }, { signToken }, { VisualTemplate, VisualProposalIssue }, archive] = await Promise.all([
    import('../src/app.js'), import('../src/middleware/auth.js'), import('../src/models/index.js'),
    import('../src/services/visualPdfArchive.service.js'),
  ]);
  const server = app.listen(0);
  const port = server.address().port;
  const id = () => new mongoose.Types.ObjectId();
  const owner1 = id(); const member1 = id(); const owner2 = id();
  const agency1 = id(); const agency2 = id(); const trip = id();
  const users = mongoose.connection.db.collection('users');
  const agencies = mongoose.connection.db.collection('agencies');
  const trips = mongoose.connection.db.collection('trips');
  const itineraries = mongoose.connection.db.collection('itineraries');
  const cookie = (userId) => `rumbia_token=${signToken(userId)}`;
  const request = async (path, userId, options = {}) => {
    const response = await fetch(`http://127.0.0.1:${port}/api${path}`, {
      ...options,
      headers: { cookie: cookie(userId), 'Content-Type': 'application/json', ...options.headers },
    });
    return { status: response.status, body: await response.json() };
  };

  try {
    await users.insertMany([
      { _id: owner1, name: 'Dueña Uno', email: 'duena1@example.com', password: 'test-password', agency: agency1 },
      { _id: member1, name: 'Agente Uno', email: 'agente1@example.com', password: 'test-password', agency: agency1 },
      { _id: owner2, name: 'Dueña Dos', email: 'duena2@example.com', password: 'test-password', agency: agency2 },
    ]);
    await agencies.insertMany([
      { _id: agency1, agencyName: 'Agencia Uno', owner: owner1, status: 'activa', billing: { plan: 'inicio_mensual', status: 'activa' } },
      { _id: agency2, agencyName: 'Agencia Dos', owner: owner2, status: 'activa', billing: { plan: 'agencia_mensual', status: 'activa' } },
    ]);
    await trips.insertOne({ _id: trip, user: owner1, agency: agency1, title: 'Viaje de prueba',
      destination: { name: 'Oaxaca' }, travelers: 2,
      startDate: new Date('2026-10-10T00:00:00Z'), endDate: new Date('2026-10-12T00:00:00Z'),
      budget: { currency: 'MXN' }, margen: { tipo: 'fijo', monto: 500 },
    });
    await itineraries.insertOne({ trip, user: owner1, days: [
      { dayNumber: 1, date: new Date('2026-10-10T00:00:00Z'), title: 'Llegada a Oaxaca', activities: [{ time: '10:00', title: 'Paseo por el centro', estimatedCost: 200 }] },
    ] });
    const { default: env } = await import('../src/config/env.js');
    env.visualTemplateAgencies = [String(agency1)];
    assert.equal((await request('/visual-templates', owner2)).status, 404);
    assert.equal((await request('/visual-assets', owner2)).status, 404);
    assert.equal((await request(`/trips/${trip}/visual-proposal`, owner2)).status, 404);
    assert.equal((await request('/auth/me', owner1)).body.data.user.features.visualTemplates, true);
    assert.equal((await request('/auth/me', owner2)).body.data.user.features.visualTemplates, false);
    const art = await fetch(`http://127.0.0.1:${port}/api/visual-templates/art/arch`, { headers: { cookie: cookie(owner1) } });
    assert.equal(art.status, 200);
    assert.equal(art.headers.get('cross-origin-resource-policy'), 'same-site');
    env.visualTemplateAgencies = ['*'];
    await agencies.updateOne({ _id: agency2 }, { $set: { 'billing.plan': 'inicio_mensual' } });
    const concurrentTemplates = await Promise.all(['Primera', 'Segunda'].map((name) => request('/visual-templates', owner2, {
      method: 'POST', body: JSON.stringify({ name }),
    })));
    assert.deepEqual(concurrentTemplates.map((response) => response.status).sort(), [201, 409]);
    assert.equal(await VisualTemplate.countDocuments({ agency: agency2, activeSlot: { $ne: null } }), 1);
    const emptyProposal = await request(`/trips/${trip}/visual-proposal`, owner1);
    assert.equal(emptyProposal.status, 200);
    assert.equal(emptyProposal.body.data.proposal, null);
    assert.deepEqual(emptyProposal.body.data.issues, []);
    assert.equal((await request(`/trips/${trip}/visual-proposal/preview`, owner1)).status, 404);
    assert.equal((await request('/trips/invalid/visual-proposal', owner1)).status, 404);
    const created = await request('/visual-templates', owner1, { method: 'POST', body: JSON.stringify({ name: 'Mi propuesta' }) });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const templateId = created.body.data.template._id;
    assert.equal((await request(`/trips/${trip}/visual-proposal`, owner1, {
      method: 'POST', body: JSON.stringify({ templateId, revision: 0 }),
    })).status, 404); // A draft is not offered for a client proposal.
    assert.equal((await request('/visual-templates', member1, { method: 'POST', body: JSON.stringify({ name: 'Sin permiso' }) })).status, 403);
    assert.equal((await request(`/visual-templates/${templateId}`, owner2)).status, 404);
    assert.equal((await request('/visual-templates', owner1, { method: 'POST', body: JSON.stringify({ name: 'Excede Inicio' }) })).status, 409);
    const published = await request(`/visual-templates/${templateId}`, owner1, {
      method: 'PATCH', body: JSON.stringify({ revision: 1, status: 'published' }),
    });
    assert.equal(published.status, 200, JSON.stringify(published.body));
    assert.equal((await request(`/visual-templates/${templateId}`, owner1, {
      method: 'PATCH', body: JSON.stringify({ revision: 1, name: 'Conflicto' }),
    })).status, 409);
    assert.equal((await request(`/trips/${trip}/visual-proposal`, owner2)).status, 403);

    const selected = await request(`/trips/${trip}/visual-proposal`, owner1, {
      method: 'POST', body: JSON.stringify({ templateId }),
    });
    assert.equal(selected.status, 200, JSON.stringify(selected.body));
    assert.equal((await request(`/visual-templates/${templateId}`, member1, {
      method: 'PATCH', body: JSON.stringify({ revision: 2, name: 'Agente sin permiso' }),
    })).status, 403);
    assert.equal((await request(`/trips/${trip}/visual-proposal`, owner1, {
      method: 'POST', body: JSON.stringify({ templateId, revision: 0 }),
    })).status, 409);
    assert.equal((await request(`/trips/${trip}/visual-proposal`, owner1, {
      method: 'PATCH', body: JSON.stringify({ revision: 99, design: selected.body.data.proposal.design }),
    })).status, 409);
    const preview = await request(`/trips/${trip}/visual-proposal/preview`, owner1);
    assert.equal(preview.status, 200, JSON.stringify(preview.body));
    assert(!preview.body.data.html.includes('margen'));
    await itineraries.updateOne({ trip }, { $set: { 'days.0.title': 'Cambio después de la vista previa' } });
    assert.equal((await request(`/trips/${trip}/visual-proposal/issue`, owner1, {
      method: 'POST', body: JSON.stringify({ revision: 1, previewHash: preview.body.data.previewHash }),
    })).status, 409);
    await itineraries.updateOne({ trip }, { $set: { 'days.0.title': 'Llegada a Oaxaca' } });
    await itineraries.updateOne({ trip }, { $set: { 'days.0.dayNumber': 2 } });
    await trips.updateOne({ _id: trip }, { $set: { endDate: new Date('2026-10-10T00:00:00Z') } });
    assert.equal((await request(`/trips/${trip}/visual-proposal/preview`, owner1)).status, 409);
    await trips.updateOne({ _id: trip }, { $set: { endDate: new Date('2026-10-12T00:00:00Z') } });
    await itineraries.updateOne({ trip }, { $set: { 'days.0.dayNumber': 1 } });
    {
      const requestId = randomUUID();
      const issued = await request(`/trips/${trip}/visual-proposal/issue`, owner1, {
        method: 'POST', body: JSON.stringify({ revision: selected.body.data.proposal.revision, previewHash: preview.body.data.previewHash, requestId }),
      });
      assert.equal(issued.status, 201, JSON.stringify(issued.body));
      const issueId = issued.body.data.issue._id;
      const retried = await request(`/trips/${trip}/visual-proposal/issue`, owner1, {
        method: 'POST', body: JSON.stringify({ revision: 1, previewHash: preview.body.data.previewHash, requestId }),
      });
      assert.equal(retried.status, 201);
      assert.equal(retried.body.data.issue._id, issueId);
      assert.equal(await VisualProposalIssue.countDocuments({ trip }), 1);
      const url = `http://127.0.0.1:${port}/api/trips/${trip}/visual-proposal/issues/${issueId}/pdf`;
      const getPdf = (userId) => fetch(url, { headers: { cookie: cookie(userId) } });
      assert.equal((await getPdf(owner2)).status, 403);
      const download1 = await getPdf(owner1);
      assert.equal(download1.status, 200);
      const bytes1 = Buffer.from(await download1.arrayBuffer());
      assert.equal(bytes1.subarray(0, 5).toString(), '%PDF-');
      const download2 = await getPdf(owner1);
      assert.deepEqual(Buffer.from(await download2.arrayBuffer()), bytes1);

      // Reuse the same master on another trip; edits to that proposal are isolated.
      const trip2 = id();
      const secondTrip = { ...(await trips.findOne({ _id: trip })), _id: trip2, title: 'Quince días por Yucatán', destination: { name: 'Mérida y Valladolid' }, endDate: new Date('2026-10-24T00:00:00Z') };
      await trips.insertOne(secondTrip);
      await itineraries.insertOne({ trip: trip2, user: owner1, days: Array.from({ length: 15 }, (_, index) => ({
        dayNumber: index + 1, date: new Date(Date.UTC(2026, 9, 10 + index)), title: `Parada ${index + 1}`,
        activities: [{ time: '10:00', title: 'Recorrido y comida local', description: 'Tiempo para conocer el lugar y volver al alojamiento.' }],
      })) });
      const second = await request(`/trips/${trip2}/visual-proposal`, member1, { method: 'POST', body: JSON.stringify({ templateId }) });
      assert.equal(second.status, 200, JSON.stringify(second.body));
      const design = structuredClone(second.body.data.proposal.design);
      const phrase = design.pages.flatMap((p) => p.elements).find((e) => e.type === 'text');
      phrase.text = 'Tu viaje por Yucatán';
      const changed = await request(`/trips/${trip2}/visual-proposal`, member1, { method: 'PATCH', body: JSON.stringify({ revision: second.body.data.proposal.revision, design }) });
      assert.equal(changed.status, 200, JSON.stringify(changed.body));
      assert(!(await request(`/visual-templates/${templateId}`, owner1)).body.data.template.design.pages.some((p) => p.elements.some((e) => e.text === phrase.text)));
      assert(!(await request(`/trips/${trip}/visual-proposal`, owner1)).body.data.proposal.design.pages.some((p) => p.elements.some((e) => e.text === phrase.text)));
      const preview2 = await request(`/trips/${trip2}/visual-proposal/preview`, member1);
      assert.equal(preview2.status, 200, JSON.stringify(preview2.body));
      assert(preview2.body.data.html.includes('Mérida y Valladolid'));
      const issued2 = await request(`/trips/${trip2}/visual-proposal/issue`, member1, { method: 'POST', body: JSON.stringify({ revision: changed.body.data.proposal.revision, previewHash: preview2.body.data.previewHash }) });
      assert.equal(issued2.status, 201, JSON.stringify(issued2.body));
      const secondPdf = await fetch(`http://127.0.0.1:${port}/api/trips/${trip2}/visual-proposal/issues/${issued2.body.data.issue._id}/pdf`, { headers: { cookie: cookie(member1) } });
      assert.equal(secondPdf.status, 200);
      assert.equal(Buffer.from(await secondPdf.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
      assert.deepEqual(Buffer.from(await (await getPdf(owner1)).arrayBuffer()), bytes1);
      // Archive the master: existing copies and PDFs survive, but it cannot be selected again.
      const archived = await request(`/visual-templates/${templateId}`, owner1, {
        method: 'PATCH', body: JSON.stringify({ revision: 2, status: 'archived' }),
      });
      assert.equal(archived.status, 200);
      assert.equal((await request(`/trips/${trip}/visual-proposal/preview`, owner1)).status, 200);
      assert.deepEqual(Buffer.from(await (await getPdf(owner1)).arrayBuffer()), bytes1);
      assert.equal((await request(`/trips/${trip}/visual-proposal`, owner1, {
        method: 'POST', body: JSON.stringify({ templateId, revision: 1 }),
      })).status, 404);
      assert.equal((await request(`/visual-templates/${templateId}`, owner1, {
        method: 'PATCH', body: JSON.stringify({ revision: 3, status: 'published' }),
      })).status, 200);
    }
    await agencies.updateOne({ _id: agency1 }, { $set: { 'billing.plan': 'pro_mensual' } });
    const extra = await request('/visual-templates', owner1, { method: 'POST', body: JSON.stringify({ name: 'Para dos', presetId: 'romance', status: 'published' }) });
    assert.equal(extra.status, 201, JSON.stringify(extra.body));
    assert.equal(extra.body.data.template.status, 'published');
    assert.equal(extra.body.data.template.design.pages[0].background, '#fcf6f2');
    const selectedArt = await request(`/trips/${trip}/visual-proposal`, owner1, {
      method: 'POST', body: JSON.stringify({ templateId: extra.body.data.template._id, revision: 1 }),
    });
    assert.equal(selectedArt.status, 200, JSON.stringify(selectedArt.body));
    const artPreview = await request(`/trips/${trip}/visual-proposal/preview`, owner1);
    assert.equal(artPreview.status, 200, JSON.stringify(artPreview.body));
    assert.match(artPreview.body.data.html, /class="fixed-element artwork"/);
    assert.match(artPreview.body.data.html, /data:image\/jpeg;base64,/);
    await agencies.updateOne({ _id: agency1 }, { $set: { 'billing.plan': 'inicio_mensual' } });
    assert.equal((await request(`/trips/${trip}/visual-proposal`, owner1, {
      method: 'POST', body: JSON.stringify({ templateId }),
    })).status, 409);
    const archivedExtra = await request(`/visual-templates/${extra.body.data.template._id}`, owner1, {
      method: 'PATCH', body: JSON.stringify({ revision: 1, status: 'archived' }),
    });
    assert.equal(archivedExtra.status, 200, JSON.stringify(archivedExtra.body));
    assert.equal((await request(`/trips/${trip}/visual-proposal`, owner1, {
      method: 'POST', body: JSON.stringify({ templateId, revision: selectedArt.body.data.proposal.revision }),
    })).status, 200);

    const beforeConcurrentEdit = (await request(`/trips/${trip}/visual-proposal`, owner1)).body.data.proposal;
    const concurrentEdits = await Promise.all([owner1, member1].map((user, index) => {
      const design = structuredClone(beforeConcurrentEdit.design);
      design.pages.flatMap((page) => page.elements).find((item) => item.type === 'text').text = `Edición ${index}`;
      return request(`/trips/${trip}/visual-proposal`, user, {
        method: 'PATCH', body: JSON.stringify({ revision: beforeConcurrentEdit.revision, design }),
      });
    }));
    assert.deepEqual(concurrentEdits.map((response) => response.status).sort(), [200, 409]);

    const issuedHistory = (await request(`/trips/${trip}/visual-proposal`, owner1)).body.data.issues;
    await agencies.updateOne({ _id: agency1 }, { $set: { 'billing.status': 'cancelada' } });
    const expired = await request(`/trips/${trip}/visual-proposal`, owner1);
    assert.equal(expired.status, 200);
    assert.equal(expired.body.data.canEdit, false);
    assert.equal((await request(`/trips/${trip}/visual-proposal`, owner1, {
      method: 'POST', body: JSON.stringify({ templateId, revision: expired.body.data.proposal.revision }),
    })).status, 403);
    const downloadExpired = await fetch(`http://127.0.0.1:${port}/api/trips/${trip}/visual-proposal/issues/${issuedHistory[0]._id}/pdf`, { headers: { cookie: cookie(owner1) } });
    assert.equal(downloadExpired.status, 200);
    const expiredTemplates = (await request('/visual-templates', owner1)).body.data;
    assert.equal(expiredTemplates.canEdit, false);
    assert.equal(expiredTemplates.canArchive, true);
    const currentTemplate = (await request(`/visual-templates/${templateId}`, owner1)).body.data.template;
    assert.equal((await request(`/visual-templates/${templateId}`, owner1, {
      method: 'PATCH', body: JSON.stringify({ revision: currentTemplate.revision, status: 'archived' }),
    })).status, 200);
    await agencies.updateOne({ _id: agency1 }, { $set: { 'billing.status': 'activa' } });
    const archivedTemplate = (await request(`/visual-templates/${templateId}`, owner1)).body.data.template;
    assert.equal((await request(`/visual-templates/${templateId}`, owner1, {
      method: 'PATCH', body: JSON.stringify({ revision: archivedTemplate.revision, status: 'published' }),
    })).status, 200);

    const pdf = Buffer.from('%PDF-1.4\npropuesta emitida\n%%EOF\n');
    const stored = await archive.archiveVisualPdf(pdf, { agencyId: agency1, tripId: trip, proposalId: id() });
    await VisualProposalIssue.create({
      agency: agency1, trip, proposal: id(), sequence: 1, issuedBy: owner1,
      templateRevision: 1, design: {}, data: {}, pdfFileId: stored.fileId,
      pdfSha256: stored.sha256, pdfBytes: stored.bytes,
    });
    assert.deepEqual(await archive.readArchivedVisualPdf(stored.fileId), pdf);
    await archive.deleteArchivedVisualPdf(stored.fileId);
    assert.equal(await VisualTemplate.countDocuments({ agency: agency1, activeSlot: { $ne: null } }), 1);
    // Eliminar la maestra conserva las copias, su edición y los bytes emitidos.
    const deletePath = `/visual-templates/${templateId}`;
    const deleteRevision = (await request(deletePath, owner1)).body.data.template.revision;
    const deletion = (revision = deleteRevision) => ({ method: 'DELETE', body: JSON.stringify({ revision }) });
    assert.equal((await request(deletePath, member1, deletion())).status, 403);
    assert.equal((await request(deletePath, owner2, deletion())).status, 404);
    assert.equal((await request('/visual-templates/invalid', owner1, deletion())).status, 404);
    assert.equal((await request(deletePath, owner1, { method: 'DELETE', body: '{}' })).status, 400);
    assert.equal((await request(deletePath, owner1, deletion(deleteRevision - 1))).status, 409);
    assert.equal((await request(deletePath, owner1)).status, 200);
    const historicalUrl = `http://127.0.0.1:${port}/api/trips/${trip}/visual-proposal/issues/${issuedHistory[0]._id}/pdf`;
    const historicalBytes = Buffer.from(await (await fetch(historicalUrl, { headers: { cookie: cookie(owner1) } })).arrayBuffer());
    const assetId = id();
    await mongoose.connection.db.collection('visualassets').insertOne({ _id: assetId, agency: agency1, url: 'https://example.test/kept.jpg' });
    assert.equal((await request('/visual-templates', member1)).body.data.canDelete, false);
    assert.equal((await request('/visual-templates', owner1)).body.data.canDelete, true);
    assert.equal((await request(deletePath, owner1, deletion())).status, 200);
    assert.equal((await request(deletePath, owner1)).status, 404);
    assert.equal((await request(deletePath, owner1, deletion())).status, 404);
    assert(await mongoose.connection.db.collection('visualassets').findOne({ _id: assetId }));
    assert.equal((await request(`/trips/${trip}/visual-proposal`, owner1, {
      method: 'POST', body: JSON.stringify({ templateId, revision: 0 }),
    })).status, 404);
    const preserved = (await request(`/trips/${trip}/visual-proposal`, owner1)).body.data;
    assert.equal(preserved.proposal.template, templateId);
    assert.deepEqual(preserved.issues, issuedHistory);
    assert.deepEqual(Buffer.from(await (await fetch(historicalUrl, { headers: { cookie: cookie(owner1) } })).arrayBuffer()), historicalBytes);
    const keptEdit = await request(`/trips/${trip}/visual-proposal`, member1, {
      method: 'PATCH', body: JSON.stringify({ revision: preserved.proposal.revision, design: preserved.proposal.design }),
    });
    assert.equal(keptEdit.status, 200);
    const keptPreview = await request(`/trips/${trip}/visual-proposal/preview`, member1);
    assert.equal(keptPreview.status, 200);
    const keptIssue = await request(`/trips/${trip}/visual-proposal/issue`, member1, {
      method: 'POST', body: JSON.stringify({ revision: keptEdit.body.data.proposal.revision, previewHash: keptPreview.body.data.previewHash }),
    });
    assert.equal(keptIssue.status, 201, JSON.stringify(keptIssue.body));
    assert.equal(await VisualTemplate.countDocuments({ agency: agency1, activeSlot: { $ne: null } }), 0);
    const replacement = await request('/visual-templates', owner1, { method: 'POST', body: JSON.stringify({ name: 'Cupo liberado' }) });
    assert.equal(replacement.status, 201);
    await agencies.updateOne({ _id: agency1 }, { $set: { 'billing.status': 'cancelada' } });
    assert.equal((await request('/visual-templates', owner1)).body.data.canDelete, true);
    assert.equal((await request(`/visual-templates/${extra.body.data.template._id}`, owner1, deletion(2))).status, 200);
    const parallelDeletion = await Promise.all([0, 1].map(() => request(`/visual-templates/${replacement.body.data.template._id}`, owner1, deletion(1))));
    assert.equal(parallelDeletion.filter((result) => result.status === 200).length, 1);
    assert(parallelDeletion.some((result) => [404, 409].includes(result.status)));
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await mongo.stop();
  }
});
