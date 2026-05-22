import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  colors: typeof LightColors;
}

const LightColors = {
  background: '#ffffff',
  card: '#ffffff',
  text: '#0f172a',
  subtext: '#64748b',
  border: '#f1f5f9',
  accent: '#4f46e5',
  surface: '#f8fafc',
  error: '#ef4444',
  success: '#10b981',
  warning: '#f59e0b',
};

const DarkColors = {
  background: '#020617',
  card: '#0f172a',
  text: '#f8fafc',
  subtext: '#94a3b8',
  border: '#1e293b',
  accent: '#818cf8',
  surface: '#1e293b',
  error: '#f87171',
  success: '#34d399',
  warning: '#fbbf24',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('app_theme');
      if (savedTheme) {
        setTheme(savedTheme as Theme);
      } else {
        setTheme(systemColorScheme === 'dark' ? 'dark' : 'light');
      }
    } catch (e) {
      console.error('Failed to load theme', e);
    }
  };

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    try {
      await AsyncStorage.getItem('app_theme');
      await AsyncStorage.setItem('app_theme', newTheme);
    } catch (e) {
      console.error('Failed to save theme', e);
    }
  };

  const colors = theme === 'dark' ? DarkColors : LightColors;
  const isDark = theme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
