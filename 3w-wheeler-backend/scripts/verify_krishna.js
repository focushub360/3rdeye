import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

import User from './models/User.js';

async function verify() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findOne({ email: 'krishnaa@focusengineering.in' });
    if (!user) {
      console.log('User not found');
      process.exit(1);
    }
    const isMatch = await user.comparePassword('krish@123');
    console.log('Password match:', isMatch);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

verify();
