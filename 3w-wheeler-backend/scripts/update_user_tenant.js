import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

import User from './models/User.js';
import Tenant from './models/Tenant.js';

async function update() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // The LMPL tenant ID we found earlier
    const lmplTenantId = '69f9c55c48985561f10983ee';
    
    // Update both variations of krishna
    const result = await User.updateMany(
      { email: { $in: ['krishna@focusengineering.in', 'krishnaa@focusengineering.in'] } },
      { tenantId: new mongoose.Types.ObjectId(lmplTenantId) }
    );
    
    console.log(`Updated ${result.modifiedCount} users to LMPL tenant.`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

update();
