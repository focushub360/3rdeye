import mongoose from 'mongoose';

const uri = 'mongodb+srv://focushub360db:Priya%40123@focusforms.8im0otd.mongodb.net/3wheelertvs?retryWrites=true&w=majority';

async function testFastExport() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const col = db.collection('formsessions');
  const total = await col.countDocuments();
  console.log('Total formsessions:', total);

  const start = Date.now();
  let count = 0;
  let lastId = null;

  while (true) {
    const query = lastId ? { _id: { $gt: lastId } } : {};
    const batch = await col.find(query).sort({ _id: 1 }).limit(500).toArray();
    if (!batch.length) break;

    count += batch.length;
    lastId = batch[batch.length - 1]._id;
    console.log(`Fetched ${count}/${total} in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  }

  console.log(`🎉 Done in ${((Date.now() - start) / 1000).toFixed(2)}s`);
  await mongoose.connection.close();
}

testFastExport();
