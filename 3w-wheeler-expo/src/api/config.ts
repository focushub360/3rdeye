import axios from 'axios';

// IMPORTANT: Replace this with your computer's local IP address
// You can find it by running 'ipconfig' on Windows
export const BASE_URL = 'http://192.168.31.181:5000/api';

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

export default apiClient;
