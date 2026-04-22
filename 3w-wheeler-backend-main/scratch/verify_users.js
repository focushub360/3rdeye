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
  console.log("Tenant ID:", tenant._id);
  const users = await User.find({ tenantId: tenant._id });
  console.log("Total users found:", users.length);
  users.forEach(u => {
    console.log(`- ${u.firstName} ${u.lastName} [${u.role}] (${u.email})`);
  });
  process.exit(0);
}

verify();
