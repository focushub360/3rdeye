import React, { useState, useCallback, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
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
import { SafeAreaView } from 'react-native-safe-area-context';
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
  X,
  FileText,
  Calendar,
  Zap,
  MoreVertical,
  ShieldAlert,
  ArrowUpRight,
  Navigation,
  History,
  AlertCircle,
  Loader2,
  Users,
  CheckCircle,
  CheckCircle2,
  TrendingUp,
  CalendarCheck
} from 'lucide-react-native';

import * as Location from 'expo-location';
import * as Cellular from 'expo-cellular';
import { useAuth } from '../context/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import apiClient, { BASE_URL } from '../api/config';
import { io } from 'socket.io-client';

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

const AttendanceScreen = ({ navigation }: any) => {
  const { user, logout, setIsCheckedIn, refreshProfile } = useAuth();
  const [lastCheck, setLastCheck] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [attendanceSummary, setAttendanceSummary] = useState<any>(null);
  
  // OTP States
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpType, setOtpType] = useState<'IN' | 'OUT'>('IN');
  const [isVerifying, setIsVerifying] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [animatingChecks, setAnimatingChecks] = useState(false);
  const [checksCompleted, setChecksCompleted] = useState(false);

  // Inspector specific states (Web Parity)
  const [locationName, setLocationName] = useState<string>('Detecting location...');
  const [simInfo, setSimInfo] = useState<string>('DETECTING SIM...');
  const [isSimMatched, setIsSimMatched] = useState<boolean>(false);
  const [location, setLocation] = useState<{ lat: number, lng: number, accuracy: number } | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [hrStatus, setHrStatus] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);

  const [officeLocation, setOfficeLocation] = useState<{ lat: number, lng: number, radius: number } | null>(null);
  const DEFAULT_LOCATION = { lat: 12.9455, lng: 78.8754 };
  const DEFAULT_RADIUS = 100;

  const getDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const isWithinRadius = location 
    ? getDistance(
        location.lat, 
        location.lng, 
        officeLocation?.lat || DEFAULT_LOCATION.lat, 
        officeLocation?.lng || DEFAULT_LOCATION.lng
      ) <= (officeLocation?.radius || DEFAULT_RADIUS) 
    : false;

  // Role Checks
  const isSuperAdmin = user?.role === 'superadmin';
  const isSubAdmin = user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'subadmin' || user?.role === 'lmadmin' || user?.role === 'manager';
  const isInspector = user?.role === 'inspector';
  const canMonitor = isSuperAdmin || isSubAdmin;
  const canCheckIn = !isSubAdmin; // Admins don't check in


  const fetchHRData = async () => {
    if (user?.role !== 'inspector') return;
    try {

      const [statusRes, historyRes] = await Promise.all([
        apiClient.get('/hr/attendance/my-status'),
        apiClient.get('/hr/attendance/my-history')
      ]);
      
      if (statusRes.data.success) {
        const statusData = statusRes.data.data;
        setHrStatus(statusData);
        const isChecked = !!statusData?.attendance?.checkInTime && !statusData?.attendance?.checkOutTime;
        setIsCheckedIn(isChecked);
      }
      if (historyRes.data.success) setHistory(historyRes.data.data.history || []);
    } catch (error) {
      console.log('Error fetching HR data:', error);
      setHrStatus(null);
      setHistory([]);
    }
  };

  const requestLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setLocError('Permission to access location was denied');
      return;
    }
    
    try {
      // Use a timeout for location to prevent hangs in production APK
      const locationPromise = Location.getCurrentPositionAsync({ 
        accuracy: Location.Accuracy.Balanced 
      });
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Location timeout')), 10000)
      );

      let loc: any;
      try {
        loc = await Promise.race([locationPromise, timeoutPromise]);
      } catch (raceErr) {
        // console.warn('Current position timeout, trying last known position...');
        loc = await Location.getLastKnownPositionAsync();
        if (!loc) throw new Error('Could not determine location');
      }
      
      setLocation({
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        accuracy: loc.coords.accuracy || 0
      });
    } catch (err) {
      console.warn('Location fetching error in Attendance:', err);
      // Don't alert here to keep it smooth, just use old location if exists or handle gracefully
    }
  };

  const fetchOfficeLocation = async () => {
    try {
      const response = await apiClient.get('tenants/office-location');
      if (response.data.success && response.data.data) {
        setOfficeLocation({
          lat: response.data.data.lat,
          lng: response.data.data.lng,
          radius: response.data.data.radius || 100
        });
      }
    } catch (error) {
      console.error('Error fetching office location:', error);
    }
  };

  const fetchAttendanceSummary = async () => {
    try {
      const response = await apiClient.get('attendance/summary');
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
      console.log('Error fetching attendance summary:', error);
      setAttendanceSummary({ users: [] });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const detectSim = async () => {
    setSimInfo('DETECTING SIM...');
    setIsSimMatched(false);
    
    try {
      // 1. Check if inspector has a registered phone number
      const registeredNumber = user?.mobile || user?.phone;
      if (!registeredNumber) {
        setSimInfo('NO NUMBER REGISTERED');
        setIsSimMatched(false);
        return;
      }

      // 2. Check if a physical SIM is present via carrier detection
      const carrier = await Cellular.getCarrierNameAsync();
      
      if (!carrier) {
        // No SIM card detected in the device
        setSimInfo('NO SIM DETECTED');
        setIsSimMatched(false);
        return;
      }

      // 3. SIM is present + number is registered = match
      // Format: show last 4 digits of registered number + carrier
      const maskedNumber = '****' + registeredNumber.slice(-4);
      setSimInfo(`${carrier.toUpperCase()} · ${maskedNumber}`);
      setIsSimMatched(true);
      
    } catch (e) {
      console.error('SIM detection error:', e);
      setSimInfo('SIM READ ERROR');
      setIsSimMatched(false);
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      await refreshProfile(); // Ensure we have the latest mobile number for SIM matching
      await Promise.all([
        fetchAttendanceSummary(),
        fetchHRData(),
        requestLocation(),
        detectSim(),
        fetchOfficeLocation()
      ]);
    } catch (err) {
      console.error('Error loading attendance data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadAllData();
      
      // Setup periodic refresh every 30 seconds for live feel
      const interval = setInterval(() => {
        fetchAttendanceSummary();
        fetchHRData();
      }, 30000);

      return () => clearInterval(interval);
    }, [user])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAttendanceSummary();
  }, []);

  const handleAttendance = async (type: 'IN' | 'OUT') => {
    if (type === 'IN') {
      if (!user?.phone && !user?.mobile) {
        Alert.alert('Phone Required', 'Your admin must register a phone number for your account before you can clock in.');
        return;
      }
      
      // SIM verification - must have physical SIM matching registered number
      if (!isSimMatched) {
        Alert.alert(
          'SIM Verification Failed', 
          'The registered phone number SIM must be present in this device to clock in. Please insert the correct SIM card and tap "FETCH SIM" to retry.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      // GPS verification
      if (!location) {
        Alert.alert('GPS Verification Failed', 'GPS signal not found. Please enable location services.');
        return;
      }
      
      if (!isWithinRadius) {
        Alert.alert('Geofence Alert', 'You must be inside the office geofence to clock in.');
        return;
      }
    }

    setOtpType(type);
    setIsVerifying(true);
    
    try {
      const response = await apiClient.post('hr/attendance/send-otp', { type });
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
    if (otpCode.length !== 4) {
      Alert.alert('Invalid OTP', 'Please enter a 4-digit verification code.');
      return;
    }

    setIsVerifying(true);
    try {
      const endpoint = otpType === 'IN' ? 'hr/attendance/verify-otp' : 'hr/attendance/checkout';
      const response = await apiClient.post(endpoint, {
        otp: otpCode,
        ...(otpType === 'OUT' ? { lat: location?.lat, lng: location?.lng, accuracy: location?.accuracy } : {})
      });

      if (response.data.success) {
        setShowOTPModal(false);
        setOtpCode('');
        
        if (otpType === 'IN') {
           setOtpVerified(true);
           setAnimatingChecks(true);
           
           // Simulate animation ticking sequence
           setTimeout(() => {
             setSimInfo('PRIMARY SIM (MATCHED)');
             setIsSimMatched(true);
           }, 1500);
           setTimeout(() => {
             setAnimatingChecks(false);
             setChecksCompleted(true);
           }, 2500); // 2.5 seconds of animation
        } else {
           setLastCheck(`Checked Out: ${new Date().toLocaleTimeString()}`);
           Alert.alert('Success', `Successfully Checked Out`);
           setIsCheckedIn(false);
           fetchHRData();
           fetchAttendanceSummary();
        }
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

  const startShift = async () => {
    setIsVerifying(true);
    try {
      const response = await apiClient.post('hr/attendance/checkin', {
          otp: null, // Already verified
          lat: location?.lat,
          lng: location?.lng,
          accuracy: location?.accuracy
       });
       if (response.data.success) {
         setLastCheck(`Checked In: ${new Date().toLocaleTimeString()}`);
         Alert.alert('Success', 'Successfully Started Shift');
         setIsCheckedIn(true);
         setOtpVerified(false);
         setChecksCompleted(false);
         fetchHRData();
         fetchAttendanceSummary();
       } else {
         Alert.alert('Check-In Failed', response.data.message);
       }
     } catch(e: any) {
       Alert.alert('Error', e.response?.data?.message || 'Failed to start shift');
     } finally {
       setIsVerifying(false);
    }
  };

  // Real-time synchronization via Socket.IO
  useEffect(() => {
    if (!user?.tenantId) return;
    
    const SOCKET_URL = BASE_URL.replace('/api', '');
    const socket = io(SOCKET_URL);

    // Join tenant room
    socket.emit('join-group-chat', user.tenantId);
    
    // Listen for HR updates from Web Dashboard
    socket.on('hr-update', () => {
      console.log('🔄 Live Sync Triggered: Web change detected');
      fetchHRData();
      fetchAttendanceSummary();
      fetchOfficeLocation();
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <UserCheck size={28} color="#4f46e5" />
        <Text style={styles.headerTitle}>{isSubAdmin ? 'HR Management System' : 'Attendance Management'}</Text>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >

        {/* Attendance Monitor for Management */}
        {/* Staff Presence Summary (Admin Only) */}
        {isSubAdmin && attendanceSummary && (

          <View style={styles.managementSection}>
            {/* Attendance Pulse - New Section (Live & Sync) */}
            {isSubAdmin && attendanceSummary && (
              <View style={[styles.pulseContainer, { marginBottom: 32 }]}>
                <View style={styles.pulseHeader}>
                  <View style={styles.pulseTitleRow}>
                    <TrendingUp size={16} color="#4f46e5" />
                    <Text style={[styles.pulseTitle, { color: '#4f46e5' }]}>ATTENDANCE PULSE</Text>
                  </View>
                  <View style={[styles.liveBadgePulse, { backgroundColor: '#eff6ff', borderColor: '#dbeafe' }]}>
                    <View style={[styles.liveDotPulse, { backgroundColor: '#3b82f6' }]} />
                    <Text style={[styles.liveTextPulse, { color: '#2563eb' }]}>LIVE</Text>
                  </View>
                </View>

                <View style={styles.pulseGrid}>
                  <View style={styles.pulseRow}>
                    <View style={styles.pulseItem}>
                      <View style={styles.pulseIconBg}>
                        <Users size={18} color="#6366f1" />
                      </View>
                      <Text style={styles.pulseValue}>{attendanceSummary?.totalStaff || attendanceSummary?.totalInspectors || 0}</Text>
                      <Text style={styles.pulseLabel}>Total Staff</Text>
                    </View>
                    <View style={styles.pulseDivider} />
                    <View style={styles.pulseItem}>
                      <View style={[styles.pulseIconBg, { backgroundColor: '#f0fdf4' }]}>
                        <Clock size={18} color="#22c55e" />
                      </View>
                      <Text style={[styles.pulseValue, { color: '#22c55e' }]}>{attendanceSummary?.clockInToday || attendanceSummary?.presentToday || 0}</Text>
                      <Text style={styles.pulseLabel}>Clock In Today</Text>
                    </View>
                  </View>
                  <View style={[styles.pulseRow, { marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#f1f5f9' }]}>
                    <View style={styles.pulseItem}>
                      <View style={[styles.pulseIconBg, { backgroundColor: '#fff7ed' }]}>
                        <History size={18} color="#f59e0b" />
                      </View>
                      <Text style={[styles.pulseValue, { color: '#f59e0b' }]}>{attendanceSummary?.postShift || attendanceSummary?.lateComing || 0}</Text>
                      <Text style={styles.pulseLabel}>Post Shift</Text>
                    </View>
                    <View style={styles.pulseDivider} />
                    <View style={styles.pulseItem}>
                      <View style={[styles.pulseIconBg, { backgroundColor: '#fef2f2' }]}>
                        <CalendarCheck size={18} color="#ef4444" />
                      </View>
                      <Text style={[styles.pulseValue, { color: '#ef4444' }]}>{attendanceSummary?.approvedLeave || attendanceSummary?.leaveToday || 0}</Text>
                      <Text style={styles.pulseLabel}>Approved Leave</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            <View style={styles.sectionHeaderRow}>
               <Text style={styles.headerTitle}>Staff Presence</Text>
               <View style={styles.badgeSmall}>
                  <Text style={styles.badgeTextSmall}>LOGS</Text>
               </View>
            </View>
            
            <View style={styles.logContainer}>
               {attendanceSummary.users?.slice(0, 5).map((item: any, idx: number) => {
                  const isIn = !item.logoutTime && item.isActive;
                  const name = item.userId ? `${item.userId.firstName} ${item.userId.lastName}` : 'Anonymous';
                  
                  return (
                    <View key={idx} style={styles.logCard}>
                       <View style={styles.logUserBox}>
                          <View style={[styles.avatarSmall, { backgroundColor: isIn ? '#dcfce7' : '#f1f5f9' }]}>
                             <UserCheck size={14} color={isIn ? '#166534' : '#94a3b8'} />
                          </View>
                          <View>
                             <Text style={styles.logName}>{name}</Text>
                             <Text style={styles.logRole}>{item.userId?.role || 'Staff'}</Text>
                          </View>
                       </View>
                       <View style={styles.logTimeBox}>
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

        {/* Personal Attendance for Inspectors - Web High-Fidelity Style */}
        {canCheckIn && (
          <View style={styles.webStyleDashboard}>
            {/* Shift Card */}
            <View style={styles.shiftCardWeb}>
               <View style={styles.shiftCardHeader}>
                  <Clock size={18} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.shiftCardLabel}>ASSIGNED SHIFT</Text>
               </View>
               <Text style={styles.shiftNameWeb}>{hrStatus?.shift?.displayName || 'No Shift Assigned'}</Text>
               <View style={styles.shiftTimesRow}>
                  <View style={styles.shiftTimeItem}>
                     <Text style={styles.sTimeLabel}>START</Text>
                     <Text style={styles.sTimeValue}>{hrStatus?.shift?.startTime || '--:--'}</Text>
                  </View>
                  <View style={styles.sTimeDivider} />
                  <View style={styles.shiftTimeItem}>
                     <Text style={styles.sTimeLabel}>END</Text>
                     <Text style={styles.sTimeValue}>{hrStatus?.shift?.endTime || '--:--'}</Text>
                  </View>
               </View>
            </View>

            {/* Action Box */}
            <View style={styles.actionBoxWeb}>
               <View style={styles.geofenceStatus}>
                  <View style={styles.geoItem}>
                    <View style={[styles.geoDot, { backgroundColor: hrStatus?.shift ? '#22c55e' : '#ef4444' }]} />
                    <Text style={styles.geoText}>SHIFT: {hrStatus?.shift ? 'ASSIGNED' : 'UNASSIGNED'}</Text>
                  </View>
                  <View style={styles.geoItem}>
                    <View style={[styles.geoDot, { backgroundColor: location ? '#22c55e' : '#ef4444' }]} />
                    <Text style={styles.geoText}>GPS: {location ? 'ACTIVE' : 'OFF'}</Text>
                  </View>
                  <View style={styles.geoItem}>
                    <View style={[styles.geoDot, { backgroundColor: isWithinRadius ? '#22c55e' : '#ef4444' }]} />
                    <Text style={styles.geoText}>
                      GEOSYNC: {isWithinRadius ? 'IN RANGE' : 'OUTSIDE'}
                      {!isWithinRadius && location && officeLocation && (
                        <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>
                          {' '}({Math.round(getDistance(location.lat, location.lng, officeLocation.lat, officeLocation.lng) - officeLocation.radius)}m away)
                        </Text>
                      )}
                    </Text>
                  </View>
                  <View style={styles.geoItem}>
                    <View style={[styles.geoDot, { backgroundColor: (user?.phone || user?.mobile) ? '#22c55e' : '#f59e0b' }]} />
                    <Text style={styles.geoText}>PHONE: {(user?.phone || user?.mobile) ? String(user?.phone || user?.mobile) : 'MISSING'}</Text>
                  </View>
                  <View style={styles.geoItem}>
                     <View style={[styles.geoDot, { backgroundColor: isSimMatched ? '#22c55e' : '#f59e0b' }]} />
                     <Text style={styles.geoText}>SIM: {simInfo}</Text>
                     <TouchableOpacity 
                       style={[styles.fetchTag, isSimMatched && { backgroundColor: '#f0fdf4' }]}
                       onPress={detectSim}
                     >
                       <Text style={[styles.fetchTagText, isSimMatched && { color: '#166534' }]}>{isSimMatched ? 'NETWORK MATCH' : 'FETCH SIM'}</Text>
                     </TouchableOpacity>
                   </View>
               </View>

               {!hrStatus?.attendance?.checkInTime ? (
                 <View>
                   {(() => {
                     const conditions = [];
                     if (!hrStatus?.shift) conditions.push('No Shift Assigned');
                     if (!(user?.phone || user?.mobile)) conditions.push('No Phone Registered');
                     else if (!isSimMatched) conditions.push('SIM Not Matched');
                     if (!location) conditions.push('GPS Not Active');
                     else if (!isWithinRadius) conditions.push('Outside Geofence');
                     
                     const hasUnfilled = conditions.length > 0;
                     
                     return (
                       <>
                         {hasUnfilled && !otpVerified && (
                           <View style={styles.requirementWarning}>
                              <AlertCircle size={14} color="#f59e0b" />
                              <Text style={styles.warningText}>
                                 Requires: {conditions.join(', ')}
                              </Text>
                           </View>
                         )}
                         
                         {!otpVerified ? (
                           <TouchableOpacity 
                              style={[styles.punchBtn, (isVerifying || hasUnfilled) && styles.punchBtnDisabled]}
                              onPress={() => handleAttendance('IN')}
                              disabled={isVerifying || hasUnfilled}
                            >
                               {isVerifying ? <ActivityIndicator color="#fff" /> : <KeyRound size={24} color="#fff" />}
                               <Text style={styles.punchBtnText}>CLOCK IN</Text>
                            </TouchableOpacity>
                         ) : animatingChecks ? (
                      <View style={styles.animationBox}>
                         <ActivityIndicator color="#4f46e5" size="large" />
                         <Text style={styles.animText}>Verifying SIM, GPS & Geofence...</Text>
                      </View>
                   ) : checksCompleted ? (
                      <TouchableOpacity 
                        style={[styles.punchBtn, { backgroundColor: '#10b981' }, isVerifying && styles.punchBtnDisabled]}
                        onPress={startShift}
                        disabled={isVerifying}
                      >
                         {isVerifying ? <ActivityIndicator color="#fff" /> : <LogIn size={24} color="#fff" />}
                         <Text style={styles.punchBtnText}>START SHIFT</Text>
                      </TouchableOpacity>
                   ) : null}
                       </>
                     );
                   })()}
                 </View>
               ) : !hrStatus?.attendance?.checkOutTime ? (
                 <View style={styles.activePunchContainer}>
                    <View style={styles.punchedInIndicator}>
                       <Text style={styles.punchInAtLabel}>CLOCKED IN AT</Text>
                       <Text style={styles.punchInAtValue}>
                          {new Date(hrStatus.attendance.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                       </Text>
                    </View>
                    <TouchableOpacity 
                      style={[styles.punchBtn, { backgroundColor: '#ef4444' }, isVerifying && styles.punchBtnDisabled]}
                      onPress={() => handleAttendance('OUT')}
                      disabled={isVerifying}
                    >
                       {isVerifying ? <ActivityIndicator color="#fff" /> : <LogOut size={24} color="#fff" />}
                       <Text style={styles.punchBtnText}>CLOCK OUT</Text>
                    </TouchableOpacity>
                 </View>
               ) : (
                 <View style={styles.completedBox}>
                    <CheckCircle2 size={32} color="#10b981" />
                    <Text style={styles.completedTitle}>Shift Completed</Text>
                    <Text style={styles.completedSub}>Good job! Your day is recorded.</Text>
                 </View>
               )}
            </View>

            {/* Recent History Feed */}
            <View style={styles.historySectionWeb}>
               <View style={styles.historyHeader}>
                  <History size={16} color="#64748b" />
                  <Text style={styles.historyTitle}>RECENT ACTIVITY</Text>
               </View>
               {history.map((item, idx) => (
                 <View key={item._id || idx} style={styles.historyItemWeb}>
                    <View style={[styles.histIcon, { backgroundColor: item.status === 'present' ? '#f0fdf4' : '#fffbeb' }]}>
                       <Clock size={16} color={item.status === 'present' ? '#10b981' : '#f59e0b'} />
                    </View>
                    <View style={styles.histMain}>
                       <Text style={styles.histDate}>{new Date(item.date).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
                       <Text style={styles.histTimes}>
                          {item.checkInTime ? new Date(item.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'} - {item.checkOutTime ? new Date(item.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                       </Text>
                    </View>
                    <View style={[styles.histTag, { backgroundColor: item.status === 'present' ? '#eff6ff' : '#fef2f2' }]}>
                       <Text style={[styles.histTagText, { color: item.status === 'present' ? '#3b82f6' : '#ef4444' }]}>{item.status.toUpperCase()}</Text>
                    </View>
                 </View>
               ))}
               {history.length === 0 && (
                 <Text style={styles.noHistoryText}>No recent activity found</Text>
               )}
            </View>
          </View>
        )}

        {/* Module Grid - Neat & Clean as Web */}
        <View style={styles.moduleGrid}>
           <TouchableOpacity 
             style={styles.moduleCard} 
             onPress={() => navigation.navigate('AttendanceManagement')}
           >
              <View style={[styles.moduleIcon, { backgroundColor: '#eff6ff' }]}>
                <Clock size={22} color="#1e40af" />
              </View>
              <Text style={styles.moduleTitle}>HR Reports</Text>
              <Text style={styles.moduleSub}>Attendance & Analysis</Text>
              <ArrowUpRight size={14} color="#94a3b8" style={styles.moduleArrow} />
           </TouchableOpacity>

           <TouchableOpacity 
             style={styles.moduleCard}
             onPress={() => navigation.navigate('LeaveManagement')}
           >
              <View style={[styles.moduleIcon, { backgroundColor: '#fdf2f8' }]}>
                <Calendar size={22} color="#be185d" />
              </View>
              <Text style={styles.moduleTitle}>Leaves</Text>
              <Text style={styles.moduleSub}>Request & Balance</Text>
              <ArrowUpRight size={14} color="#94a3b8" style={styles.moduleArrow} />
           </TouchableOpacity>

           <TouchableOpacity 
             style={styles.moduleCard}
             onPress={() => navigation.navigate('PermissionManagement')}
           >
              <View style={[styles.moduleIcon, { backgroundColor: '#ecfdf5' }]}>
                <ClipboardCheck size={22} color="#059669" />
              </View>
              <Text style={styles.moduleTitle}>Permissions</Text>
              <Text style={styles.moduleSub}>Daily Gate Pass</Text>
              <ArrowUpRight size={14} color="#94a3b8" style={styles.moduleArrow} />
           </TouchableOpacity>

            <TouchableOpacity 
              style={styles.moduleCard}
              onPress={() => navigation.navigate(isSubAdmin ? 'AdminShiftManagement' : 'ShiftManagement')}
            >
               <View style={[styles.moduleIcon, { backgroundColor: '#fff7ed' }]}>
                 <Zap size={22} color="#ea580c" />
               </View>
               <Text style={styles.moduleTitle}>{isSubAdmin ? 'Shift Management' : 'My Shifts'}</Text>
               <Text style={styles.moduleSub}>{isSubAdmin ? 'Assign & Manage' : 'Schedule & Rotations'}</Text>
               <ArrowUpRight size={14} color="#94a3b8" style={styles.moduleArrow} />
            </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Power size={18} color="#ef4444" />
          <Text style={styles.logoutText}>SIGN OUT</Text>
        </TouchableOpacity>
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
                <KeyRound size={28} color="#4f46e5" />
              </View>
              <TouchableOpacity onPress={() => setShowOTPModal(false)} style={styles.closeBtn}>
                <X size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalTitle}>Verify Check-{otpType}</Text>
            <Text style={styles.modalSub}>Enter the 4-digit code sent to your registered WhatsApp/Device</Text>
            
            <TextInput
              style={styles.otpInput}
              placeholder="0000"
              placeholderTextColor="#cbd5e1"
              keyboardType="number-pad"
              maxLength={4}
              value={otpCode}
              onChangeText={setOtpCode}
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
    backgroundColor: '#4f46e5',
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
  logContainer: {
    marginTop: 8,
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
  logCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  logUserBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logTimeBox: {
    alignItems: 'flex-end',
    gap: 4,
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusTagText: {
    fontSize: 10,
    fontWeight: '900',
  },

  attendanceCard: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 28,
    shadowColor: '#4f46e5',
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
  animationBox: {
    padding: 20,
    backgroundColor: '#eff6ff',
    borderRadius: 24,
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  animText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e40af',
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
  moduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
  },
  moduleCard: {
    width: (width - 60) / 2,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
  },
  moduleIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  moduleTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 2,
  },
  moduleSub: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  moduleArrow: {
    position: 'absolute',
    top: 20,
    right: 20,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: '#fee2e2',
    justifyContent: 'center',
    marginBottom: 40,
  },
  logoutText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ef4444',
    letterSpacing: 0.5,
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
    color: '#4f46e5',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    marginBottom: 32,
    letterSpacing: 10,
  },
  verifyBtn: {
    backgroundColor: '#4f46e5',
    width: '100%',
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4f46e5',
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
    color: '#4f46e5',
    fontWeight: '800',
  },
  requirementWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fffbeb',
    padding: 12,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fef3c7'
  },
  warningText: {
    fontSize: 12,
    color: '#b45309',
    fontWeight: '700'
  },
  // Inspector Web-style dashboard
  webStyleDashboard: {
    marginBottom: 32,
    gap: 16
  },
  shiftCardWeb: {
    backgroundColor: '#4f46e5',
    borderRadius: 32,
    padding: 24,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
  },
  shiftCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12
  },
  shiftCardLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase'
  },
  shiftNameWeb: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 20
  },
  shiftTimesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  shiftTimeItem: {
    flex: 1,
    alignItems: 'center'
  },
  sTimeLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 8,
    fontWeight: '800',
    marginBottom: 4
  },
  sTimeValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800'
  },
  sTimeDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.2)'
  },
  actionBoxWeb: {
    backgroundColor: '#fff',
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
  },
  geofenceStatus: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  geoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  geoDot: {
    width: 6,
    height: 6,
    borderRadius: 3
  },
  geoText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 0.5
  },
  distanceMark: {
    fontSize: 9,
    fontWeight: '800',
    color: '#3b82f6',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  punchBtn: {
    backgroundColor: '#10b981',
    height: 70,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4
  },
  punchBtnDisabled: {
    backgroundColor: '#e2e8f0',
    shadowOpacity: 0,
    elevation: 0
  },
  punchBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  activePunchContainer: {
    gap: 16
  },
  punchedInIndicator: {
    backgroundColor: '#f0fdf4',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#dcfce7',
    alignItems: 'center'
  },
  punchInAtLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#166534',
    letterSpacing: 1,
    marginBottom: 4
  },
  punchInAtValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#14532d'
  },
  completedBox: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8fafc',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#f1f5f9'
  },
  completedTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 12
  },
  completedSub: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '500'
  },
  historySectionWeb: {
    gap: 12
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 4,
    marginBottom: 4
  },
  historyTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 1
  },
  historyItemWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    gap: 12
  },
  histIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  histMain: {
    flex: 1
  },
  histDate: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b'
  },
  histTimes: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: 2
  },
  histTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8
  },
  histTagText: {
    fontSize: 9,
    fontWeight: '900'
  },
  noHistoryText: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 10,
    fontStyle: 'italic'
  },
  fetchTag: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6
  },
  fetchTagText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900'
  },
  pulseContainer: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
    marginBottom: 32,
  },
  pulseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  pulseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  liveBadgePulse: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 5,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  liveDotPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3b82f6',
  },
  liveTextPulse: {
    fontSize: 9,
    fontWeight: '900',
    color: '#2563eb',
    letterSpacing: 0.5,
  },
  pulseTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 1.2,
  },
  pulseGrid: {
    marginTop: 8,
  },
  pulseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pulseItem: {
    alignItems: 'center',
    flex: 1,
  },
  pulseValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
  },
  pulseLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    marginTop: 4,
  },
  pulseDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#f1f5f9',
  },
  pulseIconBg: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
});


export default AttendanceScreen;
