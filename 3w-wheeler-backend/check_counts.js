import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const ResponseSchema = new mongoose.Schema({
  questionId: String,
  isSectionSubmit: Boolean,
  answers: Map
});

const FormSchema = new mongoose.Schema({
  id: String,
  title: String,
  tenantId: mongoose.Schema.Types.ObjectId
});

const Response = mongoose.model('Response', ResponseSchema);
const Form = mongoose.model('Form', FormSchema);

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const forms = await Form.find({ title: /Chassis/i });
  console.log('Forms found:', forms.map(f => ({ id: f.id, _id: f._id, title: f.title, tenantId: f.tenantId })));
  
  for (const form of forms) {
    const byId = await Response.countDocuments({ questionId: form.id, isSectionSubmit: { $ne: true } });
    const byObjectId = await Response.countDocuments({ questionId: form._id.toString(), isSectionSubmit: { $ne: true } });
    console.log(`Form: ${form.title}`);
    console.log(`  By id (${form.id}): ${byId}`);
    console.log(`  By _id (${form._id}): ${byObjectId}`);
  }
  
  await mongoose.disconnect();
}

check().catch(console.error);
