import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Form from '../../models/Form.js';

dotenv.config();

const uri = "mongodb+srv://littleflowerschool:Focus123engineering@cluster0.gmxndg9.mongodb.net/form?retryWrites=true&w=majority";

async function measureForms() {
  try {
    await mongoose.connect(uri);
    const forms = await Form.find({ 
      tenantId: new mongoose.Types.ObjectId('69c10f30b592ddf7f17c44f4') 
    }).lean();
    
    const size = Buffer.byteLength(JSON.stringify(forms));
    console.log('--- FORM LIST STATS ---');
    console.log('Total Forms:', forms.length);
    console.log('Total JSON Size:', (size / 1024 / 1024).toFixed(2), 'MB');
    
    if (forms.length > 0) {
      const avgSize = size / forms.length;
      console.log('Average Form Size:', (avgSize / 1024).toFixed(2), 'KB');
    }
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

measureForms();
