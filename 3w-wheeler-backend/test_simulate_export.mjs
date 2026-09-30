import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

// import models
import '../3w-wheeler-backend/models/Form.js';
import '../3w-wheeler-backend/models/Response.js';
import '../3w-wheeler-backend/models/User.js';

const Form = mongoose.model('Form');
const Response = mongoose.model('Response');

async function testExportForForm(formTitle) {
  const form = await Form.findOne({ title: new RegExp(formTitle, 'i') });
  console.log(`\n================ Testing ${form.title} ================`);
  console.log(`id: ${form.id}, _id: ${form._id}`);

  // Simulate getResponsesByForm query with startDate and endDate
  const targetQuestionIds = [form.id, form._id ? form._id.toString() : null].filter(Boolean);
  const uniqueQuestionIds = Array.from(new Set(targetQuestionIds));

  // 1. Without date filter (all data)
  const allQuery = {
    questionId: { $in: uniqueQuestionIds },
    isSectionSubmit: { $ne: true }
  };
  const allCount = await Response.countDocuments(allQuery);
  console.log(`All non-section responses: ${allCount}`);

  // 2. Date filter: Sep 1 to Sep 12 (as getResponsesByForm does)
  const sDate = new Date('2026-09-01');
  sDate.setUTCHours(0, 0, 0, 0);
  const eDate = new Date('2026-09-12');
  eDate.setUTCHours(23, 59, 59, 999);

  const sepQuery = {
    questionId: { $in: uniqueQuestionIds },
    isSectionSubmit: { $ne: true },
    createdAt: { $gte: sDate, $lte: eDate }
  };

  const sepCount = await Response.countDocuments(sepQuery);
  console.log(`Sep 1-12 with createdAt filter: ${sepCount}`);

  // Check what dates exist on these responses in createdAt
  const sepResponses = await Response.find(sepQuery).select('createdAt submittedAt timestamp answers').lean();
  console.log(`Found ${sepResponses.length} responses in Sep 1-12.`);
  if (sepResponses.length > 0) {
    console.log('First 3 createdAt:', sepResponses.slice(0, 3).map(r => r.createdAt));
    console.log('Last 3 createdAt:', sepResponses.slice(-3).map(r => r.createdAt));
  }

  // Check if frontend filter:
  // const responseDate = new Date(timestamp).toISOString().split("T")[0];
  // responseDate >= "2026-09-01" && responseDate <= "2026-09-12"
  let matchedFrontendFilter = 0;
  for (const r of sepResponses) {
    const ts = r.submittedAt || r.createdAt || r.timestamp;
    const rDate = new Date(ts).toISOString().split('T')[0];
    if (rDate >= '2026-09-01' && rDate <= '2026-09-12') {
      matchedFrontendFilter++;
    }
  }
  console.log(`Frontend date filter matched count: ${matchedFrontendFilter} / ${sepResponses.length}`);
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  await testExportForForm('LB Bef Paint');
  await testExportForForm('LB Aft Paint');
  process.exit(0);
}

run().catch(console.error);
