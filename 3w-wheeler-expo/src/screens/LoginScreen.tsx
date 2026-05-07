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


  const handleLogin = async () => {
    if (!email || !password) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError('Please enter your details to sign in.');
      return;
    }

    setLoading(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Get user location
    let locationData: { status: string; latitude?: number; longitude?: number } = { status: 'unknown' };
    
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        locationData = {
          status: 'granted',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
      } else {
        locationData = { status: 'denied' };
      }
    } catch (err) {
      console.warn('Location access error:', err);
      locationData = { status: 'error' };
    }

    try {
      const loginPayload: any = { 
        email, 
        username: email, // Send as username too to support case-sensitive usernames
        password,
        location: locationData 
      };
      if (tenantSlug) loginPayload.tenantSlug = tenantSlug;

      const response = await apiClient.post('/auth/login', loginPayload);

      if (response.data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const { token, user, tenant, sessionLogId } = response.data.data;
        const userWithTenant = { ...user, tenant };
        await login({ token, user: userWithTenant, sessionLogId });
        
        // Navigation based on role
        if (user.role === 'inspector') {
          navigation.replace('MainTabs');
        } else {
          navigation.replace('MainTabs');
        }
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setError(response.data.message || 'Incorrect email or password.');
      }
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error('Login error:', error);
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
              {/^\d+$/.test(email) ? (
                <Phone size={18} color="#94a3b8" style={styles.fieldIcon} />
              ) : (
                <User size={18} color="#94a3b8" style={styles.fieldIcon} />
              )}
              <TextInput
                style={styles.input}
                placeholder="Email, Username or Mobile No"
                value={email}
                onChangeText={(text) => { setEmail(text); setError(null); }}
                autoCapitalize="none"
                placeholderTextColor="#94a3b8"
                keyboardType={/^\d+$/.test(email) ? "phone-pad" : "default"}
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
