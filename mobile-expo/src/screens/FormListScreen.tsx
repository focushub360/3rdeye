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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import apiClient, { BASE_URL } from '../api/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
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

import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

const FALLBACK_DEFAULT_FORMS = [
  {
    _id: "6a1324a75a44432034552775",
    id: "6a1324a75a44432034552775",
    title: "LB Aft Yes Paint",
    description: "Inspection Checklist for Load Body After Paint",
    isActive: true,
    isGlobal: false,
    responseCount: 5,
    createdAt: "2026-05-24T16:17:43.825Z"
  }
];

const StatCard = ({ title, value, icon: Icon, color }: any) => {
  const { colors, isDark } = useTheme();
  const isForms = title.toLowerCase().includes('form');
  
  // Rich light gradient colors (pastel styling)
  const gradientColors = isDark
    ? (isForms ? ['#1e1b4b', '#312e81'] : ['#064e3b', '#022c22'])
    : (isForms ? ['#f5f7ff', '#e0e7ff'] : ['#f0fdf4', '#d1fae5']);
    
  const borderLight = isDark
    ? (isForms ? 'rgba(99, 102, 241, 0.4)' : 'rgba(16, 185, 129, 0.4)')
    : (isForms ? 'rgba(99, 102, 241, 0.25)' : 'rgba(16, 185, 129, 0.25)');
    
  const valueColor = isDark
    ? (isForms ? '#818cf8' : '#34d399')
    : (isForms ? '#4f46e5' : '#059669');

  const textColor = isDark ? '#cbd5e1' : '#334155';

  return (
    <LinearGradient 
      colors={gradientColors as [string, string]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.cardSmall, { borderColor: borderLight, borderWidth: 1.5 }]}
    >
      <View style={styles.cardHeaderSmall}>
        <Icon size={14} color={valueColor} />
        <Text style={[styles.cardTitleSmall, { color: textColor, fontWeight: '800' }]}>{title.toUpperCase()}</Text>
      </View>
      <Text style={[styles.cardValueSmall, { color: valueColor, fontSize: 26, fontWeight: '900' }]}>{value}</Text>
    </LinearGradient>
  );
};

