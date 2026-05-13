import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

import User from './models/User.js';
import Tenant from './models/Tenant.js';

async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const users = await User.find({}).populate('tenantId');
    console.log('Users detail:');
    users.forEach(u => {
      console.log(`- ${u.username} | ${u.email} | Role: ${u.role} | Active: ${u.isActive}`);
      console.log(`  Tenant: ${u.tenantId?.name} (${u.tenantId?.slug}) | Tenant Active: ${u.tenantId?.isActive}`);
    });
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
