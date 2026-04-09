import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  Platform,
} from 'react-native';
import { 
  ChevronLeft, 
  BarChart3, 
  Info, 
  TrendingUp, 
  CheckCircle2, 
  XCircle, 
  Clock,
  PieChart
} from 'lucide-react-native';

const { width } = Dimensions.get('window');

const FormAnalyticsScreen = ({ route, navigation }: any) => {
  const { title, id } = route.params || {};

  // Mock analytics data matching the forms I've set up
  const analyticsData: Record<string, any> = {
    '1': {
      totalResponses: 154,
      completionRate: '98.5%',
      overallQuality: '92%',
      yes: 840,
      no: 45,
      na: 12,
      sections: [
        { title: 'Basic Vehicle Info', score: 100 },
        { title: 'Safety & Electronics', score: 88 },
        { title: 'Documents & Compliance', score: 95 }
      ]
    },
    '2': {
      totalResponses: 85,
      completionRate: '100%',
      overallQuality: '96%',
      yes: 320,
      no: 8,
      na: 2,
      sections: [
        { title: 'Shift Start/End Check', score: 96 }
      ]
    },
    'default': {
      totalResponses: 42,
      completionRate: '94%',
      overallQuality: '85%',
      yes: 180,
      no: 24,
      na: 6,
      sections: [
        { title: 'General Inspection', score: 85 }
      ]
    }
  };

  const data = analyticsData[id] || analyticsData['default'];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft size={24} color="#1e3a8a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{title ? `${title} Analytics` : 'Form Analytics'}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Summary Cards */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={[styles.iconBox, { backgroundColor: '#eff6ff' }]}>
              <BarChart3 size={20} color="#3b82f6" />
            </View>
            <Text style={styles.statValue}>{data.totalResponses}</Text>
            <Text style={styles.statLabel}>Total Responses</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.iconBox, { backgroundColor: '#f0fdf4' }]}>
              <TrendingUp size={20} color="#22c55e" />
            </View>
            <Text style={styles.statValue}>{data.completionRate}</Text>
            <Text style={styles.statLabel}>Completion Rate</Text>
          </View>
        </View>

        <View style={styles.qualityCard}>
          <View style={styles.qualityHeader}>
            <Text style={styles.qualityTitle}>Overall Quality Score</Text>
            <View style={styles.qualityBadge}>
              <Text style={styles.qualityBadgeText}>EXCELLENT</Text>
            </View>
          </View>
          <View style={styles.qualityProgressContainer}>
            <Text style={styles.qualityScore}>{data.overallQuality}</Text>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: data.overallQuality }]} />
            </View>
          </View>
        </View>

        {/* YES/NO/NA Breakdown */}
        <Text style={styles.sectionHeading}>Response Breakdown</Text>
        <View style={styles.breakdownCard}>
          <View style={styles.breakdownRow}>
            <View style={styles.breakdownItem}>
              <View style={[styles.dot, { backgroundColor: '#22c55e' }]} />
              <Text style={styles.breakdownLabel}>YES</Text>
              <Text style={styles.breakdownValue}>{data.yes}</Text>
            </View>
            <View style={styles.breakdownItem}>
              <View style={[styles.dot, { backgroundColor: '#ef4444' }]} />
              <Text style={styles.breakdownLabel}>NO</Text>
              <Text style={styles.breakdownValue}>{data.no}</Text>
            </View>
            <View style={styles.breakdownItem}>
              <View style={[styles.dot, { backgroundColor: '#94a3b8' }]} />
              <Text style={styles.breakdownLabel}>N/A</Text>
              <Text style={styles.breakdownValue}>{data.na}</Text>
            </View>
          </View>
        </View>

        {/* Section Performance */}
        <Text style={styles.sectionHeading}>Section Performance</Text>
        {data.sections.map((section: any, idx: number) => (
          <View key={idx} style={styles.sectionItem}>
            <View style={styles.sectionInfo}>
              <Text style={styles.sectionItemTitle}>{section.title}</Text>
              <Text style={styles.sectionItemScore}>{section.score}%</Text>
            </View>
            <View style={styles.sectionBarBg}>
              <View style={[styles.sectionBarFill, { width: `${section.score}%`, backgroundColor: section.score > 90 ? '#22c55e' : '#3b82f6' }]} />
            </View>
          </View>
        ))}

        <View style={styles.infoNotice}>
          <Info size={16} color="#64748b" />
          <Text style={styles.infoNoticeText}>
            Analytics are based on the latest 30 days of data. Use the web portal for historical filters.
          </Text>
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
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  qualityCard: {
    backgroundColor: '#1e3a8a',
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  qualityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  qualityTitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '600',
  },
  qualityBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  qualityBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  qualityProgressContainer: {
    alignItems: 'center',
  },
  qualityScore: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '800',
    marginBottom: 12,
  },
  progressBarBg: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#22c55e',
    borderRadius: 4,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 16,
  },
  breakdownCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  breakdownItem: {
    alignItems: 'center',
    flex: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  breakdownLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 4,
  },
  breakdownValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  sectionItem: {
    marginBottom: 16,
  },
  sectionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  sectionItemScore: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  sectionBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  sectionBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  infoNotice: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginTop: 12,
    gap: 10,
    alignItems: 'center',
  },
  infoNoticeText: {
    fontSize: 12,
    color: '#64748b',
    flex: 1,
    lineHeight: 18,
  }
});

export default FormAnalyticsScreen;
