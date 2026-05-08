import React, { useState, useCallback, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
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
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import apiClient, { BASE_URL } from '../api/config';
import { 
  FileText, 
  ChevronRight,
  ClipboardList,
  Eye,
  BarChart2,
  Mail,
  MessageCircle,
  MessageSquare,
  Users,
  TrendingUp,
  Clock,
  ShieldCheck,
  Link,
  Calendar,
  Layers
} from 'lucide-react-native';

const { width } = Dimensions.get('window');

const StatCard = ({ title, value, icon: Icon, color }: any) => (
  <View style={styles.cardSmall}>
    <View style={styles.cardHeaderSmall}>
      <Icon size={14} color={color} />
      <Text style={styles.cardTitleSmall}>{title}</Text>
    </View>
    <Text style={styles.cardValueSmall}>{value}</Text>
  </View>
);

const FormCard = ({ id, title, description, responseCount = 0, isActive = true, isGlobal, parentFormId, date, onView, onAnalytics }: any) => {
  const isChild = !!parentFormId;
  
  return (
    <View style={[styles.formCard, isChild && styles.childFormCard]}>
      <View style={styles.formCardTop}>
        <View style={styles.formInfoContainer}>
          <View style={styles.titleRow}>
            {isChild && <Link size={14} color="#6366f1" style={{ marginRight: 6 }} />}
            <Text style={styles.formTitle} numberOfLines={1}>{title}</Text>
          </View>
          <Text style={styles.formDesc} numberOfLines={2}>{description}</Text>
        </View>
        <View style={styles.badgeColumn}>
          {isGlobal && (
             <View style={[styles.statusBadge, { backgroundColor: '#eff6ff' }]}>
                <Text style={[styles.statusBadgeText, { color: '#1e40af' }]}>GLOBAL</Text>
             </View>
          )}
          {isChild ? (
            <View style={[styles.statusBadge, { backgroundColor: '#fdf2f8', borderColor: '#fbcfe8', borderWidth: 0.5 }]}>
               <Text style={[styles.statusBadgeText, { color: '#be185d' }]}>CHILD</Text>
            </View>
          ) : (
            <View style={[styles.statusBadge, { backgroundColor: '#f0fdf4' }]}>
               <Text style={[styles.statusBadgeText, { color: '#166534' }]}>PARENT</Text>
            </View>
          )}
        </View>
      </View>
      
      <View style={styles.divider} />

      <View style={styles.formMetaRow}>
         <View style={styles.metaItem}>
           <Users size={12} color="#64748b" />
           <Text style={styles.metaText}>{responseCount} Responses</Text>
         </View>
         <View style={styles.metaItem}>
           <Calendar size={12} color="#64748b" />
           <Text style={styles.metaText}>{date ? new Date(date).toLocaleDateString() : 'Active'}</Text>
         </View>
      </View>

      <View style={styles.formActions}>
        <TouchableOpacity style={styles.viewBtn} onPress={() => onView && onView(id, title)}>
          <Eye size={16} color="#fff" />
          <Text style={styles.viewBtnText}>Preview</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.analyticsBtn} onPress={() => onAnalytics && onAnalytics(id, title)}>
          <BarChart2 size={16} color="#4f46e5" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const FormListScreen = ({ navigation }: any) => {
  const { user, logout, isCheckedIn } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [forms, setForms] = useState<any[]>([]);
  const [networkError, setNetworkError] = useState(false);

  const fetchForms = async () => {
    setNetworkError(false);
    try {
      const response = await apiClient.get('/forms');
      if (response.data.success) {
        // Safely handle different API response shapes
        const formsData = response.data.data?.forms 
          || response.data.data 
          || response.data.forms 
          || [];
        setForms(Array.isArray(formsData) ? formsData : []);
      }
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.log('Session expired, logging out...');
        logout();
        return;
      }
      console.error('Fetch Forms Error:', error.message);
      if (error.config) console.log('Requested URL:', error.config.baseURL + error.config.url);
      if (error.response) {
        console.log('Error Response Status:', error.response.status);
        console.log('Error Response Data:', JSON.stringify(error.response.data));
      } else if (error.request) {
        console.log('No response received. Request details:', JSON.stringify(error.request).substring(0, 200));
      }
      setNetworkError(true);
      // Keep existing forms if already loaded; don't wipe them out
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Immediate Live Fetch on Focus: data fetches immediately
  useFocusEffect(
    useCallback(() => {
      fetchForms();
    }, [])
  );

  useEffect(() => {
    const SOCKET_URL = BASE_URL.replace('/api', '');
    const socket = io(SOCKET_URL);

    socket.on('connect', () => {
      console.log('✅ FormList connected to socket');
      socket.emit('join-dashboard-analytics');
    });

    socket.on('response-created', (data: any) => {
      console.log('🔔 Live Update: New response detected, refreshing form counts');
      fetchForms();
    });

    socket.on('response-deleted', () => fetchForms());

    return () => {
      socket.disconnect();
    };
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchForms();
  }, []);

  const handleFormPreview = (id: string, title: string) => {
    navigation.navigate('FormPreview', { id, title, readOnly: isInspector });
  };

  const handleFormAnalytics = (id: string, title: string) => {
    navigation.navigate('FormAnalytics', { id, title });
  };

  const isInspector = user?.role === 'inspector';

  const isInitialLoading = loading && !refreshing && forms.length === 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      {/* Header Matching Dashboard */}
      <View style={styles.premiumHeader}>
        <View style={styles.headerInfo}>
          <Text style={styles.welcomeText}>
            {isInitialLoading ? 'SYNCING...' : isInspector && !isCheckedIn ? 'ACTION REQUIRED,' : 'RESOURCES,'}
          </Text>
          <Text style={styles.headerTitle}>{isInspector ? 'Field Assets' : 'Form Repository'}</Text>
          <Text style={styles.headerRole}>{user?.tenant?.name || 'Laxmi Metals TVS'}</Text>
        </View>
        <View style={styles.headerIconBox}>
           {isInspector && !isCheckedIn ? (
             <ShieldCheck size={24} color="#ef4444" />
           ) : (
             <ClipboardList size={24} color="#4f46e5" />
           )}
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6366f1']} />}
        showsVerticalScrollIndicator={false}
      >
        {isInspector && !isCheckedIn ? (
          <View style={[styles.centered, { marginTop: 40 }]}>
            <Clock size={64} color="#cbd5e1" style={{ marginBottom: 16 }} />
            <Text style={[styles.emptyText, { fontSize: 18, fontWeight: '800', color: '#1e293b' }]}>Check-In Required</Text>
            <Text style={[styles.emptyText, { marginTop: 8, paddingHorizontal: 40 }]}>
              Inspectors must be actively checked in to access field assets and form checklists.
            </Text>
            <TouchableOpacity 
              style={{ marginTop: 24, backgroundColor: '#4f46e5', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 16, shadowColor: '#4f46e5', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 }}
              onPress={() => navigation.navigate('Attendance')}
            >
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Go to Attendance</Text>
            </TouchableOpacity>
          </View>
        ) : isInitialLoading ? (
          <View style={[styles.centered, { marginTop: 100 }]}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.loadingText}>Synchronizing Forms...</Text>
          </View>
        ) : (
          <>
            {/* Top Summary Widgets */}
            <View style={styles.metricsContainer}>
              <View style={styles.metricsRow}>
                <StatCard 
                  title="Total Forms" 
                  value={forms.length} 
                  icon={FileText} 
                  color="#6366f1" 
                />
                <StatCard 
                  title="Total Responses" 
                  value={forms.reduce((acc, f) => acc + (f.responseCount || 0), 0)} 
                  icon={ClipboardList} 
                  color="#10b981" 
                />
              </View>
            </View>

            {isInspector && (
              <View style={styles.inspectorAlert}>
                <Clock size={16} color="#fff" />
                <Text style={styles.inspectorAlertText}>
                  Submissions are currently being processed in Field Mode.
                </Text>
              </View>
            )}

            <Text style={styles.sectionHeading}>
              {isInspector ? 'Priority Checklists' : 'Organization Inventory'}
            </Text>
            
            <View style={styles.formGrid}>
              {forms.map((form: any) => (
                <FormCard 
                  key={form._id || form.id}
                  id={form.id || form._id}
                  title={form.title}
                  description={form.description}
                  isActive={form.isActive}
                  isGlobal={form.isGlobal}
                  parentFormId={form.parentFormId}
                  date={form.createdAt}
                  responseCount={form.responseCount}
                  onView={handleFormPreview}
                  onAnalytics={handleFormAnalytics}
                />
              ))}
            </View>

            {forms.length === 0 && !networkError && (
              <View style={styles.emptyState}>
                <FileText size={48} color="#cbd5e1" />
                <Text style={styles.emptyText}>No forms available for your current role priority.</Text>
              </View>
            )}

            {networkError && forms.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 40, marginBottom: 12 }}>📡</Text>
                <Text style={[styles.emptyText, { color: '#ef4444', fontWeight: '700' }]}>Cannot reach server</Text>
                <Text style={[styles.emptyText, { fontSize: 13, marginTop: 6 }]}>
                  Check your internet connection or server status.
                </Text>
                <TouchableOpacity
                  style={{ marginTop: 16, backgroundColor: '#4f46e5', paddingVertical: 10, paddingHorizontal: 24, borderRadius: 10 }}
                  onPress={() => { setLoading(true); fetchForms(); }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Retry Sync</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>
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
  headerIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  metricsContainer: {
    gap: 12,
    marginBottom: 32,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  fullMetricRow: {
    width: '100%',
  },
  cardSmall: {
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
  cardHeaderSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  cardTitleSmall: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cardValueSmall: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
  },
  inspectorAlert: {
    flexDirection: 'row',
    backgroundColor: '#4f46e5',
    padding: 16,
    borderRadius: 16,
    marginBottom: 28,
    alignItems: 'center',
    gap: 12,
  },
  inspectorAlertText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 20,
  },
  formGrid: {
    gap: 12,
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
  },
  childFormCard: {
    marginLeft: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#6366f1',
    backgroundColor: '#f8fafc',
  },
  formCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  formInfoContainer: {
    flex: 1,
    marginRight: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  formTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1e293b',
    flex: 1,
  },
  formDesc: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 16,
    fontWeight: '500',
  },
  badgeColumn: {
    alignItems: 'flex-end',
    gap: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 12,
  },
  formMetaRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  formActions: {
    flexDirection: 'row',
    gap: 8,
  },
  viewBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#4f46e5',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  viewBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  analyticsBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  }
});

export default FormListScreen;
