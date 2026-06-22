import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  ScrollView,
  Dimensions,
  StatusBar,
  Image,
  KeyboardAvoidingView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/config';
import { useNavigation } from '@react-navigation/native';
import { User, Lock, Eye, EyeOff, Phone } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import NetInfo from '@react-native-community/netinfo';

const { height } = Dimensions.get('window');

import * as Location from 'expo-location';

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();
  const navigation = useNavigation<any>();
  const [prefetchedLocation, setPrefetchedLocation] = useState<{ status: string; latitude?: number; longitude?: number } | null>(null);





  const handleLogin = async () => {
    if (!email || !password) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError('Please enter your details to sign in.');
      return;
    }

    setLoading(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Use prefetched location if available, otherwise do a QUICK check
    let locationData = prefetchedLocation || { status: 'unknown' };
    
    if (locationData.status === 'unknown') {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          const position = await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
            new Promise<null>((_, reject) => setTimeout(() => reject('timeout'), 1500))
          ]).catch(() => null);
          
          if (position && typeof position === 'object') {
            locationData = {
              status: 'granted',
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            };
          }
        }
      } catch (err) {
        // Ignore location errors for speed
      }
    }

    // Helper for offline authentication
    // Helper for offline authentication
    const attemptOfflineLogin = async () => {
      try {
        const offlineEmail = await SecureStore.getItemAsync('offline_email');
        const offlinePassword = await SecureStore.getItemAsync('offline_password');
        const offlineMobile = await SecureStore.getItemAsync('offline_mobile');
        
        const checkInput = email.trim().toLowerCase();
        const cleanInputMobile = checkInput.replace(/\D/g, '');
        
        const isMatched = (
          (offlineEmail && offlineEmail.trim().toLowerCase() === checkInput) ||
          (offlineMobile && offlineMobile.trim().replace(/\D/g, '') === cleanInputMobile)
        ) && offlinePassword === password;
        
        if (isMatched) {
          const storedToken = await SecureStore.getItemAsync('user_token');
          const storedUser = await SecureStore.getItemAsync('user_data');
          const storedLogId = await SecureStore.getItemAsync('session_log_id');
          
          if (storedToken && storedUser) {
            const parsedUser = JSON.parse(storedUser);
            await login({ token: storedToken, user: parsedUser, sessionLogId: storedLogId || undefined });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            navigation.replace('MainTabs');
            return true;
          }
        }

        // Try preseeded developer/default credentials for a seamless offline testing experience
        const preseededUsers: Record<string, { pass: string; user: any }> = {
          'superadmin@focus.com': {
            pass: 'superadmin123#',
            user: {
              _id: 'offline_superadmin_id',
              id: 'offline_superadmin_id',
              username: 'superadmin',
              email: 'superadmin@focus.com',
              firstName: 'Super',
              lastName: 'Administrator',
              name: 'Super Administrator',
              role: 'superadmin',
              mobile: '+1234567890',
              phone: '+1234567890',
              tenantId: 'default',
              tenant: { id: 'default', name: 'Little Flower School', slug: 'default' }
            }
          },
          'admin@focus.com': {
            pass: 'admin123#',
            user: {
              _id: 'offline_admin_id',
              id: 'offline_admin_id',
              username: 'admin',
              email: 'admin@focus.com',
              firstName: 'System',
              lastName: 'Administrator',
              name: 'System Administrator',
              role: 'admin',
              mobile: '+1234567891',
              phone: '+1234567891',
              tenantId: 'default',
              tenant: { id: 'default', name: 'Little Flower School', slug: 'default' }
            }
          },
          'teacher@focus.com': {
            pass: 'teacher123',
            user: {
              _id: 'offline_teacher_id',
              id: 'offline_teacher_id',
              username: 'teacher1',
              email: 'teacher@focus.com',
              firstName: 'John',
              lastName: 'Doe',
              name: 'John Doe',
              role: 'teacher',
              mobile: '+1234567892',
              phone: '+1234567892',
              tenantId: 'default',
              tenant: { id: 'default', name: 'Little Flower School', slug: 'default' }
            }
          },
          'krishna@focusengineering.in': {
            pass: '123456',
            user: {
              _id: 'offline_krishna_id',
              id: 'offline_krishna_id',
              username: 'krishna',
              email: 'krishna@focusengineering.in',
              firstName: 'Krishna',
              lastName: 'Inspector',
              name: 'Krishna Inspector',
              role: 'inspector',
              mobile: '+919486240282',
              phone: '+919486240282',
              tenantId: 'default',
              tenant: { id: 'default', name: 'Little Flower School', slug: 'default' }
            }
          },
          'krishnaa@focusengineering.in': {
            pass: 'krish@123',
            user: {
              _id: 'offline_krishnaa_id',
              id: 'offline_krishnaa_id',
              username: 'krishnaa',
              email: 'krishnaa@focusengineering.in',
              firstName: 'Krishnaa',
              lastName: 'Alternative',
              name: 'Krishnaa Alternative',
              role: 'inspector',
              mobile: '+919486240282',
              phone: '+919486240282',
              tenantId: 'default',
              tenant: { id: 'default', name: 'Little Flower School', slug: 'default' }
            }
          }
        };

        let matchedUser = null;
        for (const [key, data] of Object.entries(preseededUsers)) {
          const userObj = data.user;
          const userEmail = userObj.email.toLowerCase();
          const userUsername = (userObj.username || '').toLowerCase();
          const userMobile = (userObj.mobile || '').replace(/\D/g, '');
          
          if (
            key.toLowerCase() === checkInput ||
            userEmail === checkInput ||
            userUsername === checkInput ||
            (cleanInputMobile.length >= 10 && userMobile.endsWith(cleanInputMobile.slice(-10))) ||
            (userMobile && userMobile === cleanInputMobile)
          ) {
            if (data.pass === password) {
              matchedUser = data.user;
              break;
            }
          }
        }

        if (matchedUser) {
          // Mock token & mock session log ID
          const mockToken = 'mock_offline_token_' + Date.now();
          const mockSessionLogId = 'mock_offline_session_' + Date.now();
          
          // Save them to SecureStore so subsequent loads retrieve them
          await SecureStore.setItemAsync('offline_email', matchedUser.email);
          if (matchedUser.mobile) {
            await SecureStore.setItemAsync('offline_mobile', matchedUser.mobile);
          }
          await SecureStore.setItemAsync('offline_password', password);
          await SecureStore.setItemAsync('user_token', mockToken);
          await SecureStore.setItemAsync('user_data', JSON.stringify(matchedUser));
          await SecureStore.setItemAsync('session_log_id', mockSessionLogId);
          
          await login({ token: mockToken, user: matchedUser, sessionLogId: mockSessionLogId });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          navigation.replace('MainTabs');
          return true;
        }
      } catch (offlineErr) {
        console.error('Offline login error:', offlineErr);
      }
      return false;
    };

    // Check connection first
    const netState = await NetInfo.fetch();
    console.log('[LOGIN] Network connection status:', netState.isConnected, 'Type:', netState.type);
    if (!netState.isConnected) {
      console.log('[LOGIN] Offline. Attempting offline login fallback.');
      const offlineSuccess = await attemptOfflineLogin();
      if (offlineSuccess) {
        setLoading(false);
        return;
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setError('You are offline. Please connect to the internet or enter your previously logged-in credentials.');
        setLoading(false);
        return;
      }
    }

    try {
      const loginPayload: any = { 
        email, 
        password,
        location: locationData 
      };
      if (tenantSlug) loginPayload.tenantSlug = tenantSlug;

      console.log('[LOGIN] Sending POST /auth/login with baseURL:', apiClient.defaults.baseURL, 'payload:', JSON.stringify(loginPayload));
      const response = await apiClient.post('/auth/login', loginPayload);
      console.log('[LOGIN] Success response status:', response.status, 'data success:', response.data?.success);

      if (response.data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const { token, user, tenant, sessionLogId } = response.data.data;
        const userWithTenant = { ...user, tenant };
        
        console.log('[LOGIN] Received user details:', JSON.stringify(userWithTenant));
        
        // Cache credentials for future offline login
        await SecureStore.setItemAsync('offline_email', email);
        if (user.mobile) {
          await SecureStore.setItemAsync('offline_mobile', user.mobile);
        }
        await SecureStore.setItemAsync('offline_password', password);
        
        await login({ token, user: userWithTenant, sessionLogId });
        
        console.log('[LOGIN] State initialized. Replacing screen with MainTabs.');
        navigation.replace('MainTabs');
      } else {
        console.warn('[LOGIN] Request returned success=false:', response.data);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setError(response.data.message || 'Incorrect email or password.');
      }
    } catch (error: any) {
      console.error('[LOGIN] Request failed:', error.message, 'Response status:', error.response?.status, 'Response data:', error.response?.data);
      // Fallback to offline login if server/connection fails
      const offlineSuccess = await attemptOfflineLogin();
      if (offlineSuccess) {
        console.log('[LOGIN] Offline login fallback succeeded after API failure.');
        setLoading(false);
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(error.response?.data?.message || 'Incorrect email or password. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1e3a8a" />
      
      <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : -100}
        >
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          bounces={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        <View style={styles.topPanel}>
          <View style={styles.welcomeContent}>
            <Image 
              source={require('../../assets/logo.jpeg')} 
              style={styles.welcomeLogo} 
              resizeMode="contain" 
            />
            <Text style={styles.welcomeSubtitle}>
              Access your dashboard and manage your forms with ease.
            </Text>
          </View>
          <View style={styles.webCurveDecoration} />
        </View>

        <View style={styles.bottomPanel}>
          <View style={styles.formHeader}>
            <Text style={styles.loginTitle}>Login</Text>
            <Text style={styles.loginSubtitle}>Please enter your details to sign in.</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputWrapper}>
              <User size={18} color="#94a3b8" style={styles.fieldIcon} />
              <TextInput
                style={styles.input}
                placeholder="Login ID"
                value={email}
                onChangeText={(text) => { setEmail(text); setError(null); }}
                autoCapitalize="none"
                placeholderTextColor="#94a3b8"
              />
            </View>

            <View style={styles.inputWrapper}>
              <Lock size={18} color="#94a3b8" style={styles.fieldIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                value={password}
                onChangeText={(text) => { setPassword(text); setError(null); }}
                secureTextEntry={!showPassword}
                placeholderTextColor="#94a3b8"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff size={20} color="#94a3b8" /> : <Eye size={20} color="#94a3b8" />}
              </TouchableOpacity>
            </View>

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.loginBtn, loading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.loginBtnText}>Login</Text>
              )}
            </TouchableOpacity>
          </View>

        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { flexGrow: 1, backgroundColor: '#fff' },
  topPanel: {
    backgroundColor: '#1e3a8a',
    height: height * 0.3,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    borderBottomRightRadius: 80,
    overflow: 'hidden',
    position: 'relative',
  },
  welcomeContent: { alignItems: 'center', zIndex: 10, marginTop: 10 },
  welcomeLogo: {
    width: 120,
    height: 120,
    backgroundColor: '#fff',
    borderRadius: 60,
    marginBottom: 20,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  welcomeTitle: {
    fontSize: 34,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '500',
  },
  webCurveDecoration: {
    position: 'absolute',
    right: -100,
    top: -50,
    width: 300,
    height: height * 0.5,
    borderRadius: 150,
    backgroundColor: 'rgba(255,255,255,0.05)',
    zIndex: 1,
  },
  bottomPanel: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 35,
    paddingTop: 45,
    paddingBottom: 40,
  },
  formHeader: { marginBottom: 35 },
  loginTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 6,
    letterSpacing: -1,
  },
  loginSubtitle: { fontSize: 15, color: '#94a3b8', fontWeight: '500' },
  form: { gap: 22 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    height: 64,
    paddingHorizontal: 20,
  },
  fieldIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: '#1e293b', fontWeight: '600' },
  forgotBtn: { alignSelf: 'flex-end', marginTop: -12 },
  forgotText: { fontSize: 14, color: '#94a3b8', fontWeight: '600' },
  errorBox: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#ffe4e6',
    borderRadius: 14,
    padding: 15,
    marginTop: 5,
  },
  errorText: {
    color: '#e11d48',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  loginBtn: {
    backgroundColor: '#1e3a8a',
    borderRadius: 18,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
    marginTop: 10,
  },
  btnDisabled: { opacity: 0.7 },
  loginBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' },

});

export default LoginScreen;
