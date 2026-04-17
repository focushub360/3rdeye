import React, { useState, useCallback } from 'react';
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
  ShieldCheck
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

const FormCard = ({ id, title, description, responseCount = 0, published = true, onView, onAnalytics }: any) => (
  <View style={styles.formCard}>
    <View style={styles.formCardMain}>
      <View style={styles.formIconBox}>
        <FileText size={20} color="#3b82f6" />
      </View>
      <View style={styles.formDetails}>
        <Text style={styles.formTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.formDesc} numberOfLines={2}>{description}</Text>
      </View>
    </View>
    
    <View style={styles.formMetaRow}>
       <View style={styles.metaBadge}>
         <Users size={12} color="#64748b" />
         <Text style={styles.metaBadgeText}>{responseCount} Responses</Text>
       </View>
       {published && (
         <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>LIVE</Text>
         </View>
       )}
    </View>

    <View style={styles.formActions}>
      <TouchableOpacity style={styles.primaryBtn} onPress={() => onView && onView(id, title)}>
        <Eye size={14} color="#fff" />
        <Text style={styles.primaryBtnText}>View</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryBtn} onPress={() => onAnalytics && onAnalytics(id, title)}>
        <BarChart2 size={12} color="#1e3a8a" />
        <Text style={styles.secondaryBtnText}>Analytics</Text>
      </TouchableOpacity>
    </View>
  </View>
);

const FormListScreen = ({ navigation }: any) => {
  const { user, logout } = useAuth();
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

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchForms();
  }, []);

  const handleFormPreview = (id: string, title: string) => {
    navigation.navigate('FormPreview', { id, title });
  };

  const handleFormAnalytics = (id: string, title: string) => {
    navigation.navigate('FormAnalytics', { id, title });
  };

  const isInspector = user?.role === 'inspector';

  if (loading && !refreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Synchronizing Forms...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Matching Dashboard */}
      <View style={styles.premiumHeader}>
        <View style={styles.headerInfo}>
          <Text style={styles.welcomeText}>RESOURCES,</Text>
          <Text style={styles.headerTitle}>{isInspector ? 'Field Assets' : 'Form Repository'}</Text>
          <Text style={styles.headerRole}>{user?.tenant?.name || 'Laxmi Metals TVS'}</Text>
        </View>
        <View style={styles.headerIconBox}>
           <ShieldCheck size={24} color="#1e3a8a" />
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3b82f6']} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Summary Widgets */}
        <View style={styles.metricsContainer}>
          <View style={styles.metricsRow}>
            <StatCard 
              title={isInspector ? "Assigned" : "Active"} 
              value={forms.length} 
              icon={FileText} 
              color="#3b82f6" 
            />
            <StatCard 
              title="Recent" 
              value={isInspector ? 12 : 154} 
              icon={Users} 
              color="#10b981" 
            />
          </View>
          <View style={styles.fullMetricRow}>
             <StatCard 
                title="Service Compliance Index" 
                value={isInspector ? "96%" : "92%"} 
                icon={TrendingUp} 
                color="#8b5cf6" 
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
              published={form.published}
              responseCount={form.responseCount}
              onView={handleFormPreview}
              onAnalytics={handleFormAnalytics}
            />
          ))}
        </View>

        {networkError && forms.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>📡</Text>
            <Text style={[styles.emptyText, { color: '#ef4444', fontWeight: '700' }]}>Cannot reach server</Text>
            <Text style={[styles.emptyText, { fontSize: 13, marginTop: 6 }]}>
              Ensure your phone is on the same Wi-Fi as your PC{`\n`}Server: 192.168.31.125:5001
            </Text>
            <TouchableOpacity
              style={{ marginTop: 16, backgroundColor: '#1e3a8a', paddingVertical: 10, paddingHorizontal: 24, borderRadius: 10 }}
              onPress={() => { setLoading(true); fetchForms(); }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!networkError && forms.length === 0 && (
          <View style={styles.emptyState}>
            <FileText size={48} color="#cbd5e1" />
            <Text style={styles.emptyText}>No forms available for your current role priority.</Text>
          </View>
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
    shadowColor: '#1e3a8a',
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
    backgroundColor: '#1e3a8a',
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
    gap: 16,
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  formCardMain: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  formIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 4,
  },
  formDesc: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
    lineHeight: 18,
  },
  formMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  metaBadgeText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '700',
  },
  statusBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#166534',
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryBtn: {
    flex: 2,
    flexDirection: 'row',
    backgroundColor: '#1e3a8a',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  secondaryBtnText: {
    color: '#1e3a8a',
    fontSize: 14,
    fontWeight: '800',
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
