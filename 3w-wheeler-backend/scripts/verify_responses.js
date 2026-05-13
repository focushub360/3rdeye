
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/3w-wheeler';

async function verifyResponses() {
  try {
    await mongoose.connect(MONGO_URI);
    const Response = mongoose.model('Response', new mongoose.Schema({}, { strict: false }));
    
    const count = await Response.countDocuments({ questionId: 'c121bc95-c447-4daa-9edf-e649a0454129' });
    console.log('Total responses for c121bc95...:', count);
    
    const responses = await Response.find({ questionId: 'c121bc95-c447-4daa-9edf-e649a0454129' });
    responses.forEach(r => {
      console.log(`Response _id: ${r._id}, id: ${r.id}, tenantId: ${r.tenantId}`);
    });

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
verifyResponses();
