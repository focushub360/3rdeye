import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { LogOut, User, LayoutDashboard, Database } from 'lucide-react-native';

const DashboardScreen = () => {
  const { user, logout } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View>
          <Text style={styles.welcome}>Welcome back,</Text>
          <Text style={styles.userName}>{user?.name || user?.email || 'User'}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <LogOut size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.card}>
          <LayoutDashboard size={24} color="#3b82f6" style={styles.cardIcon} />
          <Text style={styles.cardTitle}>Role</Text>
          <Text style={styles.cardValue}>{user?.role?.toUpperCase() || 'USER'}</Text>
        </View>
        <View style={styles.card}>
          <Database size={24} color="#10b981" style={styles.cardIcon} />
          <Text style={styles.cardTitle}>Status</Text>
          <Text style={styles.cardValue}>Connected</Text>
        </View>
      </View>

      <View style={styles.mainContent}>
        <View style={styles.infoBox}>
          <User size={24} color="#6366f1" style={styles.cardIcon} />
          <Text style={styles.infoTitle}>Profile Information</Text>
          <Text style={styles.infoText}>Email: {user?.email}</Text>
          <Text style={styles.infoText}>User ID: {user?.id}</Text>
        </View>
        
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            Mobile functionalities will be available soon based on your assigned forms and tasks.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  welcome: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  logoutBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  statsRow: {
    flexDirection: 'row',
    padding: 24,
    gap: 16,
  },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardIcon: {
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  cardValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 4,
  },
  mainContent: {
    padding: 24,
  },
  infoBox: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 6,
  },
  placeholder: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#f1f5f9',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  placeholderText: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 20,
  },
});

export default DashboardScreen;
