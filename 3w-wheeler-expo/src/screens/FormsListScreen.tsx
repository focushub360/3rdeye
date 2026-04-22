import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl,
  TextInput,
  ScrollView,
  Dimensions,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  FileText, 
  Search, 
  Eye, 
  BarChart3, 
  Users, 
  Layers,
  ChevronRight,
  RefreshCw
} from 'lucide-react-native';
import apiClient from '../api/config';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');

export default function FormsListScreen() {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({ totalForms: 0, totalResponses: 30, totalGroups: 18 });
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const fetchForms = async () => {
    try {
      // Use authenticated endpoint for logged-in users to respect tenant isolation
      const endpoint = '/forms';
      const response = await apiClient.get(endpoint);
      
      if (response.data.success) {
        const formData = response.data.data.forms || response.data.data;
        const validForms = Array.isArray(formData) ? formData : [];
        setForms(validForms);
        setStats(prev => ({ ...prev, totalForms: validForms.length }));
      }
    } catch (error: any) {
      console.error('Fetch forms error:', error?.response?.data || error.message);
      Alert.alert("Connection Issue", "Could not fetch your forms. Please check your network.");
      setForms([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchForms();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchForms();
  };

  const filteredForms = Array.isArray(forms) ? forms.filter((f: any) => 
    f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (f.description && f.description.toLowerCase().includes(searchQuery.toLowerCase()))
  ) : [];

  const handleAction = async (item: any, mode: string) => {
     if (mode === 'analysis') {
        navigation.navigate('FormAnalytics', { id: item.id || item._id, title: item.title });
        return;
     }

     navigation.navigate('FormPreview', { id: item.id || item._id, mode });
  };

  const renderStatCard = (title: string, value: string | number, icon: any, color: string) => (
    <View style={styles.statCard}>
      <View style={[styles.statIconBadge, { backgroundColor: color + '15' }]}>
        {icon}
      </View>
      <View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{title}</Text>
      </View>
    </View>
  );

  const renderFormItem = ({ item }: any) => (
    <View style={styles.formItemCard}>
      <View style={styles.formHeaderRow}>
        <View style={styles.formIconBox}>
          <FileText size={24} color="#3b82f6" />
        </View>
        <View style={styles.formTextContent}>
          <Text style={styles.formTitleText}>{item.title}</Text>
          <Text style={styles.formDescText} numberOfLines={1}>
            {item.description || "No description provided"}
          </Text>
        </View>
      </View>

      <View style={styles.formMetaRow}>
        <View style={[styles.metaBadge, item.isActive ? styles.activeBadge : styles.inactiveBadge]}>
          <View style={[styles.dot, { backgroundColor: item.isActive ? '#10b981' : '#ef4444' }]} />
          <Text style={[styles.metaText, { color: item.isActive ? '#10b981' : '#ef4444' }]}>
            {item.isActive ? 'Active' : 'Inactive'}
          </Text>
        </View>
        <View style={styles.metaBadge}>
          <Layers size={11} color="#64748b" />
          <Text style={styles.metaText}>Updated {new Date(item.updatedAt).toLocaleDateString()}</Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity 
          style={styles.actionBtn}
          onPress={() => handleAction(item, 'view')}
        >
          <Eye size={18} color="#1e3a8a" />
          <Text style={styles.actionBtnText}>View</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionBtn}
          onPress={() => handleAction(item, 'analysis')}
        >
          <BarChart3 size={18} color="#8b5cf6" />
          <Text style={[styles.actionBtnText, { color: '#8b5cf6' }]}>Analysis</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1e3a8a" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topSection}>
        <View style={styles.mainHeader}>
          <View>
            <Text style={styles.welcomeText}>Service Analytics</Text>
            <Text style={styles.subWelcomeText}>{user?.tenant?.name || 'Organization'} Portal</Text>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
             <RefreshCw size={22} color="#1e3a8a" />
          </TouchableOpacity>
        </View>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.statsScroll}
        >
          {renderStatCard('Total Forms', stats.totalForms, <FileText size={20} color="#3b82f6" />, '#3b82f6')}
          {renderStatCard('Responses', stats.totalResponses, <Users size={20} color="#10b981" />, '#10b981')}
          {renderStatCard('Form Groups', stats.totalGroups, <Layers size={21} color="#f59e0b" />, '#f59e0b')}
        </ScrollView>

        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Search size={18} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search accessible forms..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#94a3b8"
            />
          </View>
        </View>
      </View>

      <FlatList
        data={filteredForms}
        keyExtractor={(item: any) => item._id}
        renderItem={renderFormItem}
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Search size={48} color="#cbd5e1" />
            <Text style={styles.emptyText}>No matching forms found for this account</Text>
            <TouchableOpacity onPress={onRefresh} style={styles.retryBtn}>
              <Text style={styles.retryText}>Refresh List</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  topSection: {
    backgroundColor: '#fff',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  mainHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 70, // Increased further to clear status bar completely
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  subWelcomeText: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  refreshBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsScroll: {
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    minWidth: width * 0.45,
    gap: 12,
  },
  statIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
  },
  statLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  searchSection: {
    paddingHorizontal: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 50,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: '#1e293b',
  },
  listContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  formItemCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  formHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  formIconBox: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formTextContent: {
    flex: 1,
  },
  formTitleText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
  },
  formDescText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  formMetaRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  activeBadge: {
    backgroundColor: '#f0fdf4',
  },
  inactiveBadge: {
    backgroundColor: '#fef2f2',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    gap: 8,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e3a8a',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
    gap: 12,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  retryBtn: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#1e3a8a',
    borderRadius: 12,
  },
  retryText: {
    color: '#fff',
    fontWeight: '800',
  }
});
