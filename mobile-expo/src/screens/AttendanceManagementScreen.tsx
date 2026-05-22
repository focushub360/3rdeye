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
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

const AttendanceManagementScreen = ({ navigation }: any) => {
  const { colors, isDark } = useTheme();
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
      // Format dates for API query in local timezone to match backend parser
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      const formatDateLocal = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      };

      const startStr = formatDateLocal(startOfMonth);
      const endStr = formatDateLocal(endOfMonth);
      
      // Fetch each endpoint independently to ensure robust error isolation
      try {
        const attendanceRes = await apiClient.get('/attendance', {
          params: {
            startDate: startStr,
            endDate: endStr
          }
        });
        if (attendanceRes.data.success) {
          setLogs(attendanceRes.data.logs || attendanceRes.data.data?.detailedLogs || []);
        }
      } catch (err) {
        console.error('HRMS error fetching logs:', err);
      }

      try {
        const statsRes = await apiClient.get('/hr/attendance/summary');
        if (statsRes.data.success) {
          console.log('📊 HR Stats Received:', statsRes.data.data);
          setStats(statsRes.data.data);
        }
      } catch (err) {
        console.error('HRMS error fetching stats summary:', err);
      }

      try {
        const perfRes = await apiClient.get('/analytics/performance-table', {
          params: {
            startDate: startStr,
            endDate: endStr
          }
        });
        if (perfRes.data.success) {
          setInspectorPerformance(perfRes.data.data);
        }
      } catch (err) {
        console.error('HRMS error fetching performance table:', err);
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

  const renderPerformanceItem = (item: any, idx: number) => (
    <View key={item.username || item.name || idx} style={[styles.perfCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.perfHeader, { borderBottomColor: colors.border }]}>
        <View style={styles.perfUserBox}>
          <View style={[styles.perfAvatar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
             <Text style={[styles.perfAvatarText, { color: colors.accent }]}>
               {(item.name || 'User').split(' ').filter(Boolean).map((n:any) => n[0]).join('').toUpperCase()}
             </Text>

          </View>
          <View>
            <Text style={[styles.perfName, { color: colors.text }]}>{item.name}</Text>
            <Text style={[styles.perfEmail, { color: colors.subtext }]}>{item.email || item.username}</Text>
          </View>
        </View>
        <View style={[styles.perfTotalBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.perfTotalVal, { color: colors.accent }]}>{item.totalForms}</Text>
          <Text style={[styles.perfTotalLab, { color: colors.subtext }]}>FORMS</Text>
        </View>
      </View>

      <View style={styles.perfStatsRow}>
        <View style={[styles.perfStat, { backgroundColor: colors.surface, borderLeftColor: '#22c55e' }]}>
          <Text style={[styles.perfStatVal, { color: colors.text }]}>{item.accepted}</Text>
          <Text style={[styles.perfStatLab, { color: colors.subtext }]}>ACCEPTED</Text>
        </View>
        <View style={[styles.perfStat, { backgroundColor: colors.surface, borderLeftColor: '#ef4444' }]}>
          <Text style={[styles.perfStatVal, { color: colors.text }]}>{item.rejected}</Text>
          <Text style={[styles.perfStatLab, { color: colors.subtext }]}>REJECTED</Text>
        </View>
        <View style={[styles.perfStat, { backgroundColor: colors.surface, borderLeftColor: '#f59e0b' }]}>
          <Text style={[styles.perfStatVal, { color: colors.text }]}>{item.rework}</Text>
          <Text style={[styles.perfStatLab, { color: colors.subtext }]}>REWORK</Text>
        </View>
      </View>
    </View>
  );

  const renderAttendanceItem = (log: any, idx: number) => {
    const inspectorName = `${log.inspector?.firstName || 'Unknown'} ${log.inspector?.lastName || ''}`;
    const dateStr = new Date(log.date).toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
    const dayName = new Date(log.date).toLocaleDateString('en-US', { weekday: 'short' });

    return (
      <View key={log._id || idx} style={[styles.logCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.logDateColumn, { borderRightColor: colors.border }]}>
          <Text style={[styles.dayText, { color: colors.subtext }]}>{dayName}</Text>
          <Text style={[styles.dateText, { color: colors.accent }]}>{dateStr}</Text>
        </View>
        <View style={styles.logInfoColumn}>
          <View style={styles.userInfo}>
            <Text style={[styles.userName, { color: colors.text }]}>{inspectorName}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(log.status) + '15' }]}>
               <Text style={[styles.statusBadgeText, { color: getStatusColor(log.status) }]}>{log.status?.toUpperCase() || 'P'}</Text>
            </View>
          </View>
          <Text style={[styles.userRole, { color: colors.subtext }]}>{log.inspector?.role || 'Inspector'}</Text>
          
          <View style={[styles.timeRow, { backgroundColor: colors.surface }]}>
            <View style={styles.timeBlock}>
              <Text style={[styles.timeLabel, { color: colors.subtext }]}>LOGIN</Text>
              <Text style={[styles.timeValue, { color: colors.text }]}>
                {log.checkInTime ? new Date(log.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
              </Text>
            </View>
            <ArrowBigRightDash size={16} color={colors.subtext} />
            <View style={styles.timeBlock}>
              <Text style={[styles.timeLabel, { color: colors.subtext }]}>LOGOUT</Text>
              <Text style={[styles.timeValue, { color: colors.text }]}>
                {log.checkOutTime ? new Date(log.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
              </Text>
            </View>
            <View style={[styles.vDivider, { backgroundColor: colors.border }]} />
            <View style={[styles.timeBlock, { alignItems: 'flex-end' }]}>
              <Text style={[styles.timeLabel, { color: colors.subtext }]}>TOTAL</Text>
              <Text style={[styles.timeValue, { color: colors.text }]}>{log.workingHours ? `${Math.floor(log.workingHours)}h ${Math.round((log.workingHours % 1) * 60)}m` : '0h'}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.accent} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>HR Analytics & Reports</Text>
      </View>

      <View style={[styles.filterSection, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={[styles.monthSelector, { backgroundColor: colors.surface }]}>
          <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.monthArrow}>
            <ChevronLeft size={20} color={colors.subtext} />
          </TouchableOpacity>
          <View style={styles.monthDisplay}>
            <Calendar size={16} color={colors.accent} style={{ marginRight: 8 }} />
            <Text style={[styles.monthText, { color: colors.text }]}>
              {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Text>
          </View>
          <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthArrow}>
            <ChevronRight size={20} color={colors.subtext} />
          </TouchableOpacity>
        </View>

        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Search size={18} color={colors.subtext} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search inspector or status..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={colors.subtext}
          />
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionHeader}>
           <Text style={[styles.sectionTitle, { color: colors.text }]}>Inspector Performance</Text>
           <Text style={[styles.sectionSubtitle, { color: colors.subtext }]}>Work quality & throughput</Text>
        </View>

        {loading && !refreshing ? (
          <View style={styles.centered}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        ) : filteredPerformance.length > 0 ? (
          filteredPerformance.map((item, idx) => renderPerformanceItem(item, idx))
        ) : (
          <Text style={[styles.noDataSmall, { color: colors.subtext }]}>No performance data available</Text>
        )}

        <View style={[styles.sectionHeader, { marginTop: 24 }]}>
           <Text style={[styles.sectionTitle, { color: colors.text }]}>Attendance Logs</Text>
           <Text style={[styles.sectionSubtitle, { color: colors.subtext }]}>Daily activity stream</Text>
        </View>

        {loading && !refreshing ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.loadingText, { color: colors.subtext }]}>Loading records...</Text>
          </View>
        ) : filteredLogs.length > 0 ? (
          filteredLogs.map((log, idx) => renderAttendanceItem(log, idx))
        ) : (
          <View style={styles.emptyContainer}>
            <Calendar size={64} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.subtext }]}>No attendance records found for this period</Text>
          </View>
        )}
      </ScrollView>


      {/* Footer Summary / Export (Simulation) */}
      <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TouchableOpacity style={[styles.exportBtn, { backgroundColor: colors.accent, shadowColor: colors.accent }]} onPress={() => Alert.alert('Export', 'Sending attendance report to your email.')}>
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
