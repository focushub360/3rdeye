import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  Image,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { 
  FileText, 
  ChevronLeft, 
  Eye, 
  BarChart2, 
  Mail, 
  MessageCircle, 
  MessageSquare, 
  Users 
} from 'lucide-react-native';

const { width } = Dimensions.get('window');

const demoForms = [
  { 
    id: '1', 
    title: 'Laxmi Full Inspection (Standard)', 
    description: 'Industry-standard 3-wheeler inspection form with full sections and branching logic.',
    responses: 0,
    published: true,
  },
  { 
    id: '2', 
    title: 'Laxmi Driver Log', 
    description: 'Daily log for vehicle operator to track trips and vehicle health.',
    responses: 0,
    published: true,
  },
  { 
    id: '3', 
    title: 'Laxmi Vehicle Inspection', 
    description: 'Periodic safety check for 3-wheelers to maintain operational efficiency.',
    responses: 0,
    published: true,
  },
  { 
    id: '4', 
    title: 'Laxmi Metals Service Form', 
    description: 'Priority Service Request for Laxmi Metals vehicles for urgent maintenance.',
    responses: 0,
    published: true,
  }
];

const FormCard = ({ id, title, description, responses = 0, published = true, onView, onAnalytics }: any) => (
  <View style={styles.formCard}>
    <View style={styles.formCardHeader}>
      <FileText size={20} color="#3b82f6" />
      {published && (
        <View style={styles.publishedBadge}>
          <Text style={styles.publishedText}>Published</Text>
        </View>
      )}
    </View>
    <Text style={styles.formCardTitle} numberOfLines={2}>{title}</Text>
    <Text style={styles.formCardDesc} numberOfLines={2}>{description}</Text>
    
    <View style={styles.inviteIcons}>
      <Users size={14} color="#94a3b8" style={{ marginRight: 4 }} />
      <Text style={styles.inviteLabel}>{responses} responses</Text>
      <Mail size={14} color="#3b82f6" style={{ marginLeft: 8 }} />
      <MessageCircle size={14} color="#10b981" style={{ marginLeft: 6 }} />
      <MessageSquare size={14} color="#8b5cf6" style={{ marginLeft: 6 }} />
    </View>

    <View style={styles.formCardFooter}>
      <View>
        <Text style={styles.footerLabel}>Total Responses</Text>
        <Text style={styles.footerValuePrimary}>{responses}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.footerLabel}>YES</Text>
        <Text style={styles.footerValueSecondary}>0%</Text>
      </View>
    </View>

    <View style={styles.actionButtons}>
      <TouchableOpacity style={styles.viewBtn} onPress={() => onView && onView(id, title)}>
        <Eye size={14} color="#fff" style={{ marginRight: 6 }} />
        <Text style={styles.viewBtnText}>View</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.analyticsBtn} onPress={() => onAnalytics && onAnalytics(id, title)}>
        <BarChart2 size={14} color="#1e3a8a" style={{ marginRight: 6 }} />
        <Text style={styles.analyticsBtnText}>Analytics</Text>
      </TouchableOpacity>
    </View>
  </View>
);

const DemoFormListScreen = () => {
  const navigation = useNavigation<any>();

  const handleFormPreview = (form: any) => {
    navigation.navigate('FormPreview', { title: form.title, id: form.id });
  };

  const handleFormAnalytics = (id: string, title: string) => {
    navigation.navigate('FormAnalytics', { id, title });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color="#1e3a8a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Preview Laxmi Forms</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Available Demo Forms</Text>
        
        <View style={styles.formsListGrid}>
          {demoForms.map((form) => (
            <FormCard 
              key={form.id}
              id={form.id}
              title={form.title}
              description={form.description}
              responses={form.responses}
              published={form.published}
              onView={(id: string, title: string) => handleFormPreview({ id, title })}
              onAnalytics={(id: string, title: string) => handleFormAnalytics(id, title)}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: Platform.OS === 'android' ? 40 : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backButton: {
    paddingRight: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginLeft: 10,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 20,
    marginLeft: 4,
  },
  formsListGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  formCard: {
    width: (width - 56) / 2,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  formCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  publishedBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  publishedText: {
    color: '#166534',
    fontSize: 10,
    fontWeight: '600',
  },
  formCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
    lineHeight: 20,
  },
  formCardDesc: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 16,
    lineHeight: 16,
  },
  inviteIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  inviteLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  formCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
  },
  footerLabel: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 4,
  },
  footerValuePrimary: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3b82f6',
  },
  footerValueSecondary: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  viewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e3a8a',
    paddingVertical: 10,
    borderRadius: 8,
  },
  viewBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  analyticsBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  analyticsBtnText: {
    color: '#1e3a8a',
    fontSize: 12,
    fontWeight: '700',
  },
});

export default DemoFormListScreen;
