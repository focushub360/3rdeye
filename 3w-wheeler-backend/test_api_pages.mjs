import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
import { getResponsesByForm } from './controllers/responseController.js';
import Form from './models/Form.js';
import User from './models/User.js';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  // Find LB Bef Paint form
  const form = await Form.findOne({ title: /LB Aft Paint/i });
  console.log('Form:', form.title, 'id:', form.id, '_id:', form._id.toString());
  
  // Find an admin user
  const adminUser = await User.findOne({ role: 'admin' });
  console.log('Admin user:', adminUser.email, 'tenantId:', adminUser.tenantId);

  // Mock req, res
  let responseData = null;
  const req = {
    params: { formId: form.id },
    query: { page: '1', limit: '1000', analytics: 'true' },
    user: adminUser,
    tenantFilter: { tenantId: adminUser.tenantId }
  };
  const res = {
    status: (code) => {
      console.log('Status code:', code);
      return res;
    },
    json: (data) => {
      responseData = data;
      return res;
    }
  };

  await getResponsesByForm(req, res);
  if (responseData && responseData.data) {
    const { responses, pagination } = responseData.data;
    console.log('Page 1 responses length:', responses.length);
    console.log('Pagination:', pagination);

    // Let's check dates of page 1
    const p1Dates = {};
    responses.forEach(r => {
      const d = r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : 'no-date';
      p1Dates[d] = (p1Dates[d] || 0) + 1;
    });
    console.log('Page 1 dates summary:', Object.keys(p1Dates).sort().slice(0, 5), '...', Object.keys(p1Dates).sort().slice(-5));
    console.log('Does Page 1 contain Sep 1-12?');
    const sep1to12 = responses.filter(r => {
      const d = r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : '';
      return d >= '2026-09-01' && d <= '2026-09-12';
    });
    console.log('Sep 1-12 count in Page 1:', sep1to12.length);

    // Now test Page 2:
    if (pagination.totalPages > 1) {
      req.query.page = '2';
      let page2Data = null;
      res.json = (d) => { page2Data = d; return res; };
      await getResponsesByForm(req, res);
      const p2Responses = page2Data.data.responses;
      console.log('Page 2 responses length:', p2Responses.length);
      const sep1to12P2 = p2Responses.filter(r => {
        const d = r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : '';
        return d >= '2026-09-01' && d <= '2026-09-12';
      });
      console.log('Sep 1-12 count in Page 2:', sep1to12P2.length);
    }

    if (pagination.totalPages > 2) {
      req.query.page = '3';
      let page3Data = null;
      res.json = (d) => { page3Data = d; return res; };
      await getResponsesByForm(req, res);
      const p3Responses = page3Data.data.responses;
      console.log('Page 3 responses length:', p3Responses.length);
      const sep1to12P3 = p3Responses.filter(r => {
        const d = r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : '';
        return d >= '2026-09-01' && d <= '2026-09-12';
      });
      console.log('Sep 1-12 count in Page 3:', sep1to12P3.length);
    }
  }

  process.exit(0);
}

run().catch(console.error);
