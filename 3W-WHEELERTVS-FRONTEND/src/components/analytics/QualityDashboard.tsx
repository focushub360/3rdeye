import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  ArrowUp,
  ArrowUpRight,
  ArrowRight,
  ArrowDown,
  CheckCircle2,
  AlertTriangle,
  Award,
  BarChart3,
  RefreshCw,
  Search,
  FileSpreadsheet,
  ArrowLeft,
  Filter,
  List,
  ExternalLink,
  Eye,
  FileText,
  Users,
  Clock,
  Layers,
  LayoutGrid,
  CheckCircle,
  X
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { OverallResponsesTable } from './OverallResponsesTable';

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

export interface FormSummaryItem {
  id: string;
  _id: string;
  title: string;
  totalChecked: number;
  acceptCount: number;
  defectCount: number;
  rework1Count: number;
  biwAcceptCount: number;
  biwDefectCount: number;
  acceptRate: number;
  defectRate: number;
  totalInspectors: number;
  lastInspectionDate: string | null;
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
  formsSummary?: FormSummaryItem[];
  formOptions: Array<{ id: string; title: string; totalChecked?: number }>;
  inspectors: InspectorSummary[];
  defectBreakdown: DefectItem[];
  dailyTrends: DailyTrendItem[];
  rawResponses: RawResponse[];
}

