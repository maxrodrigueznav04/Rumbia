/**
 * Script de migración segura P02: inicializa status='activa' y version=1 en agencias legacy.
 *
 * Reglas de migración (P02):
 * 1. Preinspección y reporte de anomalías (no inventar dueños ni poner agency:null a ciegas).
 * 2. Solo migra agencias válidas que cumplan las relaciones requeridas.
 * 3. Dry-run por defecto; requiere --confirmar para aplicar cambios en MongoDB.
 * 4. Seguridad estricta: solo se conecta a MongoDB local.
 *
 * Uso:
 *   node scripts/migracion-p02-status-agencias.mjs
 *   node scripts/migracion-p02-status-agencias.mjs --confirmar
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { validarMongoUriLocal } from './test-p02-regression.mjs';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'cambia_esto_por_una_cadena_larga_y_aleatoria') {
  process.env.JWT_SECRET = 'test_only_rumbia_operational_script_secret_1234567890';
}

const { Agency, User } = await import('../src/models/index.js');

const mongoUri = process.env.MONGO_URI_TEST || process.env.TEST_MONGO_URI || process.env.MONGO_URI;

if (!mongoUri) {
  console.error('[migracion-p02] Define MONGO_URI_TEST o MONGO_URI antes de ejecutar.');
  process.exit(1);
}

try {
  validarMongoUriLocal(mongoUri);
} catch (err) {
  console.error('[migracion-p02] Error de seguridad:', err.message);
  process.exit(1);
}

const confirmar = process.argv.includes('--confirmar');

await mongoose.connect(mongoUri);
console.log(`[migracion-p02] Conectado a MongoDB local (${confirmar ? 'MODO ESCRITURA' : 'DRY-RUN'}).\n`);

// 1. Preinspección
const todasAgencias = await Agency.find({}).lean();
console.log(`Total de agencias en la base: ${todasAgencias.length}`);

const anomalias = [];
const candidatasMigracion = [];
let yaConStatus = 0;

for (const ag of todasAgencias) {
  const tieneStatus = ag.status === 'activa' || ag.status === 'archivada';
  if (tieneStatus) {
    yaConStatus += 1;
    continue;
  }

  // Verificar invariantes para agencias legacy sin status:
  if (!ag.owner) {
    anomalias.push({
      agencyId: ag._id,
      agencyName: ag.agencyName,
      motivo: 'Agencia sin owner definido',
    });
    continue;
  }

  const dueno = await User.findById(ag.owner).select('_id agency role email').lean();
  if (!dueno) {
    anomalias.push({
      agencyId: ag._id,
      agencyName: ag.agencyName,
      ownerId: ag.owner,
      motivo: 'El owner de la agencia no existe en la colección de usuarios',
    });
    continue;
  }

  if (String(dueno.agency) !== String(ag._id)) {
    anomalias.push({
      agencyId: ag._id,
      agencyName: ag.agencyName,
      ownerId: ag.owner,
      duenoAgency: dueno.agency,
      motivo: 'El usuario owner no tiene asignada esta agencia en su perfil',
    });
    continue;
  }

  candidatasMigracion.push(ag);
}

console.log(`Agencias con status explícito: ${yaConStatus}`);
console.log(`Agencias candidatas a migrar a status='activa': ${candidatasMigracion.length}`);
console.log(`Anomalías detectadas: ${anomalias.length}`);

if (anomalias.length > 0) {
  console.log('\n--- REPORTE DE ANOMALÍAS (requieren intervención operativa) ---');
  anomalias.forEach((a) => {
    console.log(` - Agencia ${a.agencyId} ("${a.agencyName}"): ${a.motivo}`);
  });
  console.log('----------------------------------------------------------------\n');
}

if (candidatasMigracion.length === 0) {
  console.log('No hay agencias pendientes de migración. Todo al día.');
  await mongoose.disconnect();
  process.exit(0);
}

if (!confirmar) {
  console.log('Ejecución en modo DRY-RUN. No se modificó ningún documento.');
  console.log('Para aplicar los cambios, ejecuta con el flag --confirmar:\n');
  console.log('  node scripts/migracion-p02-status-agencias.mjs --confirmar\n');
  await mongoose.disconnect();
  process.exit(0);
}

// 2. Aplicación atómica
const idsParaMigrar = candidatasMigracion.map((a) => a._id);
const resultado = await Agency.updateMany(
  {
    _id: { $in: idsParaMigrar },
    $or: [{ status: { $exists: false } }, { status: null }],
  },
  {
    $set: {
      status: 'activa',
      version: 1,
    },
  }
);

console.log(`\n✅ MIGRACIÓN COMPLETADA EXITOSAMENTE:`);
console.log(` - Agencias modificadas: ${resultado.modifiedCount}`);
console.log(` - Se asignó status='activa' y version=1 a todas las agencias válidas.`);

await mongoose.disconnect();
process.exit(0);
