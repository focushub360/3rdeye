import mongoose from 'mongoose';
import dotenv from 'dotenv';
import './config/env.js';

const MONGO_URI = process.env.MONGODB_URI;

async function checkFormStructure() {
  try {
    await mongoose.connect(MONGO_URI);
    const Form = mongoose.model('Form', new mongoose.Schema({}, { strict: false }));
    
    const form = await Form.findOne({ title: "LB Bef Paint" });
    if (!form) {
      console.log('Form not found');
      process.exit(0);
    }

    console.log('Form:', form.title);
    form.sections.forEach(section => {
      section.questions.forEach(q => {
        if (q.text && q.text.includes("Latch rod")) {
          console.log('\nQuestion Found:');
          console.log(JSON.stringify(q, null, 2));
        }
      });
    });

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
checkFormStructure();
