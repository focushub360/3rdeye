import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/config';
import { Mail, Lock, Building, ArrowRight, ShieldCheck, UserCircle, ChevronDown, ChevronRight } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantSlug, setTenantSlug] = useState('laxmi-metals-tvs');
  const [loading, setLoading] = useState(false);
  const [showDemoUsers, setShowDemoUsers] = useState(false);
  const { login } = useAuth();
  const navigation = useNavigation<any>();

  const demoUsers = [
    { name: 'Admin (Main)', email: 'lmadmin@focus.com', role: 'Admin' },
    { name: 'Pavithra', email: 'pavithra@gmail.com', role: 'Sub-Admin' },
    { name: 'Tilak Tilak', email: 'thilak20219929@gmail.com', role: 'Sub-Admin' },
    { name: 'Santha Kumari', email: 'pradeepdon135@gmail.com', role: 'Sub-Admin' },
    { name: 'Santhosh Kumar', email: 'santhoshkumar101993@gmail.com', role: 'Inspector' },
    { name: 'Vel Murugan', email: 'velmurugan@gmail.com', role: 'Inspector' },
  ];

  const fillUserDetails = (user: any) => {
    setTenantSlug('laxmi-metals-tvs');
    setEmail(user.email);
    setPassword('admin123'); // Standard demo password
    setShowDemoUsers(false);
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter your credentials');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/auth/login', {
        email,
        password,
        tenantSlug,
      });

      if (response.data.success) {
        const { token, user, tenant } = response.data.data;
        const userWithTenant = { ...user, tenant };
        await login({ token, user: userWithTenant });
      } else {
        Alert.alert('Login Failed', response.data.message || 'Invalid credentials');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      const message = error.response?.data?.message || 'Network error or incorrect credentials';
      Alert.alert('Login Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.brandBox}>
            <ShieldCheck size={32} color="#1e3a8a" />
          </View>
          <Text style={styles.title}>Laxmi Metals</Text>
          <Text style={styles.subtitle}>Enterprise Service Portal</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formHeading}>SECURE SIGN IN</Text>
          
          <View style={styles.inputGroup}>
            <View style={styles.inputContainer}>
              <Mail size={18} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Work Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor="#94a3b8"
              />
            </View>

            <View style={styles.inputContainer}>
              <Lock size={18} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.loginBtnText}>Access Dashboard</Text>
                <ChevronRight size={18} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Demo Account Selector for client presentation */}
        <View style={styles.demoSection}>
          <TouchableOpacity 
            style={styles.demoToggle}
            onPress={() => setShowDemoUsers(!showDemoUsers)}
          >
            <UserCircle size={20} color="#64748b" />
            <Text style={styles.demoToggleText}>Switch Management Account</Text>
            <ChevronDown size={18} color="#64748b" style={{ transform: [{ rotate: showDemoUsers ? '180deg' : '0deg' }] }} />
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

        <View style={styles.footer}>
          <Text style={styles.footerText}>Powered by Focus Engineering v1.0.4</Text>
          <View style={styles.footerBadge}>
             <Text style={styles.footerBadgeText}>ENCRYPTED SESSION</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 44,
  },
  brandBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 4,
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 32,
    padding: 32,
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  formHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 1.5,
    marginBottom: 24,
    textAlign: 'center',
  },
  inputGroup: {
    gap: 16,
    marginBottom: 32,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    height: 60,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '600',
  },
  loginBtn: {
    flexDirection: 'row',
    backgroundColor: '#1e3a8a',
    borderRadius: 16,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  btnDisabled: {
    backgroundColor: '#94a3b8',
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },
  demoSection: {
    marginTop: 32,
    backgroundColor: '#f8fafc',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  demoToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 12,
  },
  demoToggleText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  demoList: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  demoItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  demoItemInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  demoItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  demoItemRole: {
    fontSize: 10,
    fontWeight: '800',
    color: '#3b82f6',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  demoItemEmail: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  footer: {
    marginTop: 40,
    alignItems: 'center',
    paddingBottom: 24,
  },
  footerText: {
    fontSize: 11,
    color: '#cbd5e1',
    fontWeight: '600',
  },
  footerBadge: {
    marginTop: 8,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  footerBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 1,
  }
});

export default LoginScreen;
