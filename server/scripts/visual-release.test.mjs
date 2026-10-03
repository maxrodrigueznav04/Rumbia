import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { assertVisualBetaDatabase, seedVisualBeta } from './lib/visualBeta.js';
import { fittedFieldFontSize } from '../src/services/visualFieldSizing.js';
import { fittedFieldFontSize as clientFieldSize } from '../../client/src/config/visualFieldSizing.js';

process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/rumbia-visual-release-test';
process.env.JWT_SECRET = 'visual-release-test-secret-not-used-in-production';
process.env.CLOUDINARY_CLOUD_NAME = 'visual-test';
process.env.CLOUDINARY_API_KEY = 'test-key';
process.env.CLOUDINARY_API_SECRET = 'test-secret';

test('el título largo cabe en la portada estrecha y el editor usa el mismo tamaño', () => {
  const element = { type: 'field', field: 'trip.title', width: 345, height: 220, style: { fontSize: 45 } };
  for (const title of ['Del Pacífico a la magia', 'Una semana en San Diego y Anaheim con toda la familia', 'Oaxaca']) {
    const size = fittedFieldFontSize(element, title);
    assert.equal(clientFieldSize(element, title), size);
    assert.ok(size >= 12 && size <= 45);
  }
  assert.ok(fittedFieldFontSize(element, 'Del Pacífico a la magia') < 45);
});

test('el arranque beta rechaza bases reales o una URI sin nombre de base', () => {
  assert.doesNotThrow(() => assertVisualBetaDatabase('mongodb://127.0.0.1:27017/rumbia_visual_beta'));
  assert.doesNotThrow(() => assertVisualBetaDatabase('mongodb+srv://user:secret@cluster.example.com/rumbia_visual_beta?retryWrites=true'));
  for (const uri of ['mongodb://127.0.0.1:27017/rumbia', 'mongodb+srv://cluster.example.com/', '', undefined]) {
    assert.throws(() => assertVisualBetaDatabase(uri), /solo puede usar la base/);
  }
});

test('la beta exige habilitación global y pertenencia a una agencia autorizada', async () => {
  const { hasVisualTemplateAccess } = await import('../src/services/visualAccess.service.js');
  const config = { visualTemplatesEnabled: true, visualTemplateAgencies: ['agency-one'] };
  assert.equal(hasVisualTemplateAccess('agency-one', config), true);
  assert.equal(hasVisualTemplateAccess({ _id: 'agency-one' }, config), true);
  assert.equal(hasVisualTemplateAccess('agency-two', config), false);
  assert.equal(hasVisualTemplateAccess(null, config), false);
  assert.equal(hasVisualTemplateAccess('agency-one', { ...config, visualTemplateAgencies: [] }), false);
  assert.equal(hasVisualTemplateAccess('agency-one', { ...config, visualTemplatesEnabled: false }), false);
});

test('la biblioteca bloquea imágenes utilizadas y conserva el registro si falla el borrado remoto', async () => {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  const { Agency, VisualAsset, VisualTemplate, VisualProposal, VisualProposalIssue } = await import('../src/models/index.js');
  const { remove } = await import('../src/controllers/visualAssets.controller.js');
  const id = () => new mongoose.Types.ObjectId();
  const owner = id(); const member = id(); const agency = id(); const foreignAgency = id(); const asset = id();
  const originalFetch = globalThis.fetch;
  const remoteRequests = [];
  const call = async (user = { _id: owner, agency }) => {
    let body;
    await remove({ user, params: { id: String(asset) } }, { json: (result) => { body = result; } }, (error) => { throw error; });
    return body;
  };
  try {
    await Agency.collection.insertMany([{ _id: agency, owner, billing: { status: 'activa' } }, { _id: foreignAgency, owner: member, billing: { status: 'activa' } }]);
    await VisualAsset.collection.insertOne({ _id: asset, agency, uploadedBy: owner, publicId: 'visual-test/unused', url: 'https://example.test/photo.jpg' });
    globalThis.fetch = async (url, options) => {
      remoteRequests.push({ url, publicId: options.body.get('public_id') });
      return new Response('{}', { status: 503 });
    };
    await assert.rejects(call({ _id: member, agency }), { statusCode: 403 });
    await assert.rejects(call({ _id: member, agency: foreignAgency }), { statusCode: 404 });
    const linkedDesign = { pages: [{ elements: [{ assetId: String(asset) }] }] };
    await VisualTemplate.collection.insertOne({ agency, design: linkedDesign });
    await assert.rejects(call(), { statusCode: 409 });
    await VisualTemplate.deleteMany({ agency });
    await VisualProposal.collection.insertOne({ agency, design: linkedDesign });
    await assert.rejects(call(), { statusCode: 409 });
    await VisualProposal.deleteMany({ agency });
    await VisualProposalIssue.collection.insertOne({ agency, data: { assets: { [String(asset)]: { url: 'https://example.test/photo.jpg' } } } });
    await assert.rejects(call(), { statusCode: 409 });
    await VisualProposalIssue.deleteMany({ agency });
    assert.equal(remoteRequests.length, 0);
    await assert.rejects(call(), { statusCode: 503 });
    assert(await VisualAsset.findById(asset));
    globalThis.fetch = async (url, options) => {
      remoteRequests.push({ url, publicId: options.body.get('public_id') });
      return new Response(JSON.stringify({ result: 'ok' }), { status: 200 });
    };
    assert.equal((await call()).success, true);
    assert.equal(await VisualAsset.findById(asset), null);
    assert(remoteRequests.every((request) => request.url === 'https://api.cloudinary.com/v1_1/visual-test/image/destroy' && request.publicId === 'visual-test/unused'));
  } finally {
    globalThis.fetch = originalFetch;
    await mongoose.disconnect();
    await mongo.stop();
  }
});

