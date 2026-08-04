import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Automatically detect environment and set API base URL
// IMPORTANT: For local development, replace the IP with your computer's local IP address
const LOCAL_IP = '192.168.31.205'; // Updated to match current network (192.168.31.205)
const FORCE_STAGING = false; // Use the local backend during development.
const IS_DEV = __DEV__ && !FORCE_STAGING;

// Use localhost for web to avoid CORS/Network issues on the same machine
const DEV_URL = Platform.OS === 'web' 
  ? `http://localhost:5000/api/` 
  : `http://${LOCAL_IP}:5000/api/`;

const STAGING_URL = 'https://threew-vu4v.onrender.com/api/';

console.log('🛡️ API Client Module Loading...');

export let BASE_URL = IS_DEV 
  ? DEV_URL
  : STAGING_URL;

export let ROOT_URL = BASE_URL.replace('/api/', '');

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Accept': 'application/json',
  },
  timeout: 120000, // Increased to 2 minutes for large form submissions
});

let lastCheckTime = 0;
const CHECK_COOLDOWN = 30000; // 30 seconds

export const checkServerReachability = async (force = false) => {
  if (!IS_DEV) return;
  
  const now = Date.now();
  if (!force && now - lastCheckTime < CHECK_COOLDOWN) {
    return;
  }
  
  lastCheckTime = now;
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 1500); // 1.5s timeout for fast check
    
    const response = await fetch(`http://${LOCAL_IP}:5000/api`, {
      signal: controller.signal
    });
    clearTimeout(id);
    
    if (response.status === 200 || response.status === 401 || response.status === 403 || response.status === 404) {
      console.log(`📶 Local server is REACHABLE. Using local backend: ${DEV_URL}`);
      apiClient.defaults.baseURL = DEV_URL;
      BASE_URL = DEV_URL;
      ROOT_URL = DEV_URL.replace('/api/', '');
    } else {
      throw new Error('Unreachable status');
    }
  } catch (err) {
    console.log(`📶 Local server is UNREACHABLE. Falling back to staging/production: ${STAGING_URL}`);
    apiClient.defaults.baseURL = STAGING_URL;
    BASE_URL = STAGING_URL;
    ROOT_URL = STAGING_URL.replace('/api/', '');
  }
};

// Start initial check asynchronously
checkServerReachability();

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
    // Prioritize the global Authorization header set synchronously in defaults (e.g. by AuthContext during login)
    const defaultAuth = apiClient.defaults.headers.common['Authorization'];
    if (defaultAuth) {
      config.headers.Authorization = defaultAuth;
    } else {
      // Fallback to SecureStore/localStorage if not already in defaults (e.g. at startup)
      const token = await getStoredToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    
    // Add app type header for backend debugging
    config.headers['X-App-Type'] = 'mobile-app';
    
    // Ensure URL doesn't have leading slash when using baseURL with trailing slash
    // This prevents Axios from stripping the '/api' part of the URL
    if (config.url?.startsWith('/')) {
      config.url = config.url.substring(1);
    }
    
    const authVal = config.headers.Authorization;
    const authStr = typeof authVal === 'string' ? authVal : '';
    console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url} - Auth Header: ${authStr ? authStr.substring(0, 30) + '...' : 'NONE'}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default apiClient;
