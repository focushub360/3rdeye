import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { getResponsesByForm } from './controllers/responseController.js';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const formsCol = db.collection('forms');
  const form = await formsCol.findOne({ title: /LB Bef Paint/i });

  const req = {
    params: { formId: form.id },
    query: { analytics: 'true', page: '1', limit: '1000' },
    user: {
      role: 'admin',
      tenantId: form.tenantId
    },
    tenantFilter: { tenantId: form.tenantId }
  };

  const start = Date.now();
  let jsonResult = null;
  const res = {
    status: (code) => {
      console.log('Status code:', code);
      return res;
    },
    json: (data) => {
      jsonResult = data;
      return res;
    }
  };

  await getResponsesByForm(req, res);
  const duration = Date.now() - start;
  console.log(`Execution took ${duration} ms`);
  console.log('Success:', jsonResult?.success);
  console.log('Responses returned:', jsonResult?.data?.responses?.length);
  console.log('Pagination:', jsonResult?.data?.pagination);

  process.exit(0);
}

run().catch(console.error);
