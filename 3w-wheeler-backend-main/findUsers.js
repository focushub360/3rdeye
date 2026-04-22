import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const findRequestedUsers = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const users = await User.find({
            $or: [
                { username: /admin/i },
                { email: /lmadmin/i },
                { firstName: /vijay/i },
                { lastName: /vijay/i },
                { username: /vijay/i }
            ]
        }).select('email username role firstName lastName');
        
        console.log('Search Results:', JSON.stringify(users, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

findRequestedUsers();
