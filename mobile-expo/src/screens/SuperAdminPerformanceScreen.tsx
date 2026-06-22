import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { 
  Users, 
  FileText, 
  Activity, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  TrendingUp,
  BarChart3,
  Calendar,
} from 'lucide-react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import apiClient from '../api/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const { width } = Dimensions.get('window');

const SuperAdminPerformanceScreen = () => {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<any>({
    currentPage: 1,
    totalPages: 1,
    totalUsers: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });
  
  const [totalStats, setTotalStats] = useState({
    totalUsers: 0,
    totalFormsSubmitted: 0,
    activeUsers: 0,
    totalActiveHours: 0,
  });

  const fetchData = async (page = 1, search = '') => {
    const cacheKey = `@cached_superadmin_performance_p${page}_s_${search || 'all'}`;
    try {
      setLoading(true);
      
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const data = JSON.parse(cached);
          setUsers(data.users || []);
          setPagination(data.pagination || {});
          setTotalStats(data.totalStats || {
            totalUsers: 0,
            totalFormsSubmitted: 0,
            activeUsers: 0,
            totalActiveHours: 0,
          });
        }
        return;
      }

      const response = await apiClient.get('/users/all-tenants-performance', {
        params: {
          page,
          limit: 10,
          search,
        }
      });

      if (response.data.success) {
        const data = response.data.data;
        const usersList = data.users || [];
        const pag = data.pagination || {};
        
        // Calculate summary stats from the current page/batch
        const forms = usersList.reduce((sum: number, u: any) => sum + (u.metrics?.formsSubmitted || 0), 0);
        const active = usersList.filter((u: any) => {
          if (!u.metrics?.lastActive) return false;
          const lastActiveDate = new Date(u.metrics.lastActive);
          return (Date.now() - lastActiveDate.getTime()) < 24 * 60 * 60 * 1000;
        }).length;
        
        const calculatedStats = {
          totalUsers: pag.totalUsers || 0,
          totalFormsSubmitted: forms,
          activeUsers: active,
          totalActiveHours: usersList.reduce((sum: number, u: any) => sum + (u.metrics?.activeHours || 0), 0),
        };

        setUsers(usersList);
        setPagination(pag);
        setTotalStats(calculatedStats);

        // Cache the combined dataset
        await AsyncStorage.setItem(cacheKey, JSON.stringify({
          users: usersList,
          pagination: pag,
          totalStats: calculatedStats
        }));
      }
    } catch (error) {
      console.error('Fetch superadmin performance error:', error);
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const data = JSON.parse(cached);
          setUsers(data.users || []);
          setPagination(data.pagination || {});
          setTotalStats(data.totalStats || {
            totalUsers: 0,
            totalFormsSubmitted: 0,
            activeUsers: 0,
            totalActiveHours: 0,
          });
        }
      } catch (cacheErr) {}
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData(currentPage, searchTerm);
    }, [currentPage, searchTerm])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(1, searchTerm);
  }, [searchTerm]);

  const handleSearch = (text: string) => {
    setSearchTerm(text);
    setCurrentPage(1); // Reset to first page on search
  };

  const formatActiveHours = (hours: number) => {
    const hrs = Math.floor(hours);
    const mins = Math.round((hours - hrs) * 60);
    if (hrs === 0) return `${mins}m`;
    if (mins === 0) return `${hrs}h`;
    return `${hrs}h ${mins}m`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft size={24} color="#1e293b" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>SuperAdmin Dashboard</Text>
          <Text style={styles.headerSubtitle}>Cross-Tenant Performance Pulse</Text>
        </View>
      </View>

      <ScrollView 
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: '#eff6ff' }]}>
            <Users size={20} color="#2563eb" />
            <Text style={styles.statValue}>{totalStats.totalUsers}</Text>
            <Text style={styles.statLabel}>Total Admins</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#f0fdf4' }]}>
            <FileText size={20} color="#16a34a" />
            <Text style={styles.statValue}>{totalStats.totalFormsSubmitted}</Text>
            <Text style={styles.statLabel}>Forms Today</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#f5f3ff' }]}>
            <Activity size={20} color="#7c3aed" />
            <Text style={styles.statValue}>{totalStats.activeUsers}</Text>
            <Text style={styles.statLabel}>Live Now</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Search size={18} color="#94a3b8" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, email or tenant..."
            value={searchTerm}
            onChangeText={handleSearch}
            placeholderTextColor="#94a3b8"
          />
        </View>

        {loading && !refreshing ? (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loadingText}>Loading performance data...</Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {users.map((item, index) => (
              <TouchableOpacity key={item.userId} style={styles.userCard}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.userName}>{item.firstName} {item.lastName}</Text>
                    <Text style={styles.userRole}>{item.role.toUpperCase()}</Text>
                  </View>
                  <View style={styles.tenantBadge}>
                    <Text style={styles.tenantText}>{item.tenantName}</Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.cardMetrics}>
                  <View style={styles.metricItem}>
                    <TrendingUp size={16} color="#2563eb" />
                    <View style={styles.metricTextContainer}>
                      <Text style={styles.metricValue}>{item.metrics?.personallySubmitted || 0}</Text>
                      <Text style={styles.metricLabel}>Submissions</Text>
                    </View>
                  </View>
                  <View style={styles.metricItem}>
                    <BarChart3 size={16} color="#f59e0b" />
                    <View style={styles.metricTextContainer}>
                      <Text style={styles.metricValue}>{formatActiveHours(item.metrics?.activeHours || 0)}</Text>
                      <Text style={styles.metricLabel}>Active Time</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <Calendar size={12} color="#94a3b8" />
                  <Text style={styles.lastActiveText}>
                    Last Active: {item.metrics?.lastLogin ? new Date(item.metrics.lastLogin).toLocaleString() : 'Never'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <View style={styles.pagination}>
                <TouchableOpacity 
                  onPress={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={!pagination.hasPrevPage}
                  style={[styles.pageButton, !pagination.hasPrevPage && styles.disabledButton]}
                >
                  <ChevronLeft size={20} color={pagination.hasPrevPage ? "#1e293b" : "#94a3b8"} />
                </TouchableOpacity>
                <Text style={styles.pageText}>Page {pagination.currentPage} of {pagination.totalPages}</Text>
                <TouchableOpacity 
                  onPress={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
                  disabled={!pagination.hasNextPage}
                  style={[styles.pageButton, !pagination.hasNextPage && styles.disabledButton]}
                >
                  <ChevronRight size={20} color={pagination.hasNextPage ? "#1e293b" : "#94a3b8"} />
                </TouchableOpacity>
              </View>
            )}

            {users.length === 0 && (
              <View style={styles.emptyContainer}>
                <Users size={48} color="#cbd5e1" />
                <Text style={styles.emptyText}>No users found matching your search.</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backButton: {
    marginRight: 15,
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 20,
    gap: 10,
  },
  statCard: {
    flex: 1,
    padding: 15,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.02)',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 20,
    paddingHorizontal: 15,
    borderRadius: 12,
    height: 50,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '500',
  },
  loadingWrapper: {
    marginTop: 100,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748b',
    fontSize: 14,
  },
  listContainer: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  userRole: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2563eb',
    marginTop: 2,
    backgroundColor: '#eff6ff',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tenantBadge: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tenantText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 12,
  },
  cardMetrics: {
    flexDirection: 'row',
    gap: 20,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricTextContainer: {
    marginLeft: 8,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  metricLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 8,
  },
  lastActiveText: {
    fontSize: 10,
    color: '#94a3b8',
    marginLeft: 6,
    fontWeight: '500',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    paddingBottom: 20,
  },
  pageButton: {
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  disabledButton: {
    opacity: 0.5,
  },
  pageText: {
    marginHorizontal: 20,
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    marginTop: 16,
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
  }
});

export default SuperAdminPerformanceScreen;
