
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/3w-wheeler';

async function checkUser() {
  try {
    await mongoose.connect(MONGO_URI);
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    
    // Find a sample inspector
    const user = await User.findOne({ role: 'inspector' });
    if (user) {
      console.log('User:', user.username);
      console.log('  tenantId:', user.tenantId);
    }
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
checkUser();
