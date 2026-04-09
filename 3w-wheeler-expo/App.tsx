import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import ServiceAnalyticsScreen from './src/screens/ServiceAnalyticsScreen';
import ChatListScreen from './src/screens/ChatbotScreen'; // Renamed to ChatList
import ChatDetailScreen from './src/screens/ChatDetailScreen';
import HRMSScreen from './src/screens/HRMSScreen';
import FormListScreen from './src/screens/FormListScreen';
import FormPreviewScreen from './src/screens/FormPreviewScreen';
import FormAnalyticsScreen from './src/screens/FormAnalyticsScreen';
import DemoFormListScreen from './src/screens/DemoFormListScreen';
import SplashScreen from './src/screens/SplashScreen';
import { ActivityIndicator, View, StyleSheet, StatusBar, Platform } from 'react-native';
import { LayoutDashboard, MessageSquareText, Briefcase, ClipboardList } from 'lucide-react-native';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#f1f5f9',
          height: Platform.OS === 'ios' ? 100 : 85,
          paddingBottom: Platform.OS === 'ios' ? 38 : 22,
          paddingTop: 12,
          elevation: 20,
          shadowColor: '#1e3a8a',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
        },
        tabBarActiveTintColor: '#1e3a8a',
        tabBarInactiveTintColor: '#cbd5e1',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '800',
          letterSpacing: 0.5,
          marginTop: 4,
        }
      }}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={ServiceAnalyticsScreen} 
        options={{
          tabBarLabel: 'DASHBOARD',
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={22} color={color} />
        }}
      />
      <Tab.Screen 
        name="Forms" 
        component={FormListScreen} 
        options={{
          tabBarLabel: 'FORMS',
          tabBarIcon: ({ color, size }) => <ClipboardList size={22} color={color} />
        }}
      />
      <Tab.Screen 
        name="HRMS" 
        component={HRMSScreen} 
        options={{
          tabBarLabel: 'HRMS',
          tabBarIcon: ({ color, size }) => <Briefcase size={22} color={color} />
        }}
      />
      <Tab.Screen 
        name="Chat" 
        component={ChatListScreen} 
        options={{
          tabBarLabel: 'MESSAGE',
          tabBarIcon: ({ color, size }) => <MessageSquareText size={22} color={color} />
        }}
      />
    </Tab.Navigator>
  );
};

const NavigationWrapper = () => {
  const { token, isLoading } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1e3a8a" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {token ? (
          <>
            <Stack.Screen name="MainTabs" component={TabNavigator} />
            <Stack.Screen name="ChatDetail" component={ChatDetailScreen} />
            <Stack.Screen name="FormPreview" component={FormPreviewScreen} />
            <Stack.Screen name="FormAnalytics" component={FormAnalyticsScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="DemoFormList" component={DemoFormListScreen} />
            <Stack.Screen name="FormPreview" component={FormPreviewScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <NavigationWrapper />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? 40 : 0,
  },
});
