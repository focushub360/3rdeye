import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../context/AuthContext';
import apiClient, { BASE_URL } from '../api/config';
import { io } from 'socket.io-client';
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
  Share2,
  Eye,
  Mail,
  MessageCircle,
  MessageSquare,
  BarChart2
} from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

const { width } = Dimensions.get('window');

const StatCard = ({ title, value, icon: Icon, color, subValue }: any) => (
  <View style={styles.card}>
    <View style={styles.cardHeader}>
      <View style={styles.headerTitleRow}>
        <Icon size={18} color={color} />
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
    </View>
    <View style={styles.cardContent}>
      <Text style={styles.cardValue}>{value}</Text>
      {subValue && <Text style={styles.cardSubValue}>{subValue}</Text>}
    </View>
  </View>
);

const FormCard = ({ id, title, description, responses = 0, onView, onAnalytics }: any) => (
  <View style={styles.formCard}>
    <View style={styles.formCardHeader}>
      <FileText size={20} color="#6366f1" />
      <View style={styles.publishedBadge}>
        <Text style={styles.publishedText}>LIVE</Text>
      </View>
    </View>
    <Text style={styles.formCardTitle} numberOfLines={1}>{title}</Text>
    <Text style={styles.formCardDesc} numberOfLines={2}>{description}</Text>
    
    <View style={styles.inviteIcons}>
      <Users size={12} color="#94a3b8" />
      <Text style={styles.inviteLabel}>{responses} entries</Text>
    </View>

    <View style={styles.actionButtonsStyle}>
      <TouchableOpacity style={styles.viewBtnStyle} onPress={() => onView && onView(id, title)}>
        <Eye size={12} color="#fff" />
        <Text style={styles.viewBtnTextStyle}>View</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.analyticsBtnStyle} onPress={() => onAnalytics && onAnalytics(id, title)}>
        <BarChart2 size={12} color="#4f46e5" />
        <Text style={styles.analyticsBtnTextStyle}>Analytics</Text>
      </TouchableOpacity>
    </View>
  </View>
);

