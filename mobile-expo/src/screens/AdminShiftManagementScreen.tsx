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
  Alert,
  Modal,
  TextInput,
  FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ChevronLeft, 
  Plus, 
  Clock, 
  Users, 
  Trash2, 
  Edit2, 
  UserPlus,
  CheckCircle2,
  X,
  Zap,
  Info,
  Calendar
} from 'lucide-react-native';
import apiClient from '../api/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const { width } = Dimensions.get('window');

const AdminShiftManagementScreen = ({ navigation }: any) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [shifts, setShifts] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedShift, setSelectedShift] = useState<any>(null);
  const [availableInspectors, setAvailableInspectors] = useState<any[]>([]);
  const [loadingInspectors, setLoadingInspectors] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    startTime: '09:00',
    endTime: '18:00',
    gracePeriod: '15',
    lateThreshold: '30',
    halfDayThreshold: '120',
  });

  const fetchShifts = async () => {
    try {
      setLoading(true);
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        const cached = await AsyncStorage.getItem('@cached_admin_shifts');
        if (cached) {
          setShifts(JSON.parse(cached));
        }
        return;
      }

      const response = await apiClient.get('/hr/shifts');
      if (response.data.success) {
        const shiftData = response.data.data || [];
        setShifts(shiftData);
        await AsyncStorage.setItem('@cached_admin_shifts', JSON.stringify(shiftData));
      }
    } catch (error) {
      console.error('Fetch Shifts Error:', error);
      try {
        const cached = await AsyncStorage.getItem('@cached_admin_shifts');
        if (cached) {
          setShifts(JSON.parse(cached));
        } else {
          Alert.alert('Error', 'Failed to load shifts');
        }
      } catch (cacheErr) {
        Alert.alert('Error', 'Failed to load shifts');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchAvailableInspectors = async (shiftId: string) => {
    try {
      setLoadingInspectors(true);
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        const cached = await AsyncStorage.getItem(`@cached_available_inspectors_${shiftId}`);
        if (cached) {
          setAvailableInspectors(JSON.parse(cached));
        } else {
          setAvailableInspectors([]);
        }
        return;
      }

      const response = await apiClient.get('/hr/shifts/available-inspectors', {
        params: { shiftId }
      });
      if (response.data.success) {
        const inspectors = response.data.data || [];
        setAvailableInspectors(inspectors);
        await AsyncStorage.setItem(`@cached_available_inspectors_${shiftId}`, JSON.stringify(inspectors));
      }
    } catch (error) {
      console.error('Fetch Inspectors Error:', error);
      try {
        const cached = await AsyncStorage.getItem(`@cached_available_inspectors_${shiftId}`);
        if (cached) {
          setAvailableInspectors(JSON.parse(cached));
        }
      } catch (cacheErr) {}
    } finally {
      setLoadingInspectors(false);
    }
  };

  useEffect(() => {
    fetchShifts();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchShifts();
  }, []);

  const handleCreateShift = async () => {
    if (!formData.name || !formData.startTime || !formData.endTime) {
      Alert.alert('Required', 'Please fill in shift name and timings');
      return;
    }

    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      Alert.alert('Offline Mode Active', 'You are offline. Creating shifts requires an active internet connection.');
      return;
    }

    try {
      const response = await apiClient.post('/hr/shifts', formData);
      if (response.data.success) {
        Alert.alert('Success', 'Shift created successfully');
        setShowCreateModal(false);
        fetchShifts();
        setFormData({
          name: '',
          displayName: '',
          startTime: '09:00',
          endTime: '18:00',
          gracePeriod: '15',
          lateThreshold: '30',
          halfDayThreshold: '120',
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create shift');
    }
  };

  const handleDeleteShift = (id: string) => {
    Alert.alert(
      'Delete Shift',
      'Are you sure you want to delete this shift? All assignments will be removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            const netState = await NetInfo.fetch();
            if (!netState.isConnected) {
              Alert.alert('Offline Mode Active', 'You are offline. Deleting shifts requires an active internet connection.');
              return;
            }
            try {
              const response = await apiClient.delete(`/hr/shifts/${id}`);
              if (response.data.success) {
                fetchShifts();
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete shift');
            }
          }
        }
      ]
    );
  };

  const handleAssignInspectors = async (inspectorIds: string[]) => {
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      Alert.alert('Offline Mode Active', 'You are offline. Assigning inspectors requires an active internet connection.');
      return;
    }
    try {
      const response = await apiClient.post(`/hr/shifts/${selectedShift._id}/assign`, {
        inspectorIds
      });
      if (response.data.success) {
        Alert.alert('Success', 'Inspectors assigned');
        setShowAssignModal(false);
        fetchShifts();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to assign inspectors');
    }
  };

  const renderShiftCard = (shift: any) => (
    <View key={shift._id} style={styles.shiftCard}>
      <View style={styles.shiftCardHeader}>
        <View>
           <Text style={styles.shiftName}>{shift.name}</Text>
           <Text style={styles.shiftDesc}>{shift.displayName || 'Operations'}</Text>
        </View>
        <View style={styles.headerActions}>
           <TouchableOpacity style={styles.iconBtn} onPress={() => handleDeleteShift(shift._id)}>
              <Trash2 size={18} color="#ef4444" />
           </TouchableOpacity>
        </View>
      </View>

      <View style={styles.timeRow}>
        <Clock size={16} color="#1e3a8a" />
        <Text style={styles.timeText}>{shift.startTime} - {shift.endTime}</Text>
      </View>

      <View style={styles.thresholdGrid}>
        <View style={[styles.thresholdBadge, { backgroundColor: '#f0fdf4' }]}>
           <Text style={styles.thresholdVal}>{shift.gracePeriod}m</Text>
           <Text style={styles.thresholdLabel}>Grace</Text>
        </View>
        <View style={[styles.thresholdBadge, { backgroundColor: '#fffbeb' }]}>
           <Text style={styles.thresholdVal}>{shift.lateThreshold}m</Text>
           <Text style={styles.thresholdLabel}>Late</Text>
        </View>
        <View style={[styles.thresholdBadge, { backgroundColor: '#fef2f2' }]}>
           <Text style={styles.thresholdVal}>{shift.halfDayThreshold}m</Text>
           <Text style={styles.thresholdLabel}>Half-Day</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.footerRow}>
        <View style={styles.inspectorCount}>
           <Users size={16} color="#64748b" />
           <Text style={styles.countText}>Inspectors ({shift.assignedInspectors?.length || 0})</Text>
        </View>
        <TouchableOpacity 
          style={styles.assignBtn} 
          onPress={() => {
            setSelectedShift(shift);
            fetchAvailableInspectors(shift._id);
            setShowAssignModal(true);
          }}
        >
           <UserPlus size={16} color="#1e3a8a" />
           <Text style={styles.assignText}>Assign</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color="#1e3a8a" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Shift Management</Text>
          <Text style={styles.headerSub}>Define hours and assign teams</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreateModal(true)}>
           <Plus size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading && !refreshing ? (
          <ActivityIndicator size="large" color="#1e3a8a" style={{ marginTop: 40 }} />
        ) : shifts.length > 0 ? (
          shifts.map(renderShiftCard)
        ) : (
          <View style={styles.emptyContainer}>
            <Calendar size={64} color="#f1f5f9" />
            <Text style={styles.emptyText}>No shifts defined yet</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowCreateModal(true)}>
               <Text style={styles.emptyBtnText}>+ CREATE FIRST SHIFT</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Create Shift Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Shift</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <X size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll}>
              <Text style={styles.inputLabel}>Shift Name (e.g. Morning Shift)</Text>
              <TextInput 
                style={styles.input}
                value={formData.name}
                onChangeText={(v) => setFormData({...formData, name: v})}
                placeholder="Enter shift name"
              />

              <Text style={styles.inputLabel}>Display Name (Optional)</Text>
              <TextInput 
                style={styles.input}
                value={formData.displayName}
                onChangeText={(v) => setFormData({...formData, displayName: v})}
                placeholder="e.g. Field Operations"
              />

              <View style={styles.inputRow}>
                <View style={{ flex: 1 }}>
                   <Text style={styles.inputLabel}>Start Time</Text>
                   <TextInput 
                    style={styles.input}
                    value={formData.startTime}
                    onChangeText={(v) => setFormData({...formData, startTime: v})}
                    placeholder="HH:MM"
                  />
                </View>
                <View style={{ width: 20 }} />
                <View style={{ flex: 1 }}>
                   <Text style={styles.inputLabel}>End Time</Text>
                   <TextInput 
                    style={styles.input}
                    value={formData.endTime}
                    onChangeText={(v) => setFormData({...formData, endTime: v})}
                    placeholder="HH:MM"
                  />
                </View>
              </View>

              <Text style={styles.sectionHeading}>Thresholds (Minutes)</Text>
              
              <View style={styles.thresholdInputRow}>
                <View style={styles.tInputGroup}>
                   <Text style={styles.tLabel}>Grace</Text>
                   <TextInput 
                    style={styles.tInput}
                    value={formData.gracePeriod}
                    onChangeText={(v) => setFormData({...formData, gracePeriod: v})}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.tInputGroup}>
                   <Text style={styles.tLabel}>Late</Text>
                   <TextInput 
                    style={styles.tInput}
                    value={formData.lateThreshold}
                    onChangeText={(v) => setFormData({...formData, lateThreshold: v})}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.tInputGroup}>
                   <Text style={styles.tLabel}>Half-Day</Text>
                   <TextInput 
                    style={styles.tInput}
                    value={formData.halfDayThreshold}
                    onChangeText={(v) => setFormData({...formData, halfDayThreshold: v})}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <TouchableOpacity style={styles.submitBtn} onPress={handleCreateShift}>
                 <Text style={styles.submitBtnText}>CREATE SHIFT</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Assign Modal */}
      <Modal visible={showAssignModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
             <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Assign Inspectors</Text>
                <TouchableOpacity onPress={() => setShowAssignModal(false)}>
                  <X size={24} color="#64748b" />
                </TouchableOpacity>
             </View>
             
             {loadingInspectors ? (
               <ActivityIndicator color="#1e3a8a" style={{ padding: 40 }} />
             ) : (
               <FlatList 
                 data={availableInspectors}
                 keyExtractor={(item) => item._id}
                 renderItem={({ item }) => (
                   <TouchableOpacity 
                     style={styles.inspectorItem}
                     onPress={() => handleAssignInspectors([item._id])}
                   >
                     <View style={styles.inspectorInfo}>
                        <View style={styles.avatar}>
                           <Text style={styles.avatarText}>{item.firstName?.[0] || 'U'}</Text>
                        </View>
                        <View>
                           <Text style={styles.inspectorName}>{item.firstName} {item.lastName}</Text>
                           <Text style={styles.inspectorEmail}>{item.email}</Text>
                        </View>
                     </View>
                     <UserPlus size={20} color="#1e3a8a" />
                   </TouchableOpacity>
                 )}
                 ListEmptyComponent={
                   <Text style={styles.emptyModalText}>No available inspectors found</Text>
                 }
               />
             )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 16, 
    backgroundColor: '#fff', 
    borderBottomWidth: 1, 
    borderBottomColor: '#f1f5f9' 
  },
  backBtn: { padding: 8, marginRight: 8 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  headerSub: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  addBtn: { 
    marginLeft: 'auto', 
    width: 44, 
    height: 44, 
    borderRadius: 14, 
    backgroundColor: '#1e3a8a', 
    alignItems: 'center', 
    justifyContent: 'center',
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4
  },
  scrollContent: { padding: 16, paddingBottom: 40 },
  shiftCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  shiftCardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  shiftName: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  shiftDesc: { fontSize: 12, color: '#64748b', fontWeight: '600', textTransform: 'uppercase' },
  headerActions: { flexDirection: 'row', gap: 12 },
  iconBtn: { padding: 4 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  timeText: { fontSize: 16, fontWeight: '700', color: '#1e3a8a' },
  thresholdGrid: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  thresholdBadge: { 
    flex: 1, 
    padding: 10, 
    borderRadius: 14, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)'
  },
  thresholdVal: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  thresholdLabel: { fontSize: 9, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginBottom: 16 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  inspectorCount: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  assignBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    backgroundColor: '#eff6ff', 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 10 
  },
  assignText: { fontSize: 13, fontWeight: '700', color: '#1e3a8a' },
  emptyContainer: { paddingVertical: 100, alignItems: 'center' },
  emptyText: { marginTop: 16, color: '#94a3b8', fontWeight: '600' },
  emptyBtn: { marginTop: 20, backgroundColor: '#1e3a8a', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { 
    backgroundColor: '#fff', 
    borderTopLeftRadius: 32, 
    borderTopRightRadius: 32, 
    padding: 24, 
    maxHeight: '90%' 
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  formScroll: { marginBottom: 20 },
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#64748b', marginBottom: 8, marginTop: 16 },
  input: { 
    backgroundColor: '#f8fafc', 
    borderWidth: 1, 
    borderColor: '#e2e8f0', 
    borderRadius: 12, 
    padding: 12, 
    fontSize: 15, 
    color: '#0f172a' 
  },
  inputRow: { flexDirection: 'row' },
  sectionHeading: { fontSize: 15, fontWeight: '800', color: '#0f172a', marginTop: 24, marginBottom: 4 },
  thresholdInputRow: { flexDirection: 'row', gap: 12 },
  tInputGroup: { flex: 1 },
  tLabel: { fontSize: 11, fontWeight: '700', color: '#94a3b8', marginBottom: 6 },
  tInput: { 
    backgroundColor: '#f8fafc', 
    borderWidth: 1, 
    borderColor: '#e2e8f0', 
    borderRadius: 12, 
    padding: 10, 
    textAlign: 'center',
    fontWeight: '700'
  },
  submitBtn: { 
    backgroundColor: '#1e3a8a', 
    borderRadius: 16, 
    padding: 18, 
    alignItems: 'center', 
    marginTop: 32,
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6
  },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 1 },
  inspectorItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingVertical: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f1f5f9' 
  },
  inspectorInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '800', color: '#1e3a8a' },
  inspectorName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  inspectorEmail: { fontSize: 12, color: '#64748b' },
  emptyModalText: { textAlign: 'center', padding: 40, color: '#94a3b8', fontWeight: '500' }
});

export default AdminShiftManagementScreen;
