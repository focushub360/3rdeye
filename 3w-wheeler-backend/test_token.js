
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/3w-wheeler';

const getJwtSecret = () => {
  return process.env.JWT_SECRET || 'your-secret-key-change-in-production';
};

async function generateTestToken() {
  try {
    await mongoose.connect(MONGO_URI);
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const user = await User.findOne({ username: 'Priya' });
    if (user) {
      const token = jwt.sign({ userId: user._id.toString() }, getJwtSecret(), { expiresIn: '1h' });
      console.log('TOKEN:', token);
    } else {
      console.log('User Priya not found');
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

generateTestToken();
