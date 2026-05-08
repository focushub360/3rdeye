import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

import User from './models/User.js';

async function update() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Find the user with two 'a's and update to one 'a' and new password
    const user = await User.findOne({ email: 'krishnaa@focusengineering.in' });
    if (user) {
      user.email = 'krishna@focusengineering.in';
      user.username = 'krishna';
      user.password = '123456';
      await user.save();
      console.log('User updated successfully to krishna@focusengineering.in / 123456');
    } else {
      console.log('User krishnaa@focusengineering.in not found. Checking if krishna@focusengineering.in already exists.');
      const existing = await User.findOne({ email: 'krishna@focusengineering.in' });
      if (existing) {
        existing.password = '123456';
        await existing.save();
        console.log('Password updated for existing krishna@focusengineering.in');
      } else {
        console.log('Neither user found.');
      }
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

update();
