import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const resetPasswords = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        
        const targetEmails = ['lmadmin@focus.com', 'vijay@gmail.com', 'prasannas@gmail.com', 'admin@focus.com'];
        const newPassword = 'admin123#';

        for (const email of targetEmails) {
            const user = await User.findOne({ email });
            if (user) {
                user.password = newPassword;
                await user.save();
                console.log(`✅ Password reset successful for: ${email}`);
            } else {
                console.log(`❌ User not found: ${email}`);
            }
        }
    } catch (err) {
        console.error('Error resetting passwords:', err);
    } finally {
        process.exit(0);
    }
}

resetPasswords();
