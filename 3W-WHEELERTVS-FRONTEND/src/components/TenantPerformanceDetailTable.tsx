
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { apiClient } from "../api/client";
import { Users, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";

const getPerformanceCategory = (score: number) => {
    if (score >= 90) return "Exemplary performer";
    if (score >= 80) return "Exceeded Performance";
    if (score >= 70) return "Met expectation";
    if (score >= 60) return "Partially met performer";
    return "Not met performer";
  };

  const getCategoryBadgeColor = (score: number) => {
    if (score >= 90)
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
    if (score >= 80)
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
    if (score >= 70)
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
    if (score >= 60)
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
    return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  };

export default function TenantPerformanceDetailTable({ tenant, onBack }: { tenant: any, onBack: () => void }) {
  const [performanceTableData, setPerformanceTableData] = useState<any[]>([]);
  const [performanceTableLoading, setPerformanceTableLoading] = useState(false);
  const [perfStartDate, setPerfStartDate] = useState("");
  const [perfEndDate, setPerfEndDate] = useState("");
  const [perfInspectorSummary, setPerfInspectorSummary] = useState<any[]>([]);
  const [performancePage, setPerformancePage] = useState(1);
  const [performancePageSize, setPerformancePageSize] = useState(10);

  // Hover Breakdown Tooltip state for Reviewer Section
  const [reviewTooltip, setReviewTooltip] = useState<{
    x: number;
    y: number;
    metric: "Reviewed" | "Pending" | "Accepted" | "Rejected" | "Rework";
    userName: string;
    totalVal: number;
    formula: string;
    forms: Array<{ title: string; count: number; subDetail?: string }>;
  } | null>(null);

  const getFormListForMetric = useCallback((
    metric: "Reviewed" | "Pending" | "Accepted" | "Rejected" | "Rework",
    formBreakdown: any[],
  ) => {
    const list: Array<{ title: string; count: number; subDetail?: string }> = [];
    (formBreakdown || []).forEach((f: any) => {
      const fBiwRev = f.biwTotalReviewed || 0;
      const fTvsRev = f.tvsTotalReviewed || 0;
      const fRev = fBiwRev + fTvsRev;
      const fSub = f.totalSubmitted || 0;
      const fPend = Math.max(0, fSub - fRev);
      const fBiwAcc = f.biwAccepted || 0;
      const fTvsAcc = f.tvsAccepted || 0;
      const fAcc = fBiwAcc + fTvsAcc;
      const fBiwRej = f.biwRejected || 0;
      const fTvsRej = f.tvsRejected || 0;
      const fRej = fBiwRej + fTvsRej;
      const fBiwRew = f.biwReworked || 0;
      const fTvsRew = f.tvsReworked || 0;
      const fRew = fBiwRew + fTvsRew;

      let cnt = 0;
      let subDetail = "";
      if (metric === "Reviewed") {
        cnt = fRev;
        subDetail = `BIW: ${fBiwRev} | TVS: ${fTvsRev}`;
      } else if (metric === "Pending") {
        cnt = fPend;
        subDetail = `Submitted: ${fSub} | Reviewed: ${fRev}`;
      } else if (metric === "Accepted") {
        cnt = fAcc;
        subDetail = `BIW: ${fBiwAcc} | TVS: ${fTvsAcc}`;
      } else if (metric === "Rejected") {
        cnt = fRej;
        subDetail = `BIW: ${fBiwRej} | TVS: ${fTvsRej}`;
      } else if (metric === "Rework") {
        cnt = fRew;
        subDetail = `BIW: ${fBiwRew} | TVS: ${fTvsRew}`;
      }

      if (cnt > 0 || fSub > 0) {
        list.push({
          title: f.formTitle || "Inspection Form",
          count: cnt,
          subDetail,
        });
      }
    });
    return list;
  }, []);

  const handleReviewCellHover = useCallback((
    e: React.MouseEvent<HTMLElement>,
    metric: "Reviewed" | "Pending" | "Accepted" | "Rejected" | "Rework",
    entity: {
      name: string;
      totalSubmitted?: number;
      biwTotalReviewed?: number;
      totalReviewed?: number;
      tvsTotalReviewed?: number;
      biwAccepted?: number;
      accepted?: number;
      tvsAccepted?: number;
      biwRejected?: number;
      rejectedReview?: number;
      rejected?: number;
      tvsRejected?: number;
      biwReworked?: number;
      reworked?: number;
      rework?: number;
      tvsReworked?: number;
      formBreakdown?: any[];
    },
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const biwRev = entity.biwTotalReviewed || entity.totalReviewed || 0;
    const tvsRev = entity.tvsTotalReviewed || 0;
    const totalRev = biwRev + tvsRev;
    const sub = entity.totalSubmitted || 0;
    const pending = Math.max(0, sub - totalRev);
    const biwAcc = entity.biwAccepted ?? entity.accepted ?? 0;
    const tvsAcc = entity.tvsAccepted || 0;
    const totalAcc = biwAcc + tvsAcc;
    const biwRej = entity.biwRejected ?? entity.rejectedReview ?? entity.rejected ?? 0;
    const tvsRej = entity.tvsRejected || 0;
    const totalRej = biwRej + tvsRej;
    const biwRew = entity.biwReworked ?? entity.reworked ?? entity.rework ?? 0;
    const tvsRew = entity.tvsReworked || 0;
    const totalRew = biwRew + tvsRew;

    let totalVal = 0;
    let formula = "";
    if (metric === "Reviewed") {
      totalVal = totalRev;
      formula = `BIW Review (${biwRev}) + TVS Review (${tvsRev})`;
    } else if (metric === "Pending") {
      totalVal = pending;
      formula = `Total Submitted (${sub}) - Reviewed (${totalRev})`;
    } else if (metric === "Accepted") {
      totalVal = totalAcc;
      formula = `BIW Accepted (${biwAcc}) + TVS Accepted (${tvsAcc})`;
    } else if (metric === "Rejected") {
      totalVal = totalRej;
      formula = `BIW Rejected (${biwRej}) + TVS Rejected (${tvsRej})`;
    } else if (metric === "Rework") {
      totalVal = totalRew;
      formula = `BIW Reworked (${biwRew}) + TVS Reworked (${tvsRew})`;
    }

    const forms = getFormListForMetric(metric, entity.formBreakdown || []);

    setReviewTooltip({
      x: rect.left + rect.width / 2,
      y: rect.bottom,
      metric,
      userName: entity.name,
      totalVal,
      formula,
      forms,
    });
  }, [getFormListForMetric]);
  
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const fetchAllData = async () => {
      setPerformanceTableLoading(true);
      setPerformanceTableData([]); // Clear previous data

      try {
        // Step 1: Fetch Inspector Summary
        let summaryUrl = `/analytics/inspector-summary`;
        const summaryParams = new URLSearchParams();
        if (perfStartDate) summaryParams.append("startDate", perfStartDate);
        if (perfEndDate) summaryParams.append("endDate", perfEndDate);
        summaryParams.append("tenantId", tenant._id);
        
        const summaryQueryString = summaryParams.toString();
        if (summaryQueryString) summaryUrl += `?${summaryQueryString}`;
        
        const summaryResponse = await apiClient.get<any>(summaryUrl, { signal });
        if (signal.aborted) return;

        const summaryData = summaryResponse.data?.summary || [];
        const dispatchMap = new Map<string, number>();
        summaryData.forEach((item: any) => {
          const userName = item.qcInspector;
          if (userName && item.statusCounts?.Dispatched) {
            const currentCount = dispatchMap.get(userName) || 0;
            dispatchMap.set(
              userName,
              currentCount + (item.statusCounts.Dispatched || 0),
            );
          }
        });

        // Step 2: Fetch Performance Table
        const tableResponse = await apiClient.getPerformanceTable({
          startDate: perfStartDate,
          endDate: perfEndDate,
          tenantId: tenant._id
        }, { signal });
        
        if (signal.aborted) return;

        if (tableResponse.success) {
          const mergedData = tableResponse.data.map((row: any) => ({
            ...row,
            dispatched: dispatchMap.get(row.name) || row.dispatched || 0,
          }));
          setPerformanceTableData(mergedData);
        }

      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error("Error fetching performance data:", error);
        }
      } finally {
        if (!signal.aborted) {
          setPerformanceTableLoading(false);
        }
      }
    };

    fetchAllData();

    return () => {
      controller.abort();
    };
  }, [tenant._id, perfStartDate, perfEndDate]);

  const total = useMemo(() => {
    const res = performanceTableData.reduce(
      (acc, user) => {
        acc.dispatchPending += user.dispatched || 0;
        acc.totalSubmitted += user.totalSubmitted || 0;
        acc.totalReviewed += user.totalReviewed || user.biwTotalReviewed || 0;
        acc.reviewPending += user.reviewPending || user.biwReviewPending || 0;
        acc.accepted += user.accepted || user.biwAccepted || 0;
        acc.rejected += user.rejectedReview ?? user.rejected ?? user.biwRejected ?? 0;
        acc.reworked += user.reworked ?? user.rework ?? user.biwReworked ?? 0;
        acc.tvsTotalReviewed += user.tvsTotalReviewed || 0;
        acc.tvsReviewPending += user.tvsReviewPending || Math.max(0, (user.totalSubmitted || 0) - (user.tvsTotalReviewed || 0));
        acc.tvsAccepted += user.tvsAccepted || 0;
        acc.tvsRejected += user.tvsRejected || 0;
        acc.tvsReworked += user.tvsReworked || 0;
        const uRev = (user.totalReviewed || user.biwTotalReviewed || 0) + (user.tvsTotalReviewed || 0);
        acc.reviewedTotal += uRev;
        acc.reviewedPending += Math.max(0, (user.totalSubmitted || 0) - uRev);
        acc.reviewedAccepted += (user.accepted || user.biwAccepted || 0) + (user.tvsAccepted || 0);
        acc.reviewedRejected += (user.rejectedReview ?? user.rejected ?? user.biwRejected ?? 0) + (user.tvsRejected || 0);
        acc.reviewedRework += (user.reworked ?? user.rework ?? user.biwReworked ?? 0) + (user.tvsReworked || 0);

        if (user.formBreakdown && Array.isArray(user.formBreakdown)) {
          user.formBreakdown.forEach((fb: any) => {
            const fid = fb.formId || fb.formTitle || "unknown";
            if (!acc.formBreakdownMap[fid]) {
              acc.formBreakdownMap[fid] = {
                formId: fid,
                formTitle: fb.formTitle || "Inspection Form",
                formTenantName: fb.formTenantName || "",
                totalSubmitted: 0,
                biwTotalReviewed: 0,
                biwAccepted: 0,
                biwRejected: 0,
                biwReworked: 0,
                tvsTotalReviewed: 0,
                tvsAccepted: 0,
                tvsRejected: 0,
                tvsReworked: 0,
              };
            }
            const tgt = acc.formBreakdownMap[fid];
            tgt.totalSubmitted += fb.totalSubmitted || 0;
            tgt.biwTotalReviewed += fb.biwTotalReviewed || 0;
            tgt.biwAccepted += fb.biwAccepted || 0;
            tgt.biwRejected += fb.biwRejected || 0;
            tgt.biwReworked += fb.biwReworked || 0;
            tgt.tvsTotalReviewed += fb.tvsTotalReviewed || 0;
            tgt.tvsAccepted += fb.tvsAccepted || 0;
            tgt.tvsRejected += fb.tvsRejected || 0;
            tgt.tvsReworked += fb.tvsReworked || 0;
          });
        }
        return acc;
      },
      {
        dispatchPending: 0,
        totalSubmitted: 0,
        totalReviewed: 0,
        reviewPending: 0,
        accepted: 0,
        rejected: 0,
        reworked: 0,
        tvsTotalReviewed: 0,
        tvsReviewPending: 0,
        tvsAccepted: 0,
        tvsRejected: 0,
        tvsReworked: 0,
        reviewedTotal: 0,
        reviewedPending: 0,
        reviewedAccepted: 0,
        reviewedRejected: 0,
        reviewedRework: 0,
        formBreakdownMap: {} as Record<string, any>,
      },
    );
    return {
      ...res,
      formBreakdown: Object.values(res.formBreakdownMap),
    };
  }, [performanceTableData]);

  const totalPerformanceScore = useMemo(() =>
    performanceTableData.length > 0
      ? Math.round(
          performanceTableData.reduce(
            (sum, user) => sum + (user.performanceScore || 0),
            0,
          ) / performanceTableData.length,
        )
      : 0, [performanceTableData]);
    
  const totalPages = Math.ceil(performanceTableData.length / performancePageSize);
  const paginatedData = useMemo(() => performanceTableData.slice(
    (performancePage - 1) * performancePageSize,
    performancePage * performancePageSize,
  ), [performanceTableData, performancePage, performancePageSize]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8">
        <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-primary-600 to-primary-700 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/20">
                        <Users className="w-7 h-7 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl lg:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                            {tenant.companyName}
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Per-user performance data
                        </p>
                    </div>
                </div>
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all text-sm"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </button>
            </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-lg shadow-gray-200/50 dark:shadow-none overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 p-6 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-purple-600 rounded-full"></div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-white leading-none">
              Performance Table
            </h3>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex items-center bg-gray-50 dark:bg-gray-900/50 rounded-xl px-4 py-2 border border-gray-200 dark:border-gray-700 focus-within:ring-2 focus-within:ring-purple-500 transition-all">
              <span className="text-[10px] font-black text-gray-400 mr-3 uppercase tracking-wider">
                From
              </span>
              <input
                type="date"
                value={perfStartDate}
                onChange={(e) => setPerfStartDate(e.target.value)}
                className="bg-transparent text-sm font-bold text-gray-700 dark:text-gray-200 focus:outline-none w-full"
              />
            </div>
            <div className="flex items-center bg-gray-50 dark:bg-gray-900/50 rounded-xl px-4 py-2 border border-gray-200 dark:border-gray-700 focus-within:ring-2 focus-within:ring-purple-500 transition-all">
              <span className="text-[10px] font-black text-gray-400 mr-3 uppercase tracking-wider">
                To
              </span>
              <input
                type="date"
                value={perfEndDate}
                onChange={(e) => setPerfEndDate(e.target.value)}
                className="bg-transparent text-sm font-bold text-gray-700 dark:text-gray-200 focus:outline-none w-full"
              />
            </div>
            {(perfStartDate || perfEndDate) && (
              <button
                onClick={() => {
                  setPerfStartDate("");
                  setPerfEndDate("");
                }}
                className="px-4 py-2 text-xs font-black text-rose-600 hover:text-rose-700 bg-rose-50 dark:bg-rose-900/20 rounded-xl transition-colors uppercase tracking-widest"
              >
                Clear
              </button>
            )}
          </div>
        </div>

            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
            <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-gray-50/90 dark:bg-gray-700/90 backdrop-blur-md sticky top-0 z-10 text-gray-500 dark:text-gray-400 uppercase text-[10px] font-black tracking-[0.1em]">
              <tr className="border-b border-gray-200 dark:border-gray-600 text-[9px] font-black">
                <th colSpan={3} className="px-4 py-2 bg-gray-100/70 dark:bg-gray-800/70 text-gray-500 dark:text-gray-400 text-left tracking-widest uppercase border-r border-gray-200 dark:border-gray-700">
                  Inspection & Submissions
                </th>
                <th colSpan={5} className="px-4 py-2 bg-purple-100/80 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-center tracking-widest uppercase border-x-2 border-purple-300 dark:border-purple-600 shadow-sm">
                  ✦ BIW Review Section ✦
                </th>
                <th colSpan={5} className="px-4 py-2 bg-blue-100/80 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-center tracking-widest uppercase border-x-2 border-blue-300 dark:border-blue-600 shadow-sm">
                  ✦ TVS Review Section ✦
                </th>
                <th colSpan={5} className="px-4 py-2 bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 text-center tracking-widest uppercase border-x-2 border-emerald-300 dark:border-emerald-600 shadow-sm">
                  ✦ Reviewer Section ✦
                </th>
                <th colSpan={2} className="px-4 py-2 bg-gray-100/70 dark:bg-gray-800/70 text-gray-500 dark:text-gray-400 text-center tracking-widest uppercase border-l border-gray-200 dark:border-gray-700">
                  Evaluation
                </th>
              </tr>
              <tr>
                <th className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">User Name</th>
                <th className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 text-center">Dispatch Pending</th>
                <th className="px-4 py-3 border-b border-r border-gray-100 dark:border-gray-700 text-center">Total Submitted</th>
                {/* BIW Review Section Columns */}
                <th className="px-4 py-3 border-b border-l border-purple-200 dark:border-purple-800 bg-purple-50/60 dark:bg-purple-950/30 text-center text-purple-800 dark:text-purple-200">Total Reviewed</th>
                <th className="px-4 py-3 border-b bg-purple-50/60 dark:bg-purple-950/30 text-center text-amber-600 dark:text-amber-400">Review Pending</th>
                <th className="px-4 py-3 border-b bg-purple-50/60 dark:bg-purple-950/30 text-center text-emerald-600 dark:text-emerald-400 font-extrabold">BIW Accepted</th>
                <th className="px-4 py-3 border-b bg-purple-50/60 dark:bg-purple-950/30 text-center text-rose-600 dark:text-rose-400 font-extrabold">BIW Rejected</th>
                <th className="px-4 py-3 border-b border-r border-purple-200 dark:border-purple-800 bg-purple-50/60 dark:bg-purple-950/30 text-center text-amber-600 dark:text-amber-400 font-extrabold">BIW Reworked</th>
                {/* TVS Review Section Columns */}
                <th className="px-4 py-3 border-b border-l border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/30 text-center text-blue-800 dark:text-blue-200">TVS Reviewed</th>
                <th className="px-4 py-3 border-b bg-blue-50/60 dark:bg-blue-950/30 text-center text-amber-600 dark:text-amber-400">TVS Pending</th>
                <th className="px-4 py-3 border-b bg-blue-50/60 dark:bg-blue-950/30 text-center text-emerald-600 dark:text-emerald-400 font-extrabold">TVS Accepted</th>
                <th className="px-4 py-3 border-b bg-blue-50/60 dark:bg-blue-950/30 text-center text-rose-600 dark:text-rose-400 font-extrabold">TVS Rejected</th>
                <th className="px-4 py-3 border-b border-r border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/30 text-center text-amber-600 dark:text-amber-400 font-extrabold">TVS Rework</th>
                {/* Reviewed Section Columns */}
                <th className="px-4 py-3 border-b border-l border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30 text-center text-emerald-800 dark:text-emerald-200">Reviewed</th>
                <th className="px-4 py-3 border-b bg-emerald-50/60 dark:bg-emerald-950/30 text-center text-amber-600 dark:text-amber-400">Pending</th>
                <th className="px-4 py-3 border-b bg-emerald-50/60 dark:bg-emerald-950/30 text-center text-emerald-600 dark:text-emerald-400 font-extrabold">Accepted</th>
                <th className="px-4 py-3 border-b bg-emerald-50/60 dark:bg-emerald-950/30 text-center text-rose-600 dark:text-rose-400 font-extrabold">Rejected</th>
                <th className="px-4 py-3 border-b border-r border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30 text-center text-amber-600 dark:text-amber-400 font-extrabold">Rework</th>
                <th className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 text-center">Performance Score</th>
                <th className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 text-center">Performance Category</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {performanceTableLoading ? (
                    <tr>
                        <td colSpan={15} className="text-center py-16">
                            <div className="animate-spin rounded-full h-8 w-8 border-4 border-purple-600 border-t-transparent mx-auto mb-4"></div>
                            <p className="text-gray-500 text-sm">Loading performance data...</p>
                        </td>
                    </tr>
                ) : paginatedData.length === 0 ? (
                    <tr>
                        <td colSpan={15} className="text-center py-16">
                            <Users className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white">No User Data</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">No performance data found for the selected period.</p>
                        </td>
                    </tr>
                ) : (
                    <>
                    {paginatedData.map((user, idx) => (
                        <tr key={user.userId || idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/20 transition-colors">
                        <td className="px-4 py-4 font-bold text-gray-800 dark:text-white whitespace-nowrap">{user.name}</td>
                        <td className="px-4 py-4 text-center font-bold text-blue-600 dark:text-blue-400 tabular-nums">{user.dispatched || 0}</td>
                        <td className="px-4 py-4 text-center font-bold text-gray-700 dark:text-gray-300 tabular-nums border-r border-gray-100 dark:border-gray-700">{user.totalSubmitted}</td>
                        {/* BIW Review row cells */}
                        <td className="px-4 py-4 text-center font-bold text-purple-900 dark:text-purple-200 tabular-nums bg-purple-50/25 dark:bg-purple-950/10 border-l border-purple-100 dark:border-purple-900/30">{user.biwTotalReviewed ?? user.totalReviewed ?? 0}</td>
                        <td className="px-4 py-4 text-center font-bold text-gray-700 dark:text-gray-300 tabular-nums bg-purple-50/25 dark:bg-purple-950/10">{user.biwReviewPending ?? user.reviewPending ?? 0}</td>
                        <td className="px-4 py-4 text-center font-extrabold text-emerald-600 dark:text-emerald-500 tabular-nums bg-purple-50/25 dark:bg-purple-950/10">{user.biwAccepted ?? user.accepted ?? 0}</td>
                        <td className="px-4 py-4 text-center font-extrabold text-rose-600 dark:text-rose-500 tabular-nums bg-purple-50/25 dark:bg-purple-950/10">{user.biwRejected ?? user.rejectedReview ?? user.rejected ?? 0}</td>
                        <td className="px-4 py-4 text-center font-extrabold text-amber-600 dark:text-amber-500 tabular-nums bg-purple-50/25 dark:bg-purple-950/10 border-r border-purple-100 dark:border-purple-900/30">{user.biwReworked ?? user.reworked ?? user.rework ?? 0}</td>
                        {/* TVS Review row cells */}
                        <td className="px-4 py-4 text-center font-bold text-blue-900 dark:text-blue-200 tabular-nums bg-blue-50/25 dark:bg-blue-950/10 border-l border-blue-100 dark:border-blue-900/30">{user.tvsTotalReviewed ?? 0}</td>
                        <td className="px-4 py-4 text-center font-bold text-gray-700 dark:text-gray-300 tabular-nums bg-blue-50/25 dark:bg-blue-950/10">{user.tvsReviewPending ?? Math.max(0, (user.totalSubmitted || 0) - (user.tvsTotalReviewed || 0))}</td>
                        <td className="px-4 py-4 text-center font-extrabold text-emerald-600 dark:text-emerald-500 tabular-nums bg-blue-50/25 dark:bg-blue-950/10">{user.tvsAccepted ?? 0}</td>
                        <td className="px-4 py-4 text-center font-extrabold text-rose-600 dark:text-rose-500 tabular-nums bg-blue-50/25 dark:bg-blue-950/10">{user.tvsRejected ?? 0}</td>
                        <td className="px-4 py-4 text-center font-extrabold text-amber-600 dark:text-amber-500 tabular-nums bg-blue-50/25 dark:bg-blue-950/10 border-r border-blue-100 dark:border-blue-900/30">{user.tvsReworked ?? 0}</td>
                        {/* Reviewed Section row cells */}
                        {(() => {
                          const uRev = (user.biwTotalReviewed ?? user.totalReviewed ?? 0) + (user.tvsTotalReviewed || 0);
                          const uPend = Math.max(0, (user.totalSubmitted || 0) - uRev);
                          const uAcc = (user.biwAccepted ?? user.accepted ?? 0) + (user.tvsAccepted || 0);
                          const uRej = (user.biwRejected ?? user.rejectedReview ?? user.rejected ?? 0) + (user.tvsRejected || 0);
                          const uRew = (user.biwReworked ?? user.reworked ?? user.rework ?? 0) + (user.tvsReworked || 0);
                          return (
                            <>
                              <td 
                                className="px-4 py-4 text-center font-bold text-emerald-900 dark:text-emerald-200 tabular-nums bg-emerald-50/25 dark:bg-emerald-950/10 border-l border-emerald-100 dark:border-emerald-900/30 cursor-help transition-colors hover:bg-emerald-100/80 dark:hover:bg-emerald-900/60"
                                onMouseEnter={(e) => handleReviewCellHover(e, "Reviewed", user)}
                                onMouseLeave={() => setReviewTooltip(null)}
                              >
                                {uRev}
                              </td>
                              <td 
                                className="px-4 py-4 text-center font-bold text-amber-600 dark:text-amber-400 tabular-nums bg-emerald-50/25 dark:bg-emerald-950/10 cursor-help transition-colors hover:bg-emerald-100/80 dark:hover:bg-emerald-900/60"
                                onMouseEnter={(e) => handleReviewCellHover(e, "Pending", user)}
                                onMouseLeave={() => setReviewTooltip(null)}
                              >
                                {uPend}
                              </td>
                              <td 
                                className="px-4 py-4 text-center font-extrabold text-emerald-600 dark:text-emerald-500 tabular-nums bg-emerald-50/25 dark:bg-emerald-950/10 cursor-help transition-colors hover:bg-emerald-100/80 dark:hover:bg-emerald-900/60"
                                onMouseEnter={(e) => handleReviewCellHover(e, "Accepted", user)}
                                onMouseLeave={() => setReviewTooltip(null)}
                              >
                                {uAcc}
                              </td>
                              <td 
                                className="px-4 py-4 text-center font-extrabold text-rose-600 dark:text-rose-500 tabular-nums bg-emerald-50/25 dark:bg-emerald-950/10 cursor-help transition-colors hover:bg-emerald-100/80 dark:hover:bg-emerald-900/60"
                                onMouseEnter={(e) => handleReviewCellHover(e, "Rejected", user)}
                                onMouseLeave={() => setReviewTooltip(null)}
                              >
                                {uRej}
                              </td>
                              <td 
                                className="px-4 py-4 text-center font-extrabold text-amber-600 dark:text-amber-500 tabular-nums bg-emerald-50/25 dark:bg-emerald-950/10 border-r border-emerald-100 dark:border-emerald-900/30 cursor-help transition-colors hover:bg-emerald-100/80 dark:hover:bg-emerald-900/60"
                                onMouseEnter={(e) => handleReviewCellHover(e, "Rework", user)}
                                onMouseLeave={() => setReviewTooltip(null)}
                              >
                                {uRew}
                              </td>
                            </>
                          );
                        })()}
                        <td className="px-4 py-4 text-center font-black tabular-nums">{user.performanceScore}%</td>
                        <td className="px-4 py-4 text-center whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${getCategoryBadgeColor(user.performanceScore)}`}>
                            {getPerformanceCategory(user.performanceScore)}
                            </span>
                        </td>
                        </tr>
                    ))}
                    </>
                )}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100/80 dark:bg-gray-800/50 font-black text-gray-800 dark:text-white">
                <td className="px-4 py-4 border-t border-gray-200 dark:border-gray-700 text-xs uppercase tracking-widest">Total</td>
                <td className="px-4 py-4 border-t border-gray-200 dark:border-gray-700 text-center tabular-nums">{total.dispatchPending}</td>
                <td className="px-4 py-4 border-t border-r border-gray-200 dark:border-gray-700 text-center tabular-nums">{total.totalSubmitted}</td>
                {/* BIW Review footer cells */}
                <td className="px-4 py-4 border-t border-l border-purple-300 dark:border-purple-700 bg-purple-100/70 dark:bg-purple-900/40 text-center tabular-nums text-purple-900 dark:text-purple-200">{total.totalReviewed}</td>
                <td className="px-4 py-4 border-t bg-purple-100/70 dark:bg-purple-900/40 text-center tabular-nums text-amber-700 dark:text-amber-300">{total.reviewPending}</td>
                <td className="px-4 py-4 border-t bg-purple-100/70 dark:bg-purple-900/40 text-center text-emerald-600 tabular-nums font-extrabold">{total.accepted}</td>
                <td className="px-4 py-4 border-t bg-purple-100/70 dark:bg-purple-900/40 text-center text-rose-600 tabular-nums font-extrabold">{total.rejected}</td>
                <td className="px-4 py-4 border-t border-r border-purple-300 dark:border-purple-700 bg-purple-100/70 dark:bg-purple-900/40 text-center text-amber-600 tabular-nums font-extrabold">{total.reworked}</td>
                {/* TVS Review footer cells */}
                <td className="px-4 py-4 border-t border-l border-blue-300 dark:border-blue-700 bg-blue-100/70 dark:bg-blue-900/40 text-center tabular-nums text-blue-900 dark:text-blue-200">{total.tvsTotalReviewed}</td>
                <td className="px-4 py-4 border-t bg-blue-100/70 dark:bg-blue-900/40 text-center tabular-nums text-amber-700 dark:text-amber-300">{total.tvsReviewPending}</td>
                <td className="px-4 py-4 border-t bg-blue-100/70 dark:bg-blue-900/40 text-center text-emerald-600 tabular-nums font-extrabold">{total.tvsAccepted}</td>
                <td className="px-4 py-4 border-t bg-blue-100/70 dark:bg-blue-900/40 text-center text-rose-600 tabular-nums font-extrabold">{total.tvsRejected}</td>
                <td className="px-4 py-4 border-t border-r border-blue-300 dark:border-blue-700 bg-blue-100/70 dark:bg-blue-900/40 text-center text-amber-600 tabular-nums font-extrabold">{total.tvsReworked}</td>
                {/* Reviewed Section footer cells */}
                <td 
                  className="px-4 py-4 border-t border-l border-emerald-300 dark:border-emerald-700 bg-emerald-100/70 dark:bg-emerald-900/40 text-center tabular-nums text-emerald-900 dark:text-emerald-200 cursor-help transition-colors hover:bg-emerald-200/80 dark:hover:bg-emerald-800/80"
                  onMouseEnter={(e) => handleReviewCellHover(e, "Reviewed", {
                    name: `${tenant?.name || "Plant"} (Total)`,
                    totalSubmitted: total.totalSubmitted,
                    biwTotalReviewed: total.totalReviewed,
                    tvsTotalReviewed: total.tvsTotalReviewed,
                    biwAccepted: total.accepted,
                    tvsAccepted: total.tvsAccepted,
                    biwRejected: total.rejected,
                    tvsRejected: total.tvsRejected,
                    biwReworked: total.reworked,
                    tvsReworked: total.tvsReworked,
                    formBreakdown: total.formBreakdown,
                  })}
                  onMouseLeave={() => setReviewTooltip(null)}
                >
                  {total.reviewedTotal}
                </td>
                <td 
                  className="px-4 py-4 border-t bg-emerald-100/70 dark:bg-emerald-900/40 text-center tabular-nums text-amber-700 dark:text-amber-300 cursor-help transition-colors hover:bg-emerald-200/80 dark:hover:bg-emerald-800/80"
                  onMouseEnter={(e) => handleReviewCellHover(e, "Pending", {
                    name: `${tenant?.name || "Plant"} (Total)`,
                    totalSubmitted: total.totalSubmitted,
                    biwTotalReviewed: total.totalReviewed,
                    tvsTotalReviewed: total.tvsTotalReviewed,
                    biwAccepted: total.accepted,
                    tvsAccepted: total.tvsAccepted,
                    biwRejected: total.rejected,
                    tvsRejected: total.tvsRejected,
                    biwReworked: total.reworked,
                    tvsReworked: total.tvsReworked,
                    formBreakdown: total.formBreakdown,
                  })}
                  onMouseLeave={() => setReviewTooltip(null)}
                >
                  {total.reviewedPending}
                </td>
                <td 
                  className="px-4 py-4 border-t bg-emerald-100/70 dark:bg-emerald-900/40 text-center text-emerald-600 tabular-nums font-extrabold cursor-help transition-colors hover:bg-emerald-200/80 dark:hover:bg-emerald-800/80"
                  onMouseEnter={(e) => handleReviewCellHover(e, "Accepted", {
                    name: `${tenant?.name || "Plant"} (Total)`,
                    totalSubmitted: total.totalSubmitted,
                    biwTotalReviewed: total.totalReviewed,
                    tvsTotalReviewed: total.tvsTotalReviewed,
                    biwAccepted: total.accepted,
                    tvsAccepted: total.tvsAccepted,
                    biwRejected: total.rejected,
                    tvsRejected: total.tvsRejected,
                    biwReworked: total.reworked,
                    tvsReworked: total.tvsReworked,
                    formBreakdown: total.formBreakdown,
                  })}
                  onMouseLeave={() => setReviewTooltip(null)}
                >
                  {total.reviewedAccepted}
                </td>
                <td 
                  className="px-4 py-4 border-t bg-emerald-100/70 dark:bg-emerald-900/40 text-center text-rose-600 tabular-nums font-extrabold cursor-help transition-colors hover:bg-emerald-200/80 dark:hover:bg-emerald-800/80"
                  onMouseEnter={(e) => handleReviewCellHover(e, "Rejected", {
                    name: `${tenant?.name || "Plant"} (Total)`,
                    totalSubmitted: total.totalSubmitted,
                    biwTotalReviewed: total.totalReviewed,
                    tvsTotalReviewed: total.tvsTotalReviewed,
                    biwAccepted: total.accepted,
                    tvsAccepted: total.tvsAccepted,
                    biwRejected: total.rejected,
                    tvsRejected: total.tvsRejected,
                    biwReworked: total.reworked,
                    tvsReworked: total.tvsReworked,
                    formBreakdown: total.formBreakdown,
                  })}
                  onMouseLeave={() => setReviewTooltip(null)}
                >
                  {total.reviewedRejected}
                </td>
                <td 
                  className="px-4 py-4 border-t border-r border-emerald-300 dark:border-emerald-700 bg-emerald-100/70 dark:bg-emerald-900/40 text-center text-amber-600 tabular-nums font-extrabold cursor-help transition-colors hover:bg-emerald-200/80 dark:hover:bg-emerald-800/80"
                  onMouseEnter={(e) => handleReviewCellHover(e, "Rework", {
                    name: `${tenant?.name || "Plant"} (Total)`,
                    totalSubmitted: total.totalSubmitted,
                    biwTotalReviewed: total.totalReviewed,
                    tvsTotalReviewed: total.tvsTotalReviewed,
                    biwAccepted: total.accepted,
                    tvsAccepted: total.tvsAccepted,
                    biwRejected: total.rejected,
                    tvsRejected: total.tvsRejected,
                    biwReworked: total.reworked,
                    tvsReworked: total.tvsReworked,
                    formBreakdown: total.formBreakdown,
                  })}
                  onMouseLeave={() => setReviewTooltip(null)}
                >
                  {total.reviewedRework}
                </td>
                <td className="px-4 py-4 border-t border-gray-200 dark:border-gray-700 text-center tabular-nums">{totalPerformanceScore}%</td>
                <td className="px-4 py-4 border-t border-gray-200 dark:border-gray-700 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${getCategoryBadgeColor(totalPerformanceScore)}`}>
                        {getPerformanceCategory(totalPerformanceScore)}
                    </span>
                </td>
              </tr>
            </tfoot>
            </table>
            </div>

            {totalPages > 1 && (
            <div className="bg-gray-50/50 dark:bg-gray-900/30 px-6 py-4 border-t border-gray-100 dark:border-gray-700">
                <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Showing{" "}
                    <span className="text-gray-900 dark:text-white tabular-nums">
                    {(performancePage - 1) * performancePageSize + 1}-{Math.min(performancePage * performancePageSize, performanceTableData.length)}
                    </span>{" "}
                    of{" "}
                    <span className="text-gray-900 dark:text-white tabular-nums">
                    {performanceTableData.length}
                    </span>
                </p>

                <div className="flex items-center gap-2">
                    <button
                    onClick={() => setPerformancePage((p) => Math.max(1, p - 1))}
                    disabled={performancePage === 1}
                    className="p-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 disabled:opacity-30 transition-all hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm group"
                    >
                    <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-purple-600" />
                    </button>
                    
                    <span className="text-xs font-black text-gray-500 dark:text-gray-400 px-2">
                        Page {performancePage} of {totalPages}
                    </span>

                    <button
                    onClick={() => setPerformancePage((p) => Math.min(totalPages, p + 1))}
                    disabled={performancePage === totalPages}
                    className="p-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 disabled:opacity-30 transition-all hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm group"
                    >
                    <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-purple-600" />
                    </button>
                </div>
                </div>
            </div>
            )}
        </div>

        {/* Floating Hover Breakdown Card for Reviewer Section */}
        {reviewTooltip && (
          <div
            className="fixed z-[99999] pointer-events-none transition-all duration-150 animate-in fade-in zoom-in-95"
            style={{
              left: Math.min(window.innerWidth - 380, Math.max(16, reviewTooltip.x - 160)),
              top: reviewTooltip.y > window.innerHeight - 340 
                ? Math.max(16, reviewTooltip.y - 280) 
                : reviewTooltip.y + 24,
              width: "360px",
            }}
          >
            <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-emerald-500/30 dark:border-emerald-500/40 p-4 text-gray-800 dark:text-gray-100 ring-1 ring-black/5">
              {/* Header */}
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    {reviewTooltip.metric} Breakdown
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                  Total: {reviewTooltip.totalVal}
                </span>
              </div>

              {/* Target Inspector / Plant */}
              <div className="text-[11px] font-bold text-gray-700 dark:text-gray-200 mb-1 flex items-center justify-between">
                <span className="truncate">👤 {reviewTooltip.userName}</span>
              </div>

              {/* Formula Explanation */}
              <div className="p-2 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-200/60 dark:border-emerald-800/60 mb-3 text-[11px]">
                <span className="text-[10px] uppercase font-black tracking-wider text-emerald-800 dark:text-emerald-300 block mb-0.5">
                  📐 Calculation Formula:
                </span>
                <span className="font-semibold text-emerald-950 dark:text-emerald-200">
                  {reviewTooltip.formula}
                </span>
              </div>

              {/* Form Wise Breakdown Header */}
              <div className="text-[10px] uppercase font-black tracking-wider text-gray-500 dark:text-gray-400 mb-1.5 flex items-center justify-between">
                <span>Form-Wise Breakdown</span>
                <span>Count</span>
              </div>

              {/* Form List */}
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 text-xs">
                {reviewTooltip.forms.length === 0 ? (
                  <p className="text-[11px] text-gray-400 italic py-1 text-center">
                    No individual form breakdown available.
                  </p>
                ) : (
                  reviewTooltip.forms.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-start justify-between gap-2 p-1.5 rounded-lg bg-gray-50/80 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-750"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-[11px] text-gray-800 dark:text-gray-200 truncate">
                          {f.title}
                        </p>
                        {f.subDetail && (
                          <p className="text-[10px] text-gray-500 dark:text-gray-400">
                            {f.subDetail}
                          </p>
                        )}
                      </div>
                      <span className="font-black text-xs tabular-nums text-emerald-700 dark:text-emerald-400 shrink-0">
                        {f.count}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