const ServiceAnalyticsScreen = () => {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [tenantStats, setTenantStats] = useState<any>(null);
  const [forms, setForms] = useState<any[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const viewShotRef = useRef<any>(null);
  const navigation = useNavigation<any>();
  const socketRef = useRef<any>(null);

  useEffect(() => {
    // Initialize socket for live updates
    const socketUrl = BASE_URL.replace('/api', '');
    socketRef.current = io(socketUrl);
    
    socketRef.current.on('connect', () => {
      console.log('Connected to dashboard analytics socket');
      socketRef.current.emit('join-dashboard-analytics');
    });

    socketRef.current.on('response-created', () => {
      console.log('Live response received, refreshing dashboard...');
      fetchStats();
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave-dashboard-analytics');
        socketRef.current.disconnect();
      }
    };
  }, []);

  const fetchStats = async () => {
    try {
      const [dashboardRes, tenantRes, formsRes] = await Promise.all([
        apiClient.get('/analytics/dashboard'),
        apiClient.get('/analytics/tenant/stats'),
        apiClient.get('/forms')
      ]);

      if (dashboardRes.data.success) {
        setStats(dashboardRes.data.data);
      }
      if (tenantRes.data.success) {
        setTenantStats(tenantRes.data.data);
      }
      if (formsRes.data.success) {
        const formsData = formsRes.data.data?.forms || formsRes.data.data || formsRes.data.forms || [];
        setForms(Array.isArray(formsData) ? formsData : []);
      }
    } catch (error) {
      console.log('Using mock dashboard stats for showcase');
      setStats({
        overview: {
          totalForms: 0,
          totalResponses: 0,
          totalUsers: 0,
          publicForms: 0,
          compliance: '0%'
        },
        statusDistribution: {
          verified: 0,
          rejected: 0,
          pending: 0
        }
      });
      setTenantStats({
        userWiseSubmissions: []
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Live Data Sync: Fetch whenever screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchStats();
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchStats();
  }, []);

  const handleCaptureAndShare = async () => {
    try {
      setIsCapturing(true);
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
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading Analytics...</Text>
      </View>
    );
  }

  const isSuperAdmin = user?.role === 'superadmin';
  const isSubAdmin = user?.role === 'subadmin' || user?.role === 'admin' || user?.role === 'lmadmin';
  const isInspector = user?.role === 'inspector';

  return (
    <SafeAreaView style={styles.container}>
      <ViewShot ref={viewShotRef} style={{ flex: 1, backgroundColor: '#f8fafc' }}>
        {/* Modern Header */}
        <View style={styles.premiumHeader}>
          <View style={styles.headerInfo}>
            <Text style={styles.welcomeText}>WELCOME,</Text>
            <Text style={styles.headerTitle}>{isSuperAdmin ? 'Global Admin' : user?.tenant?.name || 'Administrator'}</Text>
            <Text style={styles.headerRole}>{user?.role?.toUpperCase()} • {user?.email}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.actionIconButton} onPress={handleCaptureAndShare}>
              <Camera size={18} color="#4f46e5" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionIconButton} onPress={onRefresh}>
              <RefreshCw size={18} color="#4f46e5" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Dashboard Metrics Grid */}
          <View style={styles.metricsContainer}>
            <View style={styles.metricsRow}>
              <StatCard 
                title={isSuperAdmin ? "Tenants" : "Forms"} 
                value={stats?.overview?.totalForms ?? (isSuperAdmin ? 12 : 0)} 
                icon={isSuperAdmin ? Globe : FileText} 
                color="#6366f1" 
              />
              <StatCard 
                title={isSuperAdmin ? "Assets" : "Entries"} 
                value={stats?.overview?.totalResponses ?? (isSuperAdmin ? 850 : 0)} 
                icon={isSuperAdmin ? BarChart3 : Users} 
                color="#10b981" 
              />
            </View>
            <StatCard 
              title={isSuperAdmin ? "Global Activity" : "Active Sessions"} 
              value={isSuperAdmin ? "Live" : `${stats?.overview?.totalResponses || 0}`} 
              icon={TrendingUp} 
              color="#8b5cf6" 
            />
        </View>

        {/* Forms Implementation on Dashboard */}
        {!isSuperAdmin && (
          <View style={styles.formsDashboardSection}>
            <Text style={styles.sectionHeading}>Priority Workflows</Text>
            <View style={styles.formGrid}>
              {forms.slice(0, 4).map((form) => (
                <FormCard 
                  key={form._id || form.id}
                  id={form.id || form._id}
                  title={form.title}
                  description={form.description}
                  responses={form.responseCount || 0}
                  onView={() => navigation.navigate('FormPreview', { id: form.id || form._id, title: form.title })}
                  onAnalytics={() => navigation.navigate('FormAnalytics', { id: form.id || form._id, title: form.title })}
                />
              ))}
              {forms.length === 0 && (
                <View style={styles.emptyFormsCard}>
                  <Text style={styles.emptyFormsText}>No active forms found</Text>
                </View>
              )}
            </View>
            {forms.length > 4 && (
              <TouchableOpacity 
                style={styles.seeAllBtn}
                onPress={() => navigation.navigate('Forms')}
              >
                <Text style={styles.seeAllText}>VIEW ALL {forms.length} FORMS</Text>
                <ChevronRight size={14} color="#6366f1" />
              </TouchableOpacity>
            )}
          </View>
        )}

          {/* Inspector Wise Submissions */}
          {(isSubAdmin && tenantStats?.userWiseSubmissions && tenantStats.userWiseSubmissions.length > 0) && (
            <View style={styles.inspectorSection}>
              <Text style={styles.sectionHeading}>Inspector Performance</Text>
              <View style={styles.inspectorList}>
                {tenantStats.userWiseSubmissions.map((item: any, index: number) => (
                  <View key={index} style={styles.inspectorCard}>
                    <View style={styles.inspectorInfo}>
                      <View style={[styles.avatar, { backgroundColor: index === 0 ? '#4f46e5' : '#f1f5f9' }]}>
                        <Text style={[styles.avatarText, { color: index === 0 ? '#fff' : '#64748b' }]}>
                          {item.userName?.[0] || 'I'}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.inspectorName}>{item.userName}</Text>
                        <Text style={styles.inspectorEmail}>{item.userEmail || 'Field Inspector'}</Text>
                      </View>
                    </View>
                    <View style={styles.countBadge}>
                      <Text style={styles.countText}>{item.count}</Text>
                      <Text style={styles.countLabel}>SESSIONS</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Organization Context Card */}
          {!isSuperAdmin && (
            <View style={styles.orgCard}>
              <View style={styles.orgHeader}>
                <View style={[styles.statusDot, { backgroundColor: '#10b981' }]} />
                <Text style={styles.orgTitle}>Organization Context</Text>
              </View>
              
              <View style={styles.orgMetaList}>
                <View style={styles.orgMetaRow}>
                  <Text style={styles.orgMetaLabel}>Business Unit</Text>
                  <Text style={styles.orgMetaValue}>{user?.tenant?.name || 'Authorized Center'}</Text>
                </View>
                <View style={styles.orgMetaDivider} />
                <View style={styles.orgMetaRow}>
                  <Text style={styles.orgMetaLabel}>Role Access</Text>
                  <Text style={styles.orgMetaValue}>{user?.role?.toUpperCase()}</Text>
                </View>
                <View style={styles.orgMetaDivider} />
                <View style={styles.orgMetaRow}>
                  <Text style={styles.orgMetaLabel}>Environment</Text>
                  <Text style={styles.orgMetaValue}>Production Cloud</Text>
                </View>
              </View>

              <View style={styles.portalBox}>
                <Text style={styles.portalLabel}>Customer Portal Endpoint</Text>
                <Text style={styles.portalLink} numberOfLines={1}>
                  https://forms.focusengineeringapp.com/{user?.tenant?.slug || 'portal'}
                </Text>
              </View>
            </View>
          )}

          {isInspector && (
            <View style={styles.inspectorBanner}>
              <Clock size={16} color="#92400e" />
              <View style={styles.inspectorBannerContent}>
                <Text style={styles.inspectorBannerTitle}>Inspector Field Mode</Text>
                <Text style={styles.inspectorBannerText}>Real-time location tags are being attached to reports.</Text>
              </View>
            </View>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </ViewShot>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? 42 : 0,
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
    fontSize: 14,
    fontWeight: '600',
  },
  premiumHeader: {
    backgroundColor: '#fff',
    padding: 24,
    paddingTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerInfo: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 1,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  headerRole: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionIconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  metricsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  cardValue: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -1,
  },
  cardSubValue: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '600',
  },
  orgCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  orgHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  orgTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e293b',
  },
  orgMetaList: {
    gap: 16,
    marginBottom: 20,
  },
  orgMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orgMetaLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  orgMetaValue: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '700',
  },
  orgMetaDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
  },
  portalBox: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  portalLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  portalLink: {
    fontSize: 13,
    color: '#6366f1',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  inspectorBanner: {
    flexDirection: 'row',
    backgroundColor: '#fffbeb',
    padding: 16,
    borderRadius: 16,
    marginTop: 24,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  inspectorBannerContent: {
    flex: 1,
  },
  inspectorBannerTitle: {
    color: '#92400e',
    fontSize: 13,
    fontWeight: '800',
  },
  inspectorBannerText: {
    color: '#b45309',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  formsDashboardSection: {
    marginBottom: 32,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 16,
    marginLeft: 4,
  },
  formGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  formCard: {
    width: (width - 60) / 2,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  formCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  publishedBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  publishedText: {
    color: '#166534',
    fontSize: 9,
    fontWeight: '800',
  },
  formCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 4,
  },
  formCardDesc: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    lineHeight: 14,
    marginBottom: 12,
  },
  inviteIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  inviteLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '700',
  },
  actionButtonsStyle: {
    flexDirection: 'row',
    gap: 6,
  },
  viewBtnStyle: {
    flex: 1.2,
    flexDirection: 'row',
    backgroundColor: '#4f46e5',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  viewBtnTextStyle: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  analyticsBtnStyle: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  analyticsBtnTextStyle: {
    color: '#4f46e5',
    fontSize: 11,
    fontWeight: '800',
  },
  inspectorSection: {
    marginBottom: 32,
  },
  inspectorList: {
    gap: 12,
  },
  inspectorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  inspectorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
  },
  inspectorName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e293b',
  },
  inspectorEmail: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  countBadge: {
    alignItems: 'flex-end',
  },
  countText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#4f46e5',
  },
  countLabel: {
    fontSize: 8,
    color: '#94a3b8',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  emptyFormsCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyFormsText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6366f1',
    letterSpacing: 1,
  },
});

export default ServiceAnalyticsScreen;
