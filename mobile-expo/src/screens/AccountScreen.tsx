import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Switch, 
  TextInput,
  Alert,
  ActivityIndicator,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/config';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  LogOut, 
  User, 
  Settings as SettingsIcon, 
  Shield, 
  Bell, 
  ChevronRight, 
  ArrowLeft,
  Mail,
  Lock,
  Smartphone,
  Info,
  Moon,
  Sun
} from 'lucide-react-native';

const AccountScreen = ({ navigation }: any) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, colors, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<'main' | 'settings' | 'security' | 'notifications'>('main');
  
  // Settings States
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [biometrics, setBiometrics] = useState(true);

  // Security States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword) {
      Alert.alert("Error", "Please fill all password fields.");
      return;
    }
    setIsUpdating(true);
    try {
      const netState = await NetInfo.fetch();
      if (netState.isConnected) {
        // Online: call api directly
        const response = await apiClient.put('/auth/change-password', {
          currentPassword,
          newPassword
        });
        if (response.data.success) {
          // Update cached offline credentials
          await SecureStore.setItemAsync('offline_password', newPassword);
          Alert.alert("Success", "Password updated successfully.");
          setCurrentPassword('');
          setNewPassword('');
        } else {
          Alert.alert("Error", response.data.message || "Failed to update password.");
        }
      } else {
        // Offline: update local credentials and queue update for sync
        const storedPassword = await SecureStore.getItemAsync('offline_password');
        
        if (storedPassword && storedPassword !== currentPassword) {
          Alert.alert("Error", "Incorrect current password entered.");
          setIsUpdating(false);
          return;
        }
        
        // Update local SecureStore password so offline login uses the new password immediately
        await SecureStore.setItemAsync('offline_password', newPassword);
        
        // Queue the payload for sync when online
        await AsyncStorage.setItem('@offline_queued_password_update', JSON.stringify({
          currentPassword,
          newPassword
        }));
        
        Alert.alert(
          "Offline Mode Active", 
          "Password updated locally. Offline login will now use this new password. The change will sync to the server once internet connection is restored."
        );
        setCurrentPassword('');
        setNewPassword('');
      }
    } catch (error: any) {
      console.error('Password update error:', error);
      Alert.alert("Error", error.response?.data?.message || "Failed to update password. Check your connection.");
    } finally {
      setIsUpdating(false);
    }
  };

  const renderHeader = (title: string, showBack = false) => (
    <View style={[styles.header, { borderBottomColor: colors.border }]}>
      {showBack ? (
        <TouchableOpacity onPress={() => setActiveTab('main')} style={styles.backBtn}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
      )}
      <Text style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
      <View style={{ width: 24 }} />
    </View>
  );

  const renderMain = () => (
    <ScrollView showsVerticalScrollIndicator={false} style={{ backgroundColor: colors.background }}>
      <View style={[styles.profileSection, { backgroundColor: colors.background }]}>
        <View style={[styles.avatarLarge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.avatarTextLarge, { color: colors.accent }]}>{user?.name ? user.name[0] : 'A'}</Text>
        </View>
        <Text style={[styles.profileName, { color: colors.text }]}>{user?.name || user?.username}</Text>
        <Text style={[styles.profileEmail, { color: colors.subtext }]}>{user?.email}</Text>
        <View style={[styles.roleBadge, { backgroundColor: isDark ? '#1e293b' : '#eff6ff' }]}>
          <Text style={[styles.roleBadgeText, { color: isDark ? colors.accent : '#2563eb' }]}>{user?.role?.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.menuContainer}>
        <Text style={[styles.sectionLabel, { color: colors.subtext }]}>PREFERENCES</Text>
        
        <TouchableOpacity style={styles.menuItem} onPress={() => setActiveTab('settings')}>
          <View style={[styles.iconWrapper, { backgroundColor: isDark ? '#1e293b' : '#eff6ff' }]}>
            <SettingsIcon size={20} color={isDark ? colors.accent : '#3b82f6'} />
          </View>
          <Text style={[styles.menuText, { color: colors.text }]}>App Settings</Text>
          <ChevronRight size={18} color={colors.subtext} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => setActiveTab('security')}>
          <View style={[styles.iconWrapper, { backgroundColor: isDark ? '#064e3b' : '#f0fdf4' }]}>
            <Shield size={20} color={isDark ? '#34d399' : '#10b981'} />
          </View>
          <Text style={[styles.menuText, { color: colors.text }]}>Security & Privacy</Text>
          <ChevronRight size={18} color={colors.subtext} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => setActiveTab('notifications')}>
          <View style={[styles.iconWrapper, { backgroundColor: isDark ? '#451a03' : '#fff7ed' }]}>
            <Bell size={20} color={isDark ? '#fbbf24' : '#f59e0b'} />
          </View>
          <Text style={[styles.menuText, { color: colors.text }]}>Notifications</Text>
          <ChevronRight size={18} color={colors.subtext} />
        </TouchableOpacity>
      </View>

      <View style={[styles.menuContainer, { marginTop: 20 }]}>
        <Text style={[styles.sectionLabel, { color: colors.subtext }]}>SYSTEM</Text>
        <View style={styles.menuItemStatic}>
          <View style={[styles.iconWrapper, { backgroundColor: colors.surface }]}>
            <Info size={20} color={colors.subtext} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuText, { color: colors.text }]}>Version</Text>
            <Text style={[styles.menuSubText, { color: colors.subtext }]}>v2.4.0 (Production)</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity onPress={logout} style={[styles.logoutBtn, { backgroundColor: isDark ? '#450a0a' : '#fef2f2', borderColor: isDark ? '#7f1d1d' : '#fee2e2' }]}>
        <LogOut size={20} color={colors.error} />
        <Text style={[styles.logoutText, { color: colors.error }]}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderSettings = () => (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.settingsSection}>
        <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
          <View>
            <Text style={[styles.settingTitle, { color: colors.text }]}>Dark Mode</Text>
            <Text style={[styles.settingSub, { color: colors.subtext }]}>Switch to dark interface</Text>
          </View>
          <Switch 
            value={isDark} 
            onValueChange={toggleTheme} 
            trackColor={{ true: colors.accent, false: '#d1d5db' }}
            thumbColor={Platform.OS === 'android' ? (isDark ? colors.accent : '#f4f3f4') : ''}
          />
        </View>

        <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
          <View>
            <Text style={[styles.settingTitle, { color: colors.text }]}>Language</Text>
            <Text style={[styles.settingSub, { color: colors.subtext }]}>English (US)</Text>
          </View>
          <ChevronRight size={18} color={colors.subtext} />
        </View>
      </View>
    </View>
  );

  const renderSecurity = () => (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.settingsSection}>
      <Text style={[styles.subSectionTitle, { color: colors.text }]}>Change Password</Text>
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: colors.subtext }]}>CURRENT PASSWORD</Text>
        <TextInput 
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]} 
          secureTextEntry 
          value={currentPassword}
          onChangeText={setCurrentPassword}
          placeholder="••••••••"
          placeholderTextColor={colors.subtext}
        />
      </View>
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: colors.subtext }]}>NEW PASSWORD</Text>
        <TextInput 
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]} 
          secureTextEntry 
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="••••••••"
          placeholderTextColor={colors.subtext}
        />
      </View>
      <TouchableOpacity 
        style={[styles.actionBtn, { backgroundColor: colors.accent }]} 
        onPress={handleUpdatePassword}
        disabled={isUpdating}
      >
        {isUpdating ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>Update Password</Text>}
      </TouchableOpacity>

      <View style={[styles.divider, { marginVertical: 30, backgroundColor: colors.border }]} />

      <Text style={[styles.subSectionTitle, { color: colors.text }]}>Privacy</Text>
      <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.settingTitle, { color: colors.text }]}>Biometric Login</Text>
          <Text style={[styles.settingSub, { color: colors.subtext }]}>Use Face ID or Fingerprint</Text>
        </View>
        <Switch value={biometrics} onValueChange={setBiometrics} trackColor={{ true: colors.accent }} />
      </View>
    </ScrollView>
  );

  const renderNotifications = () => (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.settingsSection}>
        <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
          <View>
            <Text style={[styles.settingTitle, { color: colors.text }]}>Push Notifications</Text>
            <Text style={[styles.settingSub, { color: colors.subtext }]}>Enable system alerts</Text>
          </View>
          <Switch value={notificationsEnabled} onValueChange={setNotificationsEnabled} trackColor={{ true: colors.accent }} />
        </View>

        <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
          <View>
            <Text style={[styles.settingTitle, { color: colors.text }]}>Email Updates</Text>
            <Text style={[styles.settingSub, { color: colors.subtext }]}>Receive reports via email</Text>
          </View>
          <Switch value={true} onValueChange={() => {}} trackColor={{ true: colors.accent }} />
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {activeTab === 'main' ? renderHeader('Profile') : 
       activeTab === 'settings' ? renderHeader('Settings', true) :
       activeTab === 'security' ? renderHeader('Security', true) :
       renderHeader('Notifications', true)}
      
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {activeTab === 'main' && renderMain()}
        {activeTab === 'settings' && renderSettings()}
        {activeTab === 'security' && renderSecurity()}
        {activeTab === 'notifications' && renderNotifications()}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#fff',
  },
  avatarLarge: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#f8fafc',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  avatarTextLarge: {
    fontSize: 36,
    fontWeight: '800',
    color: '#4f46e5',
  },
  profileName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
    marginBottom: 12,
  },
  roleBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2563eb',
    letterSpacing: 0.5,
  },
  menuContainer: {
    paddingHorizontal: 24,
    marginTop: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 1,
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  menuItemStatic: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  iconWrapper: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  menuText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    flex: 1,
  },
  menuSubText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    marginHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 20,
    marginTop: 40,
    marginBottom: 40,
    gap: 10,
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ef4444',
  },
  settingsSection: {
    padding: 24,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  settingSub: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
  },
  subSectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  actionBtn: {
    backgroundColor: '#4f46e5',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  actionBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
  }
});

export default AccountScreen;
