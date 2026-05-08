import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

import User from './models/User.js';
import Tenant from './models/Tenant.js';

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to Cloud DB');

    let tenant = await Tenant.findOne({ slug: '3w-wheeler-tvs' });
    if (!tenant) {
        tenant = new Tenant({
            name: '3W Wheeler TVS',
            slug: '3w-wheeler-tvs',
            companyName: 'Focus Engineering',
            adminId: [new mongoose.Types.ObjectId()],
            isActive: true
        });
        await tenant.save();
    }

    // 1. Ensure krishna@focusengineering.in / 123456 works
    let user1 = await User.findOne({ email: 'krishna@focusengineering.in' });
    if (user1) {
        user1.password = '123456';
        await user1.save();
    } else {
        user1 = new User({
            username: 'krishna',
            email: 'krishna@focusengineering.in',
            password: '123456',
            role: 'inspector',
            tenantId: tenant._id,
            firstName: 'Krishna',
            lastName: 'Inspector',
            isActive: true,
            accessType: 'both'
        });
        await user1.save();
    }

    // 2. Ensure krishnaa@focusengineering.in / Krish@123 works (as seen in latest screenshot)
    let user2 = await User.findOne({ email: 'krishnaa@focusengineering.in' });
    if (user2) {
        user2.password = 'Krish@123';
        await user2.save();
    } else {
        user2 = new User({
            username: 'krishnaa',
            email: 'krishnaa@focusengineering.in',
            password: 'Krish@123',
            role: 'inspector',
            tenantId: tenant._id,
            firstName: 'Krishna',
            lastName: 'Inspector',
            isActive: true,
            accessType: 'both'
        });
        await user2.save();
    }

    console.log('Both Krishna accounts are now synchronized in the Cloud DB.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seed();
