import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Tenant from './models/Tenant.js';
import connectDB from './config/database.js';

dotenv.config();

const seedLaxmiData = async () => {
  try {
    await connectDB();
    console.log('Connected to database for seeding...');

    // 1. Create or Update Tenant
    const tenantSlug = 'laxmi-metals-tvs';
    let tenant = await Tenant.findOne({ slug: tenantSlug });

    if (!tenant) {
      console.log('Creating Laxmi Metals TVS tenant...');
      tenant = new Tenant({
        name: 'Laxmi Metals TVS',
        slug: tenantSlug,
        companyName: 'Laxmi Metals TVS pvt ltd',
        isActive: true,
        subscription: {
          plan: 'free',
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          maxUsers: 10,
          maxForms: 10
        }
      });
      await tenant.save();
    } else {
      console.log('Laxmi Metals TVS tenant already exists.');
    }

    // 2. Create or Update Admin User
    const adminEmail = 'lmadmin@focus.com';
    let admin = await User.findOne({ email: adminEmail.toLowerCase() });

    if (!admin) {
      console.log('Creating Laxmi Metals Admin...');
      admin = new User({
        username: 'lmadmin',
        email: adminEmail.toLowerCase(),
        password: 'admin123',
        firstName: 'Laxmi Metal',
        lastName: 'Admin',
        role: 'admin',
        tenantId: tenant._id,
        isActive: true
      });
      await admin.save();
      console.log('Admin user created successfully.');
    } else {
      console.log('Admin user already exists. Updating tenant association...');
      admin.tenantId = tenant._id;
      admin.password = 'admin123'; // Reset password to ensure it matches
      admin.isActive = true;
      await admin.save();
    }

    console.log('\nSeeding completed successfully!');
    console.log('Tenant Slug: laxmi-metals-tvs');
    console.log('Email: lmadmin@focus.com');
    console.log('Password: admin123');

  } catch (error) {
    console.error('Seeding failed:', error);
  } finally {
    mongoose.connection.close();
  }
};

seedLaxmiData();
