require('dotenv').config();
const mongoose = require('mongoose');

async function listCredentials() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');
  
  const db = mongoose.connection.db;
  const users = await db.collection('users').find({}).toArray();
  const tenants = await db.collection('tenants').find({}).toArray();
  
  console.log('\n--- TENANTS ---');
  tenants.forEach(t => {
    console.log(`Name: ${t.name} | Slug: ${t.slug}`);
  });
  
  console.log('\n--- USERS ---');
  users.forEach(u => {
    const tenant = tenants.find(t => t._id.toString() === u.tenantId?.toString());
    console.log(`Name: ${u.firstName} ${u.lastName} | Email: ${u.email} | Role: ${u.role} | Tenant Slug: ${tenant ? tenant.slug : 'NONE'}`);
  });
  
  await mongoose.connection.close();
}

listCredentials().catch(console.error);
