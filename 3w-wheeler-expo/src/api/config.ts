import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// IMPORTANT: Replace this with your computer's local IP address
// You can find it by running 'ipconfig' on Windows
export const BASE_URL = 'http://192.168.31.125:5001/api';

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Add a request interceptor to automatically attach the auth token
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync('user_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Interceptor token retrieval error:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default apiClient;
