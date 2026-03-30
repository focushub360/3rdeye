import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { LogOut, User, Settings, Shield, Bell } from 'lucide-react-native';

const AccountScreen = () => {
  const { user, logout } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <User size={32} color="#3b82f6" />
        <View>
          <Text style={styles.userName}>{user?.name || user?.email}</Text>
          <Text style={styles.userRole}>{user?.role?.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.menuItem}>
          <Settings size={20} color="#64748b" />
          <Text style={styles.menuText}>Settings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <Shield size={20} color="#64748b" />
          <Text style={styles.menuText}>Security</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <Bell size={20} color="#64748b" />
          <Text style={styles.menuText}>Notifications</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
        <LogOut size={20} color="#ef4444" />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingTop: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  userRole: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
  },
  section: {
    padding: 20,
    gap: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  menuText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff1f2',
    padding: 16,
    marginHorizontal: 20,
    borderRadius: 12,
    gap: 12,
    marginTop: 'auto',
    marginBottom: 40,
    borderWidth: 1,
    borderColor: '#ffe4e6',
    justifyContent: 'center',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ef4444',
  }
});

export default AccountScreen;
