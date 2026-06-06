import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  Dimensions,
  Platform,
  StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ChevronLeft, 
  Plus, 
  Calendar, 
  Clock, 
  CheckCircle, 
  X, 
  Info,
  ChevronRight,
  Filter
} from 'lucide-react-native';
import apiClient from '../api/config';
import { useAuth } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { offlineQueue } from '../api/OfflineQueue';

const { width } = Dimensions.get('window');

const LeaveManagementScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'subadmin' || user?.role === 'lmadmin' || user?.role === 'manager';
  const [activeTab, setActiveTab] = useState<'my' | 'all'>(isAdmin ? 'all' : 'my');
  
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  
  const [formData, setFormData] = useState({
    leaveType: 'sick',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    reason: '',
  });

  const fetchData = async () => {
    const userId = user?._id || user?.id;
    const cacheKey = activeTab === 'all' ? `@cached_leaves_all_${userId}` : `@cached_leaves_my_${userId}`;
    try {
      setLoading(true);
      const endpoint = activeTab === 'all' ? '/hr/leaves/all' : '/hr/leaves/my';
      const response = await apiClient.get(endpoint);
      
      if (response.data.success) {
        const leaveData = response.data.data || [];
        setLeaves(leaveData);
        await AsyncStorage.setItem(cacheKey, JSON.stringify(leaveData));
      }
    } catch (error) {
      console.error('Fetch leaves error:', error);
      
      // Fallback to offline cached leaves
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          setLeaves(JSON.parse(cached));
        } else {
          // Default mock data if no cache exists
          setLeaves([
            { _id: '1', leaveType: 'sick', startDate: '2026-04-10', endDate: '2026-04-11', totalDays: 2, reason: 'Flu symptoms', status: 'approved', inspector: { firstName: 'Karthik', lastName: 'Rao' } },
            { _id: '2', leaveType: 'casual', startDate: '2026-04-15', endDate: '2026-04-15', totalDays: 1, reason: 'Family event', status: 'pending', inspector: { firstName: 'Karthik', lastName: 'Rao' } },
          ]);
        }
      } catch (cacheErr) {
        setLeaves([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [activeTab]);

  const handleApply = async () => {
    if (!formData.reason) {
      Alert.alert('Error', 'Please provide a reason for leave.');
      return;
    }
    
    // Check network connectivity
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      try {
        const userId = user?._id || user?.id;
        const timestamp = new Date().toISOString();
        
        // Queue the request locally
        await offlineQueue.addRequestToQueue('hr/leaves/apply', 'POST', formData);
        Alert.alert('Offline Success', 'Leave request saved locally. It will synchronize automatically once you are back online.');
        setShowApplyModal(false);
        
        // Optimistically add to current listing
        const newLeaveItem = {
          _id: `offline_leave_${Date.now()}`,
          leaveType: formData.leaveType,
          startDate: formData.startDate,
          endDate: formData.endDate,
          reason: formData.reason,
          totalDays: Math.round((new Date(formData.endDate).getTime() - new Date(formData.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1,
          status: 'pending',
          inspector: {
            firstName: (user as any)?.firstName || (user?.name ? user.name.split(' ')[0] : 'My'),
            lastName: (user as any)?.lastName || (user?.name ? user.name.split(' ').slice(1).join(' ') : 'Leave')
          }
        };
        
        setLeaves(prev => [newLeaveItem, ...prev]);
        
        // Cache the updated list
        const cacheKey = activeTab === 'all' ? `@cached_leaves_all_${userId}` : `@cached_leaves_my_${userId}`;
        const cached = await AsyncStorage.getItem(cacheKey);
        const list = cached ? JSON.parse(cached) : [];
        await AsyncStorage.setItem(cacheKey, JSON.stringify([newLeaveItem, ...list]));
        
        setFormData({
          leaveType: 'sick',
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
          reason: '',
        });
      } catch (err) {
        console.error('Failed to queue leave request:', err);
        Alert.alert('Error', 'Failed to save request locally.');
      }
      return;
    }
    
    try {
      const response = await apiClient.post('/hr/leaves/apply', formData);
      if (response.data.success) {
        Alert.alert('Success', 'Leave request submitted successfully.');
        setShowApplyModal(false);
        fetchData();
        setFormData({
          leaveType: 'sick',
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
          reason: '',
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to submit leave request.');
    }
  };

  const getStatusBg = (status: string) => {
    switch(status?.toLowerCase()) {
      case 'approved': return '#f0fdf4';
      case 'rejected': return '#fef2f2';
      default: return '#fff7ed';
    }
  };

  const getStatusColor = (status: string) => {
    switch(status?.toLowerCase()) {
      case 'approved': return '#10b981';
      case 'rejected': return '#ef4444';
      default: return '#d97706';
    }
  };

  const handleUpdateStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const response = await apiClient.put(`/hr/leaves/${id}/status`, { status });
      if (response.data.success) {
        Alert.alert('Success', `Leave ${status} successfully.`);
        fetchData();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update status.');
    }
  };

  const getLeaveTypeStyle = (type: string) => {
    switch(type) {
      case 'sick': return { bg: '#fef2f2', icon: '#ef4444' };
      case 'casual': return { bg: '#eff6ff', icon: '#3b82f6' };
      case 'annual': return { bg: '#f0fdf4', icon: '#10b981' };
      default: return { bg: '#f8fafc', icon: '#64748b' };
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color="#1e3a8a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Leave Management</Text>
        {!isAdmin && (
          <TouchableOpacity onPress={() => setShowApplyModal(true)} style={styles.addBtn}>
            <Plus size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {!isAdmin && (
        <View style={styles.tabBar}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'my' && styles.activeTab]} 
            onPress={() => setActiveTab('my')}
          >
            <Text style={[styles.tabText, activeTab === 'my' && styles.activeTabText]}>My History</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'all' && styles.activeTab]} 
            onPress={() => setActiveTab('all')}
          >
            <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>Team History</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {loading && !refreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#1e3a8a" />
          </View>
        ) : leaves.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBox}>
              <Calendar size={48} color="#cbd5e1" />
            </View>
            <Text style={styles.emptyText}>No leave records found</Text>
            <Text style={styles.emptySub}>Your submitted leave requests will appear here.</Text>
          </View>
        ) : (
          leaves.map((leave) => {
            const styles_type = getLeaveTypeStyle(leave.leaveType);
            return (
              <View key={leave._id} style={styles.leaveCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.typeGroup}>
                    <View style={[styles.typeIcon, { backgroundColor: styles_type.bg }]}>
                      <Calendar size={18} color={styles_type.icon} />
                    </View>
                    <View>
                      <Text style={styles.leaveType}>{(leave.leaveType || 'Leave').toUpperCase()}</Text>
                      {activeTab === 'all' && (
                        <Text style={styles.empName}>{leave.inspector?.firstName} {leave.inspector?.lastName}</Text>
                      )}
                    </View>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusBg(leave.status) }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(leave.status) }]}>
                      {(leave.status || 'Pending').toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardDivider} />

                <View style={styles.cardBody}>
                  <View style={styles.infoRow}>
                    <Clock size={14} color="#64748b" />
                    <Text style={styles.infoText}>
                      {new Date(leave.startDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} - {new Date(leave.endDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                    <View style={styles.daysBadge}>
                      <Text style={styles.daysText}>{leave.totalDays} Days</Text>
                    </View>
                  </View>
                  <View style={styles.reasonBox}>
                    <Info size={12} color="#94a3b8" style={{ marginTop: 2 }} />
                    <Text style={styles.reasonText}>{leave.reason}</Text>
                  </View>
                </View>

                {isAdmin && activeTab === 'all' && leave.status === 'pending' && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity 
                      style={[styles.actionBtn, styles.rejectBtn]} 
                      onPress={() => handleUpdateStatus(leave._id, 'rejected')}
                    >
                      <X size={16} color="#ef4444" />
                      <Text style={styles.rejectText}>Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.actionBtn, styles.approveBtn]} 
                      onPress={() => handleUpdateStatus(leave._id, 'approved')}
                    >
                      <CheckCircle size={16} color="#10b981" />
                      <Text style={styles.approveText}>Approve</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Apply Modal */}
      <Modal visible={showApplyModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Apply For Leave</Text>
              <TouchableOpacity onPress={() => setShowApplyModal(false)}>
                <X size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>LEAVE TYPE</Text>
              <View style={styles.pickerContainer}>
                 {['sick', 'casual', 'annual', 'comp-off'].map(type => (
                   <TouchableOpacity 
                     key={type}
                     style={[styles.pickerItem, formData.leaveType === type && styles.pickerItemActive]}
                     onPress={() => setFormData({...formData, leaveType: type})}
                   >
                     <Text style={[styles.pickerText, formData.leaveType === type && styles.pickerTextActive]}>
                       {type.toUpperCase()}
                     </Text>
                   </TouchableOpacity>
                 ))}
              </View>

              <View style={styles.dateRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>START DATE</Text>
                  <TextInput 
                    style={styles.dateInput} 
                    value={formData.startDate} 
                    onChangeText={(t) => setFormData({...formData, startDate: t})}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.inputLabel}>END DATE</Text>
                  <TextInput 
                    style={styles.dateInput} 
                    value={formData.endDate} 
                    onChangeText={(t) => setFormData({...formData, endDate: t})}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>REASON</Text>
              <TextInput 
                style={styles.textArea} 
                multiline 
                numberOfLines={4}
                value={formData.reason}
                onChangeText={(t) => setFormData({...formData, reason: t})}
                placeholder="Brief reason for your leave request..."
              />

              <TouchableOpacity style={styles.submitBtn} onPress={handleApply}>
                <Text style={styles.submitBtnText}>SUBMIT REQUEST</Text>
              </TouchableOpacity>
            </ScrollView>
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16, 
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a', letterSpacing: -0.5 },
  addBtn: { backgroundColor: '#1e3a8a', width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#1e3a8a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tab: { flex: 1, paddingVertical: 16, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#1e3a8a' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#94a3b8' },
  activeTabText: { color: '#1e3a8a', fontWeight: '800' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  loadingBox: { marginTop: 60, alignItems: 'center' },
  leaveCard: { backgroundColor: '#fff', borderRadius: 24, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  typeGroup: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  typeIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  leaveType: { fontSize: 13, fontWeight: '800', color: '#1e293b', letterSpacing: 0.3 },
  empName: { fontSize: 11, color: '#64748b', fontWeight: '700', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  cardDivider: { height: 1, backgroundColor: '#f8fafc', marginVertical: 4 },
  cardBody: { gap: 10, marginTop: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 12, color: '#64748b', fontWeight: '700' },
  daysBadge: { backgroundColor: '#eff6ff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  daysText: { fontSize: 10, color: '#1e40af', fontWeight: '900' },
  reasonBox: { flexDirection: 'row', gap: 8, backgroundColor: '#f8fafc', padding: 12, borderRadius: 12 },
  reasonText: { fontSize: 13, color: '#475569', lineHeight: 18, flex: 1, fontWeight: '500' },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 16 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: 14, borderWidth: 1 },
  approveBtn: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  rejectBtn: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  approveText: { fontSize: 13, fontWeight: '800', color: '#10b981' },
  rejectText: { fontSize: 13, fontWeight: '800', color: '#ef4444' },
  emptyContainer: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
  emptyIconBox: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyText: { color: '#1e293b', fontSize: 18, fontWeight: '800' },
  emptySub: { color: '#94a3b8', fontSize: 14, textAlign: 'center', marginTop: 8, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 36, borderTopRightRadius: 36, paddingBottom: 40, maxHeight: '90%', shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.1, shadowRadius: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#0f172a', letterSpacing: -0.5 },
  modalBody: { padding: 24 },
  inputLabel: { fontSize: 11, fontWeight: '800', color: '#94a3b8', marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase' },
  pickerContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  pickerItem: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  pickerItemActive: { backgroundColor: '#1e3a8a', borderColor: '#1e3a8a', elevation: 4, shadowColor: '#1e3a8a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  pickerText: { fontSize: 12, fontWeight: '800', color: '#64748b' },
  pickerTextActive: { color: '#fff' },
  dateRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  dateInput: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 16, padding: 16, fontSize: 15, color: '#1e293b', borderWidth: 1, borderColor: '#f1f5f9', fontWeight: '600' },
  textArea: { backgroundColor: '#f8fafc', borderRadius: 16, padding: 16, fontSize: 15, color: '#1e293b', borderWidth: 1, borderColor: '#f1f5f9', height: 120, textAlignVertical: 'top', marginBottom: 30, fontWeight: '500' },
  submitBtn: { backgroundColor: '#1e3a8a', height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#1e3a8a', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12 },
  submitBtnText: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 1 }
});

export default LeaveManagementScreen;
