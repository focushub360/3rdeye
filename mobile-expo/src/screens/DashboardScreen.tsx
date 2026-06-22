import React, { useState, useCallback, useEffect } from 'react';
import { io } from 'socket.io-client';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  LogOut, 
  User, 
  LayoutDashboard, 
  Database, 
  TrendingUp, 
  Users, 
  ClipboardCheck, 
  AlertCircle,
  ArrowRight,
  History,
  Clock,
  CalendarCheck,
  CloudOff,
  CloudSync,
  Wifi,
  WifiOff,
  CheckCircle,
  ShieldCheck,
  ShieldAlert,
  X,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { offlineQueue, QueueProgressInfo } from '../api/OfflineQueue';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';


import { useFocusEffect, useNavigation } from '@react-navigation/native';
import apiClient, { checkServerReachability } from '../api/config';
import Svg, { Circle } from 'react-native-svg';

const { width } = Dimensions.get('window');

const DashboardScreen = () => {
  const { user, logout, isCheckedIn } = useAuth();
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const [performance, setPerformance] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({ totalForms: 0, accepted: 0, rejected: 0, rework: 0 });
  const [inspectorSummary, setInspectorSummary] = useState<any[]>([]);
  const [summaryStatuses, setSummaryStatuses] = useState<string[]>([]);
  const [performanceTableData, setPerformanceTableData] = useState<any[]>([]);
  const [myReviewStats, setMyReviewStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingItems, setPendingItems] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ percent: number, filename: string, statusText?: string } | null>(null);
  const [initialSyncCount, setInitialSyncCount] = useState(0);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [netStatus, setNetStatus] = useState<{
    isConnected: boolean | null;
    type: string | null;
  }>({ isConnected: null, type: null });
  const [cardUploadProgress, setCardUploadProgress] = useState<Record<string, { percent: number, statusText: string }>>({});

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setNetStatus({
        isConnected: state.isConnected,
        type: state.type,
      });
    });
    return () => unsubscribe();
  }, []);

  const handleDeletePendingItem = async (id: string) => {
    Alert.alert(
      'Discard Request',
      'Are you sure you want to discard this offline queued request? This will permanently delete the unsaved data.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Discard', 
          style: 'destructive',
          onPress: async () => {
            await offlineQueue.removeFromQueue(id);
            const queue = await offlineQueue.getQueue();
            setPendingItems(queue || []);
            if (expandedItemId === id) {
              setExpandedItemId(null);
            }
            if (!queue || queue.length === 0) {
              setShowPendingModal(false);
            }
          }
        }
      ]
    );
  };

  const getPendingItemTitle = (item: any) => {
    if (item.formId) return 'Inspection Report';
    if (item.endpoint === 'hr/attendance/checkin') return 'Shift Check-In';
    if (item.endpoint === 'hr/attendance/checkout') return 'Shift Check-Out';
    if (item.endpoint === 'hr/leaves/apply') return 'Leave Request';
    if (item.endpoint === 'hr/permissions/apply') return 'Permission / Gate Pass';
    return `API Request (${item.endpoint || 'Unknown'})`;
  };

  const getPendingItemSummary = (item: any) => {
    if (item.formId) {
      return `Chassis: ${item.payload?.chassisNumber || item.payload?.answers?.q1 || 'N/A'}`;
    }
    if (item.endpoint === 'hr/attendance/checkin') {
      return `Accuracy: ${item.payload?.accuracy ? `${item.payload.accuracy.toFixed(1)}m` : 'N/A'}`;
    }
    if (item.endpoint === 'hr/attendance/checkout') {
      const time = item.payload?.offlineTime ? new Date(item.payload.offlineTime).toLocaleTimeString() : 'N/A';
      return `Time: ${time}`;
    }
    if (item.endpoint === 'hr/leaves/apply') {
      return `${item.payload?.leaveType?.toUpperCase() || 'Sick'} (${item.payload?.startDate} to ${item.payload?.endDate})`;
    }
    if (item.endpoint === 'hr/permissions/apply') {
      return `${item.payload?.type?.toUpperCase() || 'Gate Pass'} (${item.payload?.startTime} - ${item.payload?.endTime})`;
    }
    return `Method: ${item.method || 'POST'}`;
  };

  const renderItemDetailsList = (item: any) => {
    const payload = item.payload || {};
    const details = [];

    if (item.formId) {
      details.push({ label: 'Form ID', value: item.formId });
      details.push({ label: 'Chassis No', value: payload.chassisNumber || 'N/A' });
      details.push({ label: 'Started At', value: payload.startedAt ? new Date(payload.startedAt).toLocaleString() : 'N/A' });
      details.push({ label: 'Completed At', value: payload.completedAt ? new Date(payload.completedAt).toLocaleString() : 'N/A' });
      
      const numQuestions = payload.answers ? Object.keys(payload.answers).length : 0;
      details.push({ label: 'Questions Filled', value: numQuestions.toString() });
    } else if (item.endpoint === 'hr/attendance/checkin' || item.endpoint === 'hr/attendance/checkout') {
      details.push({ label: 'Latitude', value: payload.latitude || payload.lat || 'N/A' });
      details.push({ label: 'Longitude', value: payload.longitude || payload.lng || 'N/A' });
      details.push({ label: 'Accuracy', value: payload.accuracy ? `${payload.accuracy.toFixed(2)} meters` : 'N/A' });
      if (payload.offlineTime) {
        details.push({ label: 'Offline Timestamp', value: new Date(payload.offlineTime).toLocaleString() });
      }
    } else if (item.endpoint === 'hr/leaves/apply') {
      details.push({ label: 'Leave Type', value: payload.leaveType || 'N/A' });
      details.push({ label: 'Start Date', value: payload.startDate || 'N/A' });
      details.push({ label: 'End Date', value: payload.endDate || 'N/A' });
      details.push({ label: 'Reason', value: payload.reason || 'N/A' });
    } else if (item.endpoint === 'hr/permissions/apply') {
      details.push({ label: 'Permission Type', value: payload.type || 'N/A' });
      details.push({ label: 'Date', value: payload.date || 'N/A' });
      details.push({ label: 'Start Time', value: payload.startTime || 'N/A' });
      details.push({ label: 'End Time', value: payload.endTime || 'N/A' });
      details.push({ label: 'Reason', value: payload.reason || 'N/A' });
    } else {
      details.push({ label: 'Endpoint', value: item.endpoint || 'N/A' });
      details.push({ label: 'Method', value: item.method || 'N/A' });
    }

    return (
      <View style={[styles.detailContainer, { backgroundColor: isDark ? colors.surface : '#f8fafc', borderColor: colors.border }]}>
        {details.map((d, index) => (
          <View key={index} style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.subtext }]}>{d.label}:</Text>
            <Text style={[styles.detailVal, { color: colors.text }]}>{d.value}</Text>
          </View>
        ))}
        <TouchableOpacity 
          style={styles.jsonToggle} 
          onPress={() => {
            Alert.alert(
              'Raw Request Payload',
              JSON.stringify(payload, null, 2),
              [{ text: 'Close' }],
              { cancelable: true }
            );
          }}
        >
          <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '700' }}>VIEW RAW PAYLOAD (JSON)</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'subadmin' || user?.role === 'lmadmin' || user?.role === 'manager';

  const fetchData = async (isBackground = false) => {
    const userId = user?._id || user?.id;
    try {
      if (!isBackground) setLoading(true);

      // Check network connectivity first
      const netState = await NetInfo.fetch();
      if (netState.isConnected) {
        await checkServerReachability();
      }
      if (!netState.isConnected) {
        console.log('[Dashboard] Device is offline. Loading cached metrics.');
        try {
          const cachedOverview = await AsyncStorage.getItem(`@cached_dashboard_overview_${userId}`);
          const cachedSummary = await AsyncStorage.getItem(`@cached_dashboard_summary_${userId}`);
          const cachedReviewStats = await AsyncStorage.getItem(`@cached_dashboard_review_stats_${userId}`);
          const cachedPerformance = await AsyncStorage.getItem(`@cached_dashboard_performance_${userId}`);
          const cachedStatuses = await AsyncStorage.getItem(`@cached_dashboard_statuses_${userId}`);
          
          if (cachedOverview) setSummary(JSON.parse(cachedOverview));
          if (cachedSummary) setInspectorSummary(JSON.parse(cachedSummary));
          if (cachedReviewStats) setMyReviewStats(JSON.parse(cachedReviewStats));
          if (cachedPerformance) setPerformance(JSON.parse(cachedPerformance));
          if (cachedStatuses) setSummaryStatuses(JSON.parse(cachedStatuses));
          
          if (isAdmin) {
            const cachedTable = await AsyncStorage.getItem(`@cached_dashboard_table_${userId}`);
            if (cachedTable) setPerformanceTableData(JSON.parse(cachedTable));
          }
        } catch (cacheErr) {
          console.error('Failed to load cached dashboard data:', cacheErr);
        }
        
        // Check offline queue status
        const queue = await offlineQueue.getQueue();
        setPendingItems(queue || []);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      
      const apiCalls = [
        apiClient.get('/analytics/dashboard'),
        apiClient.get('/analytics/inspector-summary'),
        apiClient.get('/analytics/my-review-stats')
      ];

      if (isAdmin) {
        apiCalls.push(apiClient.get('/analytics/performance-table'));
      }

      const results = await Promise.allSettled(apiCalls);
      
      const perfRes = results[0].status === 'fulfilled' ? (results[0] as PromiseFulfilledResult<any>).value : null;
      const summaryRes = results[1].status === 'fulfilled' ? (results[1] as PromiseFulfilledResult<any>).value : null;
      const reviewStatsRes = results[2].status === 'fulfilled' ? (results[2] as PromiseFulfilledResult<any>).value : null;
      const tableRes = isAdmin && results[3]?.status === 'fulfilled' ? (results[3] as PromiseFulfilledResult<any>).value : null;

      if (perfRes?.data?.success) {
        if (perfRes.data.data.overview) {
          const overview = perfRes.data.data.overview;
          const dist = perfRes.data.data.statusDistribution || {};
          const summaryData = {
            totalForms: overview.totalForms || 0,
            accepted: (dist.verified || 0) + (dist['Direct Ok'] || 0) + (dist.Accepted || 0) + (dist.OK || 0),
            rejected: dist.Rejected || dist.rejected || 0,
            rework: (dist.Rework || 0) + (dist['Rework Required'] || 0) + (dist.rework || 0),
            defectDistribution: perfRes.data.data.defectDistribution || [],
          };
          setSummary(summaryData);
          await AsyncStorage.setItem(`@cached_dashboard_overview_${userId}`, JSON.stringify(summaryData));
        }
        setPerformance(perfRes.data.data.topForms || []);
        await AsyncStorage.setItem(`@cached_dashboard_performance_${userId}`, JSON.stringify(perfRes.data.data.topForms || []));
      }

      if (summaryRes?.data?.success) {
        const summaryData = summaryRes.data.data.summary || [];
        const statuses = summaryRes.data.data.allStatuses || [];
        setInspectorSummary(summaryData);
        setSummaryStatuses(statuses);
        await AsyncStorage.setItem(`@cached_dashboard_summary_${userId}`, JSON.stringify(summaryData));
        await AsyncStorage.setItem(`@cached_dashboard_statuses_${userId}`, JSON.stringify(statuses));
      }

      if (reviewStatsRes?.data?.success) {
        setMyReviewStats(reviewStatsRes.data.data);
        await AsyncStorage.setItem(`@cached_dashboard_review_stats_${userId}`, JSON.stringify(reviewStatsRes.data.data));
      }

      if (isAdmin && tableRes?.data?.success) {
        setPerformanceTableData(tableRes.data.data || []);
        await AsyncStorage.setItem(`@cached_dashboard_table_${userId}`, JSON.stringify(tableRes.data.data || []));
      }

      // Check offline queue status
      const queue = await offlineQueue.getQueue();
      setPendingItems(queue || []);
    } catch (error) {
      console.error('Dashboard fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleManualSync = async () => {
    const queue = await offlineQueue.getQueue();
    if (queue.length === 0) return;
    
    setInitialSyncCount(queue.length);
    setIsSyncing(true);
    setSyncProgress(null);
    try {
      await checkServerReachability(true); // Force reachability check right before manual sync
      const result = await offlineQueue.processQueue();
      const finalQueue = await offlineQueue.getQueue();
      setPendingItems(finalQueue || []);
      
      if (result && result.success) {
        setShowPendingModal(false);
        Alert.alert(
          'Sync Success',
          'All offline items have been uploaded successfully, reflecting immediately in the web portal.'
        );
      } else {
        const failedCount = finalQueue.length;
        const successCount = queue.length - failedCount;
        const errorList = result && result.errors && result.errors.length > 0 
          ? `\n\nErrors:\n• ${result.errors.join('\n• ')}`
          : '';
        Alert.alert(
          'Sync Incomplete',
          `Successfully synced ${successCount} item(s). ${failedCount} item(s) failed to sync. Please check your network connection and try again.${errorList}`
        );
      }
    } catch (error) {
      console.error('Manual sync failed:', error);
      Alert.alert(
        'Sync Error',
        'An unexpected error occurred during synchronization. Please try again.'
      );
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
      setInitialSyncCount(0);
    }
  };

  useFocusEffect(
    useCallback(() => {
      // First load fetches in background so the UI doesn't blank out on tab switch
      fetchData(Object.keys(summary).length > 0);
      
      const checkQueue = async () => {
        const queue = await offlineQueue.getQueue();
        setPendingItems(queue || []);
      };
      checkQueue();

      // Listen for background sync updates
      offlineQueue.setCallback((count, progressInfo, isProcessing) => {
        checkQueue();
        if (isProcessing !== undefined) {
          setIsSyncing(isProcessing);
        }
        if (progressInfo) {
          setSyncProgress(progressInfo);
          if (progressInfo.itemId) {
            setCardUploadProgress(prev => ({
              ...prev,
              [progressInfo.itemId!]: {
                percent: progressInfo.percent,
                statusText: progressInfo.statusText || ''
              }
            }));
          }
        } else {
          setSyncProgress(null);
          if (!isProcessing) {
            setCardUploadProgress({});
          }
        }
      });

      // Socket real-time integration
      const SOCKET_URL = apiClient.defaults.baseURL?.replace('/api', '') || '';
      const socket = io(SOCKET_URL);

      socket.on('connect', () => {
        console.log('✅ Dashboard connected to socket');
        socket.emit('join-dashboard-analytics');
      });

      socket.on('response-created', (data: any) => {
        console.log('🔔 Live Update: New response received, refreshing dashboard');
        fetchData(true);
        checkQueue();
      });

      socket.on('response-updated', () => { fetchData(true); checkQueue(); });
      socket.on('response-deleted', () => { fetchData(true); checkQueue(); });

      return () => {
        socket.disconnect();
        offlineQueue.setCallback(() => {});
      };
    }, [])
  );


  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, []);

  const totalForms = summary.totalForms || 0;
  const totalAccepted = summary.accepted || 0;
  const totalRejected = summary.rejected || 0;
  const totalRework = summary.rework || 0;
  const isInitialLoading = loading && !refreshing && Object.keys(summary).length === 0;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <ScrollView 
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Stylized Greeting Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={[styles.logoCircleBox, { backgroundColor: isDark ? colors.card : '#fff', borderColor: colors.border }]}>
              <Image 
                source={require('../../assets/header_logo.png')} 
                style={styles.headerLogoImage} 
                resizeMode="contain"
              />
            </View>
            <View>
              <Text style={[styles.greetingText, { color: colors.subtext }]}>
                <Text style={[styles.greetingBold, { color: colors.text }]}>{getGreeting()}</Text>,
              </Text>
              <Text style={[styles.userNameText, { color: colors.subtext }]}>{user?.name?.split(' ')[0] || user?.username || 'Inspector'}</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={[styles.profileCircle, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => navigation.navigate('Account')}
          >
            <Text style={[styles.profileInitial, { color: colors.accent }]}>
              {user?.name ? user.name[0] : ((user as any)?.firstName ? (user as any).firstName[0] : 'A')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Real-time Network Connection Status Bar */}
        <View style={styles.networkStatusWrapper}>
          <View style={[
            styles.networkStatusBar, 
            { 
              backgroundColor: netStatus.isConnected ? (isDark ? 'rgba(34, 197, 94, 0.1)' : '#f0fdf4') : (isDark ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2'),
              borderColor: netStatus.isConnected ? (isDark ? 'rgba(34, 197, 94, 0.2)' : '#bbf7d0') : (isDark ? 'rgba(239, 68, 68, 0.2)' : '#fecaca')
            }
          ]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {netStatus.isConnected ? (
                <Wifi size={14} color={isDark ? '#4ade80' : '#15803d'} />
              ) : (
                <WifiOff size={14} color={isDark ? '#f87171' : '#b91c1c'} />
              )}
              <Text style={[
                styles.networkStatusText, 
                { color: netStatus.isConnected ? (isDark ? '#4ade80' : '#15803d') : (isDark ? '#f87171' : '#b91c1c') }
              ]}>
                {netStatus.isConnected 
                  ? `SYSTEM ONLINE (${netStatus.type === 'wifi' ? 'WIFI' : netStatus.type === 'cellular' ? 'CELLULAR' : netStatus.type ? netStatus.type.toUpperCase() : 'CONNECTED'})`
                  : 'SYSTEM OFFLINE (FORM DATA WILL BE QUEUED)'}
              </Text>
            </View>
          </View>
        </View>

        {/* Clean Sync Pill */}
        {(pendingItems.length > 0 || isSyncing) && (
          <View style={styles.syncWrapper}>
             <TouchableOpacity 
               activeOpacity={0.7}
               onPress={() => setShowPendingModal(true)}
               style={[styles.syncPill, { backgroundColor: colors.card, borderColor: isSyncing ? colors.accent : colors.error }]}
             >
                <View style={[styles.syncDot, { backgroundColor: isSyncing ? colors.accent : colors.error }]} />
                <Text style={[styles.syncPillText, { color: colors.subtext }]}>
                   {isSyncing 
                     ? (syncProgress ? `SYNCING: ${syncProgress.percent}% (${syncProgress.filename})` : 'SYNCING UPLOADS...')
                     : `${pendingItems.length} PENDING UPLOADS (TAP TO VIEW)`
                   }
                </Text>
                <View style={styles.syncMiniBtn}>
                   {isSyncing ? <ActivityIndicator size="small" color={colors.accent} /> : <CloudSync size={14} color={colors.accent} />}
                </View>
             </TouchableOpacity>
          </View>
        )}

        {user?.role === 'superadmin' && (
          <TouchableOpacity 
            style={[styles.superadminBanner, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => navigation.navigate('SuperAdminPerformance')}
          >
            <View style={styles.superadminBannerLeft}>
              <ShieldAlert size={18} color={colors.accent} />
              <View style={{ marginLeft: 12 }}>
                <Text style={[styles.superadminBannerTitle, { color: colors.text }]}>SuperAdmin Portal</Text>
                <Text style={[styles.superadminBannerSub, { color: colors.subtext }]}>Cross-Tenant Analytics</Text>
              </View>
            </View>
            <ArrowRight size={16} color={colors.subtext} />
          </TouchableOpacity>
        )}

        <View style={styles.content}>
          {isInitialLoading ? (
            <View style={[styles.centered, { marginTop: 100 }]}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          ) : (
            <>
              {/* Clean Review Performance (Simplified) */}
              {myReviewStats && (
                <View style={[styles.cleanCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.cardHeader}>
                    <ShieldCheck size={16} color={colors.subtext} />
                    <Text style={[styles.cardTitle, { color: colors.subtext }]}>REVIEW PERFORMANCE</Text>
                  </View>
                  
                  <View style={styles.scoreBoard}>
                    <View>
                       <Text style={[styles.scoreLarge, { color: colors.text }]}>{myReviewStats.performanceScore}%</Text>
                       <Text style={[styles.scoreLabel, { color: colors.subtext }]}>Current Quality Score</Text>
                    </View>
                    <View style={[styles.vDivider, { backgroundColor: colors.border }]} />
                    <View>
                       <Text style={[styles.scoreLarge, { color: colors.text }]}>{myReviewStats.reviewed}</Text>
                       <Text style={[styles.scoreLabel, { color: colors.subtext }]}>Total Reviews</Text>
                    </View>
                  </View>

                  <View style={styles.minimalProgressContainer}>
                    <View style={styles.miniProgressRow}>
                       <Text style={[styles.miniProgressLabel, { color: colors.text }]}>Accepted</Text>
                       <Text style={[styles.miniProgressValue, { color: colors.text }]}>{myReviewStats.accepted}</Text>
                    </View>
                    <View style={[styles.miniProgressBarBg, { backgroundColor: colors.surface }]}>
                       <View style={[styles.miniProgressBarFill, { width: `${myReviewStats.reviewed > 0 ? (myReviewStats.accepted / myReviewStats.reviewed) * 100 : 0}%`, backgroundColor: colors.accent }]} />
                    </View>

                    <View style={[styles.miniProgressRow, { marginTop: 12 }]}>
                       <Text style={[styles.miniProgressLabel, { color: colors.text }]}>Needs Attention</Text>
                       <Text style={[styles.miniProgressValue, { color: colors.text }]}>{(myReviewStats.rejected || 0) + (myReviewStats.rework || 0)}</Text>
                    </View>
                    <View style={[styles.miniProgressBarBg, { backgroundColor: colors.surface }]}>
                       <View style={[styles.miniProgressBarFill, { width: `${myReviewStats.reviewed > 0 ? (( (myReviewStats.rejected || 0) + (myReviewStats.rework || 0)) / myReviewStats.reviewed) * 100 : 0}%`, backgroundColor: colors.subtext }]} />
                    </View>
                  </View>
                </View>
              )}

              {/* Defect Distribution (Cleaned) */}
              {(summary.defectDistribution && summary.defectDistribution.length > 0) && (
                <View style={[styles.cleanCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.cardHeader}>
                    <AlertCircle size={16} color={colors.subtext} />
                    <Text style={[styles.cardTitle, { color: colors.subtext }]}>TOP QUALITY ISSUES</Text>
                  </View>
                  <View style={styles.defectListMinimal}>
                    {summary.defectDistribution.slice(0, 3).map((defect: any, idx: number) => (
                      <View key={idx} style={[styles.defectRowMinimal, { borderBottomColor: colors.surface }]}>
                        <Text style={[styles.defectLabelMinimal, { color: colors.subtext }]} numberOfLines={1}>{defect.label.toUpperCase()}</Text>
                        <Text style={[styles.defectCountMinimal, { color: colors.text }]}>{defect.count}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Inspection Summary (Detailed Table - Web Parity) */}
              {inspectorSummary.length > 0 && (
                <View style={[styles.tableCardDetailed, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.cardHeader}>
                    <Database size={16} color={colors.subtext} />
                    <Text style={[styles.cardTitle, { color: colors.subtext }]}>INSPECTION SUMMARY TABLE</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.detailedTable}>
                      <View style={[styles.detailedTableHeader, { borderBottomColor: colors.border }]}>
                        <Text style={[styles.detailedHeadText, { width: 140, color: colors.subtext }]}>INSPECTOR</Text>
                        <Text style={[styles.detailedHeadText, { width: 120, color: colors.subtext }]}>TENANT</Text>
                        <Text style={[styles.detailedHeadText, { width: 100, color: colors.subtext }]}>DATE</Text>
                        <Text style={[styles.detailedHeadText, { width: 80, textAlign: 'center', color: colors.subtext }]}>TOTAL</Text>
                        {summaryStatuses.map(status => (
                          <Text key={status} style={[styles.detailedHeadText, { width: 90, textAlign: 'center', color: colors.subtext }]}>{status.toUpperCase()}</Text>
                        ))}
                      </View>
                      {inspectorSummary.map((row, idx) => (
                        <View key={idx} style={[styles.detailedTableRow, { borderBottomColor: colors.surface }, idx % 2 === 1 && { backgroundColor: isDark ? '#1e293b' : '#fcfcfc' }]}>
                          <Text style={[styles.detailedRowText, { width: 140, fontWeight: '700', color: colors.text }]} numberOfLines={1}>{row.qcInspector}</Text>
                          <Text style={[styles.detailedRowText, { width: 120, color: colors.text }]} numberOfLines={1}>{row.tenantName}</Text>
                          <Text style={[styles.detailedRowText, { width: 100, color: colors.text }]}>{row.date}</Text>
                          <Text style={[styles.detailedRowText, { width: 80, textAlign: 'center', fontWeight: '900', color: colors.text }]}>{row.totalInspection}</Text>
                          {summaryStatuses.map(status => (
                            <Text 
                              key={status} 
                              style={[
                                styles.detailedRowText, 
                                { width: 90, textAlign: 'center', fontWeight: '800' },
                                { color: status === 'Direct Ok' || status === 'Accepted' ? colors.accent : colors.subtext }
                              ]}
                            >
                              {row.statusCounts?.[status] || 0}
                            </Text>
                          ))}
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}

              {/* Performance Table (Detailed - Admin only) */}
              {(isAdmin && performanceTableData.length > 0) && (
                <View style={[styles.tableCardDetailed, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.cardHeader}>
                    <TrendingUp size={16} color={colors.subtext} />
                    <Text style={[styles.cardTitle, { color: colors.subtext }]}>USER PERFORMANCE TABLE</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.detailedTable}>
                      <View style={[styles.detailedTableHeader, { borderBottomColor: colors.border }]}>
                        <Text style={[styles.detailedHeadText, { width: 140, color: colors.subtext }]}>NAME</Text>
                        <Text style={[styles.detailedHeadText, { width: 90, textAlign: 'center', color: colors.subtext }]}>SUBMITTED</Text>
                        <Text style={[styles.detailedHeadText, { width: 90, textAlign: 'center', color: colors.subtext }]}>REVIEWED</Text>
                        <Text style={[styles.detailedHeadText, { width: 80, textAlign: 'center', color: colors.subtext }]}>ACCEPTED</Text>
                        <Text style={[styles.detailedHeadText, { width: 80, textAlign: 'center', color: colors.subtext }]}>REJECTED</Text>
                        <Text style={[styles.detailedHeadText, { width: 80, textAlign: 'center', color: colors.subtext }]}>REWORK</Text>
                        <Text style={[styles.detailedHeadText, { width: 80, textAlign: 'center', color: colors.subtext }]}>SCORE</Text>
                      </View>
                      {performanceTableData.map((row, idx) => (
                        <View key={idx} style={[styles.detailedTableRow, { borderBottomColor: colors.surface }, idx % 2 === 1 && { backgroundColor: isDark ? '#1e293b' : '#fcfcfc' }]}>
                          <Text style={[styles.detailedRowText, { width: 140, fontWeight: '700', color: colors.text }]} numberOfLines={1}>{row.name}</Text>
                          <Text style={[styles.detailedRowText, { width: 90, textAlign: 'center', color: colors.text }]}>{row.totalSubmitted}</Text>
                          <Text style={[styles.detailedRowText, { width: 90, textAlign: 'center', color: colors.text }]}>{row.totalReviewed}</Text>
                          <Text style={[styles.detailedRowText, { width: 80, textAlign: 'center', color: colors.accent }]}>{row.accepted}</Text>
                          <Text style={[styles.detailedRowText, { width: 80, textAlign: 'center', color: colors.text }]}>{row.rejected}</Text>
                          <Text style={[styles.detailedRowText, { width: 80, textAlign: 'center', color: colors.text }]}>{row.rework}</Text>
                          <View style={{ width: 80, alignItems: 'center' }}>
                             <Text style={[styles.detailedRowText, { fontWeight: '900', color: row.performanceScore >= 80 ? colors.accent : colors.text }]}>{row.performanceScore}%</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}

              {/* Quick Actions (Minimal) */}
              {!isAdmin && (
                <View style={styles.actionsGridMinimal}>
                  <TouchableOpacity 
                    style={[styles.actionBtnMinimal, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => {
                      if (!isAdmin && !isCheckedIn) {
                        Alert.alert("Attendance Required", "Please check-in first.");
                        return;
                      }
                      navigation.navigate('Forms');
                    }}
                  >
                    <ClipboardCheck size={20} color={colors.accent} />
                    <Text style={[styles.actionBtnTextMinimal, { color: colors.text }]}>Inspections</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtnMinimal, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => navigation.navigate('Attendance')}>
                    <Clock size={20} color={colors.accent} />
                    <Text style={[styles.actionBtnTextMinimal, { color: colors.text }]}>Attendance</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Pending Uploads Modal */}
      <Modal
        visible={showPendingModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPendingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <CloudSync size={20} color={colors.accent} />
                <Text style={[styles.modalTitleText, { color: colors.text }]}>Pending Uploads Queue</Text>
              </View>
              <TouchableOpacity onPress={() => setShowPendingModal(false)} style={styles.closeBtn}>
                <X size={20} color={colors.subtext} />
              </TouchableOpacity>
            </View>

            {pendingItems.length === 0 ? (
              <View style={styles.emptyQueue}>
                <CheckCircle size={48} color={colors.success} />
                <Text style={[styles.emptyQueueText, { color: colors.text }]}>All data is synchronized!</Text>
                <Text style={[styles.emptyQueueSub, { color: colors.subtext }]}>No pending items in queue.</Text>
              </View>
            ) : (
              <ScrollView style={styles.queueScroll} showsVerticalScrollIndicator={false}>
                <Text style={[styles.queueInfoText, { color: colors.subtext }]}>
                  The following requests were saved locally while offline. They will automatically upload when an active internet connection is detected, or you can manually sync them.
                </Text>

                {pendingItems.map((item) => {
                  const isExpanded = expandedItemId === item.id;
                  const itemTitle = getPendingItemTitle(item);
                  const itemSummary = getPendingItemSummary(item);
                  const formattedTime = new Date(item.timestamp).toLocaleString();

                  return (
                    <View 
                      key={item.id} 
                      style={[
                        styles.queueCard, 
                        { backgroundColor: colors.card, borderColor: colors.border }
                      ]}
                    >
                      <TouchableOpacity 
                        style={styles.queueCardHeader}
                        onPress={() => setExpandedItemId(isExpanded ? null : item.id)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.queueItemTitle, { color: colors.text }]}>{itemTitle}</Text>
                          <Text style={[styles.queueItemSummary, { color: colors.subtext }]} numberOfLines={1}>{itemSummary}</Text>
                          <Text style={[styles.queueItemTime, { color: colors.subtext }]}>{formattedTime}</Text>
                        </View>
                        
                        <View style={styles.queueCardActions}>
                          <TouchableOpacity 
                            onPress={() => handleDeletePendingItem(item.id)} 
                            style={styles.actionIconButton}
                          >
                            <Trash2 size={16} color={colors.error || '#ef4444'} />
                          </TouchableOpacity>
                          {isExpanded ? (
                            <ChevronUp size={18} color={colors.subtext} />
                          ) : (
                            <ChevronDown size={18} color={colors.subtext} />
                          )}
                        </View>
                      </TouchableOpacity>

                      {/* Card-wise Upload Progress */}
                      {cardUploadProgress[item.id] !== undefined && (
                        <View style={styles.cardProgressContainer}>
                          <View style={[styles.cardProgressBarBg, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
                            <View 
                              style={[
                                styles.cardProgressBarFill, 
                                { 
                                  width: `${cardUploadProgress[item.id].percent}%`, 
                                  backgroundColor: colors.accent 
                                }
                              ]} 
                            />
                          </View>
                          <Text style={[styles.cardProgressText, { color: colors.accent }]}>
                            {cardUploadProgress[item.id].percent}% - {cardUploadProgress[item.id].statusText || 'Syncing...'}
                          </Text>
                        </View>
                      )}

                      {isExpanded && renderItemDetailsList(item)}
                    </View>
                  );
                })}
              </ScrollView>
            )}

            {pendingItems.length > 0 && (
              <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
                {isSyncing ? (
                  <View style={styles.syncProgressContainer}>
                    <View style={styles.syncProgressHeader}>
                      <ActivityIndicator size="small" color={colors.accent} />
                      <Text style={[styles.syncProgressText, { color: colors.text }]} numberOfLines={1}>
                        {syncProgress?.statusText 
                          ? syncProgress.statusText 
                          : (syncProgress?.filename 
                              ? `Uploading: ${syncProgress.filename}` 
                              : 'Processing sync queue...')
                        }
                      </Text>
                    </View>
                    
                    <View style={[styles.progressBarBg, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
                      <View 
                        style={[
                          styles.progressBarFill, 
                          { 
                            width: `${syncProgress ? syncProgress.percent : 0}%`, 
                            backgroundColor: colors.accent 
                          }
                        ]} 
                      />
                    </View>
                    
                    <View style={styles.syncProgressSubRow}>
                      <Text style={[styles.syncProgressSubText, { color: colors.subtext }]}>
                        {syncProgress && syncProgress.percent > 0 ? `${syncProgress.percent}%` : 'Connecting...'}
                      </Text>
                      {initialSyncCount > 0 && (
                        <Text style={[styles.syncProgressSubText, { color: colors.subtext }]}>
                          Item {initialSyncCount - pendingItems.length + 1} of {initialSyncCount}
                        </Text>
                      )}
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity 
                    style={[styles.syncAllButton, { backgroundColor: colors.accent }]} 
                    onPress={handleManualSync}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <CloudSync size={16} color="#fff" />
                      <Text style={styles.syncAllButtonText}>SYNC ALL NOW</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },
  greetingText: {
    fontSize: 14,
    color: '#64748b',
    letterSpacing: 0.5,
  },
  greetingBold: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -1,
  },
  userNameText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#64748b',
    marginTop: -2,
  },
  profileCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  profileInitial: {
    fontSize: 16,
    fontWeight: '800',
    color: '#4f46e5',
  },
  syncWrapper: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  syncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  syncPillSynced: {
    backgroundColor: '#fff',
    borderColor: '#f1f5f9',
  },
  syncPillPending: {
    backgroundColor: '#fff',
    borderColor: '#fee2e2',
  },
  syncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 10,
  },
  syncPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    flex: 1,
  },
  syncMiniBtn: {
    padding: 4,
  },
  superadminBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    marginHorizontal: 24,
    marginBottom: 20,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  superadminBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  superadminBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e293b',
  },
  superadminBannerSub: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: 24,
  },
  cleanCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 1,
  },
  scoreBoard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  scoreLarge: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0f172a',
  },
  scoreLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: 2,
  },
  vDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#f1f5f9',
  },
  minimalProgressContainer: {
    gap: 8,
  },
  miniProgressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  miniProgressLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  miniProgressValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  miniProgressBarBg: {
    height: 4,
    backgroundColor: '#f8fafc',
    borderRadius: 2,
    overflow: 'hidden',
  },
  miniProgressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  defectListMinimal: {
    gap: 12,
  },
  defectRowMinimal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  defectLabelMinimal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    flex: 1,
    marginRight: 12,
  },
  defectCountMinimal: {
    fontSize: 11,
    fontWeight: '900',
    color: '#1e293b',
  },
  tableCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  minimalTable: {
    width: '100%',
  },
  minTableHeader: {
    flexDirection: 'row',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 12,
  },
  minHeadText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  minTableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  minRowText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
  },
  actionsGridMinimal: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  actionBtnMinimal: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    alignItems: 'center',
    gap: 8,
  },
  actionBtnTextMinimal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1e293b',
  },
  tableCardDetailed: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  detailedTable: {
    minWidth: '100%',
  },
  detailedTableHeader: {
    flexDirection: 'row',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 8,
  },
  detailedHeadText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  detailedTableRow: {
    flexDirection: 'row',
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  detailedRowText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxHeight: '90%',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  modalTitleText: {
    fontSize: 16,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
  emptyQueue: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyQueueText: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 8,
  },
  emptyQueueSub: {
    fontSize: 13,
    fontWeight: '500',
  },
  queueScroll: {
    marginTop: 16,
  },
  queueInfoText: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 20,
    fontWeight: '600',
  },
  queueCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  queueCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  queueItemTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  queueItemSummary: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  queueItemTime: {
    fontSize: 10,
    fontWeight: '500',
  },
  queueCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionIconButton: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  detailContainer: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  detailVal: {
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
    marginLeft: 16,
  },
  jsonToggle: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  modalFooter: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  syncAllButton: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncAllButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  syncProgressContainer: {
    paddingVertical: 8,
    width: '100%',
  },
  syncProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  syncProgressText: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  syncProgressSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  syncProgressSubText: {
    fontSize: 11,
    fontWeight: '700',
  },
  networkStatusWrapper: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  networkStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  networkStatusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardProgressContainer: {
    marginTop: 12,
    width: '100%',
  },
  cardProgressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  cardProgressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  cardProgressText: {
    fontSize: 10,
    fontWeight: '700',
  },
});

export default DashboardScreen;
