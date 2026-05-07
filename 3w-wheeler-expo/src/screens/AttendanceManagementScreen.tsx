import React, { useState, useCallback, useEffect } from 'react';
import { io } from 'socket.io-client';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Platform,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  Search, 
  User, 
  Filter,
  ArrowBigRightDash,
  LayoutGrid,
  List,
  Clock,
  CalendarCheck,
  TrendingUp,
  History,
  Users
} from 'lucide-react-native';
import apiClient from '../api/config';

import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');

const AttendanceManagementScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'subadmin' || user?.role === 'lmadmin' || user?.role === 'manager';
  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [inspectorPerformance, setInspectorPerformance] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      // Format dates for API query
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      
      const [attendanceRes, statsRes, perfRes] = await Promise.all([
        apiClient.get('/attendance', {
          params: {
            startDate: startOfMonth.toISOString(),
            endDate: endOfMonth.toISOString()
          }
        }),
        apiClient.get('/hr/attendance/summary'),
        apiClient.get('/analytics/inspectors/performance', {
          params: {
            startDate: startOfMonth.toISOString(),
            endDate: endOfMonth.toISOString()
          }
        })
      ]);

      if (attendanceRes.data.success) {
        setLogs(attendanceRes.data.logs || attendanceRes.data.data?.detailedLogs || []);
      }

      if (statsRes.data.success) {
        console.log('📊 HR Stats Received:', statsRes.data.data);
        setStats(statsRes.data.data);
      }

      if (perfRes.data.success) {
        setInspectorPerformance(perfRes.data.data);
      }
    } catch (error) {
      console.error('Fetch Analytics Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentDate]);

  useEffect(() => {
    fetchLogs();

    // Socket real-time integration
    const SOCKET_URL = apiClient.defaults.baseURL?.replace('/api', '') || '';
    const socket = io(SOCKET_URL);

    socket.on('connect', () => {
      console.log('✅ HRMS connected to socket');
      socket.emit('join-dashboard-analytics'); 
      if (user?.tenantId) {
        socket.emit('join-group-chat', user.tenantId);
      }
    });

    socket.on('hr-update', () => {
      console.log('🔔 HR Update received, refreshing logs');
      fetchLogs();
    });

    socket.on('response-created', () => fetchLogs());
    socket.on('response-updated', () => fetchLogs());
    socket.on('response-deleted', () => fetchLogs());

    return () => {
      socket.disconnect();
    };
  }, [fetchLogs]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLogs();
  }, [fetchLogs]);

  const changeMonth = (offset: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + offset);
    setCurrentDate(newDate);
  };

  const filteredLogs = logs.filter(log => {
    const fullName = `${log.inspector?.firstName || ''} ${log.inspector?.lastName || ''}`.toLowerCase();
    const role = (log.inspector?.role || '').toLowerCase();

    const query = searchQuery.toLowerCase();
    return fullName.includes(query) || role.includes(query);
  });

  const filteredPerformance = inspectorPerformance.filter(p => {
    const query = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(query) || p.username?.toLowerCase().includes(query);
  });

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'present': return '#22c55e';
      case 'late': return '#f59e0b';
      case 'half-day': return '#ef4444';
      default: return '#94a3b8';
    }
  };

  const renderPerformanceItem = (item: any) => (
    <View key={item.id} style={styles.perfCard}>
      <View style={styles.perfHeader}>
        <View style={styles.perfUserBox}>
          <View style={styles.perfAvatar}>
             <Text style={styles.perfAvatarText}>
               {(item.name || 'User').split(' ').filter(Boolean).map((n:any) => n[0]).join('').toUpperCase()}
             </Text>

          </View>
          <View>
            <Text style={styles.perfName}>{item.name}</Text>
            <Text style={styles.perfEmail}>{item.email || item.username}</Text>
          </View>
        </View>
        <View style={styles.perfTotalBox}>
          <Text style={styles.perfTotalVal}>{item.totalForms}</Text>
          <Text style={styles.perfTotalLab}>FORMS</Text>
        </View>
      </View>

      <View style={styles.perfStatsRow}>
        <View style={[styles.perfStat, { borderLeftColor: '#22c55e' }]}>
          <Text style={styles.perfStatVal}>{item.accepted}</Text>
          <Text style={styles.perfStatLab}>ACCEPTED</Text>
        </View>
        <View style={[styles.perfStat, { borderLeftColor: '#ef4444' }]}>
          <Text style={styles.perfStatVal}>{item.rejected}</Text>
          <Text style={styles.perfStatLab}>REJECTED</Text>
        </View>
        <View style={[styles.perfStat, { borderLeftColor: '#f59e0b' }]}>
          <Text style={styles.perfStatVal}>{item.rework}</Text>
          <Text style={styles.perfStatLab}>REWORK</Text>
        </View>
      </View>
    </View>
  );

  const renderAttendanceItem = (log: any, idx: number) => {
    const inspectorName = `${log.inspector?.firstName || 'Unknown'} ${log.inspector?.lastName || ''}`;
    const dateStr = new Date(log.date).toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
    const dayName = new Date(log.date).toLocaleDateString('en-US', { weekday: 'short' });

    return (
      <View key={log._id || idx} style={styles.logCard}>
        <View style={styles.logDateColumn}>
          <Text style={styles.dayText}>{dayName}</Text>
          <Text style={styles.dateText}>{dateStr}</Text>
        </View>
        <View style={styles.logInfoColumn}>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{inspectorName}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(log.status) + '15' }]}>
               <Text style={[styles.statusBadgeText, { color: getStatusColor(log.status) }]}>{log.status?.toUpperCase() || 'P'}</Text>
            </View>
          </View>
          <Text style={styles.userRole}>{log.inspector?.role || 'Inspector'}</Text>
          
          <View style={styles.timeRow}>
            <View style={styles.timeBlock}>
              <Text style={styles.timeLabel}>LOGIN</Text>
              <Text style={styles.timeValue}>
                {log.checkInTime ? new Date(log.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
              </Text>
            </View>
            <ArrowBigRightDash size={16} color="#cbd5e1" />
            <View style={styles.timeBlock}>
              <Text style={styles.timeLabel}>LOGOUT</Text>
              <Text style={styles.timeValue}>
                {log.checkOutTime ? new Date(log.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
              </Text>
            </View>
            <View style={styles.vDivider} />
            <View style={[styles.timeBlock, { alignItems: 'flex-end' }]}>
              <Text style={styles.timeLabel}>TOTAL</Text>
              <Text style={[styles.timeValue, { color: '#0f172a' }]}>{log.workingHours ? `${Math.floor(log.workingHours)}h ${Math.round((log.workingHours % 1) * 60)}m` : '0h'}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color="#1e3a8a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>HR Analytics & Reports</Text>
      </View>

      <View style={styles.filterSection}>
        <View style={styles.monthSelector}>
          <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.monthArrow}>
            <ChevronLeft size={20} color="#64748b" />
          </TouchableOpacity>
          <View style={styles.monthDisplay}>
            <Calendar size={16} color="#1e3a8a" style={{ marginRight: 8 }} />
            <Text style={styles.monthText}>
              {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Text>
          </View>
          <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthArrow}>
            <ChevronRight size={20} color="#64748b" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchBar}>
          <Search size={18} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search inspector or status..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#94a3b8"
          />
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Attendance Pulse - New Section (Live & Sync) */}
        {(isAdmin && stats) && (
          <View style={[styles.pulseContainer, { borderColor: '#e2e8f0', backgroundColor: '#f8fafc' }]}>
            <View style={styles.pulseHeader}>
              <View style={styles.pulseTitleRow}>
                <TrendingUp size={16} color="#4f46e5" />
                <Text style={[styles.pulseTitle, { color: '#4f46e5' }]}>ATTENDANCE PULSE</Text>
              </View>
              <View style={[styles.liveBadge, { backgroundColor: '#eff6ff', borderColor: '#dbeafe' }]}>
                <View style={[styles.liveDot, { backgroundColor: '#3b82f6' }]} />
                <Text style={[styles.liveText, { color: '#2563eb' }]}>LIVE</Text>
              </View>
            </View>

            <View style={styles.pulseGrid}>
              <View style={styles.pulseRow}>
                <View style={styles.pulseItem}>
                  <View style={styles.pulseIconBg}>
                    <Users size={18} color="#6366f1" />
                  </View>
                  <Text style={styles.pulseValue}>{stats.totalStaff || 0}</Text>
                  <Text style={styles.pulseLabel}>Total Staff</Text>
                </View>
                <View style={styles.pulseDivider} />
                <View style={styles.pulseItem}>
                  <View style={[styles.pulseIconBg, { backgroundColor: '#f0fdf4' }]}>
                    <Clock size={18} color="#22c55e" />
                  </View>
                  <Text style={[styles.pulseValue, { color: '#22c55e' }]}>{stats.clockInToday || 0}</Text>
                  <Text style={styles.pulseLabel}>Clock In Today</Text>
                </View>
              </View>
              <View style={[styles.pulseRow, { marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#e2e8f0' }]}>
                <View style={styles.pulseItem}>
                  <View style={[styles.pulseIconBg, { backgroundColor: '#fff7ed' }]}>
                    <History size={18} color="#f59e0b" />
                  </View>
                  <Text style={[styles.pulseValue, { color: '#f59e0b' }]}>{stats.postShift || 0}</Text>
                  <Text style={styles.pulseLabel}>Post Shift</Text>
                </View>
                <View style={styles.pulseDivider} />
                <View style={styles.pulseItem}>
                  <View style={[styles.pulseIconBg, { backgroundColor: '#fef2f2' }]}>
                    <CalendarCheck size={18} color="#ef4444" />
                  </View>
                  <Text style={[styles.pulseValue, { color: '#ef4444' }]}>{stats.approvedLeave || 0}</Text>
                  <Text style={styles.pulseLabel}>Approved Leave</Text>
                </View>
              </View>
            </View>
          </View>
        )}


        <View style={styles.sectionHeader}>
           <Text style={styles.sectionTitle}>Inspector Performance</Text>
           <Text style={styles.sectionSubtitle}>Work quality & throughput</Text>
        </View>

        {loading && !refreshing ? (
          <View style={styles.centered}>
            <ActivityIndicator size="small" color="#1e3a8a" />
          </View>
        ) : filteredPerformance.length > 0 ? (
          filteredPerformance.map(item => renderPerformanceItem(item))
        ) : (
          <Text style={styles.noDataSmall}>No performance data available</Text>
        )}

        <View style={[styles.sectionHeader, { marginTop: 24 }]}>
           <Text style={styles.sectionTitle}>Attendance Logs</Text>
           <Text style={styles.sectionSubtitle}>Daily activity stream</Text>
        </View>

        {loading && !refreshing ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#1e3a8a" />
            <Text style={styles.loadingText}>Loading records...</Text>
          </View>
        ) : filteredLogs.length > 0 ? (
          filteredLogs.map((log, idx) => renderAttendanceItem(log, idx))
        ) : (
          <View style={styles.emptyContainer}>
            <Calendar size={64} color="#f1f5f9" />
            <Text style={styles.emptyText}>No attendance records found for this period</Text>
          </View>
        )}
      </ScrollView>


      {/* Footer Summary / Export (Simulation) */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.exportBtn} onPress={() => Alert.alert('Export', 'Sending attendance report to your email.')}>
          <Text style={styles.exportText}>EXPORT MONTHLY REPORT</Text>
        </TouchableOpacity>
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
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    flex: 1,
  },
  filterSection: {
    backgroundColor: '#fff',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
  },
  monthArrow: {
    padding: 8,
  },
  monthDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    paddingLeft: 10,
    fontSize: 14,
    color: '#1e293b',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  logCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  logDateColumn: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#f1f5f9',
    marginRight: 16,
  },
  dayText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e3a8a',
    marginTop: 2,
  },
  logInfoColumn: {
    flex: 1,
  },
  userInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '900',
  },
  userRole: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 12,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 12,
  },
  timeBlock: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#94a3b8',
    marginBottom: 2,
  },
  timeValue: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
  },
  vDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#e2e8f0',
  },
  centered: {
    paddingVertical: 100,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  emptyContainer: {
    paddingVertical: 100,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 16,
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  exportBtn: {
    backgroundColor: '#1e3a8a',
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  exportText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  summaryCard: {
    width: (width - 32 - 12) / 2 - 1, // 2 columns with gap
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    position: 'relative',
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  summaryLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
  },
  summaryIndicator: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 4,
  },
  sectionHeader: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  sectionSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: 2,
  },
  perfCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    elevation: 2,
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
  perfHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  perfUserBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  perfAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  perfAvatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e3a8a',
  },
  perfName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  perfEmail: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  perfTotalBox: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  perfTotalVal: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1e3a8a',
  },
  perfTotalLab: {
    fontSize: 8,
    fontWeight: '800',
    color: '#94a3b8',
  },
  perfStatsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  perfStat: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
  },
  perfStatVal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  perfStatLab: {
    fontSize: 8,
    fontWeight: '800',
    color: '#94a3b8',
    marginTop: 2,
  },
  noDataSmall: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 20,
    fontStyle: 'italic',
  },
  pulseContainer: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
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
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 5,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  liveText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#059669',
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
  }
});


export default AttendanceManagementScreen;
