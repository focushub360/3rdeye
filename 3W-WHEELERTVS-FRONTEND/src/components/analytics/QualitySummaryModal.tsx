import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Calendar,
  Filter,
  ArrowUp,
  ArrowUpRight,
  ArrowRight,
  ArrowDown,
  CheckCircle2,
  AlertTriangle,
  Award,
  BarChart3,
  Layers,
  RefreshCw,
  Search,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { apiClient } from '../../api/client';

interface QualitySummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  forms?: Array<{ id: string; title: string }>;
}

interface InspectorSummary {
  name: string;
  totalChecked: number;
  acceptCount: number;
  defectCount: number;
  acceptRate: number;
  defectRate: number;
  performanceStatus: string;
  tier: 'exemplary' | 'exceeded' | 'met' | 'partially-met';
  arrow: 'up' | 'up-right' | 'right' | 'down';
  biwAcceptCount: number;
  biwDefectCount: number;
  biwAcceptRate: number;
  biwDefectRate: number;
  rework1Count: number;
  topDefects?: Array<{ name: string; count: number }>;
}

interface DefectItem {
  name: string;
  count: number;
}

interface DailyTrendItem {
  date: string;
  totalChecked: number;
  acceptCount: number;
  defectCount: number;
  reworkCount: number;
  passRate: number;
}

interface RawResponse {
  id: string;
  chassisNumber: string;
  submittedBy: string;
  date: string;
  status: string;
  biwReviewStatus: string;
  defects: string[];
}

interface SummaryData {
  summary: {
    totalChecked: number;
    totalAccepted: number;
    totalDefects: number;
    totalRework1: number;
    overallAcceptRate: number;
    overallDefectRate: number;
    totalInspectors: number;
    exemplaryCount: number;
    exceededCount: number;
    metCount: number;
    partiallyMetCount: number;
  };
  formOptions: Array<{ id: string; title: string }>;
  inspectors: InspectorSummary[];
  defectBreakdown: DefectItem[];
  dailyTrends: DailyTrendItem[];
  rawResponses: RawResponse[];
}

