
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/3w-wheeler';

async function inspectForm() {
  try {
    await mongoose.connect(MONGO_URI);
    const Form = mongoose.model('Form', new mongoose.Schema({}, { strict: false }));
    
    const form = await Form.findOne({ id: '4879b243-6cbc-457a-adb6-7585d74b031d' });
    if (form) {
      console.log('Form:', form.title);
      console.log('  sections length:', form.sections ? form.sections.length : 'N/A');
      if (form.sections && form.sections.length > 0) {
        console.log('  first section title:', form.sections[0].title);
      }
    }
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
inspectForm();
