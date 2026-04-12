import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Tenant from './models/Tenant.js';
import connectDB from './config/database.js';

dotenv.config();

const testLogin = async () => {
  try {
    await connectDB();
    const email = 'lmadmin@focus.com';
    const password = 'admin123';
    const tenantSlug = 'laxmi-metals-tvs';

    console.log(`\nTesting login for: ${email}`);
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      console.log('❌ User not found in DB!');
      return;
    }
    console.log('✅ User found.');

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      console.log('❌ Password invalid!');
    } else {
      console.log('✅ Password valid.');
    }

    const tenant = await Tenant.findOne({ slug: tenantSlug });
    if (!tenant) {
      console.log('❌ Tenant not found!');
    } else {
      console.log('✅ Tenant found.');
      if (tenant._id.toString() !== user.tenantId.toString()) {
         console.log(`❌ Tenant ID mismatch! User's tenant: ${user.tenantId}, Found tenant: ${tenant._id}`);
      } else {
         console.log('✅ Tenant ID matches.');
      }
    }

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    mongoose.connection.close();
  }
};

testLogin();