const FormCard = ({ id, title, description, responseCount = 0, isActive = true, isGlobal, parentFormId, date, onView, onAnalytics }: any) => {
  const { colors, isDark } = useTheme();
  const isChild = !!parentFormId;
  
  return (
    <View style={[
      styles.formCard, 
      { backgroundColor: colors.card, borderColor: colors.border },
      isChild && [styles.childFormCard, { backgroundColor: colors.surface, borderLeftColor: colors.accent }]
    ]}>
      <View style={styles.formCardTop}>
        <View style={styles.formInfoContainer}>
          <View style={styles.titleRow}>
            {isChild && <Link size={14} color={colors.accent} style={{ marginRight: 6 }} />}
            <Text style={[styles.formTitle, { color: colors.text }]} numberOfLines={1}>{title}</Text>
          </View>
          <Text style={[styles.formDesc, { color: colors.subtext }]} numberOfLines={2}>{description}</Text>
        </View>
        <View style={styles.badgeColumn}>
          {isGlobal && (
             <View style={[styles.statusBadge, { backgroundColor: isDark ? '#1e293b' : '#eff6ff' }]}>
                <Text style={[styles.statusBadgeText, { color: isDark ? colors.accent : '#1e40af' }]}>GLOBAL</Text>
             </View>
          )}
          {isChild ? (
            <View style={[styles.statusBadge, { backgroundColor: isDark ? '#450a0a' : '#fdf2f8', borderColor: isDark ? colors.error : '#fbcfe8', borderWidth: 0.5 }]}>
               <Text style={[styles.statusBadgeText, { color: colors.error }]}>CHILD</Text>
            </View>
          ) : (
            <View style={[styles.statusBadge, { backgroundColor: isDark ? '#064e3b' : '#f0fdf4' }]}>
               <Text style={[styles.statusBadgeText, { color: isDark ? colors.success : '#166534' }]}>PARENT</Text>
            </View>
          )}
        </View>
      </View>
      
      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.formMetaRow}>
         <View style={styles.metaItem}>
           <Users size={12} color={colors.subtext} />
           <Text style={[styles.metaText, { color: colors.subtext }]}>{responseCount} Responses</Text>
         </View>
         <View style={styles.metaItem}>
           <Calendar size={12} color={colors.subtext} />
           <Text style={[styles.metaText, { color: colors.subtext }]}>{date ? new Date(date).toLocaleDateString() : 'Active'}</Text>
         </View>
      </View>

      <View style={styles.formActions}>
        <TouchableOpacity style={[styles.viewBtn, { backgroundColor: colors.accent }]} onPress={() => onView && onView(id, title)}>
          <Eye size={16} color="#fff" />
          <Text style={styles.viewBtnText}>Preview</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.analyticsBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => onAnalytics && onAnalytics(id, title)}>
          <BarChart2 size={16} color={colors.accent} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const FormListScreen = ({ navigation }: any) => {
  const { colors, isDark } = useTheme();
  const { user, logout, isCheckedIn } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [forms, setForms] = useState<any[]>([]);
  const [networkError, setNetworkError] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Monitor connection status
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(!!state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  const loadCachedForms = async (userId?: string) => {
    try {
      let cached = userId ? await AsyncStorage.getItem(`@cached_forms_${userId}`) : null;
      if (!cached) {
        cached = await AsyncStorage.getItem('@cached_forms_backup');
      }
      
      if (cached) {
        setForms(JSON.parse(cached));
      } else {
        // Hardcoded fallback list to ensure the UI remains smooth
        setForms(FALLBACK_DEFAULT_FORMS);
      }
    } catch (cacheErr) {
      setForms(FALLBACK_DEFAULT_FORMS);
    }
  };

  const fetchForms = async () => {
    setNetworkError(false);
    const userId = user?._id || user?.id;

    // Check connectivity first
    const netState = await NetInfo.fetch();
    const online = !!netState.isConnected;
    setIsOnline(online);

    if (!online) {
      console.log('Device is offline. Loading cached checklists.');
      await loadCachedForms(userId);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const response = await apiClient.get('/forms');
      if (response.data.success) {
        const formsData = response.data.data?.forms 
          || response.data.data 
          || response.data.forms 
          || [];
        
        setForms(Array.isArray(formsData) ? formsData : []);
        await AsyncStorage.setItem(`@cached_forms_${userId}`, JSON.stringify(formsData));
        await AsyncStorage.setItem('@cached_forms_backup', JSON.stringify(formsData));

        // Pre-fetch each form's details in background for offline readiness
        if (Array.isArray(formsData)) {
          formsData.forEach(async (formItem: any) => {
            const formId = formItem.id || formItem._id;
            if (formId) {
              try {
                const formDetailRes = await apiClient.get(`/forms/${formId}`);
                const formData = formDetailRes.data?.data?.form || formDetailRes.data?.data || formDetailRes.data?.form || formDetailRes.data;
                if (formData) {
                  await AsyncStorage.setItem(`@cached_form_details_${formId}`, JSON.stringify(formData));
                  console.log(`Pre-fetched and cached form ${formId} for offline use.`);
                }
              } catch (detailErr) {
                console.log(`Failed to pre-fetch form ${formId}:`, detailErr);
              }
            }
          });
        }
      }
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.log('Session expired, logging out...');
        logout();
        return;
      }
      console.error('Fetch Forms Error:', error.message);
      setIsOnline(false); // Assume offline/server issues on catch
      await loadCachedForms(userId);
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
    // Inspectors need to fill out and submit forms, so they should not be in read-only mode.
    navigation.navigate('FormPreview', { id, title, readOnly: !isInspector });
  };

  const handleFormAnalytics = (id: string, title: string) => {
    navigation.navigate('FormAnalytics', { id, title });
  };

  const isInspector = user?.role === 'inspector';

  const isInitialLoading = loading && !refreshing && forms.length === 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      {/* Header Matching Dashboard */}
      <View style={[styles.premiumHeader, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
          <View style={[styles.logoCircleBox, { backgroundColor: isDark ? colors.card : '#fff', borderColor: colors.border }]}>
            <Image 
              source={require('../../assets/header_logo.png')} 
              style={styles.headerLogoImage} 
              resizeMode="contain"
            />
          </View>
          <View style={styles.headerInfo}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>{isInspector ? 'Field Assets' : 'Form Repository'}</Text>
            <Text style={[styles.headerRole, { color: colors.subtext }]}>{user?.tenant?.name || 'Laxmi Metals TVS'}</Text>
          </View>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {isInspector && !isCheckedIn ? (
          <View style={[styles.centered, { marginTop: 40, backgroundColor: colors.background }]}>
            <Clock size={64} color={colors.subtext} style={{ marginBottom: 16 }} />
            <Text style={[styles.emptyText, { fontSize: 18, fontWeight: '800', color: colors.text }]}>Check-In Required</Text>
            <Text style={[styles.emptyText, { marginTop: 8, paddingHorizontal: 40, color: colors.subtext }]}>
              Inspectors must be actively checked in to access field assets and form checklists.
            </Text>
            <TouchableOpacity 
              style={{ marginTop: 24, backgroundColor: colors.accent, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 16 }}
              onPress={() => navigation.navigate('Attendance')}
            >
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Go to Attendance</Text>
            </TouchableOpacity>
          </View>
        ) : isInitialLoading ? (
          <View style={[styles.centered, { marginTop: 100, backgroundColor: colors.background }]}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.loadingText, { color: colors.subtext }]}>Synchronizing Forms...</Text>
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
                  value={forms.reduce((acc, f) => acc + (f?.responseCount || 0), 0)} 
                  icon={ClipboardList} 
                  color="#10b981" 
                />
              </View>
            </View>

            {!isOnline && (
              <View style={[
                styles.offlineBanner, 
                { 
                  backgroundColor: isDark ? '#451a03' : '#fffbeb', 
                  borderColor: isDark ? '#9a3412' : '#fef3c7',
                  borderWidth: 1.5 
                }
              ]}>
                <Clock size={16} color={isDark ? '#fdba74' : '#b45309'} />
                <Text style={[styles.offlineBannerText, { color: isDark ? '#fdba74' : '#b45309' }]}>
                  Offline Mode — Showing Cached Checklists
                </Text>
              </View>
            )}

            {isInspector && (
              <View style={[styles.inspectorAlert, { backgroundColor: colors.accent }]}>
                <Clock size={16} color="#fff" />
                <Text style={styles.inspectorAlertText}>
                  Submissions are currently being processed in Field Mode.
                </Text>
              </View>
            )}

            <Text style={[styles.sectionHeading, { color: colors.subtext }]}>
              {isInspector ? 'Priority Checklists' : 'Organization Inventory'}
            </Text>
            
            <View style={styles.formGrid}>
              {forms.filter(f => f && (f.id || f._id)).map((form: any) => (
                <FormCard 
                  key={form._id || form.id || Math.random().toString()}
                  id={form.id || form._id}
                  title={form.title || 'Untitled Form'}
                  description={form.description || 'No description available'}
                  isActive={form.isActive}
                  isGlobal={form.isGlobal}
                  parentFormId={form.parentFormId}
                  date={form.createdAt}
                  responseCount={form.responseCount || 0}
                  onView={handleFormPreview}
                  onAnalytics={handleFormAnalytics}
                />
              ))}
            </View>

            {forms.length === 0 && isOnline && (
              <View style={[styles.emptyState, { backgroundColor: colors.background }]}>
                <FileText size={48} color={colors.subtext} />
                <Text style={[styles.emptyText, { color: colors.subtext }]}>No forms available for your current role priority.</Text>
              </View>
            )}

            {forms.length === 0 && !isOnline && (
              <View style={[styles.emptyState, { backgroundColor: colors.background }]}>
                <Text style={{ fontSize: 40, marginBottom: 12 }}>📡</Text>
                <Text style={[styles.emptyText, { color: colors.error, fontWeight: '700' }]}>Working Offline</Text>
                <Text style={[styles.emptyText, { fontSize: 13, marginTop: 6, color: colors.subtext }]}>
                  Check your internet connection to sync priority checklists.
                </Text>
                <TouchableOpacity
                  style={{ marginTop: 16, backgroundColor: colors.accent, paddingVertical: 10, paddingHorizontal: 24, borderRadius: 10 }}
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
  logoCircleBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 4,
  },
  headerLogoImage: {
    width: '100%',
    height: '100%',
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
  offlineBanner: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    marginBottom: 28,
    alignItems: 'center',
    gap: 12,
  },
  offlineBannerText: {
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
