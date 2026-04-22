import "../config/env.js";
import connectDB from "../config/database.js";
import User from "../models/User.js";
import Tenant from "../models/Tenant.js";

async function verify() {
  await connectDB();
  const tenant = await Tenant.findOne({ slug: 'laxmi-metals-tvs' });
  if (!tenant) {
    console.log("Tenant not found");
    process.exit(1);
  }
  console.log("Tenant ID:", tenant._id, "Type:", typeof tenant._id);
  const users = await User.find({ tenantId: tenant._id });
  console.log("Users found by ObjectId:", users.length);
  
  const usersStr = await User.find({ tenantId: tenant._id.toString() });
  console.log("Users found by String:", usersStr.length);

  const allUsers = await User.find({});
  console.log("Checking all users for Laxmi Metals name...");
  allUsers.forEach(u => {
    if (u.firstName?.includes('Laxmi') || u.lastName?.includes('Metals') || u.username?.includes('laxmi')) {
        console.log(`- Found: ${u.firstName} ${u.lastName} [${u.role}] TenantId: ${u.tenantId}`);
    }
  });

  process.exit(0);
}

verify();
