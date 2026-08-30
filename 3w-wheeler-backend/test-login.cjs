const axios = require('axios');

async function testLogin() {
  try {
    const res = await axios.post('http://127.0.0.1:5000/api/auth/login', {
      email: 'manojmohan@focusengineering.in',
      password: 'manojmohan@123'
    });
    console.log('Success:', res.data);
  } catch (err) {
    if (err.response) {
      console.log('Error status:', err.response.status);
      console.log('Error data:', err.response.data);
    } else {
      console.log('Error:', err.message);
    }
  }
}
testLogin();
