import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const mongoUri = process.env.MONGODB_URI || "mongodb+srv://littleflowerschool:Focus123engineering@cluster0.gmxndg9.mongodb.net/form?retryWrites=true&w=majority";

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected to database.');
  
  const db = mongoose.connection.db;
  const usersCollection = db.collection('users');
  const tenantsCollection = db.collection('tenants');
  
  const user = await usersCollection.findOne({ email: 'vicky@gmail.com' });
  if (user) {
    console.log('\n--- User Details ---');
    console.log('ID:', user._id);
    console.log('Email:', user.email);
    console.log('Username:', user.username);
    console.log('isActive:', user.isActive);
    console.log('TenantId:', user.tenantId);
    
    if (user.isActive === false || user.isActive === undefined) {
      console.log('Activating user...');
      const userRes = await usersCollection.updateOne({ _id: user._id }, { $set: { isActive: true } });
      console.log('User update result:', userRes);
    }
    
    if (user.tenantId) {
      const tenant = await tenantsCollection.findOne({ _id: user.tenantId });
      if (tenant) {
        console.log('\n--- Tenant Details ---');
        console.log('ID:', tenant._id);
        console.log('Name:', tenant.name);
        console.log('Slug:', tenant.slug);
        console.log('isActive:', tenant.isActive);
        console.log('Subscription:', tenant.subscription);
        
        if (tenant.isActive === false || tenant.isActive === undefined) {
          console.log('Activating tenant...');
          const tenantRes = await tenantsCollection.updateOne({ _id: tenant._id }, { $set: { isActive: true } });
          console.log('Tenant update result:', tenantRes);
        }
      } else {
        console.log(`\nTenant not found with ID: ${user.tenantId}`);
      }
    }
  } else {
    console.log('User vicky@gmail.com not found!');
  }
  
  await mongoose.disconnect();
}

run().catch(console.error);
