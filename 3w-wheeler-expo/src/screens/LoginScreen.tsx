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
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/config';
import { useNavigation } from '@react-navigation/native';

const { height } = Dimensions.get('window');

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showDemoUsers, setShowDemoUsers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();
  const navigation = useNavigation<any>();

  const demoUsers = [
    { name: 'Super Admin', email: 'superadmin@focus.com', role: 'SuperAdmin' },
    { name: 'System Admin', email: 'admin@focus.com', role: 'SystemAdmin' },
    { name: 'Admin (Laxmi)', email: 'lmadmin@focus.com', role: 'Admin' },
    { name: 'Santhosh Kumar', email: 'santhoshkumar101993@gmail.com', role: 'Inspector' },
    { name: 'Vel Murugan', email: 'velmurugan@gmail.com', role: 'Inspector' },
  ];

  const fillUserDetails = (user: any) => {
    setEmail(user.email);
    setPassword(user.email === 'superadmin@focus.com' ? 'superadmin123#' : 'admin123#'); 
    setTenantSlug(''); 
    setShowDemoUsers(false);
    setError(null);
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter your details to sign in.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const loginPayload: any = { email, password };
      if (tenantSlug) loginPayload.tenantSlug = tenantSlug;

      const response = await apiClient.post('/auth/login', loginPayload);

      if (response.data.success) {
        const { token, user, tenant } = response.data.data;
        const userWithTenant = { ...user, tenant };
        await login({ token, user: userWithTenant });
      } else {
        setError(response.data.message || 'Incorrect email or password.');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setError(error.response?.data?.message || 'Incorrect email or password. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1e3a8a" />
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topPanel}>
          <View style={styles.welcomeContent}>
            <Text style={styles.welcomeTitle}>Hello, Welcome!</Text>
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
              <Text style={styles.fieldIcon}>👤</Text>
              <TextInput
                style={styles.input}
                placeholder="Email Address"
                value={email}
                onChangeText={(text) => { setEmail(text); setError(null); }}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor="#94a3b8"
              />
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.fieldIcon}>🔒</Text>
              <TextInput
                style={styles.input}
                placeholder="Password"
                value={password}
                onChangeText={(text) => { setPassword(text); setError(null); }}
                secureTextEntry={!showPassword}
                placeholderTextColor="#94a3b8"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Text style={styles.eyeBtnText}>{showPassword ? '🐵' : '🙈'}</Text>
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

            <View style={styles.signupBox}>
              <Text style={styles.signupText}>Don't have an account? </Text>
              <TouchableOpacity>
                <Text style={styles.signupLink}>Sign up Free</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.dividerBox}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or social login</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.socialRow}>
              {['🌐', '💬', '💻', '💼'].map((symbol, idx) => (
                <TouchableOpacity key={idx} style={styles.socialBtn}>
                  <Text style={{ fontSize: 24 }}>{symbol}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.demoSection}>
            <TouchableOpacity 
              style={styles.demoToggle}
              onPress={() => setShowDemoUsers(!showDemoUsers)}
            >
              <Text style={styles.demoToggleText}>Developer Accounts {showDemoUsers ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {showDemoUsers && (
              <View style={styles.demoList}>
                {demoUsers.map((u, i) => (
                  <TouchableOpacity 
                    key={i} 
                    style={[styles.demoItem, i === demoUsers.length - 1 && { borderBottomWidth: 0 }]}
                    onPress={() => fillUserDetails(u)}
                  >
                    <View style={styles.demoItemInfo}>
                      <Text style={styles.demoItemName}>{u.name}</Text>
                      <Text style={styles.demoItemRole}>{u.role}</Text>
                    </View>
                    <Text style={styles.demoItemEmail}>{u.email}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { flexGrow: 1, backgroundColor: '#fff' },
  topPanel: {
    backgroundColor: '#1e3a8a',
    height: height * 0.38,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    borderBottomRightRadius: 100,
    overflow: 'hidden',
    position: 'relative',
  },
  welcomeContent: { alignItems: 'center', zIndex: 10, marginTop: -20 },
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
  fieldIcon: { fontSize: 20, marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: '#1e293b', fontWeight: '600' },
  eyeBtnText: { fontSize: 20 },
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
  signupBox: { flexDirection: 'row', justifyContent: 'center', marginTop: 15 },
  signupText: { fontSize: 15, color: '#64748b', fontWeight: '500' },
  signupLink: { fontSize: 15, color: '#1e3a8a', fontWeight: '700' },
  dividerBox: { flexDirection: 'row', alignItems: 'center', marginVertical: 25, gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#f1f5f9' },
  dividerText: { fontSize: 13, color: '#94a3b8', fontWeight: '600' },
  socialRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 30 },
  socialBtn: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  demoSection: {
    marginTop: 20,
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  demoToggle: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 10 },
  demoToggleText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#94a3b8' },
  demoList: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  demoItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  demoItemInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  demoItemName: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  demoItemRole: { fontSize: 9, fontWeight: '800', color: '#3b82f6', backgroundColor: '#eff6ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  demoItemEmail: { fontSize: 11, color: '#94a3b8', fontWeight: '500' },
});

export default LoginScreen;
