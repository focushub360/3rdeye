import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const ResponseSchema = new mongoose.Schema({
  questionId: String,
  isSectionSubmit: Boolean,
  answers: Map
});

const Response = mongoose.model('Response', ResponseSchema);

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const responses = await Response.find({ questionId: 'bceebc04-ae03-4bcf-9bb2-d79ba1bf72f5', isSectionSubmit: { $ne: true } });
  console.log('Responses count:', responses.length);
  
  const chassisCounts = {};
  responses.forEach(r => {
    const answers = Object.fromEntries(r.answers);
    const chassis = answers.chassis_number || answers.chassisNumber || 'unknown';
    chassisCounts[chassis] = (chassisCounts[chassis] || 0) + 1;
  });
  
  console.log('Chassis counts:', chassisCounts);
  
  await mongoose.disconnect();
}

check().catch(console.error);
