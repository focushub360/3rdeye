import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import ServiceAnalyticsScreen from './src/screens/ServiceAnalyticsScreen';
import ChatListScreen from './src/screens/ChatbotScreen'; // Renamed to ChatList
import ChatDetailScreen from './src/screens/ChatDetailScreen';
import AttendanceScreen from './src/screens/AttendanceScreen';
import FormListScreen from './src/screens/FormListScreen';
import FormPreviewScreen from './src/screens/FormPreviewScreen';
import FormAnalyticsScreen from './src/screens/FormAnalyticsScreen';
import DemoFormListScreen from './src/screens/DemoFormListScreen';
import AttendanceManagementScreen from './src/screens/AttendanceManagementScreen';
import LeaveManagementScreen from './src/screens/LeaveManagementScreen';
import PermissionManagementScreen from './src/screens/PermissionManagementScreen';
import ShiftManagementScreen from './src/screens/ShiftManagementScreen';
import AdminShiftManagementScreen from './src/screens/AdminShiftManagementScreen';
import SplashScreen from './src/screens/SplashScreen';
import { ActivityIndicator, View, StyleSheet, StatusBar, Platform, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LayoutDashboard, MessageSquareText, Clock, ClipboardList, CalendarDays, ShieldCheck, BarChart3 } from 'lucide-react-native';
import DashboardScreen from './src/screens/DashboardScreen';

import ResponseFeedbackScreen from './src/screens/ResponseFeedbackScreen';
import AccountScreen from './src/screens/AccountScreen';

const Stack = createNativeStackNavigator();

const Tab = createBottomTabNavigator();

const TabNavigator = () => {
  const { user, isCheckedIn } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'superadmin' || user?.role === 'subadmin' || user?.role === 'lmadmin';

  const isInspector = user?.role === 'inspector';

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
        tabBarInactiveTintColor: '#94a3b8',
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: '800',
          letterSpacing: 0.2,
          marginTop: 2,
        }
      }}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen} 
        options={{
          tabBarLabel: 'DASHBOARD',
          tabBarIcon: ({ color }) => <LayoutDashboard size={20} color={color} />
        }}
      />
      
      {(isAdmin || (isInspector && isCheckedIn)) && (
        <Tab.Screen 
          name="Forms" 
          component={FormListScreen} 
          options={{
            tabBarLabel: 'FORMS',
            tabBarIcon: ({ color }) => <ClipboardList size={20} color={color} />
          }}
        />
      )}

      {/* Analytics tab removed as per request */}

      <Tab.Screen 
        name="Attendance" 
        component={AttendanceScreen} 
        options={{
          tabBarLabel: isInspector ? 'ATTENDANCE' : 'HR MGMT',
          tabBarIcon: ({ color }) => <Clock size={20} color={color} />
        }}
      />
      <Tab.Screen 
        name="Chat" 
        component={ChatListScreen} 
        options={{
          tabBarLabel: 'CHAT SYSTEM',
          tabBarIcon: ({ color }) => <MessageSquareText size={20} color={color} />
        }}
      />
    </Tab.Navigator>
  );
};

const NavigationWrapper = () => {
  const { token, isLoading } = useAuth();
  const [splashFinished, setSplashFinished] = useState(false);

  // Seemless Transition: Keep splash until BOTH animation is done AND auth is checked
  if (!splashFinished || isLoading) {
    return <SplashScreen onFinish={() => setSplashFinished(true)} />;
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
            <Stack.Screen name="AttendanceManagement" component={AttendanceManagementScreen} />
            <Stack.Screen name="LeaveManagement" component={LeaveManagementScreen} />
            <Stack.Screen name="PermissionManagement" component={PermissionManagementScreen} />
            <Stack.Screen name="ShiftManagement" component={ShiftManagementScreen} />
            <Stack.Screen name="AdminShiftManagement" component={AdminShiftManagementScreen} />
            <Stack.Screen name="ResponseFeedback" component={ResponseFeedbackScreen} />
            <Stack.Screen name="Account" component={AccountScreen} />
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
  useEffect(() => {
    // Process offline queue on startup and periodically
    const initQueue = async () => {
      try {
        const { offlineQueue } = await import('./src/api/OfflineQueue');
        // Initial process
        await offlineQueue.processQueue();
        
        // Setup interval to check every 2 minutes
        const interval = setInterval(() => {
          offlineQueue.processQueue();
        }, 120000);

        return () => clearInterval(interval);
      } catch (err) {
        console.error('Failed to initialize offline queue:', err);
      }
    };
    initQueue();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationWrapper />
      </AuthProvider>
    </SafeAreaProvider>
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
