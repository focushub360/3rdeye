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
} from 'lucide-react-native';
import { offlineQueue } from '../api/OfflineQueue';


import { useFocusEffect, useNavigation } from '@react-navigation/native';
import apiClient from '../api/config';
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
  const [initialSyncCount, setInitialSyncCount] = useState(0);

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'subadmin' || user?.role === 'lmadmin' || user?.role === 'manager';

  const fetchData = async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      
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
          setSummary({
            totalForms: overview.totalForms || 0,
            accepted: (dist.verified || 0) + (dist['Direct Ok'] || 0) + (dist.Accepted || 0) + (dist.OK || 0),
            rejected: dist.Rejected || dist.rejected || 0,
            rework: (dist.Rework || 0) + (dist['Rework Required'] || 0) + (dist.rework || 0),
            defectDistribution: perfRes.data.data.defectDistribution || [],
          });
        }
        setPerformance(perfRes.data.data.topForms || []);
      }

      if (summaryRes?.data?.success) {
        setInspectorSummary(summaryRes.data.data.summary || []);
        setSummaryStatuses(summaryRes.data.data.allStatuses || []);
      }

      if (reviewStatsRes?.data?.success) {
        setMyReviewStats(reviewStatsRes.data.data);
      }

      if (isAdmin && tableRes?.data?.success) {
        setPerformanceTableData(tableRes.data.data || []);
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
    try {
      await offlineQueue.processQueue();
      const finalQueue = await offlineQueue.getQueue();
      setPendingItems(finalQueue || []);
    } catch (error) {
      console.error('Manual sync failed:', error);
    } finally {
      setIsSyncing(false);
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
      offlineQueue.setCallback((count) => {
        checkQueue();
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

        {/* Clean Sync Pill */}
        <View style={styles.syncWrapper}>
           <View style={[styles.syncPill, { backgroundColor: colors.card, borderColor: pendingItems.length > 0 ? colors.error : colors.border }]}>
              <View style={[styles.syncDot, { backgroundColor: pendingItems.length > 0 ? colors.error : colors.success }]} />
              <Text style={[styles.syncPillText, { color: colors.subtext }]}>
                 {pendingItems.length > 0 ? `${pendingItems.length} PENDING UPLOADS` : 'ALL DATA SYNCED'}
              </Text>
              {pendingItems.length > 0 && (
                <TouchableOpacity onPress={handleManualSync} disabled={isSyncing} style={styles.syncMiniBtn}>
                   {isSyncing ? <ActivityIndicator size="small" color={colors.accent} /> : <CloudSync size={14} color={colors.accent} />}
                </TouchableOpacity>
              )}
           </View>
        </View>

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
});

export default DashboardScreen;
