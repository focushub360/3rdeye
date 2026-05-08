import mongoose from 'mongoose';
import dotenv from 'dotenv';
import './config/env.js';

const MONGO_URI = process.env.MONGODB_URI;

async function checkFormImages() {
  try {
    await mongoose.connect(MONGO_URI);
    const Form = mongoose.model('Form', new mongoose.Schema({}, { strict: false }));
    
    // Find a form that likely has images
    const forms = await Form.find({ "sections.questions.imageUrl": { $exists: true, $ne: "" } }).limit(5);
    
    if (forms.length === 0) {
      console.log('No forms found with question images.');
    }

    forms.forEach(form => {
      console.log(`\nForm: ${form.title} (${form.id || form._id})`);
      form.sections.forEach(section => {
        section.questions.forEach(q => {
          if (q.imageUrl) {
            console.log(`  - Question: ${q.text || q.label}`);
            console.log(`    imageUrl: "${q.imageUrl}"`);
          }
        });
      });
    });

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
checkFormImages();
