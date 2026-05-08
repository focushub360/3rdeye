import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Automatically detect environment and set API base URL
// IMPORTANT: For local development, replace the IP with your computer's local IP address
const LOCAL_IP = '10.46.135.247'; // Updated to match current network (10.46.135.247)
const IS_DEV = __DEV__;

// Use localhost for web to avoid CORS/Network issues on the same machine
const DEV_URL = Platform.OS === 'web' 
  ? `http://localhost:5001/api/` 
  : `http://${LOCAL_IP}:5001/api/`;

console.log('🛡️ API Client Module Loading...');
console.log('🔗 Mobile API Base URL:', IS_DEV ? DEV_URL : 'Production URL');

export const BASE_URL = IS_DEV 
  ? DEV_URL
  : 'https://threew-vu4v.onrender.com/api/';

console.log(`🔗 Mobile API Base URL: ${BASE_URL} (Mode: ${IS_DEV ? 'Development' : 'Production'})`);


const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Accept': 'application/json',
  },
  timeout: 120000, // Increased to 2 minutes for large form submissions
});

// Helper to get token based on platform
const getStoredToken = async () => {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem('user_token');
    }
    return await SecureStore.getItemAsync('user_token');
  } catch (error) {
    console.error('Error getting stored token:', error);
    return null;
  }
};

// Add a request interceptor to automatically attach the auth token
apiClient.interceptors.request.use(
  async (config) => {
    const token = await getStoredToken();
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      if (__DEV__ && Platform.OS === 'web') {
        // console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url} - Token attached`);
      }
    } else {
      // Fallback: check if it's already in the defaults (set by AuthContext)
      const defaultAuth = apiClient.defaults.headers.common['Authorization'];
      if (defaultAuth) {
        config.headers.Authorization = defaultAuth;
      } else if (__DEV__ && Platform.OS === 'web') {
        console.warn(`[API Request] ${config.method?.toUpperCase()} ${config.url} - NO TOKEN FOUND`);
      }
    }
    
    // Add app type header for backend debugging
    config.headers['X-App-Type'] = 'mobile-app';
    
    // Ensure URL doesn't have leading slash when using baseURL with trailing slash
    // This prevents Axios from stripping the '/api' part of the URL
    if (config.url?.startsWith('/')) {
      config.url = config.url.substring(1);
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default apiClient;
