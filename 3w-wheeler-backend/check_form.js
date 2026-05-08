
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/3w-wheeler';

async function checkForm() {
  try {
    await mongoose.connect(MONGO_URI);
    const Form = mongoose.model('Form', new mongoose.Schema({}, { strict: false }));
    
    // Check by id string
    const form = await Form.findOne({ id: '4879b243-6cbc-457a-adb6-7585d74b031d' });
    if (form) {
      console.log('Found Form by id:', form.title);
      console.log('  tenantId:', form.tenantId);
      console.log('  _id:', form._id);
    } else {
      console.log('Form NOT found by id 4879b243-6cbc-457a-adb6-7585d74b031d');
    }

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
checkForm();