export const QualityDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'tvs' | 'biw' | 'daily' | 'data' | 'overall'>('tvs');
  const [selectedFormId, setSelectedFormId] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [searchInspector, setSearchInspector] = useState<string>('');
  const [dataPage, setDataPage] = useState<number>(1);
  const dataItemsPerPage = 100;
  const [dataViewMode, setDataViewMode] = useState<'cards' | 'table' | 'raw'>('cards');
  const [searchForm, setSearchForm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SummaryData | null>(null);
  const [loadTimeMs, setLoadTimeMs] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number>(0);

  // Filter forms list by search query
  const filteredForms = useMemo(() => {
    if (!data?.formsSummary) return [];
    if (!searchForm.trim()) return data.formsSummary;
    const q = searchForm.toLowerCase().trim();
    return data.formsSummary.filter(f => f.title.toLowerCase().includes(q));
  }, [data?.formsSummary, searchForm]);

  // Compute start/end dates
  const { startDate, endDate } = useMemo(() => {
    if (dateRange === 'all') return { startDate: undefined, endDate: undefined };
    if (dateRange === 'custom') {
      return {
        startDate: customStartDate ? new Date(customStartDate).toISOString() : undefined,
        endDate: customEndDate ? new Date(customEndDate + 'T23:59:59.999Z').toISOString() : undefined
      };
    }
    const now = new Date();
    let start: Date;
    if (dateRange === 'today') {
      start = new Date();
      start.setHours(0, 0, 0, 0);
      return { startDate: start.toISOString(), endDate: new Date().toISOString() };
    } else if (dateRange === '7d') {
      start = new Date(now.setDate(now.getDate() - 7));
    } else if (dateRange === '30d') {
      start = new Date(now.setDate(now.getDate() - 30));
    } else {
      start = new Date(now.setDate(now.getDate() - 90));
    }
    return { startDate: start.toISOString(), endDate: new Date().toISOString() };
  }, [dateRange, customStartDate, customEndDate]);

  const fetchSummary = async (forceNetwork = false) => {
    try {
      setLoading(true);
      setError(null);
      setElapsedMs(0);
      setLoadTimeMs(null);

      const timerInterval = setInterval(() => {
        setElapsedMs(prev => prev + 100);
      }, 100);

      const startTime = performance.now();
      
      const res = await apiClient.getQualitySummary({
        formId: selectedFormId !== 'all' ? selectedFormId : undefined,
        startDate,
        endDate,
        forceNetwork
      });
      
      clearInterval(timerInterval);
      const endTime = performance.now();
      setLoadTimeMs(Math.round(endTime - startTime));
      
      if (res && res.success && res.data) {
        setData(res.data);
      } else {
        throw new Error('Invalid response structure');
      }
    } catch (err: any) {
      console.error('Error fetching quality summary:', err);
      setError(err.message || 'Failed to load summary data');
      setLoadTimeMs(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary(false);
  }, [selectedFormId, startDate, endDate]);

  const handleExportExcel = () => {
    if (!data) return;
    
    // Summary Sheet
    const summaryRows = [
      ['Quality & Performance Summary'],
      ['Generated On', new Date().toLocaleString()],
      [''],
      ['METRIC', 'VALUE'],
      ['Total Units Checked', data.summary.totalChecked],
      ['Total Units Accepted', data.summary.totalAccepted],
      ['Total Defects', data.summary.totalDefects],
      ['Overall Accept Rate', `${data.summary.overallAcceptRate}%`],
      ['Overall Defect Rate', `${data.summary.overallDefectRate}%`],
    ];

    // Staff Performance Sheet
    const staffRows = [
      ['Inspector Name', 'Total Checked', 'Accepted', 'Defects', 'Accept Rate', 'Performance Tier', 'Top Defect'],
      ...data.inspectors.map(i => [
        i.name,
        i.totalChecked,
        i.acceptCount,
        i.defectCount,
        `${i.acceptRate}%`,
        i.performanceStatus,
        i.topDefects && i.topDefects.length > 0 ? i.topDefects[0].name : 'None'
      ])
    ];

    // Raw Forms Data Sheet (Excel-Like Grid)
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

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
    const ws2 = XLSX.utils.aoa_to_sheet(staffRows);
    const ws3 = XLSX.utils.aoa_to_sheet(rawDataRows);

    XLSX.utils.book_append_sheet(wb, ws1, "Summary");
    XLSX.utils.book_append_sheet(wb, ws2, "Staff Performance");
    XLSX.utils.book_append_sheet(wb, ws3, "Raw Data");

    XLSX.writeFile(wb, `Quality_Summary_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'exemplary': return 'text-green-600 bg-green-50 border-green-200';
      case 'exceeded': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'met': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'partially-met': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const renderArrow = (arrow: string) => {
    switch (arrow) {
      case 'up': return <ArrowUp className="w-4 h-4 text-green-500" />;
      case 'up-right': return <ArrowUpRight className="w-4 h-4 text-blue-500" />;
      case 'right': return <ArrowRight className="w-4 h-4 text-yellow-500" />;
      case 'down': return <ArrowDown className="w-4 h-4 text-red-500" />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/forms/analytics')} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-blue-600" />
              Quality & Performance Dashboard
            </h1>
            <p className="text-sm text-gray-500">Live analytics across {data?.summary?.totalChecked || 0} inspections</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedFormId}
            onChange={(e) => setSelectedFormId(e.target.value)}
            className="input-field text-sm font-medium border-gray-300 py-2 rounded-lg bg-white shadow-sm"
          >
            <option value="all">All My Forms ({data?.summary?.totalChecked || 0} Responses)</option>
            {data?.formOptions?.map(f => (
              <option key={f.id} value={f.id}>
                {f.title} ({f.totalChecked !== undefined ? f.totalChecked : '...'} inspections)
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1.5 bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 shadow-sm">
            <Calendar className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="text-sm font-medium border-0 bg-transparent text-gray-700 outline-none cursor-pointer pr-2"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="custom">Custom Calendar...</option>
            </select>

            {dateRange === 'custom' && (
              <div className="flex items-center gap-1 pl-2 border-l border-gray-200">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="text-xs border border-gray-200 rounded px-1.5 py-0.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-gray-50"
                  title="From Date"
                />
                <span className="text-xs text-gray-400 font-medium">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="text-xs border border-gray-200 rounded px-1.5 py-0.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-gray-50"
                  title="To Date"
                />
                {(customStartDate || customEndDate) && (
                  <button
                    onClick={() => {
                      setCustomStartDate('');
                      setCustomEndDate('');
                    }}
                    className="p-0.5 text-gray-400 hover:text-red-500 rounded"
                    title="Clear custom dates"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => fetchSummary(true)}
            disabled={loading}
            className="p-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-50"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-sm transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Export Excel
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 md:p-6 w-full space-y-6 pb-16">
        
        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center">
            <AlertTriangle className="w-5 h-5 mr-3 text-red-500" />
            {error}
          </div>
        )}

        {/* Loading Overlay State */}
        {loading && !data && (
          <div className="flex flex-col items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mb-4" />
            <p className="text-gray-600 font-medium">Aggregating {data?.summary?.totalChecked || 'thousands of'} responses...</p>
            <p className="text-xs text-gray-400 mt-2">{(elapsedMs / 1000).toFixed(1)}s elapsed</p>
          </div>
        )}

        {/* Top Summary Metric Cards */}
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-gray-200">
              <div className="flex justify-between items-start mb-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Checked</p>
                <div className="p-1.5 bg-blue-50 rounded-lg"><CheckCircle2 className="w-4 h-4 text-blue-600" /></div>
              </div>
              <h3 className="text-3xl font-black text-gray-900">{data.summary.totalChecked}</h3>
              <p className="text-sm text-gray-500 mt-1">Across {data.summary.totalInspectors} inspectors</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-2 h-full bg-green-500"></div>
              <div className="flex justify-between items-start mb-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Accept / Pass Rate</p>
                <div className="p-1.5 bg-green-50 rounded-lg"><CheckCircle2 className="w-4 h-4 text-green-600" /></div>
              </div>
              <h3 className="text-3xl font-black text-green-600">{data.summary.overallAcceptRate}%</h3>
              <p className="text-sm text-gray-500 mt-1">{data.summary.totalAccepted} units accepted</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-2 h-full bg-red-500"></div>
              <div className="flex justify-between items-start mb-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Defect Rate</p>
                <div className="p-1.5 bg-red-50 rounded-lg"><AlertTriangle className="w-4 h-4 text-red-600" /></div>
              </div>
              <h3 className="text-3xl font-black text-red-600">{data.summary.overallDefectRate}%</h3>
              <p className="text-sm text-gray-500 mt-1">{data.summary.totalDefects} defects detected</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200">
              <div className="flex justify-between items-start mb-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Exemplary Staff</p>
                <div className="p-1.5 bg-purple-50 rounded-lg"><Award className="w-4 h-4 text-purple-600" /></div>
              </div>
              <h3 className="text-3xl font-black text-gray-900">{data.summary.exemplaryCount} <span className="text-lg font-medium text-gray-500">Staff</span></h3>
              <p className="text-sm text-gray-500 mt-1">&ge; 90% acceptance performance</p>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        {data && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col min-h-[550px]">
            <div className="flex border-b border-gray-200 bg-gray-50 overflow-x-auto">
              <button
                onClick={() => setActiveTab('data')}
                className={`flex-1 py-3 px-4 text-sm font-semibold flex items-center justify-center transition-colors whitespace-nowrap ${activeTab === 'data' ? 'bg-white text-blue-700 border-b-2 border-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Forms Data Grid ({data?.formsSummary?.length || data?.formOptions?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('tvs')}
                className={`flex-1 py-3 px-4 text-sm font-semibold flex items-center justify-center transition-colors whitespace-nowrap ${activeTab === 'tvs' ? 'bg-white text-blue-700 border-b-2 border-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <Award className="w-4 h-4 mr-2" />
                Inspector TVS Performance
              </button>
              <button
                onClick={() => setActiveTab('biw')}
                className={`flex-1 py-3 px-4 text-sm font-semibold flex items-center justify-center transition-colors whitespace-nowrap ${activeTab === 'biw' ? 'bg-white text-blue-700 border-b-2 border-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <Search className="w-4 h-4 mr-2" />
                BIW Quality & Defect Breakdown
              </button>
              <button
                onClick={() => setActiveTab('overall')}
                className={`flex-1 py-3 px-4 text-sm font-semibold flex items-center justify-center transition-colors whitespace-nowrap ${activeTab === 'overall' ? 'bg-white text-blue-700 border-b-2 border-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <List className="w-4 h-4 mr-2" />
                Overall Responses
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col bg-white">
              
              {/* FORMS DATA GRID (Each form of this login shown with summary metrics) */}
              {activeTab === 'data' && (
                <div className="flex flex-col">
                  {/* Grid Toolbar */}
                  <div className="p-3 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={searchForm}
                          onChange={(e) => setSearchForm(e.target.value)}
                          placeholder="Search forms in this login..."
                          className="pl-9 pr-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 w-64"
                        />
                      </div>
                      <span className="text-xs text-gray-500 font-medium">
                        Showing {filteredForms.length} of {data.formsSummary?.length || 0} Forms
                      </span>
                    </div>

                    {/* View Switcher: Cards vs Table vs Raw Log */}
                    <div className="flex items-center bg-gray-200 p-0.5 rounded-lg text-xs font-semibold">
                      <button
                        onClick={() => setDataViewMode('cards')}
                        className={`flex items-center px-2.5 py-1 rounded-md transition-all ${dataViewMode === 'cards' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                        title="Card Grid View"
                      >
                        <LayoutGrid className="w-3.5 h-3.5 mr-1" />
                        Forms Cards
                      </button>
                      <button
                        onClick={() => setDataViewMode('table')}
                        className={`flex items-center px-2.5 py-1 rounded-md transition-all ${dataViewMode === 'table' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                        title="Form Metrics Table"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 mr-1" />
                        Forms Table
                      </button>
                      <button
                        onClick={() => setDataViewMode('raw')}
                        className={`flex items-center px-2.5 py-1 rounded-md transition-all ${dataViewMode === 'raw' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                        title="Individual Response Records"
                      >
                        <List className="w-3.5 h-3.5 mr-1" />
                        Raw Responses ({data.rawResponses?.length || 0})
                      </button>
                    </div>
                  </div>

                  {/* 1. CARDS VIEW (Clean, unclipped responsive grid of each form) */}
                  {dataViewMode === 'cards' && (
                    <div className="p-4 md:p-6 bg-gray-50/50">
                      {filteredForms.length === 0 ? (
                        <div className="text-center py-16 text-gray-400">
                          <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                          <p className="text-sm">No forms found matching your search</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                          {filteredForms.map((form) => {
                            const isCurrentSelected = selectedFormId === form.id || selectedFormId === form._id;
                            const passRateColor =
                              form.acceptRate >= 95 ? 'text-green-600 bg-green-50 border-green-200' :
                              form.acceptRate >= 80 ? 'text-blue-600 bg-blue-50 border-blue-200' :
                              form.acceptRate > 0 ? 'text-amber-600 bg-amber-50 border-amber-200' :
                              'text-gray-500 bg-gray-50 border-gray-200';

                            const progressBg =
                              form.acceptRate >= 95 ? 'bg-green-500' :
                              form.acceptRate >= 80 ? 'bg-blue-500' :
                              form.acceptRate > 0 ? 'bg-amber-500' :
                              'bg-gray-300';

                            return (
                              <div
                                key={form.id || form._id}
                                className={`bg-white rounded-xl border p-4 sm:p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${isCurrentSelected ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-200 hover:border-gray-300'}`}
                              >
                                <div>
                                  {/* Form Header */}
                                  <div className="flex items-start justify-between gap-2 mb-3">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div className="p-2 bg-blue-50 text-blue-600 rounded-lg flex-shrink-0">
                                        <FileText className="w-5 h-5" />
                                      </div>
                                      <div className="min-w-0">
                                        <h4 className="font-bold text-gray-900 text-sm truncate" title={form.title}>
                                          {form.title}
                                        </h4>
                                        <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                                          <Clock className="w-3 h-3" />
                                          {form.lastInspectionDate ? `Last: ${form.lastInspectionDate}` : 'No submissions yet'}
                                        </p>
                                      </div>
                                    </div>
                                    <span className="text-xs font-black px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 whitespace-nowrap shadow-xs">
                                      {form.totalChecked} Checked
                                    </span>
                                  </div>

                                  {/* Pass Rate Progress */}
                                  <div className="mb-3 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                                    <div className="flex items-center justify-between text-xs mb-1.5">
                                      <span className="font-semibold text-gray-600">Pass / Accept Rate</span>
                                      <span className={`font-black px-1.5 py-0.5 rounded border text-[11px] ${passRateColor}`}>
                                        {form.acceptRate}%
                                      </span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                      <div
                                        className={`h-full rounded-full transition-all duration-500 ${progressBg}`}
                                        style={{ width: `${form.acceptRate}%` }}
                                      />
                                    </div>
                                  </div>

                                  {/* Metrics Grid */}
                                  <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
                                    <div className="bg-green-50/70 p-2 rounded-lg border border-green-100">
                                      <span className="text-[10px] text-green-700 block font-medium">Direct OK</span>
                                      <span className="font-black text-green-800 text-sm">{form.acceptCount}</span>
                                    </div>
                                    <div className="bg-red-50/70 p-2 rounded-lg border border-red-100">
                                      <span className="text-[10px] text-red-700 block font-medium">Defects</span>
                                      <span className="font-black text-red-800 text-sm">{form.defectCount}</span>
                                    </div>
                                    <div className="bg-blue-50/70 p-2 rounded-lg border border-blue-100">
                                      <span className="text-[10px] text-blue-700 block font-medium">Inspectors</span>
                                      <span className="font-black text-blue-800 text-sm">{form.totalInspectors}</span>
                                    </div>
                                  </div>

                                  {/* BIW Review Breakdown */}
                                  <div className="flex items-center justify-between text-[11px] text-gray-500 py-1.5 px-2.5 bg-gray-50 rounded-md">
                                    <span>BIW Review:</span>
                                    <span className="font-medium text-gray-700">
                                      <span className="text-green-600 font-bold">{form.biwAcceptCount}</span> Acc / <span className="text-red-600 font-bold">{form.biwDefectCount}</span> Def
                                    </span>
                                  </div>
                                </div>

                                {/* Form Action Buttons */}
                                <div className="pt-3 mt-3 border-t border-gray-100 flex items-center justify-between gap-2 text-xs">
                                  <button
                                    onClick={() => setSelectedFormId(form.id)}
                                    className={`flex-1 py-2 px-3 rounded-lg font-semibold transition-all text-center shadow-sm ${isCurrentSelected ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
                                    title="Filter dashboard metrics to this form"
                                  >
                                    {isCurrentSelected ? '✓ Filtered' : 'Filter View'}
                                  </button>
                                  <button
                                    onClick={() => navigate(`/forms/${form.id || form._id}/analytics?tab=responses`)}
                                    className="px-2.5 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/50 transition-all flex items-center gap-1 font-medium shadow-sm"
                                    title="Open full responses table"
                                  >
                                    <FileSpreadsheet className="w-3.5 h-3.5 text-green-600" />
                                    <span>Responses</span>
                                  </button>
                                  <button
                                    onClick={() => navigate(`/forms/${form.id || form._id}/preview`)}
                                    className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/50 transition-all shadow-sm"
                                    title="Preview form questions"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2. TABLE VIEW (Dense summary row per form) */}
                  {dataViewMode === 'table' && (
                    <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-gray-100 sticky top-0 z-10">
                          <tr>
                            <th className="px-3 py-2 font-bold text-gray-700 border border-gray-300 bg-gray-200/60">Form Title</th>
                            <th className="px-3 py-2 font-bold text-gray-700 border border-gray-300 bg-gray-200/60 text-center w-24">Total Checked</th>
                            <th className="px-3 py-2 font-bold text-gray-700 border border-gray-300 bg-gray-200/60 text-center w-24">Pass Rate</th>
                            <th className="px-3 py-2 font-bold text-gray-700 border border-gray-300 bg-gray-200/60 text-center w-20">Direct OK</th>
                            <th className="px-3 py-2 font-bold text-gray-700 border border-gray-300 bg-gray-200/60 text-center w-20">Defects</th>
                            <th className="px-3 py-2 font-bold text-gray-700 border border-gray-300 bg-gray-200/60 text-center w-28">BIW (Acc / Def)</th>
                            <th className="px-3 py-2 font-bold text-gray-700 border border-gray-300 bg-gray-200/60 text-center w-24">Inspectors</th>
                            <th className="px-3 py-2 font-bold text-gray-700 border border-gray-300 bg-gray-200/60 text-center w-28">Last Activity</th>
                            <th className="px-3 py-2 font-bold text-gray-700 border border-gray-300 bg-gray-200/60 text-center w-36">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white">
                          {filteredForms.map((form) => (
                            <tr key={form.id || form._id} className="hover:bg-blue-50/50 even:bg-gray-50/40 transition-colors">
                              <td className="px-3 py-2 border border-gray-300 font-semibold text-gray-900">
                                <div className="flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                  <span className="truncate">{form.title}</span>
                                </div>
                              </td>
                              <td className="px-3 py-2 border border-gray-300 text-center font-bold text-gray-800">
                                {form.totalChecked}
                              </td>
                              <td className="px-3 py-2 border border-gray-300 text-center font-bold">
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] ${form.acceptRate >= 90 ? 'text-green-700 bg-green-100' : form.acceptRate >= 70 ? 'text-amber-700 bg-amber-100' : 'text-red-700 bg-red-100'}`}>
                                  {form.acceptRate}%
                                </span>
                              </td>
                              <td className="px-3 py-2 border border-gray-300 text-center text-green-700 font-semibold">
                                {form.acceptCount}
                              </td>
                              <td className="px-3 py-2 border border-gray-300 text-center text-red-700 font-semibold">
                                {form.defectCount}
                              </td>
                              <td className="px-3 py-2 border border-gray-300 text-center text-gray-700">
                                <span className="text-green-700 font-bold">{form.biwAcceptCount}</span> / <span className="text-red-700 font-bold">{form.biwDefectCount}</span>
                              </td>
                              <td className="px-3 py-2 border border-gray-300 text-center text-gray-700">
                                {form.totalInspectors}
                              </td>
                              <td className="px-3 py-2 border border-gray-300 text-center text-gray-500 whitespace-nowrap text-[11px]">
                                {form.lastInspectionDate || '-'}
                              </td>
                              <td className="px-3 py-2 border border-gray-300 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => setSelectedFormId(form.id)}
                                    className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded text-[11px]"
                                    title="Filter view"
                                  >
                                    Filter
                                  </button>
                                  <button
                                    onClick={() => navigate(`/forms/${form.id || form._id}/analytics?tab=responses`)}
                                    className="p-1 hover:bg-gray-100 text-gray-600 rounded"
                                    title="Open Responses Table"
                                  >
                                    <FileSpreadsheet className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* 3. RAW RESPONSES LOG VIEW */}
                  {dataViewMode === 'raw' && (
                    <div className="flex flex-col">
                      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-gray-100 sticky top-0 z-10">
                            <tr>
                              <th className="px-3 py-1.5 font-bold text-gray-700 border border-gray-300 bg-gray-200/50 w-24">Date</th>
                              <th className="px-3 py-1.5 font-bold text-gray-700 border border-gray-300 bg-gray-200/50">Chassis / VIN</th>
                              <th className="px-3 py-1.5 font-bold text-gray-700 border border-gray-300 bg-gray-200/50">Inspector</th>
                              <th className="px-3 py-1.5 font-bold text-gray-700 border border-gray-300 bg-gray-200/50 w-28">Status</th>
                              <th className="px-3 py-1.5 font-bold text-gray-700 border border-gray-300 bg-gray-200/50 w-32">BIW Review</th>
                              <th className="px-3 py-1.5 font-bold text-gray-700 border border-gray-300 bg-gray-200/50">Defects Found</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white">
                            {(data.rawResponses || []).slice((dataPage - 1) * dataItemsPerPage, dataPage * dataItemsPerPage).map((row) => (
                              <tr key={row.id} className="hover:bg-blue-50 even:bg-gray-50/50 transition-colors">
                                <td className="px-3 py-1.5 border border-gray-300 whitespace-nowrap text-gray-600">{row.date}</td>
                                <td className="px-3 py-1.5 border border-gray-300 font-medium text-gray-900">{row.chassisNumber}</td>
                                <td className="px-3 py-1.5 border border-gray-300 text-gray-800">{row.submittedBy}</td>
                                <td className="px-3 py-1.5 border border-gray-300">
                                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold ${row.status.toLowerCase().includes('ok') || row.status.toLowerCase() === 'accepted' ? 'text-green-700 bg-green-100/50' : 'text-red-700 bg-red-100/50'}`}>
                                    {row.status}
                                  </span>
                                </td>
                                <td className="px-3 py-1.5 border border-gray-300">
                                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold ${row.biwReviewStatus === 'Accepted' ? 'text-green-700 bg-green-100/50' : row.biwReviewStatus === 'Rejected' ? 'text-red-700 bg-red-100/50' : 'text-gray-600 bg-gray-100'}`}>
                                    {row.biwReviewStatus}
                                  </span>
                                </td>
                                <td className="px-3 py-1.5 border border-gray-300 text-red-600 text-xs">
                                  {row.defects && row.defects.length > 0 ? row.defects.join(', ') : <span className="text-gray-400 italic">None</span>}
                                </td>
                              </tr>
                            ))}
                            {(!data.rawResponses || data.rawResponses.length === 0) && (
                              <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-gray-500 border border-gray-300">No forms data found for this selection.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      {/* Pagination */}
                      {(data.rawResponses?.length || 0) > dataItemsPerPage && (
                        <div className="p-3 border-t border-gray-200 bg-white flex items-center justify-between">
                          <div className="text-xs text-gray-500">
                            Page {dataPage} of {Math.ceil((data.rawResponses?.length || 0) / dataItemsPerPage)}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setDataPage(p => Math.max(1, p - 1))}
                              disabled={dataPage === 1}
                              className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                            >
                              Prev
                            </button>
                            <button
                              onClick={() => setDataPage(p => Math.min(Math.ceil((data.rawResponses?.length || 0) / dataItemsPerPage), p + 1))}
                              disabled={dataPage === Math.ceil((data.rawResponses?.length || 0) / dataItemsPerPage)}
                              className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* INSPECTOR TVS PERFORMANCE TAB */}
              {activeTab === 'tvs' && (
                <div className="flex flex-col">
                  <div className="p-4 border-b border-gray-100 bg-white flex justify-end">
                    <div className="relative w-64">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search inspector..."
                        value={searchInspector}
                        onChange={(e) => setSearchInspector(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                  <div className="overflow-x-auto max-h-[600px] overflow-y-auto p-0">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-3 font-semibold text-gray-700">Inspector</th>
                          <th className="px-6 py-3 font-semibold text-gray-700 text-center">Total Checked</th>
                          <th className="px-6 py-3 font-semibold text-gray-700 text-center">Pass / Fail</th>
                          <th className="px-6 py-3 font-semibold text-gray-700 text-center">Accept Rate</th>
                          <th className="px-6 py-3 font-semibold text-gray-700 text-center">Defect Rate</th>
                          <th className="px-6 py-3 font-semibold text-gray-700">Performance Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {data.inspectors
                          .filter(i => i.name.toLowerCase().includes(searchInspector.toLowerCase()))
                          .map((insp, idx) => (
                          <tr key={idx} className="hover:bg-blue-50/50 transition-colors group">
                            <td className="px-6 py-4 font-medium text-gray-900">{insp.name}</td>
                            <td className="px-6 py-4 text-center font-semibold">{insp.totalChecked}</td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <span className="text-green-600 font-medium">{insp.acceptCount}</span>
                                <span className="text-gray-300">/</span>
                                <span className="text-red-600 font-medium">{insp.defectCount}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center font-bold text-green-600">{insp.acceptRate}%</td>
                            <td className="px-6 py-4 text-center font-bold text-red-500">{insp.defectRate}%</td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${getTierColor(insp.tier)}`}>
                                {renderArrow(insp.arrow)}
                                <span className="ml-1.5">{insp.performanceStatus}</span>
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* BIW QUALITY TAB */}
              {activeTab === 'biw' && (
                <div className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    
                    {/* BIW Overview */}
                    <div className="bg-gray-50 rounded-xl p-5 border border-gray-200 flex flex-col">
                      <h4 className="font-bold text-gray-800 mb-4 flex items-center">
                        <CheckCircle2 className="w-5 h-5 text-blue-500 mr-2" />
                        BIW Validation Overview
                      </h4>
                      <div className="space-y-3">
                        {data.inspectors.slice(0, 8).map((insp, idx) => (
                          <div key={idx} className="bg-white p-3 rounded-lg border border-gray-200 flex items-center justify-between shadow-xs">
                            <span className="font-medium text-gray-700 truncate w-1/3">{insp.name}</span>
                            <div className="flex items-center gap-3 text-sm">
                              <div className="text-center">
                                <p className="text-[10px] text-gray-400 uppercase font-bold">BIW Accept</p>
                                <p className="font-bold text-green-600">{insp.biwAcceptCount}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-[10px] text-gray-400 uppercase font-bold">BIW Defect</p>
                                <p className="font-bold text-red-500">{insp.biwDefectCount}</p>
                              </div>
                              <div className="text-center pl-3 border-l border-gray-100">
                                <p className="text-[10px] text-gray-400 uppercase font-bold">Rate</p>
                                <p className="font-bold text-gray-800">{insp.biwAcceptRate}%</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Defect Breakdown */}
                    <div className="bg-gray-50 rounded-xl p-5 border border-gray-200 flex flex-col">
                      <h4 className="font-bold text-gray-800 mb-4 flex items-center">
                        <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
                        Top Defect Types
                      </h4>
                      <div className="max-h-[450px] overflow-y-auto pr-2 space-y-3">
                        {data.defectBreakdown.length > 0 ? (
                          data.defectBreakdown.map((defect, idx) => {
                            const maxCount = data.defectBreakdown[0].count;
                            const percentage = Math.max(5, (defect.count / maxCount) * 100);
                            return (
                              <div key={idx} className="bg-white p-3 rounded-lg border border-gray-200 relative overflow-hidden shadow-xs">
                                <div 
                                  className="absolute top-0 left-0 h-full bg-red-50 z-0 transition-all duration-1000"
                                  style={{ width: `${percentage}%` }}
                                ></div>
                                <div className="relative z-10 flex justify-between items-center">
                                  <span className="font-medium text-gray-800 truncate pr-4 text-sm">{defect.name}</span>
                                  <span className="font-black text-red-600 bg-red-100 px-2 py-0.5 rounded text-xs">{defect.count}</span>
                                </div>
                              </div>
                            )
                          })
                        ) : (
                          <div className="py-16 flex flex-col items-center justify-center text-gray-400">
                            <CheckCircle2 className="w-12 h-12 mb-3 text-green-400 opacity-50" />
                            <p>No defects recorded in this period</p>
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* OVERALL RESPONSES TABLE */}
              {activeTab === 'overall' && (
                <div className="min-h-[550px]">
                  <OverallResponsesTable 
                    rawResponses={data.rawResponses} 
                    formOptions={data.formOptions} 
                    initialFormFilter={selectedFormId !== 'all' ? selectedFormId : 'all'}
                  />
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
