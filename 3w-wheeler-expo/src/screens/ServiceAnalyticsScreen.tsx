import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Dimensions,
  Alert,
  Platform,
} from 'react-native';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/config';
import { 
  BarChart3, 
  FileText, 
  Users, 
  Globe, 
  TrendingUp, 
  Clock,
  ChevronRight,
  LogOut,
  RefreshCw,
  Camera,
  Share2
} from 'lucide-react-native';

const { width } = Dimensions.get('window');

const StatCard = ({ title, value, icon: Icon, color }: any) => (
  <View style={[styles.card, { borderLeftColor: color, borderLeftWidth: 4 }]}>
    <View style={styles.cardHeader}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Icon size={20} color={color} />
    </View>
    <Text style={styles.cardValue}>{value}</Text>
  </View>
);

const ServiceAnalyticsScreen = () => {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const viewShotRef = useRef<any>(null);

  const fetchStats = async () => {
    try {
      const response = await apiClient.get('/analytics/dashboard');
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('Fetch stats error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchStats();
  }, []);

  const handleCaptureAndShare = async () => {
    try {
      setIsCapturing(true);
      // Small delay to ensure UI is ready or to show feedback
      setTimeout(async () => {
        const uri = await captureRef(viewShotRef, {
          format: 'jpg',
          quality: 0.9,
          result: 'tmpfile',
        });

        const isSharingAvailable = await Sharing.isAvailableAsync();
        if (isSharingAvailable) {
          await Sharing.shareAsync(uri);
        } else {
          Alert.alert('Error', 'Sharing is not available on this device');
        }
        setIsCapturing(false);
      }, 100);
    } catch (err) {
      console.error('Capture error:', err);
      Alert.alert('Error', 'Failed to capture screenshot');
      setIsCapturing(false);
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading Analytics...</Text>
      </View>
    );
  }

  // Handle Error State
  if (!stats && !loading) {
     return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <TrendingUp size={48} color="#ef4444" />
          <Text style={styles.errorText}>Unable to load dashboard data</Text>
          <Text style={styles.errorSub}>Please check your network connection and server status</Text>
          <TouchableOpacity onPress={onRefresh} style={styles.retryBtn}>
            <RefreshCw size={20} color="#fff" />
            <Text style={styles.retryText}>Retry Connection</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const { overview = {}, statusDistribution = {}, recentActivity = {} } = stats || {};

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greet}>Analytics Dashboard</Text>
          <Text style={styles.userRole}>{user?.role?.toUpperCase()} • {user?.name || user?.email}</Text>
        </View>
        <View style={styles.headerActions}>
           <TouchableOpacity onPress={handleCaptureAndShare} style={[styles.iconBtn, styles.captureBtn]} disabled={isCapturing}>
            {isCapturing ? <ActivityIndicator size="small" color="#3b82f6" /> : <Camera size={20} color="#3b82f6" />}
          </TouchableOpacity>
           <TouchableOpacity onPress={onRefresh} style={styles.iconBtn}>
            <RefreshCw size={20} color="#64748b" />
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} style={[styles.iconBtn, styles.logoutBtn]}>
            <LogOut size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>

      <ViewShot ref={viewShotRef} style={{ flex: 1, backgroundColor: '#f1f5f9' }}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3b82f6']} />}
        >
          <View style={styles.statsGrid}>
            <StatCard 
              title="Total Forms" 
              value={overview.totalForms || 0} 
              icon={FileText} 
              color="#3b82f6" 
            />
            <StatCard 
              title="Total Responses" 
              value={overview.totalResponses || 0} 
              icon={BarChart3} 
              color="#10b981" 
            />
            <StatCard 
              title="Total Users" 
              value={overview.totalUsers || 0} 
              icon={Users} 
              color="#6366f1" 
            />
            <StatCard 
              title="Public Forms" 
              value={overview.publicForms || 0} 
              icon={Globe} 
              color="#f59e0b" 
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Status Distribution</Text>
            <View style={styles.statusBox}>
              <View style={styles.statusItem}>
                <View style={[styles.statusDot, { backgroundColor: '#10b981' }]} />
                <Text style={styles.statusLabel}>Verified</Text>
                <Text style={styles.statusValue}>{statusDistribution.verified || 0}</Text>
              </View>
              <View style={styles.statusItem}>
                <View style={[styles.statusDot, { backgroundColor: '#ef4444' }]} />
                <Text style={styles.statusLabel}>Rejected</Text>
                <Text style={styles.statusValue}>{statusDistribution.rejected || 0}</Text>
              </View>
              <View style={styles.statusItem}>
                <View style={[styles.statusDot, { backgroundColor: '#f59e0b' }]} />
                <Text style={styles.statusLabel}>Pending</Text>
                <Text style={styles.statusValue}>{statusDistribution.pending || 0}</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Responses</Text>
              <TouchableOpacity>
                <Text style={styles.viewAll}>View All</Text>
              </TouchableOpacity>
            </View>
            
            {(recentActivity.responses || []).length > 0 ? (
              recentActivity.responses.map((item: any, idx: number) => (
                <TouchableOpacity key={idx} style={styles.activityItem}>
                  <View style={styles.activityIcon}>
                    <Clock size={16} color="#64748b" />
                  </View>
                  <View style={styles.activityDetails}>
                    <Text style={styles.activityTitle}>{item.questionId}</Text>
                    <Text style={styles.activityMeta}>
                      {new Date(item.createdAt).toLocaleDateString()} • {item.status}
                    </Text>
                  </View>
                  <ChevronRight size={20} color="#cbd5e1" />
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No recent responses found.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </ViewShot>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748b',
    fontSize: 16,
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  errorSub: {
    marginTop: 8,
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  retryBtn: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: Platform.OS === 'android' ? 45 : 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  greet: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  userRole: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  logoutBtn: {
    backgroundColor: '#fff1f2',
    borderColor: '#ffe4e6',
  },
  captureBtn: {
    backgroundColor: '#eff6ff',
    borderColor: '#dbeafe',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100, // Extra padding to avoid navbar overlap
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  card: {
    width: (width - 48) / 2,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  cardValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  statusBox: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statusItem: {
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  viewAll: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '600',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityDetails: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  activityMeta: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 14,
  },
});

export default ServiceAnalyticsScreen;
