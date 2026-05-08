
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/3w-wheeler';

async function checkResponses() {
  try {
    console.log('Connecting to:', MONGO_URI);
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const Response = mongoose.model('Response', new mongoose.Schema({}, { strict: false }));
    const Form = mongoose.model('Form', new mongoose.Schema({}, { strict: false }));

    const forms = await Form.find({});
    console.log(`Found ${forms.length} forms in database`);

    for (const form of forms) {
      const qId = form.id;
      const mongoId = form._id.toString();
      
      const count = await Response.countDocuments({ 
        $or: [
          { questionId: qId },
          { questionId: mongoId }
        ]
      });
      
      if (count > 0) {
        console.log(`\nForm: ${form.title}`);
        console.log(`  String ID: ${qId}`);
        console.log(`  Mongo _id: ${mongoId}`);
        console.log(`  Responses found: ${count}`);
        
        const sample = await Response.findOne({ 
          $or: [
            { questionId: qId },
            { questionId: mongoId }
          ]
        });
        console.log(`  Sample Response id: ${sample.id}`);
        console.log(`  Sample Response tenantId: ${sample.tenantId}`);
        console.log(`  Form tenantId: ${form.tenantId}`);
        
        // Check if tenantIds match
        if (sample.tenantId && form.tenantId && sample.tenantId.toString() !== form.tenantId.toString()) {
          console.log(`  ⚠️ WARNING: Tenant IDs MISMATCH!`);
        }
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkResponses();
