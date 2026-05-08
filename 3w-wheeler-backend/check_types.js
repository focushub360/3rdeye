
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/3w-wheeler';

async function checkTypes() {
  try {
    await mongoose.connect(MONGO_URI);
    const Response = mongoose.model('Response', new mongoose.Schema({}, { strict: false }));
    const res = await Response.findOne({ questionId: 'c121bc95-c447-4daa-9edf-e649a0454129' });
    if (res) {
      console.log('tenantId type:', typeof res.tenantId);
      console.log('tenantId constructor:', res.tenantId.constructor.name);
    }
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
checkTypes();
