import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const rCol = mongoose.connection.db.collection('responses');
  const formsCol = mongoose.connection.db.collection('forms');
  const form = await formsCol.findOne({ title: /LB Aft Paint/i });
  const targetIds = [form.id, form._id.toString(), form._id];

  const sep1to12 = await rCol.find({
    $or: [
      { questionId: { $in: targetIds } },
      { formId: { $in: targetIds } }
    ],
    createdAt: {
      $gte: new Date('2026-09-01T00:00:00.000Z'),
      $lte: new Date('2026-09-12T23:59:59.999Z')
    }
  }).limit(3).toArray();

  console.log('--- Sample Sep 1-12 responses ---');
  for (const r of sep1to12) {
    console.log({
      _id: r._id,
      questionId: r.questionId,
      formId: r.formId,
      createdAt: r.createdAt,
      submittedAt: r.submittedAt,
      timestamp: r.timestamp,
      submittedBy: r.submittedBy,
      batchId: r.batchId,
      isSectionSubmit: r.isSectionSubmit,
      status: r.status,
      tenantId: r.tenantId
    });
  }

  // Also check if any responses have submittedAt or timestamp in Sep 1-12 but createdAt outside
  const submittedAtSep = await rCol.countDocuments({
    $or: [
      { questionId: { $in: targetIds } },
      { formId: { $in: targetIds } }
    ],
    submittedAt: {
      $gte: new Date('2026-09-01T00:00:00.000Z'),
      $lte: new Date('2026-09-12T23:59:59.999Z')
    }
  });
  console.log('count with submittedAt in Sep 1-12:', submittedAtSep);

  process.exit(0);
}

run().catch(console.error);
