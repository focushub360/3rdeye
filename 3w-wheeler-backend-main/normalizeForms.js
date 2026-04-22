import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Form from './models/Form.js';

dotenv.config();

const normalizeQuestionType = (type) => {
  if (!type) return type;
  
  let normalizedType = String(type)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') 
    .replace(/\s*\/\s*/g, ''); 
  
  const typeMap = {
    'shorttext': 'text',
    'shortint': 'text',
    'multiplechoice': 'radio',
    'multiple choice': 'radio',
    'longtext': 'paragraph',
    'longinput': 'paragraph',
    'dropdown': 'select',
    'checkboxes': 'checkbox',
    'fileupload': 'file',
    'file upload': 'file',
    'yesnona': 'yesNoNA',
    'yes/no/na': 'yesNoNA',
    'text': 'text',
    'radio': 'radio',
    'paragraph': 'paragraph',
    'select': 'select',
    'checkbox': 'checkbox',
    'email': 'email',
    'url': 'url',
    'tel': 'tel',
    'date': 'date',
    'time': 'time',
    'file': 'file',
    'range': 'range',
    'rating': 'rating',
    'scale': 'scale',
    'radio-grid': 'radio-grid',
    'checkbox-grid': 'checkbox-grid',
    'radio-image': 'radio-image',
    'search-select': 'search-select',
    'number': 'number',
    'location': 'location',
    'yesNoNA': 'yesNoNA'
  };
  
  return typeMap[normalizedType] || typeMap[normalizedType.replace(/\s/g, '')] || type;
};

const normalizeAllForms = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const forms = await Form.find();
        let totalModified = 0;

        for (const form of forms) {
            let formModified = false;

            // 1. Normalize sections
            if (form.sections) {
                form.sections.forEach(section => {
                    if (section.questions) {
                        section.questions.forEach(q => {
                            const oldType = q.type;
                            q.type = normalizeQuestionType(q.type);
                            if (oldType !== q.type) formModified = true;

                            if (q.followUpQuestions) {
                                q.followUpQuestions.forEach(fq => {
                                    const oldFQType = fq.type;
                                    fq.type = normalizeQuestionType(fq.type);
                                    if (oldFQType !== fq.type) formModified = true;
                                });
                            }
                        });
                    }
                });
            }

            // 2. Normalize top-level follow-ups
            if (form.followUpQuestions) {
                form.followUpQuestions.forEach(q => {
                  const oldType = q.type;
                  q.type = normalizeQuestionType(q.type);
                  if (oldType !== q.type) formModified = true;
                });
            }

            if (formModified) {
                form.markModified('sections');
                form.markModified('followUpQuestions');
                await form.save();
                totalModified++;
                console.log(`✅ Normalized form: ${form.title}`);
            }
        }

        console.log(`Done! Normalized ${totalModified} forms.`);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

normalizeAllForms();
