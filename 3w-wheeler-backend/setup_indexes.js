
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/3w-wheeler';

async function setupIndexes() {
  try {
    await mongoose.connect(MONGO_URI);
    
    // Check indexes for Response
    const Response = mongoose.model('Response', new mongoose.Schema({}, { strict: false }));
    const Form = mongoose.model('Form', new mongoose.Schema({}, { strict: false }));
    
    console.log("Creating indexes for Response...");
    await Response.collection.createIndex({ tenantId: 1 });
    await Response.collection.createIndex({ questionId: 1 });
    await Response.collection.createIndex({ createdAt: -1 });
    await Response.collection.createIndex({ status: 1 });
    await Response.collection.createIndex({ tenantId: 1, questionId: 1 });
    
    console.log("Creating indexes for Form...");
    await Form.collection.createIndex({ tenantId: 1 });
    await Form.collection.createIndex({ id: 1 });
    await Form.collection.createIndex({ isVisible: 1 });
    await Form.collection.createIndex({ createdAt: -1 });

    console.log("Indexes created successfully.");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

setupIndexes();
