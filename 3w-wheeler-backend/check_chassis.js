import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const FormSchema = new mongoose.Schema({
  title: String,
  chassisTenantAssignments: Array
});

const Form = mongoose.model('Form', FormSchema);

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const form = await Form.findOne({ title: 'Chassis' });
  console.log('Form:', form.title);
  console.log('chassisTenantAssignments:', JSON.stringify(form.chassisTenantAssignments, null, 2));
  
  await mongoose.disconnect();
}

check().catch(console.error);
