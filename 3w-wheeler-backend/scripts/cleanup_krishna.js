import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

import User from './models/User.js';

async function cleanup() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Delete potential duplicates
    await User.deleteMany({ 
      email: { $in: ['krishna@focusengineering.in', 'krishnaa@focusengineering.in'] } 
    });
    console.log('Cleaned up existing Krishna users');
    
    const User_Model = (await import('./models/User.js')).default;
    const Tenant_Model = (await import('./models/Tenant.js')).default;
    
    let tenant = await Tenant_Model.findOne({ slug: '3w-wheeler-tvs' });
    if (!tenant) {
      tenant = new Tenant_Model({
        name: '3W Wheeler TVS',
        slug: '3w-wheeler-tvs',
        companyName: 'Focus Engineering',
        adminId: [new mongoose.Types.ObjectId()],
        isActive: true
      });
      await tenant.save();
    }

    const newUser = new User_Model({
        username: 'krishna',
        email: 'krishna@focusengineering.in',
        password: '123456',
        role: 'inspector',
        tenantId: tenant._id,
        firstName: 'Krishna',
        lastName: 'Inspector',
        isActive: true,
        accessType: 'both',
        mobile: '7904199518'
    });
    
    await newUser.save();
    console.log('User created successfully: krishna@focusengineering.in / 123456');
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

cleanup();
