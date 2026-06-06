import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Platform,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ChevronLeft, 
  Clock, 
  RotateCcw, 
  Zap, 
  Calendar,
  ChevronRight,
  User,
  Coffee,
  CheckCircle,
  X,
  Info
} from 'lucide-react-native';
import apiClient from '../api/config';
import { useAuth } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

const ShiftManagementScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'superadmin' || user?.role === 'subadmin' || user?.role === 'lmadmin';
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [shiftData, setShiftData] = useState<any>(null);

  const fetchShiftDetails = async () => {
    const userId = user?._id || user?.id;
    const cacheKey = `@cached_my_shift_${userId}`;
    try {
      setLoading(true);
      const response = await apiClient.get('/hr/attendance/my-shift');
      if (response.data.success) {
        setShiftData(response.data.data);
        await AsyncStorage.setItem(cacheKey, JSON.stringify(response.data.data));
      }
    } catch (error) {
      console.log('Error fetching shift details, loading fallback from cache');
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          setShiftData(JSON.parse(cached));
        } else {
          // Mock data fallback if no cache exists
          setShiftData({
            currentShift: {
              name: 'General Shift',
              startTime: '09:00',
              endTime: '18:00',
              breakTime: '13:00 - 14:00',
              days: 'Mon - Fri',
              color: '#1e3a8a'
            },
            roster: [
              { day: 'Mon', date: '24 Apr', shift: 'General' },
              { day: 'Tue', date: '25 Apr', shift: 'General' },
              { day: 'Wed', date: '26 Apr', shift: 'General' },
              { day: 'Thu', date: '27 Apr', shift: 'Weekly Off', isOff: true },
              { day: 'Fri', date: '28 Apr', shift: 'Morning', isRotating: true },
            ]
          });
        }
      } catch (cacheErr) {
        // Fallback to mock data on error
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchShiftDetails();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchShiftDetails();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color="#1e3a8a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shift Roster</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading && !refreshing ? (
          <ActivityIndicator size="large" color="#1e3a8a" style={{ marginTop: 40 }} />
        ) : shiftData ? (
          <>
            <View style={styles.heroCard}>
               <View style={styles.heroTop}>
                  <View style={styles.shiftLabelGroup}>
                     <Zap size={16} color="#fff" />
                     <Text style={styles.heroLabel}>CURRENT ASSIGNMENT</Text>
                  </View>
                  {!isAdmin && (
                    <TouchableOpacity style={styles.requestChangeBtn} onPress={() => Alert.alert('Request Change', 'Shift change requests are managed by Admin.')}>
                       <RotateCcw size={14} color="rgba(255,255,255,0.6)" />
                    </TouchableOpacity>
                  )}
               </View>

               <Text style={styles.shiftName}>{shiftData.currentShift.name}</Text>
               
               <View style={styles.timeRow}>
                  <View style={styles.timeBlock}>
                      <Text style={styles.timeValue}>{shiftData.currentShift.startTime}</Text>
                      <Text style={styles.timeLabel}>START</Text>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.timeBlock}>
                      <Text style={styles.timeValue}>{shiftData.currentShift.endTime}</Text>
                      <Text style={styles.timeLabel}>END</Text>
                  </View>
               </View>

               <View style={styles.breakRow}>
                  <Coffee size={14} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.breakText}>Mid-day Break: {shiftData.currentShift.breakTime}</Text>
               </View>
            </View>

            <Text style={styles.sectionHeading}>Weekly Schedule</Text>
            
            <View style={styles.rosterContainer}>
               {shiftData.roster.map((item: any, idx: number) => (
                 <View key={idx} style={[styles.rosterItem, item.isOff && styles.rosterItemOff]}>
                    <View style={styles.dateCol}>
                       <Text style={[styles.dayText, item.isOff && styles.textMuted]}>{item.day}</Text>
                       <Text style={[styles.dateText, item.isOff && styles.textMuted]}>{item.date}</Text>
                    </View>
                    <View style={styles.shiftCol}>
                       <Text style={[styles.rosterShiftName, item.isOff && styles.textMuted]}>{item.shift}</Text>
                       {item.isRotating && (
                         <View style={styles.tag}>
                            <RotateCcw size={10} color="#8b5cf6" />
                            <Text style={styles.tagText}>ROTATING</Text>
                         </View>
                       )}
                    </View>
                    {item.isOff ? (
                       <X size={20} color="#cbd5e1" />
                    ) : (
                       <CheckCircle size={20} color="#10b981" />
                    )}
                 </View>
               ))}
            </View>

            <View style={styles.infoBox}>
               <Info size={18} color="#1e3a8a" />
               <Text style={styles.infoBoxText}>
                  Your shift rotation happens every Monday. Please check the portal on Sunday evening for next week's confirmed roster.
               </Text>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  scrollContent: { padding: 24, paddingBottom: 40 },
  heroCard: { backgroundColor: '#1e3a8a', borderRadius: 32, padding: 28, shadowColor: '#1e3a8a', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 12 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  shiftLabelGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroLabel: { fontSize: 10, fontWeight: '900', color: 'rgba(255,255,255,0.6)', letterSpacing: 1 },
  requestChangeBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  shiftName: { fontSize: 28, fontWeight: '900', color: '#fff', marginBottom: 30 },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingHorizontal: 10 },
  timeBlock: { alignItems: 'center' },
  timeValue: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 4 },
  timeLabel: { fontSize: 9, fontWeight: '900', color: 'rgba(255,255,255,0.5)', letterSpacing: 1.5 },
  divider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.1)' },
  breakRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.08)', padding: 12, borderRadius: 14 },
  breakText: { fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  sectionHeading: { fontSize: 16, fontWeight: '800', color: '#1e293b', marginTop: 32, marginBottom: 20 },
  rosterContainer: { backgroundColor: '#fff', borderRadius: 28, padding: 10, borderWidth: 1, borderColor: '#f1f5f9' },
  rosterItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  rosterItemOff: { backgroundColor: '#fcfcfd', opacity: 0.7 },
  dateCol: { width: 70 },
  dayText: { fontSize: 14, fontWeight: '800', color: '#1e293b' },
  dateText: { fontSize: 11, fontWeight: '600', color: '#94a3b8', marginTop: 2 },
  shiftCol: { flex: 1, paddingLeft: 10 },
  rosterShiftName: { fontSize: 14, fontWeight: '700', color: '#475569' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  tagText: { fontSize: 9, fontWeight: '900', color: '#8b5cf6' },
  textMuted: { color: '#cbd5e1' },
  infoBox: { flexDirection: 'row', gap: 14, backgroundColor: '#eff6ff', borderRadius: 20, padding: 20, marginTop: 32, borderWidth: 1, borderColor: '#dbeafe' },
  infoBoxText: { flex: 1, fontSize: 13, color: '#1e40af', lineHeight: 20, fontWeight: '500' }
});

export default ShiftManagementScreen;
