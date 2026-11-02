import React, { useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Award,
  CheckCircle2,
  Layers,
  ArrowRight,
  Clock,
  ShieldCheck,
  UserCheck,
  PieChart as PieChartIcon,
  Search,
  Filter,
  Activity,
  FileSpreadsheet
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement
);

export interface CombinedDashboardProps {
  summary: {
    totalChecked: number;
    totalAccepted: number;
    totalDefects: number;
    totalRework1: number;
    overallAcceptRate: number;
    overallDefectRate: number;
    totalInspectors: number;
    exemplaryCount?: number;
    exceededCount?: number;
    metCount?: number;
    partiallyMetCount?: number;
  };
  forms: Array<{
    id: string;
    _id?: string;
    title: string;
    totalChecked: number;
    acceptCount: number;
    defectCount: number;
    rework1Count: number;
    acceptRate: number;
    defectRate: number;
    biwAcceptCount?: number;
    biwDefectCount?: number;
    biwRate?: number;
    totalInspectors?: number;
    inspectors?: string[];
    lastInspectionDate?: string;
  }>;
  dailyTrends?: Array<{
    date: string;
    checked?: number;
    totalChecked?: number;
    accepted?: number;
    acceptCount?: number;
    defects?: number;
    defectCount?: number;
    passRate?: number;
    forms?: Record<string, { checked: number; defects: number }>;
  }>;
  defectBreakdown?: Array<{
    name: string;
    count: number;
    forms?: Record<string, number>;
  }>;
  inspectors?: Array<{
    name: string;
    totalChecked: number;
    acceptCount: number;
    defectCount: number;
    acceptRate: number;
    defectRate: number;
    performanceStatus: string;
    tier: 'exemplary' | 'exceeded' | 'met' | 'partially-met';
    arrow?: string;
    biwAcceptCount?: number;
    biwDefectCount?: number;
    biwAcceptRate?: number;
    forms?: Record<string, { checked: number; defects: number; acceptCount?: number }>;
  }>;
  recentResponses?: Array<{
    id?: string;
    date: string;
    formTitle?: string;
    chassisNumber?: string;
    submittedBy?: string;
    status?: string;
    biwReviewStatus?: string;
    defects?: string[];
  }>;
  onIsolateForm: (formId: string) => void;
}

