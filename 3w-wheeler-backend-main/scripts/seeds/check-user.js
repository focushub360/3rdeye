import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../../models/User.js';

dotenv.config();

const uri = "mongodb+srv://littleflowerschool:Focus123engineering@cluster0.gmxndg9.mongodb.net/form?retryWrites=true&w=majority";

async function checkUser() {
  try {
    await mongoose.connect(uri);
    console.log('Connected to DB');
    
    const users = await User.find({ email: /lmadmin/i }).select('email role').lean();
    console.log('Found users:', users);
    
    const focusUsers = await User.find({ email: /focus/i }).limit(5).select('email role').lean();
    console.log('Focus users:', focusUsers);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkUser();
