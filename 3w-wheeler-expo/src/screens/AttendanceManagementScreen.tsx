import React, { useState, useCallback, useEffect } from 'react';
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
  Platform
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
  List
} from 'lucide-react-native';
import apiClient from '../api/config';

const { width } = Dimensions.get('window');

const AttendanceManagementScreen = ({ navigation }: any) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      // Format dates for API query
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      
      const response = await apiClient.get('/attendance', {
        params: {
          startDate: startOfMonth.toISOString(),
          endDate: endOfMonth.toISOString()
        }
      });

      if (response.data.success) {
        setLogs(response.data.logs || []);
      }
    } catch (error) {
      console.error('Fetch Attendance Logs Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentDate]);

  useEffect(() => {
    fetchLogs();
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

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'present': return '#22c55e';
      case 'late': return '#f59e0b';
      case 'half-day': return '#ef4444';
      default: return '#94a3b8';
    }
  };

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
        <Text style={styles.headerTitle}>Attendance Management</Text>
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
            placeholder="Search user or role..."
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
  }
});

export default AttendanceManagementScreen;
