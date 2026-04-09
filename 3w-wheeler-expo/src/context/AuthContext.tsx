import React, { createContext, useContext, useState, useEffect } from 'react';
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
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  login: (data: { token: string; user: User }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStoredAuth = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync('user_token');
        const storedUser = await SecureStore.getItemAsync('user_data');

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          
          // Set authorization header globally
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        }
      } catch (error) {
        console.error('Error loading auth state:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStoredAuth();
  }, []);

  const login = async (data: { token: string; user: User }) => {
    setToken(data.token);
    setUser(data.user);
    
    // Save to device
    await SecureStore.setItemAsync('user_token', data.token);
    await SecureStore.setItemAsync('user_data', JSON.stringify(data.user));
    
    // Set authorization header globally
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
  };

  const logout = async () => {
    setToken(null);
    setUser(null);
    
    // Remove from device
    await SecureStore.deleteItemAsync('user_token');
    await SecureStore.deleteItemAsync('user_data');
    
    // Clear global header
    delete apiClient.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ token, user, isLoading, login, logout }}>
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
