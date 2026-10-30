import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  List,
  Eye,
  FileText,
  Clock,
  Layers,
  LayoutGrid,
  ChevronDown,
  X,
  PieChart as PieChartIcon
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend as ChartLegend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { apiClient } from '../../api/client';
import { OverallResponsesTable } from './OverallResponsesTable';

ChartJS.register(ArcElement, ChartTooltip, ChartLegend);

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
  formTitle?: string;
  chassisVin?: string;
  partDescription?: string;
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
  const [searchParams, setSearchParams] = useSearchParams();

  // Multi-form selection state initialized from URL query params (e.g. ?formIds=... or ?formId=...)
  const initialFormIds = useMemo(() => {
    const raw = searchParams.get('formIds') || searchParams.get('formId');
    if (raw && raw !== 'all') {
      return raw.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [];
  }, []);

  const [activeTab, setActiveTab] = useState<'tvs' | 'biw' | 'daily' | 'data' | 'overall'>('data');
  const [dateRange, setDateRange] = useState<string>('all');
  const [selectedFormIds, setSelectedFormIds] = useState<string[]>(initialFormIds);
  const [isFormDropdownOpen, setIsFormDropdownOpen] = useState<boolean>(false);
  const [formSearchQuery, setFormSearchQuery] = useState<string>('');
  const formDropdownRef = useRef<HTMLDivElement>(null);

  // Preserve all available forms and counts across filtered fetches
  const [availableFormOptions, setAvailableFormOptions] = useState<Array<{ id: string; title: string; totalChecked?: number }>>([]);
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
  const [, setLoadTimeMs] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number>(0);

  // Synchronize selected forms with URL search params
  const updateSelectedForms = (newIds: string[]) => {
    setSelectedFormIds(newIds);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (newIds.length > 0) {
        next.set('formIds', newIds.join(','));
      } else {
        next.delete('formIds');
        next.delete('formId');
      }
      return next;
    }, { replace: true });
  };

  // Filter forms list by search query AND selectedFormIds
  const filteredForms = useMemo(() => {
    if (!data?.formsSummary) return [];
    let list = data.formsSummary;
    if (selectedFormIds.length > 0) {
      list = list.filter(f => selectedFormIds.includes(f.id) || selectedFormIds.includes(f._id));
    }
    if (!searchForm.trim()) return list;
    const q = (searchForm || '').toLowerCase().trim();
    return list.filter(f => String(f.title || '').toLowerCase().includes(q));
  }, [data?.formsSummary, selectedFormIds, searchForm]);

  // BIW Tab State and Form-Related Data Memos
  const [biwInspectorSearch, setBiwInspectorSearch] = useState<string>('');

  const biwFormItems = useMemo(() => {
    if (!data?.formsSummary) return [];
    if (selectedFormIds.length === 0) return data.formsSummary;
    return data.formsSummary.filter(f => selectedFormIds.includes(f.id) || selectedFormIds.includes(f._id));
  }, [data?.formsSummary, selectedFormIds]);

  const biwOverallSummary = useMemo(() => {
    const totalAccept = biwFormItems.reduce((sum, f) => sum + (f.biwAcceptCount || 0), 0);
    const totalDefect = biwFormItems.reduce((sum, f) => sum + (f.biwDefectCount || 0), 0);
    const totalReviewed = totalAccept + totalDefect;
    const rate = totalReviewed > 0 ? Math.round((totalAccept / totalReviewed) * 10000) / 100 : 0;
    return { totalAccept, totalDefect, totalReviewed, rate };
  }, [biwFormItems]);

  const biwInspectors = useMemo(() => {
    if (!data?.inspectors) return [];
    const filtered = data.inspectors.filter(insp => (insp.biwAcceptCount > 0 || insp.biwDefectCount > 0));
    if (!biwInspectorSearch.trim()) return filtered;
    const q = biwInspectorSearch.toLowerCase().trim();
    return filtered.filter(insp => insp.name.toLowerCase().includes(q));
  }, [data?.inspectors, biwInspectorSearch]);

  // Overall Quality Pie Chart State & Real Data Sync
  const [hoveredSlice, setHoveredSlice] = useState<'all' | 'accepted' | 'rework' | 'rejected'>('all');
  const [pieSearchQuery, setPieSearchQuery] = useState<string>('');

  // Filter breakdown list strictly by selected forms (or show all if no selection)
  const filteredFormSummaryList = useMemo(() => {
    if (!data?.formsSummary) return [];
    let list = data.formsSummary;
    if (selectedFormIds.length > 0) {
      list = list.filter(f => selectedFormIds.includes(f.id) || selectedFormIds.includes(f._id));
    }
    if (!pieSearchQuery.trim()) return list;
    const q = (pieSearchQuery || '').toLowerCase().trim();
    return list.filter(f => String(f.title || '').toLowerCase().includes(q));
  }, [data?.formsSummary, selectedFormIds, pieSearchQuery]);

  const pieChartData = useMemo(() => {
    if (!data) return { labels: [], datasets: [] };

    const accepted = data.summary.totalAccepted || 0;
    const rework = data.summary.totalRework1 || 0;
    const rejected = Math.max(0, (data.summary.totalDefects || 0) - rework);

    return {
      labels: ['Accepted', 'Rework', 'Rejected'],
      datasets: [
        {
          data: [accepted, rework, rejected],
          backgroundColor: [
            hoveredSlice === 'accepted' || hoveredSlice === 'all' ? '#16a34a' : 'rgba(22, 163, 74, 0.25)',
            hoveredSlice === 'rework' || hoveredSlice === 'all' ? '#f59e0b' : 'rgba(245, 158, 11, 0.25)',
            hoveredSlice === 'rejected' || hoveredSlice === 'all' ? '#ef4444' : 'rgba(239, 68, 68, 0.25)'
          ],
          borderColor: ['#ffffff', '#ffffff', '#ffffff'],
          borderWidth: 2,
          hoverOffset: 8
        }
      ]
    };
  }, [data, hoveredSlice]);

  const pieChartOptions: any = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          titleFont: { size: 13, weight: 'bold' as const },
          bodyFont: { size: 12 },
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: (context: any) => {
              const label = context.label || '';
              const value = Number(context.raw) || 0;
              const total = data?.summary.totalChecked || 1;
              const pct = ((value / total) * 100).toFixed(2);
              return ` ${label}: ${value.toLocaleString()} (${pct}%)`;
            },
            afterBody: (context: any) => {
              if (!context || !context[0] || !data?.formsSummary) return [];
              const index = context[0].dataIndex;
              const forms = data.formsSummary;

              const lines: string[] = ['', 'Top Contributing Forms:'];
              const sorted = [...forms].sort((a, b) => {
                if (index === 0) return (b.acceptCount || 0) - (a.acceptCount || 0);
                if (index === 1) return (b.rework1Count || 0) - (a.rework1Count || 0);
                const rejA = Math.max(0, (a.defectCount || 0) - (a.rework1Count || 0));
                const rejB = Math.max(0, (b.defectCount || 0) - (b.rework1Count || 0));
                return rejB - rejA;
              });

              sorted.slice(0, 5).forEach(f => {
                let count = 0;
                if (index === 0) count = f.acceptCount || 0;
                else if (index === 1) count = f.rework1Count || 0;
                else count = Math.max(0, (f.defectCount || 0) - (f.rework1Count || 0));

                if (count > 0 || forms.length <= 2) {
                  lines.push(` • ${f.title}: ${count.toLocaleString()}`);
                }
              });

              return lines;
            }
          }
        }
      },
      onHover: (_event: any, elements: any[]) => {
        if (elements && elements.length > 0) {
          const idx = elements[0].index;
          if (idx === 0) setHoveredSlice('accepted');
          else if (idx === 1) setHoveredSlice('rework');
          else if (idx === 2) setHoveredSlice('rejected');
        }
      }
    };
  }, [data]);

  const centerTextPlugin = useMemo(
    () => ({
      id: 'qualityDonutCenterText',
      afterDatasetsDraw(chart: any) {
        const meta = chart.getDatasetMeta(0);
        if (!meta || !meta.data || !meta.data[0]) return;
        const { ctx } = chart;
        const { x, y } = meta.data[0];

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        let displayCount = data?.summary.totalAccepted || 0;
        let displayLabel = 'ACCEPTED';

        if (hoveredSlice === 'rework') {
          displayCount = data?.summary.totalRework1 || 0;
          displayLabel = 'REWORK';
        } else if (hoveredSlice === 'rejected') {
          displayCount = Math.max(0, (data?.summary.totalDefects || 0) - (data?.summary.totalRework1 || 0));
          displayLabel = 'REJECTED';
        }

        ctx.font = 'bold 22px Inter, system-ui, -apple-system, sans-serif';
        ctx.fillStyle = hoveredSlice === 'rework' ? '#d97706' : hoveredSlice === 'rejected' ? '#dc2626' : '#16a34a';
        ctx.fillText(Number(displayCount).toLocaleString(), x, y - 8);

        ctx.font = 'bold 10px Inter, system-ui, -apple-system, sans-serif';
        ctx.fillStyle = '#6b7280';
        ctx.fillText(displayLabel, x, y + 12);

        ctx.restore();
      },
    }),
    [data, hoveredSlice],
  );

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

  const fetchSummary = async (forceNetwork = true) => {
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
        formIds: selectedFormIds.length > 0 ? selectedFormIds : undefined,
        startDate,
        endDate,
        forceNetwork
      });
      
      clearInterval(timerInterval);
      const endTime = performance.now();
      setLoadTimeMs(Math.round(endTime - startTime));
      
      // Safely unwrap response whether client.ts returns payload directly or wrapped in { success, data }
      const actualData = (res && res.summary) ? res : (res && res.data) ? res.data : null;

      if (actualData && actualData.summary) {
        setData(actualData);
        if (actualData.formOptions && actualData.formOptions.length > 0) {
          setAvailableFormOptions(prev => {
            if (prev.length === 0 || selectedFormIds.length === 0) {
              return actualData.formOptions;
            }
            return prev;
          });
        }
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
    fetchSummary(true);
  }, [selectedFormIds, startDate, endDate]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (formDropdownRef.current && !formDropdownRef.current.contains(event.target as Node)) {
        setIsFormDropdownOpen(false);
      }
    };
    if (isFormDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFormDropdownOpen]);

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

  const allAvailableForms = useMemo(() => {
    if (availableFormOptions.length > 0) return availableFormOptions;
    if (data?.formOptions && data.formOptions.length > 0) return data.formOptions;
    return [];
  }, [availableFormOptions, data?.formOptions]);

  const filteredDropdownForms = useMemo(() => {
    if (!formSearchQuery.trim()) return allAvailableForms;
    const q = formSearchQuery.toLowerCase().trim();
    return allAvailableForms.filter(f => String(f.title || '').toLowerCase().includes(q));
  }, [allAvailableForms, formSearchQuery]);

  const totalAllFormsInspections = useMemo(() => {
    return allAvailableForms.reduce((sum, f) => sum + (f.totalChecked || 0), 0);
  }, [allAvailableForms]);

  const selectedFormsInspections = useMemo(() => {
    if (selectedFormIds.length === 0) return data?.summary?.totalChecked || totalAllFormsInspections;
    return allAvailableForms
      .filter(f => selectedFormIds.includes(f.id) || (f._id && selectedFormIds.includes(f._id)))
      .reduce((sum, f) => sum + (f.totalChecked || 0), 0);
  }, [selectedFormIds, allAvailableForms, data?.summary?.totalChecked, totalAllFormsInspections]);

  const formButtonLabel = useMemo(() => {
    if (selectedFormIds.length === 0) {
      return `All My Forms (${(data?.summary?.totalChecked || totalAllFormsInspections).toLocaleString()} Responses)`;
    }
    if (selectedFormIds.length === 1) {
      const single = allAvailableForms.find(f => f.id === selectedFormIds[0] || (f._id && f._id === selectedFormIds[0]));
      return single 
        ? `${single.title} (${single.totalChecked !== undefined ? single.totalChecked.toLocaleString() : '...'} inspections)`
        : '1 Form Selected';
    }
    return `${selectedFormIds.length} Forms Selected (${selectedFormsInspections.toLocaleString()} inspections)`;
  }, [selectedFormIds, allAvailableForms, data?.summary?.totalChecked, totalAllFormsInspections, selectedFormsInspections]);

  const handleToggleForm = (formId: string) => {
    const next = selectedFormIds.includes(formId)
      ? selectedFormIds.filter(id => id !== formId)
      : [...selectedFormIds, formId];
    updateSelectedForms(next);
  };

  const handleSelectAllForms = () => {
    updateSelectedForms([]);
  };

  const handleClearAllForms = () => {
    updateSelectedForms([]);
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
          {/* Multi-Form Selection Filter Dropdown */}
          <div className="relative" ref={formDropdownRef}>
            <button
              type="button"
              onClick={() => setIsFormDropdownOpen(prev => !prev)}
              className={`flex items-center justify-between gap-2 px-3 py-2 text-sm font-medium border rounded-lg bg-white shadow-xs transition-all max-w-[280px] sm:max-w-[360px] cursor-pointer hover:border-blue-400 ${
                selectedFormIds.length > 0
                  ? 'border-blue-500 ring-2 ring-blue-100 text-blue-900 bg-blue-50/20'
                  : 'border-gray-300 text-gray-800'
              }`}
              title={formButtonLabel}
            >
              <div className="flex items-center gap-2 truncate">
                <Layers className={`w-4 h-4 flex-shrink-0 ${selectedFormIds.length > 0 ? 'text-blue-600' : 'text-gray-500'}`} />
                <span className="truncate font-semibold">{formButtonLabel}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {selectedFormIds.length > 1 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-blue-600 text-white leading-none">
                    {selectedFormIds.length}
                  </span>
                )}
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isFormDropdownOpen ? 'rotate-180 text-blue-600' : ''}`} />
              </div>
            </button>

            {/* Dropdown Menu Popover */}
            {isFormDropdownOpen && (
              <div className="absolute left-0 sm:left-auto sm:right-0 mt-1.5 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                {/* Search Bar */}
                <div className="p-2.5 border-b border-gray-100 bg-gray-50/80 flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={formSearchQuery}
                      onChange={(e) => setFormSearchQuery(e.target.value)}
                      placeholder="Search forms..."
                      className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-800 placeholder-gray-400"
                      autoFocus
                    />
                    {formSearchQuery && (
                      <button
                        onClick={() => setFormSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleSelectAllForms}
                      className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 px-2 py-1 hover:bg-blue-50 rounded"
                    >
                      All
                    </button>
                    {selectedFormIds.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearAllForms}
                        className="text-[11px] font-semibold text-red-600 hover:text-red-800 px-2 py-1 hover:bg-red-50 rounded"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* Form Options List */}
                <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 p-1">
                  {/* "All My Forms" option */}
                  <div
                    onClick={handleSelectAllForms}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors text-xs font-semibold ${
                      selectedFormIds.length === 0
                        ? 'bg-blue-50 text-blue-900 font-bold'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={selectedFormIds.length === 0}
                        onClick={(e) => e.stopPropagation()}
                        onChange={handleSelectAllForms}
                        className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                      />
                      <span className="truncate">All My Forms</span>
                    </div>
                    <span className="text-[11px] font-medium text-gray-500 ml-2 whitespace-nowrap">
                      {totalAllFormsInspections.toLocaleString()} total
                    </span>
                  </div>

                  {/* Individual Forms */}
                  {filteredDropdownForms.map(f => {
                    const isSelected = selectedFormIds.includes(f.id) || (f._id && selectedFormIds.includes(f._id));
                    return (
                      <div
                        key={f.id || f._id}
                        onClick={() => handleToggleForm(f.id)}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors text-xs ${
                          isSelected
                            ? 'bg-blue-50/70 text-blue-900 font-bold'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => handleToggleForm(f.id)}
                            className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                          />
                          <span className="truncate" title={f.title}>{f.title}</span>
                        </div>
                        <span className={`text-[11px] font-semibold ml-2 whitespace-nowrap ${isSelected ? 'text-blue-700' : 'text-gray-400'}`}>
                          {f.totalChecked !== undefined ? f.totalChecked.toLocaleString() : '...'} units
                        </span>
                      </div>
                    );
                  })}

                  {filteredDropdownForms.length === 0 && (
                    <div className="py-6 text-center text-xs text-gray-400">
                      No forms matching "{formSearchQuery}"
                    </div>
                  )}
                </div>

                {/* Footer status / Done button */}
                <div className="p-2 border-t border-gray-100 bg-gray-50/80 flex items-center justify-between gap-2 text-xs">
                  <span className="text-gray-500 text-[11px] px-1 font-medium">
                    {selectedFormIds.length === 0
                      ? 'Viewing all forms'
                      : `${selectedFormIds.length} form${selectedFormIds.length > 1 ? 's' : ''} active`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsFormDropdownOpen(false)}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md shadow-xs text-xs transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>

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
            <p className="text-gray-600 font-medium">Aggregating responses...</p>
            <p className="text-xs text-gray-400 mt-2">{(elapsedMs / 1000).toFixed(1)}s elapsed</p>
          </div>
        )}

        {/* Active Filter Pill / Banner */}
        {selectedFormIds.length > 0 && (
          <div className="bg-blue-50/90 border border-blue-200 text-blue-900 px-4 py-3 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
            <div className="flex items-center gap-2 min-w-0">
              <Layers className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span className="font-semibold text-blue-800">Filtered View:</span>
              <span className="font-bold text-blue-950 truncate">{formButtonLabel}</span>
              <span className="text-blue-600 font-medium">
                ({(data?.summary?.totalChecked || 0).toLocaleString()} inspections in this selection)
              </span>
            </div>
            <button
              onClick={handleClearAllForms}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-blue-100/70 text-blue-700 font-bold rounded-lg border border-blue-300 transition-colors shadow-2xs whitespace-nowrap cursor-pointer"
              title="Show all forms"
            >
              <X className="w-3.5 h-3.5" />
              <span>Show All Forms</span>
            </button>
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

        {/* Overall Quality Pie Chart & Form-wise Real Data Sync */}
        {data && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 md:p-6 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 mb-5 border-b border-gray-100">
              <div>
                <h3 className="text-base md:text-lg font-bold text-gray-900 flex items-center gap-2">
                  <PieChartIcon className="w-5 h-5 text-blue-600" />
                  Overall Quality & Inspection Distribution
                </h3>
                <p className="text-xs md:text-sm text-gray-500 mt-0.5">
                  Aggregate status across all forms. Hover over any slice to view real-time form-wise contributions.
                </p>
              </div>

              {/* Status Filter / Focus Pills */}
              <div className="flex flex-wrap items-center gap-1.5 bg-gray-50 p-1 rounded-lg border border-gray-200">
                <button
                  type="button"
                  onClick={() => setHoveredSlice('all')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    hoveredSlice === 'all'
                      ? 'bg-white text-gray-900 shadow-xs border border-gray-200'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  All Statuses ({data.summary.totalChecked.toLocaleString()})
                </button>
                <button
                  type="button"
                  onClick={() => setHoveredSlice('accepted')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    hoveredSlice === 'accepted'
                      ? 'bg-green-600 text-white shadow-xs'
                      : 'text-green-700 hover:bg-green-50'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-green-400"></span>
                  Accepted ({data.summary.totalAccepted.toLocaleString()})
                </button>
                <button
                  type="button"
                  onClick={() => setHoveredSlice('rework')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    hoveredSlice === 'rework'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  Rework ({((data.summary.totalRework1 || 0)).toLocaleString()})
                </button>
                <button
                  type="button"
                  onClick={() => setHoveredSlice('rejected')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    hoveredSlice === 'rejected'
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'text-red-700 hover:bg-red-50'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-red-400"></span>
                  Rejected ({Math.max(0, (data.summary.totalDefects || 0) - (data.summary.totalRework1 || 0)).toLocaleString()})
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Left Column: Donut Chart with Centered Count */}
              <div 
                className="lg:col-span-4 flex flex-col items-center justify-center p-4 bg-gray-50/60 rounded-xl border border-gray-100"
                onMouseLeave={() => setHoveredSlice('all')}
              >
                <div className="relative w-56 h-56 flex items-center justify-center">
                  <Doughnut
                    data={pieChartData}
                    options={pieChartOptions}
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className={`text-2xl font-black tracking-tight ${
                      hoveredSlice === 'rework' ? 'text-amber-600' :
                      hoveredSlice === 'rejected' ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {Number(
                        hoveredSlice === 'rework'
                          ? (data.summary.totalRework1 || 0)
                          : hoveredSlice === 'rejected'
                          ? Math.max(0, (data.summary.totalDefects || 0) - (data.summary.totalRework1 || 0))
                          : (data.summary.totalAccepted || 0)
                      ).toLocaleString()}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">
                      {hoveredSlice === 'rework' ? 'REWORK' : hoveredSlice === 'rejected' ? 'REJECTED' : 'ACCEPTED'}
                    </span>
                  </div>
                </div>

                {/* Legend badges */}
                <div className="grid grid-cols-3 gap-2 w-full mt-4 text-center">
                  <div 
                    onClick={() => setHoveredSlice('accepted')}
                    className={`p-2 rounded-lg border transition-all cursor-pointer ${
                      hoveredSlice === 'accepted' ? 'border-green-400 bg-green-50 shadow-xs' : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <p className="text-[10px] uppercase font-bold text-gray-400">Accepted</p>
                    <p className="text-sm font-black text-green-600">{data.summary.overallAcceptRate}%</p>
                    <p className="text-[11px] text-gray-500 font-medium">{data.summary.totalAccepted.toLocaleString()}</p>
                  </div>

                  <div 
                    onClick={() => setHoveredSlice('rework')}
                    className={`p-2 rounded-lg border transition-all cursor-pointer ${
                      hoveredSlice === 'rework' ? 'border-amber-400 bg-amber-50 shadow-xs' : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <p className="text-[10px] uppercase font-bold text-gray-400">Rework</p>
                    <p className="text-sm font-black text-amber-600">
                      {data.summary.totalChecked > 0 ? (((data.summary.totalRework1 || 0) / data.summary.totalChecked) * 100).toFixed(2) : 0}%
                    </p>
                    <p className="text-[11px] text-gray-500 font-medium">{(data.summary.totalRework1 || 0).toLocaleString()}</p>
                  </div>

                  <div 
                    onClick={() => setHoveredSlice('rejected')}
                    className={`p-2 rounded-lg border transition-all cursor-pointer ${
                      hoveredSlice === 'rejected' ? 'border-red-400 bg-red-50 shadow-xs' : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <p className="text-[10px] uppercase font-bold text-gray-400">Rejected</p>
                    <p className="text-sm font-black text-red-600">
                      {data.summary.totalChecked > 0 ? ((Math.max(0, (data.summary.totalDefects || 0) - (data.summary.totalRework1 || 0)) / data.summary.totalChecked) * 100).toFixed(2) : 0}%
                    </p>
                    <p className="text-[11px] text-gray-500 font-medium">{Math.max(0, (data.summary.totalDefects || 0) - (data.summary.totalRework1 || 0)).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Right Column: Real-time Form-wise Sync Breakdown */}
              <div className="lg:col-span-8 flex flex-col">
                <div className="flex items-center justify-between mb-3 gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      hoveredSlice === 'accepted' ? 'bg-green-500 animate-pulse' :
                      hoveredSlice === 'rework' ? 'bg-amber-500 animate-pulse' :
                      hoveredSlice === 'rejected' ? 'bg-red-500 animate-pulse' : 'bg-blue-500'
                    }`}></span>
                    <h4 className="text-sm font-bold text-gray-800">
                      {hoveredSlice === 'accepted' && 'Form-wise Accepted Breakdown'}
                      {hoveredSlice === 'rework' && 'Form-wise Rework Breakdown'}
                      {hoveredSlice === 'rejected' && 'Form-wise Rejected Breakdown'}
                      {hoveredSlice === 'all' && (selectedFormIds.length > 0 ? 'Selected Form Quality Breakdown' : 'All Forms Quality Breakdown')}
                    </h4>
                    <span className="text-xs text-gray-400 font-normal">
                      ({filteredFormSummaryList.length} form{filteredFormSummaryList.length === 1 ? '' : 's'})
                    </span>
                  </div>

                  {/* Search filter for forms */}
                  <div className="relative w-44 md:w-52">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Filter form..."
                      value={pieSearchQuery}
                      onChange={(e) => setPieSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-2.5 py-1 text-xs bg-gray-50 border border-gray-200 rounded-md focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                {/* Form Items List */}
                <div className="max-h-64 overflow-y-auto pr-1 space-y-2">
                  {filteredFormSummaryList.map((form) => {
                    const rework = form.rework1Count || 0;
                    const rejected = Math.max(0, (form.defectCount || 0) - rework);
                    const accepted = form.acceptCount || 0;
                    const total = form.totalChecked || (accepted + rework + rejected);

                    const acceptedPct = total > 0 ? ((accepted / total) * 100).toFixed(1) : '0';
                    const reworkPct = total > 0 ? ((rework / total) * 100).toFixed(1) : '0';
                    const rejectedPct = total > 0 ? ((rejected / total) * 100).toFixed(1) : '0';

                    return (
                      <div
                        key={form.id || form._id}
                        className="p-3 bg-gray-50/70 hover:bg-blue-50/40 rounded-lg border border-gray-200/80 transition-all text-xs flex flex-col gap-1.5"
                      >
                        <div className="flex items-center justify-between font-semibold text-gray-800">
                          <span className="truncate pr-2 font-medium">{form.title}</span>
                          <span className="text-gray-500 flex-shrink-0 text-[11px]">
                            {total.toLocaleString()} units
                          </span>
                        </div>

                        {/* Progress Bar Sync */}
                        {hoveredSlice === 'all' && (
                          <div className="space-y-1">
                            <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden flex">
                              <div
                                style={{ width: `${acceptedPct}%` }}
                                className="bg-green-500 h-full"
                                title={`Accepted: ${accepted}`}
                              ></div>
                              <div
                                style={{ width: `${reworkPct}%` }}
                                className="bg-amber-400 h-full"
                                title={`Rework: ${rework}`}
                              ></div>
                              <div
                                style={{ width: `${rejectedPct}%` }}
                                className="bg-red-500 h-full"
                                title={`Rejected: ${rejected}`}
                              ></div>
                            </div>
                            <div className="flex justify-between items-center text-[10px] text-gray-500 pt-0.5">
                              <span className="text-green-700 font-bold">{accepted.toLocaleString()} Accepted ({acceptedPct}%)</span>
                              <div className="flex gap-2.5">
                                <span className={rework > 0 ? 'text-amber-700 font-semibold' : 'text-gray-400'}>{rework} Rework</span>
                                <span className={rejected > 0 ? 'text-red-700 font-semibold' : 'text-gray-400'}>{rejected} Rejected</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {hoveredSlice === 'accepted' && (
                          <div className="space-y-1">
                            <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                              <div
                                style={{ width: `${acceptedPct}%` }}
                                className="bg-green-500 h-full transition-all duration-300"
                              ></div>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="text-green-700 font-bold">{accepted.toLocaleString()} Accepted</span>
                              <span className="text-green-700 font-bold">{acceptedPct}% of form</span>
                            </div>
                          </div>
                        )}

                        {hoveredSlice === 'rework' && (
                          <div className="space-y-1">
                            <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                              <div
                                style={{ width: `${Math.min(100, Math.max(rework > 0 ? 8 : 0, Number(reworkPct)))}%` }}
                                className="bg-amber-500 h-full transition-all duration-300"
                              ></div>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="text-amber-700 font-bold">{rework.toLocaleString()} Rework</span>
                              <span className="text-amber-700 font-bold">{reworkPct}% of form</span>
                            </div>
                          </div>
                        )}

                        {hoveredSlice === 'rejected' && (
                          <div className="space-y-1">
                            <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                              <div
                                style={{ width: `${Math.min(100, Math.max(rejected > 0 ? 8 : 0, Number(rejectedPct)))}%` }}
                                className="bg-red-500 h-full transition-all duration-300"
                              ></div>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="text-red-700 font-bold">{rejected.toLocaleString()} Rejected</span>
                              <span className="text-red-700 font-bold">{rejectedPct}% of form</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
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
                Forms Data Grid ({filteredForms.length})
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
                            const isCurrentSelected = selectedFormIds.includes(form.id) || selectedFormIds.includes(form._id);
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
                                    onClick={() => handleToggleForm(form.id || form._id)}
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
                                    onClick={() => handleToggleForm(form.id || form._id)}
                                    className={`px-2 py-1 font-semibold rounded text-[11px] ${selectedFormIds.includes(form.id) || selectedFormIds.includes(form._id) ? 'bg-blue-600 text-white' : 'bg-blue-50 hover:bg-blue-100 text-blue-700'}`}
                                    title="Toggle filter"
                                  >
                                    {selectedFormIds.includes(form.id) || selectedFormIds.includes(form._id) ? '✓ Filtered' : 'Filter'}
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
                                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold ${String(row.status || '').toLowerCase().includes('ok') || String(row.status || '').toLowerCase() === 'accepted' ? 'text-green-700 bg-green-100/50' : 'text-red-700 bg-red-100/50'}`}>
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
                          .filter(i => String(i.name || '').toLowerCase().includes((searchInspector || '').toLowerCase()))
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
                <div className="p-6 space-y-6">
                  {/* Form-Related BIW Summary Banner */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-4">
                      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Total BIW Reviewed</p>
                      <p className="text-2xl font-black text-blue-950 mt-1">{biwOverallSummary.totalReviewed.toLocaleString()}</p>
                      <p className="text-[11px] text-blue-600 mt-0.5">Across {biwFormItems.length} selected form{biwFormItems.length > 1 ? 's' : ''}</p>
                    </div>

                    <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4">
                      <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">BIW Accepted</p>
                      <p className="text-2xl font-black text-emerald-800 mt-1">{biwOverallSummary.totalAccept.toLocaleString()}</p>
                      <p className="text-[11px] text-emerald-600 mt-0.5 font-bold">{biwOverallSummary.rate}% Compliance</p>
                    </div>

                    <div className="bg-red-50/60 border border-red-200 rounded-xl p-4">
                      <p className="text-xs font-semibold text-red-700 uppercase tracking-wider">BIW Defects / Rework</p>
                      <p className="text-2xl font-black text-red-700 mt-1">{biwOverallSummary.totalDefect.toLocaleString()}</p>
                      <p className="text-[11px] text-red-600 mt-0.5 font-bold">
                        {biwOverallSummary.totalReviewed > 0 
                          ? ((biwOverallSummary.totalDefect / biwOverallSummary.totalReviewed) * 100).toFixed(1) + '%' 
                          : '0%'} defect rate
                      </p>
                    </div>

                    <div className="bg-purple-50/60 border border-purple-200 rounded-xl p-4">
                      <p className="text-xs font-semibold text-purple-700 uppercase tracking-wider">Active BIW Inspectors</p>
                      <p className="text-2xl font-black text-purple-900 mt-1">{biwInspectors.length}</p>
                      <p className="text-[11px] text-purple-600 mt-0.5">Assigned to selected forms</p>
                    </div>
                  </div>

                  {/* Main Grid: Form-Wise BIW Breakdown (Left) & Top Defect Types (Right) */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {/* 1. Form-Wise BIW Review Breakdown */}
                    <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-xs flex flex-col">
                      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                        <h4 className="font-bold text-gray-900 flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-blue-600" />
                          <span>Form-Wise BIW Quality Breakdown</span>
                        </h4>
                        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                          {biwFormItems.length} Form{biwFormItems.length > 1 ? 's' : ''}
                        </span>
                      </div>

                      <div className="space-y-3.5 max-h-[460px] overflow-y-auto pr-1">
                        {biwFormItems.map((form) => {
                          const formTotal = (form.biwAcceptCount || 0) + (form.biwDefectCount || 0);
                          const passRate = formTotal > 0 ? Math.round((form.biwAcceptCount / formTotal) * 1000) / 10 : (form.totalChecked > 0 ? 100 : 0);
                          return (
                            <div key={form.id || form._id} className="p-4 rounded-xl border border-gray-200/90 hover:border-blue-300 bg-gray-50/40 hover:bg-white transition-all shadow-xs">
                              <div className="flex items-center justify-between gap-3 mb-2">
                                <div className="min-w-0">
                                  <h5 className="font-bold text-sm text-gray-900 truncate" title={form.title}>{form.title}</h5>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {formTotal > 0 ? `${formTotal.toLocaleString()} units reviewed` : `${form.totalChecked.toLocaleString()} total inspected`}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-black ${
                                    passRate >= 95 ? 'bg-green-100 text-green-800' :
                                    passRate >= 80 ? 'bg-blue-100 text-blue-800' :
                                    'bg-red-100 text-red-800'
                                  }`}>
                                    {passRate}% Rate
                                  </span>
                                  <button
                                    onClick={() => navigate(`/forms/${form.id || form._id}/analytics?tab=responses`)}
                                    className="p-1 hover:bg-gray-100 text-gray-500 hover:text-blue-600 rounded transition-colors"
                                    title="View responses"
                                  >
                                    <FileSpreadsheet className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                              {/* Progress bar */}
                              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden flex my-2">
                                <div className="bg-green-500 h-full transition-all duration-500" style={{ width: `${passRate}%` }} />
                                <div className="bg-red-500 h-full transition-all duration-500" style={{ width: `${100 - passRate}%` }} />
                              </div>

                              {/* Badges */}
                              <div className="flex items-center justify-between text-xs pt-1 text-gray-600">
                                <div className="flex items-center gap-3">
                                  <span className="font-semibold text-green-700">✓ Accepted: <b className="font-black text-green-900">{form.biwAcceptCount || 0}</b></span>
                                  <span className="font-semibold text-red-600">✕ Defects: <b className="font-black text-red-800">{form.biwDefectCount || 0}</b></span>
                                </div>
                                <span className="text-[11px] text-gray-400 font-medium">
                                  {form.totalInspectors} inspector{form.totalInspectors !== 1 ? 's' : ''}
                                </span>
                              </div>
                            </div>
                          );
                        })}

                        {biwFormItems.length === 0 && (
                          <div className="py-12 text-center text-gray-400 text-sm">
                            No forms found for the current selection.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 2. Top Defect Types & Flagged Defect Breakdown */}
                    <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-xs flex flex-col">
                      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                        <h4 className="font-bold text-gray-900 flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-red-500" />
                          <span>Top Defect Types & Flagged Issues</span>
                        </h4>
                        <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 px-2.5 py-1 rounded-full">
                          {data.defectBreakdown.length} Categories
                        </span>
                      </div>

                      <div className="max-h-[460px] overflow-y-auto pr-1 space-y-2.5">
                        {data.defectBreakdown.length > 0 ? (
                          data.defectBreakdown.map((defect, idx) => {
                            const maxCount = data.defectBreakdown[0].count;
                            const percentage = Math.max(5, (defect.count / maxCount) * 100);
                            return (
                              <div key={idx} className="bg-white p-3 rounded-xl border border-gray-200 relative overflow-hidden shadow-xs hover:border-red-200 transition-colors">
                                <div 
                                  className="absolute top-0 left-0 h-full bg-red-50/70 z-0 transition-all duration-700"
                                  style={{ width: `${percentage}%` }}
                                />
                                <div className="relative z-10 flex justify-between items-center gap-3">
                                  <span className="font-semibold text-gray-900 truncate text-xs sm:text-sm">{defect.name}</span>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="text-[11px] text-gray-500 font-medium">#{idx + 1}</span>
                                    <span className="font-black text-red-700 bg-red-100/80 border border-red-200 px-2 py-0.5 rounded-md text-xs">
                                      {defect.count}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="py-20 flex flex-col items-center justify-center text-gray-400">
                            <CheckCircle2 className="w-12 h-12 mb-3 text-green-500 opacity-70" />
                            <p className="font-medium text-gray-600">Zero defects reported for selected forms</p>
                            <p className="text-xs text-gray-400 mt-1">All inspection units meet quality standards</p>
                          </div>
                        )}
                      </div>
                    </div>

                  </div>

                  {/* 3. Inspector BIW Validation Overview */}
                  <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100">
                      <div>
                        <h4 className="font-bold text-gray-900 flex items-center gap-2">
                          <Award className="w-5 h-5 text-blue-600" />
                          <span>Inspector BIW Performance</span>
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5">Validation metrics for staff assigned to selected forms</p>
                      </div>
                      <div className="relative w-full sm:w-64">
                        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={biwInspectorSearch}
                          onChange={(e) => setBiwInspectorSearch(e.target.value)}
                          placeholder="Search inspector..."
                          className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-800 placeholder-gray-400"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[360px] overflow-y-auto pr-1">
                      {biwInspectors.map((insp, idx) => (
                        <div key={idx} className="bg-gray-50/70 p-3 rounded-xl border border-gray-200 flex items-center justify-between hover:bg-white transition-colors shadow-xs">
                          <span className="font-semibold text-gray-800 truncate text-xs max-w-[120px] sm:max-w-[140px]">{insp.name}</span>
                          <div className="flex items-center gap-2.5 text-xs">
                            <div className="text-center px-1.5 py-0.5 rounded bg-green-50 border border-green-100">
                              <p className="text-[9px] text-green-700 uppercase font-black">Acc</p>
                              <p className="font-black text-green-800">{insp.biwAcceptCount}</p>
                            </div>
                            <div className="text-center px-1.5 py-0.5 rounded bg-red-50 border border-red-100">
                              <p className="text-[9px] text-red-700 uppercase font-black">Def</p>
                              <p className="font-black text-red-700">{insp.biwDefectCount}</p>
                            </div>
                            <div className="text-center pl-2 border-l border-gray-200">
                              <p className="text-[9px] text-gray-400 uppercase font-bold">Rate</p>
                              <p className="font-black text-gray-900">{insp.biwAcceptRate}%</p>
                            </div>
                          </div>
                        </div>
                      ))}

                      {biwInspectors.length === 0 && (
                        <div className="col-span-full py-8 text-center text-xs text-gray-400">
                          No inspectors found matching "{biwInspectorSearch}"
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* OVERALL RESPONSES TABLE */}
              {activeTab === 'overall' && (
                <div className="min-h-[550px]">
                  <OverallResponsesTable 
                    rawResponses={data.rawResponses} 
                    formOptions={allAvailableForms} 
                    initialFormFilter={selectedFormIds.length === 1 ? selectedFormIds[0] : 'all'}
                    selectedFormIds={selectedFormIds}
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
