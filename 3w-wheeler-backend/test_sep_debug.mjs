import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const rCol = mongoose.connection.db.collection('responses');
  const formsCol = mongoose.connection.db.collection('forms');
  const form = await formsCol.findOne({ title: /LB Aft Paint/i });
  console.log('form.id:', form.id, 'form._id:', form._id.toString());
  
  const cUUID = await rCol.countDocuments({ questionId: form.id });
  const cObjIdStr = await rCol.countDocuments({ questionId: form._id.toString() });
  const cObjId = await rCol.countDocuments({ questionId: form._id });
  const cFormId = await rCol.countDocuments({ formId: form.id });
  const cFormIdObjStr = await rCol.countDocuments({ formId: form._id.toString() });
  console.log({ cUUID, cObjIdStr, cObjId, cFormId, cFormIdObjStr });

  const targetIds = [form.id, form._id.toString(), form._id];
  const total = await rCol.countDocuments({ 
    $or: [
      { questionId: { $in: targetIds } }, 
      { formId: { $in: targetIds } }
    ] 
  });
  console.log('Total matching any form identifier:', total);

  // Check September responses
  const sepResponses = await rCol.find({
    $or: [
      { questionId: { $in: targetIds } }, 
      { formId: { $in: targetIds } }
    ],
    createdAt: {
      $gte: new Date('2026-09-01T00:00:00.000Z'),
      $lte: new Date('2026-09-12T23:59:59.999Z')
    }
  }).toArray();
  console.log('Sep 1-12 count:', sepResponses.length);

  // Check all September responses
  const sepAllResponses = await rCol.find({
    $or: [
      { questionId: { $in: targetIds } }, 
      { formId: { $in: targetIds } }
    ],
    createdAt: {
      $gte: new Date('2026-09-01T00:00:00.000Z'),
      $lte: new Date('2026-09-30T23:59:59.999Z')
    }
  }).toArray();
  console.log('Sep full month count:', sepAllResponses.length);

  // Check child forms
  const childForms = await formsCol.find({ parentFormId: { $in: targetIds } }).toArray();
  console.log('Child forms found:', childForms.length);
  for (const cf of childForms) {
    console.log('Child form:', cf.title, cf.id);
    const cfCount = await rCol.countDocuments({ questionId: cf.id });
    console.log('Child form responses:', cfCount);
  }

  process.exit(0);
}

run().catch(console.error);
