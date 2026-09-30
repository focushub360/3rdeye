const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI).then(async () => {
  const Form = require('./models/Form');
  const form = await Form.findOne({ title: /N604 BIW/i });
  if (form) {
    form.sections.forEach(s => {
      s.questions.forEach(q => {
        console.log(q.text, ' (', q.type, ')');
      });
    });
  } else {
    console.log('form not found');
  }
  process.exit();
}).catch(console.error);
