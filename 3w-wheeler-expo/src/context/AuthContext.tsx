import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import apiClient from '../api/config';

interface User {
  id: string;
  _id?: string;
  email: string;
  role: string;
  name?: string;
  username?: string;
  tenantId?: string;
  tenant?: {
    id: string;
    name: string;
    slug: string;
  };
  phone?: string;
  mobile?: string;
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  sessionLogId: string | null;
  isCheckedIn: boolean;
  isLoading: boolean;
  setIsCheckedIn: (val: boolean) => void;
  login: (data: { token: string; user: User; sessionLogId?: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [sessionLogId, setSessionLogId] = useState<string | null>(null);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStoredAuth = async () => {
      try {
        if (Platform.OS === 'web') {
          const webToken = localStorage.getItem('user_token');
          const webUser = localStorage.getItem('user_data');
          if (webToken && webUser) {
            const parsedUser = JSON.parse(webUser);
            setToken(webToken);
            setUser(parsedUser);
            apiClient.defaults.headers.common['Authorization'] = `Bearer ${webToken}`;
            apiClient.defaults.headers.common['X-App-Type'] = 'mobile-app';
            setIsLoading(false);
            return;
          }
        }

        const storedToken = await SecureStore.getItemAsync('user_token');
        const storedUser = await SecureStore.getItemAsync('user_data');
        const storedLogId = await SecureStore.getItemAsync('session_log_id');

        if (storedToken && storedUser) {
          const parsedUser = JSON.parse(storedUser);
          
          setToken(storedToken);
          setUser(parsedUser);
          setSessionLogId(storedLogId);
          
          // Set authorization header globally
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          apiClient.defaults.headers.common['X-App-Type'] = 'mobile';

          // Background sync to get latest user profile
          try {
            const profileRes = await apiClient.get('/auth/profile');
            if (profileRes.data.success && profileRes.data.data.user) {
              const freshUser = profileRes.data.data.user;
              setUser(freshUser);
              await SecureStore.setItemAsync('user_data', JSON.stringify(freshUser));
            }
          } catch (e) {
            console.log('Background profile sync failed', e);
          }
        }
      } catch (error) {
        console.error('Error loading auth state:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStoredAuth();
  }, []);

  useEffect(() => {
    const fetchCheckInStatus = async () => {
      if (user?.role === 'inspector' && token) {
        try {
          const res = await apiClient.get('/hr/attendance/my-status');
          if (res.data.success) {
            const statusData = res.data.data;
            const isChecked = !!statusData?.attendance?.checkInTime && !statusData?.attendance?.checkOutTime;
            setIsCheckedIn(isChecked);
          }
        } catch (error) {
          console.log('Failed to fetch initial check-in status:', error);
        }
      }
    };
    fetchCheckInStatus();
  }, [user, token]);

  const login = async (data: { token: string; user: User; sessionLogId?: string }) => {
    setToken(data.token);
    setUser(data.user);
    if (data.sessionLogId) setSessionLogId(data.sessionLogId);
    
    // Save to device
    if (Platform.OS === 'web') {
      localStorage.setItem('user_token', data.token);
      localStorage.setItem('user_data', JSON.stringify(data.user));
      if (data.sessionLogId) localStorage.setItem('session_log_id', data.sessionLogId);
    }
    await SecureStore.setItemAsync('user_token', data.token);
    await SecureStore.setItemAsync('user_data', JSON.stringify(data.user));
    if (data.sessionLogId) await SecureStore.setItemAsync('session_log_id', data.sessionLogId);
    
    // Set authorization header globally
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    apiClient.defaults.headers.common['X-App-Type'] = 'mobile';
  };

  const logout = async () => {
    try {
      if (sessionLogId) {
        await apiClient.post('/auth/logout', { sessionLogId });
      }
    } catch (err) {
      console.warn('Logout notification failed:', err);
    }

    setToken(null);
    setUser(null);
    setSessionLogId(null);
    setIsCheckedIn(false);
    
    // Remove from device
    if (Platform.OS === 'web') {
      localStorage.removeItem('user_token');
      localStorage.removeItem('user_data');
      localStorage.removeItem('session_log_id');
    }
    await SecureStore.deleteItemAsync('user_token');
    await SecureStore.deleteItemAsync('user_data');
    await SecureStore.deleteItemAsync('session_log_id');
    
    // Clear global header
    delete apiClient.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ 
      token, 
      user, 
      sessionLogId, 
      isCheckedIn, 
      isLoading, 
      setIsCheckedIn, 
      login, 
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
