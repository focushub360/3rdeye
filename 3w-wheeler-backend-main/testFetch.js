import axios from 'axios';

const testFormFetch = async () => {
    try {
        const loginResponse = await axios.post('http://localhost:5001/api/auth/login', {
            email: 'lmadmin@focus.com',
            password: 'admin123#'
        });
        
        const token = loginResponse.data.token;
        console.log('Login Successful');

        const formId = '1aa07a40-31e7-457f-9a04-06ea7f7c637b';
        const response = await axios.get(`http://localhost:5001/api/forms/${formId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        const form = response.data;
        console.log('Form Title:', form.title);
        
        const section = form.sections.find(s => s.title.includes('Section-1'));
        if (section) {
            console.log('Target Section Found');
            const questions = section.questions;
            questions.forEach((q, i) => {
                console.log(`Q${i+1} [${q.type}]: ${q.text}`);
                console.log(`Options: ${JSON.stringify(q.options)}`);
            });
        }
    } catch (err) {
        console.error('Error:', err.response?.data || err.message);
    }
}

testFormFetch();
