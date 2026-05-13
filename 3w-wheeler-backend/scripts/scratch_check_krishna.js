import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

import User from './models/User.js';

async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findOne({ email: /krishna/i });
    if (user) {
        console.log('User found:', JSON.stringify(user, null, 2));
    } else {
        console.log('No user found matching "krishna"');
    }
    const allKrishna = await User.find({ email: /krishna/i });
    console.log('All matching users:', allKrishna.map(u => ({ email: u.email, username: u.username })));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
