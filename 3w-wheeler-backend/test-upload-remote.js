import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

async function run() {
  console.log('Testing upload to remote server...');
  const form = new FormData();
  
  // Create a temporary small text file to upload
  fs.writeFileSync('temp-test.txt', 'Hello, this is a test upload file.');
  form.append('file', fs.createReadStream('temp-test.txt'));
  form.append('associatedType', 'general');

  try {
    const response = await axios.post('https://threew-vu4v.onrender.com/api/files/upload', form, {
      headers: {
        ...form.getHeaders(),
        'X-App-Type': 'mobile-app'
      }
    });

    console.log('Upload Response Status:', response.status);
    console.log('Upload Response Data:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Upload failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
  } finally {
    try {
      fs.unlinkSync('temp-test.txt');
    } catch (e) {}
  }
}

run().catch(console.error);
