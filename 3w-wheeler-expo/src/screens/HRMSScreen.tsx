import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity, 
  ScrollView, 
  Dimensions, 
  Platform, 
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput
} from 'react-native';
import { 
  LogIn, 
  LogOut, 
  ClipboardCheck, 
  CalendarPlus, 
  Clock, 
  MapPin,
  ChevronRight,
  UserCheck,
  Power,
  Smartphone,
  Globe,
  KeyRound,
  X
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import apiClient from '../api/config';

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
  const { user, logout } = useAuth();
  const [lastCheck, setLastCheck] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [attendanceSummary, setAttendanceSummary] = useState<any>(null);
  
  // OTP States
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpType, setOtpType] = useState<'IN' | 'OUT'>('IN');
  const [isVerifying, setIsVerifying] = useState(false);

  const fetchAttendanceSummary = async () => {
    try {
      const response = await apiClient.get('/attendance/summary');
      if (response.data.success) {
        const raw = response.data.data;
        // Normalise: ensure .users is always an array regardless of server field name
        const users = Array.isArray(raw?.users) ? raw.users
          : Array.isArray(raw?.attendances) ? raw.attendances
          : Array.isArray(raw?.records) ? raw.records
          : Array.isArray(raw) ? raw
          : [];
        setAttendanceSummary({ ...raw, users });
      }
    } catch (error) {
      console.log('Using mock attendance for demo');
      setAttendanceSummary({
        users: [
          { 
            userId: { firstName: 'Karthik', lastName: 'Rao', role: 'Inspector' }, 
            loginTime: new Date().toISOString(), 
            logoutTime: null, 
            isActive: true,
            location: { status: 'granted' } // Mobile
          },
          { 
            userId: { firstName: 'Suresh', lastName: 'Kumar', role: 'Sub-Admin' }, 
            loginTime: new Date().toISOString(), 
            logoutTime: null, 
            isActive: true,
            location: { status: 'browser' } // Web
          },
          { 
            userId: { firstName: 'Meera', lastName: 'Nair', role: 'Inspector' }, 
            loginTime: '2026-04-07T09:00:00Z', 
            logoutTime: '2026-04-07T18:00:00Z', 
            isActive: false,
            location: { status: 'granted' }
          }
        ]
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchAttendanceSummary();
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAttendanceSummary();
  }, []);

  const handleAttendance = async (type: 'IN' | 'OUT') => {
    setOtpType(type);
    setIsVerifying(true);
    
    try {
      const response = await apiClient.post('/attendance/send-otp', { type });
      if (response.data.success) {
        setShowOTPModal(true);
      } else {
        Alert.alert('Error', response.data.message || 'Failed to send OTP');
      }
    } catch (error: any) {
      console.error('Send OTP Error:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to connect to server');
    } finally {
      setIsVerifying(false);
    }
  };

  const verifyOTP = async () => {
    if (otpCode.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter a 6-digit verification code.');
      return;
    }

    setIsVerifying(true);
    try {
      const response = await apiClient.post('/attendance/verify-otp', {
        type: otpType,
        otp: otpCode,
        sessionLogId: user?.sessionLogId
      });

      if (response.data.success) {
        setShowOTPModal(false);
        setOtpCode('');
        setLastCheck(`${otpType === 'IN' ? 'Checked In' : 'Checked Out'}: ${new Date().toLocaleTimeString()}`);
        Alert.alert('Success', `Successfully ${otpType === 'IN' ? 'Checked In' : 'Checked Out'}`);
        fetchAttendanceSummary();
      } else {
        Alert.alert('Verification Failed', response.data.message || 'Invalid OTP');
      }
    } catch (error: any) {
      console.error('Verify OTP Error:', error);
      Alert.alert('Error', error.response?.data?.message || 'Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const isSuperAdmin = user?.role === 'superadmin';
  const isSubAdmin = user?.role === 'subadmin' || user?.role === 'admin';
  const isInspector = user?.role === 'inspector';
  const canMonitor = isSuperAdmin || isSubAdmin;
  const canCheckIn = isInspector; // Only Inspectors can check in/out now

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <UserCheck size={28} color="#1e3a8a" />
        <Text style={styles.headerTitle}>HR Portal</Text>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Attendance Monitor for Management */}
        {canMonitor && attendanceSummary && (
          <View style={styles.managementSection}>
             <View style={styles.sectionHeaderRow}>
               <Text style={styles.sectionTitle}>Live Attendance Monitor</Text>
               <View style={styles.badgeSmall}>
                  <Text style={styles.badgeTextSmall}>REAL-TIME</Text>
               </View>
             </View>
             
             <View style={styles.logCard}>
             {(attendanceSummary.users ?? []).map((item: any, idx: number) => {
                 const isIn = item.loginTime && !item.logoutTime;
                 const isWeb = item.location?.status === 'browser';
                 const fullName = `${item.userId?.firstName || 'Unknown'} ${item.userId?.lastName || 'User'}`;
                 
                 return (
                   <View key={idx} style={[styles.logItem, idx === attendanceSummary.users.length - 1 && { borderBottomWidth: 0 }]}>
                      <View style={styles.logLeft}>
                        <View style={[styles.avatarSmall, { backgroundColor: item.userId?.role === 'inspector' ? '#eff6ff' : '#fef3c7' }]}>
                          <Text style={[styles.avatarText, { color: item.userId?.role === 'inspector' ? '#3b82f6' : '#d97706' }]}>{(item.userId?.firstName || 'U')[0]}</Text>
                        </View>
                        <View>
                          <View style={styles.nameAndPlatform}>
                            <Text style={styles.logName}>{fullName}</Text>
                            {isWeb ? <Globe size={10} color="#94a3b8" /> : <Smartphone size={10} color="#94a3b8" />}
                          </View>
                          <Text style={styles.logRole}>{item.userId?.role || 'Guest'} • {isWeb ? 'Dashboard' : 'Mobile App'}</Text>
                        </View>
                      </View>
                      <View style={styles.logRight}>
                        <Text style={styles.logTime}>{item.loginTime ? new Date(item.loginTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</Text>
                        <View style={[styles.statusTag, { backgroundColor: isIn ? '#dcfce7' : '#fee2e2' }]}>
                          <Text style={[styles.statusTagText, { color: isIn ? '#166534' : '#991b1b' }]}>{isIn ? 'IN' : 'OUT'}</Text>
                        </View>
                      </View>
                   </View>
                 );
               })}
             </View>
          </View>
        )}

        {/* Personal Attendance for Sub-Admins/Inspectors */}
        {canCheckIn && (
          <View style={styles.attendanceCard}>
            <View style={styles.attendanceHeader}>
              <View>
                <Text style={styles.todayTitle}>Your Daily Check</Text>
                <Text style={styles.todayDate}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
              </View>
              <View style={styles.clockBox}>
                <Clock size={16} color="#3b82f6" />
                <Text style={styles.clockText}>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
            </View>

            <View style={styles.attendanceActions}>
              <TouchableOpacity 
                style={[styles.actionBtn, { backgroundColor: '#10b981' }]}
                onPress={() => handleAttendance('IN')}
                disabled={isVerifying}
              >
                {isVerifying && otpType === 'IN' ? <ActivityIndicator color="#fff" /> : <LogIn size={20} color="#fff" />}
                <Text style={styles.actionText}>CHECK IN</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionBtn, { backgroundColor: '#ef4444' }]}
                onPress={() => handleAttendance('OUT')}
                disabled={isVerifying}
              >
                {isVerifying && otpType === 'OUT' ? <ActivityIndicator color="#fff" /> : <LogOut size={20} color="#fff" />}
                <Text style={styles.actionText}>CHECK OUT</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.locationInfo}>
              <MapPin size={14} color="#94a3b8" />
              <Text style={styles.locationText}>{lastCheck || 'Not Checked-in yet'}</Text>
            </View>
          </View>
        )}

        <View style={styles.menuSection}>
          {canCheckIn && (
            <>
              <Text style={styles.sectionTitle}>Employee Actions</Text>
              <HRMSButton 
                title="Apply Permission" 
                icon={ClipboardCheck} 
                color="#3b82f6" 
                onPress={() => Alert.alert('Information', 'Demo: Form for daily permission request.')}
              />
              <HRMSButton 
                title="Request Leave" 
                icon={CalendarPlus} 
                color="#f59e0b" 
                onPress={() => Alert.alert('Information', 'Demo: Form for leave balance and requests.')}
              />
            </>
          )}

          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Power size={20} color="#ef4444" />
            <Text style={styles.logoutText}>SIGN OUT</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* OTP Verification Modal */}
      <Modal
        visible={showOTPModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowOTPModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconBox}>
                <KeyRound size={28} color="#1e3a8a" />
              </View>
              <TouchableOpacity onPress={() => setShowOTPModal(false)} style={styles.closeBtn}>
                <X size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalTitle}>Verify Check-{otpType}</Text>
            <Text style={styles.modalSub}>Enter the 6-digit code sent to your registered WhatsApp/Device</Text>
            
            <TextInput
              style={styles.otpInput}
              placeholder="000 000"
              placeholderTextColor="#cbd5e1"
              keyboardType="number-pad"
              maxLength={6}
              value={otpCode}
              onChangeText={setOtpCode}
              letterSpacing={10}
              textAlign="center"
            />

            <TouchableOpacity 
              style={[styles.verifyBtn, isVerifying && styles.verifyBtnDisabled]}
              onPress={verifyOTP}
              disabled={isVerifying}
            >
              {isVerifying ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.verifyBtnText}>VERIFY & CONTINUE</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => handleAttendance(otpType)}
              disabled={isVerifying}
            >
              <Text style={styles.resendText}>Didn't receive code? <Text style={styles.resendLink}>Resend OTP</Text></Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? 40 : 0,
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
    padding: 24,
    paddingBottom: 40, 
  },
  managementSection: {
    marginBottom: 32,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  badgeSmall: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeTextSmall: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  logCard: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  logItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  logLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  nameAndPlatform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
  },
  logName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  logRole: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: 1,
  },
  logRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  logTime: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
  },
  statusTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusTagText: {
    fontSize: 10,
    fontWeight: '900',
  },
  attendanceCard: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 28,
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#eff6ff',
  },
  attendanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  todayTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  todayDate: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 4,
  },
  clockBox: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clockText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#3b82f6',
  },
  attendanceActions: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  actionBtn: {
    flex: 1,
    height: 60,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
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
    gap: 8,
  },
  locationText: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '600',
  },
  menuSection: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1e293b',
    marginLeft: 4,
    marginBottom: 8,
  },
  menuBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
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
    fontWeight: '500',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff1f2',
    padding: 20,
    borderRadius: 24,
    gap: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#ffe4e6',
    justifyContent: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 40,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ef4444',
    letterSpacing: 1,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 32,
    paddingBottom: 48,
    alignItems: 'center',
  },
  modalHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 24,
  },
  modalIconBox: {
    width: 64,
    height: 64,
    backgroundColor: '#eff6ff',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    position: 'absolute',
    right: 0,
    top: 0,
    padding: 4,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 12,
  },
  modalSub: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  otpInput: {
    backgroundColor: '#f8fafc',
    width: '100%',
    height: 70,
    borderRadius: 20,
    fontSize: 28,
    fontWeight: '900',
    color: '#1e3a8a',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    marginBottom: 32,
  },
  verifyBtn: {
    backgroundColor: '#1e3a8a',
    width: '100%',
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
    marginBottom: 24,
  },
  verifyBtnDisabled: {
    opacity: 0.7,
  },
  verifyBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  resendText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '600',
  },
  resendLink: {
    color: '#1e3a8a',
    fontWeight: '800',
  }
});

export default HRMSScreen;
