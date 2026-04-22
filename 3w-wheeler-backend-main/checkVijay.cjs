require('dotenv').config();
const mongoose = require('mongoose');

async function checkInspectorPermissions() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');
  
  const db = mongoose.connection.db;
  const user = await db.collection('users').findOne({ email: 'vijay@gmail.com' });
  const roles = await db.collection('roles').find({}).toArray();
  
  console.log('\n--- VIJAY USER ---');
  console.log(`Role: ${user.role} | Permissions: ${JSON.stringify(user.permissions)}`);
  
  if (user.role) {
    const roleDoc = roles.find(r => r.name.toLowerCase() === user.role.toLowerCase());
    if (roleDoc) {
      console.log(`\n--- ROLE: ${roleDoc.name} ---`);
      console.log(`Role Permissions: ${JSON.stringify(roleDoc.permissions)}`);
    }
  }
  
  await mongoose.connection.close();
}

checkInspectorPermissions().catch(console.error);
