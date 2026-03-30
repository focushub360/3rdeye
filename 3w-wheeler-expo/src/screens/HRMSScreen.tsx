import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { 
  LogIn, 
  LogOut, 
  ClipboardCheck, 
  CalendarPlus, 
  Clock, 
  MapPin,
  ChevronRight,
  UserCheck,
  Power
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');

const HRMSButton = ({ title, icon: Icon, color, onPress }: any) => (
  <TouchableOpacity style={styles.menuBtn} onPress={onPress}>
    <View style={[styles.iconBox, { backgroundColor: color + '15' }]}>
      <Icon size={24} color={color} />
    </View>
    <View style={styles.btnContent}>
      <Text style={styles.btnTitle}>{title}</Text>
      <Text style={styles.btnSub}>Manage your daily activity</Text>
    </View>
    <ChevronRight size={20} color="#cbd5e1" />
  </TouchableOpacity>
);

const HRMSScreen = () => {
  const { logout } = useAuth();
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <UserCheck size={28} color="#1e3a8a" />
        <Text style={styles.headerTitle}>HR Portal</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.attendanceCard}>
          <View style={styles.attendanceHeader}>
            <View>
              <Text style={styles.todayTitle}>Today Attendance</Text>
              <Text style={styles.todayDate}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
            </View>
            <View style={styles.clockBox}>
              <Clock size={16} color="#3b82f6" />
              <Text style={styles.clockText}>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
          </View>

          <View style={styles.attendanceActions}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#10b981' }]}>
              <LogIn size={20} color="#fff" />
              <Text style={styles.actionText}>CHECK IN</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#ef4444' }]}>
              <LogOut size={20} color="#fff" />
              <Text style={styles.actionText}>CHECK OUT</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.locationInfo}>
            <MapPin size={14} color="#94a3b8" />
            <Text style={styles.locationText}>Not Checked-in yet</Text>
          </View>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Employee Actions</Text>
          <HRMSButton 
            title="Apply Permission" 
            icon={ClipboardCheck} 
            color="#3b82f6" 
          />
          <HRMSButton 
            title="Request Leave" 
            icon={CalendarPlus} 
            color="#f59e0b" 
          />

          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Power size={20} color="#ef4444" />
            <Text style={styles.logoutText}>SIGN OUT</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 120, // Prevent navbar overlap
  },
  attendanceCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 24,
  },
  attendanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  todayTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  todayDate: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 4,
  },
  clockBox: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clockText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3b82f6',
  },
  attendanceActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  actionBtn: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  locationText: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
  },
  menuSection: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginLeft: 4,
    marginBottom: 8,
  },
  menuBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  btnContent: {
    flex: 1,
  },
  btnTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  btnSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff1f2',
    padding: 18,
    borderRadius: 20,
    gap: 12,
    marginTop: 32,
    borderWidth: 1,
    borderColor: '#ffe4e6',
    justifyContent: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ef4444',
    letterSpacing: 1,
  }
});

export default HRMSScreen;
