import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const rCol = db.collection('responses');
  const formsCol = db.collection('forms');

  const countNoCreatedAt = await rCol.countDocuments({ createdAt: { $exists: false } });
  console.log('Total responses in entire DB without createdAt:', countNoCreatedAt);

  for (const title of ['LB Bef Paint', 'LB Aft Paint']) {
    const form = await formsCol.findOne({ title: new RegExp(title, 'i') });
    const ids = [form.id, form._id.toString()];

    // Normalized dates: 2026-09-01 00:00:00.000Z to 2026-09-12 23:59:59.999Z
    const sDate = new Date('2026-09-01');
    sDate.setUTCHours(0, 0, 0, 0);
    const eDate = new Date('2026-09-12');
    eDate.setUTCHours(23, 59, 59, 999);

    const count = await rCol.countDocuments({
      questionId: { $in: ids },
      createdAt: { $gte: sDate, $lte: eDate }
    });
    console.log(`${title} Sep 1 to Sep 12 count with normalized query: ${count}`);
  }

  process.exit(0);
}

run().catch(console.error);
