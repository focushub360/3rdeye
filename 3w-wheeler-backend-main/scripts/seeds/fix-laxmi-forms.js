import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

const LAXMI_TENANT_ID = '69c10f30b592ddf7f17c44f4';

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB\n');
  const db = mongoose.connection.db;

  // Sample a few forms to see what tenantIds exist
  const sample = await db.collection('forms').find({}).project({ title: 1, tenantId: 1, isGlobal: 1 }).limit(10).toArray();
  console.log('Sample forms:');
  sample.forEach(f => console.log(`  "${f.title}" | tenantId: ${f.tenantId} | isGlobal: ${f.isGlobal}`));

  // Distinct tenantIds
  const tenantIds = await db.collection('forms').distinct('tenantId');
  console.log('\nAll distinct tenantIds in forms:', tenantIds.map(t => t?.toString()));

  // Count forms with the correct tenantId
  const correctCount = await db.collection('forms').countDocuments({
    tenantId: new mongoose.Types.ObjectId(LAXMI_TENANT_ID)
  });
  console.log(`\nForms already in Laxmi Metals tenant: ${correctCount}`);

  const wrongCount = await db.collection('forms').countDocuments({
    tenantId: { $ne: new mongoose.Types.ObjectId(LAXMI_TENANT_ID) }
  });
  console.log(`Forms in OTHER tenants: ${wrongCount}`);

  if (wrongCount > 0) {
    console.log('\nMigrating all forms to Laxmi Metals TVS...');
    const result = await db.collection('forms').updateMany(
      { tenantId: { $ne: new mongoose.Types.ObjectId(LAXMI_TENANT_ID) } },
      { $set: { tenantId: new mongoose.Types.ObjectId(LAXMI_TENANT_ID) } }
    );
    console.log(`✅ Migrated ${result.modifiedCount} forms to tenant ${LAXMI_TENANT_ID}`);
  } else {
    console.log('\n✅ All forms are correctly assigned to Laxmi Metals TVS');
  }

  // Also update responses
  const allResponseTenants = await db.collection('responses').distinct('tenantId');
  console.log('\nResponse tenantIds:', allResponseTenants.map(t => t?.toString()));

  await mongoose.disconnect();
};

run().catch(err => {
  console.error('Script failed:', err);
  mongoose.disconnect();
});
