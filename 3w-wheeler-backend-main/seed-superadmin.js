import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import connectDB from './config/database.js';

dotenv.config();

const seedSuperAdmin = async () => {
  try {
    await connectDB();
    console.log('Connected to database for seeding superadmin...');

    const adminEmail = 'superadmin@focus.com';
    let admin = await User.findOne({ email: adminEmail.toLowerCase() });

    if (!admin) {
      console.log('Creating SuperAdmin...');
      admin = new User({
        username: 'superadmin',
        email: adminEmail.toLowerCase(),
        password: 'admin123',
        firstName: 'Super',
        lastName: 'Admin',
        role: 'superadmin',
        isActive: true
      });
      await admin.save();
      console.log('SuperAdmin created successfully.');
    } else {
      console.log('SuperAdmin already exists. Updating password...');
      admin.password = 'admin123';
      admin.isActive = true;
      await admin.save();
    }

    console.log('\nSeeding completed successfully!');

  } catch (error) {
    console.error('Seeding failed:', error);
  } finally {
    mongoose.connection.close();
  }
};

seedSuperAdmin();