export const CombinedDashboard: React.FC<CombinedDashboardProps> = ({
  summary,
  forms,
  dailyTrends = [],
  defectBreakdown = [],
  inspectors = [],
  recentResponses = [],
  onIsolateForm
}) => {
  // ─── 1. Combined Daily Trend Normalization (handles totalChecked & checked) ───
  const sortedTrends = useMemo(() => {
    if (!dailyTrends || dailyTrends.length === 0) return [];
    return [...dailyTrends]
      .map(t => {
        const checked = t.totalChecked ?? t.checked ?? 0;
        const defects = t.defectCount ?? t.defects ?? 0;
        const accepted = t.acceptCount ?? t.accepted ?? Math.max(0, checked - defects);
        return {
          date: t.date,
          checked,
          defects,
          accepted,
          passRate: checked > 0 ? Math.round((accepted / checked) * 1000) / 10 : 100,
          forms: t.forms
        };
      })
      .filter(t => t.checked > 0 || t.defects > 0)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-25);
  }, [dailyTrends]);

  const trendChartData = useMemo(() => {
    const labels = sortedTrends.map(t => {
      try {
        const d = new Date(t.date);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      } catch {
        return t.date;
      }
    });

    return {
      labels,
      datasets: [
        {
          label: 'Total Inspected',
          data: sortedTrends.map(t => t.checked),
          backgroundColor: '#3b82f6',
          borderRadius: 4,
          maxBarThickness: 24
        },
        {
          label: 'Defects / Rework',
          data: sortedTrends.map(t => t.defects),
          backgroundColor: '#ef4444',
          borderRadius: 4,
          maxBarThickness: 24
        }
      ]
    };
  }, [sortedTrends]);

  const trendChartOptions: any = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          boxWidth: 12,
          font: { size: 11, weight: 'bold' }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        titleFont: { size: 12, weight: 'bold' },
        bodyFont: { size: 11 },
        padding: 10,
        cornerRadius: 6,
        callbacks: {
          label: (context: any) => {
            const label = context.dataset?.label || '';
            const val = Number(context.raw) || 0;
            return ` ${label}: ${val.toLocaleString()}`;
          },
          afterBody: (context: any) => {
            if (!context || !context[0]) return [];
            const index = context[0].dataIndex;
            const trend = sortedTrends[index];
            if (!trend) return [];
            const lines: string[] = ['', 'Form-Wise Numbers:'];
            if (trend.forms && Object.keys(trend.forms).length > 0) {
              Object.entries(trend.forms).forEach(([title, stat]: [string, any]) => {
                const chk = stat.checked || 0;
                const def = stat.defects || 0;
                const pct = trend.checked > 0 ? ((chk / trend.checked) * 100).toFixed(1) : '0';
                lines.push(` • ${title}: ${chk.toLocaleString()} inspected (${pct}%)${def > 0 ? ` | ${def} def` : ''}`);
              });
            } else if (forms.length > 0) {
              forms.forEach(f => {
                const totalFormVolume = forms.reduce((s, x) => s + (x.totalChecked || 0), 0);
                const est = totalFormVolume > 0 ? Math.round((f.totalChecked / totalFormVolume) * trend.checked) : 0;
                const pct = totalFormVolume > 0 ? ((f.totalChecked / totalFormVolume) * 100).toFixed(1) : '0';
                lines.push(` • ${f.title}: ~${est.toLocaleString()} inspected (${pct}%)`);
              });
            }
            return lines;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 10 }, color: '#6b7280' }
      },
      y: {
        grid: { color: '#f3f4f6' },
        ticks: { font: { size: 10 }, color: '#6b7280', precision: 0 },
        beginAtZero: true
      }
    }
  }), [sortedTrends, forms]);

  // ─── 2. Combined BIW Review Metrics & Chart ───────────────────────────
  const combinedBiw = useMemo(() => {
    const totalAccepted = forms.reduce((sum, f) => sum + (f.biwAcceptCount || 0), 0);
    const totalDefects = forms.reduce((sum, f) => sum + (f.biwDefectCount || 0), 0);
    const totalReviewed = totalAccepted + totalDefects;
    const passRate = totalReviewed > 0 ? Math.round((totalAccepted / totalReviewed) * 10000) / 100 : (summary.totalChecked > 0 ? 100 : 0);
    return { totalAccepted, totalDefects, totalReviewed, passRate };
  }, [forms, summary.totalChecked]);

  const biwChartData = useMemo(() => {
    if (combinedBiw.totalReviewed === 0) {
      return {
        labels: ['No BIW Reviews Yet'],
        datasets: [{
          data: [1],
          backgroundColor: ['#e5e7eb'],
          borderColor: ['#ffffff'],
          borderWidth: 2
        }]
      };
    }
    return {
      labels: ['BIW Accepted', 'BIW Defects / Rework'],
      datasets: [
        {
          data: [combinedBiw.totalAccepted, combinedBiw.totalDefects],
          backgroundColor: ['#10b981', '#ef4444'],
          borderColor: ['#ffffff', '#ffffff'],
          borderWidth: 2,
          hoverOffset: 6
        }
      ]
    };
  }, [combinedBiw]);

  const biwChartOptions: any = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { boxWidth: 10, font: { size: 10, weight: 'bold' } }
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        titleFont: { size: 12, weight: 'bold' },
        bodyFont: { size: 11 },
        padding: 10,
        cornerRadius: 6,
        callbacks: {
          label: (context: any) => {
            const label = context.label || '';
            const val = Number(context.raw) || 0;
            const total = combinedBiw.totalReviewed || 1;
            const pct = ((val / total) * 100).toFixed(1);
            return ` ${label}: ${val.toLocaleString()} (${pct}%)`;
          },
          afterBody: (context: any) => {
            if (!context || !context[0]) return [];
            const isAccepted = context[0].dataIndex === 0;
            const total = isAccepted ? combinedBiw.totalAccepted : combinedBiw.totalDefects;
            const lines: string[] = ['', 'Form-Wise Numbers:'];
            forms.forEach(f => {
              const count = isAccepted ? (f.biwAcceptCount || 0) : (f.biwDefectCount || 0);
              const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0';
              lines.push(` • ${f.title}: ${count.toLocaleString()} (${pct}%)`);
            });
            return lines;
          }
        }
      }
    }
  }), [combinedBiw, forms]);

  // Center text plugin for BIW Doughnut
  const biwCenterPlugin = useMemo(() => ({
    id: 'combinedBiwCenterText',
    afterDatasetsDraw(chart: any) {
      const meta = chart.getDatasetMeta(0);
      if (!meta || !meta.data || !meta.data[0]) return;
      const { ctx } = chart;
      const { x, y } = meta.data[0];

      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 20px Inter, system-ui, sans-serif';
      ctx.fillStyle = combinedBiw.passRate >= 90 ? '#059669' : combinedBiw.passRate >= 75 ? '#2563eb' : '#dc2626';
      ctx.fillText(`${combinedBiw.passRate}%`, x, y - 6);

      ctx.font = '9px Inter, system-ui, sans-serif';
      ctx.fillStyle = '#6b7280';
      ctx.fillText('BIW PASS', x, y + 14);
      ctx.restore();
    }
  }), [combinedBiw.passRate]);

  // ─── 3. Top Defects across Combined Forms ────────────────────────────
  const topDefects = useMemo(() => {
    return defectBreakdown.slice(0, 10);
  }, [defectBreakdown]);

  const maxDefectCount = useMemo(() => {
    return topDefects.length > 0 ? Math.max(...topDefects.map(d => d.count), 1) : 1;
  }, [topDefects]);

  // ─── 4. Combined TVS Inspectors Filter ────────────────────────────────
  const formInspectorNames = useMemo(() => {
    const s = new Set<string>();
    forms.forEach(f => {
      (f.inspectors || []).forEach(name => {
        if (name) s.add(name.toLowerCase().trim());
      });
    });
    return s;
  }, [forms]);

  const combinedTvsInspectors = useMemo(() => {
    const list = formInspectorNames.size > 0
      ? inspectors.filter(i => formInspectorNames.has(String(i.name || '').toLowerCase().trim()))
      : inspectors;
    return list
      .filter(i => (i.totalChecked || 0) > 0)
      .sort((a, b) => b.totalChecked - a.totalChecked);
  }, [inspectors, formInspectorNames]);

  return (
    <div className="p-4 sm:p-6 bg-gray-50/60 space-y-6">
      
      {/* ─── Header & Form Pills ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                <BarChart3 className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-bold text-gray-900">
                Combined Multi-Form Quality & Analytics Dashboard
              </h2>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Cross-form unified quality analytics, defect trends, BIW secondary reviews, and TVS staff performance across {forms.length} selected forms.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full font-bold text-xs border border-blue-200 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              <span>{forms.length} Forms Active</span>
            </span>
            <span className="px-3 py-1 bg-green-50 text-green-700 rounded-full font-bold text-xs border border-green-200 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{(summary.totalChecked || 0).toLocaleString()} Total Units</span>
            </span>
          </div>
        </div>

        {/* Selected Forms Active Chips */}
        <div className="pt-3.5 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-500">Active Forms:</span>
          {forms.map(f => (
            <div
              key={f.id || f._id}
              className="inline-flex items-center gap-2 px-3 py-1 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg text-xs font-medium text-gray-800 transition-colors"
            >
              <span className="font-bold text-gray-900">{f.title}</span>
              <span className="px-1.5 py-0.2 rounded bg-white text-gray-600 font-semibold border border-gray-200 text-[11px]">
                {(f.totalChecked || 0).toLocaleString()} units
              </span>
              <span className={`px-1.5 py-0.2 rounded font-bold text-[10px] ${
                (f.acceptRate || 0) >= 95 ? 'bg-green-100 text-green-800' :
                (f.acceptRate || 0) >= 80 ? 'bg-blue-100 text-blue-800' :
                'bg-red-100 text-red-800'
              }`}>
                {f.acceptRate || 0}%
              </span>
              <button
                type="button"
                onClick={() => onIsolateForm(f.id || f._id || '')}
                className="ml-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer flex items-center gap-0.5"
                title="Isolate this form to its dedicated dashboard"
              >
                <span>Isolate</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Form-Wise Comparative Breakdown ─────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Form-Wise Quality & Volume Comparison</span>
          </h3>
          <span className="text-xs text-gray-500">
            Comparing {forms.length} selected forms
          </span>
        </div>

        <div className={`grid grid-cols-1 ${forms.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-3'} gap-4`}>
          {forms.map(form => {
            const passPct = form.totalChecked > 0 ? ((form.acceptCount / form.totalChecked) * 100).toFixed(1) : '0';
            const reworkPct = form.totalChecked > 0 ? (((form.rework1Count || 0) / form.totalChecked) * 100).toFixed(1) : '0';
            const rejCount = Math.max(0, (form.defectCount || 0) - (form.rework1Count || 0));
            const rejPct = form.totalChecked > 0 ? ((rejCount / form.totalChecked) * 100).toFixed(1) : '0';
            const shareOfTotal = summary.totalChecked > 0 ? (((form.totalChecked || 0) / summary.totalChecked) * 100).toFixed(1) : '0';

            return (
              <div
                key={form.id || form._id}
                className="bg-white rounded-xl border border-gray-200 hover:border-blue-300 p-5 shadow-xs transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <h4 className="font-bold text-gray-900 text-sm truncate" title={form.title}>
                        {form.title}
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {(form.totalChecked || 0).toLocaleString()} units ({shareOfTotal}% of combined volume)
                      </p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-black flex-shrink-0 ${
                      (form.acceptRate || 0) >= 95 ? 'bg-green-100 text-green-800 border border-green-200' :
                      (form.acceptRate || 0) >= 80 ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                      'bg-red-100 text-red-800 border border-red-200'
                    }`}>
                      {form.acceptRate || 0}% Pass
                    </span>
                  </div>

                  {/* Quality Multi-Segment Progress Bar */}
                  <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden flex my-3">
                    <div
                      style={{ width: `${passPct}%` }}
                      className="bg-green-500 h-full"
                      title={`Accepted: ${(form.acceptCount || 0).toLocaleString()} (${passPct}%)`}
                    />
                    <div
                      style={{ width: `${reworkPct}%` }}
                      className="bg-amber-400 h-full"
                      title={`Rework: ${(form.rework1Count || 0).toLocaleString()} (${reworkPct}%)`}
                    />
                    <div
                      style={{ width: `${rejPct}%` }}
                      className="bg-red-500 h-full"
                      title={`Rejected: ${rejCount.toLocaleString()} (${rejPct}%)`}
                    />
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-3 gap-2 py-2 text-center text-xs border-y border-gray-100 my-2">
                    <div className="bg-green-50/50 rounded-lg p-2">
                      <span className="text-[10px] text-green-700 font-bold block uppercase">Accepted</span>
                      <span className="text-sm font-black text-green-900">{(form.acceptCount || 0).toLocaleString()}</span>
                    </div>
                    <div className="bg-amber-50/50 rounded-lg p-2">
                      <span className="text-[10px] text-amber-700 font-bold block uppercase">Rework</span>
                      <span className="text-sm font-black text-amber-900">{(form.rework1Count || 0).toLocaleString()}</span>
                    </div>
                    <div className="bg-red-50/50 rounded-lg p-2">
                      <span className="text-[10px] text-red-700 font-bold block uppercase">Defects</span>
                      <span className="text-sm font-black text-red-900">{(form.defectCount || 0).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* BIW Review status */}
                  {form.biwAcceptCount !== undefined && (
                    <div className="flex items-center justify-between text-xs text-gray-600 pt-1">
                      <span className="flex items-center gap-1 text-gray-500">
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                        <span>BIW Verified:</span>
                      </span>
                      <span className="font-bold text-gray-800">
                        {form.biwAcceptCount} Acc / {form.biwDefectCount || 0} Def
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Action Footer */}
                <div className="pt-3 mt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-[11px] text-gray-400">
                    {form.totalInspectors || 0} inspector{(form.totalInspectors || 0) !== 1 ? 's' : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => onIsolateForm(form.id || form._id || '')}
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <span>View Single Dashboard</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Combined Daily Inspection & Defect Trend (Full Width) ────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100">
          <div>
            <h4 className="font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <span>Combined Daily Inspection Trend</span>
            </h4>
            <p className="text-xs text-gray-500 mt-0.5">Timeline of daily volume, defects, and pass rates across the selected forms (Hover over any bar to view form-wise breakdown)</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
              {sortedTrends.length} Active Days
            </span>
          </div>
        </div>

        <div className="h-72 relative">
          {sortedTrends.length > 0 ? (
            <Bar data={trendChartData} options={trendChartOptions} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 text-xs">
              <Clock className="w-8 h-8 mb-2 opacity-50" />
              <span>No daily trend data available for this range</span>
            </div>
          )}
        </div>
      </div>

      {/* ─── Combined Defect Distribution & Combined BIW Review ───────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Pareto Defect Breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
            <div>
              <h4 className="font-bold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span>Combined Defect Distribution (Pareto)</span>
              </h4>
              <p className="text-xs text-gray-500 mt-0.5">Ranked defect categories identified across the combined forms (Hover card to view form breakdown)</p>
            </div>
            <span className="text-xs font-semibold text-red-700 bg-red-50 px-2.5 py-1 rounded-full border border-red-100">
              {defectBreakdown.length} Categories
            </span>
          </div>

          <div className="flex-1 space-y-2.5 overflow-y-auto max-h-72 pr-1">
            {topDefects.length > 0 ? (
              topDefects.map((defect, idx) => {
                const pct = Math.max(8, (defect.count / maxDefectCount) * 100);
                const formEntries = defect.forms ? Object.entries(defect.forms) : [];
                const tooltipText = formEntries.length > 0
                  ? `${defect.name} (${defect.count} defects total):\n` + formEntries.map(([t, c]) => ` • ${t}: ${c} (${((c / defect.count) * 100).toFixed(1)}%)`).join('\n')
                  : `${defect.name}: ${defect.count} defects`;

                return (
                  <div
                    key={idx}
                    className="bg-gray-50/70 hover:bg-red-50/30 p-2.5 rounded-xl border border-gray-200 hover:border-red-300 relative overflow-hidden transition-all group cursor-default"
                    title={tooltipText}
                  >
                    <div
                      className="absolute top-0 left-0 h-full bg-red-100/60 z-0 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                    <div className="relative z-10 space-y-1.5">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-gray-400 font-bold text-[11px] w-4">#{idx + 1}</span>
                          <span className="font-semibold text-gray-900 truncate" title={defect.name}>{defect.name}</span>
                        </div>
                        <span className="font-black text-red-700 bg-white/95 border border-red-200 px-2 py-0.5 rounded text-[11px] flex-shrink-0 shadow-2xs">
                          {defect.count} defects
                        </span>
                      </div>

                      {/* Form-Wise Numbers Breakdown Badges */}
                      {formEntries.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-gray-200/50 text-[10px]">
                          <span className="text-gray-500 font-semibold">Form-Wise:</span>
                          {formEntries.map(([fTitle, fCount]) => {
                            const fPct = ((fCount / defect.count) * 100).toFixed(1);
                            return (
                              <span
                                key={fTitle}
                                className="bg-white/95 px-2 py-0.5 rounded border border-gray-200 text-gray-700 font-medium shadow-2xs flex items-center gap-1 group-hover:border-red-200"
                                title={`${fTitle}: ${fCount} defects (${fPct}%)`}
                              >
                                <span className="font-bold text-gray-900 truncate max-w-[120px]">{fTitle}:</span>
                                <span className="font-bold text-red-600">{fCount}</span>
                                <span className="text-gray-400">({fPct}%)</span>
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        forms.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-gray-200/50 text-[10px] text-gray-400">
                            <span>Forms: {forms.map(f => f.title).join(', ')}</span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 text-xs py-12">
                <CheckCircle2 className="w-8 h-8 mb-2 text-green-500 opacity-60" />
                <span>Zero defects reported across the combined forms</span>
              </div>
            )}
          </div>
        </div>

        {/* Combined BIW Review Quality Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
            <div>
              <h4 className="font-bold text-gray-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                <span>Combined BIW Review Quality Distribution</span>
              </h4>
              <p className="text-xs text-gray-500 mt-0.5">Secondary quality gate verification across selected forms (Hover over slices to see form-wise numbers)</p>
            </div>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
              {combinedBiw.passRate}% Compliance
            </span>
          </div>

          <div className="h-52 relative flex items-center justify-center my-auto">
            <Doughnut data={biwChartData} options={biwChartOptions} plugins={[biwCenterPlugin]} />
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs">
            <div className="bg-emerald-50/70 border border-emerald-100 rounded-lg p-2.5 text-center">
              <span className="text-[11px] text-emerald-700 font-semibold block uppercase">BIW Accepted</span>
              <span className="text-base font-black text-emerald-900">{combinedBiw.totalAccepted.toLocaleString()}</span>
              <span className="text-[10px] text-emerald-600 block mt-0.5 font-medium">{combinedBiw.passRate}% of reviewed</span>
            </div>
            <div className="bg-red-50/70 border border-red-100 rounded-lg p-2.5 text-center">
              <span className="text-[11px] text-red-700 font-semibold block uppercase">BIW Defects / Rework</span>
              <span className="text-base font-black text-red-900">{combinedBiw.totalDefects.toLocaleString()}</span>
              <span className="text-[10px] text-red-600 block mt-0.5 font-medium">
                {combinedBiw.totalReviewed > 0 ? (100 - combinedBiw.passRate).toFixed(1) : '0'}% of reviewed
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* ─── Combined TVS Inspector Performance ──────────────────────────── */}
      {combinedTvsInspectors.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
            <div>
              <h4 className="font-bold text-gray-900 flex items-center gap-2">
                <Award className="w-4 h-4 text-blue-600" />
                <span>Combined TVS Inspector Performance</span>
              </h4>
              <p className="text-xs text-gray-500 mt-0.5">Staff inspection output, defect detection, and quality compliance on selected forms (Hover card to see form-wise numbers)</p>
            </div>
            <span className="text-xs text-gray-500">
              Showing {Math.min(8, combinedTvsInspectors.length)} active inspectors
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {combinedTvsInspectors.slice(0, 8).map((insp, idx) => {
              const inspForms = insp.forms ? Object.entries(insp.forms) : [];
              const inspTooltip = inspForms.length > 0
                ? `Form Breakdown for ${insp.name}:\n` + inspForms.map(([fTitle, st]: [string, any]) => ` • ${fTitle}: ${st.checked} units (${st.defects} defects)`).join('\n')
                : `${insp.name}: ${insp.totalChecked} checked (${insp.defectCount} defects)`;

              return (
                <div
                  key={idx}
                  className="bg-gray-50/70 p-3.5 rounded-xl border border-gray-200 hover:bg-white hover:border-blue-300 transition-all shadow-xs flex flex-col justify-between group cursor-default"
                  title={inspTooltip}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-bold text-gray-900 truncate text-xs" title={insp.name}>
                        {insp.name}
                      </span>
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                        #{idx + 1}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between text-xs text-gray-600 mb-2">
                      <span>{insp.totalChecked} checked</span>
                      <span className="font-bold text-green-700">{insp.acceptRate}% Pass</span>
                    </div>
                  </div>

                  {/* Form-Wise inspector badges */}
                  {inspForms.length > 0 && (
                    <div className="my-1.5 pt-1.5 border-t border-gray-200/60 flex flex-wrap gap-1">
                      {inspForms.map(([fTitle, st]: [string, any]) => (
                        <span
                          key={fTitle}
                          className="text-[9px] bg-white px-1.5 py-0.5 rounded border border-gray-200 text-gray-700 font-medium truncate max-w-[130px] shadow-2xs"
                          title={`${fTitle}: ${st.checked} units checked, ${st.defects} defects`}
                        >
                          <b className="text-gray-900">{fTitle}:</b> {st.checked}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="pt-2 border-t border-gray-200/80 flex items-center justify-between text-[11px]">
                    <span className="text-gray-500">
                      <span className="text-green-700 font-bold">{insp.acceptCount}</span> / <span className="text-red-600 font-bold">{insp.defectCount}</span>
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      insp.tier === 'exemplary' ? 'bg-green-100 text-green-800' :
                      insp.tier === 'exceeded' ? 'bg-blue-100 text-blue-800' :
                      insp.tier === 'met' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {insp.performanceStatus || (insp.acceptRate >= 90 ? 'Exemplary' : 'Active')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Recent Combined Inspection Stream ──────────────────────────── */}
      {recentResponses.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
            <div>
              <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>Recent Combined Inspection Submissions</span>
              </h4>
              <p className="text-xs text-gray-500 mt-0.5">Real-time inspection events recorded across selected forms</p>
            </div>
            <span className="text-xs text-gray-400">
              Showing last {Math.min(10, recentResponses.length)} records
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                <tr>
                  <th className="px-3 py-2 font-semibold">Date & Time</th>
                  <th className="px-3 py-2 font-semibold">Form Title</th>
                  <th className="px-3 py-2 font-semibold">Chassis / VIN</th>
                  <th className="px-3 py-2 font-semibold">Inspector</th>
                  <th className="px-3 py-2 font-semibold text-center">Status</th>
                  <th className="px-3 py-2 font-semibold text-center">BIW Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentResponses.slice(0, 10).map((r, i) => {
                  const isPass = String(r.status || '').toLowerCase().includes('ok') || String(r.status || '').toLowerCase() === 'accepted';
                  return (
                    <tr key={r.id || i} className="hover:bg-blue-50/50 transition-colors">
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{r.date}</td>
                      <td className="px-3 py-2 font-semibold text-gray-900 truncate max-w-[180px]">{r.formTitle || '-'}</td>
                      <td className="px-3 py-2 font-bold text-blue-700">{r.chassisNumber || '-'}</td>
                      <td className="px-3 py-2 text-gray-700">{r.submittedBy || 'Unknown'}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          isPass ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {r.status || 'Pending'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          r.biwReviewStatus === 'Accepted' ? 'bg-green-100 text-green-800' :
                          r.biwReviewStatus === 'Rejected' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {r.biwReviewStatus || 'Pending'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
