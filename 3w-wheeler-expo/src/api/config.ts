import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Automatically detect environment and set API base URL
// IMPORTANT: For local development, replace the IP with your computer's local IP address
const LOCAL_IP = '192.168.31.181'; // Updated to match current network (192.168.31.181)
const IS_DEV = __DEV__;

export const BASE_URL = IS_DEV 
  ? `http://${LOCAL_IP}:5001/api`
  : 'https://3wheelertvsbackend.focusengineeringapp.com/api';

console.log(`🔗 Mobile API Base URL: ${BASE_URL} (Mode: ${IS_DEV ? 'Development' : 'Production'})`);


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
