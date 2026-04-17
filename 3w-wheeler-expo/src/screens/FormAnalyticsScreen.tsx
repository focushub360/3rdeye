import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ChevronLeft, 
  Info, 
  TrendingUp, 
  PieChart,
  Target
} from 'lucide-react-native';
import apiClient from '../api/config';

const { width } = Dimensions.get('window');

const FormAnalyticsScreen = ({ route, navigation }: any) => {
  const { title, id } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'questions' | 'sections'>('questions');

  const fetchAnalytics = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get(`/analytics/form/${id}`);
      if (response.data.success) {
        setData(response.data.data);
      }
    } catch (err: any) {
      console.error('FormAnalytics fetch error:', err.message);
      setError('Could not load analytics for this form.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <ChevronLeft size={24} color="#1e3a8a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title || 'Analytics'}</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1e3a8a" />
          <Text style={styles.loadingText}>Fetching insights...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Fallback if data is missing
  const stats = data || {
    totalResponses: 0,
    responseStats: { completed: 0, pending: 0, inProgress: 0 },
    questionInsights: { sections: [], responses: [], followUpQuestions: [] }
  };

  // Calculate real metrics from response data
  const calculateRealMetrics = () => {
    if (!stats.questionInsights || !stats.questionInsights.sections) {
      return { sections: [], questions: [], overallScore: 0, totalQuestions: 0, totalFollowUps: 0 };
    }

    const sections = stats.questionInsights.sections || [];
    const responses = stats.questionInsights.responses || [];
    const followUps = stats.questionInsights.followUpQuestions || [];
    
    let totalSectionsScore = 0;
    let scoredSectionsCount = 0;
    let totalQuestions = 0;
    const allQuestionsWithStats: any[] = [];

    const sectionsWithScores = sections.map((section: any) => {
      let sectionYes = 0;
      let sectionNo = 0;
      
      const sectionQuestions = section.questions || [];
      totalQuestions += sectionQuestions.length;
      
      sectionQuestions.forEach((question: any) => {
        let qYes = 0;
        let qNo = 0;
        let qNA = 0;
        
        responses.forEach((response: any) => {
          const answer = response.answers?.[question.id];
          if (answer) {
            const answerStr = String(answer).toLowerCase().trim();
            if (answerStr === 'yes' || answerStr === 'y') {
                qYes++;
                sectionYes++;
            } else if (answerStr === 'no' || answerStr === 'n') {
                qNo++;
                sectionNo++;
            } else if (answerStr === 'n/a' || answerStr === 'na' || answerStr === 'not applicable') {
                qNA++;
            }
          }
        });

        allQuestionsWithStats.push({
          ...question,
          stats: { yes: qYes, no: qNo, na: qNA, total: qYes + qNo + qNA },
          sectionTitle: section.title
        });
      });

      const total = sectionYes + sectionNo;
      const score = total > 0 ? Math.round((sectionYes / total) * 100) : 0;
      
      if (total > 0) {
        totalSectionsScore += score;
        scoredSectionsCount++;
      }

      return {
        ...section,
        score,
        totalAnswers: total,
        questionCount: sectionQuestions.length
      };
    });

    const overallScore = scoredSectionsCount > 0 
      ? Math.round(totalSectionsScore / scoredSectionsCount) 
      : 0;

    return { 
      sections: sectionsWithScores, 
      questions: allQuestionsWithStats,
      overallScore, 
      totalQuestions,
      totalFollowUps: followUps.length
    };
  };

  const { sections: realSections, questions: realQuestions, overallScore: realOverallScore, totalQuestions, totalFollowUps } = calculateRealMetrics();

  const renderQuestions = () => (
    <>
      <View style={styles.questionsHeaderCard}>
        <Text style={styles.questionsHeaderTitle}>Response Distribution by Question</Text>
        <View style={styles.questionsHeaderStats}>
          <View style={styles.qHeaderStat}>
            <Text style={styles.qHeaderStatValue}>{realQuestions.length}</Text>
            <Text style={styles.qHeaderStatLabel}>Total Questions</Text>
          </View>
          <View style={styles.vDivider} />
          <View style={styles.qHeaderStat}>
            <Text style={styles.qHeaderStatValue}>{stats.totalResponses}</Text>
            <Text style={styles.qHeaderStatLabel}>Total Responses</Text>
          </View>
        </View>
      </View>

      {realQuestions.map((q, idx) => (
        <View key={q.id || idx} style={styles.questionCard}>
          <View style={styles.qCardHeader}>
            <Text style={styles.qSectionName}>{q.sectionTitle}</Text>
            <Text style={styles.qResponseCount}>{q.stats.total} responses</Text>
          </View>
          <Text style={styles.qText}>{q.label || q.title || 'Untitled Question'}</Text>
          
          <View style={styles.distributionContainer}>
            <View style={styles.distRow}>
              <View style={styles.distLabelGroup}>
                <Text style={styles.distLabel}>YES</Text>
                <Text style={styles.distValue}>{q.stats.yes}</Text>
              </View>
              <View style={styles.distBarBg}>
                <View style={[styles.distBarFill, { 
                  width: q.stats.total > 0 ? `${(q.stats.yes / q.stats.total) * 100}%` : '0%',
                  backgroundColor: '#22c55e' 
                }]} />
              </View>
            </View>

            <View style={styles.distRow}>
              <View style={styles.distLabelGroup}>
                <Text style={styles.distLabel}>NO</Text>
                <Text style={styles.distValue}>{q.stats.no}</Text>
              </View>
              <View style={styles.distBarBg}>
                <View style={[styles.distBarFill, { 
                  width: q.stats.total > 0 ? `${(q.stats.no / q.stats.total) * 100}%` : '0%',
                  backgroundColor: '#ef4444' 
                }]} />
              </View>
            </View>

            {q.stats.na > 0 && (
              <View style={styles.distRow}>
                <View style={styles.distLabelGroup}>
                  <Text style={styles.distLabel}>N/A</Text>
                  <Text style={styles.distValue}>{q.stats.na}</Text>
                </View>
                <View style={styles.distBarBg}>
                  <View style={[styles.distBarFill, { 
                    width: q.stats.total > 0 ? `${(q.stats.na / q.stats.total) * 100}%` : '0%',
                    backgroundColor: '#94a3b8' 
                  }]} />
                </View>
              </View>
            )}
          </View>
        </View>
      ))}

      {realQuestions.length === 0 && (
        <View style={styles.emptyContainer}>
          <Info size={48} color="#cbd5e1" />
          <Text style={styles.emptyText}>No questions found in this form</Text>
        </View>
      )}
    </>
  );

  const renderSections = () => (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalStats}>
        <View style={[styles.miniStatCard, { backgroundColor: '#eff6ff', borderColor: '#dbeafe' }]}>
          <Text style={[styles.miniStatValue, { color: '#1e40af' }]}>{realSections.length}</Text>
          <Text style={styles.miniStatLabel}>Total Sections</Text>
        </View>
        <View style={[styles.miniStatCard, { backgroundColor: '#f0fdf4', borderColor: '#dcfce7' }]}>
          <Text style={[styles.miniStatValue, { color: '#166534' }]}>{totalQuestions}</Text>
          <Text style={styles.miniStatLabel}>Primary Qs</Text>
        </View>
        <View style={[styles.miniStatCard, { backgroundColor: '#faf5ff', borderColor: '#f3e8ff' }]}>
          <Text style={[styles.miniStatValue, { color: '#6b21a8' }]}>{totalFollowUps}</Text>
          <Text style={styles.miniStatLabel}>Follow-ups</Text>
        </View>
        <View style={[styles.miniStatCard, { backgroundColor: '#fff7ed', borderColor: '#ffedd5' }]}>
          <Text style={[styles.miniStatValue, { color: '#9a3412' }]}>{stats.totalResponses}</Text>
          <Text style={styles.miniStatLabel}>Responses</Text>
        </View>
      </ScrollView>

      <Text style={styles.sectionHeading}>Section Details</Text>
      
      {realSections.map((section, idx) => (
        <View key={idx} style={styles.detailedSectionCard}>
          <View style={styles.detailedSectionHeader}>
            <View style={styles.sectionTitleGroup}>
              <View style={styles.sectionIndexBadge}>
                <Text style={styles.sectionIndexText}>{idx + 1}</Text>
              </View>
              <Text style={styles.detailedSectionTitle} numberOfLines={1}>{section.title}</Text>
            </View>
            <View style={[styles.scoreBadge, { backgroundColor: section.score > 90 ? '#dcfce7' : '#dbeafe' }]}>
              <Text style={[styles.scoreBadgeText, { color: section.score > 90 ? '#166534' : '#1e40af' }]}>{section.score}%</Text>
            </View>
          </View>

          <View style={styles.detailedStatRow}>
            <View style={styles.detailedStatItem}>
              <Text style={styles.detailedStatLabel}>Questions</Text>
              <Text style={styles.detailedStatValue}>{section.questionCount}</Text>
            </View>
            <View style={styles.detailedDivider} />
            <View style={styles.detailedStatItem}>
              <Text style={styles.detailedStatLabel}>Samples</Text>
              <Text style={styles.detailedStatValue}>{section.totalAnswers}</Text>
            </View>
            <View style={styles.detailedDivider} />
            <View style={styles.detailedStatItem}>
              <Text style={styles.detailedStatLabel}>Weight</Text>
              <Text style={styles.detailedStatValue}>{section.weightage || 0}%</Text>
            </View>
          </View>

          <View style={styles.detailedSectionBarBg}>
            <View style={[styles.detailedSectionBarFill, { width: `${section.score}%`, backgroundColor: section.score > 90 ? '#22c55e' : section.score > 70 ? '#3b82f6' : '#f59e0b' }]} />
          </View>
        </View>
      ))}

      {realSections.length === 0 && (
        <View style={styles.emptyContainer}>
          <PieChart size={48} color="#cbd5e1" />
          <Text style={styles.emptyText}>No section data available</Text>
        </View>
      )}
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft size={24} color="#1e3a8a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{title ? `${title} Analytics` : 'Form Analytics'}</Text>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'questions' && styles.activeTabItem]} 
          onPress={() => setActiveTab('questions')}
        >
          <TrendingUp size={18} color={activeTab === 'questions' ? '#1e3a8a' : '#64748b'} />
          <Text style={[styles.tabText, activeTab === 'questions' && styles.activeTabText]}>Questions</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'sections' && styles.activeTabItem]} 
          onPress={() => setActiveTab('sections')}
        >
          <PieChart size={18} color={activeTab === 'sections' ? '#1e3a8a' : '#64748b'} />
          <Text style={[styles.tabText, activeTab === 'sections' && styles.activeTabText]}>Sections</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'questions' ? renderQuestions() : renderSections()}
      </ScrollView>
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabItem: {
    borderBottomColor: '#1e3a8a',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  activeTabText: {
    color: '#1e3a8a',
    fontWeight: '800',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  questionsHeaderCard: {
    backgroundColor: '#1e3a8a',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  questionsHeaderTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.8,
    marginBottom: 12,
  },
  questionsHeaderStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  qHeaderStat: {
    flex: 1,
  },
  qHeaderStatValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
  qHeaderStatLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  vDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  questionCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  qCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  qSectionName: {
    fontSize: 10,
    fontWeight: '800',
    color: '#3b82f6',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    textTransform: 'uppercase',
  },
  qResponseCount: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '600',
  },
  qText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
    lineHeight: 22,
  },
  distributionContainer: {
    gap: 12,
  },
  distRow: {
    gap: 6,
  },
  distLabelGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  distLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
  },
  distValue: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f172a',
  },
  distBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  distBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 16,
  },
  horizontalStats: {
    marginBottom: 20,
  },
  miniStatCard: {
    width: width * 0.35,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 10,
  },
  miniStatValue: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 2,
  },
  miniStatLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  detailedSectionCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
  },
  detailedSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  sectionIndexBadge: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionIndexText: {
    fontSize: 12,
    color: '#1e3a8a',
    fontWeight: '800',
  },
  detailedSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1e293b',
    flex: 1,
  },
  scoreBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scoreBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  detailedStatRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 16,
  },
  detailedStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  detailedStatLabel: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '700',
    marginBottom: 4,
  },
  detailedStatValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e293b',
  },
  detailedDivider: {
    width: 1,
    height: '60%',
    backgroundColor: '#f1f5f9',
    alignSelf: 'center',
  },
  detailedSectionBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  detailedSectionBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 12,
    color: '#94a3b8',
    fontWeight: '600',
  }
});

export default FormAnalyticsScreen;