export const QualitySummaryModal: React.FC<QualitySummaryModalProps> = ({
  isOpen,
  onClose,
  forms = []
}) => {
  const [activeTab, setActiveTab] = useState<'tvs' | 'biw' | 'daily' | 'data'>('tvs');
  const [selectedFormId, setSelectedFormId] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('all');
  const [searchInspector, setSearchInspector] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SummaryData | null>(null);
  const [loadTimeMs, setLoadTimeMs] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number>(0);

  // Compute start/end dates
  const { startDate, endDate } = useMemo(() => {
    if (dateRange === 'all') return { startDate: undefined, endDate: undefined };
    const now = new Date();
    let start: Date;
    if (dateRange === '7d') {
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (dateRange === '30d') {
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (dateRange === 'this_month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      return { startDate: undefined, endDate: undefined };
    }
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0]
    };
  }, [dateRange]);

  // Elapsed timer during loading
  useEffect(() => {
    if (!loading) return;
    setElapsedMs(0);
    const interval = setInterval(() => {
      setElapsedMs(prev => prev + 100);
    }, 100);
    return () => clearInterval(interval);
  }, [loading]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setLoadTimeMs(null);
    const t0 = performance.now();
    try {
      const res = await apiClient.getQualitySummary({
        formId: selectedFormId !== 'all' ? selectedFormId : undefined,
        startDate,
        endDate,
        forceNetwork: true
      });
      if (res && res.success && res.data) {
        setData(res.data);
        setLoadTimeMs(Math.round(performance.now() - t0));
      } else {
        setError(res?.message || 'Failed to fetch summary data');
      }
    } catch (err: any) {
      console.error('Error fetching quality summary:', err);
      setError(err?.message || 'Error connecting to analytics server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, selectedFormId, startDate, endDate]);

  // Filter inspectors by search
  const filteredInspectors = useMemo(() => {
    if (!data?.inspectors) return [];
    if (!searchInspector.trim()) return data.inspectors;
    const q = (searchInspector || '').toLowerCase();
    return data.inspectors.filter(i => String(i.name || '').toLowerCase().includes(q));
  }, [data?.inspectors, searchInspector]);

  // Export to Excel matching the user's Excel sheets
  const handleExportExcel = () => {
    if (!data) return;

    const wb = XLSX.utils.book_new();

    // Sheet 1: TVS Performance
    const tvsRows = [
      ['Inspector Name', 'Total Checked', 'Accept Qty', 'Defect Found', 'Accept %', 'Defect %', 'Performance Status'],
      ...data.inspectors.map(i => [
        i.name,
        i.totalChecked,
        i.acceptCount,
        i.defectCount,
        `${i.acceptRate}%`,
        `${i.defectRate}%`,
        i.performanceStatus
      ]),
      [
        'Grand Total',
        data.summary.totalChecked,
        data.summary.totalAccepted,
        data.summary.totalDefects,
        `${data.summary.overallAcceptRate}%`,
        `${data.summary.overallDefectRate}%`,
        data.summary.overallAcceptRate >= 90 ? 'Exemplary performer' : 'Exceeded Performance'
      ]
    ];
    const wsTvs = XLSX.utils.aoa_to_sheet(tvsRows);
    XLSX.utils.book_append_sheet(wb, wsTvs, 'TVS Performance');

    // Sheet 2: BIW Quality & Defect Breakdown
    const biwRows = [
      ['Inspector Name', 'Total Checked', 'BIW Accept Qty', 'BIW Defect Found', 'BIW Accept %', 'BIW Defect %'],
      ...data.inspectors.map(i => [
        i.name,
        i.totalChecked,
        i.biwAcceptCount,
        i.biwDefectCount,
        `${i.biwAcceptRate}%`,
        `${i.biwDefectRate}%`
      ]),
      [],
      ['Top Defect Categories', 'Defect Count'],
      ...data.defectBreakdown.map(d => [d.name, d.count])
    ];
    const wsBiw = XLSX.utils.aoa_to_sheet(biwRows);
    XLSX.utils.book_append_sheet(wb, wsBiw, 'BIW Quality');

    // Sheet 3: Daily Trends
    const dailyRows = [
      ['Date', 'Total Checked', 'Accept Count', 'Defect Count', 'Rework Count', 'Pass Rate %'],
      ...data.dailyTrends.map(d => [
        d.date,
        d.totalChecked,
        d.acceptCount,
        d.defectCount,
        d.reworkCount,
        `${d.passRate}%`
      ]),
      [
        'Grand Total',
        data.summary.totalChecked,
        data.summary.totalAccepted,
        data.summary.totalDefects,
        data.summary.totalRework1,
        `${data.summary.overallAcceptRate}%`
      ]
    ];
    const wsDaily = XLSX.utils.aoa_to_sheet(dailyRows);
    XLSX.utils.book_append_sheet(wb, wsDaily, 'Daily Trends');

    // Sheet 4: Raw Forms Data
    const rawDataRows = [
      ['Date', 'Form Name', 'Chassis Number', 'Chassis / VIN', 'Inspector', 'Final Status', 'BIW Review', 'Defects Found'],
      ...(data.rawResponses || []).map(r => [
        r.date,
        r.formTitle || 'Unknown Form',
        r.chassisNumber || 'N/A',
        r.chassisVin && r.chassisVin !== 'N/A' ? r.chassisVin : (r.partDescription || '-'),
        r.submittedBy || 'Unknown',
        r.status || 'pending',
        r.biwReviewStatus || 'Pending',
        r.defects && r.defects.length > 0 ? r.defects.join(', ') : 'None'
      ])
    ];
    const wsRaw = XLSX.utils.aoa_to_sheet(rawDataRows);
    XLSX.utils.book_append_sheet(wb, wsRaw, 'Raw Data');

    const fileName = `Quality_Summary_${selectedFormId !== 'all' ? selectedFormId : 'AllForms'}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className="relative bg-white dark:bg-slate-900 w-full max-w-6xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 gap-4 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Quality & Performance Summary
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-800">
                  Live DB
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Mirroring your Excel Pivot & Daily sheets across your forms
              </p>
            </div>
          </div>

          {/* Controls: Form Select, Date Filter & Export */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Form Selector */}
            <div className="relative">
              <select
                value={selectedFormId}
                onChange={(e) => setSelectedFormId(e.target.value)}
                className="text-xs sm:text-sm pl-3 pr-8 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 font-medium shadow-sm"
              >
                <option value="all">📁 All My Forms ({data?.summary?.totalChecked || '...'} Responses)</option>
                {(data?.formOptions || forms).map((f) => (
                  <option key={f.id} value={f.id}>
                    📄 {f.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range Selector */}
            <div className="relative">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="text-xs sm:text-sm pl-3 pr-8 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 font-medium shadow-sm"
              >
                <option value="all">📅 All Time</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="this_month">This Month</option>
              </select>
            </div>

            {/* Refresh */}
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Refresh Analytics"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            </button>

            {/* Excel Export Button */}
            <button
              onClick={handleExportExcel}
              disabled={!data || loading}
              className="inline-flex items-center px-3 py-2 text-xs sm:text-sm font-medium rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-colors"
              title="Export Full Summary to Excel"
            >
              <FileSpreadsheet className="w-4 h-4 mr-1.5" />
              Export Excel
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Top Executive KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 sm:p-5 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
          <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Total Checked
              </span>
              <Layers className="w-4 h-4 text-blue-500" />
            </div>
            <div className="mt-1 text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              {loading ? '...' : data?.summary?.totalChecked.toLocaleString() || 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Across {data?.summary?.totalInspectors || 0} inspectors
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Accept / Pass Rate
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-1 text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {loading ? '...' : `${data?.summary?.overallAcceptRate || 0}%`}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {loading ? '...' : data?.summary?.totalAccepted.toLocaleString() || 0} units accepted
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                Defect Rate
              </span>
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="mt-1 text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400">
              {loading ? '...' : `${data?.summary?.overallDefectRate || 0}%`}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {loading ? '...' : data?.summary?.totalDefects.toLocaleString() || 0} defects detected
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                Exemplary Staff
              </span>
              <Award className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="mt-1 text-xl sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {loading ? '...' : `${data?.summary?.exemplaryCount || 0} Staff`}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              ≥ 90% acceptance performance
            </div>
          </div>
        </div>

        {/* Tab Navigation & Search */}
        <div className="px-5 pt-3 pb-0 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900">
          <div className="flex space-x-2 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveTab('data')}
              className={`pb-3 px-3.5 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
                activeTab === 'data'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              📄 Forms Data Grid
            </button>
            <button
              onClick={() => setActiveTab('tvs')}
              className={`pb-3 px-3.5 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
                activeTab === 'tvs'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              🏆 Inspector TVS Performance
            </button>
            <button
              onClick={() => setActiveTab('biw')}
              className={`pb-3 px-3.5 text-xs sm:text-sm font-semibold border-b-2 transition-all ${
                activeTab === 'biw'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              🔍 BIW Quality & Defect Breakdown
            </button>
            <button
              onClick={() => setActiveTab('daily')}
              className={`pb-3 px-3.5 text-xs sm:text-sm font-semibold border-b-2 transition-all ${
                activeTab === 'daily'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              📅 Daily Trend & Pass Rate
            </button>
          </div>

          {activeTab !== 'daily' && activeTab !== 'data' && (
            <div className="relative mb-2 sm:mb-0 w-full sm:w-64 flex-shrink-0">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchInspector}
                onChange={(e) => setSearchInspector(e.target.value)}
                placeholder="Search inspector..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <RefreshCw className="w-10 h-10 text-blue-600 animate-spin mb-4" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Loading Quality Summary...
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                Aggregating {data?.summary?.totalChecked?.toLocaleString() || 'all'} inspection responses from your forms
              </p>
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                {(elapsedMs / 1000).toFixed(1)}s
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                First load may take 8-12s • Subsequent loads are cached (instant)
              </p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-center">
              {error}
            </div>
          ) : (
            <>
              {/* TAB 0: RAW FORMS DATA GRID (Excel-like) */}
              {activeTab === 'data' && (
                <div className="space-y-4 h-full flex flex-col">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-500 font-medium">
                      Showing {data.rawResponses?.length || 0} Records
                    </div>
                  </div>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-auto shadow-sm flex-1">
                    <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-[800px]">
                      <thead className="bg-slate-100/80 dark:bg-slate-800 sticky top-0 z-10 shadow-sm border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700 w-28">Date</th>
                          <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700 w-36">Chassis Number</th>
                          <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700 w-36">Chassis / VIN</th>
                          <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700 w-40">Inspector</th>
                          <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700 w-28">Status</th>
                          <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700 w-28">BIW Review</th>
                          <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Defects Found</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                        {data.rawResponses?.map((row, idx) => (
                          <tr key={row.id} className="hover:bg-blue-50/40 dark:hover:bg-slate-800/60 transition-colors">
                            <td className="px-4 py-2.5 border-r border-slate-100 dark:border-slate-800 whitespace-nowrap text-slate-600 dark:text-slate-400">{row.date}</td>
                            <td className="px-4 py-2.5 border-r border-slate-100 dark:border-slate-800 font-mono font-bold text-slate-900 dark:text-slate-100">{row.chassisNumber}</td>
                            <td className="px-4 py-2.5 border-r border-slate-100 dark:border-slate-800 font-semibold text-indigo-600 dark:text-indigo-400">{row.chassisVin && row.chassisVin !== 'N/A' ? row.chassisVin : (row.partDescription || '-')}</td>
                            <td className="px-4 py-2.5 border-r border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-300">{row.submittedBy}</td>
                            <td className="px-4 py-2.5 border-r border-slate-100 dark:border-slate-800">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${String(row.status || '').toLowerCase().includes('ok') || String(row.status || '').toLowerCase() === 'accepted' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300'}`}>
                                {row.status}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 border-r border-slate-100 dark:border-slate-800">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${row.biwReviewStatus === 'Accepted' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' : row.biwReviewStatus === 'Rejected' ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300' : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'}`}>
                                {row.biwReviewStatus}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-rose-600 dark:text-rose-400 text-xs font-medium">
                              {row.defects && row.defects.length > 0 ? row.defects.join(', ') : <span className="text-slate-400 dark:text-slate-600 italic font-normal">None</span>}
                            </td>
                          </tr>
                        ))}
                        {(!data.rawResponses || data.rawResponses.length === 0) && (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-slate-500">No forms data found for this selection.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 1: Inspector Performance Table */}
              {activeTab === 'tvs' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-500 font-medium">
                      Showing {filteredInspectors.length} inspectors evaluated for TVS Defect acceptance
                    </div>
                    {/* Tier Legend */}
                    <div className="hidden md:flex items-center gap-3 text-[11px] font-medium text-slate-500">
                      <span className="flex items-center gap-1 text-emerald-600">
                        <ArrowUp className="w-3.5 h-3.5" /> ≥90% Exemplary
                      </span>
                      <span className="flex items-center gap-1 text-teal-600">
                        <ArrowUpRight className="w-3.5 h-3.5" /> 80-89% Exceeded
                      </span>
                      <span className="flex items-center gap-1 text-amber-600">
                        <ArrowRight className="w-3.5 h-3.5" /> 70-79% Met
                      </span>
                      <span className="flex items-center gap-1 text-rose-600">
                        <ArrowDown className="w-3.5 h-3.5" /> &lt;70% Partially Met
                      </span>
                    </div>
                  </div>

                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left text-xs sm:text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-100/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 font-semibold">
                          <th className="py-3 px-4">Row Labels (Inspector)</th>
                          <th className="py-3 px-4 text-right">Checked</th>
                          <th className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400">Accept Qty</th>
                          <th className="py-3 px-4 text-right text-rose-600 dark:text-rose-400">Defect Found</th>
                          <th className="py-3 px-4 text-right">Accept %</th>
                          <th className="py-3 px-4 text-right">Defect %</th>
                          <th className="py-3 px-4">Performance Rating</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredInspectors.map((insp, idx) => (
                          <tr
                            key={idx}
                            className="hover:bg-blue-50/40 dark:hover:bg-slate-800/60 transition-colors"
                          >
                            <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-white">
                              {insp.name}
                            </td>
                            <td className="py-2.5 px-4 text-right font-medium text-slate-700 dark:text-slate-300">
                              {insp.totalChecked.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-4 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                              {insp.acceptCount.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-4 text-right font-semibold text-rose-600 dark:text-rose-400">
                              {insp.defectCount.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-4 text-right font-bold text-slate-900 dark:text-white">
                              {insp.acceptRate}%
                            </td>
                            <td className="py-2.5 px-4 text-right text-slate-500">
                              {insp.defectRate}%
                            </td>
                            <td className="py-2.5 px-4">
                              {insp.tier === 'exemplary' && (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                  <ArrowUp className="w-3.5 h-3.5 mr-1" />
                                  Exemplary performer
                                </span>
                              )}
                              {insp.tier === 'exceeded' && (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-800">
                                  <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
                                  Exceeded Performance
                                </span>
                              )}
                              {insp.tier === 'met' && (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                  <ArrowRight className="w-3.5 h-3.5 mr-1" />
                                  Met expectation
                                </span>
                              )}
                              {insp.tier === 'partially-met' && (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                                  <ArrowDown className="w-3.5 h-3.5 mr-1" />
                                  Partially met performer
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      {/* Grand Total Row */}
                      <tfoot>
                        <tr className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-slate-700">
                          <td className="py-3 px-4">Grand Total</td>
                          <td className="py-3 px-4 text-right">
                            {data?.summary?.totalChecked.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400">
                            {data?.summary?.totalAccepted.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right text-rose-600 dark:text-rose-400">
                            {data?.summary?.totalDefects.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right text-blue-600 dark:text-blue-400 font-extrabold">
                            {data?.summary?.overallAcceptRate}%
                          </td>
                          <td className="py-3 px-4 text-right text-rose-500 font-extrabold">
                            {data?.summary?.overallDefectRate}%
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300">
                              Overall Pass: {data?.summary?.overallAcceptRate}%
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 2: BIW Quality & Specific Defect Breakdown */}
              {activeTab === 'biw' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left: BIW Review Per Inspector */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Award className="w-4 h-4 text-indigo-500" />
                      LMPL BIW Secondary Review Rates
                    </h3>
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                            <th className="py-2.5 px-3">Inspector</th>
                            <th className="py-2.5 px-3 text-right">Checked</th>
                            <th className="py-2.5 px-3 text-right text-emerald-600">BIW Accept</th>
                            <th className="py-2.5 px-3 text-right text-rose-600">BIW Defect</th>
                            <th className="py-2.5 px-3 text-right font-bold">BIW Pass %</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {filteredInspectors.map((insp, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                              <td className="py-2 px-3 font-medium text-slate-900 dark:text-white">
                                {insp.name}
                              </td>
                              <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-300">
                                {insp.totalChecked}
                              </td>
                              <td className="py-2 px-3 text-right text-emerald-600 font-medium">
                                {insp.biwAcceptCount}
                              </td>
                              <td className="py-2 px-3 text-right text-rose-600 font-medium">
                                {insp.biwDefectCount}
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-slate-900 dark:text-white">
                                {insp.biwAcceptRate}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Right: Specific Defect Breakdown */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-500" />
                      Top Defect Issues Identified
                    </h3>
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                            <th className="py-2.5 px-3">Defect Category / Checkpoint</th>
                            <th className="py-2.5 px-3 text-right">Occurrences</th>
                            <th className="py-2.5 px-3 text-right">% of Total Defects</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {(data?.defectBreakdown || []).slice(0, 15).map((def, idx) => {
                            const pct = data?.summary?.totalDefects
                              ? Math.round((def.count / data.summary.totalDefects) * 100)
                              : 0;
                            return (
                              <tr key={idx} className="hover:bg-rose-50/40 dark:hover:bg-slate-800/50">
                                <td className="py-2 px-3 font-medium text-slate-900 dark:text-white">
                                  {def.name}
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-rose-600 dark:text-rose-400">
                                  {def.count}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-500">
                                  {pct}%
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: Daily Trend & Run Rate */}
              {activeTab === 'daily' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Timeline of daily production & inspection pass rates</span>
                    <span>Total Days Active: {data?.dailyTrends.length || 0}</span>
                  </div>

                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left text-xs sm:text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-100/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4 text-right">Total Checked</th>
                          <th className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400">Accepted</th>
                          <th className="py-3 px-4 text-right text-rose-600 dark:text-rose-400">Defects</th>
                          <th className="py-3 px-4 text-right text-amber-600">Rework 1</th>
                          <th className="py-3 px-4 text-right">Daily Pass Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {(data?.dailyTrends || []).map((day, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-white">
                              {day.date}
                            </td>
                            <td className="py-2.5 px-4 text-right font-medium text-slate-700 dark:text-slate-300">
                              {day.totalChecked.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-4 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                              {day.acceptCount.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-4 text-right font-semibold text-rose-600 dark:text-rose-400">
                              {day.defectCount.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-4 text-right text-amber-600">
                              {day.reworkCount}
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded font-bold text-xs ${
                                  day.passRate >= 90
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : day.passRate >= 80
                                    ? 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300'
                                    : day.passRate >= 70
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                }`}
                              >
                                {day.passRate}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-slate-700">
                          <td className="py-3 px-4">Grand Total</td>
                          <td className="py-3 px-4 text-right">
                            {data?.summary?.totalChecked.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400">
                            {data?.summary?.totalAccepted.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right text-rose-600 dark:text-rose-400">
                            {data?.summary?.totalDefects.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right text-amber-600">
                            {data?.summary?.totalRework1}
                          </td>
                          <td className="py-3 px-4 text-right text-blue-600 font-extrabold">
                            {data?.summary?.overallAcceptRate}%
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Quality Summary • {data?.summary?.totalChecked?.toLocaleString() || 0} responses
            </div>
            {loadTimeMs !== null && (
              <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                loadTimeMs < 500
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
              }`}>
                {loadTimeMs < 500 ? '⚡' : '🔄'} {loadTimeMs < 1000 ? `${loadTimeMs}ms` : `${(loadTimeMs / 1000).toFixed(1)}s`}
                {loadTimeMs < 500 && ' (cached)'}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
