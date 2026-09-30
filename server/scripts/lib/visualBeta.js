import mongoose from 'mongoose';

export function assertVisualBetaDatabase(uri) {
  let database;
  try { database = decodeURIComponent(new URL(uri).pathname.slice(1)); } catch { /* reject below */ }
  if (database !== 'rumbia_visual_beta') {
    throw new Error('La beta solo puede usar la base rumbia_visual_beta. Revisa MONGO_URI antes de iniciar.');
  }
}

export async function seedVisualBeta({ email, password }) {
  if (mongoose.connection.name !== 'rumbia_visual_beta') throw new Error('La conexión no es la base de prueba.');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length < 12) {
    throw new Error('Configura BETA_OWNER_EMAIL y BETA_OWNER_PASSWORD (al menos 12 caracteres) en Render.');
  }
  const { User, Agency, Trip, Itinerary, VisualTemplate } = await import('../../src/models/index.js');
  const { visualPresetDesign } = await import('../../src/validators/visualTemplate.js');
  const setups = mongoose.connection.db.collection('visualBetaSetup');
  const setup = await setups.findOne({ _id: 'owner' });
  if (setup && setup.email !== email.toLowerCase().trim()) throw new Error('La beta ya tiene un dueño. Conserva BETA_OWNER_EMAIL para este entorno.');
  if (setup?.complete) {
    if (!(await User.exists({ _id: setup.userId })) || !(await Agency.exists({ _id: setup.agencyId }))) {
      throw new Error('La cuenta o agencia beta fue eliminada. Usa una base beta vacía para comenzar de nuevo.');
    }
    return String(setup.agencyId);
  }
  let user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) user = await User.create({ name: 'Agente de prueba', email, password, emailVerified: true, preferences: { perfilUso: 'agencia', idioma: 'es' } });
  let agency = await Agency.findOne({ owner: user._id });
  if (!agency) agency = await Agency.create({ agencyName: 'Rumbia · agencia de prueba', owner: user._id, contact: 'Propuesta de ejemplo', billing: { plan: 'agencia_mensual', status: 'activa' } });
  if (String(user.agency) !== String(agency._id)) { user.agency = agency._id; await user.save(); }
  await setups.updateOne({ _id: 'owner' }, { $set: { email: user.email, userId: user._id, agencyId: agency._id } }, { upsert: true });
  for (const [count, title, destination] of [[3, 'Oaxaca en tres días', 'Oaxaca'], [15, 'Quince días por Yucatán', 'Mérida y Valladolid']]) {
    if (await Trip.exists({ user: user._id, agency: agency._id, title })) continue;
    const trip = await Trip.create({ user: user._id, agency: agency._id, title, destination: { name: destination },
      startDate: new Date('2026-11-01T00:00:00Z'), endDate: new Date(Date.UTC(2026, 10, count)),
      travelers: 2, status: 'planeado', budget: { currency: 'MXN' }, margen: { tipo: 'fijo', monto: 500 },
    });
    await Itinerary.create({ trip: trip._id, user: user._id, generatedBy: 'manual', days: Array.from({ length: count }, (_, index) => ({
      dayNumber: index + 1, date: new Date(Date.UTC(2026, 10, index + 1)),
      title: index === 0 ? `Llegada a ${destination}` : index === count - 1 ? 'Último paseo y regreso' : `Recorrido del día ${index + 1}`,
      summary: 'Tiempo para conocer el lugar y hacer pausas.',
      activities: [{ time: '10:00', title: 'Paseo por el centro', description: 'Un recorrido libre por los lugares que más te interesen.', estimatedCost: 200 },
        { time: '13:00', title: 'Comida y tarde libre', description: 'Una pausa para comer y seguir el día a tu ritmo.' }],
    })) });
  }
  for (const [slot, presetId, name] of [[1, 'editorial', 'Editorial de prueba'], [2, 'lujo', 'Distinción de prueba']]) {
    if (!(await VisualTemplate.exists({ agency: agency._id, activeSlot: slot }))) {
      await VisualTemplate.create({ agency: agency._id, createdBy: user._id, name, status: 'published', activeSlot: slot, design: visualPresetDesign(presetId) });
    }
  }
  await setups.updateOne({ _id: 'owner' }, { $set: { complete: true } });
  return String(agency._id);
}
