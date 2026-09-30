import axios from 'axios';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const usersCol = mongoose.connection.db.collection('users');
  const user = await usersCol.findOne({ role: 'admin', tenantId: new mongoose.Types.ObjectId('6a461748cbbdff3abd815c29') });
  console.log('Using admin user:', user.username, user._id);

  const token = jwt.sign(
    { id: user._id, role: user.role, tenantId: user.tenantId },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '7d' }
  );

  const formId = '49046642-beab-44a8-b81b-7d83e6bfa028'; // LB Bef Paint

  // Let's test page 1 with limit 1000
  try {
    const res1 = await axios.get(`http://localhost:5000/api/responses/form/${formId}?analytics=true&page=1&limit=1000`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Page 1 result:', {
      success: res1.data.success,
      responsesCount: res1.data.data?.responses?.length,
      pagination: res1.data.data?.pagination
    });

    const page1Responses = res1.data.data?.responses || [];
    let p1Sep1to12 = 0;
    let p1Sep13to30 = 0;
    page1Responses.forEach(r => {
      const d = (r.createdAt || r.submittedAt || '').split('T')[0];
      if (d >= '2026-09-01' && d <= '2026-09-12') p1Sep1to12++;
      if (d >= '2026-09-13' && d <= '2026-09-30') p1Sep13to30++;
    });
    console.log(`Page 1 (1000 items) Sep counts: Sep 1-12: ${p1Sep1to12}, Sep 13-30: ${p1Sep13to30}`);

  } catch (err) {
    console.error('API Error:', err.message, err.response?.data);
  }

  process.exit(0);
}

run().catch(console.error);
