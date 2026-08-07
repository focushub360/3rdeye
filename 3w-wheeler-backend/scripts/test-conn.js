import mongoose from 'mongoose';

const uri = 'mongodb+srv://focushub360db:Priya%40123@focusforms.8im0otd.mongodb.net/3wheelertvs?retryWrites=true&w=majority';

async function test() {
  try {
    console.log('Connecting with standard options...');
    await mongoose.connect(uri);
    console.log('✅ Connection Successful!');
    const db = mongoose.connection.db;
    const cols = await db.listCollections().toArray();
    console.log('Collections:', cols.map(c => c.name));
    await mongoose.connection.close();
  } catch (err) {
    console.error('Connection Error:', err.message);
  }
}

test();
