
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/3w-wheeler';

async function listResponses() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const Response = mongoose.model('Response', new mongoose.Schema({}, { strict: false }));
    
    const responses = await Response.find({}).sort({ createdAt: -1 }).limit(10);
    console.log(`Found ${responses.length} recent responses`);

    for (const res of responses) {
      console.log(`\nResponse ID: ${res.id || res._id}`);
      console.log(`  questionId: ${res.questionId}`);
      console.log(`  tenantId: ${res.tenantId}`);
      console.log(`  status: ${res.status}`);
      console.log(`  createdAt: ${res.createdAt}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

listResponses();
