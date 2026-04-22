require('dotenv').config();
const mongoose = require('mongoose');

async function checkFormTypes() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');
  
  const db = mongoose.connection.db;
  const form = await db.collection('forms').findOne({ id: '1aa07a40-31e7-457f-9a04-06ea7f7c637b' });
  
  if (!form) {
    console.log('Form not found by id field, trying _id...');
    return;
  }
  
  console.log('\n=== FORM:', form.title, '===');
  console.log('viewType:', form.viewType);
  
  if (form.sections) {
    form.sections.forEach((section, si) => {
      console.log(`\n--- Section ${si}: ${section.title} ---`);
      if (section.questions) {
        section.questions.forEach((q, qi) => {
          console.log(`  Q${qi}: type="${q.type}" | text="${(q.text || '').substring(0, 50)}" | options=${q.options ? JSON.stringify(q.options) : 'none'}`);
          if (q.followUpQuestions && q.followUpQuestions.length > 0) {
            q.followUpQuestions.forEach((fq, fi) => {
              console.log(`    FU${fi}: type="${fq.type}" | text="${(fq.text || '').substring(0, 50)}" | options=${fq.options ? JSON.stringify(fq.options) : 'none'}`);
            });
          }
        });
      }
      if (section.subsections) {
        section.subsections.forEach((sub, subi) => {
          console.log(`  -- Subsection ${subi}: ${sub.title} --`);
          if (sub.questions) {
            sub.questions.forEach((q, qi) => {
              console.log(`    Q${qi}: type="${q.type}" | text="${(q.text || '').substring(0, 50)}" | options=${q.options ? JSON.stringify(q.options) : 'none'}`);
            });
          }
        });
      }
    });
  }
  
  await mongoose.disconnect();
}

checkFormTypes().catch(console.error);
