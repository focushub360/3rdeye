
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/3w-wheeler';

async function checkFormPriya() {
  try {
    await mongoose.connect(MONGO_URI);
    const Form = mongoose.model('Form', new mongoose.Schema({}, { strict: false }));
    
    const form = await Form.findOne({ id: 'c121bc95-c447-4daa-9edf-e649a0454129' });
    if (form) {
      console.log('Form:', form.title);
      console.log('  tenantId:', form.tenantId);
    }
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
checkFormPriya();
