import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

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

  const fallback = response.submittedAt || response.createdAt || response.timestamp;
  return fallback ? new Date(fallback).toISOString() : undefined;
};

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const rCol = db.collection('responses');
  const formsCol = db.collection('forms');

  const form = await formsCol.findOne({ title: /LB Bef Paint/i });
  const ids = [form.id, form._id.toString()];

  // Let's get ALL 2910 responses sorted by createdAt desc (as returned by API)
  const allResponses = await rCol.find({
    questionId: { $in: ids }
  }).sort({ createdAt: -1 }).toArray();

  console.log('Total responses retrieved:', allResponses.length);

  // Check how many have getResponseTimestamp in Sep 1-12
  let inSep1to12 = 0;
  let inSep13to30 = 0;
  let datesCount = {};

  allResponses.forEach((r, idx) => {
    const ts = getResponseTimestamp(r);
    const dateStr = ts ? ts.split('T')[0] : 'no-ts';
    datesCount[dateStr] = (datesCount[dateStr] || 0) + 1;

    if (dateStr >= '2026-09-01' && dateStr <= '2026-09-12') {
      inSep1to12++;
    } else if (dateStr >= '2026-09-13' && dateStr <= '2026-09-30') {
      inSep13to30++;
    }
  });

  console.log({ inSep1to12, inSep13to30 });
  console.log('Date distribution in Sep:');
  Object.keys(datesCount).filter(d => d.startsWith('2026-09')).sort().forEach(d => {
    console.log(d, ':', datesCount[d]);
  });

  // What index range are Sep 1-12 responses in the array?
  let firstSep1to12Idx = -1;
  let lastSep1to12Idx = -1;
  allResponses.forEach((r, idx) => {
    const ts = getResponseTimestamp(r);
    const dateStr = ts ? ts.split('T')[0] : '';
    if (dateStr >= '2026-09-01' && dateStr <= '2026-09-12') {
      if (firstSep1to12Idx === -1) firstSep1to12Idx = idx;
      lastSep1to12Idx = idx;
    }
  });

  console.log(`Sep 1-12 index range in allResponses (sorted createdAt: -1): ${firstSep1to12Idx} to ${lastSep1to12Idx}`);

  process.exit(0);
}

run().catch(console.error);
