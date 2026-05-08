import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
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
    if (!process.env.MONGODB_URI) {
      console.error('MONGODB_URI not found in .env');
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // 1. Create/Update Tenant
    let tenant = await Tenant.findOne({ slug: '3w-wheeler-tvs' });
    if (!tenant) {
      tenant = new Tenant({
        name: '3W Wheeler TVS',
        slug: '3w-wheeler-tvs',
        companyName: 'Focus Engineering',
        adminId: [new mongoose.Types.ObjectId()], // Placeholder
        isActive: true,
        subscription: { plan: 'enterprise', maxUsers: 100, maxForms: 100 }
      });
      await tenant.save();
      console.log('Tenant created: 3W Wheeler TVS');
    }

    // 2. Create/Update Krishna User
    const email = 'krishnaa@focusengineering.in';
    const username = 'krishna';
    const password = 'krish@123';

    let user = await User.findOne({ email });
    if (user) {
      user.password = password;
      user.tenantId = tenant._id;
      user.role = 'inspector';
      user.firstName = 'Krishna';
      user.lastName = 'Inspector';
      await user.save();
      console.log('Krishna user updated');
    } else {
      user = new User({
        username,
        email,
        password,
        role: 'inspector',
        tenantId: tenant._id,
        firstName: 'Krishna',
        lastName: 'Inspector',
        isActive: true,
        accessType: 'both',
        mobile: '7904199518' // From previous context
      });
      await user.save();
      console.log('Krishna user created');
    }

    // Update tenant adminId if it was placeholder
    if (tenant.adminId.length === 1 && tenant.name === '3W Wheeler TVS') {
        tenant.adminId = [user._id];
        await tenant.save();
    }

    console.log('Seed completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

seed();