test('reiniciar la beta conserva plantillas, viajes y contraseña editados', async () => {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri('rumbia_visual_beta'));
  try {
    const { User, Trip, VisualTemplate } = await import('../src/models/index.js');
    const credentials = { email: 'owner@beta.test', password: 'Private-beta-password' };
    const agency = await seedVisualBeta(credentials);
    await Trip.updateMany({ agency }, { $set: { title: 'Mi viaje personalizado' } });
    await VisualTemplate.updateMany({ agency }, { $set: { name: 'Mi diseño personalizado' } });
    const owner = await User.findOne({ email: credentials.email }).select('+password');
    const initialHash = owner.password;
    assert.equal(await seedVisualBeta({ ...credentials, password: 'Changed-env-password' }), agency);
    assert.equal(await Trip.countDocuments({ agency }), 2);
    assert.equal(await VisualTemplate.countDocuments({ agency }), 2);
    assert.equal(await VisualTemplate.countDocuments({ agency, name: 'Mi diseño personalizado' }), 2);
    assert.equal((await User.findById(owner._id).select('+password')).password, initialHash);
    await assert.rejects(seedVisualBeta({ ...credentials, email: 'another@beta.test' }), /ya tiene un dueño/);
  } finally {
    await mongoose.disconnect();
    await mongo.stop();
  }
});

test('la limpieza de agencia conserva referencias si falla Cloudinary y borra solo su propio archivo', async () => {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  const { VisualAsset, VisualTemplate, VisualProposal, VisualProposalIssue } = await import('../src/models/index.js');
  const { archiveVisualPdf } = await import('../src/services/visualPdfArchive.service.js');
  const { deleteVisualAgencyData, deleteVisualTripData } = await import('../src/services/visualCleanup.service.js');
  const id = () => new mongoose.Types.ObjectId();
  const agency1 = id(); const agency2 = id(); const trip1 = id(); const trip2 = id();
  const originalFetch = globalThis.fetch;
  try {
    for (const [agency, trip] of [[agency1, trip1], [agency2, trip2]]) {
      await VisualAsset.collection.insertOne({ agency, publicId: `rumbia/propuestas/${agency}/photo` });
      await VisualTemplate.collection.insertOne({ agency });
      await VisualProposal.collection.insertOne({ agency, trip });
      await VisualProposalIssue.collection.insertOne({ agency, trip });
      await archiveVisualPdf(Buffer.from('%PDF-1.4\nexample\n%%EOF'), { agencyId: agency, tripId: trip, proposalId: id() });
    }
    globalThis.fetch = async () => new Response('{}', { status: 503 });
    await assert.rejects(deleteVisualAgencyData(agency1), /No se pudo eliminar/);
    assert.equal(await VisualAsset.countDocuments({ agency: agency1 }), 1);
    assert.equal(await VisualTemplate.countDocuments({ agency: agency1 }), 1);
    const deleted = [];
    globalThis.fetch = async (url, init) => {
      assert.equal(url, 'https://api.cloudinary.com/v1_1/visual-test/image/destroy');
      deleted.push(init.body.get('public_id'));
      return new Response(JSON.stringify({ result: 'ok' }), { status: 200 });
    };
    await deleteVisualAgencyData(agency1);
    await deleteVisualAgencyData(agency1); // Retry is harmless after completion.
    assert.deepEqual(deleted, [`rumbia/propuestas/${agency1}/photo`]);
    for (const Model of [VisualAsset, VisualTemplate, VisualProposal, VisualProposalIssue]) {
      assert.equal(await Model.countDocuments({ agency: agency1 }), 0);
      assert.equal(await Model.countDocuments({ agency: agency2 }), 1);
    }
    const files = mongoose.connection.db.collection('visualProposalPdfs.files');
    assert.equal(await files.countDocuments({ 'metadata.agencyId': String(agency1) }), 0);
    assert.equal(await files.countDocuments({ 'metadata.agencyId': String(agency2) }), 1);
    await deleteVisualTripData(trip2);
    assert.equal(await files.countDocuments(), 0);
    assert.equal(await mongoose.connection.db.collection('visualProposalPdfs.chunks').countDocuments(), 0);
    assert.equal(await VisualProposalIssue.countDocuments(), 0);
    assert.equal(await VisualAsset.countDocuments({ agency: agency2 }), 1);
    assert.equal(await VisualTemplate.countDocuments({ agency: agency2 }), 1);
  } finally {
    globalThis.fetch = originalFetch;
    await mongoose.disconnect();
    await mongo.stop();
  }
});
