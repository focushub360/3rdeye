import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const rCol = mongoose.connection.db.collection('responses');
  const formsCol = mongoose.connection.db.collection('forms');
  const forms = await formsCol.find({ title: /paint/i }).toArray();

  for (const form of forms) {
    console.log('\n=============================================');
    console.log('FORM:', form.title);
    console.log('form.id (UUID):', form.id);
    console.log('form._id (ObjectId):', form._id.toString());

    const targetIds = [form.id, form._id.toString(), form._id];

    // Sep 1-12
    const sep1to12 = await rCol.find({
      $or: [
        { questionId: { $in: targetIds } },
        { formId: { $in: targetIds } }
      ],
      createdAt: {
        $gte: new Date('2026-09-01T00:00:00.000Z'),
        $lte: new Date('2026-09-12T23:59:59.999Z')
      }
    }).toArray();

    const counts1to12 = {};
    for (const r of sep1to12) {
      const q = String(r.questionId || r.formId);
      counts1to12[q] = (counts1to12[q] || 0) + 1;
    }
    console.log('Sep 1-12 total:', sep1to12.length, 'breakdown by questionId/formId:', counts1to12);

    // Sep 13-30
    const sep13to30 = await rCol.find({
      $or: [
        { questionId: { $in: targetIds } },
        { formId: { $in: targetIds } }
      ],
      createdAt: {
        $gte: new Date('2026-09-13T00:00:00.000Z'),
        $lte: new Date('2026-09-30T23:59:59.999Z')
      }
    }).toArray();

    const counts13to30 = {};
    for (const r of sep13to30) {
      const q = String(r.questionId || r.formId);
      counts13to30[q] = (counts13to30[q] || 0) + 1;
    }
    console.log('Sep 13-30 total:', sep13to30.length, 'breakdown by questionId/formId:', counts13to30);
  }

  process.exit(0);
}

run().catch(console.error);
