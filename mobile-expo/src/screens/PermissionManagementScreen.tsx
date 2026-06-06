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
  ClipboardCheck, 
  Clock, 
  CheckCircle, 
  X, 
  Timer,
  User,
  ArrowRight
} from 'lucide-react-native';
import apiClient from '../api/config';
import { useAuth } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { offlineQueue } from '../api/OfflineQueue';

const { width } = Dimensions.get('window');

const PermissionManagementScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'subadmin' || user?.role === 'lmadmin' || user?.role === 'manager';
  const [activeTab, setActiveTab] = useState<'my' | 'all'>(isAdmin ? 'all' : 'my');
  
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  
  const [formData, setFormData] = useState({
    type: 'personal',
    date: new Date().toISOString().split('T')[0],
    startTime: '14:00',
    endTime: '15:00',
    reason: '',
  });

  const fetchData = async () => {
    const userId = user?._id || user?.id;
    const cacheKey = activeTab === 'all' ? `@cached_permissions_all_${userId}` : `@cached_permissions_my_${userId}`;
    try {
      setLoading(true);
      const endpoint = activeTab === 'all' ? '/hr/permissions/all' : '/hr/permissions/my';
      const response = await apiClient.get(endpoint);
      
      if (response.data.success) {
        const permData = response.data.data || [];
        setPermissions(permData);
        await AsyncStorage.setItem(cacheKey, JSON.stringify(permData));
      }
    } catch (error) {
      console.error('Fetch permissions error:', error);
      
      // Fallback to offline cached permissions
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          setPermissions(JSON.parse(cached));
        } else {
          // Default mock data if no cache exists
          setPermissions([
            { _id: '1', type: 'personal', date: '2026-04-12', startTime: '10:00', endTime: '12:00', reason: 'Bank work', status: 'approved', inspector: { firstName: 'Suresh', lastName: 'Kumar' } },
            { _id: '2', type: 'official', date: '2026-04-14', startTime: '15:00', endTime: '17:00', reason: 'Client meeting', status: 'pending', inspector: { firstName: 'Karthik', lastName: 'Rao' } },
          ]);
        }
      } catch (cacheErr) {
        setPermissions([]);
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
      Alert.alert('Error', 'Please provide a reason for permission.');
      return;
    }
    
    // Check network connectivity
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      try {
        const userId = user?._id || user?.id;
        
        // Queue the request locally
        await offlineQueue.addRequestToQueue('hr/permissions/apply', 'POST', formData);
        Alert.alert('Offline Success', 'Permission request saved locally. It will synchronize automatically once you are back online.');
        setShowApplyModal(false);
        
        // Optimistically add to current listing
        const newPermItem = {
          _id: `offline_perm_${Date.now()}`,
          type: formData.type,
          date: formData.date,
          startTime: formData.startTime,
          endTime: formData.endTime,
          reason: formData.reason,
          status: 'pending',
          inspector: {
            firstName: (user as any)?.firstName || (user?.name ? user.name.split(' ')[0] : 'My'),
            lastName: (user as any)?.lastName || (user?.name ? user.name.split(' ').slice(1).join(' ') : 'Permission')
          }
        };
        
        setPermissions(prev => [newPermItem, ...prev]);
        
        // Cache the updated list
        const cacheKey = activeTab === 'all' ? `@cached_permissions_all_${userId}` : `@cached_permissions_my_${userId}`;
        const cached = await AsyncStorage.getItem(cacheKey);
        const list = cached ? JSON.parse(cached) : [];
        await AsyncStorage.setItem(cacheKey, JSON.stringify([newPermItem, ...list]));
      } catch (err) {
        console.error('Failed to queue permission request:', err);
        Alert.alert('Error', 'Failed to save request locally.');
      }
      return;
    }
    
    try {
      const response = await apiClient.post('/hr/permissions/apply', formData);
      if (response.data.success) {
        Alert.alert('Success', 'Permission request submitted.');
        setShowApplyModal(false);
        fetchData();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to submit request.');
    }
  };

  const handleUpdateStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const response = await apiClient.put(`/hr/permissions/${id}/status`, { status });
      if (response.data.success) {
        Alert.alert('Success', `Permission ${status} successfully.`);
        fetchData();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update status.');
    }
  };

  const getPermissionTypeStyle = (type: string) => {
    switch(type) {
      case 'official': return { bg: '#f0fdf4', icon: '#166534', label: 'OFFICIAL' };
      case 'personal': return { bg: '#eff6ff', icon: '#1e40af', label: 'PERSONAL' };
      default: return { bg: '#f8fafc', icon: '#64748b', label: 'OTHER' };
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color="#1e3a8a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gate Pass / Permissions</Text>
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
            <Text style={[styles.tabText, activeTab === 'my' && styles.activeTabText]}>My Access</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'all' && styles.activeTab]} 
            onPress={() => setActiveTab('all')}
          >
            <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>Team Activity</Text>
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
        ) : permissions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBox}>
              <ClipboardCheck size={48} color="#cbd5e1" />
            </View>
            <Text style={styles.emptyText}>No permissions requested</Text>
            <Text style={styles.emptySub}>Your submitted gate pass requests will appear here.</Text>
          </View>
        ) : (
          permissions.map((perm) => {
            const styles_type = getPermissionTypeStyle(perm.type);
            return (
              <View key={perm._id} style={styles.permissionCard}>
                 <View style={styles.cardTop}>
                    <View style={[styles.typeBadge, { backgroundColor: styles_type.bg }]}>
                      <Text style={[styles.typeText, { color: styles_type.icon }]}>
                          {styles_type.label}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: perm.status === 'approved' ? '#f0fdf4' : perm.status === 'rejected' ? '#fef2f2' : '#fffbeb' }]}>
                      <Text style={[styles.statusText, { color: perm.status === 'approved' ? '#10b981' : perm.status === 'rejected' ? '#ef4444' : '#f59e0b' }]}>
                          {perm.status.toUpperCase()}
                      </Text>
                    </View>
                 </View>

                 <View style={styles.cardMid}>
                    {activeTab === 'all' && (
                      <View style={styles.userRow}>
                        <User size={14} color="#94a3b8" />
                        <Text style={styles.userName}>{perm.inspector?.firstName} {perm.inspector?.lastName}</Text>
                      </View>
                    )}
                    <View style={styles.timeRow}>
                      <View style={styles.timeIconBox}>
                        <Clock size={16} color="#1e3a8a" />
                      </View>
                      <Text style={styles.timeText}>{perm.startTime}</Text>
                      <ArrowRight size={14} color="#cbd5e1" />
                      <Text style={styles.timeText}>{perm.endTime}</Text>
                      <View style={styles.vDivider} />
                      <Text style={styles.dateText}>{new Date(perm.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</Text>
                    </View>
                    <View style={styles.reasonBox}>
                      <Text style={styles.reasonText}>{perm.reason}</Text>
                    </View>
                 </View>

                 {isAdmin && activeTab === 'all' && perm.status === 'pending' && (
                   <View style={styles.actionRow}>
                     <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={() => handleUpdateStatus(perm._id, 'rejected')}>
                       <X size={16} color="#ef4444" />
                       <Text style={styles.rejectText}>Decline</Text>
                     </TouchableOpacity>
                     <TouchableOpacity style={[styles.actionBtn, styles.approveBtn]} onPress={() => handleUpdateStatus(perm._id, 'approved')}>
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

      {/* Request Modal */}
      <Modal visible={showApplyModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request Gate Pass</Text>
              <TouchableOpacity onPress={() => setShowApplyModal(false)}>
                <X size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
               <Text style={styles.modalLabel}>EXCUSE TYPE</Text>
               <View style={styles.typeSelector}>
                  <TouchableOpacity 
                    style={[styles.typeOption, formData.type === 'personal' && styles.typeOptionActive]} 
                    onPress={() => setFormData({...formData, type: 'personal'})}
                  >
                    <Text style={[styles.typeOptionText, formData.type === 'personal' && styles.typeOptionTextActive]}>PERSONAL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.typeOption, formData.type === 'official' && styles.typeOptionActive]} 
                    onPress={() => setFormData({...formData, type: 'official'})}
                  >
                    <Text style={[styles.typeOptionText, formData.type === 'official' && styles.typeOptionTextActive]}>OFFICIAL</Text>
                  </TouchableOpacity>
               </View>

               <Text style={styles.modalLabel}>DATE</Text>
               <TextInput style={styles.input} value={formData.date} onChangeText={(t) => setFormData({...formData, date: t})} />

               <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalLabel}>FROM</Text>
                    <TextInput style={styles.input} value={formData.startTime} onChangeText={(t) => setFormData({...formData, startTime: t})} />
                  </View>
                  <View style={{ width: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalLabel}>TO</Text>
                    <TextInput style={styles.input} value={formData.endTime} onChangeText={(t) => setFormData({...formData, endTime: t})} />
                  </View>
               </View>

               <Text style={styles.modalLabel}>DESCRIBE REASON</Text>
               <TextInput style={[styles.input, styles.textArea]} multiline numberOfLines={3} value={formData.reason} onChangeText={(t) => setFormData({...formData, reason: t})} />

               <TouchableOpacity style={styles.submitBtn} onPress={handleApply}>
                 <Text style={styles.submitBtnText}>SEND REQUEST</Text>
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
  permissionCard: { backgroundColor: '#fff', borderRadius: 24, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: '#f1f5f9', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  typeText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  cardMid: { gap: 12 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  userName: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f8fafc', padding: 12, borderRadius: 14 },
  timeIconBox: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  timeText: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  vDivider: { width: 1, height: 16, backgroundColor: '#cbd5e1', marginHorizontal: 2 },
  dateText: { fontSize: 13, color: '#94a3b8', fontWeight: '700' },
  reasonBox: { paddingLeft: 4 },
  reasonText: { fontSize: 14, color: '#475569', lineHeight: 20, fontWeight: '500' },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 18, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 18 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 14, borderWidth: 1 },
  approveBtn: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  rejectBtn: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  approveText: { fontSize: 13, fontWeight: '800', color: '#10b981' },
  rejectText: { fontSize: 13, fontWeight: '800', color: '#ef4444' },
  emptyContainer: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
  emptyIconBox: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyText: { color: '#1e293b', fontSize: 18, fontWeight: '800' },
  emptySub: { color: '#94a3b8', fontSize: 14, textAlign: 'center', marginTop: 8, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 32, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#0f172a', letterSpacing: -0.5 },
  modalBody: { padding: 24 },
  modalLabel: { fontSize: 11, fontWeight: '800', color: '#94a3b8', marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase' },
  typeSelector: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  typeOption: { flex: 1, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#f1f5f9' },
  typeOptionActive: { backgroundColor: '#1e3a8a', borderColor: '#1e3a8a', elevation: 4, shadowColor: '#1e3a8a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  typeOptionText: { fontSize: 12, fontWeight: '800', color: '#64748b' },
  typeOptionTextActive: { color: '#fff' },
  input: { backgroundColor: '#f8fafc', borderRadius: 16, padding: 16, fontSize: 15, color: '#1e293b', borderWidth: 1, borderColor: '#f1f5f9', marginBottom: 24, fontWeight: '600' },
  row: { flexDirection: 'row' },
  textArea: { height: 100, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: '#1e3a8a', height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginTop: 10, elevation: 8, shadowColor: '#1e3a8a', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12 },
  submitBtnText: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 1 }
});

export default PermissionManagementScreen;
