import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { existsSync } from 'node:fs';

process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/rumbia-visual-test';
process.env.JWT_SECRET = 'visual-integration-test-secret-000000000000000000000';
process.env.VISUAL_TEMPLATES_ENABLED = 'true';

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
    const created = await request('/visual-templates', owner1, { method: 'POST', body: JSON.stringify({ name: 'Mi propuesta' }) });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const templateId = created.body.data.template._id;
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
    const preview = await request(`/trips/${trip}/visual-proposal/preview`, owner1);
    assert.equal(preview.status, 200, JSON.stringify(preview.body));
    assert(!preview.body.data.html.includes('margen'));
    const chrome = process.env.CHROMIUM_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    if (existsSync(chrome)) {
      process.env.CHROMIUM_PATH = chrome;
      const issued = await request(`/trips/${trip}/visual-proposal/issue`, owner1, {
        method: 'POST', body: JSON.stringify({ revision: selected.body.data.proposal.revision, previewHash: preview.body.data.previewHash }),
      });
      assert.equal(issued.status, 201, JSON.stringify(issued.body));
      const issueId = issued.body.data.issue._id;
      const url = `http://127.0.0.1:${port}/api/trips/${trip}/visual-proposal/issues/${issueId}/pdf`;
      const getPdf = (userId) => fetch(url, { headers: { cookie: cookie(userId) } });
      assert.equal((await getPdf(owner2)).status, 403);
      const download1 = await getPdf(owner1);
      assert.equal(download1.status, 200);
      const bytes1 = Buffer.from(await download1.arrayBuffer());
      assert.equal(bytes1.subarray(0, 5).toString(), '%PDF-');
      const download2 = await getPdf(owner1);
      assert.deepEqual(Buffer.from(await download2.arrayBuffer()), bytes1);
    }
    await agencies.updateOne({ _id: agency1 }, { $set: { 'billing.plan': 'pro_mensual' } });
    const extra = await request('/visual-templates', owner1, { method: 'POST', body: JSON.stringify({ name: 'Plantilla extra' }) });
    assert.equal(extra.status, 201, JSON.stringify(extra.body));
    await agencies.updateOne({ _id: agency1 }, { $set: { 'billing.plan': 'inicio_mensual' } });
    assert.equal((await request(`/trips/${trip}/visual-proposal`, owner1, {
      method: 'POST', body: JSON.stringify({ templateId }),
    })).status, 409);
    const archivedExtra = await request(`/visual-templates/${extra.body.data.template._id}`, owner1, {
      method: 'PATCH', body: JSON.stringify({ revision: 1, status: 'archived' }),
    });
    assert.equal(archivedExtra.status, 200, JSON.stringify(archivedExtra.body));
    assert.equal((await request(`/trips/${trip}/visual-proposal`, owner1, {
      method: 'POST', body: JSON.stringify({ templateId }),
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
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await mongo.stop();
  }
});
