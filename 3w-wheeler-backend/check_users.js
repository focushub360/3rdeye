import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const UserSchema = new mongoose.Schema({
  email: String,
  role: String,
  tenantId: mongoose.Schema.Types.ObjectId,
  username: String
});

const User = mongoose.model('User', UserSchema);

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const users = await User.find({ tenantId: new mongoose.Types.ObjectId('69fdb570ac9f01ed2790fe54') });
  console.log('Users in tenant 69fdb570ac9f01ed2790fe54:');
  console.log(users.map(u => ({ email: u.email, role: u.role, username: u.username })));
  
  await mongoose.disconnect();
}

check().catch(console.error);
