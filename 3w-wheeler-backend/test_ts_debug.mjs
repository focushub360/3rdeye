import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

// Replicate getResponseTimestamp from FormAnalyticsDashboard.tsx
const getResponseTimestamp = (response) => {
  if (!response) return undefined;

  const currentYear = new Date().getFullYear();
  const isValidYear = (d) => {
    if (!d || isNaN(d.getTime())) return false;
    const y = d.getFullYear();
    return y >= 2020 && y <= currentYear + 1;
  };

  const toDate = (val) => {
    if (!val) return null;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  };

  const rawCandidates = [
    response.submittedAt,
    response.createdAt,
    response.timestamp,
    response.submissionMetadata?.submittedAt,
    response.submissionMetadata?.capturedLocation?.capturedAt,
    response.updatedAt,
    response.dispatchedAt,
  ];

  for (const c of rawCandidates) {
    if (!c) continue;
    const d = toDate(c);
    if (d && isValidYear(d)) {
      return d.toISOString();
    }
  }

  const fallback =
    response.submittedAt ||
    response.createdAt ||
    response.timestamp ||
    response.submissionMetadata?.submittedAt ||
    response.submissionMetadata?.capturedLocation?.capturedAt;
  if (fallback) {
    const d = toDate(fallback);
    if (d) {
      if (d.getFullYear() > currentYear + 1) {
        d.setFullYear(currentYear);
      }
      return d.toISOString();
    }
  }

  return undefined;
};

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const rCol = mongoose.connection.db.collection('responses');
  const formsCol = mongoose.connection.db.collection('forms');
  const form = await formsCol.findOne({ title: /LB Aft Paint/i });
  const targetIds = [form.id, form._id.toString()];

  const sepResponses = await rCol.find({
    questionId: { $in: targetIds },
    createdAt: {
      $gte: new Date('2026-09-01T00:00:00.000Z'),
      $lte: new Date('2026-09-12T23:59:59.999Z')
    }
  }).toArray();

  console.log('Found Sep 1-12 responses:', sepResponses.length);
  const sample = sepResponses[0];
  console.log('Sample fields:', {
    _id: sample._id,
    id: sample.id,
    questionId: sample.questionId,
    createdAt: sample.createdAt,
    submittedAt: sample.submittedAt,
    timestamp: sample.timestamp,
    submissionMetadata: sample.submissionMetadata,
    submittedBy: sample.submittedBy
  });

  const parsedDates = {};
  sepResponses.forEach(r => {
    const ts = getResponseTimestamp(r);
    const d = ts ? new Date(ts).toISOString().split('T')[0] : 'no-ts';
    parsedDates[d] = (parsedDates[d] || 0) + 1;
  });
  console.log('Parsed dates with getResponseTimestamp:', parsedDates);

  // Now test dateFilter: startDate: '2026-09-01', endDate: '2026-09-12'
  const filterStart = '2026-09-01';
  const filterEnd = '2026-09-12';
  const filtered = sepResponses.filter(r => {
    const ts = getResponseTimestamp(r);
    if (!ts) return false;
    const responseDate = new Date(ts).toISOString().split('T')[0];
    return responseDate >= filterStart && responseDate <= filterEnd;
  });
  console.log(`Matching dateFilter range ${filterStart} to ${filterEnd}:`, filtered.length);

  const submitters = {};
  const tenants = {};
  sepResponses.forEach(r => {
    submitters[r.submittedBy] = (submitters[r.submittedBy] || 0) + 1;
    tenants[String(r.tenantId)] = (tenants[String(r.tenantId)] || 0) + 1;
  });
  console.log('Sep 1-12 submitters:', submitters);
  console.log('Sep 1-12 tenantIds:', tenants);
  console.log('Form tenantId:', String(form.tenantId));

  const noCreatedAt = await rCol.countDocuments({
    questionId: { $in: targetIds },
    createdAt: { $exists: false }
  });
  console.log('No createdAt count:', noCreatedAt);

  const nullCreatedAt = await rCol.countDocuments({
    questionId: { $in: targetIds },
    createdAt: null
  });
  console.log('Null createdAt count:', nullCreatedAt);

  process.exit(0);
}

run().catch(console.error);
