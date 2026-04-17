import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  console.log('\nAll collections in DB:');
  for (const col of collections) {
    const count = await db.collection(col.name).countDocuments();
    console.log(`  ${col.name}: ${count} documents`);
  }
  await mongoose.disconnect();
};

run().catch(err => {
  console.error(err);
  mongoose.disconnect();
});
