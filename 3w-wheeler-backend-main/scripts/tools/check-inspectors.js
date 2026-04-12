import './config/env.js';
import mongoose from 'mongoose';
import connectDB from './config/database.js';
import User from './models/User.js';

const check = async () => {
    await connectDB();
    const users = await User.find({ role: 'inspector' });
    console.log(JSON.stringify(users, null, 2));
    mongoose.connection.close();
};

check();
