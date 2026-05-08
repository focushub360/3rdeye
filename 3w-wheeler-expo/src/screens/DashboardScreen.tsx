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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
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
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  History,
  Clock,
  CalendarCheck
} from 'lucide-react-native';


import { useFocusEffect, useNavigation } from '@react-navigation/native';
import apiClient from '../api/config';
import Svg, { Circle } from 'react-native-svg';

const { width } = Dimensions.get('window');

const DashboardScreen = () => {
  const { user, logout } = useAuth();
  const navigation = useNavigation<any>();
  const [performance, setPerformance] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({ totalForms: 0, accepted: 0, rejected: 0, rework: 0 });
  const [inspectorSummary, setInspectorSummary] = useState<any[]>([]);
  const [summaryStatuses, setSummaryStatuses] = useState<string[]>([]);
  const [performanceTableData, setPerformanceTableData] = useState<any[]>([]);
  const [myReviewStats, setMyReviewStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

      const results = await Promise.all(apiCalls);
      
      const perfRes = results[0];
      const summaryRes = results[1];
      const reviewStatsRes = results[2];
      const tableRes = isAdmin ? results[3] : null;

      if (perfRes.data.success) {
        if (perfRes.data.data.overview) {
          const overview = perfRes.data.data.overview;
          const dist = perfRes.data.data.statusDistribution || {};
          setSummary({
            totalForms: overview.totalForms,
            accepted: (dist.verified || 0) + (dist['Direct Ok'] || 0) + (dist.Accepted || 0) + (dist.OK || 0),
            rejected: dist.Rejected || dist.rejected || 0,
            rework: (dist.Rework || 0) + (dist['Rework Required'] || 0) + (dist.rework || 0),
          });
        }
        setPerformance(perfRes.data.data.topForms || []);
      }

      if (summaryRes.data.success) {
        setInspectorSummary(summaryRes.data.data.summary || []);
        setSummaryStatuses(summaryRes.data.data.allStatuses || []);
      }

      if (reviewStatsRes.data.success) {
        setMyReviewStats(reviewStatsRes.data.data);
      }

      if (isAdmin && tableRes && tableRes.data.success) {
        setPerformanceTableData(tableRes.data.data || []);
      }
    } catch (error) {
      console.error('Dashboard fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      // First load fetches in background so the UI doesn't blank out on tab switch
      fetchData(Object.keys(summary).length > 0);
      
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
      });

      socket.on('response-updated', () => fetchData(true));
      socket.on('response-deleted', () => fetchData(true));

      return () => {
        socket.disconnect();
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView 
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.welcomeText}>OVERVIEW</Text>
            <Text style={styles.headerTitle}>{isAdmin ? 'System Dashboard' : 'Inspector Portal'}</Text>
          </View>
          <View style={styles.headerRightInfo}>
            <View style={styles.userInfoTextWrapper}>
              <Text style={styles.userEmailText}>{user?.email || user?.username}</Text>
              <View style={[styles.roleBadge, { backgroundColor: isAdmin ? '#eff6ff' : '#f0fdf4' }]}>
                <Text style={[styles.roleBadgeText, { color: isAdmin ? '#1e40af' : '#166534' }]}>
                  {(user?.role || 'user').toUpperCase()}
                </Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.profileCircle}
              onPress={() => navigation.navigate('Account')}
            >
              <Text style={styles.profileInitial}>
                {user?.name ? user.name[0] : (user?.firstName ? user.firstName[0] : 'A')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {isInitialLoading ? (
          <View style={[styles.centered, { marginTop: 100 }]}>
            <ActivityIndicator size="large" color="#4f46e5" />
            <Text style={{ marginTop: 16, color: '#64748b', fontSize: 14 }}>Loading your dashboard...</Text>
          </View>
        ) : (
          <View style={styles.content}>
          {/* Performance Pulse - Shared for all */}
          <View style={styles.pulseContainer}>
            <View style={styles.pulseHeader}>
              <View style={styles.pulseTitleRow}>
                <TrendingUp size={16} color="#4f46e5" />
                <Text style={styles.pulseTitle}>{isAdmin ? 'ANALYTICS PULSE' : 'YOUR PERFORMANCE'}</Text>
              </View>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </View>

            <View style={styles.pulseGrid}>
              <View style={styles.pulseRow}>
                <View style={styles.pulseItem}>
                  <Text style={styles.pulseValue}>{totalForms}</Text>
                  <Text style={styles.pulseLabel}>Total Forms</Text>
                </View>
                <View style={styles.pulseDivider} />
                <View style={styles.pulseItem}>
                  <Text style={[styles.pulseValue, { color: '#22c55e' }]}>{totalAccepted}</Text>
                  <Text style={styles.pulseLabel}>Accepted</Text>
                </View>
              </View>
              <View style={[styles.pulseRow, { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#f8fafc' }]}>
                <View style={styles.pulseItem}>
                  <Text style={[styles.pulseValue, { color: '#ef4444' }]}>{totalRejected}</Text>
                  <Text style={styles.pulseLabel}>Rejected</Text>
                </View>
                <View style={styles.pulseDivider} />
                <View style={styles.pulseItem}>
                  <Text style={[styles.pulseValue, { color: '#94a3b8' }]}>{totalRework}</Text>
                  <Text style={styles.pulseLabel}>Rework</Text>
                </View>
              </View>
            </View>

            {/* Overall Response Quality Donut Chart */}
            <View style={styles.chartContainer}>
              <View style={styles.chartHeader}>
                <Text style={styles.chartTitle}>OVERALL RESPONSE QUALITY</Text>
                <Text style={styles.chartSub}>Status Distribution</Text>
              </View>
              
              <View style={styles.chartRow}>
                <View style={styles.donutWrapper}>
                  <Svg width={120} height={120} viewBox="0 0 100 100">
                    {(() => {
                      const finalizedTotal = totalAccepted + totalRejected + totalRework;
                      if (finalizedTotal === 0) return (
                        <Circle cx="50" cy="50" r="40" stroke="#f1f5f9" strokeWidth="12" fill="none" />
                      );

                      const radius = 40;
                      const circum = 2 * Math.PI * radius;
                      
                      const accP = totalAccepted / finalizedTotal;
                      const rejP = totalRejected / finalizedTotal;
                      const rewP = totalRework / finalizedTotal;

                      let currentOffset = 0;
                      
                      return (
                        <>
                          {/* Accepted - Green */}
                          {accP > 0 && (
                            <Circle 
                              cx="50" cy="50" r={radius} 
                              stroke="#22c55e" strokeWidth="12" fill="none"
                              strokeDasharray={`${accP * circum} ${circum}`}
                              strokeDashoffset={-currentOffset}
                              strokeLinecap="round"
                              transform="rotate(-90 50 50)"
                            />
                          )}
                          {(() => { currentOffset += accP * circum; return null; })()}
                          
                          {/* Rejected - Red */}
                          {rejP > 0 && (
                            <Circle 
                              cx="50" cy="50" r={radius} 
                              stroke="#ef4444" strokeWidth="12" fill="none"
                              strokeDasharray={`${rejP * circum} ${circum}`}
                              strokeDashoffset={-currentOffset}
                              strokeLinecap="round"
                              transform="rotate(-90 50 50)"
                            />
                          )}
                          {(() => { currentOffset += rejP * circum; return null; })()}

                          {/* Rework - Gray (Matches web screenshot) */}
                          {rewP > 0 && (
                            <Circle 
                              cx="50" cy="50" r={radius} 
                              stroke="#94a3b8" strokeWidth="12" fill="none"
                              strokeDasharray={`${rewP * circum} ${circum}`}
                              strokeDashoffset={-currentOffset}
                              strokeLinecap="round"
                              transform="rotate(-90 50 50)"
                            />
                          )}
                        </>
                      );
                    })()}
                  </Svg>
                  <View style={styles.donutCenter}>
                    <Text style={styles.donutPercent}>
                      {(() => {
                        const total = totalAccepted + totalRejected + totalRework;
                        return total > 0 ? Math.round((totalAccepted / total) * 100) : 0;
                      })()}%
                    </Text>
                    <Text style={styles.donutLabel}>QUALITY</Text>
                  </View>
                </View>

                <View style={styles.legendContainer}>
                  {(() => {
                    const total = totalAccepted + totalRejected + totalRework;
                    const getP = (val: number) => total > 0 ? Math.round((val / total) * 100) : 0;
                    
                    return (
                      <>
                        <View style={styles.legendItem}>
                          <View style={[styles.legendDot, { backgroundColor: '#22c55e' }]} />
                          <View>
                            <Text style={styles.legendLabel}>Accepted</Text>
                            <Text style={styles.legendValue}>{totalAccepted} ({getP(totalAccepted)}%)</Text>
                          </View>
                        </View>
                        <View style={styles.legendItem}>
                          <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
                          <View>
                            <Text style={styles.legendLabel}>Rejected</Text>
                            <Text style={styles.legendValue}>{totalRejected} ({getP(totalRejected)}%)</Text>
                          </View>
                        </View>
                        <View style={styles.legendItem}>
                          <View style={[styles.legendDot, { backgroundColor: '#94a3b8' }]} />
                          <View>
                            <Text style={styles.legendLabel}>Rework</Text>
                            <Text style={styles.legendValue}>{totalRework} ({getP(totalRework)}%)</Text>
                          </View>
                        </View>
                      </>
                    );
                  })()}
                </View>
              </View>

            </View>

            {/* My Review Performance Breakdown (Web Parity) */}
            {myReviewStats && (
              <View style={styles.chartContainer}>
                <View style={styles.chartHeader}>
                  <Text style={styles.chartTitle}>MY REVIEW PERFORMANCE BREAKDOWN</Text>
                  <Text style={styles.chartSub}>Individual Review Quality</Text>
                </View>
                
                <View style={styles.chartRow}>
                  <View style={styles.donutWrapper}>
                    <Svg width={120} height={120} viewBox="0 0 100 100">
                      {(() => {
                        const total = myReviewStats.reviewed || 0;
                        if (total === 0) return (
                          <Circle cx="50" cy="50" r="40" stroke="#f1f5f9" strokeWidth="12" fill="none" />
                        );

                        const radius = 40;
                        const circum = 2 * Math.PI * radius;
                        
                        const accP = (myReviewStats.accepted || 0) / total;
                        const rejP = (myReviewStats.rejected || 0) / total;
                        const rewP = (myReviewStats.rework || 0) / total;

                        let currentOffset = 0;
                        
                        return (
                          <>
                            {accP > 0 && (
                              <Circle 
                                cx="50" cy="50" r={radius} 
                                stroke="#22c55e" strokeWidth="12" fill="none"
                                strokeDasharray={`${accP * circum} ${circum}`}
                                strokeDashoffset={-currentOffset}
                                strokeLinecap="round"
                                transform="rotate(-90 50 50)"
                              />
                            )}
                            {(() => { currentOffset += accP * circum; return null; })()}
                            
                            {rejP > 0 && (
                              <Circle 
                                cx="50" cy="50" r={radius} 
                                stroke="#ef4444" strokeWidth="12" fill="none"
                                strokeDasharray={`${rejP * circum} ${circum}`}
                                strokeDashoffset={-currentOffset}
                                strokeLinecap="round"
                                transform="rotate(-90 50 50)"
                              />
                            )}
                            {(() => { currentOffset += rejP * circum; return null; })()}

                            {rewP > 0 && (
                              <Circle 
                                cx="50" cy="50" r={radius} 
                                stroke="#f59e0b" strokeWidth="12" fill="none"
                                strokeDasharray={`${rewP * circum} ${circum}`}
                                strokeDashoffset={-currentOffset}
                                strokeLinecap="round"
                                transform="rotate(-90 50 50)"
                              />
                            )}
                          </>
                        );
                      })()}
                    </Svg>
                    <View style={styles.donutCenter}>
                      <Text style={styles.donutPercent}>{myReviewStats.performanceScore}%</Text>
                      <Text style={styles.donutLabel}>SCORE</Text>
                    </View>
                  </View>

                  <View style={styles.legendContainer}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#22c55e' }]} />
                      <View>
                        <Text style={styles.legendLabel}>Accepted</Text>
                        <Text style={styles.legendValue}>{myReviewStats.accepted}</Text>
                      </View>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
                      <View>
                        <Text style={styles.legendLabel}>Rejected</Text>
                        <Text style={styles.legendValue}>{myReviewStats.rejected}</Text>
                      </View>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
                      <View>
                        <Text style={styles.legendLabel}>Rework</Text>
                        <Text style={styles.legendValue}>{myReviewStats.rework}</Text>
                      </View>
                    </View>
                  </View>
                </View>
                
                <View style={styles.reviewSummaryRow}>
                  <View style={styles.reviewSummaryItem}>
                    <Text style={styles.reviewSummaryValue}>{myReviewStats.totalResponses}</Text>
                    <Text style={styles.reviewSummaryLabel}>Submissions</Text>
                  </View>
                  <View style={styles.reviewSummaryDivider} />
                  <View style={styles.reviewSummaryItem}>
                    <Text style={styles.reviewSummaryValue}>{myReviewStats.reviewed}</Text>
                    <Text style={styles.reviewSummaryLabel}>Total Reviews</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Defect Distribution - New Section (Web Parity) */}
            {(summary.defectDistribution && summary.defectDistribution.length > 0) && (
              <View style={styles.defectContainer}>
                <View style={styles.defectHeader}>
                  <AlertCircle size={16} color="#ef4444" />
                  <Text style={styles.defectTitle}>DEFECT DISTRIBUTION</Text>
                </View>
                <Text style={styles.defectSub}>Top Quality Issues by Volume</Text>
                
                <View style={styles.defectList}>
                  {summary.defectDistribution.map((defect: any, idx: number) => (
                    <View key={idx} style={styles.defectRow}>
                      <View style={styles.defectLabelRow}>
                        <Text style={styles.defectLabel} numberOfLines={1}>{defect.label}</Text>
                        <Text style={styles.defectValue}>{defect.count} ({defect.percentage}%)</Text>
                      </View>
                      <View style={styles.progressBarBg}>
                        <View style={[
                          styles.progressBarFill, 
                          { width: `${defect.percentage}%`, backgroundColor: defect.rejected > 0 ? '#ef4444' : '#94a3b8' }
                        ]} />
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Inspection Summary Table (Web Parity) */}
            {inspectorSummary.length > 0 && (
              <View style={styles.tableContainer}>
                <View style={styles.tableHeaderRow}>
                  <View style={[styles.tableAccent, { backgroundColor: '#3b82f6' }]} />
                  <Text style={styles.tableTitle}>INSPECTION SUMMARY TABLE</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.tableWrapper}>
                    <View style={styles.tableHead}>
                      <Text style={[styles.tableHeadText, { width: 120 }]}>Tenant Name</Text>
                      <Text style={[styles.tableHeadText, { width: 100 }]}>Date</Text>
                      <Text style={[styles.tableHeadText, { width: 100 }]}>Shift</Text>
                      <Text style={[styles.tableHeadText, { width: 150 }]}>QC Inspector</Text>
                      <Text style={[styles.tableHeadText, { width: 80, textAlign: 'center' }]}>Total</Text>
                      {summaryStatuses.map(status => (
                        <Text key={status} style={[styles.tableHeadText, { width: 100, textAlign: 'center' }]}>{status}</Text>
                      ))}
                    </View>
                    {inspectorSummary.map((row, idx) => (
                      <View key={idx} style={[styles.tableRow, idx % 2 === 1 && { backgroundColor: '#f8fafc' }]}>
                        <Text style={[styles.tableRowText, { width: 120, fontWeight: '700' }]}>{row.tenantName}</Text>
                        <Text style={[styles.tableRowText, { width: 100 }]}>{row.date}</Text>
                        <Text style={[styles.tableRowText, { width: 100 }]}>{row.shift}</Text>
                        <Text style={[styles.tableRowText, { width: 150 }]}>{row.qcInspector}</Text>
                        <Text style={[styles.tableRowText, { width: 80, textAlign: 'center', fontWeight: '800' }]}>{row.totalInspection}</Text>
                        {summaryStatuses.map(status => (
                          <Text 
                            key={status} 
                            style={[
                              styles.tableRowText, 
                              { width: 100, textAlign: 'center', fontWeight: '700' },
                              { color: status === 'Direct Ok' ? '#22c55e' : status.startsWith('Rework') ? '#f59e0b' : status === 'Rejected' ? '#ef4444' : '#3b82f6' }
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

            {/* Performance Table (Web Parity - Admin only) */}
            {(isAdmin && performanceTableData.length > 0) && (
              <View style={styles.tableContainer}>
                <View style={styles.tableHeaderRow}>
                  <View style={[styles.tableAccent, { backgroundColor: '#8b5cf6' }]} />
                  <Text style={[styles.tableTitle, { color: '#8b5cf6' }]}>PERFORMANCE TABLE</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.tableWrapper}>
                    <View style={styles.tableHead}>
                      <Text style={[styles.tableHeadText, { width: 150 }]}>User Name</Text>
                      <Text style={[styles.tableHeadText, { width: 100, textAlign: 'center' }]}>Submitted</Text>
                      <Text style={[styles.tableHeadText, { width: 100, textAlign: 'center' }]}>Reviewed</Text>
                      <Text style={[styles.tableHeadText, { width: 80, textAlign: 'center', color: '#22c55e' }]}>Accepted</Text>
                      <Text style={[styles.tableHeadText, { width: 80, textAlign: 'center', color: '#ef4444' }]}>Rejected</Text>
                      <Text style={[styles.tableHeadText, { width: 80, textAlign: 'center', color: '#f59e0b' }]}>Rework</Text>
                      <Text style={[styles.tableHeadText, { width: 100, textAlign: 'center' }]}>Score</Text>
                    </View>
                    {performanceTableData.map((row, idx) => (
                      <View key={idx} style={[styles.tableRow, idx % 2 === 1 && { backgroundColor: '#f8fafc' }]}>
                        <Text style={[styles.tableRowText, { width: 150, fontWeight: '700' }]}>{row.name}</Text>
                        <Text style={[styles.tableRowText, { width: 100, textAlign: 'center', fontWeight: '700' }]}>{row.totalSubmitted}</Text>
                        <Text style={[styles.tableRowText, { width: 100, textAlign: 'center', fontWeight: '700' }]}>{row.totalReviewed}</Text>
                        <Text style={[styles.tableRowText, { width: 80, textAlign: 'center', fontWeight: '700', color: '#22c55e' }]}>{row.accepted}</Text>
                        <Text style={[styles.tableRowText, { width: 80, textAlign: 'center', fontWeight: '700', color: '#ef4444' }]}>{row.rejected}</Text>
                        <Text style={[styles.tableRowText, { width: 80, textAlign: 'center', fontWeight: '700', color: '#f59e0b' }]}>{row.rework}</Text>
                        <View style={[{ width: 100, alignItems: 'center' }]}>
                          <View style={[
                            styles.scoreBadge, 
                            { backgroundColor: row.performanceScore >= 80 ? '#f0fdf4' : row.performanceScore >= 50 ? '#fffbeb' : '#fef2f2' }
                          ]}>
                            <Text style={[
                              styles.scoreBadgeText,
                              { color: row.performanceScore >= 80 ? '#166534' : row.performanceScore >= 50 ? '#92400e' : '#991b1b' }
                            ]}>
                              {row.performanceScore}%
                            </Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}
          </View>

          {isAdmin ? null : (
            <>
              {/* Quick Actions for Inspectors */}
              <View style={styles.listHeader}>
                <Text style={styles.listTitle}>Quick Actions</Text>
              </View>
              <View style={styles.quickActions}>
                <TouchableOpacity style={styles.actionItem} onPress={() => navigation.navigate('Forms')}>
                    <ClipboardCheck size={24} color="#4f46e5" />
                    <Text style={styles.actionText}>Field Forms</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionItem} onPress={() => navigation.navigate('Attendance')}>
                    <History size={24} color="#10b981" />
                    <Text style={styles.actionText}>Attendance</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
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
    paddingTop: 20,
    paddingBottom: 24,
    backgroundColor: '#fff',
  },
  welcomeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 1.5,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 4,
    letterSpacing: -0.5,
  },
  headerRightInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userInfoTextWrapper: {
    alignItems: 'flex-end',
    gap: 2,
  },
  userEmailText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleBadgeText: {
    fontSize: 8,
    fontWeight: '900',
  },
  profileCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  profileInitial: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4f46e5',
  },
  content: {
    paddingHorizontal: 24,
  },
  pulseContainer: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
  },
  pulseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  pulseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 5,
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
  pulseTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 1.2,
  },
  pulseGrid: {
    marginTop: 8,
  },
  pulseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pulseItem: {
    alignItems: 'center',
    flex: 1,
  },
  pulseValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
  },
  pulseLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    marginTop: 4,
  },
  pulseDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#f1f5f9',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  countBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4f46e5',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  neatCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  cardMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  neatAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  neatName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1e293b',
  },
  neatSub: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: 2,
  },
  neatStats: {
    flexDirection: 'row',
    gap: 6,
  },
  miniBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  miniBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  fullReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 40,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
  },
  fullReportText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4f46e5',
    letterSpacing: 0.5,
  },
  simpleBanner: {
    backgroundColor: '#4f46e5',
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
  },
  bannerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
    marginTop: 16,
  },
  bannerSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
    lineHeight: 18,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionItem: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    alignItems: 'center',
    gap: 12,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  chartContainer: {
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  chartHeader: {
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 1.2,
  },
  chartSub: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 4,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 32,
  },
  donutWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutPercent: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
  },
  donutLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 1,
  },
  legendContainer: {
    flex: 1,
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  legendLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
  },
  legendValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1e293b',
    marginTop: 1,
  },
  defectContainer: {
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  defectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  defectTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ef4444',
    letterSpacing: 1.2,
  },
  defectSub: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 20,
  },
  defectList: {
    gap: 16,
  },
  defectRow: {
    gap: 8,
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
  tableContainer: {
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  tableAccent: {
    width: 6,
    height: 24,
    borderRadius: 3,
  },
  tableTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#3b82f6',
    letterSpacing: 1,
  },
  tableWrapper: {
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 16,
    overflow: 'hidden',
  },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tableHeadText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    alignItems: 'center',
  },
  tableRowText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
  },
  scoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  scoreBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  reviewSummaryRow: {
    flexDirection: 'row',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    justifyContent: 'space-between',
  },
  reviewSummaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  reviewSummaryValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#4f46e5',
  },
  reviewSummaryLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  reviewSummaryDivider: {
    width: 1,
    height: '100%',
    backgroundColor: '#f1f5f9',
  },
  pulseIconBg: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  }
});

export default DashboardScreen;
