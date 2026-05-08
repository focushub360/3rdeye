
import axios from 'axios';

async function testFetch() {
  try {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OWY5Y2I2ZTQ4OTg1NTYxZjEwOTg3YzQiLCJpYXQiOjE3NzgyMDYyOTAsImV4cCI6MTc3ODIwOTg5MH0.jIWPEBFfjeMn0bGi28PgrINvjR8mQ9CnFNZBPCyhAzM';
    const res = await axios.get('http://localhost:5001/api/analytics/dashboard', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Success:', res.status, res.data);
  } catch (error) {
    console.log('Error:', error.response?.status);
    console.log('Error data:', error.response?.data);
  }
}

testFetch();
