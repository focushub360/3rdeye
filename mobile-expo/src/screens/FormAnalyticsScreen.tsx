import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Image,
  Modal,
  FlatList,
  Alert,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ChevronLeft, 
  ChevronRight,
  Info, 
  TrendingUp, 
  PieChart, 
  Target,
  LayoutDashboard,
  MessageSquare,
  History,
  CheckCircle2,
  X,
  MapPin,
  Activity,

  BarChart,
  BarChart3,
  MessageSquareText,
  Filter, 
  Search, 
  RefreshCcw,
  Layout,
  Download,
  Edit,
  Trash2,
  Eye,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Check
} from 'lucide-react-native';
import { io } from 'socket.io-client';
import apiClient, { BASE_URL } from '../api/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');
const SOCKET_URL = BASE_URL.replace('/api', '');

const FormAnalyticsScreen = ({ route, navigation }: any) => {
  const { colors, isDark } = useTheme();
  const { title, id, activeTab: initialTab } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const isInspector = user?.role === 'inspector';
  const [activeTab, setActiveTab] = useState<'dashboard' | 'questions' | 'sections' | 'responses'>(initialTab || 'responses');
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [isZoomVisible, setIsZoomVisible] = useState(false);

  // Enable LayoutAnimation on Android
  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  const switchTab = (tab: any) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
  };
  
  // Helper to normalize image URLs
  const getImageUrl = (url: string) => {
    if (!url) return null;
    // If it's already a full URL or base64, return it
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    
    // For relative paths, they should be served via our /api/files endpoint
    // If url starts with 'uploads/', we should still route it through the files endpoint or serve directly
    // based on how the server is configured. Given server.js serves /api/files, let's use that.
    return `${BASE_URL}/files/${url.startsWith('/') ? url.substring(1) : url}`;
  };


  const fetchAnalytics = useCallback(async (isBackground = false) => {
    if (!id) return;
    try {
      if (!isBackground) setLoading(true);
      setError(null);
      const response = await apiClient.get(`/analytics/form/${id}`);
      console.log(`[FormAnalytics] API Response Success: ${response.data.success}, Data: ${!!response.data.data}`);
      if (response.data.success) {
        setData(response.data.data);
        await AsyncStorage.setItem(`@cached_analytics_${id}`, JSON.stringify(response.data.data));
      }
    } catch (err: any) {
      console.error('FormAnalytics fetch error:', err.message);
      
      // Fallback to offline cached analytics/response data
      try {
        const cached = await AsyncStorage.getItem(`@cached_analytics_${id}`);
        if (cached) {
          setData(JSON.parse(cached));
        } else {
          setError('Could not load analytics for this form.');
        }
      } catch (cacheErr) {
        setError('Could not load analytics for this form.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);
  
  const handleReviewSubmit = async (responseId: string, option: string) => {
    try {
      const payload = {
        responseId,
        reviewOption: option,
        reviewerName: `${(user as any)?.firstName || ''} ${(user as any)?.lastName || ''}`.trim() || user?.username || 'Admin',
        reviewerId: user?._id || user?.id,
        createdAt: new Date().toISOString()
      };
      
      const response = await apiClient.post('/reviews', payload);
      if (response.data.success) {
        // Refresh data to show updated status
        fetchAnalytics(true);
      }
    } catch (err: any) {
      console.error('Review submission error:', err.message);
      Alert.alert('Error', 'Failed to submit review');
    }
  };

  const toggleDispatch = async (responseId: string, currentStatus: boolean) => {
    try {
      const response = await apiClient.put(`/responses/${responseId}`, {
        isDispatched: !currentStatus
      });
      
      if (response.data.success) {
        // Optimistically update local state or just refetch
        fetchAnalytics(true);
      }
    } catch (err: any) {
      console.error('Failed to toggle dispatch:', err.message);
      Alert.alert('Error', 'Failed to update dispatch status');
    }
  };

  useEffect(() => {
    fetchAnalytics();
    
    // Join analytics room for real-time updates
    const socket = io(SOCKET_URL);
    if (id) {
      socket.emit('join-form-analytics', id);
      
      socket.on('response-created', (payload: any) => {
        console.log('🔔 Live Update: New response received via socket');
        fetchAnalytics(true);
      });

      socket.on('response-updated', (payload: any) => {
        fetchAnalytics(true);
      });
    }

    return () => {
      if (id) socket.emit('leave-form-analytics', id);
      socket.disconnect();
    };
  }, [fetchAnalytics, id]);


  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Memoized stats extraction to avoid recalculating on every render
  const stats = useMemo(() => data || {
    totalResponses: 0,
    responseStats: { completed: 0, pending: 0, inProgress: 0 },
    questionInsights: { sections: [], responses: [], followUpQuestions: [] }
  }, [data]);

  // Wrap calculation in useMemo to prevent UI jank during rendering
  const metrics = useMemo(() => {
    if (!stats.questionInsights || !stats.questionInsights.sections) {
      return { sections: [], questions: [], overallScore: 0, totalQuestions: 0, totalFollowUps: 0, globalAccepted: 0, globalRejected: 0, globalRework: 0, responseStatuses: {} };
    }

    const sections = stats.questionInsights.sections || [];
    const responses = stats.questionInsights.responses || [];
    const followUps = stats.questionInsights.followUpQuestions || [];
    
    let totalSectionsScore = 0;
    let scoredSectionsCount = 0;
    let totalQuestions = 0;
    let globalAccepted = 0;
    let globalRejected = 0;
    let globalRework = 0;
    const allQuestionsWithStats: any[] = [];

    const sectionsWithScores = sections.map((section: any) => {
      let sectionYes = 0;
      let sectionNo = 0;
      
      const sectionQuestions = section.questions || [];
      totalQuestions += sectionQuestions.length;
      
      sectionQuestions.forEach((question: any) => {
        const qTitle = (question.title || question.text || question.label || '').toLowerCase();
        if (qTitle.includes('chassis number') || qTitle.includes('chasis number')) return;

        let qYes = 0;
        let qNo = 0;
        let qNA = 0;
        
        responses.forEach((response: any) => {
          const answer = response.answers?.[question.id];
          if (answer) {
            const answerStr = typeof answer === 'object' ? (answer.status || '') : String(answer);
            const lowerAnswer = answerStr.toLowerCase().trim();
            
            if (lowerAnswer === 'yes' || lowerAnswer === 'y' || lowerAnswer.includes('accepted') || lowerAnswer === 'ok') {
                qYes++;
                sectionYes++;
                globalAccepted++;
            } else if (lowerAnswer === 'no' || lowerAnswer === 'n' || lowerAnswer.includes('rejected')) {
                qNo++;
                sectionNo++;
                globalRejected++;
            } else if (lowerAnswer.includes('rework')) {
                globalRework++;
            } else if (lowerAnswer === 'n/a' || lowerAnswer === 'na' || lowerAnswer === 'not applicable') {
                qNA++;
            }
          }
        });

        allQuestionsWithStats.push({
          ...question,
          id: question.id || question._id,
          label: question.text || question.label || question.title || question.question || question.name || question.description || `Q-${question.id?.substring(0, 4) || 'Unnamed'}`,
          title: question.title || question.text || question.label || question.question || question.name || '',
          text: question.text || question.label || question.title || question.question || question.name || '',
          expectedAnswer: question.correctAnswer || question.expectedAnswer || '',
          stats: { yes: qYes, no: qNo, na: qNA, total: qYes + qNo + qNA },
          sectionTitle: section.title || section.name || ''
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

    // --- Status Mapping (Web Parity) ---
    const responseStatuses: Record<string, string> = {};
    const itemGroups: Record<string, any[]> = {};
    
    const chassisQuestion = sections.flatMap((s: any) => s.questions || []).find((q: any) => 
      q.type === 'chassisNumber' || 
      (q.title || q.text || q.label || '').toLowerCase().includes('chassis number') ||
      (q.title || q.text || q.label || '').toLowerCase().includes('chasis number')
    );
    const cQId = chassisQuestion?.id || chassisQuestion?._id || 'chassis_number';

    const sortedResponses = [...responses].sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    sortedResponses.forEach(r => {
      const chassis = r.answers?.[cQId] || r.answers?.['chassis_number'] || r.chassisNumber || `unknown-${r.id}`;
      if (!itemGroups[chassis]) itemGroups[chassis] = [];
      itemGroups[chassis].push(r);
    });

    Object.entries(itemGroups).forEach(([chassis, group]) => {
      let reworkCount = 0;
      let hasBeenReworked = false;

      group.forEach((r, idx) => {
        let isRework = false;
        let isAccepted = false;
        let isRejected = false;

        if (r.answers) {
          Object.values(r.answers).forEach((ans: any) => {
            const s = typeof ans === 'object' ? (ans.status || '').toLowerCase().trim() : String(ans).toLowerCase().trim();
            if (s === 'rework' || s === 'reworked' || s.includes('re-rework')) isRework = true;
            else if (['accepted', 'rework completed', 'verified', 'ok', 'yes', 'y'].includes(s)) isAccepted = true;
            else if (['rejected', 'no', 'n'].includes(s)) isRejected = true;
          });
        }

        if (isRejected || r.status === 'rejected') {
          responseStatuses[r.id || r._id] = "Rejected";
        } else if (isRework) {
          reworkCount++;
          hasBeenReworked = true;
          responseStatuses[r.id || r._id] = `Rework ${reworkCount}`;
        } else if (isAccepted || r.status === 'verified') {
          if (idx === 0 && !hasBeenReworked) responseStatuses[r.id || r._id] = "Direct Ok";
          else responseStatuses[r.id || r._id] = "Rework Accepted";
        } else {
          responseStatuses[r.id || r._id] = (r.status || "Pending").toUpperCase();
        }
      });
    });

    return { 
      sections: sectionsWithScores, 
      questions: allQuestionsWithStats,
      overallScore, 
      totalQuestions,
      totalFollowUps: followUps.length,
      globalAccepted,
      globalRejected,
      globalRework,
      responseStatuses 
    };
  }, [stats]);

  if (loading && !refreshing && !data) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <ChevronLeft size={24} color={isDark ? colors.text : "#1e3a8a"} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{title || 'Analytics'}</Text>
        </View>
        <View style={[styles.centered, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.subtext }]}>Fetching insights...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { 
    sections: realSections, 
    questions: realQuestions, 
    overallScore: realOverallScore, 
    totalQuestions: totalQsCount, 
    totalFollowUps,
    globalAccepted,
    globalRejected,
    globalRework,
    responseStatuses
  } = metrics;

  const renderDashboard = () => (
    <View style={[styles.dashboardContainer, { backgroundColor: colors.background }]}>
      <View style={styles.liveIndicatorRow}>
        <View style={[styles.liveBadge, { backgroundColor: isDark ? '#064e3b' : '#ecfdf5' }]}>
          <View style={styles.liveDot} />
          <Text style={[styles.liveText, { color: '#10b981' }]}>LIVE MONITORING</Text>
        </View>
        <Text style={[styles.lastUpdatedText, { color: colors.subtext }]}>Auto-refreshing every 30s</Text>
      </View>
      <View style={styles.heroStatsRow}>
        <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.accent, borderWidth: 2 }]}>
          <Text style={[styles.heroLabel, { color: colors.accent }]}>OVERALL QUALITY SCORE</Text>
          <Text style={[styles.heroValue, { fontSize: 36, color: realOverallScore >= 90 ? '#059669' : realOverallScore >= 70 ? '#d97706' : '#ef4444' }]}>
            {realOverallScore}%
          </Text>
          <View style={[styles.statusBadgeSmall, { backgroundColor: realOverallScore >= 90 ? (isDark ? '#064e3b' : '#ecfdf5') : realOverallScore >= 70 ? (isDark ? '#7c2d12' : '#fffbeb') : (isDark ? '#450a0a' : '#fef2f2'), marginTop: 4 }]}>
            <Text style={[styles.statusBadgeTextSmall, { color: realOverallScore >= 90 ? '#059669' : realOverallScore >= 70 ? '#d97706' : '#ef4444' }]}>
              {realOverallScore >= 90 ? 'EXCELLENT' : realOverallScore >= 70 ? 'STABLE' : 'CRITICAL LEVEL'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.heroStatsRow}>
        <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.heroLabel, { color: colors.subtext }]}>COMPLETED RESPONSES</Text>
          <Text style={[styles.heroValue, { color: '#22c55e' }]}>{stats.responseStats.completed}</Text>
             <View style={[styles.miniBadge, { backgroundColor: colors.surface }]}>
               <History size={12} color={colors.subtext} />
               <Text style={[styles.miniBadgeText, { color: colors.subtext }]}>Verified</Text>
             </View>
        </View>
        <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.heroLabel, { color: colors.subtext }]}>TOTAL ENTRIES</Text>
          <Text style={[styles.heroValue, { color: colors.text }]}>{stats.totalResponses}</Text>
          <View style={styles.heroTrend}>
             <TrendingUp size={12} color={colors.subtext} />
             <Text style={[styles.trendText, { color: colors.subtext }]}>Live Feed</Text>
          </View>
        </View>
      </View>


      <View style={styles.webParityGrid}>
        {/* Overall Response Quality - Pie Chart Visual */}
        <View style={[styles.webParityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.webParityCardHeader}>
             <View style={[styles.webIconBox, { backgroundColor: colors.surface }]}>
               <History size={18} color={colors.accent} />
             </View>
            <View>
              <Text style={[styles.webParityCardTitle, { color: colors.text }]}>Quality Distribution</Text>
              <Text style={[styles.webParityCardSub, { color: colors.subtext }]}>Overall Performance Score</Text>
            </View>
          </View>
          <View style={styles.qualityCircleContainer}>
              <View style={[styles.qualityDonut, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                 <Text style={[styles.qualityPercent, { color: colors.text }]}>{realOverallScore}%</Text>
                 <Text style={[styles.qualityLabel, { color: colors.subtext }]}>SCORE</Text>
              </View>
              <View style={styles.qualityLegendList}>
                 <View style={styles.legendRow}>
                    <View style={[styles.dotSmall, { backgroundColor: '#22c55e' }]} />
                    <Text style={[styles.legendTxt, { color: colors.text }]}>Accepted ({globalAccepted || 0})</Text>
                 </View>
                 <View style={styles.legendRow}>
                    <View style={[styles.dotSmall, { backgroundColor: '#ef4444' }]} />
                    <Text style={[styles.legendTxt, { color: colors.text }]}>Rejected ({globalRejected || 0})</Text>
                 </View>
                 <View style={styles.legendRow}>
                    <View style={[styles.dotSmall, { backgroundColor: '#f59e0b' }]} />
                    <Text style={[styles.legendTxt, { color: colors.text }]}>Rework ({globalRework || 0})</Text>
                 </View>
                 <View style={styles.legendRow}>
                    <View style={[styles.dotSmall, { backgroundColor: colors.subtext }]} />
                    <Text style={[styles.legendTxt, { color: colors.text }]}>N/A</Text>
                 </View>
              </View>
          </View>
        </View>
      </View>
    </View>
  );

  const renderTableCellContent = (answer: any, questionObj: any) => {
    if (!answer) return <Text style={[styles.tableTextSub, { color: colors.subtext }]}>No response</Text>;

    const isObject = typeof answer === 'object' && answer !== null;
    
    // Collect "display parts" to show in the cell
    const parts: { label: string, value: string, isImage?: boolean, type?: string, color?: string }[] = [];

    if (isObject) {
       // 1. Status
       if (answer.status) {
         parts.push({ 
           label: 'Status', 
           value: answer.status, 
           type: 'status',
           color: String(answer.status).toLowerCase().includes('accepted') ? '#059669' : 
                  String(answer.status).toLowerCase().includes('rejected') ? '#ef4444' : '#d97706'
         });
       }
       
       // 2. Chassis
       if (answer.chassisNumber) {
         parts.push({ label: 'Chassis', value: answer.chassisNumber });
       }
       
       // 3. Recursive scan for zones, categories, defects, remarks, and evidence
       const scan = (obj: any, path: string[] = [], zoneName?: string) => {
         if (!obj || typeof obj !== 'object') return;
         
         // Detect Evidence
         const evidenceFields = ['evidence', 'evidenceUrl', 'fileUrl', 'url', 'image', 'photo', 'evidencePhotos', 'path'];
         for (const field of evidenceFields) {
            const val = obj[field];
            if (val && typeof val === 'string' && (val.startsWith('http') || val.includes('uploads/') || val.startsWith('data:') || val.match(/\.(jpg|jpeg|png|gif|webp)$/i))) {
               parts.push({ label: 'Evidence', value: val, isImage: true });
            } else if (Array.isArray(val)) {
               val.forEach(img => {
                 if (typeof img === 'string') parts.push({ label: 'Evidence', value: img, isImage: true });
               });
            }
         }

         // Detect Remarks
         if (obj.remark || obj.remarks) {
            const rem = obj.remark || obj.remarks;
            if (rem && typeof rem === 'string' && rem.trim() && rem.toLowerCase() !== 'no response') {
                parts.push({ label: 'Remark', value: rem });
            }
         }

         // Detect Defect Names
         if (obj.name && (path.includes('defects') || path.includes('rejectedDefects') || path.includes('categories'))) {
            if (!parts.some(p => p.value === obj.name)) {
                parts.push({ label: path.includes('categories') ? 'Category' : 'Defect', value: obj.name });
            }
         }

         // Recurse
         Object.entries(obj).forEach(([key, val]) => {
           if (val && typeof val === 'object') {
             const currentZone = (path.includes('zoneData') && path.length === 1) ? key : zoneName;
             if (currentZone && path.length === 1 && path[0] === 'zoneData') {
                parts.push({ label: 'Zone', value: currentZone });
             }
             scan(val, [...path, key], currentZone);
           }
         });
       };
       
       scan(answer);
    } else {
       const val = String(answer);
       const isImg = val.startsWith('http') || val.match(/\.(jpg|jpeg|png|gif|webp)$/i) || val.startsWith('data:image');
       if (isImg) {
          parts.push({ label: 'Evidence', value: val, isImage: true });
       } else {
          const lowerVal = val.toLowerCase();
          const isStatus = ['yes', 'no', 'ok', 'rework', 'accepted', 'rejected', 'n/a', 'na'].some(s => lowerVal.includes(s));
          parts.push({ 
            label: isStatus ? 'Status' : 'Value', 
            value: val, 
            type: isStatus ? 'status' : undefined,
            color: lowerVal.includes('accepted') || lowerVal.includes('yes') || lowerVal === 'ok' ? '#059669' : 
                   lowerVal.includes('rejected') || lowerVal === 'no' ? '#ef4444' : '#d97706'
          });
       }
    }

    const filteredParts = parts.filter((p, index, self) => 
       p.value !== 'no response' && 
       p.value !== 'undefined' &&
       index === self.findIndex(t => t.label === p.label && t.value === p.value)
    );

    if (filteredParts.length === 0) return <Text style={[styles.tableTextSub, { color: colors.subtext }]}>No response</Text>;

    return (
      <View style={styles.questionCell}>
         {filteredParts.map((part, pIdx) => (
            <View key={pIdx} style={styles.cellDataRow}>
               <Text style={[styles.miniLabel, { backgroundColor: colors.surface, color: colors.subtext }]}>{part.label.toUpperCase()}</Text>
               {part.isImage ? (
                  <TouchableOpacity 
                    onPress={() => { setZoomImage(getImageUrl(part.value)); setIsZoomVisible(true); }} 
                    style={[styles.cellImageWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                     <Image 
                       source={{ uri: getImageUrl(part.value) || undefined }} 
                       style={styles.cellImageThumbnail} 
                       resizeMode="cover"
                     />
                  </TouchableOpacity>
               ) : part.type === 'status' ? (
                  <View style={[styles.statusBadgeSmall, { backgroundColor: part.color + '10' }]}>
                    <Text style={[styles.statusBadgeTextSmall, { color: part.color }]}>
                      {part.value.toUpperCase()}
                    </Text>
                  </View>
               ) : (
                  <Text style={[styles.tableTextMain, { color: colors.text }]} numberOfLines={2}>{part.value}</Text>
               )}
            </View>
         ))}
      </View>
    );
  };


  // --- Optimized ResponseRow Component ---
  const ResponseRow = React.memo(({ item: resp, index: idx }: { item: any, index: number }) => {
    // Extract rework tags and defects for the REVIEW column
    const extractReviewTags = (answers: any) => {
      const tags: string[] = [];
      if (!answers) return tags;
      
      const scan = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;
        if (obj.name && (String(obj.name).length > 1)) tags.push(obj.name);
        if (obj.remark && obj.remark.length < 20 && obj.remark.toLowerCase() !== 'no response') tags.push(obj.remark);
        Object.values(obj).forEach(val => { if (val && typeof val === 'object') scan(val); });
      };

      Object.values(answers).forEach(ans => scan(ans));
      return [...new Set(tags)].filter(t => !['YES', 'NO', 'N/A', 'OK', 'ACCEPTED', 'REJECTED'].includes(t.toUpperCase()));
    };

    const reviewTags = extractReviewTags(resp.answers);
    const isRework = resp.review?.option === 'Rework' || String(resp.status).toLowerCase().includes('rework');
    const reviewerName = resp.review?.reviewer || resp.inspectorName || 'Admin';

    return (
      <View style={[styles.tableRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {/* DISPATCH (A) */}
        <View style={[styles.tableCell, { width: 100, flexShrink: 0, alignItems: 'center' }]}>
          <TouchableOpacity 
            onPress={() => toggleDispatch(resp.id || resp._id, !!resp.isDispatched)}
            style={[styles.dispatchCheckbox, { backgroundColor: colors.surface, borderColor: colors.border }, resp.isDispatched && [styles.dispatchCheckboxChecked, { backgroundColor: colors.accent, borderColor: colors.accent }]]}
          >
            {resp.isDispatched && <Check size={10} color="#fff" strokeWidth={4} />}
          </TouchableOpacity>
        </View>

        <View style={[styles.tableCell, { width: 220, flexDirection: 'row', gap: 10, alignItems: 'center' }]}>
          <View style={[styles.tableCheckbox, { backgroundColor: colors.surface, borderColor: colors.border }]} />
          <TouchableOpacity onPress={() => {}} style={[styles.actionIconBtn, { backgroundColor: isDark ? colors.surface : '#eff6ff', borderColor: colors.border }]}>
            <Edit size={12} color="#3b82f6" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => {}} style={[styles.actionIconBtn, { backgroundColor: isDark ? '#450a0a' : '#fee2e2', borderColor: colors.border }]}>
            <Trash2 size={12} color="#ef4444" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionIconBtn, { backgroundColor: isDark ? colors.surface : '#f1f5f9', borderColor: colors.border }]}
            onPress={() => navigation.navigate('FormPreview', { 
              id: id,
              responseId: resp.id || resp._id, 
              title: `Submission #${(stats.questionInsights?.responses?.length || 0) - idx}`, 
              answers: resp.answers, 
              chassisNumber: resp.chassisNumber,
              status: resp.status,
              isDispatched: resp.isDispatched,
              submittedBy: resp.submittedBy,
              readOnly: true 
            })}
          >
            <Eye size={12} color={colors.text} />
          </TouchableOpacity>
          {user?.role !== 'inspector' && (
            <>
              <TouchableOpacity 
                style={[styles.actionIconBtn, { backgroundColor: isDark ? '#064e3b' : '#ecfdf5', borderColor: colors.border }]}
                onPress={() => handleReviewSubmit(resp.id || resp._id, 'Accepted')}
              >
                <CheckCircle2 size={12} color="#059669" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionIconBtn, { backgroundColor: isDark ? '#7c2d12' : '#fff7ed', borderColor: colors.border }]}
                onPress={() => handleReviewSubmit(resp.id || resp._id, 'Rework')}
              >
                <RefreshCw size={12} color="#d97706" />
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={[styles.tableCell, { width: 160, marginLeft: 10 }]}>
           <Text style={[styles.tableTextMain, { color: colors.text }]} numberOfLines={1}>{resp.submittedBy || 'Anonymous'}</Text>
        </View>

        <View style={[styles.tableCell, { width: 110 }]}>
           <View style={[
             styles.statusBadgeSmall, 
             { 
               backgroundColor: 
                 (responseStatuses[resp.id || resp._id] || '').toLowerCase().includes('rework') ? (isDark ? '#7c2d12' : '#fff7ed') : 
                 (responseStatuses[resp.id || resp._id] || '').toLowerCase().includes('accepted') || (responseStatuses[resp.id || resp._id] || '').toLowerCase().includes('verified') || (responseStatuses[resp.id || resp._id] || '').toLowerCase().includes('ok') || (responseStatuses[resp.id || resp._id] || '').toLowerCase().includes('direct') ? (isDark ? '#064e3b' : '#ecfdf5') : 
                 (responseStatuses[resp.id || resp._id] || '').toLowerCase().includes('rejected') ? (isDark ? '#450a0a' : '#fef2f2') : (isDark ? '#1e293b' : '#f1f5f9') 
             }
           ]}>
             <Text style={[
               styles.statusBadgeTextSmall, 
               { 
                 color: 
                   (responseStatuses[resp.id || resp._id] || '').toLowerCase().includes('rework') ? '#d97706' : 
                   (responseStatuses[resp.id || resp._id] || '').toLowerCase().includes('accepted') || (responseStatuses[resp.id || resp._id] || '').toLowerCase().includes('verified') || (responseStatuses[resp.id || resp._id] || '').toLowerCase().includes('ok') || (responseStatuses[resp.id || resp._id] || '').toLowerCase().includes('direct') ? '#059669' : 
                   (responseStatuses[resp.id || resp._id] || '').toLowerCase().includes('rejected') ? '#ef4444' : colors.subtext 
               }
             ]}>
               {responseStatuses[resp.id || resp._id] || 'PENDING'}
             </Text>
           </View>
        </View>

        <View style={[styles.tableCell, { width: 220 }]}>
           <View style={styles.reviewContent}>
              {isRework && (
                <View style={styles.reworkHeader}>
                   <View style={[styles.reworkBadge, { backgroundColor: isDark ? '#7c2d12' : '#fff7ed', borderColor: isDark ? colors.border : '#fed7aa' }]}>
                      <Text style={styles.reworkBadgeText}>REWORK</Text>
                   </View>
                   <Text style={[styles.reworkInspector, { color: colors.subtext }]}>by {reviewerName}</Text>
                </View>
              )}
              <View style={styles.reviewTagsRow}>
                {reviewTags.map((tag, tIdx) => (
                  <View key={tIdx} style={[styles.reviewTag, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.reviewTagText, { color: colors.text }]}>{tag}</Text>
                  </View>
                ))}
                {reviewTags.length === 0 && !isRework && <Text style={[styles.tableTextSub, { color: colors.subtext }]}>-</Text>}
              </View>
           </View>
        </View>

        <View style={[styles.tableCell, { width: 150 }]}>
          <Text style={[styles.tableTextSub, { color: colors.subtext }]}>
            {new Date(resp.createdAt).toLocaleString([], { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        <View style={[styles.tableCell, { width: 100 }]}>
          {(() => {
            const timeSpent = resp.timeSpent;
            return timeSpent ? (
              <View style={[styles.timeTakenRow, { backgroundColor: isDark ? colors.surface : '#eff6ff', borderColor: colors.border }]}>
                <History size={10} color={colors.accent} />
                <Text style={[styles.tableTextMain, { color: colors.accent, marginLeft: 4 }]}>
                  {timeSpent > 60 ? `${Math.floor(timeSpent / 60)}m ${timeSpent % 60}s` : `${timeSpent}s`}
                </Text>
              </View>
            ) : ( <Text style={[styles.tableTextSub, { color: colors.subtext }]}>-</Text> );
          })()}
        </View>

        <View style={[styles.tableCell, { width: 150 }]}>
           <View style={[styles.chassisBadge, { backgroundColor: isDark ? colors.surface : '#eff6ff', borderColor: colors.border }]}>
            <Text style={[styles.chassisBadgeText, { color: colors.accent }]}>{resp.chassisNumber || '-'}</Text>
           </View>
        </View>

        {realQuestions.map((q, qIdx) => (
          <View key={`c-${qIdx}`} style={[styles.tableCell, { width: 220, borderLeftWidth: 1, borderLeftColor: colors.border, paddingLeft: 12 }]}>
            {renderTableCellContent(resp.answers?.[q.id], q)}
          </View>
        ))}
      </View>
    );
  });

  const renderResponses = () => (
    <View style={[styles.responsesContainer, { backgroundColor: colors.background }]}>
      <View style={[styles.responsesTableHeader, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.tableHeaderTop}>
          <View style={styles.tableHeaderTitleGroup}>
            <Layout size={18} color={colors.accent} />
            <Text style={[styles.tableHeaderTitle, { color: colors.text }]}>All Responses - Table View</Text>
          </View>
          <View style={styles.tableActions}>
            <TouchableOpacity style={[styles.tableMiniBtn, { backgroundColor: colors.surface }]}>
              <Filter size={14} color={colors.accent} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tableMiniBtn, { backgroundColor: '#10b981' }]}>
              <Download size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.tablePerformanceBoard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.perfItem}>
            <View style={styles.perfItemHeader}>
               <Activity size={14} color={colors.subtext} />
               <View style={{ marginLeft: 6 }}>
                  <Text style={styles.perfItemLabel}>OVERALL INSPECTION</Text>
                  <Text style={[styles.perfItemTitle, { color: colors.text }]}>Form Performance</Text>
               </View>
            </View>
          </View>
          <View style={[styles.perfMetricsRow, { borderColor: colors.border }]}>
            <View style={styles.perfMetric}>
              <Text style={[styles.perfMetricLabel, { color: colors.subtext }]}>Total Accepted</Text>
              <Text style={[styles.perfMetricValue, { color: '#10b981' }]}>{globalAccepted}</Text>
            </View>
            <View style={styles.perfMetric}>
              <Text style={[styles.perfMetricLabel, { color: colors.subtext }]}>Total Rejected</Text>
              <Text style={[styles.perfMetricValue, { color: '#ef4444' }]}>{globalRejected}</Text>
            </View>
            <View style={styles.perfMetric}>
              <Text style={[styles.perfMetricLabel, { color: colors.subtext }]}>Total Rework</Text>
              <Text style={[styles.perfMetricValue, { color: '#f59e0b' }]}>{globalRework}</Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={true} style={[styles.tableScrollView, { backgroundColor: colors.card, borderColor: colors.border }]} scrollEventThrottle={16}>
        <View style={styles.tableView}>
          <View style={[styles.tableRowHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <View style={[styles.tableHeaderCell, { width: 100 }]}>
               <Text style={[styles.tableColHeader, { color: colors.text }]}>DISPATCH</Text>
            </View>
            <View style={[styles.tableHeaderCell, { width: 220 }]}>
               <Text style={[styles.tableColHeader, { color: colors.text }]}>ACTIONS</Text>
               <Filter size={8} color={colors.subtext} />
            </View>
            <View style={[styles.tableHeaderCell, { width: 160, marginLeft: 10 }]}>
               <Text style={[styles.tableColHeader, { color: colors.text }]}>SUBMITTED BY</Text>
            </View>
            <View style={[styles.tableHeaderCell, { width: 110 }]}>
               <Text style={[styles.tableColHeader, { color: colors.text }]}>STATUS</Text>
               <Filter size={8} color={colors.subtext} />
            </View>
            <View style={[styles.tableHeaderCell, { width: 220 }]}>
               <Text style={[styles.tableColHeader, { color: colors.text }]}>REVIEW</Text>
               <Filter size={8} color={colors.subtext} />
            </View>
            <View style={[styles.tableHeaderCell, { width: 150 }]}>
               <Text style={[styles.tableColHeader, { color: colors.text }]}>TIMESTAMP</Text>
               <Filter size={8} color={colors.subtext} />
            </View>
            <View style={[styles.tableHeaderCell, { width: 100 }]}>
               <Text style={[styles.tableColHeader, { color: colors.text }]}>TIME TAKEN</Text>
            </View>
            <View style={[styles.tableHeaderCell, { width: 150 }]}>
               <Text style={[styles.tableColHeader, { color: colors.text }]}>CHASSIS NUMBER</Text>
               <Filter size={8} color={colors.subtext} />
            </View>
            
            {realQuestions.map((q, qIdx) => (
              <View key={`h-${qIdx}`} style={[styles.tableHeaderCell, { width: 220, borderLeftWidth: 1, borderLeftColor: colors.border, paddingLeft: 12 }]}>
                <Text style={[styles.tableColHeader, { color: colors.text }]}>
                  {(q.label || q.title || q.text || q.id || 'Question').toUpperCase()}
                </Text>
                <Filter size={8} color={colors.subtext} />
              </View>
            ))}
          </View>

          <View style={[styles.expectedAnswerRow, { backgroundColor: isDark ? colors.surface : '#fff7ed', borderBottomColor: isDark ? colors.border : '#ffedd5' }]}>
            <View style={[styles.tableCell, { width: 100, backgroundColor: isDark ? colors.surface : '#fff7ed' }]}>
                <Text style={[styles.expectedValue, { color: isDark ? colors.text : '#c2410c' }]}>-</Text>
            </View>
            <View style={[styles.tableCell, { width: 220, backgroundColor: isDark ? colors.surface : '#fff7ed' }]}>
                <Text style={[styles.expectedLabel, { color: isDark ? colors.accent : '#9a3412' }]}>EXPECTED ANSWER</Text>
            </View>
            <View style={[styles.tableCell, { width: 160, marginLeft: 10, backgroundColor: isDark ? colors.surface : '#fff7ed' }]}>
                <Text style={[styles.expectedValue, { color: isDark ? colors.text : '#c2410c' }]}>-</Text>
            </View>
            <View style={[styles.tableCell, { width: 110, backgroundColor: isDark ? colors.surface : '#fff7ed' }]}>
                <Text style={[styles.expectedValue, { color: isDark ? colors.text : '#c2410c' }]}>-</Text>
            </View>
            <View style={[styles.tableCell, { width: 220, backgroundColor: isDark ? colors.surface : '#fff7ed' }]}>
                <Text style={[styles.expectedValue, { color: isDark ? colors.text : '#c2410c' }]}>-</Text>
            </View>
            <View style={[styles.tableCell, { width: 150, backgroundColor: isDark ? colors.surface : '#fff7ed' }]}>
                <Text style={[styles.expectedValue, { color: isDark ? colors.text : '#c2410c' }]}>-</Text>
            </View>
            <View style={[styles.tableCell, { width: 100, backgroundColor: isDark ? colors.surface : '#fff7ed' }]}>
                <Text style={[styles.expectedValue, { color: isDark ? colors.text : '#c2410c' }]}>-</Text>
            </View>
            <View style={[styles.tableCell, { width: 150, backgroundColor: isDark ? colors.surface : '#fff7ed' }]}>
                <Text style={[styles.expectedValue, { color: isDark ? colors.text : '#c2410c' }]}>-</Text>
            </View>
            {realQuestions.map((q, qIdx) => (
              <View key={`exp-${qIdx}`} style={[styles.tableCell, { width: 220, backgroundColor: isDark ? colors.surface : '#fff7ed', borderLeftWidth: 1, borderLeftColor: isDark ? colors.border : '#ffedd5' }]}>
                <Text style={[styles.expectedValue, { color: isDark ? colors.text : '#c2410c' }]}>{q.expectedAnswer || '-'}</Text>
              </View>
            ))}
          </View>

          <FlatList
            data={stats.questionInsights?.responses || []}
            keyExtractor={(item: any, index: number) => item._id || item.id || `row-${index}`}
            renderItem={({ item, index }: { item: any, index: number }) => (
              <ResponseRow item={item} index={index} />
            )}
            removeClippedSubviews={true}
            initialNumToRender={10}
            maxToRenderPerBatch={5}
            windowSize={5}
            scrollEnabled={false}
          />
        </View>
      </ScrollView>

      {(stats.questionInsights?.responses || []).length === 0 && (
        <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
          <MessageSquare size={48} color={colors.subtext} />
          <Text style={[styles.emptyText, { color: colors.subtext }]}>No responses yet</Text>
        </View>
      )}
    </View>
  );

  const renderQuestions = () => (
    <View style={[styles.questionsContainer, { backgroundColor: colors.background }]}>
      <View style={[styles.questionsHeaderCard, { backgroundColor: colors.accent }]}>
        <View style={styles.qHeaderTop}>
          <TrendingUp size={20} color="#fff" />
          <Text style={styles.questionsHeaderTitle}>Response Distribution by Question</Text>
        </View>
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

      <Text style={[styles.sectionHeading, { color: colors.text }]}>Performance Heatmap</Text>
      <View style={styles.qHeatmapGrid}>
        {realQuestions.map((q, idx) => {
          const passRate = q.stats.total > 0 ? Math.round((q.stats.yes / q.stats.total) * 100) : 0;
          return (
            <View key={`q-grid-${idx}`} style={[styles.qGridItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.qGridHeader}>
                <Text style={[styles.qGridLabel, { color: colors.subtext }]} numberOfLines={1}>{(q.label || q.title || q.text || 'Q').toUpperCase()}</Text>
                <Text style={[styles.qGridPercent, { color: colors.text }]}>{passRate}%</Text>
              </View>
              <View style={[
                styles.qStatusBadge, 
                { backgroundColor: passRate >= 90 ? (isDark ? '#064e3b' : '#ecfdf5') : passRate >= 70 ? (isDark ? '#7c2d12' : '#fffbeb') : (isDark ? '#450a0a' : '#fef2f2') }
              ]}>
                <Text style={[
                  styles.qStatusText, 
                  { color: passRate >= 90 ? '#059669' : passRate >= 70 ? '#d97706' : '#ef4444' }
                ]}>
                  {passRate >= 90 ? 'EXCELLENT' : passRate >= 70 ? 'STABLE' : 'CRITICAL'}
                </Text>
              </View>
              <View style={[styles.miniProgressContainer, { backgroundColor: colors.border }]}>
                <View style={[styles.miniProgressBar, { width: `${passRate}%`, backgroundColor: passRate >= 70 ? '#10b981' : '#f59e0b' }]} />
              </View>
            </View>
          );
        })}
      </View>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>Distribution Details</Text>
      {realQuestions.map((q, idx) => (
        <View key={q.id || idx} style={[styles.questionCard, { backgroundColor: colors.card, borderColor: colors.border, padding: 16, borderRadius: 16, borderWidth: 1 }]}>
          <View style={styles.qCardHeader}>
            <Text style={[styles.qSectionName, { color: colors.accent }]}>{q.sectionTitle}</Text>
            <Text style={[styles.qResponseCount, { color: colors.subtext }]}>{q.stats.total} responses</Text>
          </View>
          <Text style={[styles.qText, { color: colors.text, marginVertical: 8 }]}>{q.label || q.title || q.text || 'Untitled Question'}</Text>
          
          <View style={styles.distributionContainer}>
            <View style={styles.distRow}>
              <View style={styles.distLabelGroup}>
                <Text style={[styles.distLabel, { color: colors.subtext }]}>YES</Text>
                <Text style={[styles.distValue, { color: colors.text }]}>{q.stats.yes}</Text>
              </View>
              <View style={[styles.distBarBg, { backgroundColor: colors.border }]}>
                <View style={[styles.distBarFill, { 
                  width: q.stats.total > 0 ? `${(q.stats.yes / q.stats.total) * 100}%` : '0%',
                  backgroundColor: '#22c55e' 
                }]} />
              </View>
            </View>

            <View style={styles.distRow}>
              <View style={styles.distLabelGroup}>
                <Text style={[styles.distLabel, { color: colors.subtext }]}>NO</Text>
                <Text style={[styles.distValue, { color: colors.text }]}>{q.stats.no}</Text>
              </View>
              <View style={[styles.distBarBg, { backgroundColor: colors.border }]}>
                <View style={[styles.distBarFill, { 
                  width: q.stats.total > 0 ? `${(q.stats.no / q.stats.total) * 100}%` : '0%',
                  backgroundColor: '#ef4444' 
                }]} />
              </View>
            </View>

            {q.stats.na > 0 && (
              <View style={styles.distRow}>
                <View style={styles.distLabelGroup}>
                  <Text style={[styles.distLabel, { color: colors.subtext }]}>N/A</Text>
                  <Text style={[styles.distValue, { color: colors.text }]}>{q.stats.na}</Text>
                </View>
                <View style={[styles.distBarBg, { backgroundColor: colors.border }]}>
                  <View style={[styles.distBarFill, { 
                    width: q.stats.total > 0 ? `${(q.stats.na / q.stats.total) * 100}%` : '0%',
                    backgroundColor: colors.subtext 
                  }]} />
                </View>
              </View>
            )}
          </View>
        </View>
      ))}

      {realQuestions.length === 0 && (
        <View style={styles.emptyContainer}>
          <Info size={48} color={colors.subtext} />
          <Text style={[styles.emptyText, { color: colors.subtext }]}>No questions found in this form</Text>
        </View>
      )}
    </View>
  );

  const renderSections = () => (
    <>
      {/* Performance Pulse removed as requested */}


      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalStats}>

        <View style={[styles.miniStatCard, { backgroundColor: isDark ? colors.card : '#eff6ff', borderColor: isDark ? colors.border : '#dbeafe' }]}>
          <Text style={[styles.miniStatValue, { color: isDark ? colors.text : '#1e40af' }]}>{realSections.length}</Text>
          <Text style={[styles.miniStatLabel, { color: colors.subtext }]}>Total Sections</Text>
        </View>
        <View style={[styles.miniStatCard, { backgroundColor: isDark ? colors.card : '#f0fdf4', borderColor: isDark ? colors.border : '#dcfce7' }]}>
          <Text style={[styles.miniStatValue, { color: isDark ? colors.text : '#166534' }]}>{totalQsCount}</Text>
          <Text style={[styles.miniStatLabel, { color: colors.subtext }]}>Primary Qs</Text>
        </View>
        <View style={[styles.miniStatCard, { backgroundColor: isDark ? colors.card : '#faf5ff', borderColor: isDark ? colors.border : '#f3e8ff' }]}>
          <Text style={[styles.miniStatValue, { color: isDark ? colors.text : '#6b21a8' }]}>{totalFollowUps}</Text>
          <Text style={[styles.miniStatLabel, { color: colors.subtext }]}>Follow-ups</Text>
        </View>
        <View style={[styles.miniStatCard, { backgroundColor: isDark ? colors.card : '#fff7ed', borderColor: isDark ? colors.border : '#ffedd5' }]}>
          <Text style={[styles.miniStatValue, { color: isDark ? colors.text : '#9a3412' }]}>{stats.totalResponses}</Text>
          <Text style={[styles.miniStatLabel, { color: colors.subtext }]}>Responses</Text>
        </View>
      </ScrollView>
 
      <Text style={[styles.sectionHeading, { color: colors.text }]}>Section Details</Text>
      
      {realSections.map((section: any, idx: number) => (
        <View key={idx} style={[styles.detailedSectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.detailedSectionHeader}>
            <View style={styles.sectionTitleGroup}>
              <View style={[styles.sectionIndexBadge, { backgroundColor: colors.surface }]}>
                <Text style={[styles.sectionIndexText, { color: colors.text }]}>{idx + 1}</Text>
              </View>
              <Text style={[styles.detailedSectionTitle, { color: colors.text }]} numberOfLines={1}>{section.title}</Text>
            </View>
            <View style={[
              styles.scoreBadge, 
              { backgroundColor: section.score >= 90 ? (isDark ? '#064e3b' : '#ecfdf5') : section.score >= 70 ? (isDark ? '#7c2d12' : '#fffbeb') : (isDark ? '#450a0a' : '#fef2f2') }
            ]}>
              <Text style={[
                styles.scoreBadgeText, 
                { color: section.score >= 90 ? '#059669' : section.score >= 70 ? '#d97706' : '#ef4444' }
              ]}>
                {section.score}% {section.score >= 90 ? 'PASSED' : section.score >= 70 ? 'STABLE' : 'CRITICAL'}
              </Text>
            </View>
          </View>

          <View style={styles.detailedStatRow}>
            <View style={styles.detailedStatItem}>
              <Text style={[styles.detailedStatLabel, { color: colors.subtext }]}>Questions</Text>
              <Text style={[styles.detailedStatValue, { color: colors.text }]}>{section.questionCount}</Text>
            </View>
            <View style={[styles.detailedDivider, { backgroundColor: colors.border }]} />
            <View style={styles.detailedStatItem}>
              <Text style={[styles.detailedStatLabel, { color: colors.subtext }]}>Samples</Text>
              <Text style={[styles.detailedStatValue, { color: colors.text }]}>{section.totalAnswers}</Text>
            </View>
            <View style={[styles.detailedDivider, { backgroundColor: colors.border }]} />
            <View style={styles.detailedStatItem}>
              <Text style={[styles.detailedStatLabel, { color: colors.subtext }]}>Weight</Text>
              <Text style={[styles.detailedStatValue, { color: colors.text }]}>{section.weightage || 0}%</Text>
            </View>
          </View>

          <View style={[styles.detailedSectionBarBg, { backgroundColor: colors.border }]}>
            <View style={[styles.detailedSectionBarFill, { width: `100%`, backgroundColor: colors.accent }]} />
          </View>
        </View>
      ))}

      {realSections.length === 0 && (
        <View style={styles.emptyContainer}>
          <PieChart size={48} color={colors.subtext} />
          <Text style={[styles.emptyText, { color: colors.subtext }]}>No section data available</Text>
        </View>
      )}
    </>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft size={24} color={isDark ? colors.text : "#1e3a8a"} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>{title ? `${title} Analytics` : 'Form Analytics'}</Text>
      </View>

      <View style={[styles.tabBar, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarScroll}>
          {!isInspector && (
            <>
              <TouchableOpacity 
                style={[styles.tabItem, activeTab === 'dashboard' && [styles.activeTabItem, { borderBottomColor: colors.accent }]]} 
                onPress={() => switchTab('dashboard')}
              >
                <LayoutDashboard size={18} color={activeTab === 'dashboard' ? colors.accent : colors.subtext} />
                <Text style={[styles.tabText, { color: colors.subtext }, activeTab === 'dashboard' && [styles.activeTabText, { color: colors.text }]]}>Dashboard</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tabItem, activeTab === 'questions' && [styles.activeTabItem, { borderBottomColor: colors.accent }]]} 
                onPress={() => switchTab('questions')}
              >
                <TrendingUp size={18} color={activeTab === 'questions' ? colors.accent : colors.subtext} />
                <Text style={[styles.tabText, { color: colors.subtext }, activeTab === 'questions' && [styles.activeTabText, { color: colors.text }]]}>Questions</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tabItem, activeTab === 'sections' && [styles.activeTabItem, { borderBottomColor: colors.accent }]]} 
                onPress={() => switchTab('sections')}
              >
                <PieChart size={18} color={activeTab === 'sections' ? colors.accent : colors.subtext} />
                <Text style={[styles.tabText, { color: colors.subtext }, activeTab === 'sections' && [styles.activeTabText, { color: colors.text }]]}>Sections</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity 
            style={[styles.tabItem, activeTab === 'responses' && [styles.activeTabItem, { borderBottomColor: colors.accent }]]} 
            onPress={() => switchTab('responses')}
          >
            <MessageSquare size={18} color={activeTab === 'responses' ? colors.accent : colors.subtext} />
            <Text style={[styles.tabText, { color: colors.subtext }, activeTab === 'responses' && [styles.activeTabText, { color: colors.text }]]}>Responses</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: colors.background }}
      >
        {activeTab === 'dashboard' ? renderDashboard() : 
         activeTab === 'questions' ? renderQuestions() : 
         activeTab === 'sections' ? renderSections() : 
         renderResponses()}
      </ScrollView>

      {/* Image Zoom Modal */}
      <Modal
        visible={isZoomVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsZoomVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalCloseArea}
            onPress={() => setIsZoomVisible(false)}
          />
          <View style={styles.zoomModalContent}>
            <TouchableOpacity 
              style={styles.zoomCloseBtn}
              onPress={() => setIsZoomVisible(false)}
            >
              <X size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.zoomImageContainer}>
              {zoomImage && (
                <>
                  <View style={styles.zoomLoadingIndicator}>
                    <ActivityIndicator size="large" color="#fff" />
                  </View>
                  <Image 
                    source={{ uri: zoomImage }} 
                    style={styles.fullImage}
                    resizeMode="contain"
                  />
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>
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
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tabBarScroll: {
    paddingHorizontal: 16,
  },
  tabItem: {
    flex: 1,
    minWidth: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginRight: 16,
    gap: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabItem: {
    borderBottomColor: '#1e3a8a',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  activeTabText: {
    color: '#1e3a8a',
    fontWeight: '800',
  },
  dashboardContainer: {
    gap: 16,
  },
  liveIndicatorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  liveText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#059669',
    letterSpacing: 0.5,
  },
  lastUpdatedText: {
    fontSize: 9,
    color: '#94a3b8',
    fontWeight: '700',
  },
  heroStatsRow: {

    flexDirection: 'row',
    gap: 12,
  },
  heroCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  heroValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 8,
  },
  heroTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#22c55e',
  },
  statusDistributionCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  cardTitlePremium: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 20,
  },
  donutPlaceholder: {
    gap: 20,
  },
  qualityLegendGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legendItem: {
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  legendValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  compositionBar: {
    height: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  compositionFill: {
    height: '100%',
  },
  insightsCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 16,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  insightIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  insightSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  responsesContainer: {
    gap: 12,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  listHeaderTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  listHeaderSub: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: 2,
  },
  premiumRespCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  respLeading: {
    marginRight: 16,
  },
  respNumberBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  respNumberText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4f46e5',
  },
  respContent: {
    flex: 1,
  },
  respHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  detailsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1e293b',
  },
  respUserText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1e293b',
    flex: 1,
    marginRight: 8,
  },
  respMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  respDateText: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '600',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },


  respTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  respChatBtn: {
    padding: 8,
    backgroundColor: '#eff6ff',
    borderRadius: 10,
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
  noHistoryText: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 10,
    fontStyle: 'italic'
  },
  webParityGrid: {
    gap: 16,
  },
  webParityCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  webParityCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  webIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webParityCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e293b',
  },
  webParityCardSub: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '700',
    marginTop: 1,
  },
  trendVisualContainer: {
    height: 150,
    justifyContent: 'flex-end',
    paddingTop: 10,
  },
  trendChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    flex: 1,
  },
  trendBarCol: {
    width: '12%',
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  trendBar: {
    width: 6,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 3,
  },
  trendLineDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3b82f6',
    borderWidth: 2,
    borderColor: '#fff',
    zIndex: 2,
  },
  trendLabel: {
    fontSize: 8,
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: 8,
  },
  heatmapPlaceholder: {
    height: 180,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    overflow: 'hidden',
  },
  mockMap: {
    flex: 1,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapMarker: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(34, 197, 94, 0.4)',
    borderWidth: 2,
    borderColor: '#22c55e',
  },
  mapHint: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '700',
    backgroundColor: 'rgba(255,255,255,0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  qualityCircleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 10,
  },
  qualityDonut: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 12,
    borderColor: '#f1f5f9',
    borderTopColor: '#8b5cf6',
    borderRightColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qualityPercent: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1e293b',
  },
  qualityLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 1,
  },
  qualityLegendList: {
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dotSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
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
  },
  formPerformanceBoard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  perfPulseItem: {
    flex: 1,
    alignItems: 'center',
  },
  perfPulseLabel: {
    fontSize: 7,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  perfPulseValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  perfPulseValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  perfPulseDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#f1f5f9',
  },
  answerSummaryBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  defectList: {
    marginTop: 12,
    gap: 16,
  },
  defectRow: {
    gap: 6,
  },
  defectLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  defectLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    flex: 1,
    marginRight: 12,
  },
  defectValue: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1e293b',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  responsesTableHeader: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2
  },
  tableHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc'
  },
  tableHeaderTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  tableHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a'
  },
  tableActions: {
    flexDirection: 'row',
    gap: 8
  },
  tableMiniBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center'
  },
  tablePerformanceBoard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9'
  },
  perfItem: {
    marginBottom: 12
  },
  perfItemHeader: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  perfItemLabel: {
    fontSize: 7,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 0.5
  },
  perfItemTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1e293b',
    marginTop: -2
  },
  perfMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
  },
  perfMetric: {
    alignItems: 'center'
  },
  perfMetricLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 2
  },
  perfMetricValue: {
    fontSize: 14,
    fontWeight: '900'
  },
  tableScrollView: {
    marginTop: 10,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    overflow: 'hidden',
  },
  tableView: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  tableRowHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  tableColHeader: {
    fontSize: 9,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  tableHeaderCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
    alignItems: 'center',
  },
  tableCell: {
    paddingRight: 10,
    flexShrink: 0,
  },
  tableTextMain: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1e293b',
  },
  tableTextSub: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  statusBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusBadgeTextSmall: {
    fontSize: 8,
    fontWeight: '900',
  },
  summaryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    gap: 4,
  },
  summaryTagKey: {
    fontSize: 8,
    fontWeight: '800',
    color: '#94a3b8',
  },
  summaryTagVal: {
    fontSize: 9,
    fontWeight: '700',
    color: '#4f46e5',
  },
  questionCell: {
    gap: 8,
    paddingVertical: 8,
  },
  cellDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cellQuestionLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1e3a8a',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  typeBadgeSmall: {
    alignSelf: 'flex-start',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 4,
  },
  typeBadgeTextSmall: {
    fontSize: 7,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  miniLabel: {
    fontSize: 7,
    fontWeight: '900',
    color: '#64748b',
    textTransform: 'uppercase',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  miniBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
  },
  miniBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
  },
  zoneValue: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  evidenceRow: {
    gap: 4,
  },
  evidenceThumb: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  expectedAnswerRow: {
    flexDirection: 'row',
    backgroundColor: '#fff7ed',
    borderBottomWidth: 1,
    borderBottomColor: '#ffedd5',
    paddingHorizontal: 8,
    alignItems: 'center',
    height: 44,
  },
  expectedLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#9a3412',
    letterSpacing: 0.5,
  },
  expectedValue: {
    fontSize: 10,
    fontWeight: '700',
    color: '#c2410c',
  },
  tableCheckbox: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    marginRight: 4,
  },
  dispatchCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dispatchCheckboxChecked: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
  },
  actionIconBtn: {
    padding: 6,
    backgroundColor: '#eff6ff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  questionsContainer: {
    gap: 16,
  },
  qHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  qHeatmapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  qGridItem: {
    width: (width - 42) / 2,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  qGridHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  qGridLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
    flex: 1,
    marginRight: 4,
  },
  qGridPercent: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0f172a',
  },
  qStatusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 10,
  },
  qStatusText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  miniProgressContainer: {
    height: 4,
    backgroundColor: '#f1f5f9',
    borderRadius: 2,
    overflow: 'hidden',
  },
  miniProgressBar: {
    height: '100%',
    borderRadius: 2,
  },
  timeTakenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  zoomModalContent: {
    width: '90%',
    height: '80%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomCloseBtn: {
    position: 'absolute',
    top: -40,
    right: 0,
    padding: 10,
    zIndex: 10,
  },
  fullImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  infoIconBtn: {
    padding: 6,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  zoomImageContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomLoadingIndicator: {
    position: 'absolute',
    zIndex: -1,
  },
  cellImageWrapper: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  cellImageThumbnail: {
    width: '100%',
    height: '100%',
  },
  reviewContent: {
    paddingVertical: 4,
    gap: 6,
  },
  reworkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  reworkBadge: {
    backgroundColor: '#fff7ed',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  reworkBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#d97706',
  },
  reworkInspector: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '600',
  },
  reviewTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  reviewTag: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  reviewTagText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#475569',
  },
  chassisBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  chassisBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1e40af',
  },
});



export default FormAnalyticsScreen;
