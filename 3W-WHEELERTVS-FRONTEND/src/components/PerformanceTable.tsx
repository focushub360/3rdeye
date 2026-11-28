// PerformanceTable.tsx - Optimized Version
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiClient } from "../api/client";
import { io } from "socket.io-client";
import { Users, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Loader2, Info, Search, X, ArrowUp, ArrowDown, ArrowUpDown, Calendar, Building2, FileText, CheckCircle2, AlertTriangle, Layers, ExternalLink, Eye, EyeOff, RefreshCw } from "lucide-react";
import PerformanceGuideModal from "./analytics/PerformanceGuideModal";

const PerformanceTable = ({
  useInternalTrackingEndpoint = false,
  startDate,
  endDate,
  formId,
  formIds,
  formTitlesMap,
  title,
  selectedSlice,
  onClearSlice,
}: {
  useInternalTrackingEndpoint?: boolean;
  startDate?: string;
  endDate?: string;
  formId?: string;
  formIds?: string[];
  formTitlesMap?: Record<string, string>;
  title?: string;
  selectedSlice?: string;
  onClearSlice?: () => void;
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [performanceTableData, setPerformanceTableData] = useState<any[]>([]);
  const [performanceTableLoading, setPerformanceTableLoading] = useState(false);
  const [showPerformanceGuide, setShowPerformanceGuide] = useState(false);
  const [selectedInspectorForDetails, setSelectedInspectorForDetails] = useState<any | null>(null);
  const [showInspectorDetailModal, setShowInspectorDetailModal] = useState(false);

  // Lazy-load forms dictionary to ensure exact form titles on breakdown cards
  const [internalFormTitles, setInternalFormTitles] = useState<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    apiClient.getForms().then((res: any) => {
      if (!active) return;
      const list = Array.isArray(res) ? res : (res?.data || []);
      const map: Record<string, string> = {};
      list.forEach((f: any) => {
        if (f.id) map[String(f.id)] = f.title;
        if (f._id) map[String(f._id)] = f.title;
      });
      setInternalFormTitles(map);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  const resolveFormTitle = useCallback((fId?: string, fallbackTitle?: string) => {
    if (fId) {
      const idStr = String(fId);
      if (formTitlesMap && formTitlesMap[idStr]) return formTitlesMap[idStr];
      if (internalFormTitles[idStr]) return internalFormTitles[idStr];
    }
    if (fallbackTitle && fallbackTitle !== "Inspection Form" && fallbackTitle !== "Unknown Form") {
      return fallbackTitle;
    }
    return fallbackTitle || "Inspection Form";
  }, [formTitlesMap, internalFormTitles]);

  // Hover Breakdown Tooltip state for ALL Performance Table Numbers
  const [breakdownTab, setBreakdownTab] = useState<'forms' | 'time'>('forms');
  const [reviewTooltip, setReviewTooltip] = useState<{
    x: number;
    y: number;
    metric: string;
    userName: string;
    totalVal: string | number;
    formula: string;
    sourceCategory?: string;
    forms: Array<{ formId?: string; title: string; count: string | number; subDetail?: string }>;
    times: Array<{ bucketKey: string; title: string; count: string | number; subDetail?: string; startDate?: string; endDate?: string }>;
  } | null>(null);

  // Interactive Pinned Breakdown Modal when user CLICKS any number cell
  const [pinnedBreakdown, setPinnedBreakdown] = useState<{
    metricKey: string;
    metric: string;
    userName: string;
    totalVal: string | number;
    formula: string;
    sourceCategory?: string;
    inspectorNames?: string[];
    totalSubmitted?: number;
    forms: Array<{ formId?: string; title: string; count: string | number; subDetail?: string }>;
    times: Array<{ bucketKey: string; title: string; count: string | number; subDetail?: string; startDate?: string; endDate?: string }>;
  } | null>(null);

  const getFormListForMetric = useCallback((
    metric: string,
    formBreakdown: any[],
  ) => {
    const list: Array<{ formId?: string; title: string; count: string | number; subDetail?: string }> = [];
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
      const fDirectOk = f.directOk || 0;
      const fRComp = f.reworkQcCompleted || 0;
      const fRPend = f.reworkQcPending || 0;
      const fRejected = f.rejected || 0;
      const fDispatched = f.dispatched || 0;
      const fDispPend = f.dispatchPending !== undefined ? f.dispatchPending : Math.max(0, (fDirectOk + fRComp) - fDispatched);

      let cnt: string | number = 0;
      let subDetail = "";
      if (metric === "Accepted" || metric === "InspectionAccepted") {
        cnt = fDirectOk + fRComp;
        subDetail = `Direct Ok: ${fDirectOk} | Rework QC Completed: ${fRComp}`;
      } else if (metric === "Rework QC Pending" || metric === "ReworkPending") {
        cnt = fRPend;
        subDetail = `Active defects waiting for correction`;
      } else if (metric === "Rejected" || metric === "RejectedInspection") {
        cnt = fRejected;
        subDetail = `Scrapped / rejected on initial inspection`;
      } else if (metric === "Dispatch Pending" || metric === "DispatchPending") {
        cnt = fDispPend;
        subDetail = `Accepted: ${fDirectOk + fRComp} | Dispatched: ${fDispatched}`;
      } else if (metric === "Dispatched") {
        cnt = fDispatched;
        subDetail = `Cleared gate and marked isDispatched: true`;
      } else if (metric === "Total Submitted" || metric === "TotalSubmitted") {
        cnt = fSub;
        subDetail = `Accepted: ${fDirectOk + fRComp} | Defects: ${fRPend + fRejected}`;
      } else if (metric === "BIW Total Reviewed" || metric === "BIWReviewed") {
        cnt = fBiwRev;
        subDetail = `Acc: ${fBiwAcc} | Rej: ${fBiwRej} | Rew: ${fBiwRew}`;
      } else if (metric === "BIW Review Pending" || metric === "BIWPending") {
        const fEligible = fDispatched;
        cnt = Math.max(0, fEligible - fBiwRev);
        subDetail = `Dispatched: ${fDispatched} | BIW Reviewed: ${fBiwRev}`;
      } else if (metric === "BIW Accepted" || metric === "BIWAccepted") {
        cnt = fBiwAcc;
        subDetail = `Approved by quality reviewer in BIW review`;
      } else if (metric === "BIW Rejected" || metric === "BIWRejected") {
        cnt = fBiwRej;
        subDetail = `Rejected by quality reviewer in BIW review`;
      } else if (metric === "BIW Reworked" || metric === "BIWReworked") {
        cnt = fBiwRew;
        subDetail = `Returned for rework in BIW review`;
      } else if (metric === "TVS Total Reviewed" || metric === "TVSReviewed") {
        cnt = fTvsRev;
        subDetail = `Acc: ${fTvsAcc} | Rej: ${fTvsRej} | Rew: ${fTvsRew}`;
      } else if (metric === "TVS Review Pending" || metric === "TVSPending") {
        const fEligible = fDispatched;
        cnt = Math.max(0, fEligible - fTvsRev);
        subDetail = `Dispatched: ${fDispatched} | TVS Reviewed: ${fTvsRev}`;
      } else if (metric === "TVS Accepted" || metric === "TVSAccepted") {
        cnt = fTvsAcc;
        subDetail = `Customer audit review: Accepted`;
      } else if (metric === "TVS Rejected" || metric === "TVSRejected") {
        cnt = fTvsRej;
        subDetail = `Customer audit review: Rejected`;
      } else if (metric === "TVS Rework" || metric === "TVSRework") {
        cnt = fTvsRew;
        subDetail = `Customer audit review: Rework`;
      } else if (metric === "Reviewed" || metric === "ReviewedTotal") {
        cnt = fRev;
        subDetail = `BIW: ${fBiwRev} | TVS: ${fTvsRev}`;
      } else if (metric === "Pending" || metric === "ReviewedPending") {
        cnt = fPend;
        subDetail = `Submitted: ${fSub} | Total Reviewed: ${fRev}`;
      } else if (metric === "AcceptedReviewer" || metric === "ReviewedAccepted") {
        cnt = fAcc;
        subDetail = `BIW: ${fBiwAcc} | TVS: ${fTvsAcc}`;
      } else if (metric === "RejectedReviewer" || metric === "ReviewedRejected") {
        cnt = fRej;
        subDetail = `BIW: ${fBiwRej} | TVS: ${fTvsRej}`;
      } else if (metric === "ReworkReviewer" || metric === "ReviewedRework") {
        cnt = fRew;
        subDetail = `BIW: ${fBiwRew} | TVS: ${fTvsRew}`;
      } else if (metric === "PerformanceScore") {
        const sc = fRev > 0
          ? Math.round((fAcc / fRev) * 100)
          : (fSub > 0 ? Math.round(((fSub - (fRPend + fRejected)) / fSub) * 100) : 0);
        cnt = `${sc}%`;
        subDetail = fRev > 0 ? `Accepted: ${fAcc} / Reviewed: ${fRev}` : `Pass: ${fSub - (fRPend + fRejected)} / Sub: ${fSub}`;
      }

      const numVal = typeof cnt === "number" ? cnt : parseInt(String(cnt), 10) || 0;
      if (numVal > 0 || fSub > 0 || fRev > 0 || metric === "PerformanceScore") {
        list.push({
          formId: f.formId,
          title: resolveFormTitle(f.formId, f.formTitle),
          count: cnt,
          subDetail,
        });
      }
    });
    // Sort descending by count so active pending/action items appear at the top
    list.sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0));
    return list;
  }, [resolveFormTitle]);

  const getTimeListForMetric = useCallback((
    metric: string,
    timeBreakdown: any[],
  ) => {
    const list: Array<{ bucketKey: string; title: string; count: string | number; subDetail?: string; startDate?: string; endDate?: string }> = [];
    const today = new Date();

    const getBucketDates = (key: string) => {
      const endD = new Date(today);
      const startD = new Date(today);
      if (key === '0_30') {
        startD.setDate(startD.getDate() - 30);
      } else if (key === '31_60') {
        endD.setDate(endD.getDate() - 31);
        startD.setDate(startD.getDate() - 60);
      } else if (key === '61_90') {
        endD.setDate(endD.getDate() - 61);
        startD.setDate(startD.getDate() - 90);
      } else {
        endD.setDate(endD.getDate() - 91);
        startD.setDate(startD.getDate() - 365);
      }
      const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return { startStr: fmt(startD), endStr: fmt(endD) };
    };

    const sourceBreakdowns = (timeBreakdown && timeBreakdown.length > 0)
      ? timeBreakdown
      : [
          { bucketKey: '0_30', label: 'Last 30 Days (0 - 30d)', totalSubmitted: 0 },
          { bucketKey: '31_60', label: '31 - 60 Days Ago', totalSubmitted: 0 },
          { bucketKey: '61_90', label: '61 - 90 Days Ago', totalSubmitted: 0 },
          { bucketKey: '91_plus', label: 'Older (90+ Days)', totalSubmitted: 0 },
        ];

    sourceBreakdowns.forEach((tb: any) => {
      const dates = getBucketDates(tb.bucketKey);
      let count = 0;

      const tbBiwRev = tb.biwTotalReviewed ?? tb.totalReviewed ?? 0;
      const tbTvsRev = tb.tvsTotalReviewed ?? tb.tvsReviewed ?? 0;
      const tbRev = tbBiwRev + tbTvsRev;
      const tbSub = tb.totalSubmitted || 0;
      const tbPend = Math.max(0, tbSub - tbRev);
      const tbBiwAcc = tb.biwAccepted ?? tb.accepted ?? 0;
      const tbTvsAcc = tb.tvsAccepted || 0;
      const tbAcc = tbBiwAcc + tbTvsAcc;
      const tbBiwRej = tb.biwRejected ?? tb.rejectedReview ?? tb.rejected ?? 0;
      const tbTvsRej = tb.tvsRejected || 0;
      const tbRej = tbBiwRej + tbTvsRej;
      const tbBiwRew = tb.biwReworked ?? tb.reworked ?? tb.rework ?? 0;
      const tbTvsRew = tb.tvsReworked ?? tb.tvsRework ?? 0;
      const tbRew = tbBiwRew + tbTvsRew;

      if (metric === "Accepted" || metric === "InspectionAccepted") count = (tb.directOk || 0) + (tb.reworkQcCompleted || 0);
      else if (metric === "Rework QC Pending" || metric === "ReworkPending") count = tb.reworkQcPending || 0;
      else if (metric === "Rejected" || metric === "RejectedInspection") count = tb.rejected || 0;
      else if (metric === "Dispatch Pending" || metric === "DispatchPending") count = tb.dispatchPending || 0;
      else if (metric === "Dispatched") count = tb.dispatched || 0;
      else if (metric === "Total Submitted" || metric === "TotalSubmitted") count = tbSub;
      else if (metric === "BIW Total Reviewed" || metric === "BIWReviewed") count = tbBiwRev;
      else if (metric === "BIW Review Pending" || metric === "BIWPending") {
        const tbEligible = tb.dispatched || 0;
        count = tbEligible === 0 ? 0 : Math.max(0, tbEligible - tbBiwRev);
      }
      else if (metric === "BIW Accepted" || metric === "BIWAccepted") count = tbBiwAcc;
      else if (metric === "BIW Rejected" || metric === "BIWRejected") count = tbBiwRej;
      else if (metric === "BIW Reworked" || metric === "BIWReworked") count = tbBiwRew;
      else if (metric === "TVS Total Reviewed" || metric === "TVSReviewed") count = tbTvsRev;
      else if (metric === "TVS Review Pending" || metric === "TVSPending") {
        const tbEligible = tb.dispatched || 0;
        count = tbEligible === 0 ? 0 : Math.max(0, tbEligible - tbTvsRev);
      }
      else if (metric === "TVS Accepted" || metric === "TVSAccepted") count = tbTvsAcc;
      else if (metric === "TVS Rejected" || metric === "TVSRejected") count = tbTvsRej;
      else if (metric === "TVS Rework" || metric === "TVSRework") count = tbTvsRew;
      else if (metric === "Reviewed" || metric === "ReviewedTotal") count = tbRev;
      else if (metric === "Pending" || metric === "ReviewedPending") count = tbPend;
      else if (metric === "AcceptedReviewer" || metric === "ReviewedAccepted") count = tbAcc;
      else if (metric === "RejectedReviewer" || metric === "ReviewedRejected") count = tbRej;
      else if (metric === "ReworkReviewer" || metric === "ReviewedRework") count = tbRew;
      else count = tbSub;

      list.push({
        bucketKey: tb.bucketKey,
        title: tb.label || tb.bucketKey,
        count,
        subDetail: `${dates.startStr} to ${dates.endStr}${tb.monthLabel ? ` • Month: ${tb.monthLabel}` : ''}`,
        startDate: dates.startStr,
        endDate: dates.endStr,
      });
    });

    return list;
  }, []);

  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleCellMouseLeave = useCallback(() => {
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    tooltipTimeoutRef.current = setTimeout(() => {
      setReviewTooltip(null);
    }, 200);
  }, []);

  const handleTooltipMouseEnter = useCallback(() => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
  }, []);

  const handleTooltipMouseLeave = useCallback(() => {
    setReviewTooltip(null);
  }, []);

  const handleCellHover = useCallback((
    e: React.MouseEvent<HTMLElement>,
    metric: string,
    entity: {
      name: string;
      totalSubmitted?: number;
      directOk?: number;
      reworkQcCompleted?: number;
      reworkQcPending?: number;
      rejected?: number;
      dispatched?: number;
      dispatchPending?: number;
      biwTotalReviewed?: number;
      totalReviewed?: number;
      biwReviewPending?: number;
      reviewPending?: number;
      tvsTotalReviewed?: number;
      tvsReviewed?: number;
      tvsReviewPending?: number;
      tvsPending?: number;
      biwAccepted?: number;
      accepted?: number;
      tvsAccepted?: number;
      biwRejected?: number;
      rejectedReview?: number;
      tvsRejected?: number;
      biwReworked?: number;
      reworked?: number;
      rework?: number;
      tvsReworked?: number;
      tvsRework?: number;
      reviewedTotal?: number;
      reviewedPending?: number;
      reviewedAccepted?: number;
      reviewedRejected?: number;
      reviewedRework?: number;
      performanceScore?: number;
      formBreakdown?: any[];
      timeBreakdown?: any[];
    },
  ) => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const biwRev = entity.biwTotalReviewed ?? entity.totalReviewed ?? 0;
    const tvsRev = entity.tvsTotalReviewed ?? entity.tvsReviewed ?? 0;
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
    const tvsRew = entity.tvsReworked ?? entity.tvsRework ?? 0;
    const totalRew = biwRew + tvsRew;

    const directOk = entity.directOk || 0;
    const reworkQCCompleted = entity.reworkQcCompleted || 0;
    const reworkQCPending = entity.reworkQcPending || 0;
    const rejected = entity.rejected || 0;
    const dispatched = entity.dispatched || 0;
    const dispatchPending = entity.dispatchPending !== undefined ? entity.dispatchPending : Math.max(0, (directOk + reworkQCCompleted) - dispatched);
    const score = entity.performanceScore !== undefined ? entity.performanceScore : 0;

    let totalVal: string | number = 0;
    let formula = "";
    let metricDisplay = metric;
    let sourceCategory = "Shop Floor Inspection & Dispatch";

    if (metric === "Accepted" || metric === "InspectionAccepted") {
      metricDisplay = "Accepted (Direct Ok + Rework Completed)";
      sourceCategory = "Shop Floor Inspection & Dispatch";
      totalVal = directOk + reworkQCCompleted;
      formula = `Direct Ok (${directOk}) + Rework QC Completed (${reworkQCCompleted}) = ${directOk + reworkQCCompleted}`;
    } else if (metric === "Rework QC Pending" || metric === "ReworkPending") {
      metricDisplay = "Rework QC Pending";
      sourceCategory = "Shop Floor Inspection & Dispatch";
      totalVal = reworkQCPending;
      formula = `Active shop-floor defects undergoing physical rectification & re-check`;
    } else if (metric === "Rejected" || metric === "RejectedInspection") {
      metricDisplay = "Rejected (Inspection)";
      sourceCategory = "Shop Floor Inspection & Dispatch";
      totalVal = rejected;
      formula = `Defective units rejected/scrapped during initial floor inspection`;
    } else if (metric === "Dispatch Pending" || metric === "DispatchPending") {
      metricDisplay = "Dispatch Pending";
      sourceCategory = "Shop Floor Inspection & Dispatch";
      const formsList = getFormListForMetric(metric, entity.formBreakdown || []);
      const formSum = formsList.reduce((acc, f) => acc + (typeof f.count === "number" ? f.count : parseInt(String(f.count), 10) || 0), 0);
      const passedVal = entity.dispatchPending;
      if (formsList.length > 0) {
        totalVal = formSum;
        const activeForms = formsList.filter(f => (typeof f.count === "number" ? f.count : parseInt(String(f.count), 10) || 0) > 0);
        if (formSum === 0) {
          formula = `All accepted units dispatched: 0 units pending dispatch`;
        } else if (activeForms.length === 1) {
          const matchedF = entity.formBreakdown?.find((x: any) => (x.formId || x.formTitle) === (activeForms[0].formId || activeForms[0].title));
          const fAcc = matchedF ? ((matchedF.directOk || 0) + (matchedF.reworkQcCompleted || 0)) : (directOk + reworkQCCompleted);
          const fDisp = matchedF?.dispatched ?? dispatched;
          formula = `${activeForms[0].title}: Accepted (${fAcc}) - Dispatched (${fDisp}) = ${totalVal} units ready for gate clearance`;
        } else {
          formula = `Sum of form pending units: ${formSum} units ready for gate clearance`;
        }
      } else if (passedVal !== undefined) {
        totalVal = passedVal;
        formula = `Accepted (${directOk + reworkQCCompleted}) - Dispatched (${dispatched}) = ${totalVal} units ready for gate clearance`;
      } else {
        totalVal = Math.max(0, (directOk + reworkQCCompleted) - dispatched);
        formula = `Accepted (${directOk + reworkQCCompleted}) - Dispatched (${dispatched}) = ${totalVal} units ready for gate clearance`;
      }
    } else if (metric === "Dispatched") {
      metricDisplay = "Dispatched Units";
      sourceCategory = "Shop Floor Inspection & Dispatch";
      totalVal = dispatched;
      formula = `Completed units with isDispatched: true cleared through factory dispatch gate`;
    } else if (metric === "Total Submitted" || metric === "TotalSubmitted") {
      metricDisplay = "Total Submitted";
      sourceCategory = "Shop Floor Inspection Submissions";
      totalVal = sub;
      formula = `Total inspection forms filled and submitted on shop floor: Accepted (${directOk + reworkQCCompleted}) + Active Defects (${reworkQCPending + rejected})`;
    } else if (metric === "BIW Total Reviewed" || metric === "BIWReviewed") {
      metricDisplay = "BIW Total Reviewed";
      sourceCategory = "BIW Review Section (Secondary Quality Audit)";
      totalVal = biwRev;
      formula = `BIW Accepted (${biwAcc}) + BIW Rejected (${biwRej}) + BIW Reworked (${biwRew}) = ${biwRev}`;
    } else if (metric === "BIW Review Pending" || metric === "BIWPending") {
      metricDisplay = "BIW Review Pending";
      sourceCategory = "BIW Review Section (Secondary Quality Audit)";
      const formsList = getFormListForMetric(metric, entity.formBreakdown || []);
      const formSum = formsList.reduce((acc, f) => acc + (typeof f.count === "number" ? f.count : parseInt(String(f.count), 10) || 0), 0);
      const passedVal = entity.biwReviewPending !== undefined ? entity.biwReviewPending : (entity.reviewPending !== undefined ? entity.reviewPending : undefined);
      if (formsList.length > 0) {
        totalVal = formSum;
        const activeForms = formsList.filter(f => (typeof f.count === "number" ? f.count : parseInt(String(f.count), 10) || 0) > 0);
        if (formSum === 0) {
          formula = `All dispatched units reviewed: 0 units awaiting BIW review`;
        } else if (activeForms.length === 1) {
          const matchedF = entity.formBreakdown?.find((x: any) => (x.formId || x.formTitle) === (activeForms[0].formId || activeForms[0].title));
          const fDisp = matchedF?.dispatched ?? dispatched;
          const fRev = matchedF?.biwTotalReviewed ?? biwRev;
          formula = `${activeForms[0].title}: Dispatched (${fDisp}) - BIW Reviewed (${fRev}) = ${totalVal} units awaiting BIW review`;
        } else {
          formula = `Sum of form pending units: ${formSum} units awaiting BIW review`;
        }
      } else if (passedVal !== undefined) {
        totalVal = passedVal;
        formula = `Dispatched Units (${dispatched}) - BIW Reviewed (${biwRev}) = ${totalVal}`;
      } else {
        const eligibleUnits = dispatched || 0;
        totalVal = Math.max(0, eligibleUnits - biwRev);
        formula = `Dispatched Units (${eligibleUnits}) - BIW Reviewed (${biwRev}) = ${totalVal}`;
      }
    } else if (metric === "BIW Accepted" || metric === "BIWAccepted") {
      metricDisplay = "BIW Accepted";
      sourceCategory = "BIW Review Section (Secondary Quality Audit)";
      totalVal = biwAcc;
      formula = `Submissions audited and approved by quality reviewer with status: Accepted`;
    } else if (metric === "BIW Rejected" || metric === "BIWRejected") {
      metricDisplay = "BIW Rejected";
      sourceCategory = "BIW Review Section (Secondary Quality Audit)";
      totalVal = biwRej;
      formula = `Submissions audited and rejected by quality reviewer with status: Rejected`;
    } else if (metric === "BIW Reworked" || metric === "BIWReworked") {
      metricDisplay = "BIW Reworked";
      sourceCategory = "BIW Review Section (Secondary Quality Audit)";
      totalVal = biwRew;
      formula = `Submissions returned for rework by quality reviewer with status: Reworked`;
    } else if (metric === "TVS Total Reviewed" || metric === "TVSReviewed") {
      metricDisplay = "TVS Total Reviewed";
      sourceCategory = "TVS Review Section (Final Customer Audit)";
      totalVal = tvsRev;
      formula = `TVS Accepted (${tvsAcc}) + TVS Rejected (${tvsRej}) + TVS Rework (${tvsRew}) = ${tvsRev}`;
    } else if (metric === "TVS Review Pending" || metric === "TVSPending") {
      metricDisplay = "TVS Review Pending";
      sourceCategory = "TVS Review Section (Final Customer Audit)";
      const formsList = getFormListForMetric(metric, entity.formBreakdown || []);
      const formSum = formsList.reduce((acc, f) => acc + (typeof f.count === "number" ? f.count : parseInt(String(f.count), 10) || 0), 0);
      const passedVal = entity.tvsReviewPending !== undefined ? entity.tvsReviewPending : (entity.tvsPending !== undefined ? entity.tvsPending : undefined);
      if (formsList.length > 0) {
        totalVal = formSum;
        const activeForms = formsList.filter(f => (typeof f.count === "number" ? f.count : parseInt(String(f.count), 10) || 0) > 0);
        if (formSum === 0) {
          formula = `All dispatched units reviewed: 0 units awaiting TVS review`;
        } else if (activeForms.length === 1) {
          const matchedF = entity.formBreakdown?.find((x: any) => (x.formId || x.formTitle) === (activeForms[0].formId || activeForms[0].title));
          const fDisp = matchedF?.dispatched ?? dispatched;
          const fRev = matchedF?.tvsTotalReviewed ?? tvsRev;
          formula = `${activeForms[0].title}: Dispatched (${fDisp}) - TVS Reviewed (${fRev}) = ${totalVal} units awaiting TVS review`;
        } else {
          formula = `Sum of form pending units: ${formSum} units awaiting TVS review`;
        }
      } else if (passedVal !== undefined) {
        totalVal = passedVal;
        formula = `Dispatched Units (${dispatched}) - TVS Reviewed (${tvsRev}) = ${totalVal}`;
      } else {
        const eligibleUnits = dispatched || 0;
        totalVal = Math.max(0, eligibleUnits - tvsRev);
        formula = `Dispatched Units (${eligibleUnits}) - TVS Reviewed (${tvsRev}) = ${totalVal}`;
      }
    } else if (metric === "TVS Accepted" || metric === "TVSAccepted") {
      metricDisplay = "TVS Accepted";
      sourceCategory = "TVS Review Section (Final Customer Audit)";
      totalVal = tvsAcc;
      formula = `Submissions audited and approved in customer TVS quality audit (Accepted)`;
    } else if (metric === "TVS Rejected" || metric === "TVSRejected") {
      metricDisplay = "TVS Rejected";
      sourceCategory = "TVS Review Section (Final Customer Audit)";
      totalVal = tvsRej;
      formula = `Submissions audited and rejected in customer TVS quality audit (Rejected)`;
    } else if (metric === "TVS Rework" || metric === "TVSRework") {
      metricDisplay = "TVS Rework";
      sourceCategory = "TVS Review Section (Final Customer Audit)";
      totalVal = tvsRew;
      formula = `Submissions audited and returned for rework in customer TVS audit (Rework)`;
    } else if (metric === "Reviewed" || metric === "ReviewedTotal") {
      metricDisplay = "Reviewed (Combined Reviews)";
      sourceCategory = "Reviewer Performance Section";
      totalVal = entity.reviewedTotal ?? totalRev;
      formula = `BIW Review (${biwRev}) + TVS Review (${tvsRev}) = ${totalRev}`;
    } else if (metric === "Pending" || metric === "ReviewedPending") {
      metricDisplay = "Review Pending (Combined)";
      sourceCategory = "Reviewer Performance Section";
      totalVal = entity.reviewedPending ?? pending;
      formula = `Total Submitted (${sub}) - Total Reviewed (${totalRev}) = ${pending}`;
    } else if (metric === "AcceptedReviewer" || metric === "ReviewedAccepted") {
      metricDisplay = "Accepted (Combined Reviews)";
      sourceCategory = "Reviewer Performance Section";
      totalVal = entity.reviewedAccepted ?? totalAcc;
      formula = `BIW Accepted (${biwAcc}) + TVS Accepted (${tvsAcc}) = ${totalAcc}`;
    } else if (metric === "RejectedReviewer" || metric === "ReviewedRejected") {
      metricDisplay = "Rejected (Combined Reviews)";
      sourceCategory = "Reviewer Performance Section";
      totalVal = entity.reviewedRejected ?? totalRej;
      formula = `BIW Rejected (${biwRej}) + TVS Rejected (${tvsRej}) = ${totalRej}`;
    } else if (metric === "ReworkReviewer" || metric === "ReviewedRework") {
      metricDisplay = "Rework (Combined Reviews)";
      sourceCategory = "Reviewer Performance Section";
      totalVal = entity.reviewedRework ?? totalRew;
      formula = `BIW Reworked (${biwRew}) + TVS Rework (${tvsRew}) = ${totalRew}`;
    } else if (metric === "PerformanceScore") {
      metricDisplay = "Performance Score";
      sourceCategory = "Overall Quality Rating";
      totalVal = `${score}%`;
      formula = totalRev > 0
        ? `(Total Accepted (${totalAcc}) / Total Reviewed (${totalRev})) × 100% = ${score}%`
        : (sub > 0 ? `(Submitted (${sub}) - Defects (${reworkQCPending + rejected})) / Submitted (${sub}) × 100% = ${score}%` : `0%`);
    }

    const forms = getFormListForMetric(metric, entity.formBreakdown || []);
    const times = getTimeListForMetric(metric, entity.timeBreakdown || []);

    const tooltipWidth = 360;
    const tooltipHeight = 280;
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    if (left < 16) left = 16;
    if (left + tooltipWidth > window.innerWidth - 16) left = window.innerWidth - tooltipWidth - 16;

    let top = rect.bottom + 8;
    if (top + tooltipHeight > window.innerHeight - 16) {
      top = Math.max(16, rect.top - tooltipHeight - 8);
    }

    setReviewTooltip({
      x: left,
      y: top,
      metric: metricDisplay,
      userName: entity.name,
      totalVal,
      formula,
      sourceCategory,
      forms,
      times,
    });
  }, [getFormListForMetric, getTimeListForMetric]);

  const handleReviewCellHover = handleCellHover;

  const handleCellClick = useCallback((
    e: React.MouseEvent<HTMLElement>,
    metric: string,
    entity: any,
    inspectorNames?: string[],
  ) => {
    e.stopPropagation();
    setReviewTooltip(null);
    const biwRev = entity.biwTotalReviewed ?? entity.totalReviewed ?? 0;
    const tvsRev = entity.tvsTotalReviewed ?? entity.tvsReviewed ?? 0;
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
    const tvsRew = entity.tvsReworked ?? entity.tvsRework ?? 0;
    const totalRew = biwRew + tvsRew;
    const directOk = entity.directOk || 0;
    const reworkQCCompleted = entity.reworkQcCompleted || 0;
    const reworkQCPending = entity.reworkQcPending || 0;
    const rejected = entity.rejected || 0;
    const dispatched = entity.dispatched || 0;
    const dispatchPending = entity.dispatchPending !== undefined ? entity.dispatchPending : Math.max(0, (directOk + reworkQCCompleted) - dispatched);
    const score = entity.performanceScore !== undefined ? entity.performanceScore : 0;

    let totalVal: string | number = 0;
    let formula = "";
    let metricDisplay = metric;
    let sourceCategory = "Shop Floor Inspection & Dispatch";

    if (metric === "Accepted" || metric === "InspectionAccepted") {
      metricDisplay = "Accepted (Direct Ok + Rework Completed)";
      totalVal = directOk + reworkQCCompleted;
      formula = `Direct Ok (${directOk}) + Rework QC Completed (${reworkQCCompleted}) = ${directOk + reworkQCCompleted}`;
    } else if (metric === "Rework QC Pending" || metric === "ReworkPending") {
      metricDisplay = "Rework QC Pending";
      totalVal = reworkQCPending;
      formula = `Active shop-floor defects undergoing physical rectification & re-check`;
    } else if (metric === "Rejected" || metric === "RejectedInspection") {
      metricDisplay = "Rejected (Inspection)";
      totalVal = rejected;
      formula = `Defective units rejected/scrapped during initial floor inspection`;
    } else if (metric === "Dispatch Pending" || metric === "DispatchPending") {
      metricDisplay = "Dispatch Pending";
      sourceCategory = "Shop Floor Inspection & Dispatch";
      const formsList = getFormListForMetric(metric, entity.formBreakdown || []);
      const formSum = formsList.reduce((acc, f) => acc + (typeof f.count === "number" ? f.count : parseInt(String(f.count), 10) || 0), 0);
      const passedVal = entity.dispatchPending;
      if (formsList.length > 0) {
        totalVal = formSum;
        const activeForms = formsList.filter(f => (typeof f.count === "number" ? f.count : parseInt(String(f.count), 10) || 0) > 0);
        if (formSum === 0) {
          formula = `All accepted units dispatched: 0 units pending dispatch`;
        } else if (activeForms.length === 1) {
          const matchedF = entity.formBreakdown?.find((x: any) => (x.formId || x.formTitle) === (activeForms[0].formId || activeForms[0].title));
          const fAcc = matchedF ? ((matchedF.directOk || 0) + (matchedF.reworkQcCompleted || 0)) : (directOk + reworkQCCompleted);
          const fDisp = matchedF?.dispatched ?? dispatched;
          formula = `${activeForms[0].title}: Accepted (${fAcc}) - Dispatched (${fDisp}) = ${totalVal} units ready for gate clearance`;
        } else {
          formula = `Sum of form pending units: ${formSum} units ready for gate clearance`;
        }
      } else if (passedVal !== undefined) {
        totalVal = passedVal;
        formula = `Accepted (${directOk + reworkQCCompleted}) - Dispatched (${dispatched}) = ${totalVal} units ready for gate clearance`;
      } else {
        totalVal = Math.max(0, (directOk + reworkQCCompleted) - dispatched);
        formula = `Accepted (${directOk + reworkQCCompleted}) - Dispatched (${dispatched}) = ${totalVal} units ready for gate clearance`;
      }
    } else if (metric === "Dispatched") {
      metricDisplay = "Dispatched Units";
      sourceCategory = "Shop Floor Inspection & Dispatch";
      totalVal = dispatched;
      formula = `Completed units with isDispatched: true cleared through factory dispatch gate`;
    } else if (metric === "Total Submitted" || metric === "TotalSubmitted") {
      metricDisplay = "Total Submitted";
      sourceCategory = "Shop Floor Inspection Submissions";
      totalVal = sub;
      formula = sub > 0 ? `Accepted (${directOk + reworkQCCompleted}) + Active Defects (${reworkQCPending + rejected})` : `0 floor submissions`;
    } else if (metric === "BIW Total Reviewed" || metric === "BIWReviewed") {
      metricDisplay = "BIW Total Reviewed";
      sourceCategory = "BIW Review Section";
      totalVal = biwRev;
      formula = `BIW Accepted (${biwAcc}) + BIW Rejected (${biwRej}) + BIW Reworked (${biwRew}) = ${biwRev}`;
    } else if (metric === "BIW Review Pending" || metric === "BIWPending") {
      metricDisplay = "BIW Review Pending";
      sourceCategory = "BIW Review Section";
      const formsList = getFormListForMetric(metric, entity.formBreakdown || []);
      const formSum = formsList.reduce((acc, f) => acc + (typeof f.count === "number" ? f.count : parseInt(String(f.count), 10) || 0), 0);
      const passedVal = entity.biwReviewPending !== undefined ? entity.biwReviewPending : (entity.reviewPending !== undefined ? entity.reviewPending : undefined);
      if (formsList.length > 0) {
        totalVal = formSum;
        const activeForms = formsList.filter(f => (typeof f.count === "number" ? f.count : parseInt(String(f.count), 10) || 0) > 0);
        if (formSum === 0) {
          formula = `All dispatched units reviewed: 0 units awaiting BIW review`;
        } else if (activeForms.length === 1) {
          const matchedF = entity.formBreakdown?.find((x: any) => (x.formId || x.formTitle) === (activeForms[0].formId || activeForms[0].title));
          const fDisp = matchedF?.dispatched ?? dispatched;
          const fRev = matchedF?.biwTotalReviewed ?? biwRev;
          formula = `${activeForms[0].title}: Dispatched (${fDisp}) - BIW Reviewed (${fRev}) = ${totalVal} units awaiting BIW review`;
        } else {
          formula = `Sum of form pending units: ${formSum} units awaiting BIW review`;
        }
      } else if (passedVal !== undefined) {
        totalVal = passedVal;
        formula = `Dispatched Units (${dispatched}) - BIW Reviewed (${biwRev}) = ${totalVal}`;
      } else {
        const eligibleUnits = dispatched || 0;
        totalVal = Math.max(0, eligibleUnits - biwRev);
        formula = `Dispatched Units (${eligibleUnits}) - BIW Reviewed (${biwRev}) = ${totalVal}`;
      }
    } else if (metric === "BIW Accepted" || metric === "BIWAccepted") {
      metricDisplay = "BIW Accepted";
      sourceCategory = "BIW Review Section";
      totalVal = biwAcc;
      formula = `Submissions audited and approved in BIW review`;
    } else if (metric === "BIW Rejected" || metric === "BIWRejected") {
      metricDisplay = "BIW Rejected";
      sourceCategory = "BIW Review Section";
      totalVal = biwRej;
      formula = `Submissions audited and rejected in BIW review`;
    } else if (metric === "BIW Reworked" || metric === "BIWReworked") {
      metricDisplay = "BIW Reworked";
      sourceCategory = "BIW Review Section";
      totalVal = biwRew;
      formula = `Submissions returned for rework in BIW review`;
    } else if (metric === "TVS Total Reviewed" || metric === "TVSReviewed") {
      metricDisplay = "TVS Total Reviewed";
      sourceCategory = "TVS Review Section";
      totalVal = tvsRev;
      formula = `TVS Accepted (${tvsAcc}) + TVS Rejected (${tvsRej}) + TVS Rework (${tvsRew}) = ${tvsRev}`;
    } else if (metric === "TVS Review Pending" || metric === "TVSPending") {
      metricDisplay = "TVS Review Pending";
      sourceCategory = "TVS Review Section";
      const formsList = getFormListForMetric(metric, entity.formBreakdown || []);
      const formSum = formsList.reduce((acc, f) => acc + (typeof f.count === "number" ? f.count : parseInt(String(f.count), 10) || 0), 0);
      const passedVal = entity.tvsReviewPending !== undefined ? entity.tvsReviewPending : (entity.tvsPending !== undefined ? entity.tvsPending : undefined);
      if (formsList.length > 0) {
        totalVal = formSum;
        const activeForms = formsList.filter(f => (typeof f.count === "number" ? f.count : parseInt(String(f.count), 10) || 0) > 0);
        if (formSum === 0) {
          formula = `All dispatched units reviewed: 0 units awaiting TVS review`;
        } else if (activeForms.length === 1) {
          const matchedF = entity.formBreakdown?.find((x: any) => (x.formId || x.formTitle) === (activeForms[0].formId || activeForms[0].title));
          const fDisp = matchedF?.dispatched ?? dispatched;
          const fRev = matchedF?.tvsTotalReviewed ?? tvsRev;
          formula = `${activeForms[0].title}: Dispatched (${fDisp}) - TVS Reviewed (${fRev}) = ${totalVal} units awaiting TVS review`;
        } else {
          formula = `Sum of form pending units: ${formSum} units awaiting TVS review`;
        }
      } else if (passedVal !== undefined) {
        totalVal = passedVal;
        formula = `Dispatched Units (${dispatched}) - TVS Reviewed (${tvsRev}) = ${totalVal}`;
      } else {
        const eligibleUnits = dispatched || 0;
        totalVal = Math.max(0, eligibleUnits - tvsRev);
        formula = `Dispatched Units (${eligibleUnits}) - TVS Reviewed (${tvsRev}) = ${totalVal}`;
      }
    } else if (metric === "TVS Accepted" || metric === "TVSAccepted") {
      metricDisplay = "TVS Accepted";
      sourceCategory = "TVS Review Section";
      totalVal = tvsAcc;
      formula = `Submissions audited and approved in customer TVS quality audit`;
    } else if (metric === "TVS Rejected" || metric === "TVSRejected") {
      metricDisplay = "TVS Rejected";
      sourceCategory = "TVS Review Section";
      totalVal = tvsRej;
      formula = `Submissions audited and rejected in customer TVS quality audit`;
    } else if (metric === "TVS Rework" || metric === "TVSRework") {
      metricDisplay = "TVS Rework";
      sourceCategory = "TVS Review Section";
      totalVal = tvsRew;
      formula = `Submissions returned for rework in customer TVS audit`;
    } else if (metric === "Reviewed" || metric === "ReviewedTotal") {
      metricDisplay = "Reviewed (Combined Reviews)";
      sourceCategory = "Reviewer Performance Section";
      totalVal = entity.reviewedTotal ?? totalRev;
      formula = `BIW Review (${biwRev}) + TVS Review (${tvsRev}) = ${totalRev}`;
    } else if (metric === "Pending" || metric === "ReviewedPending") {
      metricDisplay = "Review Pending (Combined)";
      sourceCategory = "Reviewer Performance Section";
      totalVal = sub === 0 ? 0 : (entity.reviewedPending ?? pending);
      formula = sub === 0 ? `0 pending (Reviewer role)` : `Total Submitted (${sub}) - Total Reviewed (${totalRev}) = ${pending}`;
    } else if (metric === "AcceptedReviewer" || metric === "ReviewedAccepted") {
      metricDisplay = "Accepted (Combined Reviews)";
      sourceCategory = "Reviewer Performance Section";
      totalVal = entity.reviewedAccepted ?? totalAcc;
      formula = `BIW Accepted (${biwAcc}) + TVS Accepted (${tvsAcc}) = ${totalAcc}`;
    } else if (metric === "RejectedReviewer" || metric === "ReviewedRejected") {
      metricDisplay = "Rejected (Combined Reviews)";
      sourceCategory = "Reviewer Performance Section";
      totalVal = entity.reviewedRejected ?? totalRej;
      formula = `BIW Rejected (${biwRej}) + TVS Rejected (${tvsRej}) = ${totalRej}`;
    } else if (metric === "ReworkReviewer" || metric === "ReviewedRework") {
      metricDisplay = "Rework (Combined Reviews)";
      sourceCategory = "Reviewer Performance Section";
      totalVal = entity.reviewedRework ?? totalRew;
      formula = `BIW Reworked (${biwRew}) + TVS Rework (${tvsRew}) = ${totalRew}`;
    } else if (metric === "PerformanceScore") {
      metricDisplay = "Performance Score";
      sourceCategory = "Overall Quality Rating";
      totalVal = `${score}%`;
      formula = totalRev > 0
        ? `Quality Audit Rating: (Total Accepted (${totalAcc}) / Total Reviewed (${totalRev})) × 100% = ${score}%`
        : (sub > 0 ? `Floor Quality Rating: (Submitted (${sub}) - Defects (${reworkQCPending + rejected})) / Submitted (${sub}) × 100% = ${score}%` : `0%`);
    }

    const forms = getFormListForMetric(metric, entity.formBreakdown || []);
    const times = getTimeListForMetric(metric, entity.timeBreakdown || []);
    const resolvedNames = inspectorNames && inspectorNames.length > 0
      ? inspectorNames
      : (entity.name && !String(entity.name).includes("All Plants") && !String(entity.name).includes("Plant Total") ? [entity.name] : []);

    setPinnedBreakdown({
      metricKey: metric,
      metric: metricDisplay,
      userName: entity.name,
      totalVal,
      formula,
      sourceCategory,
      inspectorNames: resolvedNames,
      totalSubmitted: sub,
      forms,
      times,
    });
  }, [getFormListForMetric, getTimeListForMetric]);

  // ✅ Bind strictly to Top Date Filter (startDate & endDate props)
  const effectiveStartDate = useMemo(() => {
    if (startDate && startDate.trim()) return startDate.includes("T") ? startDate.split("T")[0] : startDate;
    if ((!startDate || !startDate.trim()) && (!endDate || !endDate.trim()) && !formId && !formIds) {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d.toISOString().split("T")[0];
    }
    return "";
  }, [startDate, endDate, formId, formIds]);

  const effectiveEndDate = useMemo(() => {
    if (endDate && endDate.trim()) return endDate.includes("T") ? endDate.split("T")[0] : endDate;
    if ((!startDate || !startDate.trim()) && (!endDate || !endDate.trim()) && !formId && !formIds) {
      return new Date().toISOString().split("T")[0];
    }
    return "";
  }, [startDate, endDate, formId, formIds]);

  // Name search state
  const [searchTerm, setSearchTerm] = useState("");

  // Sort state & toggle handler
  const [sortColumn, setSortColumn] = useState<string>("performanceScore");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortOrder(column === "name" ? "asc" : "desc");
    }
  };

  // Synchronize sort column when user selects a pie slice
  useEffect(() => {
    if (!selectedSlice || selectedSlice === "all") return;
    switch (selectedSlice) {
      case "directOk":
      case "reworkCompleted":
      case "accepted":
        setSortColumn("Accepted");
        setSortOrder("desc");
        break;
      case "rework":
        setSortColumn("Rework QC Pending");
        setSortOrder("desc");
        break;
      case "rejected":
        setSortColumn("Rejected");
        setSortOrder("desc");
        break;
      case "pendingDispatch":
        setSortColumn("dispatchPending");
        setSortOrder("desc");
        break;
      case "dispatched":
        setSortColumn("dispatched");
        setSortOrder("desc");
        break;
      case "biwReviewed":
        setSortColumn("totalReviewed");
        setSortOrder("desc");
        break;
      case "pendingData":
        setSortColumn("reviewPending");
        setSortOrder("desc");
        break;
      case "tvsReviewed":
        setSortColumn("tvsTotalReviewed");
        setSortOrder("desc");
        break;
      case "tvsAccepted":
        setSortColumn("tvsAccepted");
        setSortOrder("desc");
        break;
      case "tvsDefects":
        setSortColumn("tvsRejected");
        setSortOrder("desc");
        break;
      case "pendingTvs":
        setSortColumn("tvsReviewPending");
        setSortOrder("desc");
        break;
    }
  }, [selectedSlice]);

  const isSliceActive = (columnKey: string) => {
    if (!selectedSlice || selectedSlice === "all") return false;
    switch (columnKey) {
      case "Accepted":
        return selectedSlice === "accepted" || selectedSlice === "directOk" || selectedSlice === "reworkCompleted";
      case "Direct Ok":
        return selectedSlice === "directOk" || selectedSlice === "accepted";
      case "Rework QC Completed":
        return selectedSlice === "reworkCompleted" || selectedSlice === "accepted";
      case "Rework QC Pending":
        return selectedSlice === "rework";
      case "Rejected":
        return selectedSlice === "rejected";
      case "dispatchPending":
        return selectedSlice === "pendingDispatch";
      case "dispatched":
        return selectedSlice === "dispatched";
      case "totalReviewed":
        return selectedSlice === "biwReviewed";
      case "reviewPending":
        return selectedSlice === "pendingData";
      case "accepted":
        return selectedSlice === "accepted";
      case "tvsTotalReviewed":
        return selectedSlice === "tvsReviewed";
      case "tvsReviewPending":
        return selectedSlice === "pendingTvs";
      case "tvsAccepted":
        return selectedSlice === "tvsAccepted";
      case "tvsRejected":
      case "tvsReworked":
        return selectedSlice === "tvsDefects";
      default:
        return false;
    }
  };

  const renderSortIcon = (column: string) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-3 h-3 text-gray-300 dark:text-gray-600 ml-1 inline shrink-0 opacity-50 group-hover:opacity-100" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="w-3 h-3 text-blue-600 dark:text-blue-400 ml-1 inline shrink-0" />
    ) : (
      <ArrowDown className="w-3 h-3 text-blue-600 dark:text-blue-400 ml-1 inline shrink-0" />
    );
  };

  useEffect(() => {
    setPerformancePage(1);
  }, [effectiveStartDate, effectiveEndDate]);
  const [perfInspectorSummary, setPerfInspectorSummary] = useState<any[]>([]);
  const [activeUserNames, setActiveUserNames] = useState<Set<string>>(
    new Set(),
  );

  const [showPerformanceTable, setShowPerformanceTable] = useState(true);
  const [showReviewerSection, setShowReviewerSection] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Group by Plant / Tenant states (Excel Pivot style)
  const [viewMode, setViewMode] = useState<"grouped" | "flat" | "cross_tenant">("grouped");
  const [collapsedTenants, setCollapsedTenants] = useState<Set<string>>(new Set());

  const toggleTenantCollapse = useCallback((tName: string) => {
    setCollapsedTenants((prev) => {
      const next = new Set(prev);
      if (next.has(tName)) {
        next.delete(tName);
      } else {
        next.add(tName);
      }
      return next;
    });
  }, []);

  const collapseAllTenants = useCallback((groups: any[]) => {
    const all = new Set<string>();
    groups.forEach((g) => {
      if (g.tenantName) all.add(g.tenantName);
    });
    setCollapsedTenants(all);
  }, []);

  const expandAllTenants = useCallback(() => {
    setCollapsedTenants(new Set());
  }, []);

  // Pagination states
  const [performancePage, setPerformancePage] = useState(1);
  const [performancePageSize, setPerformancePageSize] = useState(10);

  const isSuperAdmin = user?.role === "superadmin";

  // ✅ Cache key for performance data
  const getCacheKey = useCallback(() => {
    const fKey = formIds ? (Array.isArray(formIds) ? formIds.slice().sort().join('-') : String(formIds)) : (formId || 'all');
    return `perf_v9_${fKey}_${effectiveStartDate}_${effectiveEndDate}_${performancePage}_${performancePageSize}`;
  }, [formId, formIds, effectiveStartDate, effectiveEndDate, performancePage, performancePageSize]);

  // ✅ Load performance data with caching and timeout
  const loadPerformanceData = useCallback(async (force = false, isBackground = false) => {
    if (!showPerformanceTable || !user) return;

    // Allow admins, superadmins, subadmins, tenant admins, managers, and inspectors
    const allowedRoles = ["admin", "superadmin", "subadmin", "tenant_admin", "manager", "staff", "inspector"];
    if (!useInternalTrackingEndpoint && !allowedRoles.includes(user.role)) {
      return;
    }

    // ✅ Check cache first (skip when forced for sec-to-sec real-time update)
    const cacheKey = getCacheKey();
    if (!force) {
      const cachedData = sessionStorage.getItem(cacheKey);
      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          const cacheAge = Date.now() - (parsed.timestamp || 0);
          if (cacheAge < 60000) {
            let cachedList = parsed.data || [];
            if (cachedList && !Array.isArray(cachedList) && Array.isArray((cachedList as any).data)) {
              cachedList = (cachedList as any).data;
            }
            if (Array.isArray(cachedList) && cachedList.length > 0) {
              setPerformanceTableData(cachedList);
              setPerfInspectorSummary(parsed.inspectorSummary || []);
              setActiveUserNames(new Set(parsed.activeUserNames || []));
              setPerformanceTableLoading(false);
              // Always revalidate in background if cache is older than 3s so updates appear time-to-time
              if (cacheAge > 3000) {
                loadPerformanceData(true, true);
              }
              return;
            }
          }
        } catch (e) {
          // Cache parse error, continue to fetch
        }
      }
    }

    if (!isBackground) {
      setPerformanceTableLoading(true);
    }

    try {
      // ✅ Build the API call with date parameters & cache bypass flags
      let tableResponse: any;

      if (useInternalTrackingEndpoint) {
        // Internal tracking endpoint
        tableResponse = await apiClient.get(
          `/internal-tracking/performance?startDate=${effectiveStartDate}&endDate=${effectiveEndDate}&page=${performancePage}&limit=${performancePageSize}${force ? '&forceNetwork=true&bypassCache=true' : ''}`
        );
      } else {
        // ✅ Call getPerformanceTable with date parameters across the full range
        tableResponse = await apiClient.getPerformanceTable({
          startDate: effectiveStartDate,
          endDate: effectiveEndDate,
          formId,
          formIds,
          page: performancePage,
          limit: performancePageSize,
          bypassCache: force,
          forceNetwork: force,
        });
      }

      // Extract the data from the response safely handling all wrapper shapes
      let tableData: any[] = [];
      const resRaw = tableResponse?.data;
      if (Array.isArray(resRaw)) {
        tableData = resRaw;
      } else if (resRaw && Array.isArray((resRaw as any).data)) {
        tableData = (resRaw as any).data;
      } else if (Array.isArray(tableResponse)) {
        tableData = tableResponse;
      } else if (tableResponse && Array.isArray((tableResponse as any).data)) {
        tableData = (tableResponse as any).data;
      }

      // Set the table data and unblock loading IMMEDIATELY!
      setPerformanceTableData(tableData);
      if (!isBackground) {
        setPerformanceTableLoading(false);
      }

      // Cache the immediate result so tab switches remain snappy
      sessionStorage.setItem(cacheKey, JSON.stringify({
        data: tableData,
        inspectorSummary: [],
        activeUserNames: [],
        timestamp: Date.now()
      }));

      // Fetch inspector summary in background without blocking the UI
      const inspQuery = formIds
        ? `&formIds=${Array.isArray(formIds) ? formIds.join(',') : formIds}`
        : (formId ? `&formId=${formId}` : '');
      const bypassQuery = force ? '&forceNetwork=true&bypassCache=true' : '';

      if (user.role === "admin" || user.role === "superadmin") {
        apiClient.get(`/analytics/inspector-summary?startDate=${effectiveStartDate}&endDate=${effectiveEndDate}${inspQuery}${bypassQuery}`)
          .then((summaryResponse: any) => {
            const summaryData = summaryResponse?.data?.summary || [];
            setPerfInspectorSummary(summaryData);
            sessionStorage.setItem(cacheKey, JSON.stringify({
              data: tableData,
              inspectorSummary: summaryData,
              activeUserNames: [],
              timestamp: Date.now()
            }));
          })
          .catch((err) => {
            console.warn('[PerformanceTable] Non-critical inspector summary error:', err);
          });
      }

    } catch (error: any) {
      console.error('[PerformanceTable] Error loading data:', error);

      // Try to load from cache even if expired
      const cachedData = sessionStorage.getItem(getCacheKey());
      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          let rawParsed = parsed.data || [];
          if (rawParsed && !Array.isArray(rawParsed) && Array.isArray((rawParsed as any).data)) {
            rawParsed = (rawParsed as any).data;
          }
          setPerformanceTableData(Array.isArray(rawParsed) ? rawParsed : []);
          setPerfInspectorSummary(parsed.inspectorSummary || []);
          setActiveUserNames(new Set(parsed.activeUserNames || []));
        } catch (e) {
          // Ignore cache errors
        }
      } else if (!isBackground) {
        setPerformanceTableData([]);
        setPerfInspectorSummary([]);
        setActiveUserNames(new Set());
      }
    } finally {
      if (!isBackground) {
        setPerformanceTableLoading(false);
      }
    }
  }, [
    user,
    effectiveStartDate,
    effectiveEndDate,
    showPerformanceTable,
    useInternalTrackingEndpoint,
    performancePage,
    performancePageSize,
    formId,
    formIds,
    getCacheKey
  ]);

  // Initial load when showPerformanceTable is true
  useEffect(() => {
    if (showPerformanceTable) {
      loadPerformanceData();
    }
  }, [loadPerformanceData, showPerformanceTable]);

  // ✅ Sec-to-Sec Real-Time Updates via Socket.IO & Live Polling Interval
  useEffect(() => {
    if (!showPerformanceTable) return;

    // 1. Lightweight 60s fallback polling (Socket.IO, tab focus, & Refresh button handle instant updates)
    const pollInterval = setInterval(() => {
      if (typeof document !== "undefined" && !document.hidden) {
        loadPerformanceData(true, true);
      }
    }, 60000);

    // 1b. Instant sync on tab focus / visibility / cross-tab analytics_data_updated
    const handleVisibilityOrFocus = () => {
      if (typeof document === "undefined" || !document.hidden) {
        try {
          sessionStorage.removeItem(getCacheKey());
        } catch (_) {}
        loadPerformanceData(true, true);
      }
    };
    const handleStorageUpdate = (e: StorageEvent) => {
      if (e.key === "analytics_data_updated") {
        try {
          sessionStorage.removeItem(getCacheKey());
        } catch (_) {}
        loadPerformanceData(true, true);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);
    window.addEventListener("storage", handleStorageUpdate);

    // 2. Real-time WebSocket connection to receive instant dispatch/response changes
    const getSocketUrl = () => {
      if (typeof window !== "undefined") {
        const origin = window.location.origin;
        if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
          return "http://localhost:5000";
        }
        return origin;
      }
      return "https://www.focus3rdeye.com";
    };

    let socket: any = null;
    try {
      socket = io(getSocketUrl(), {
        path: "/socket.io",
        transports: ["websocket", "polling"],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      socket.on("connect", () => {
        socket.emit("join-dashboard-analytics");
        if (formId) {
          socket.emit("join-form-analytics", formId);
        }
      });

      const handleRealtimeEvent = () => {
        // Clear cached data and silently update table state sec-to-sec
        try {
          sessionStorage.removeItem(getCacheKey());
        } catch { }
        loadPerformanceData(true, true);
      };

      socket.on("response-created", handleRealtimeEvent);
      socket.on("response-updated", handleRealtimeEvent);
      socket.on("response-deleted", handleRealtimeEvent);
      socket.on("batch-imported", handleRealtimeEvent);
    } catch (e) {
      console.warn("[PerformanceTable] Socket initialization error:", e);
    }

    return () => {
      clearInterval(pollInterval);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      window.removeEventListener("storage", handleStorageUpdate);
      if (socket) {
        try {
          if (formId) socket.emit("leave-form-analytics", formId);
          socket.emit("leave-dashboard-analytics");
          socket.disconnect();
        } catch { }
      }
    };
  }, [showPerformanceTable, formId, getCacheKey, loadPerformanceData]);

  // ... rest of the component (render methods remain the same)

  // Helper functions
  const isUserActive = useCallback((user: any) => {
    if (user?.isActive !== undefined) return user.isActive !== false;
    if (user?.status) return String(user.status).toLowerCase() !== "inactive";
    return true;
  }, []);

  const getUserNameAliases = useCallback((user: any) => {
    const aliases = new Set<string>();
    const addAlias = (value: string | undefined | null) => {
      if (!value) return;
      const trimmed = String(value).trim();
      if (!trimmed) return;
      aliases.add(trimmed);
      aliases.add(trimmed.toLowerCase());
      aliases.add(trimmed.replace(/^@/, ""));
      aliases.add(trimmed.replace(/^@/, "").toLowerCase());
    };

    const firstName = user?.firstName || "";
    const lastName = user?.lastName || "";
    const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
    addAlias(fullName);
    addAlias(user?.name);
    addAlias(user?.username);
    addAlias(user?.email);
    addAlias(user?._id);

    return aliases;
  }, []);

  const buildActiveUserNames = useCallback(
    (users: any[]) => {
      const activeNames = new Set<string>();
      users.filter(isUserActive).forEach((user) => {
        getUserNameAliases(user).forEach((alias) => activeNames.add(alias));
      });
      return activeNames;
    },
    [isUserActive, getUserNameAliases],
  );

  const getInspectorName = useCallback((item: any) => {
    return (
      item?.qcInspector ||
      item?.qcInspectorName ||
      item?.inspectorName ||
      item?.name ||
      item?.username ||
      item?.email ||
      item?.userId ||
      ""
    );
  }, []);

  const isInspectorActive = (item: any) => {
    if (!isUserActive(item)) return false;
    const inspectorName = getInspectorName(item);
    if (!inspectorName || activeUserNames.size === 0) return true;
    const aliases = getUserNameAliases({ username: inspectorName });
    return Array.from(aliases).some((alias) => activeUserNames.has(alias));
  };

  const toggleRowExpansion = (userName: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(userName)) {
        next.delete(userName);
      } else {
        next.add(userName);
      }
      return next;
    });
  };

  // Standard inspection statuses that must always be present to guarantee column alignment
  const STANDARD_STATUSES = useMemo(() => ["Accepted", "Rework QC Pending", "Rejected", "Dispatched"], []);

  // Computed values
  const performanceStatuses = useMemo(() => {
    const isNumeric = (str: string) => /^\d+$/.test(str);
    const rawStatuses = [
      ...STANDARD_STATUSES,
      ...perfInspectorSummary.flatMap((item: any) =>
        Object.keys(item.statusCounts || {}),
      ),
    ];
    // Map individual ok / rework completed statuses into "Accepted"
    const normalizedStatuses = rawStatuses.map(status => {
      if (status === "Direct Ok" || status === "Rework QC Completed" || status === "Rework Accepted") {
        return "Accepted";
      }
      return status;
    });
    const statuses = Array.from(new Set(normalizedStatuses));
    return statuses.filter(status => !isNumeric(status));
  }, [STANDARD_STATUSES, perfInspectorSummary]);

  // Map qcInspector to their status counts
  const inspectorStatusMap = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    perfInspectorSummary.forEach((item: any) => {
      const name = item.qcInspector;
      if (!name) return;
      if (!map[name]) map[name] = {};
      Object.entries(item.statusCounts || {}).forEach(([status, count]) => {
        map[name][status] = (map[name][status] || 0) + (count as number);
      });
    });
    return map;
  }, [perfInspectorSummary]);

  const sliceLabelMap: Record<string, string> = useMemo(() => ({
    directOk: "Accepted",
    reworkCompleted: "Accepted",
    accepted: "Accepted",
    rework: "Rework QC Pending",
    rejected: "Rejected",
    pendingDispatch: "Dispatch Pending",
    dispatched: "Dispatched",
    biwReviewed: "BIW Reviewed",
    pendingData: "BIW Review Pending",
    tvsReviewed: "TVS Reviewed",
    tvsAccepted: "TVS Accepted",
    tvsDefects: "TVS Defects / Rework",
    pendingTvs: "TVS Review Pending",
  }), []);

  // Filter data by selected pie slice AND inspector / user search term
  const filteredData = useMemo(() => {
    let data = [...performanceTableData];

    // Filter by selected pie slice if active
    if (selectedSlice && selectedSlice !== "all") {
      data = data.filter((row) => {
        const rowName = row.name || row.qcInspector || row.qcInspectorName || row.inspectorName || row.username || "";
        const m = inspectorStatusMap[rowName] || {};
        const dOk = (row.directOk !== undefined ? row.directOk : m["Direct Ok"]) || 0;
        const rwComp = (row.reworkQcCompleted !== undefined ? row.reworkQcCompleted : m["Rework QC Completed"]) || 0;
        const rwPend = (row.reworkQcPending !== undefined ? row.reworkQcPending : m["Rework QC Pending"]) || 0;
        const rej = (row.rejected !== undefined ? row.rejected : m["Rejected"]) || 0;
        const disp = row.dispatched || 0;
        const dispPend = row.dispatchPending || 0;
        const biwRev = row.biwTotalReviewed || row.totalReviewed || 0;
        const biwPend = row.biwReviewPending || row.reviewPending || 0;
        const tvsRev = row.tvsTotalReviewed || 0;
        const tvsAcc = row.tvsAccepted || 0;
        const tvsDef = (row.tvsRejected || 0) + (row.tvsReworked || 0);
        const tvsPend = row.tvsReviewPending || 0;

        switch (selectedSlice) {
          case "directOk":
            return dOk > 0;
          case "reworkCompleted":
            return rwComp > 0;
          case "accepted":
            return (dOk + rwComp) > 0 || (row.accepted || 0) > 0;
          case "rework":
            return rwPend > 0;
          case "rejected":
            return rej > 0;
          case "pendingDispatch":
            return dispPend > 0;
          case "dispatched":
            return disp > 0;
          case "biwReviewed":
            return biwRev > 0;
          case "pendingData":
            return biwPend > 0;
          case "tvsReviewed":
            return tvsRev > 0;
          case "tvsAccepted":
            return tvsAcc > 0;
          case "tvsDefects":
            return tvsDef > 0;
          case "pendingTvs":
            return tvsPend > 0;
          default:
            return true;
        }
      });
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      data = data.filter((row) => {
        const name = String(row.name || row.qcInspector || row.qcInspectorName || row.inspectorName || row.username || "").toLowerCase();
        const email = String(row.email || "").toLowerCase();
        const tenant = String(row.tenantName || "").toLowerCase();
        return name.includes(term) || email.includes(term) || tenant.includes(term);
      });
    }
    return data;
  }, [performanceTableData, selectedSlice, searchTerm, inspectorStatusMap]);

  const {
    totalPerformanceItems,
    totalPerformancePages,
    startIndex,
    endIndex,
    paginatedPerformance,
    tenantGroups,
    totalDispatched,
    getUserTotalSubmitted,
    totalTotalSubmitted,
    totalTotalReviewed,
    totalAccepted,
    totalRejected,
    totalRework,
    totalTvsReviewed,
    totalTvsReviewPending,
    totalTvsAccepted,
    totalTvsRejected,
    totalTvsRework,
    totalOverallReviewed,
    totalOverallReviewPending,
    totalOverallAccepted,
    totalOverallRejected,
    totalOverallRework,
    allFormsBreakdown,
    allTimeBreakdown,
    avgPerformance,
    statusTotals,
    totalDirectOk,
    totalReworkQCCompleted,
    totalDispatchPending,
    totalReviewPending,
  } = useMemo(() => {
    const getUserTotalSubmitted = (rowName: string, backendTotal: number) => {
      if (backendTotal !== undefined && backendTotal !== null && backendTotal > 0) return backendTotal;
      const directOk = inspectorStatusMap[rowName]?.["Direct Ok"] || 0;
      const reworkCompleted = (inspectorStatusMap[rowName]?.["Rework QC Completed"] || inspectorStatusMap[rowName]?.["Rework Accepted"] || 0);
      const accepted = inspectorStatusMap[rowName]?.["Accepted"] || 0;
      const reworkPending = inspectorStatusMap[rowName]?.["Rework QC Pending"] || 0;
      const rejected = inspectorStatusMap[rowName]?.["Rejected"] || 0;
      const statusSum = directOk + reworkCompleted + accepted + reworkPending + rejected;
      return backendTotal || statusSum || 0;
    };

    const sortRows = (rows: any[]) => {
      if (!sortColumn) return rows;
      const sorted = [...rows];
      sorted.sort((a, b) => {
        let valA: any = 0;
        let valB: any = 0;

        switch (sortColumn) {
          case "name":
            valA = String(a.name || a.qcInspector || a.qcInspectorName || a.inspectorName || a.username || "").toLowerCase();
            valB = String(b.name || b.qcInspector || b.qcInspectorName || b.inspectorName || b.username || "").toLowerCase();
            return sortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);

          case "tenant":
            valA = String(a.tenantName || "").toLowerCase();
            valB = String(b.tenantName || "").toLowerCase();
            return sortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);

          case "Accepted":
          case "Direct Ok":
          case "Rework QC Completed": {
            valA = (a.directOk ?? inspectorStatusMap[a.name]?.["Direct Ok"] ?? 0) +
              (a.reworkQcCompleted ?? inspectorStatusMap[a.name]?.["Rework QC Completed"] ?? inspectorStatusMap[a.name]?.["Rework Accepted"] ?? 0) +
              (inspectorStatusMap[a.name]?.["Accepted"] ?? 0);
            valB = (b.directOk ?? inspectorStatusMap[b.name]?.["Direct Ok"] ?? 0) +
              (b.reworkQcCompleted ?? inspectorStatusMap[b.name]?.["Rework QC Completed"] ?? inspectorStatusMap[b.name]?.["Rework Accepted"] ?? 0) +
              (inspectorStatusMap[b.name]?.["Accepted"] ?? 0);
            break;
          }

          case "Rework QC Pending":
            valA = a.reworkQcPending ?? inspectorStatusMap[a.name]?.["Rework QC Pending"] ?? 0;
            valB = b.reworkQcPending ?? inspectorStatusMap[b.name]?.["Rework QC Pending"] ?? 0;
            break;

          case "Rejected":
            valA = a.rejected ?? inspectorStatusMap[a.name]?.["Rejected"] ?? 0;
            valB = b.rejected ?? inspectorStatusMap[b.name]?.["Rejected"] ?? 0;
            break;

          case "dispatchPending": {
            const dispA = a.dispatched ?? inspectorStatusMap[a.name]?.["Dispatched"] ?? 0;
            const dispB = b.dispatched ?? inspectorStatusMap[b.name]?.["Dispatched"] ?? 0;
            const accA = (a.directOk ?? inspectorStatusMap[a.name]?.["Direct Ok"] ?? 0) +
              (a.reworkQcCompleted ?? inspectorStatusMap[a.name]?.["Rework QC Completed"] ?? inspectorStatusMap[a.name]?.["Rework Accepted"] ?? 0) +
              (inspectorStatusMap[a.name]?.["Accepted"] ?? 0);
            const accB = (b.directOk ?? inspectorStatusMap[b.name]?.["Direct Ok"] ?? 0) +
              (b.reworkQcCompleted ?? inspectorStatusMap[b.name]?.["Rework QC Completed"] ?? inspectorStatusMap[b.name]?.["Rework Accepted"] ?? 0) +
              (inspectorStatusMap[b.name]?.["Accepted"] ?? 0);
            valA = Math.max(0, accA - dispA);
            valB = Math.max(0, accB - dispB);
            break;
          }

          case "dispatched":
            valA = a.dispatched ?? inspectorStatusMap[a.name]?.["Dispatched"] ?? 0;
            valB = b.dispatched ?? inspectorStatusMap[b.name]?.["Dispatched"] ?? 0;
            break;

          case "totalSubmitted":
            valA = getUserTotalSubmitted(a.name, a.totalSubmitted || 0);
            valB = getUserTotalSubmitted(b.name, b.totalSubmitted || 0);
            break;

          case "totalReviewed":
            valA = a.totalReviewed ?? a.biwTotalReviewed ?? 0;
            valB = b.totalReviewed ?? b.biwTotalReviewed ?? 0;
            break;

          case "reviewPending":
            valA = a.reviewPending ?? a.biwReviewPending ?? 0;
            valB = b.reviewPending ?? b.biwReviewPending ?? 0;
            break;

          case "accepted":
            valA = a.biwAccepted ?? a.accepted ?? 0;
            valB = b.biwAccepted ?? b.accepted ?? 0;
            break;

          case "rejectedReview":
            valA = a.biwRejected ?? a.rejectedReview ?? a.rejected ?? 0;
            valB = b.biwRejected ?? b.rejectedReview ?? b.rejected ?? 0;
            break;

          case "reworked":
            valA = a.biwReworked ?? a.reworked ?? a.rework ?? 0;
            valB = b.biwReworked ?? b.reworked ?? b.rework ?? 0;
            break;

          case "tvsTotalReviewed":
            valA = a.tvsTotalReviewed ?? 0;
            valB = b.tvsTotalReviewed ?? 0;
            break;

          case "tvsReviewPending": {
            const dispA = a.dispatched || 0;
            const dispB = b.dispatched || 0;
            valA = a.tvsReviewPending ?? Math.max(0, dispA - (a.tvsTotalReviewed ?? 0));
            valB = b.tvsReviewPending ?? Math.max(0, dispB - (b.tvsTotalReviewed ?? 0));
            break;
          }

          case "tvsAccepted":
            valA = a.tvsAccepted ?? 0;
            valB = b.tvsAccepted ?? 0;
            break;

          case "tvsRejected":
            valA = a.tvsRejected ?? 0;
            valB = b.tvsRejected ?? 0;
            break;

          case "tvsReworked":
            valA = a.tvsReworked ?? 0;
            valB = b.tvsReworked ?? 0;
            break;

          case "reviewedTotal":
            valA = (a.biwTotalReviewed || a.totalReviewed || 0) + (a.tvsTotalReviewed || 0);
            valB = (b.biwTotalReviewed || b.totalReviewed || 0) + (b.tvsTotalReviewed || 0);
            break;

          case "reviewedPending": {
            const subA = getUserTotalSubmitted(a.name, a.totalSubmitted || 0);
            const subB = getUserTotalSubmitted(b.name, b.totalSubmitted || 0);
            valA = Math.max(0, subA - ((a.biwTotalReviewed || a.totalReviewed || 0) + (a.tvsTotalReviewed || 0)));
            valB = Math.max(0, subB - ((b.biwTotalReviewed || b.totalReviewed || 0) + (b.tvsTotalReviewed || 0)));
            break;
          }

          case "reviewedAccepted":
            valA = (a.biwAccepted ?? a.accepted ?? 0) + (a.tvsAccepted || 0);
            valB = (b.biwAccepted ?? b.accepted ?? 0) + (b.tvsAccepted || 0);
            break;

          case "reviewedRejected":
            valA = (a.biwRejected ?? a.rejectedReview ?? a.rejected ?? 0) + (a.tvsRejected || 0);
            valB = (b.biwRejected ?? b.rejectedReview ?? b.rejected ?? 0) + (b.tvsRejected || 0);
            break;

          case "reviewedRework":
            valA = (a.biwReworked ?? a.reworked ?? a.rework ?? 0) + (a.tvsReworked || 0);
            valB = (b.biwReworked ?? b.reworked ?? b.rework ?? 0) + (b.tvsReworked || 0);
            break;

          case "performanceScore":
            valA = a.performanceScore ?? 0;
            valB = b.performanceScore ?? 0;
            break;

          default:
            valA = inspectorStatusMap[a.name]?.[sortColumn] ?? a[sortColumn] ?? 0;
            valB = inspectorStatusMap[b.name]?.[sortColumn] ?? b[sortColumn] ?? 0;
        }

        if (typeof valA === "number" && typeof valB === "number") {
          return sortOrder === "asc" ? valA - valB : valB - valA;
        }
        return 0;
      });
      return sorted;
    };

    const sortedData = sortRows(filteredData);
    const totalPerformanceItems = filteredData.length;
    const totalPerformancePages = Math.ceil(
      totalPerformanceItems / performancePageSize,
    );
    const startIndex = (performancePage - 1) * performancePageSize;
    const endIndex = startIndex + performancePageSize;
    const paginatedPerformance = sortedData.slice(
      startIndex,
      endIndex,
    );

    const totalDispatched = filteredData.reduce(
      (sum, row) => sum + (row.dispatched || 0),
      0,
    );

    const totalTotalSubmitted = filteredData.reduce(
      (sum, row) => sum + (row.totalSubmitted || 0),
      0,
    );
    const totalTotalReviewed = filteredData.reduce(
      (sum, row) => sum + (row.totalReviewed || row.biwTotalReviewed || 0),
      0,
    );
    const totalAccepted = filteredData.reduce(
      (sum, row) => sum + (row.biwAccepted ?? row.accepted ?? 0),
      0,
    );
    const totalRejected = filteredData.reduce(
      (sum, row) => sum + (row.biwRejected ?? row.rejectedReview ?? row.rejected ?? 0),
      0,
    );
    const totalRework = filteredData.reduce(
      (sum, row) => sum + (row.biwReworked ?? row.reworked ?? row.rework ?? 0),
      0,
    );
    const reviewedRows = filteredData.filter(
      (row) => (row.totalReviewed || row.biwTotalReviewed || 0) > 0,
    );
    const avgPerformance =
      reviewedRows.length > 0
        ? Math.round(
          reviewedRows.reduce(
            (sum, row) => sum + (row.performanceScore || 0),
            0,
          ) / reviewedRows.length,
        )
        : null;

    const statusTotals: Record<string, number> = {};
    const statusKeyMap: Record<string, string> = {
      "Accepted": "accepted",
      "Direct Ok": "directOk",
      "Rework QC Completed": "reworkQcCompleted",
      "Rework QC Pending": "reworkQcPending",
      "Rejected": "rejected",
    };
    performanceStatuses
      .filter((s) => s !== "Dispatched")
      .forEach((status) => {
        if (status === "Accepted") {
          statusTotals[status] = filteredData.reduce((sum, row) => {
            const dOk = row.directOk ?? inspectorStatusMap[row.name]?.["Direct Ok"] ?? 0;
            const rComp = row.reworkQcCompleted ?? inspectorStatusMap[row.name]?.["Rework QC Completed"] ?? inspectorStatusMap[row.name]?.["Rework Accepted"] ?? 0;
            const acc = inspectorStatusMap[row.name]?.["Accepted"] || 0;
            return sum + (dOk + rComp + acc);
          }, 0);
        } else {
          const key = statusKeyMap[status];
          statusTotals[status] = filteredData.reduce((sum, row) => {
            const val = key && row[key] !== undefined ? row[key] : (inspectorStatusMap[row.name]?.[status] || 0);
            return sum + (val || 0);
          }, 0);
        }
      });

    const totalDirectOk = filteredData.reduce(
      (sum, row) => sum + (row.directOk ?? inspectorStatusMap[row.name]?.["Direct Ok"] ?? 0),
      0,
    );
    const totalReworkQCCompleted = filteredData.reduce(
      (sum, row) => sum + (row.reworkQcCompleted ?? inspectorStatusMap[row.name]?.["Rework QC Completed"] ?? 0),
      0,
    );
    let totalDispatchPending = filteredData.reduce((sum, row) => {
      const dOk = (row.directOk !== undefined ? row.directOk : (inspectorStatusMap[row.name]?.["Direct Ok"] || 0)) + (inspectorStatusMap[row.name]?.["Accepted"] || 0);
      const rComp = (row.reworkQcCompleted !== undefined ? row.reworkQcCompleted : (inspectorStatusMap[row.name]?.["Rework QC Completed"] || inspectorStatusMap[row.name]?.["Rework Accepted"] || 0));
      const disp = row.dispatched ?? inspectorStatusMap[row.name]?.["Dispatched"] ?? 0;
      const p = row.dispatchPending !== undefined ? row.dispatchPending : Math.max(0, dOk + rComp - disp);
      return sum + p;
    }, 0);
    let totalReviewPending = Math.max(
      0,
      totalDispatched - totalTotalReviewed,
    );

    const totalTvsReviewed = filteredData.reduce(
      (sum, row) => sum + (row.tvsTotalReviewed || 0),
      0,
    );
    let totalTvsReviewPending = filteredData.reduce(
      (sum, row) => {
        const disp = row.dispatched || 0;
        return sum + (row.tvsReviewPending ?? Math.max(0, disp - (row.tvsTotalReviewed || 0)));
      },
      0,
    );
    const totalTvsAccepted = filteredData.reduce(
      (sum, row) => sum + (row.tvsAccepted || 0),
      0,
    );
    const totalTvsRejected = filteredData.reduce(
      (sum, row) => sum + (row.tvsRejected || 0),
      0,
    );
    const totalTvsRework = filteredData.reduce(
      (sum, row) => sum + (row.tvsReworked || 0),
      0,
    );
    const totalOverallReviewed = filteredData.reduce(
      (sum, row) => sum + ((row.biwTotalReviewed || row.totalReviewed || 0) + (row.tvsTotalReviewed || 0)),
      0,
    );
    const totalOverallReviewPending = filteredData.reduce(
      (sum, row) => {
        const sub = row.totalSubmitted || 0;
        const rev = (row.biwTotalReviewed || row.totalReviewed || 0) + (row.tvsTotalReviewed || 0);
        return sum + Math.max(0, sub - rev);
      },
      0,
    );
    const totalOverallAccepted = filteredData.reduce(
      (sum, row) => sum + ((row.biwAccepted ?? row.accepted ?? 0) + (row.tvsAccepted || 0)),
      0,
    );
    const totalOverallRejected = filteredData.reduce(
      (sum, row) => sum + ((row.biwRejected ?? row.rejectedReview ?? row.rejected ?? 0) + (row.tvsRejected || 0)),
      0,
    );
    const totalOverallRework = filteredData.reduce(
      (sum, row) => sum + ((row.biwReworked ?? row.reworked ?? row.rework ?? 0) + (row.tvsReworked || 0)),
      0,
    );

    // Build tenant groups for Excel Pivot style hierarchy
    const tenantGroupsMap = new Map<string, {
      tenantName: string;
      tenantId?: string;
      rows: any[];
      formBreakdown: any[];
      timeBreakdown: any[];
      totals: {
        directOk: number;
        reworkQcCompleted: number;
        reworkQcPending: number;
        rejected: number;
        dispatchPending: number;
        dispatched: number;
        totalSubmitted: number;
        totalReviewed: number;
        reviewPending: number;
        biwAccepted: number;
        biwRejected: number;
        biwReworked: number;
        tvsReviewed: number;
        tvsPending: number;
        tvsAccepted: number;
        tvsRejected: number;
        tvsRework: number;
        reviewedTotal: number;
        reviewedPending: number;
        reviewedAccepted: number;
        reviewedRejected: number;
        reviewedRework: number;
        performanceScore: number;
      };
    }>();

    filteredData.forEach((row) => {
      const tName = row.tenantName || "Unknown Plant";
      if (!tenantGroupsMap.has(tName)) {
        tenantGroupsMap.set(tName, {
          tenantName: tName,
          tenantId: row.tenantId,
          rows: [],
          formBreakdown: [],
          timeBreakdown: [],
          totals: {
            directOk: 0,
            reworkQcCompleted: 0,
            reworkQcPending: 0,
            rejected: 0,
            dispatchPending: 0,
            dispatched: 0,
            totalSubmitted: 0,
            totalReviewed: 0,
            reviewPending: 0,
            biwAccepted: 0,
            biwRejected: 0,
            biwReworked: 0,
            tvsReviewed: 0,
            tvsPending: 0,
            tvsAccepted: 0,
            tvsRejected: 0,
            tvsRework: 0,
            reviewedTotal: 0,
            reviewedPending: 0,
            reviewedAccepted: 0,
            reviewedRejected: 0,
            reviewedRework: 0,
            performanceScore: 0,
          }
        });
      }

      const g = tenantGroupsMap.get(tName)!;
      g.rows.push(row);

      // Aggregate formBreakdown for the plant
      (row.formBreakdown || []).forEach((f: any) => {
        const k = f.formId || f.formTitle || "Inspection Form";
        let existingF = g.formBreakdown.find((x: any) => (x.formId || x.formTitle) === k);
        if (!existingF) {
          existingF = { ...f, formTitle: f.formTitle || k };
          g.formBreakdown.push(existingF);
        } else {
          existingF.totalSubmitted = (existingF.totalSubmitted || 0) + (f.totalSubmitted || 0);
          existingF.directOk = (existingF.directOk || 0) + (f.directOk || 0);
          existingF.reworkQcCompleted = (existingF.reworkQcCompleted || 0) + (f.reworkQcCompleted || 0);
          existingF.reworkQcPending = (existingF.reworkQcPending || 0) + (f.reworkQcPending || 0);
          existingF.rejected = (existingF.rejected || 0) + (f.rejected || 0);
          existingF.dispatched = (existingF.dispatched || 0) + (f.dispatched || 0);
          existingF.dispatchPending = (existingF.dispatchPending || 0) + (f.dispatchPending || 0);
          existingF.biwTotalReviewed = (existingF.biwTotalReviewed || 0) + (f.biwTotalReviewed || 0);
          existingF.biwAccepted = (existingF.biwAccepted || 0) + (f.biwAccepted || 0);
          existingF.biwRejected = (existingF.biwRejected || 0) + (f.biwRejected || 0);
          existingF.biwReworked = (existingF.biwReworked || 0) + (f.biwReworked || 0);
          existingF.tvsTotalReviewed = (existingF.tvsTotalReviewed || 0) + (f.tvsTotalReviewed || 0);
          existingF.tvsAccepted = (existingF.tvsAccepted || 0) + (f.tvsAccepted || 0);
          existingF.tvsRejected = (existingF.tvsRejected || 0) + (f.tvsRejected || 0);
          existingF.tvsReworked = (existingF.tvsReworked || 0) + (f.tvsReworked || 0);
        }
      });

      // Aggregate timeBreakdown for the plant
      (row.timeBreakdown || []).forEach((tb: any) => {
        let existingTB = g.timeBreakdown.find((x: any) => x.bucketKey === tb.bucketKey);
        if (!existingTB) {
          existingTB = { ...tb };
          g.timeBreakdown.push(existingTB);
        } else {
          existingTB.totalSubmitted = (existingTB.totalSubmitted || 0) + (tb.totalSubmitted || 0);
          existingTB.directOk = (existingTB.directOk || 0) + (tb.directOk || 0);
          existingTB.reworkQcCompleted = (existingTB.reworkQcCompleted || 0) + (tb.reworkQcCompleted || 0);
          existingTB.reworkQcPending = (existingTB.reworkQcPending || 0) + (tb.reworkQcPending || 0);
          existingTB.rejected = (existingTB.rejected || 0) + (tb.rejected || 0);
          existingTB.dispatched = (existingTB.dispatched || 0) + (tb.dispatched || 0);
          existingTB.dispatchPending = (existingTB.dispatchPending || 0) + (tb.dispatchPending || 0);
          existingTB.biwTotalReviewed = (existingTB.biwTotalReviewed || 0) + (tb.biwTotalReviewed || 0);
          existingTB.biwAccepted = (existingTB.biwAccepted || 0) + (tb.biwAccepted || 0);
          existingTB.biwRejected = (existingTB.biwRejected || 0) + (tb.biwRejected || 0);
          existingTB.biwReworked = (existingTB.biwReworked || 0) + (tb.biwReworked || 0);
          existingTB.tvsTotalReviewed = (existingTB.tvsTotalReviewed || 0) + (tb.tvsTotalReviewed || 0);
          existingTB.tvsAccepted = (existingTB.tvsAccepted || 0) + (tb.tvsAccepted || 0);
          existingTB.tvsRejected = (existingTB.tvsRejected || 0) + (tb.tvsRejected || 0);
          existingTB.tvsReworked = (existingTB.tvsReworked || 0) + (tb.tvsReworked || 0);
        }
      });

      const dOk = (row.directOk !== undefined ? row.directOk : (inspectorStatusMap[row.name]?.["Direct Ok"] || 0)) + (inspectorStatusMap[row.name]?.["Accepted"] || 0);
      const rComp = (row.reworkQcCompleted !== undefined ? row.reworkQcCompleted : (inspectorStatusMap[row.name]?.["Rework QC Completed"] || inspectorStatusMap[row.name]?.["Rework Accepted"] || 0));
      const rPend = row.reworkQcPending ?? inspectorStatusMap[row.name]?.["Rework QC Pending"] ?? 0;
      const rej = row.rejected ?? inspectorStatusMap[row.name]?.["Rejected"] ?? 0;
      const disp = row.dispatched ?? inspectorStatusMap[row.name]?.["Dispatched"] ?? 0;
      const dPending = row.dispatchPending !== undefined ? row.dispatchPending : Math.max(0, dOk + rComp - disp);
      const sub = row.totalSubmitted || 0;

      g.totals.directOk += dOk;
      g.totals.reworkQcCompleted += rComp;
      g.totals.reworkQcPending += rPend;
      g.totals.rejected += rej;
      g.totals.dispatchPending += dPending;
      g.totals.dispatched += disp;
      g.totals.totalSubmitted += sub;

      g.totals.totalReviewed += (row.totalReviewed ?? row.biwTotalReviewed ?? 0);
      g.totals.reviewPending += (row.reviewPending ?? row.biwReviewPending ?? 0);
      g.totals.biwAccepted += (row.biwAccepted ?? row.accepted ?? 0);
      g.totals.biwRejected += (row.biwRejected ?? row.rejectedReview ?? 0);
      g.totals.biwReworked += (row.biwReworked ?? row.reworked ?? 0);

      g.totals.tvsReviewed += (row.tvsTotalReviewed ?? 0);
      g.totals.tvsPending += (row.tvsReviewPending ?? Math.max(0, disp - (row.tvsTotalReviewed ?? 0)));
      g.totals.tvsAccepted += (row.tvsAccepted ?? 0);
      g.totals.tvsRejected += (row.tvsRejected ?? 0);
      g.totals.tvsRework += (row.tvsReworked ?? 0);

      const rRev = (row.biwTotalReviewed || row.totalReviewed || 0) + (row.tvsTotalReviewed || 0);
      const rAcc = (row.biwAccepted ?? row.accepted ?? 0) + (row.tvsAccepted || 0);
      const rRej = (row.biwRejected ?? row.rejectedReview ?? 0) + (row.tvsRejected || 0);
      const rRew = (row.biwReworked ?? row.reworked ?? 0) + (row.tvsReworked || 0);
      const rPending = Math.max(0, sub - rRev);

      g.totals.reviewedTotal += rRev;
      g.totals.reviewedPending += rPending;
      g.totals.reviewedAccepted += rAcc;
      g.totals.reviewedRejected += rRej;
      g.totals.reviewedRework += rRew;
    });

    tenantGroupsMap.forEach((g) => {
      // Reconcile plant-level pending values using form breakdowns to prevent cross-form over-cancellation
      if (g.formBreakdown && g.formBreakdown.length > 0) {
        g.totals.tvsPending = g.formBreakdown.reduce(
          (sum: number, f: any) => sum + Math.max(0, (f.dispatched || 0) - (f.tvsTotalReviewed || 0)),
          0
        );
        g.totals.reviewPending = g.formBreakdown.reduce(
          (sum: number, f: any) => sum + Math.max(0, (f.dispatched || 0) - (f.biwTotalReviewed || 0)),
          0
        );
        g.totals.dispatchPending = g.formBreakdown.reduce(
          (sum: number, f: any) => sum + Math.max(0, ((f.directOk || 0) + (f.reworkQcCompleted || 0)) - (f.dispatched || 0)),
          0
        );
      }

      const reviewed = g.rows.filter(r => (r.totalReviewed || r.biwTotalReviewed || 0) > 0);
      if (reviewed.length > 0) {
        g.totals.performanceScore = Math.round(
          reviewed.reduce((sum, r) => sum + (r.performanceScore || 0), 0) / reviewed.length
        );
      } else {
        g.totals.performanceScore = g.totals.totalSubmitted > 0
          ? Math.round((g.totals.directOk / g.totals.totalSubmitted) * 100)
          : 0;
      }
    });

    const allFormsBreakdown: any[] = [];
    filteredData.forEach((row) => {
      (row.formBreakdown || []).forEach((f: any) => {
        const k = f.formId || f.formTitle || "Inspection Form";
        let existingF = allFormsBreakdown.find((x: any) => (x.formId || x.formTitle) === k);
        if (!existingF) {
          existingF = { ...f, formTitle: f.formTitle || k };
          allFormsBreakdown.push(existingF);
        } else {
          existingF.totalSubmitted = (existingF.totalSubmitted || 0) + (f.totalSubmitted || 0);
          existingF.directOk = (existingF.directOk || 0) + (f.directOk || 0);
          existingF.reworkQcCompleted = (existingF.reworkQcCompleted || 0) + (f.reworkQcCompleted || 0);
          existingF.reworkQcPending = (existingF.reworkQcPending || 0) + (f.reworkQcPending || 0);
          existingF.rejected = (existingF.rejected || 0) + (f.rejected || 0);
          existingF.dispatched = (existingF.dispatched || 0) + (f.dispatched || 0);
          existingF.dispatchPending = (existingF.dispatchPending || 0) + (f.dispatchPending || 0);
          existingF.biwTotalReviewed = (existingF.biwTotalReviewed || 0) + (f.biwTotalReviewed || 0);
          existingF.biwAccepted = (existingF.biwAccepted || 0) + (f.biwAccepted || 0);
          existingF.biwRejected = (existingF.biwRejected || 0) + (f.biwRejected || 0);
          existingF.biwReworked = (existingF.biwReworked || 0) + (f.biwReworked || 0);
          existingF.tvsTotalReviewed = (existingF.tvsTotalReviewed || 0) + (f.tvsTotalReviewed || 0);
          existingF.tvsAccepted = (existingF.tvsAccepted || 0) + (f.tvsAccepted || 0);
          existingF.tvsRejected = (existingF.tvsRejected || 0) + (f.tvsRejected || 0);
          existingF.tvsReworked = (existingF.tvsReworked || 0) + (f.tvsReworked || 0);
        }
      });
    });

    // Reconcile grand totals using all forms breakdown
    if (allFormsBreakdown.length > 0) {
      totalDispatchPending = allFormsBreakdown.reduce(
        (sum, f) => sum + Math.max(0, ((f.directOk || 0) + (f.reworkQcCompleted || 0)) - (f.dispatched || 0)),
        0
      );
      totalReviewPending = allFormsBreakdown.reduce(
        (sum, f) => sum + Math.max(0, (f.dispatched || 0) - (f.biwTotalReviewed || 0)),
        0
      );
      totalTvsReviewPending = allFormsBreakdown.reduce(
        (sum, f) => sum + Math.max(0, (f.dispatched || 0) - (f.tvsTotalReviewed || 0)),
        0
      );
    }

    const allTimeBreakdown: any[] = [];
    filteredData.forEach((row) => {
      (row.timeBreakdown || []).forEach((tb: any) => {
        let existingTB = allTimeBreakdown.find((x: any) => x.bucketKey === tb.bucketKey);
        if (!existingTB) {
          existingTB = { ...tb };
          allTimeBreakdown.push(existingTB);
        } else {
          existingTB.totalSubmitted = (existingTB.totalSubmitted || 0) + (tb.totalSubmitted || 0);
          existingTB.directOk = (existingTB.directOk || 0) + (tb.directOk || 0);
          existingTB.reworkQcCompleted = (existingTB.reworkQcCompleted || 0) + (tb.reworkQcCompleted || 0);
          existingTB.reworkQcPending = (existingTB.reworkQcPending || 0) + (tb.reworkQcPending || 0);
          existingTB.rejected = (existingTB.rejected || 0) + (tb.rejected || 0);
          existingTB.dispatched = (existingTB.dispatched || 0) + (tb.dispatched || 0);
          existingTB.dispatchPending = (existingTB.dispatchPending || 0) + (tb.dispatchPending || 0);
          existingTB.biwTotalReviewed = (existingTB.biwTotalReviewed || 0) + (tb.biwTotalReviewed || 0);
          existingTB.biwAccepted = (existingTB.biwAccepted || 0) + (tb.biwAccepted || 0);
          existingTB.biwRejected = (existingTB.biwRejected || 0) + (tb.biwRejected || 0);
          existingTB.biwReworked = (existingTB.biwReworked || 0) + (tb.biwReworked || 0);
          existingTB.tvsTotalReviewed = (existingTB.tvsTotalReviewed || 0) + (tb.tvsTotalReviewed || 0);
          existingTB.tvsAccepted = (existingTB.tvsAccepted || 0) + (tb.tvsAccepted || 0);
          existingTB.tvsRejected = (existingTB.tvsRejected || 0) + (tb.tvsRejected || 0);
          existingTB.tvsReworked = (existingTB.tvsReworked || 0) + (tb.tvsReworked || 0);
        }
      });
    });

    const tenantGroups = Array.from(tenantGroupsMap.values())
      .map((g) => ({
        ...g,
        rows: sortRows(g.rows),
      }))
      .filter((g) => g.rows.length > 0)
      .sort((a, b) => {
        if (sortColumn === "tenant" || sortColumn === "name") {
          return sortOrder === "asc"
            ? a.tenantName.localeCompare(b.tenantName)
            : b.tenantName.localeCompare(a.tenantName);
        }
        return a.tenantName.localeCompare(b.tenantName);
      });

    return {
      inspectorStatusMap,
      totalPerformanceItems,
      totalPerformancePages,
      startIndex,
      endIndex,
      paginatedPerformance,
      tenantGroups,
      totalDispatched,
      getUserTotalSubmitted,
      totalTotalSubmitted,
      totalTotalReviewed,
      totalAccepted,
      totalRejected,
      totalRework,
      totalTvsReviewed,
      totalTvsReviewPending,
      totalTvsAccepted,
      totalTvsRejected,
      totalTvsRework,
      totalOverallReviewed,
      totalOverallReviewPending,
      totalOverallAccepted,
      totalOverallRejected,
      totalOverallRework,
      allFormsBreakdown,
      allTimeBreakdown,
      avgPerformance,
      statusTotals,
      totalDirectOk,
      totalReworkQCCompleted,
      totalDispatchPending,
      totalReviewPending,
    };
  }, [
    filteredData,
    sortColumn,
    sortOrder,
    inspectorStatusMap,
    performancePage,
    performancePageSize,
    performanceStatuses,
  ]);

  // Render logic
  if (!useInternalTrackingEndpoint && user?.role !== "admin" && user?.role !== "superadmin") return null;

  if (!showPerformanceTable) {
    return (
      <div className="mt-12 border-t border-gray-100 dark:border-gray-600 pt-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1.5 h-6 bg-purple-600 rounded-full"></div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white leading-none mb-1">
                {title || "Performance Table"}
              </h3>
              <button
                type="button"
                onClick={() => setShowPerformanceGuide(true)}
                className="inline-flex items-center justify-center p-1 rounded-full text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/50 dark:text-purple-300 dark:hover:bg-purple-900/60 transition-colors shadow-2xs cursor-pointer"
                title="How does the Performance Table work?"
                aria-label="How does the Performance Table work?"
              >
                <Info className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Per-user performance data
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowPerformanceTable(true)}
          className="w-full py-8 bg-purple-50 dark:bg-purple-900/10 border-2 border-dashed border-purple-300 dark:border-purple-700 rounded-3xl hover:bg-purple-100 dark:hover:bg-purple-900/20 transition-all group"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full group-hover:scale-110 transition-transform">
              <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-purple-700 dark:text-purple-300">
                Load Performance Table
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                View per-user performance data
              </p>
            </div>
          </div>
        </button>
      </div>
    );
  }

  if (performanceTableLoading) {
    return (
      <div className="mt-12 text-center py-8">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
          <p className="text-gray-500 text-sm">Loading performance data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-12 border-t border-gray-100 dark:border-gray-600 pt-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-6 bg-purple-600 rounded-full"></div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white leading-none mb-1">
                {title || "Performance Table"}
              </h3>
              <button
                type="button"
                onClick={() => setShowPerformanceGuide(true)}
                className="inline-flex items-center justify-center p-1 rounded-full text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/50 dark:text-purple-300 dark:hover:bg-purple-900/60 transition-colors shadow-2xs cursor-pointer"
                title="How does the Performance Table work?"
                aria-label="How does the Performance Table work?"
              >
                <Info className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Per-user performance data
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* View Mode Toggle (Excel Pivot Hierarchy vs Flat vs Cross Tenant) */}
          <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode("grouped")}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${viewMode === "grouped"
                ? "bg-white dark:bg-gray-700 text-purple-700 dark:text-purple-300 shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
                }`}
              title="Group by Plant / Tenant (Excel Pivot Style)"
            >
              <span>📊 Group by Plant</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("flat")}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${viewMode === "flat"
                ? "bg-white dark:bg-gray-700 text-purple-700 dark:text-purple-300 shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
                }`}
              title="Flat Inspector List"
            >
              <span>📋 Flat List</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("cross_tenant")}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${viewMode === "cross_tenant"
                ? "bg-white dark:bg-gray-700 text-purple-700 dark:text-purple-300 shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
                }`}
              title="Cross Tenant Performance"
            >
              <span>🏢 Cross Tenant Performance</span>
            </button>
          </div>

          {viewMode === "grouped" && (
            <button
              type="button"
              onClick={() => {
                if (collapsedTenants.size === 0) {
                  collapseAllTenants(tenantGroups);
                } else {
                  expandAllTenants();
                }
              }}
              className="px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-2xl border border-gray-200 dark:border-gray-700 transition-colors shadow-sm cursor-pointer whitespace-nowrap"
            >
              {collapsedTenants.size === 0 ? "[-] Collapse All" : "[+] Expand All"}
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowReviewerSection((prev) => !prev)}
            className={`px-3 py-2 text-xs font-bold rounded-2xl border transition-colors shadow-sm cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 ${
              showReviewerSection
                ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
            title={showReviewerSection ? "Hide Reviewed Section columns" : "Show Reviewed Section columns"}
          >
            {showReviewerSection ? (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                <span>Hide Reviewed Section</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>Show Reviewed Section</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              try {
                sessionStorage.removeItem(getCacheKey());
              } catch (_) {}
              loadPerformanceData(true, false);
            }}
            disabled={performanceTableLoading}
            className="px-3 py-2 text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 rounded-2xl border border-purple-200 dark:border-purple-700 transition-colors shadow-sm cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 disabled:opacity-60"
            title="Refresh Performance Table data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${performanceTableLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          {/* Inspector / User Search */}
          <div className="flex items-center bg-white dark:bg-gray-800 rounded-2xl px-3.5 py-1.5 border border-gray-200 dark:border-gray-700 shadow-sm focus-within:ring-2 focus-within:ring-purple-500/20 transition-all min-w-[200px] sm:min-w-[240px]">
            <Search className="w-3.5 h-3.5 text-gray-400 mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Search user / inspector..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPerformancePage(1);
              }}
              className="bg-transparent text-xs font-semibold text-gray-700 dark:text-gray-200 focus:outline-none w-full placeholder:text-gray-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="text-gray-400 hover:text-red-500 ml-1 p-0.5 rounded cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Active Status / Slice Filter Badge (Synced with Top Pie Chart) */}
          {selectedSlice && selectedSlice !== "all" && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 rounded-2xl border border-emerald-300/60 dark:border-emerald-800/40 text-xs font-bold shadow-2xs whitespace-nowrap animate-fadeIn">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Status: {sliceLabelMap[selectedSlice] || selectedSlice}</span>
              {onClearSlice && (
                <button
                  type="button"
                  onClick={onClearSlice}
                  className="ml-1 p-0.5 hover:bg-emerald-200 dark:hover:bg-emerald-900 rounded-full text-emerald-700 dark:text-emerald-300 transition-colors cursor-pointer"
                  title="Clear status filter"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Active Top Date Filter Badge (Applied from parent/top dashboard filter) */}
          {(effectiveStartDate || effectiveEndDate) && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50/80 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-2xl border border-purple-200/60 dark:border-purple-800/40 text-xs font-bold shadow-2xs whitespace-nowrap" title="Applied from top dashboard date filter">
              <Calendar className="w-3.5 h-3.5 text-purple-500" />
              <span>
                {effectiveStartDate && effectiveEndDate
                  ? `${effectiveStartDate} to ${effectiveEndDate}`
                  : effectiveStartDate
                    ? `From ${effectiveStartDate}`
                    : `To ${effectiveEndDate}`}
              </span>
            </div>
          )}
        </div>
      </div>

      {viewMode === "cross_tenant" && (
        <div className="mb-4 p-3.5 bg-gradient-to-r from-purple-50 via-indigo-50/60 to-purple-50/30 dark:from-purple-950/40 dark:via-indigo-950/30 dark:to-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-2xl flex items-center justify-between gap-3 text-xs shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-gray-900 dark:text-gray-100">
                Cross-Tenant Multi-Plant Performance Audit
              </p>
              <p className="text-gray-600 dark:text-gray-400 text-[11px]">
                Auditing inspection, BIW review, and TVS review accountability across LMPL, Saify, Sreedevi, and TVS. Click the <span className="font-bold text-purple-700 dark:text-purple-300">ⓘ</span> icon next to any inspector's name to see their form-wise breakdown (Own vs Assigned Forms with verified database counts).
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shrink-0">
            Real Multi-Tenant Data
          </span>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        {performanceTableData.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-sm bg-gray-50/60 dark:bg-gray-900/20 m-4 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
            <Users className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="font-semibold text-gray-700 dark:text-gray-300">
              No performance records found for {effectiveStartDate || "selected range"} to {effectiveEndDate || "today"}
            </p>
            <p className="text-xs text-gray-400 mt-1">Adjust the From / To date range above to view historical data</p>
            <button
              onClick={() => {
                try {
                  sessionStorage.clear();
                } catch (e) { }
                loadPerformanceData();
              }}
              className="mt-3 px-4 py-2 text-xs font-bold text-purple-600 hover:text-purple-700 bg-purple-50 rounded-xl transition-colors cursor-pointer border border-purple-200"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="max-h-[600px] overflow-y-auto">
            <table className="w-full text-[11px] text-left border-collapse">
              <thead className="bg-gray-50/90 dark:bg-gray-700/90 sticky top-0 z-10 text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                {/* Grouped Section Header Row */}
                <tr className="border-b border-gray-200 dark:border-gray-600 text-[9px] font-black">
                  <th
                    colSpan={(isSuperAdmin ? 1 : 0) + 1 + performanceStatuses.filter(s => s !== "Dispatched").length + 1 + (performanceStatuses.includes("Dispatched") ? 1 : 0)}
                    className="px-3 py-1.5 bg-gray-100/70 dark:bg-gray-800/70 text-gray-500 dark:text-gray-400 text-left tracking-widest uppercase border-r border-gray-200 dark:border-gray-700"
                  >
                    Inspection & Dispatch
                  </th>
                  <th
                    colSpan={1}
                    className="px-2 py-1.5 bg-gray-100/70 dark:bg-gray-800/70 text-gray-600 dark:text-gray-300 text-center tracking-widest uppercase border-r border-gray-200 dark:border-gray-700"
                  >
                    Submission
                  </th>
                  <th
                    colSpan={5}
                    className="px-3 py-1.5 bg-purple-100/80 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-center tracking-widest uppercase border-x-2 border-purple-300 dark:border-purple-600 shadow-sm"
                  >
                    ✦ BIW Review Section ✦
                  </th>
                  <th
                    colSpan={5}
                    className="px-3 py-1.5 bg-blue-100/80 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-center tracking-widest uppercase border-x-2 border-blue-300 dark:border-blue-600 shadow-sm"
                  >
                    ✦ TVS Review Section ✦
                  </th>
                  {showReviewerSection && (
                    <th
                      colSpan={5}
                      className="px-3 py-1.5 bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 text-center tracking-widest uppercase border-x-2 border-emerald-300 dark:border-emerald-600 shadow-sm"
                    >
                      ✦ Reviewer Section ✦
                    </th>
                  )}
                  <th
                    colSpan={3}
                    className="px-3 py-1.5 bg-gray-100/70 dark:bg-gray-800/70 text-gray-500 dark:text-gray-400 text-center tracking-widest uppercase border-l border-gray-200 dark:border-gray-700"
                  >
                    Evaluation
                  </th>
                </tr>
                {/* Column Labels Row */}
                <tr className="text-[9px] font-black">
                  {isSuperAdmin && (
                    <th
                      onClick={() => handleSort("tenant")}
                      className="px-2 py-2 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap cursor-pointer hover:bg-gray-100/80 dark:hover:bg-gray-800/80 select-none group"
                      title="Click to sort by Tenant"
                    >
                      <div className="inline-flex items-center gap-1">
                        <span>Tenant</span>
                        {renderSortIcon("tenant")}
                      </div>
                    </th>
                  )}
                  <th
                    onClick={() => handleSort("name")}
                    className="px-2 py-2 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap cursor-pointer hover:bg-gray-100/80 dark:hover:bg-gray-800/80 select-none group"
                    title="Click to sort by User Name"
                  >
                    <div className="inline-flex items-center gap-1">
                      <span>User Name</span>
                      {renderSortIcon("name")}
                    </div>
                  </th>
                  {performanceStatuses
                    .filter((status) => status !== "Dispatched")
                    .map((status) => (
                      <th
                        key={status}
                        onClick={() => handleSort(status)}
                        className={`px-2 py-2 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap text-center text-indigo-600 cursor-pointer hover:bg-gray-100/80 dark:hover:bg-gray-800/80 select-none group ${isSliceActive(status) ? "bg-purple-100 dark:bg-purple-900/60 ring-2 ring-inset ring-purple-600 font-black" : ""}`}
                        title={`Click to sort by ${status}`}
                      >
                        <div className="inline-flex items-center gap-1 justify-center">
                          <span>{status}</span>
                          {renderSortIcon(status)}
                        </div>
                      </th>
                    ))}
                  <th
                    onClick={() => handleSort("dispatchPending")}
                    className={`px-2 py-2 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap text-center text-violet-600 cursor-pointer hover:bg-gray-100/80 dark:hover:bg-gray-800/80 select-none group ${isSliceActive("dispatchPending") ? "bg-purple-100 dark:bg-purple-900/60 ring-2 ring-inset ring-purple-600 font-black" : ""}`}
                    title="Click to sort by Dispatch Pending"
                  >
                    <div className="inline-flex items-center gap-1 justify-center">
                      <span>Dispatch Pending</span>
                      {renderSortIcon("dispatchPending")}
                    </div>
                  </th>
                  {performanceStatuses.includes("Dispatched") && (
                    <th
                      onClick={() => handleSort("dispatched")}
                      className={`px-2 py-2 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap text-center text-indigo-600 cursor-pointer hover:bg-gray-100/80 dark:hover:bg-gray-800/80 select-none group ${isSliceActive("dispatched") ? "bg-purple-100 dark:bg-purple-900/60 ring-2 ring-inset ring-purple-600 font-black" : ""}`}
                      title="Click to sort by Dispatched"
                    >
                      <div className="inline-flex items-center gap-1 justify-center">
                        <span>Dispatched</span>
                        {renderSortIcon("dispatched")}
                      </div>
                    </th>
                  )}
                  <th
                    onClick={() => handleSort("totalSubmitted")}
                    className="px-2 py-2 border-b border-r border-gray-200 dark:border-gray-700 whitespace-nowrap text-center cursor-pointer hover:bg-gray-100/80 dark:hover:bg-gray-800/80 select-none group"
                    title="Click to sort by Total Submitted"
                  >
                    <div className="inline-flex items-center gap-1 justify-center">
                      <span>Total Submitted</span>
                      {renderSortIcon("totalSubmitted")}
                    </div>
                  </th>
                  {/* BIW Review Section Columns */}
                  <th
                    onClick={() => handleSort("totalReviewed")}
                    className={`px-2 py-2 border-b border-l border-purple-200 dark:border-purple-800 bg-purple-50/60 dark:bg-purple-950/30 whitespace-nowrap text-center text-purple-800 dark:text-purple-200 cursor-pointer hover:bg-purple-100/80 dark:hover:bg-purple-900/50 select-none group ${isSliceActive("totalReviewed") ? "bg-purple-200 dark:bg-purple-900/80 ring-2 ring-inset ring-purple-600 font-black" : ""}`}
                    title="Click to sort by Total Reviewed"
                  >
                    <div className="inline-flex items-center gap-1 justify-center">
                      <span>Total Reviewed</span>
                      {renderSortIcon("totalReviewed")}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("reviewPending")}
                    className={`px-2 py-2 border-b bg-purple-50/60 dark:bg-purple-950/30 whitespace-nowrap text-center text-amber-600 dark:text-amber-400 cursor-pointer hover:bg-purple-100/80 dark:hover:bg-purple-900/50 select-none group ${isSliceActive("reviewPending") ? "bg-amber-100 dark:bg-amber-900/80 ring-2 ring-inset ring-amber-500 font-black" : ""}`}
                    title="Click to sort by Review Pending"
                  >
                    <div className="inline-flex items-center gap-1 justify-center">
                      <span>Review Pending</span>
                      {renderSortIcon("reviewPending")}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("accepted")}
                    className={`px-2 py-2 border-b bg-purple-50/60 dark:bg-purple-950/30 whitespace-nowrap text-center text-green-600 dark:text-green-400 font-extrabold cursor-pointer hover:bg-purple-100/80 dark:hover:bg-purple-900/50 select-none group ${isSliceActive("accepted") ? "bg-green-100 dark:bg-green-900/80 ring-2 ring-inset ring-green-600 font-black" : ""}`}
                    title="Click to sort by BIW Accepted"
                  >
                    <div className="inline-flex items-center gap-1 justify-center">
                      <span>BIW Accepted</span>
                      {renderSortIcon("accepted")}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("rejectedReview")}
                    className={`px-2 py-2 border-b bg-purple-50/60 dark:bg-purple-950/30 whitespace-nowrap text-center text-red-600 dark:text-red-400 font-extrabold cursor-pointer hover:bg-purple-100/80 dark:hover:bg-purple-900/50 select-none group ${isSliceActive("Rejected") ? "bg-red-100 dark:bg-red-900/80 ring-2 ring-inset ring-red-600 font-black" : ""}`}
                    title="Click to sort by BIW Rejected"
                  >
                    <div className="inline-flex items-center gap-1 justify-center">
                      <span>BIW Rejected</span>
                      {renderSortIcon("rejectedReview")}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("reworked")}
                    className={`px-2 py-2 border-b border-r border-purple-200 dark:border-purple-800 bg-purple-50/60 dark:bg-purple-950/30 whitespace-nowrap text-center text-orange-600 dark:text-orange-400 font-extrabold cursor-pointer hover:bg-purple-100/80 dark:hover:bg-purple-900/50 select-none group ${isSliceActive("Rework QC Pending") ? "bg-orange-100 dark:bg-orange-900/80 ring-2 ring-inset ring-orange-600 font-black" : ""}`}
                    title="Click to sort by BIW Reworked"
                  >
                    <div className="inline-flex items-center gap-1 justify-center">
                      <span>BIW Reworked</span>
                      {renderSortIcon("reworked")}
                    </div>
                  </th>
                  {/* TVS Review Section Columns */}
                  <th
                    onClick={() => handleSort("tvsTotalReviewed")}
                    className={`px-2 py-2 border-b border-l border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/30 whitespace-nowrap text-center text-blue-800 dark:text-blue-200 cursor-pointer hover:bg-blue-100/80 dark:hover:bg-blue-900/50 select-none group ${isSliceActive("tvsTotalReviewed") ? "bg-blue-200 dark:bg-blue-900/80 ring-2 ring-inset ring-blue-600 font-black" : ""}`}
                    title="Click to sort by TVS Reviewed"
                  >
                    <div className="inline-flex items-center gap-1 justify-center">
                      <span>TVS Reviewed</span>
                      {renderSortIcon("tvsTotalReviewed")}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("tvsReviewPending")}
                    className={`px-2 py-2 border-b bg-blue-50/60 dark:bg-blue-950/30 whitespace-nowrap text-center text-amber-600 dark:text-amber-400 cursor-pointer hover:bg-blue-100/80 dark:hover:bg-blue-900/50 select-none group ${isSliceActive("tvsReviewPending") ? "bg-amber-100 dark:bg-amber-900/80 ring-2 ring-inset ring-amber-500 font-black" : ""}`}
                    title="Click to sort by TVS Pending"
                  >
                    <div className="inline-flex items-center gap-1 justify-center">
                      <span>TVS Pending</span>
                      {renderSortIcon("tvsReviewPending")}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("tvsAccepted")}
                    className={`px-2 py-2 border-b bg-blue-50/60 dark:bg-blue-950/30 whitespace-nowrap text-center text-emerald-600 dark:text-emerald-400 font-extrabold cursor-pointer hover:bg-blue-100/80 dark:hover:bg-blue-900/50 select-none group ${isSliceActive("tvsAccepted") ? "bg-emerald-100 dark:bg-emerald-900/80 ring-2 ring-inset ring-emerald-600 font-black" : ""}`}
                    title="Click to sort by TVS Accepted"
                  >
                    <div className="inline-flex items-center gap-1 justify-center">
                      <span>TVS Accepted</span>
                      {renderSortIcon("tvsAccepted")}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("tvsRejected")}
                    className={`px-2 py-2 border-b bg-blue-50/60 dark:bg-blue-950/30 whitespace-nowrap text-center text-rose-600 dark:text-rose-400 font-extrabold cursor-pointer hover:bg-blue-100/80 dark:hover:bg-blue-900/50 select-none group ${isSliceActive("tvsRejected") ? "bg-rose-100 dark:bg-rose-900/80 ring-2 ring-inset ring-rose-600 font-black" : ""}`}
                    title="Click to sort by TVS Rejected"
                  >
                    <div className="inline-flex items-center gap-1 justify-center">
                      <span>TVS Rejected</span>
                      {renderSortIcon("tvsRejected")}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("tvsReworked")}
                    className={`px-2 py-2 border-b border-r border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/30 whitespace-nowrap text-center text-amber-600 dark:text-amber-400 font-extrabold cursor-pointer hover:bg-blue-100/80 dark:hover:bg-blue-900/50 select-none group ${isSliceActive("tvsReworked") ? "bg-amber-100 dark:bg-amber-900/80 ring-2 ring-inset ring-amber-500 font-black" : ""}`}
                    title="Click to sort by TVS Rework"
                  >
                    <div className="inline-flex items-center gap-1 justify-center">
                      <span>TVS Rework</span>
                      {renderSortIcon("tvsReworked")}
                    </div>
                  </th>
                  {/* Reviewed Section Columns */}
                  {showReviewerSection && (
                    <>
                      <th
                        onClick={() => handleSort("reviewedTotal")}
                        className={`px-2 py-2 border-b border-l border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30 whitespace-nowrap text-center text-emerald-800 dark:text-emerald-200 cursor-pointer hover:bg-emerald-100/80 dark:hover:bg-emerald-900/50 select-none group ${isSliceActive("reviewedTotal") ? "bg-emerald-200 dark:bg-emerald-900/80 ring-2 ring-inset ring-emerald-600 font-black" : ""}`}
                        title="Click to sort by Reviewed"
                      >
                        <div className="inline-flex items-center gap-1 justify-center">
                          <span>Reviewed</span>
                          {renderSortIcon("reviewedTotal")}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort("reviewedPending")}
                        className={`px-2 py-2 border-b bg-emerald-50/60 dark:bg-emerald-950/30 whitespace-nowrap text-center text-amber-600 dark:text-amber-400 cursor-pointer hover:bg-emerald-100/80 dark:hover:bg-emerald-900/50 select-none group ${isSliceActive("reviewedPending") ? "bg-amber-100 dark:bg-amber-900/80 ring-2 ring-inset ring-amber-500 font-black" : ""}`}
                        title="Click to sort by Review Pending"
                      >
                        <div className="inline-flex items-center gap-1 justify-center">
                          <span>Pending</span>
                          {renderSortIcon("reviewedPending")}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort("reviewedAccepted")}
                        className={`px-2 py-2 border-b bg-emerald-50/60 dark:bg-emerald-950/30 whitespace-nowrap text-center text-emerald-600 dark:text-emerald-400 font-extrabold cursor-pointer hover:bg-emerald-100/80 dark:hover:bg-emerald-900/50 select-none group ${isSliceActive("reviewedAccepted") ? "bg-emerald-100 dark:bg-emerald-900/80 ring-2 ring-inset ring-emerald-600 font-black" : ""}`}
                        title="Click to sort by Accepted"
                      >
                        <div className="inline-flex items-center gap-1 justify-center">
                          <span>Accepted</span>
                          {renderSortIcon("reviewedAccepted")}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort("reviewedRejected")}
                        className={`px-2 py-2 border-b bg-emerald-50/60 dark:bg-emerald-950/30 whitespace-nowrap text-center text-rose-600 dark:text-rose-400 font-extrabold cursor-pointer hover:bg-emerald-100/80 dark:hover:bg-emerald-900/50 select-none group ${isSliceActive("reviewedRejected") ? "bg-rose-100 dark:bg-rose-900/80 ring-2 ring-inset ring-rose-600 font-black" : ""}`}
                        title="Click to sort by Rejected"
                      >
                        <div className="inline-flex items-center gap-1 justify-center">
                          <span>Rejected</span>
                          {renderSortIcon("reviewedRejected")}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort("reviewedRework")}
                        className={`px-2 py-2 border-b border-r border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30 whitespace-nowrap text-center text-amber-600 dark:text-amber-400 font-extrabold cursor-pointer hover:bg-emerald-100/80 dark:hover:bg-emerald-900/50 select-none group ${isSliceActive("reviewedRework") ? "bg-amber-100 dark:bg-amber-900/80 ring-2 ring-inset ring-amber-500 font-black" : ""}`}
                        title="Click to sort by Rework"
                      >
                        <div className="inline-flex items-center gap-1 justify-center">
                          <span>Rework</span>
                          {renderSortIcon("reviewedRework")}
                        </div>
                      </th>
                    </>
                  )}
                  <th
                    onClick={() => handleSort("performanceScore")}
                    className="px-2 py-2 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap text-center cursor-pointer hover:bg-gray-100/80 dark:hover:bg-gray-800/80 select-none group"
                    title="Click to sort by Performance Score"
                  >
                    <div className="inline-flex items-center gap-1 justify-center">
                      <span>Performance Score</span>
                      {renderSortIcon("performanceScore")}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowPerformanceGuide(true);
                        }}
                        className="p-1 rounded-full text-purple-600 hover:text-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors cursor-pointer"
                        title="View Performance Score Formula & Calculation Guide"
                        aria-label="View Performance Score Formula & Calculation Guide"
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </th>
                  <th className="px-2 py-2 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap text-center">
                    Performance Category
                  </th>
                  <th className="px-2 py-2 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap text-center">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {(viewMode === "grouped" || viewMode === "cross_tenant" ? tenantGroups.length === 0 : paginatedPerformance.length === 0) && (
                  <tr>
                    <td
                      colSpan={25}
                      className="px-4 py-8 text-center text-sm font-semibold text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-800/50"
                    >
                      {searchTerm ? (
                        <div className="flex flex-col items-center justify-center gap-1">
                          <span>No inspectors or users matching <strong className="text-purple-600 dark:text-purple-400">"{searchTerm}"</strong></span>
                          <button
                            type="button"
                            onClick={() => setSearchTerm("")}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer mt-1 font-bold"
                          >
                            Clear Search Filter
                          </button>
                        </div>
                      ) : (
                        "No performance data available for the selected period."
                      )}
                    </td>
                  </tr>
                )}
                {(viewMode === "grouped" || viewMode === "cross_tenant") ? (
                  tenantGroups.map((group) => {
                    const isCollapsed = collapsedTenants.has(group.tenantName);
                    return (
                      <React.Fragment key={`group-wrapper-${group.tenantName}`}>
                        <tr
                          key={`tenant-header-${group.tenantName}`}
                          onClick={() => toggleTenantCollapse(group.tenantName)}
                          className={`${viewMode === "cross_tenant" ? "bg-purple-50/90 dark:bg-purple-950/40 border-y-2 border-purple-300 dark:border-purple-700 hover:bg-purple-100/90 dark:hover:bg-purple-900/50 text-purple-950 dark:text-purple-100" : "bg-emerald-50/90 dark:bg-emerald-950/40 border-y-2 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100/90 dark:hover:bg-emerald-900/50 text-emerald-950 dark:text-emerald-100"} transition-colors cursor-pointer font-black select-none shadow-2xs`}
                        >
                          {isSuperAdmin && (
                            <td className={`px-2 py-2 whitespace-nowrap text-xs font-black ${viewMode === "cross_tenant" ? "text-purple-800 dark:text-purple-200" : "text-emerald-800 dark:text-emerald-200"}`}>
                              {group.tenantName}
                            </td>
                          )}
                          <td className="px-2 py-2 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className={`p-0.5 rounded ${viewMode === "cross_tenant" ? "bg-purple-200/80 dark:bg-purple-800/80 text-purple-900 dark:text-purple-100" : "bg-emerald-200/80 dark:bg-emerald-800/80 text-emerald-900 dark:text-emerald-100"}`}>
                                {isCollapsed ? (
                                  <ChevronRight className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </span>
                              <span className="text-xs font-extrabold uppercase tracking-wider">{group.tenantName}</span>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${viewMode === "cross_tenant" ? "bg-purple-200/60 dark:bg-purple-800/60 text-purple-800 dark:text-purple-200" : "bg-emerald-200/60 dark:bg-emerald-800/60 text-emerald-800 dark:text-emerald-200"}`}>
                                {group.rows.length} inspector{group.rows.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </td>
                          {(() => {
                            const plantInspectors = group.rows.map((r: any) => r.name);
                            const plantEntity = {
                              name: `${group.tenantName} (Plant Total)`,
                              ...group.totals,
                              biwTotalReviewed: group.totals.totalReviewed,
                              biwReviewPending: group.totals.reviewPending,
                              tvsTotalReviewed: group.totals.tvsReviewed,
                              tvsReviewPending: group.totals.tvsPending,
                              tvsReworked: group.totals.tvsRework,
                              formBreakdown: group.formBreakdown,
                              timeBreakdown: group.timeBreakdown,
                            };

                            return (
                              <>
                                {performanceStatuses
                                  .filter((status) => status !== "Dispatched")
                                  .map((status) => {
                                    let count = 0;
                                    if (status === "Accepted") {
                                      count = (group.totals.directOk || 0) + (group.totals.reworkQcCompleted || 0);
                                    } else {
                                      const statusKeyMap: Record<string, string> = {
                                        "Rework QC Pending": "reworkQcPending",
                                        "Rejected": "rejected",
                                      };
                                      const key = statusKeyMap[status];
                                      count = key ? (group.totals as any)[key] ?? 0 : (group.totals as any)[status] ?? 0;
                                    }
                                    const colorClass =
                                      status === "Accepted" || status === "Direct Ok" || status === "Rework Accepted"
                                        ? "text-emerald-700 dark:text-emerald-300"
                                        : status.startsWith("Rework")
                                          ? "text-amber-700 dark:text-amber-300"
                                          : status === "Rejected"
                                            ? "text-rose-700 dark:text-rose-300"
                                            : "text-blue-700 dark:text-blue-300";
                                    return (
                                      <td
                                        key={`group-status-${group.tenantName}-${status}`}
                                        className={`px-2 py-2 font-black text-center tabular-nums cursor-pointer hover:bg-emerald-100/60 dark:hover:bg-emerald-900/40 ${colorClass}`}
                                        onMouseEnter={(e) => handleCellHover(e, status, plantEntity)}
                                        onClick={(e) => handleCellClick(e, status, plantEntity, plantInspectors)}
                                        onMouseLeave={handleCellMouseLeave}
                                      >
                                        {count}
                                      </td>
                                    );
                                  })}
                                <td
                                  className="px-2 py-2 font-black text-center tabular-nums text-violet-700 dark:text-violet-300 cursor-pointer hover:bg-violet-100/60 dark:hover:bg-violet-900/40"
                                  onMouseEnter={(e) => handleCellHover(e, "Dispatch Pending", plantEntity)}
                                  onClick={(e) => handleCellClick(e, "Dispatch Pending", plantEntity, plantInspectors)}
                                  onMouseLeave={handleCellMouseLeave}
                                >
                                  {group.totals.dispatchPending}
                                </td>
                                {performanceStatuses.includes("Dispatched") && (
                                  <td
                                    className="px-2 py-2 font-black text-center tabular-nums text-blue-700 dark:text-blue-300 cursor-pointer hover:bg-blue-100/60 dark:hover:bg-blue-900/40"
                                    onMouseEnter={(e) => handleCellHover(e, "Dispatched", plantEntity)}
                                    onClick={(e) => handleCellClick(e, "Dispatched", plantEntity, plantInspectors)}
                                    onMouseLeave={handleCellMouseLeave}
                                  >
                                    {group.totals.dispatched}
                                  </td>
                                )}
                                <td
                                  className="px-2 py-2 font-black text-center tabular-nums border-r border-emerald-300 dark:border-emerald-700 text-gray-900 dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                                  onMouseEnter={(e) => handleCellHover(e, "Total Submitted", plantEntity)}
                                  onClick={(e) => handleCellClick(e, "Total Submitted", plantEntity, plantInspectors)}
                                  onMouseLeave={handleCellMouseLeave}
                                >
                                  {group.totals.totalSubmitted}
                                </td>
                                {/* BIW Review Subtotals */}
                                <td
                                  className="px-2 py-2 font-black text-center tabular-nums border-l border-purple-200 bg-purple-50/50 dark:bg-purple-950/20 text-purple-900 dark:text-purple-200 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/50"
                                  onMouseEnter={(e) => handleCellHover(e, "BIW Total Reviewed", plantEntity)}
                                  onClick={(e) => handleCellClick(e, "BIW Total Reviewed", plantEntity, plantInspectors)}
                                  onMouseLeave={handleCellMouseLeave}
                                >
                                  {group.totals.totalReviewed}
                                </td>
                                <td
                                  className="px-2 py-2 font-black text-center tabular-nums bg-purple-50/50 dark:bg-purple-950/20 text-amber-700 dark:text-amber-300 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/50"
                                  onMouseEnter={(e) => handleCellHover(e, "BIW Review Pending", plantEntity)}
                                  onClick={(e) => handleCellClick(e, "BIW Review Pending", plantEntity, plantInspectors)}
                                  onMouseLeave={handleCellMouseLeave}
                                >
                                  {group.totals.reviewPending}
                                </td>
                                <td
                                  className="px-2 py-2 font-black text-center tabular-nums bg-purple-50/50 dark:bg-purple-950/20 text-green-700 dark:text-green-300 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/50"
                                  onMouseEnter={(e) => handleCellHover(e, "BIW Accepted", plantEntity)}
                                  onClick={(e) => handleCellClick(e, "BIW Accepted", plantEntity, plantInspectors)}
                                  onMouseLeave={handleCellMouseLeave}
                                >
                                  {group.totals.biwAccepted}
                                </td>
                                <td
                                  className="px-2 py-2 font-black text-center tabular-nums bg-purple-50/50 dark:bg-purple-950/20 text-red-700 dark:text-red-300 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/50"
                                  onMouseEnter={(e) => handleCellHover(e, "BIW Rejected", plantEntity)}
                                  onClick={(e) => handleCellClick(e, "BIW Rejected", plantEntity, plantInspectors)}
                                  onMouseLeave={handleCellMouseLeave}
                                >
                                  {group.totals.biwRejected}
                                </td>
                                <td
                                  className="px-2 py-2 font-black text-center tabular-nums border-r border-purple-200 bg-purple-50/50 dark:bg-purple-950/20 text-orange-700 dark:text-orange-300 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/50"
                                  onMouseEnter={(e) => handleCellHover(e, "BIW Reworked", plantEntity)}
                                  onClick={(e) => handleCellClick(e, "BIW Reworked", plantEntity, plantInspectors)}
                                  onMouseLeave={handleCellMouseLeave}
                                >
                                  {group.totals.biwReworked}
                                </td>
                                {/* TVS Review Subtotals */}
                                <td
                                  className="px-2 py-2 font-black text-center tabular-nums border-l border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 text-blue-900 dark:text-blue-200 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/50"
                                  onMouseEnter={(e) => handleCellHover(e, "TVS Total Reviewed", plantEntity)}
                                  onClick={(e) => handleCellClick(e, "TVS Total Reviewed", plantEntity, plantInspectors)}
                                  onMouseLeave={handleCellMouseLeave}
                                >
                                  {group.totals.tvsReviewed}
                                </td>
                                <td
                                  className="px-2 py-2 font-black text-center tabular-nums bg-blue-50/50 dark:bg-blue-950/20 text-amber-700 dark:text-amber-300 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/50"
                                  onMouseEnter={(e) => handleCellHover(e, "TVS Review Pending", plantEntity)}
                                  onClick={(e) => handleCellClick(e, "TVS Review Pending", plantEntity, plantInspectors)}
                                  onMouseLeave={handleCellMouseLeave}
                                >
                                  {group.totals.tvsPending}
                                </td>
                                <td
                                  className="px-2 py-2 font-black text-center tabular-nums bg-blue-50/50 dark:bg-blue-950/20 text-emerald-700 dark:text-emerald-300 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/50"
                                  onMouseEnter={(e) => handleCellHover(e, "TVS Accepted", plantEntity)}
                                  onClick={(e) => handleCellClick(e, "TVS Accepted", plantEntity, plantInspectors)}
                                  onMouseLeave={handleCellMouseLeave}
                                >
                                  {group.totals.tvsAccepted}
                                </td>
                                <td
                                  className="px-2 py-2 font-black text-center tabular-nums bg-blue-50/50 dark:bg-blue-950/20 text-rose-700 dark:text-rose-300 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/50"
                                  onMouseEnter={(e) => handleCellHover(e, "TVS Rejected", plantEntity)}
                                  onClick={(e) => handleCellClick(e, "TVS Rejected", plantEntity, plantInspectors)}
                                  onMouseLeave={handleCellMouseLeave}
                                >
                                  {group.totals.tvsRejected}
                                </td>
                                <td
                                  className="px-2 py-2 font-black text-center tabular-nums border-r border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 text-amber-700 dark:text-amber-300 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/50"
                                  onMouseEnter={(e) => handleCellHover(e, "TVS Rework", plantEntity)}
                                  onClick={(e) => handleCellClick(e, "TVS Rework", plantEntity, plantInspectors)}
                                  onMouseLeave={handleCellMouseLeave}
                                >
                                  {group.totals.tvsRework}
                                </td>
                                {/* Reviewed Section Subtotals */}
                                {showReviewerSection && (
                                  <>
                                    <td
                                      className="px-2 py-2 font-black text-center tabular-nums border-l border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200 cursor-help transition-colors hover:bg-emerald-100/80 dark:hover:bg-emerald-900/60"
                                      onMouseEnter={(e) => handleReviewCellHover(e, "Reviewed", plantEntity)}
                                      onClick={(e) => handleCellClick(e, "Reviewed", plantEntity, plantInspectors)}
                                      onMouseLeave={handleCellMouseLeave}
                                    >
                                      {group.totals.reviewedTotal}
                                    </td>
                                    <td
                                      className="px-2 py-2 font-black text-center tabular-nums bg-emerald-50/50 dark:bg-emerald-950/20 text-amber-700 dark:text-amber-300 cursor-help transition-colors hover:bg-emerald-100/80 dark:hover:bg-emerald-900/60"
                                      onMouseEnter={(e) => handleReviewCellHover(e, "Pending", plantEntity)}
                                      onClick={(e) => handleCellClick(e, "Pending", plantEntity, plantInspectors)}
                                      onMouseLeave={handleCellMouseLeave}
                                    >
                                      {group.totals.reviewedPending}
                                    </td>
                                    <td
                                      className="px-2 py-2 font-black text-center tabular-nums bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 cursor-help transition-colors hover:bg-emerald-100/80 dark:hover:bg-emerald-900/60"
                                      onMouseEnter={(e) => handleReviewCellHover(e, "Accepted", plantEntity)}
                                      onClick={(e) => handleCellClick(e, "AcceptedReviewer", plantEntity, plantInspectors)}
                                      onMouseLeave={handleCellMouseLeave}
                                    >
                                      {group.totals.reviewedAccepted}
                                    </td>
                                    <td
                                      className="px-2 py-2 font-black text-center tabular-nums bg-emerald-50/50 dark:bg-emerald-950/20 text-rose-700 dark:text-rose-300 cursor-help transition-colors hover:bg-emerald-100/80 dark:hover:bg-emerald-900/60"
                                      onMouseEnter={(e) => handleReviewCellHover(e, "Rejected", plantEntity)}
                                      onClick={(e) => handleCellClick(e, "RejectedReviewer", plantEntity, plantInspectors)}
                                      onMouseLeave={handleCellMouseLeave}
                                    >
                                      {group.totals.reviewedRejected}
                                    </td>
                                    <td
                                      className="px-2 py-2 font-black text-center tabular-nums border-r border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 text-amber-700 dark:text-amber-300 cursor-help transition-colors hover:bg-emerald-100/80 dark:hover:bg-emerald-900/60"
                                      onMouseEnter={(e) => handleReviewCellHover(e, "Rework", plantEntity)}
                                      onClick={(e) => handleCellClick(e, "ReworkReviewer", plantEntity, plantInspectors)}
                                      onMouseLeave={handleCellMouseLeave}
                                    >
                                      {group.totals.reviewedRework}
                                    </td>
                                  </>
                                )}
                                {/* Performance Score */}
                                <td
                                  className="px-2 py-2 text-center cursor-pointer hover:bg-emerald-100/60 dark:hover:bg-emerald-900/40"
                                  onMouseEnter={(e) => handleCellHover(e, "PerformanceScore", plantEntity)}
                                  onClick={(e) => handleCellClick(e, "PerformanceScore", plantEntity, plantInspectors)}
                                  onMouseLeave={handleCellMouseLeave}
                                >
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 tabular-nums">
                                    {group.totals.performanceScore}%
                                  </span>
                                </td>
                              </>
                            );
                          })()}
                          <td className="px-2 py-2 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                              Plant Summary
                            </span>
                          </td>
                          <td className="px-2 py-2 text-center text-xs text-emerald-700 dark:text-emerald-300 font-bold">
                            {isCollapsed ? "Show Rows" : "Hide Rows"}
                          </td>
                        </tr>

                        {!isCollapsed && group.rows.map((row: any, idx: number) => (
                          <React.Fragment key={`${group.tenantName}-${row.name || idx}`}>
                            <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer" onClick={() => toggleRowExpansion(`${group.tenantName}-${row.name}`)}>
                              {isSuperAdmin && (
                                <td className="px-2 py-1.5 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                                  {row.tenantName}
                                </td>
                              )}
                              <td className="px-2 py-1.5 font-medium text-gray-900 dark:text-white whitespace-nowrap pl-6">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-gray-400 dark:text-gray-500 font-mono text-xs select-none">└─</span>
                                  <span className="font-semibold text-gray-800 dark:text-gray-200">{row.name}</span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedInspectorForDetails(row);
                                      setShowInspectorDetailModal(true);
                                    }}
                                    className="inline-flex items-center justify-center p-1 rounded-full text-purple-600 hover:text-purple-800 hover:bg-purple-100 dark:text-purple-400 dark:hover:bg-purple-900/40 transition-colors cursor-pointer"
                                    title={`View Form-Wise Breakdown for ${row.name} (Own vs Assigned Forms)`}
                                  >
                                    <Info className="w-3.5 h-3.5" />
                                  </button>
                                  {(row.ownFormsCount !== undefined || row.assignedFormsCount !== undefined) && (
                                    <div className="flex items-center gap-1 ml-1">
                                      {(row.ownFormsCount ?? 0) > 0 && (
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60" title={`${row.ownFormsCount} Own Plant Form(s)`}>
                                          🏠 {row.ownFormsCount}
                                        </span>
                                      )}
                                      {(row.assignedFormsCount ?? 0) > 0 && (
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200/60" title={`${row.assignedFormsCount} Cross-Tenant / Assigned Form(s)`}>
                                          🔄 {row.assignedFormsCount}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                              {performanceStatuses
                                .filter((status) => status !== "Dispatched")
                                .map((status) => {
                                  let count = 0;
                                  if (status === "Accepted") {
                                    const dOk = (row.directOk !== undefined ? row.directOk : inspectorStatusMap[row.name]?.["Direct Ok"]) || 0;
                                    const rComp = (row.reworkQcCompleted !== undefined ? row.reworkQcCompleted : (inspectorStatusMap[row.name]?.["Rework QC Completed"] || inspectorStatusMap[row.name]?.["Rework Accepted"])) || 0;
                                    const acc = inspectorStatusMap[row.name]?.["Accepted"] || 0;
                                    count = dOk + rComp + acc;
                                  } else {
                                    const statusKeyMap: Record<string, string> = {
                                      "Rework QC Pending": "reworkQcPending",
                                      "Rejected": "rejected",
                                    };
                                    const key = statusKeyMap[status];
                                    count =
                                      (key && row[key] !== undefined ? row[key] : undefined) ??
                                      (inspectorStatusMap[row.name]?.[status] !== undefined
                                        ? inspectorStatusMap[row.name][status]
                                        : 0);
                                  }
                                  const isZero = count === 0;
                                  const colorClass =
                                    status === "Accepted" || status === "Direct Ok" || status === "Rework Accepted"
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : status.startsWith("Rework")
                                        ? "text-amber-600 dark:text-amber-400"
                                        : status === "Rejected"
                                          ? "text-rose-600 dark:text-rose-400"
                                          : "text-blue-600 dark:text-blue-400";
                                  return (
                                    <td
                                      key={status}
                                      className={`px-2 py-1.5 font-bold text-center tabular-nums transition-opacity cursor-help hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30 ${isZero ? "opacity-20 text-gray-400" : colorClass}`}
                                      onMouseEnter={(e) => handleCellHover(e, status, row)}
                                onClick={(e) => handleCellClick(e, status, row)}
                                      onMouseLeave={() => setReviewTooltip(null)}
                                    >
                                      {count}
                                    </td>
                                  );
                                })}
                              {(() => {
                                const directOk = (row.directOk !== undefined ? row.directOk : (inspectorStatusMap[row.name]?.["Direct Ok"] || 0)) + (inspectorStatusMap[row.name]?.["Accepted"] || 0);
                                const reworkQCCompleted = (row.reworkQcCompleted !== undefined ? row.reworkQcCompleted : (inspectorStatusMap[row.name]?.["Rework QC Completed"] || inspectorStatusMap[row.name]?.["Rework Accepted"] || 0));
                                const dispatched = row.dispatched ?? inspectorStatusMap[row.name]?.["Dispatched"] ?? 0;
                                const dispatchPending = row.dispatchPending !== undefined ? row.dispatchPending : Math.max(0, directOk + reworkQCCompleted - dispatched);
                                const isZero = dispatchPending === 0;
                                return (
                                  <td
                                    className={`px-2 py-1.5 font-bold text-center tabular-nums transition-opacity cursor-help hover:bg-violet-50/60 dark:hover:bg-violet-950/30 ${isZero ? "opacity-20 text-gray-400" : "text-violet-600 dark:text-violet-400"}`}
                                    onMouseEnter={(e) => handleCellHover(e, "Dispatch Pending", row)}
                                onClick={(e) => handleCellClick(e, "Dispatch Pending", row)}
                                    onMouseLeave={() => setReviewTooltip(null)}
                                  >
                                    {dispatchPending}
                                  </td>
                                );
                              })()}
                              {performanceStatuses.includes("Dispatched") &&
                                (() => {
                                  const count = row.dispatched ?? inspectorStatusMap[row.name]?.["Dispatched"] ?? 0;
                                  const isZero = count === 0;
                                  return (
                                    <td
                                      className={`px-2 py-1.5 font-bold text-center tabular-nums transition-opacity cursor-help hover:bg-blue-50/60 dark:hover:bg-blue-950/30 ${isZero ? "opacity-20 text-gray-400" : "text-blue-600 dark:text-blue-400"}`}
                                      onMouseEnter={(e) => handleCellHover(e, "Dispatched", row)}
                                onClick={(e) => handleCellClick(e, "Dispatched", row)}
                                      onMouseLeave={() => setReviewTooltip(null)}
                                    >
                                      {count}
                                    </td>
                                  );
                                })()}
                              <td
                                className="px-2 py-1.5 font-bold text-center tabular-nums border-r border-gray-100 dark:border-gray-700 cursor-help hover:bg-gray-100/60 dark:hover:bg-gray-800/60"
                                onMouseEnter={(e) => handleCellHover(e, "Total Submitted", row)}
                                onClick={(e) => handleCellClick(e, "Total Submitted", row)}
                                onMouseLeave={() => setReviewTooltip(null)}
                              >
                                {getUserTotalSubmitted(row.name, row.totalSubmitted)}
                              </td>
                              {/* BIW Review Data Cells with distinct shading */}
                              <td
                                className="px-2 py-1.5 font-bold text-center tabular-nums border-l border-purple-100 dark:border-purple-900/30 bg-purple-50/25 dark:bg-purple-950/10 text-purple-900 dark:text-purple-200 cursor-help hover:bg-purple-100/60 dark:hover:bg-purple-900/40"
                                onMouseEnter={(e) => handleCellHover(e, "BIW Total Reviewed", row)}
                                onClick={(e) => handleCellClick(e, "BIW Total Reviewed", row)}
                                onMouseLeave={() => setReviewTooltip(null)}
                              >
                                {row.totalReviewed ?? row.biwTotalReviewed ?? 0}
                              </td>
                              <td
                                className={`px-2 py-1.5 font-bold text-center tabular-nums bg-purple-50/25 dark:bg-purple-950/10 cursor-help hover:bg-purple-100/60 dark:hover:bg-purple-900/40 ${(() => {
                                  const dispatched = row.dispatched ?? inspectorStatusMap[row.name]?.["Dispatched"] ?? 0;
                                  const pending = Math.max(0, dispatched - (row.totalReviewed || row.biwTotalReviewed || 0));
                                  return pending === 0 ? "opacity-20 text-gray-400" : "text-amber-600 dark:text-amber-400";
                                })()}`}
                                onMouseEnter={(e) => handleCellHover(e, "BIW Review Pending", row)}
                                onClick={(e) => handleCellClick(e, "BIW Review Pending", row)}
                                onMouseLeave={() => setReviewTooltip(null)}
                              >
                                {Math.max(
                                  0,
                                  (row.dispatched ?? inspectorStatusMap[row.name]?.["Dispatched"] ?? 0) -
                                  (row.totalReviewed || row.biwTotalReviewed || 0),
                                )}
                              </td>
                              <td
                                className="px-2 py-1.5 font-extrabold text-center text-green-600 dark:text-green-400 tabular-nums bg-purple-50/25 dark:bg-purple-950/10 cursor-help hover:bg-purple-100/60 dark:hover:bg-purple-900/40"
                                onMouseEnter={(e) => handleCellHover(e, "BIW Accepted", row)}
                                onClick={(e) => handleCellClick(e, "BIW Accepted", row)}
                                onMouseLeave={() => setReviewTooltip(null)}
                              >
                                {row.biwAccepted ?? row.accepted ?? 0}
                              </td>
                              <td
                                className="px-2 py-1.5 font-extrabold text-center text-red-600 dark:text-red-400 tabular-nums bg-purple-50/25 dark:bg-purple-950/10 cursor-help hover:bg-purple-100/60 dark:hover:bg-purple-900/40"
                                onMouseEnter={(e) => handleCellHover(e, "BIW Rejected", row)}
                                onClick={(e) => handleCellClick(e, "BIW Rejected", row)}
                                onMouseLeave={() => setReviewTooltip(null)}
                              >
                                {row.biwRejected ?? row.rejectedReview ?? row.rejected ?? 0}
                              </td>
                              <td
                                className="px-2 py-1.5 font-extrabold text-center text-orange-600 dark:text-orange-400 tabular-nums border-r border-purple-100 dark:border-purple-900/30 bg-purple-50/25 dark:bg-purple-950/10 cursor-help hover:bg-purple-100/60 dark:hover:bg-purple-900/40"
                                onMouseEnter={(e) => handleCellHover(e, "BIW Reworked", row)}
                                onClick={(e) => handleCellClick(e, "BIW Reworked", row)}
                                onMouseLeave={() => setReviewTooltip(null)}
                              >
                                {row.biwReworked ?? row.reworked ?? row.rework ?? 0}
                              </td>
                              {/* TVS Review Data Cells with distinct shading */}
                              <td
                                className="px-2 py-1.5 font-bold text-center tabular-nums border-l border-blue-100 dark:border-blue-900/30 bg-blue-50/25 dark:bg-blue-950/10 text-blue-900 dark:text-blue-200 cursor-help hover:bg-blue-100/60 dark:hover:bg-blue-900/40"
                                onMouseEnter={(e) => handleCellHover(e, "TVS Total Reviewed", row)}
                                onClick={(e) => handleCellClick(e, "TVS Total Reviewed", row)}
                                onMouseLeave={() => setReviewTooltip(null)}
                              >
                                {row.tvsTotalReviewed ?? 0}
                              </td>
                              <td
                                className="px-2 py-1.5 font-bold text-center tabular-nums bg-blue-50/25 dark:bg-blue-950/10 text-amber-600 dark:text-amber-400 cursor-help hover:bg-blue-100/60 dark:hover:bg-blue-900/40"
                                onMouseEnter={(e) => handleCellHover(e, "TVS Review Pending", row)}
                                onClick={(e) => handleCellClick(e, "TVS Review Pending", row)}
                                onMouseLeave={() => setReviewTooltip(null)}
                              >
                                {row.tvsReviewPending ?? Math.max(0, (row.dispatched || 0) - (row.tvsTotalReviewed || 0))}
                              </td>
                              <td
                                className="px-2 py-1.5 font-extrabold text-center text-emerald-600 dark:text-emerald-400 tabular-nums bg-blue-50/25 dark:bg-blue-950/10 cursor-help hover:bg-blue-100/60 dark:hover:bg-blue-900/40"
                                onMouseEnter={(e) => handleCellHover(e, "TVS Accepted", row)}
                                onClick={(e) => handleCellClick(e, "TVS Accepted", row)}
                                onMouseLeave={() => setReviewTooltip(null)}
                              >
                                {row.tvsAccepted ?? 0}
                              </td>
                              <td
                                className="px-2 py-1.5 font-extrabold text-center text-rose-600 dark:text-rose-400 tabular-nums bg-blue-50/25 dark:bg-blue-950/10 cursor-help hover:bg-blue-100/60 dark:hover:bg-blue-900/40"
                                onMouseEnter={(e) => handleCellHover(e, "TVS Rejected", row)}
                                onClick={(e) => handleCellClick(e, "TVS Rejected", row)}
                                onMouseLeave={() => setReviewTooltip(null)}
                              >
                                {row.tvsRejected ?? 0}
                              </td>
                              <td
                                className="px-2 py-1.5 font-extrabold text-center text-amber-600 dark:text-amber-400 tabular-nums border-r border-blue-100 dark:border-blue-900/30 bg-blue-50/25 dark:bg-blue-950/10 cursor-help hover:bg-blue-100/60 dark:hover:bg-blue-900/40"
                                onMouseEnter={(e) => handleCellHover(e, "TVS Rework", row)}
                                onClick={(e) => handleCellClick(e, "TVS Rework", row)}
                                onMouseLeave={() => setReviewTooltip(null)}
                              >
                                {row.tvsReworked ?? 0}
                              </td>
                              {/* Reviewed Section Data Cells */}
                              {showReviewerSection && (() => {
                                const rowRev = (row.biwTotalReviewed || row.totalReviewed || 0) + (row.tvsTotalReviewed || 0);
                                const rowPend = Math.max(0, (row.totalSubmitted || 0) - rowRev);
                                const rowAcc = (row.biwAccepted ?? row.accepted ?? 0) + (row.tvsAccepted || 0);
                                const rowRej = (row.biwRejected ?? row.rejectedReview ?? row.rejected ?? 0) + (row.tvsRejected || 0);
                                const rowRew = (row.biwReworked ?? row.reworked ?? row.rework ?? 0) + (row.tvsReworked || 0);
                                return (
                                  <>
                                    <td
                                      className="px-2 py-1.5 font-bold text-center tabular-nums border-l border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/25 dark:bg-emerald-950/10 text-emerald-900 dark:text-emerald-200 cursor-help transition-colors hover:bg-emerald-100/80 dark:hover:bg-emerald-900/60"
                                      onMouseEnter={(e) => handleReviewCellHover(e, "Reviewed", row)}
                                onClick={(e) => handleCellClick(e, "Reviewed", row)}
                                      onMouseLeave={() => setReviewTooltip(null)}
                                    >
                                      {rowRev}
                                    </td>
                                    <td
                                      className="px-2 py-1.5 font-bold text-center tabular-nums bg-emerald-50/25 dark:bg-emerald-950/10 text-amber-600 dark:text-amber-400 cursor-help transition-colors hover:bg-emerald-100/80 dark:hover:bg-emerald-900/60"
                                      onMouseEnter={(e) => handleReviewCellHover(e, "Pending", row)}
                                onClick={(e) => handleCellClick(e, "Pending", row)}
                                      onMouseLeave={() => setReviewTooltip(null)}
                                    >
                                      {rowPend}
                                    </td>
                                    <td
                                      className="px-2 py-1.5 font-extrabold text-center text-emerald-600 dark:text-emerald-400 tabular-nums bg-emerald-50/25 dark:bg-emerald-950/10 cursor-help transition-colors hover:bg-emerald-100/80 dark:hover:bg-emerald-900/60"
                                      onMouseEnter={(e) => handleReviewCellHover(e, "Accepted", row)}
                                onClick={(e) => handleCellClick(e, "AcceptedReviewer", row)}
                                      onMouseLeave={() => setReviewTooltip(null)}
                                    >
                                      {rowAcc}
                                    </td>
                                    <td
                                      className="px-2 py-1.5 font-extrabold text-center text-rose-600 dark:text-rose-400 tabular-nums bg-emerald-50/25 dark:bg-emerald-950/10 cursor-help transition-colors hover:bg-emerald-100/80 dark:hover:bg-emerald-900/60"
                                      onMouseEnter={(e) => handleReviewCellHover(e, "Rejected", row)}
                                onClick={(e) => handleCellClick(e, "RejectedReviewer", row)}
                                      onMouseLeave={() => setReviewTooltip(null)}
                                    >
                                      {rowRej}
                                    </td>
                                    <td
                                      className="px-2 py-1.5 font-extrabold text-center text-amber-600 dark:text-amber-400 tabular-nums border-r border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/25 dark:bg-emerald-950/10 cursor-help transition-colors hover:bg-emerald-100/80 dark:hover:bg-emerald-900/60"
                                      onMouseEnter={(e) => handleReviewCellHover(e, "Rework", row)}
                                onClick={(e) => handleCellClick(e, "ReworkReviewer", row)}
                                      onMouseLeave={() => setReviewTooltip(null)}
                                    >
                                      {rowRew}
                                    </td>
                                  </>
                                );
                              })()}
                              <td
                                className="px-2 py-1.5 text-center cursor-help transition-all duration-150 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30 hover:scale-105"
                                onMouseEnter={(e) => handleCellHover(e, "PerformanceScore", row)}
                                onClick={(e) => handleCellClick(e, "PerformanceScore", row)}
                                onMouseLeave={() => setReviewTooltip(null)}
                              >
                                {(row.totalReviewed || row.biwTotalReviewed || 0) === 0 ? (
                                  <span className="px-2 py-1 rounded-full text-[10px] font-bold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 tabular-nums">
                                    N/A
                                  </span>
                                ) : (
                                  <span
                                    className={`px-2 py-1 rounded-full text-[10px] font-black tabular-nums ${row.performanceScore >= 80
                                      ? "bg-green-100 text-green-700"
                                      : row.performanceScore >= 50
                                        ? "bg-orange-100 text-orange-700"
                                        : "bg-red-100 text-red-700"
                                      }`}
                                  >
                                    {row.performanceScore}%
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                {(row.totalReviewed || row.biwTotalReviewed || 0) === 0 ? (
                                  <span className="px-2 py-1 rounded-full text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30">
                                    Pending Review
                                  </span>
                                ) : (
                                  <span
                                    className={`px-2 py-1 rounded-full text-[10px] font-black ${(() => {
                                      const score = row.performanceScore || 0;
                                      if (score < 60) return "bg-red-100 text-red-700";
                                      if (score < 70) return "bg-orange-100 text-orange-700";
                                      if (score < 80) return "bg-yellow-100 text-yellow-700";
                                      if (score < 90) return "bg-green-100 text-green-700";
                                      return "bg-emerald-100 text-emerald-700";
                                    })()}`}
                                  >
                                    {(() => {
                                      const score = row.performanceScore || 0;
                                      if (score < 60) return "Not met performer";
                                      if (score < 70) return "partially met performer";
                                      if (score < 80) return "Met expectation";
                                      if (score < 90) return "exceeded Performance";
                                      return "Exemplary performer";
                                    })()}
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedInspectorForDetails(row);
                                      setShowInspectorDetailModal(true);
                                    }}
                                    className="p-1 text-purple-600 hover:text-purple-800 hover:bg-purple-100 dark:text-purple-400 dark:hover:bg-purple-900/40 rounded-lg transition-colors cursor-pointer"
                                    title="View Form-Wise Details"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); toggleRowExpansion(`${group.tenantName}-${row.name}`); }}
                                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all cursor-pointer"
                                    title={expandedRows.has(`${group.tenantName}-${row.name}`) ? "Collapse" : "Expand"}
                                  >
                                    {expandedRows.has(`${group.tenantName}-${row.name}`) ? (
                                      <ChevronUp className="w-4 h-4" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4" />
                                    )}
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {expandedRows.has(`${group.tenantName}-${row.name}`) &&
                              (() => {
                                const forms = new Map<string, any[]>();
                                perfInspectorSummary
                                  .filter((item: any) => item.qcInspector === row.name)
                                  .forEach((item: any) => {
                                    const formName = item.formTitle || "Unknown Form";
                                    if (!forms.has(formName)) forms.set(formName, []);
                                    forms.get(formName)!.push(item);
                                  });

                                if (forms.size === 0) return null;

                                return Array.from(forms.entries()).map(([formName, items], formIdx) => {
                                  const formSummary = (items as any[]).reduce((acc, it) => {
                                    const sc = it.statusCounts || {};
                                    for (const status in sc) {
                                      acc.statuses[status] = (acc.statuses[status] || 0) + sc[status];
                                    }
                                    acc.totalReviewed += it.totalReviewed || 0;
                                    acc.accepted += it.accepted || 0;
                                    acc.rework += it.reworked ?? it.rework ?? 0;
                                    acc.rejected_outcome += it.rejectedReview ?? it.rejected ?? 0;
                                    return acc;
                                  }, {
                                    statuses: {} as Record<string, number>,
                                    totalReviewed: 0,
                                    accepted: 0,
                                    rework: 0,
                                    rejected_outcome: 0,
                                  });

                                  const v = formSummary.statuses;
                                  const directOk = (v["Direct Ok"] || 0) + (v["Accepted"] || 0);
                                  const reworkQCCompleted = (v["Rework QC Completed"] || 0) + (v["Rework Accepted"] || 0);
                                  const dispatched = v["Dispatched"] || 0;
                                  const totalSubmitted = (v["Accepted"] || 0) + (v["Direct Ok"] || 0) + (v["Rework QC Completed"] || 0) + (v["Rework Accepted"] || 0) + (v["Rework QC Pending"] || 0) + (v["Rejected"] || 0);

                                  const { totalReviewed, accepted, rework, rejected_outcome } = formSummary;
                                  const dispatchPending = Math.max(0, directOk + reworkQCCompleted - dispatched);
                                  const reviewPending = Math.max(0, dispatched - totalReviewed);
                                  const rowBg = formIdx % 2 === 0 ? "bg-purple-50/20 dark:bg-purple-900/10" : "bg-purple-50/40 dark:bg-purple-900/20";

                                  return (
                                    <tr key={`${row.name}-${formName}-${formIdx}`} className={rowBg}>
                                      {isSuperAdmin && <td className="px-2 py-1.5"></td>}
                                      <td className="px-2 py-1.5 font-medium text-purple-800 dark:text-purple-200 whitespace-nowrap pl-8 truncate">
                                        {formName}
                                      </td>
                                      {performanceStatuses.filter(s => s !== 'Dispatched').map(status => {
                                        const val = status === "Accepted"
                                          ? (v["Accepted"] || 0) + (v["Direct Ok"] || 0) + (v["Rework QC Completed"] || 0) + (v["Rework Accepted"] || 0)
                                          : (v[status] || 0);
                                        return (
                                          <td key={status} className="px-2 py-1.5 font-bold text-center tabular-nums">
                                            {val}
                                          </td>
                                        );
                                      })}
                                      <td className="px-2 py-1.5 font-bold text-center tabular-nums">{dispatchPending}</td>
                                      {performanceStatuses.includes("Dispatched") && (
                                        <td className="px-2 py-1.5 font-bold text-center tabular-nums">
                                          {dispatched}
                                        </td>
                                      )}
                                      <td className="px-2 py-1.5 font-bold text-center tabular-nums border-r border-purple-100 dark:border-purple-900/30">{totalSubmitted}</td>
                                      <td className="px-2 py-1.5 font-bold text-center tabular-nums bg-purple-100/40 dark:bg-purple-900/20 border-l border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200">{totalReviewed}</td>
                                      <td className="px-2 py-1.5 font-bold text-center tabular-nums bg-purple-100/40 dark:bg-purple-900/20 text-amber-600 dark:text-amber-400">{reviewPending}</td>
                                      <td className="px-2 py-1.5 font-extrabold text-center text-green-600 dark:text-green-400 tabular-nums bg-purple-100/40 dark:bg-purple-900/20">{accepted}</td>
                                      <td className="px-2 py-1.5 font-extrabold text-center text-red-600 dark:text-red-400 tabular-nums bg-purple-100/40 dark:bg-purple-900/20">{rejected_outcome}</td>
                                      <td className="px-2 py-1.5 font-extrabold text-center text-orange-600 dark:text-orange-400 tabular-nums border-r border-purple-200 dark:border-purple-800 bg-purple-100/40 dark:bg-purple-900/20">{rework}</td>
                                      <td className="px-2 py-1.5 font-bold text-center tabular-nums bg-blue-100/40 dark:bg-blue-900/20 border-l border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200">—</td>
                                      <td className="px-2 py-1.5 font-bold text-center tabular-nums bg-blue-100/40 dark:bg-blue-900/20 text-amber-600 dark:text-amber-400">—</td>
                                      <td className="px-2 py-1.5 font-extrabold text-center text-emerald-600 dark:text-emerald-400 tabular-nums bg-blue-100/40 dark:bg-blue-900/20">—</td>
                                      <td className="px-2 py-1.5 font-extrabold text-center text-rose-600 dark:text-rose-400 tabular-nums bg-blue-100/40 dark:bg-blue-900/20">—</td>
                                      <td className="px-2 py-1.5 font-extrabold text-center text-amber-600 dark:text-amber-400 tabular-nums border-r border-blue-200 dark:border-blue-800 bg-blue-100/40 dark:bg-blue-900/20">—</td>
                                      <td className="px-2 py-1.5"></td>
                                      <td className="px-2 py-1.5"></td>
                                      <td className="px-2 py-1.5"></td>
                                    </tr>
                                  );
                                });
                              })()}
                          </React.Fragment>
                        ))}
                      </React.Fragment>
                    );
                  })
                ) : (
                paginatedPerformance.map((row, idx) => (
                  <React.Fragment key={row.name || idx}>
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer" onClick={() => toggleRowExpansion(row.name)}>
                      {isSuperAdmin && (
                        <td className="px-2 py-1.5 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                          {row.tenantName}
                        </td>
                      )}
                      <td className="px-2 py-1.5 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <span className="font-semibold text-gray-800 dark:text-gray-200">{row.name}</span>
                          {!isSuperAdmin && row.tenantName && row.tenantName !== "Unknown Tenant" && (
                            <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                              ({row.tenantName})
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedInspectorForDetails(row);
                              setShowInspectorDetailModal(true);
                            }}
                            className="inline-flex items-center justify-center p-0.5 rounded-full text-purple-600 hover:text-purple-800 hover:bg-purple-100 dark:text-purple-400 dark:hover:bg-purple-900/40 transition-colors cursor-pointer"
                            title={`View Form-Wise Breakdown for ${row.name} (Own vs Assigned Forms)`}
                          >
                            <Info className="w-3.5 h-3.5" />
                          </button>
                          {(row.ownFormsCount !== undefined || row.assignedFormsCount !== undefined) && (
                            <div className="flex items-center gap-1 ml-1">
                              {(row.ownFormsCount ?? 0) > 0 && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60" title={`${row.ownFormsCount} Own Plant Form(s)`}>
                                  🏠 {row.ownFormsCount}
                                </span>
                              )}
                              {(row.assignedFormsCount ?? 0) > 0 && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200/60" title={`${row.assignedFormsCount} Cross-Tenant / Assigned Form(s)`}>
                                  🔄 {row.assignedFormsCount}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      {performanceStatuses
                        .filter((status) => status !== "Dispatched")
                        .map((status) => {
                          let count = 0;
                          if (status === "Accepted") {
                            const dOk = (row.directOk !== undefined ? row.directOk : inspectorStatusMap[row.name]?.["Direct Ok"]) || 0;
                            const rComp = (row.reworkQcCompleted !== undefined ? row.reworkQcCompleted : (inspectorStatusMap[row.name]?.["Rework QC Completed"] || inspectorStatusMap[row.name]?.["Rework Accepted"])) || 0;
                            const acc = inspectorStatusMap[row.name]?.["Accepted"] || 0;
                            count = dOk + rComp + acc;
                          } else {
                            const statusKeyMap: Record<string, string> = {
                              "Rework QC Pending": "reworkQcPending",
                              "Rejected": "rejected",
                            };
                            const key = statusKeyMap[status];
                            count =
                              (key && row[key] !== undefined ? row[key] : undefined) ??
                              (inspectorStatusMap[row.name]?.[status] !== undefined
                                ? inspectorStatusMap[row.name][status]
                                : 0);
                          }
                          const isZero = count === 0;
                          const colorClass =
                            status === "Accepted" || status === "Direct Ok" || status === "Rework Accepted"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : status.startsWith("Rework")
                                ? "text-amber-600 dark:text-amber-400"
                                : status === "Rejected"
                                  ? "text-rose-600 dark:text-rose-400"
                                  : "text-blue-600 dark:text-blue-400";
                          return (
                            <td
                              key={status}
                              className={`px-2 py-1.5 font-bold text-center tabular-nums transition-opacity cursor-help hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30 ${isZero ? "opacity-20 text-gray-400" : colorClass}`}
                              onMouseEnter={(e) => handleCellHover(e, status, row)}
                                onClick={(e) => handleCellClick(e, status, row)}
                              onMouseLeave={() => setReviewTooltip(null)}
                            >
                              {count}
                            </td>
                          );
                        })}
                      {(() => {
                        const directOk = (row.directOk !== undefined ? row.directOk : (inspectorStatusMap[row.name]?.["Direct Ok"] || 0)) + (inspectorStatusMap[row.name]?.["Accepted"] || 0);
                        const reworkQCCompleted = (row.reworkQcCompleted !== undefined ? row.reworkQcCompleted : (inspectorStatusMap[row.name]?.["Rework QC Completed"] || inspectorStatusMap[row.name]?.["Rework Accepted"] || 0));
                        const dispatched = row.dispatched ?? inspectorStatusMap[row.name]?.["Dispatched"] ?? 0;
                        const dispatchPending = row.dispatchPending !== undefined ? row.dispatchPending : Math.max(0, directOk + reworkQCCompleted - dispatched);
                        const isZero = dispatchPending === 0;
                        return (
                          <td
                            className={`px-2 py-1.5 font-bold text-center tabular-nums transition-opacity cursor-help hover:bg-violet-50/60 dark:hover:bg-violet-950/30 ${isZero ? "opacity-20 text-gray-400" : "text-violet-600 dark:text-violet-400"}`}
                            onMouseEnter={(e) => handleCellHover(e, "Dispatch Pending", row)}
                                onClick={(e) => handleCellClick(e, "Dispatch Pending", row)}
                            onMouseLeave={() => setReviewTooltip(null)}
                          >
                            {dispatchPending}
                          </td>
                        );
                      })()}
                      {performanceStatuses.includes("Dispatched") &&
                        (() => {
                          const count = row.dispatched ?? inspectorStatusMap[row.name]?.["Dispatched"] ?? 0;
                          const isZero = count === 0;
                          return (
                            <td
                              className={`px-2 py-1.5 font-bold text-center tabular-nums transition-opacity cursor-help hover:bg-blue-50/60 dark:hover:bg-blue-950/30 ${isZero ? "opacity-20 text-gray-400" : "text-blue-600 dark:text-blue-400"}`}
                              onMouseEnter={(e) => handleCellHover(e, "Dispatched", row)}
                                onClick={(e) => handleCellClick(e, "Dispatched", row)}
                              onMouseLeave={() => setReviewTooltip(null)}
                            >
                              {count}
                            </td>
                          );
                        })()}
                      <td
                        className="px-2 py-1.5 font-bold text-center tabular-nums border-r border-gray-100 dark:border-gray-700 cursor-help hover:bg-gray-100/60 dark:hover:bg-gray-800/60"
                        onMouseEnter={(e) => handleCellHover(e, "Total Submitted", row)}
                                onClick={(e) => handleCellClick(e, "Total Submitted", row)}
                        onMouseLeave={() => setReviewTooltip(null)}
                      >
                        {getUserTotalSubmitted(row.name, row.totalSubmitted)}
                      </td>
                      {/* BIW Review Data Cells with distinct shading */}
                      <td
                        className="px-2 py-1.5 font-bold text-center tabular-nums border-l border-purple-100 dark:border-purple-900/30 bg-purple-50/25 dark:bg-purple-950/10 text-purple-900 dark:text-purple-200 cursor-help hover:bg-purple-100/60 dark:hover:bg-purple-900/40"
                        onMouseEnter={(e) => handleCellHover(e, "BIW Total Reviewed", row)}
                                onClick={(e) => handleCellClick(e, "BIW Total Reviewed", row)}
                        onMouseLeave={() => setReviewTooltip(null)}
                      >
                        {row.totalReviewed ?? row.biwTotalReviewed ?? 0}
                      </td>
                      <td
                        className={`px-2 py-1.5 font-bold text-center tabular-nums bg-purple-50/25 dark:bg-purple-950/10 cursor-help hover:bg-purple-100/60 dark:hover:bg-purple-900/40 ${(() => {
                          const dispatched = row.dispatched ?? inspectorStatusMap[row.name]?.["Dispatched"] ?? 0;
                          const pending = Math.max(0, dispatched - (row.totalReviewed || row.biwTotalReviewed || 0));
                          return pending === 0 ? "opacity-20 text-gray-400" : "text-amber-600 dark:text-amber-400";
                        })()}`}
                        onMouseEnter={(e) => handleCellHover(e, "BIW Review Pending", row)}
                                onClick={(e) => handleCellClick(e, "BIW Review Pending", row)}
                        onMouseLeave={() => setReviewTooltip(null)}
                      >
                        {Math.max(
                          0,
                          (row.dispatched ?? inspectorStatusMap[row.name]?.["Dispatched"] ?? 0) -
                          (row.totalReviewed || row.biwTotalReviewed || 0),
                        )}
                      </td>
                      <td
                        className="px-2 py-1.5 font-extrabold text-center text-green-600 dark:text-green-400 tabular-nums bg-purple-50/25 dark:bg-purple-950/10 cursor-help hover:bg-purple-100/60 dark:hover:bg-purple-900/40"
                        onMouseEnter={(e) => handleCellHover(e, "BIW Accepted", row)}
                                onClick={(e) => handleCellClick(e, "BIW Accepted", row)}
                        onMouseLeave={() => setReviewTooltip(null)}
                      >
                        {row.biwAccepted ?? row.accepted ?? 0}
                      </td>
                      <td
                        className="px-2 py-1.5 font-extrabold text-center text-red-600 dark:text-red-400 tabular-nums bg-purple-50/25 dark:bg-purple-950/10 cursor-help hover:bg-purple-100/60 dark:hover:bg-purple-900/40"
                        onMouseEnter={(e) => handleCellHover(e, "BIW Rejected", row)}
                                onClick={(e) => handleCellClick(e, "BIW Rejected", row)}
                        onMouseLeave={() => setReviewTooltip(null)}
                      >
                        {row.biwRejected ?? row.rejectedReview ?? row.rejected ?? 0}
                      </td>
                      <td
                        className="px-2 py-1.5 font-extrabold text-center text-orange-600 dark:text-orange-400 tabular-nums border-r border-purple-100 dark:border-purple-900/30 bg-purple-50/25 dark:bg-purple-950/10 cursor-help hover:bg-purple-100/60 dark:hover:bg-purple-900/40"
                        onMouseEnter={(e) => handleCellHover(e, "BIW Reworked", row)}
                                onClick={(e) => handleCellClick(e, "BIW Reworked", row)}
                        onMouseLeave={() => setReviewTooltip(null)}
                      >
                        {row.biwReworked ?? row.reworked ?? row.rework ?? 0}
                      </td>
                      {/* TVS Review Data Cells with distinct shading */}
                      <td
                        className="px-2 py-1.5 font-bold text-center tabular-nums border-l border-blue-100 dark:border-blue-900/30 bg-blue-50/25 dark:bg-blue-950/10 text-blue-900 dark:text-blue-200 cursor-help hover:bg-blue-100/60 dark:hover:bg-blue-900/40"
                        onMouseEnter={(e) => handleCellHover(e, "TVS Total Reviewed", row)}
                                onClick={(e) => handleCellClick(e, "TVS Total Reviewed", row)}
                        onMouseLeave={() => setReviewTooltip(null)}
                      >
                        {row.tvsTotalReviewed ?? 0}
                      </td>
                      <td
                        className="px-2 py-1.5 font-bold text-center tabular-nums bg-blue-50/25 dark:bg-blue-950/10 text-amber-600 dark:text-amber-400 cursor-help hover:bg-blue-100/60 dark:hover:bg-blue-900/40"
                        onMouseEnter={(e) => handleCellHover(e, "TVS Review Pending", row)}
                                onClick={(e) => handleCellClick(e, "TVS Review Pending", row)}
                        onMouseLeave={() => setReviewTooltip(null)}
                      >
                        {row.tvsReviewPending ?? Math.max(0, (row.dispatched || 0) - (row.tvsTotalReviewed || 0))}
                      </td>
                      <td
                        className="px-2 py-1.5 font-extrabold text-center text-emerald-600 dark:text-emerald-400 tabular-nums bg-blue-50/25 dark:bg-blue-950/10 cursor-help hover:bg-blue-100/60 dark:hover:bg-blue-900/40"
                        onMouseEnter={(e) => handleCellHover(e, "TVS Accepted", row)}
                                onClick={(e) => handleCellClick(e, "TVS Accepted", row)}
                        onMouseLeave={() => setReviewTooltip(null)}
                      >
                        {row.tvsAccepted ?? 0}
                      </td>
                      <td
                        className="px-2 py-1.5 font-extrabold text-center text-rose-600 dark:text-rose-400 tabular-nums bg-blue-50/25 dark:bg-blue-950/10 cursor-help hover:bg-blue-100/60 dark:hover:bg-blue-900/40"
                        onMouseEnter={(e) => handleCellHover(e, "TVS Rejected", row)}
                                onClick={(e) => handleCellClick(e, "TVS Rejected", row)}
                        onMouseLeave={() => setReviewTooltip(null)}
                      >
                        {row.tvsRejected ?? 0}
                      </td>
                      <td
                        className="px-2 py-1.5 font-extrabold text-center text-amber-600 dark:text-amber-400 tabular-nums border-r border-blue-100 dark:border-blue-900/30 bg-blue-50/25 dark:bg-blue-950/10 cursor-help hover:bg-blue-100/60 dark:hover:bg-blue-900/40"
                        onMouseEnter={(e) => handleCellHover(e, "TVS Rework", row)}
                                onClick={(e) => handleCellClick(e, "TVS Rework", row)}
                        onMouseLeave={() => setReviewTooltip(null)}
                      >
                        {row.tvsReworked ?? 0}
                      </td>
                      {/* Reviewed Section Data Cells */}
                      {showReviewerSection && (() => {
                        const rowRev = (row.biwTotalReviewed || row.totalReviewed || 0) + (row.tvsTotalReviewed || 0);
                        const rowPend = Math.max(0, (row.totalSubmitted || 0) - rowRev);
                        const rowAcc = (row.biwAccepted ?? row.accepted ?? 0) + (row.tvsAccepted || 0);
                        const rowRej = (row.biwRejected ?? row.rejectedReview ?? row.rejected ?? 0) + (row.tvsRejected || 0);
                        const rowRew = (row.biwReworked ?? row.reworked ?? row.rework ?? 0) + (row.tvsReworked || 0);
                        return (
                          <>
                            <td
                              className="px-2 py-1.5 font-bold text-center tabular-nums border-l border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/25 dark:bg-emerald-950/10 text-emerald-900 dark:text-emerald-200 cursor-help transition-colors hover:bg-emerald-100/80 dark:hover:bg-emerald-900/60"
                              onMouseEnter={(e) => handleReviewCellHover(e, "Reviewed", row)}
                                onClick={(e) => handleCellClick(e, "Reviewed", row)}
                              onMouseLeave={() => setReviewTooltip(null)}
                            >
                              {rowRev}
                            </td>
                            <td
                              className="px-2 py-1.5 font-bold text-center tabular-nums bg-emerald-50/25 dark:bg-emerald-950/10 text-amber-600 dark:text-amber-400 cursor-help transition-colors hover:bg-emerald-100/80 dark:hover:bg-emerald-900/60"
                              onMouseEnter={(e) => handleReviewCellHover(e, "Pending", row)}
                                onClick={(e) => handleCellClick(e, "Pending", row)}
                              onMouseLeave={() => setReviewTooltip(null)}
                            >
                              {rowPend}
                            </td>
                            <td
                              className="px-2 py-1.5 font-extrabold text-center text-emerald-600 dark:text-emerald-400 tabular-nums bg-emerald-50/25 dark:bg-emerald-950/10 cursor-help transition-colors hover:bg-emerald-100/80 dark:hover:bg-emerald-900/60"
                              onMouseEnter={(e) => handleReviewCellHover(e, "Accepted", row)}
                                onClick={(e) => handleCellClick(e, "AcceptedReviewer", row)}
                              onMouseLeave={() => setReviewTooltip(null)}
                            >
                              {rowAcc}
                            </td>
                            <td
                              className="px-2 py-1.5 font-extrabold text-center text-rose-600 dark:text-rose-400 tabular-nums bg-emerald-50/25 dark:bg-emerald-950/10 cursor-help transition-colors hover:bg-emerald-100/80 dark:hover:bg-emerald-900/60"
                              onMouseEnter={(e) => handleReviewCellHover(e, "Rejected", row)}
                                onClick={(e) => handleCellClick(e, "RejectedReviewer", row)}
                              onMouseLeave={() => setReviewTooltip(null)}
                            >
                              {rowRej}
                            </td>
                            <td
                              className="px-2 py-1.5 font-extrabold text-center text-amber-600 dark:text-amber-400 tabular-nums border-r border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/25 dark:bg-emerald-950/10 cursor-help transition-colors hover:bg-emerald-100/80 dark:hover:bg-emerald-900/60"
                              onMouseEnter={(e) => handleReviewCellHover(e, "Rework", row)}
                                onClick={(e) => handleCellClick(e, "ReworkReviewer", row)}
                              onMouseLeave={() => setReviewTooltip(null)}
                            >
                              {rowRew}
                            </td>
                          </>
                        );
                      })()}
                      <td
                        className="px-2 py-1.5 text-center cursor-help transition-all duration-150 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30 hover:scale-105"
                        onMouseEnter={(e) => handleCellHover(e, "PerformanceScore", row)}
                                onClick={(e) => handleCellClick(e, "PerformanceScore", row)}
                        onMouseLeave={() => setReviewTooltip(null)}
                      >
                        {(row.totalReviewed || row.biwTotalReviewed || 0) === 0 ? (
                          <span className="px-2 py-1 rounded-full text-[10px] font-bold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 tabular-nums">
                            N/A
                          </span>
                        ) : (
                          <span
                            className={`px-2 py-1 rounded-full text-[10px] font-black tabular-nums ${row.performanceScore >= 80
                              ? "bg-green-100 text-green-700"
                              : row.performanceScore >= 50
                                ? "bg-orange-100 text-orange-700"
                                : "bg-red-100 text-red-700"
                              }`}
                          >
                            {row.performanceScore}%
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {(row.totalReviewed || row.biwTotalReviewed || 0) === 0 ? (
                          <span className="px-2 py-1 rounded-full text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30">
                            Pending Review
                          </span>
                        ) : (
                          <span
                            className={`px-2 py-1 rounded-full text-[10px] font-black ${(() => {
                              const score = row.performanceScore || 0;
                              if (score < 60) return "bg-red-100 text-red-700";
                              if (score < 70) return "bg-orange-100 text-orange-700";
                              if (score < 80) return "bg-yellow-100 text-yellow-700";
                              if (score < 90) return "bg-green-100 text-green-700";
                              return "bg-emerald-100 text-emerald-700";
                            })()}`}
                          >
                            {(() => {
                              const score = row.performanceScore || 0;
                              if (score < 60) return "Not met performer";
                              if (score < 70) return "partially met performer";
                              if (score < 80) return "Met expectation";
                              if (score < 90) return "exceeded Performance";
                              return "Exemplary performer";
                            })()}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedInspectorForDetails(row);
                              setShowInspectorDetailModal(true);
                            }}
                            className="px-2 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-[10px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                            title="Inspect Form-Wise Breakdown (Own vs Assigned)"
                          >
                            <Layers className="w-3 h-3" />
                            View Breakdown
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedRows.has(row.name) && (() => {
                      const formsMap = inspectorFormsMap[row.name] || {};
                      const formNames = Object.keys(formsMap).sort();
                      if (formNames.length === 0) {
                        return (
                          <tr className="bg-purple-50/30 dark:bg-purple-900/10">
                            <td colSpan={30} className="px-6 py-3 text-center text-xs text-gray-500 dark:text-gray-400 italic">
                              No individual form breakdown available for {row.name}.
                            </td>
                          </tr>
                        );
                      }
                      return formNames.map((formName, formIdx) => {
                        const items = formsMap[formName];
                        const formSummary = items.reduce((acc, it) => {
                          const sc = it.statusCounts || {};
                          for (const status in sc) {
                            acc.statuses[status] = (acc.statuses[status] || 0) + sc[status];
                          }
                          acc.totalReviewed += it.totalReviewed || 0;
                          acc.accepted += it.accepted || 0;
                          acc.rework += it.reworked ?? it.rework ?? 0;
                          acc.rejected_outcome += it.rejectedReview ?? it.rejected ?? 0;
                          return acc;
                        }, {
                          statuses: {} as Record<string, number>,
                          totalReviewed: 0,
                          accepted: 0,
                          rework: 0,
                          rejected_outcome: 0,
                        });

                        const v = formSummary.statuses;
                        const directOk = (v["Direct Ok"] || 0) + (v["Accepted"] || 0);
                        const reworkQCCompleted = (v["Rework QC Completed"] || 0) + (v["Rework Accepted"] || 0);
                        const dispatched = v["Dispatched"] || 0;
                        const totalSubmitted = (v["Accepted"] || 0) + (v["Direct Ok"] || 0) + (v["Rework QC Completed"] || 0) + (v["Rework Accepted"] || 0) + (v["Rework QC Pending"] || 0) + (v["Rejected"] || 0);

                        const { totalReviewed, accepted, rework, rejected_outcome } = formSummary;
                        const dispatchPending = Math.max(0, directOk + reworkQCCompleted - dispatched);
                        const reviewPending = Math.max(0, dispatched - totalReviewed);
                        const rowBg = formIdx % 2 === 0 ? "bg-purple-50/20 dark:bg-purple-900/10" : "bg-purple-50/40 dark:bg-purple-900/20";

                        return (
                          <tr key={`${row.name}-${formName}-${formIdx}`} className={rowBg}>
                            {isSuperAdmin && <td className="px-2 py-1.5"></td>}
                            <td className="px-2 py-1.5 font-medium text-purple-800 dark:text-purple-200 whitespace-nowrap pl-6 truncate">
                              {formName}
                            </td>
                            {performanceStatuses.filter(s => s !== 'Dispatched').map(status => {
                              const val = status === "Accepted"
                                ? (v["Accepted"] || 0) + (v["Direct Ok"] || 0) + (v["Rework QC Completed"] || 0) + (v["Rework Accepted"] || 0)
                                : (v[status] || 0);
                              return (
                                <td key={status} className="px-2 py-1.5 font-bold text-center tabular-nums">
                                  {val}
                                </td>
                              );
                            })}
                            <td className="px-2 py-1.5 font-bold text-center tabular-nums">{dispatchPending}</td>
                            {performanceStatuses.includes("Dispatched") && (
                              <td className="px-2 py-1.5 font-bold text-center tabular-nums">
                                {dispatched}
                              </td>
                            )}
                            <td className="px-2 py-1.5 font-bold text-center tabular-nums border-r border-purple-100 dark:border-purple-900/30">{totalSubmitted}</td>
                            <td className="px-2 py-1.5 font-bold text-center tabular-nums bg-purple-100/40 dark:bg-purple-900/20 border-l border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200">{totalReviewed}</td>
                            <td className="px-2 py-1.5 font-bold text-center tabular-nums bg-purple-100/40 dark:bg-purple-900/20 text-amber-600 dark:text-amber-400">{reviewPending}</td>
                            <td className="px-2 py-1.5 font-extrabold text-center text-green-600 dark:text-green-400 tabular-nums bg-purple-100/40 dark:bg-purple-900/20">{accepted}</td>
                            <td className="px-2 py-1.5 font-extrabold text-center text-red-600 dark:text-red-400 tabular-nums bg-purple-100/40 dark:bg-purple-900/20">{rejected_outcome}</td>
                            <td className="px-2 py-1.5 font-extrabold text-center text-orange-600 dark:text-orange-400 tabular-nums border-r border-purple-200 dark:border-purple-800 bg-purple-100/40 dark:bg-purple-900/20">{rework}</td>
                            <td className="px-2 py-1.5 font-bold text-center tabular-nums bg-blue-100/40 dark:bg-blue-900/20 border-l border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200">—</td>
                            <td className="px-2 py-1.5 font-bold text-center tabular-nums bg-blue-100/40 dark:bg-blue-900/20 text-amber-600 dark:text-amber-400">—</td>
                            <td className="px-2 py-1.5 font-extrabold text-center text-emerald-600 dark:text-emerald-400 tabular-nums bg-blue-100/40 dark:bg-blue-900/20">—</td>
                            <td className="px-2 py-1.5 font-extrabold text-center text-rose-600 dark:text-rose-400 tabular-nums bg-blue-100/40 dark:bg-blue-900/20">—</td>
                            <td className="px-2 py-1.5 font-extrabold text-center text-amber-600 dark:text-amber-400 tabular-nums border-r border-blue-200 dark:border-blue-800 bg-blue-100/40 dark:bg-blue-900/20">—</td>
                            {showReviewerSection && (
                              <>
                                <td className="px-2 py-1.5 font-bold text-center tabular-nums bg-emerald-100/40 dark:bg-emerald-900/20 border-l border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200">—</td>
                                <td className="px-2 py-1.5 font-bold text-center tabular-nums bg-emerald-100/40 dark:bg-emerald-900/20 text-amber-600 dark:text-amber-400">—</td>
                                <td className="px-2 py-1.5 font-extrabold text-center text-emerald-600 dark:text-emerald-400 tabular-nums bg-emerald-100/40 dark:bg-emerald-900/20">—</td>
                                <td className="px-2 py-1.5 font-extrabold text-center text-rose-600 dark:text-rose-400 tabular-nums bg-emerald-100/40 dark:bg-emerald-900/20">—</td>
                                <td className="px-2 py-1.5 font-extrabold text-center text-amber-600 dark:text-amber-400 tabular-nums border-r border-emerald-200 dark:border-emerald-800 bg-emerald-100/40 dark:bg-emerald-900/20">—</td>
                              </>
                            )}
                            <td className="px-2 py-1.5"></td>
                            <td className="px-2 py-1.5"></td>
                            <td className="px-2 py-1.5"></td>
                          </tr>
                        );
                      });
                    })()}
                  </React.Fragment>
                ))
              )}
                {(() => {
                  const grandTotalEntity = {
                    name: "All Plants (Grand Total)",
                    directOk: totalDirectOk,
                    reworkQcCompleted: totalReworkQCCompleted,
                    reworkQcPending: statusTotals["Rework QC Pending"] || 0,
                    rejected: statusTotals["Rejected"] || 0,
                    dispatchPending: totalDispatchPending,
                    dispatched: totalDispatched,
                    totalSubmitted: totalTotalSubmitted,
                    totalReviewed: totalTotalReviewed,
                    reviewPending: totalReviewPending,
                    biwAccepted: totalAccepted,
                    biwRejected: totalRejected,
                    biwReworked: totalRework,
                    tvsReviewed: totalTvsReviewed,
                    tvsPending: totalTvsReviewPending,
                    tvsAccepted: totalTvsAccepted,
                    tvsRejected: totalTvsRejected,
                    tvsRework: totalTvsRework,
                    reviewedTotal: totalOverallReviewed,
                    reviewedPending: totalOverallReviewPending,
                    reviewedAccepted: totalOverallAccepted,
                    reviewedRejected: totalOverallRejected,
                    reviewedRework: totalOverallRework,
                    performanceScore: avgPerformance || 0,
                    formBreakdown: allFormsBreakdown,
                    timeBreakdown: allTimeBreakdown,
                  };

                  return (
                    <tr className="bg-gray-100 dark:bg-gray-700 border-t-2 border-gray-300 dark:border-gray-500 font-black text-gray-900 dark:text-white">
                      {isSuperAdmin && (
                        <td className="px-2 py-1.5 whitespace-nowrap text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400">
                          —
                        </td>
                      )}
                      <td className="px-2 py-1.5 whitespace-nowrap text-xs font-black uppercase tracking-widest text-gray-700 dark:text-gray-200">
                        Total
                      </td>
                      {performanceStatuses
                        .filter((s) => s !== "Dispatched")
                        .map((status) => (
                          <td
                            key={status}
                            className={`px-2 py-1.5 text-center tabular-nums font-black cursor-help transition-colors hover:bg-emerald-200/60 dark:hover:bg-emerald-800/40 ${status === "Accepted" || status === "Direct Ok" ||
                              status === "Rework Accepted"
                              ? "text-emerald-700 dark:text-emerald-300"
                              : status.startsWith("Rework")
                                ? "text-amber-700 dark:text-amber-300"
                                : status === "Rejected"
                                  ? "text-rose-700 dark:text-rose-300"
                                  : "text-blue-700 dark:text-blue-300"
                              }`}
                            onMouseEnter={(e) => handleCellHover(e, status, grandTotalEntity)}
                                onClick={(e) => handleCellClick(e, status, grandTotalEntity)}
                            onMouseLeave={() => setReviewTooltip(null)}
                          >
                            {statusTotals[status] || 0}
                          </td>
                        ))}
                      <td
                        className="px-2 py-1.5 text-center tabular-nums font-black text-violet-700 dark:text-violet-300 cursor-help transition-colors hover:bg-violet-200/60 dark:hover:bg-violet-800/40"
                        onMouseEnter={(e) => handleCellHover(e, "Dispatch Pending", grandTotalEntity)}
                                onClick={(e) => handleCellClick(e, "Dispatch Pending", grandTotalEntity)}
                        onMouseLeave={() => setReviewTooltip(null)}
                      >
                        {totalDispatchPending}
                      </td>
                      {performanceStatuses.includes("Dispatched") && (
                        <td
                          className="px-2 py-1.5 text-center tabular-nums font-black text-blue-700 dark:text-blue-300 cursor-help transition-colors hover:bg-blue-200/60 dark:hover:bg-blue-800/40"
                          onMouseEnter={(e) => handleCellHover(e, "Dispatched", grandTotalEntity)}
                                onClick={(e) => handleCellClick(e, "Dispatched", grandTotalEntity)}
                          onMouseLeave={() => setReviewTooltip(null)}
                        >
                          {totalDispatched}
                        </td>
                      )}
                      <td
                        className="px-2 py-1.5 text-center tabular-nums font-black border-r border-gray-300 dark:border-gray-500 cursor-help transition-colors hover:bg-gray-200 dark:hover:bg-gray-600"
                        onMouseEnter={(e) => handleCellHover(e, "Total Submitted", grandTotalEntity)}
                                onClick={(e) => handleCellClick(e, "Total Submitted", grandTotalEntity)}
                        onMouseLeave={() => setReviewTooltip(null)}
                      >
                        {totalTotalSubmitted}
                      </td>
                      {/* BIW Review Total Cells */}
                      <td
                        className="px-2 py-1.5 text-center tabular-nums font-black border-l border-purple-300 dark:border-purple-700 bg-purple-100/70 dark:bg-purple-900/40 text-purple-900 dark:text-purple-200 cursor-help transition-colors hover:bg-purple-200 dark:hover:bg-purple-800"
                        onMouseEnter={(e) => handleCellHover(e, "BIW Total Reviewed", grandTotalEntity)}
                                onClick={(e) => handleCellClick(e, "BIW Total Reviewed", grandTotalEntity)}
                        onMouseLeave={() => setReviewTooltip(null)}
                      >
                        {totalTotalReviewed}
                      </td>
                      <td
                        className="px-2 py-1.5 text-center tabular-nums font-black text-amber-700 dark:text-amber-300 bg-purple-100/70 dark:bg-purple-900/40 cursor-help transition-colors hover:bg-purple-200 dark:hover:bg-purple-800"
                        onMouseEnter={(e) => handleCellHover(e, "BIW Review Pending", grandTotalEntity)}
                                onClick={(e) => handleCellClick(e, "BIW Review Pending", grandTotalEntity)}
                        onMouseLeave={() => setReviewTooltip(null)}
                      >
                        {totalReviewPending}
                      </td>
                      <td
                        className="px-2 py-1.5 text-center tabular-nums font-black text-green-700 dark:text-green-300 bg-purple-100/70 dark:bg-purple-900/40 cursor-help transition-colors hover:bg-purple-200 dark:hover:bg-purple-800"
                        onMouseEnter={(e) => handleCellHover(e, "BIW Accepted", grandTotalEntity)}
                                onClick={(e) => handleCellClick(e, "BIW Accepted", grandTotalEntity)}
                        onMouseLeave={() => setReviewTooltip(null)}
                      >
                        {totalAccepted}
                      </td>
                      <td
                        className="px-2 py-1.5 text-center tabular-nums font-black text-red-700 dark:text-red-300 bg-purple-100/70 dark:bg-purple-900/40 cursor-help transition-colors hover:bg-purple-200 dark:hover:bg-purple-800"
                        onMouseEnter={(e) => handleCellHover(e, "BIW Rejected", grandTotalEntity)}
                                onClick={(e) => handleCellClick(e, "BIW Rejected", grandTotalEntity)}
                        onMouseLeave={() => setReviewTooltip(null)}
                      >
                        {totalRejected}
                      </td>
                      <td
                        className="px-2 py-1.5 text-center tabular-nums font-black text-orange-700 dark:text-orange-300 border-r border-purple-300 dark:border-purple-700 bg-purple-100/70 dark:bg-purple-900/40 cursor-help transition-colors hover:bg-purple-200 dark:hover:bg-purple-800"
                        onMouseEnter={(e) => handleCellHover(e, "BIW Reworked", grandTotalEntity)}
                                onClick={(e) => handleCellClick(e, "BIW Reworked", grandTotalEntity)}
                        onMouseLeave={() => setReviewTooltip(null)}
                      >
                        {totalRework}
                      </td>
                      {/* TVS Review Total Cells */}
                      <td
                        className="px-2 py-1.5 text-center tabular-nums font-black border-l border-blue-300 dark:border-blue-700 bg-blue-100/70 dark:bg-blue-900/40 text-blue-900 dark:text-blue-200 cursor-help transition-colors hover:bg-blue-200 dark:hover:bg-blue-800"
                        onMouseEnter={(e) => handleCellHover(e, "TVS Total Reviewed", grandTotalEntity)}
                                onClick={(e) => handleCellClick(e, "TVS Total Reviewed", grandTotalEntity)}
                        onMouseLeave={() => setReviewTooltip(null)}
                      >
                        {totalTvsReviewed}
                      </td>
                      <td
                        className="px-2 py-1.5 text-center tabular-nums font-black text-amber-700 dark:text-amber-300 bg-blue-100/70 dark:bg-blue-900/40 cursor-help transition-colors hover:bg-blue-200 dark:hover:bg-blue-800"
                        onMouseEnter={(e) => handleCellHover(e, "TVS Review Pending", grandTotalEntity)}
                                onClick={(e) => handleCellClick(e, "TVS Review Pending", grandTotalEntity)}
                        onMouseLeave={() => setReviewTooltip(null)}
                      >
                        {totalTvsReviewPending}
                      </td>
                      <td
                        className="px-2 py-1.5 text-center tabular-nums font-black text-emerald-700 dark:text-emerald-300 bg-blue-100/70 dark:bg-blue-900/40 cursor-help transition-colors hover:bg-blue-200 dark:hover:bg-blue-800"
                        onMouseEnter={(e) => handleCellHover(e, "TVS Accepted", grandTotalEntity)}
                                onClick={(e) => handleCellClick(e, "TVS Accepted", grandTotalEntity)}
                        onMouseLeave={() => setReviewTooltip(null)}
                      >
                        {totalTvsAccepted}
                      </td>
                      <td
                        className="px-2 py-1.5 text-center tabular-nums font-black text-rose-700 dark:text-rose-300 bg-blue-100/70 dark:bg-blue-900/40 cursor-help transition-colors hover:bg-blue-200 dark:hover:bg-blue-800"
                        onMouseEnter={(e) => handleCellHover(e, "TVS Rejected", grandTotalEntity)}
                                onClick={(e) => handleCellClick(e, "TVS Rejected", grandTotalEntity)}
                        onMouseLeave={() => setReviewTooltip(null)}
                      >
                        {totalTvsRejected}
                      </td>
                      <td
                        className="px-2 py-1.5 text-center tabular-nums font-black text-amber-700 dark:text-amber-300 border-r border-blue-300 dark:border-blue-700 bg-blue-100/70 dark:bg-blue-900/40 cursor-help transition-colors hover:bg-blue-200 dark:hover:bg-blue-800"
                        onMouseEnter={(e) => handleCellHover(e, "TVS Rework", grandTotalEntity)}
                                onClick={(e) => handleCellClick(e, "TVS Rework", grandTotalEntity)}
                        onMouseLeave={() => setReviewTooltip(null)}
                      >
                        {totalTvsRework}
                      </td>
                      {/* Reviewed Section Total Cells */}
                      {showReviewerSection && (
                        <>
                          <td
                            className="px-2 py-1.5 text-center tabular-nums font-black border-l border-emerald-300 dark:border-emerald-700 bg-emerald-100/70 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-200 cursor-help transition-colors hover:bg-emerald-200/80 dark:hover:bg-emerald-800/80"
                            onMouseEnter={(e) => handleReviewCellHover(e, "Reviewed", grandTotalEntity)}
                                    onClick={(e) => handleCellClick(e, "Reviewed", grandTotalEntity)}
                            onMouseLeave={() => setReviewTooltip(null)}
                          >
                            {totalOverallReviewed}
                          </td>
                          <td
                            className="px-2 py-1.5 text-center tabular-nums font-black text-amber-700 dark:text-amber-300 bg-emerald-100/70 dark:bg-emerald-900/40 cursor-help transition-colors hover:bg-emerald-200/80 dark:hover:bg-emerald-800/80"
                            onMouseEnter={(e) => handleReviewCellHover(e, "Pending", grandTotalEntity)}
                                    onClick={(e) => handleCellClick(e, "Pending", grandTotalEntity)}
                            onMouseLeave={() => setReviewTooltip(null)}
                          >
                            {totalOverallReviewPending}
                          </td>
                          <td
                            className="px-2 py-1.5 text-center tabular-nums font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-900/40 cursor-help transition-colors hover:bg-emerald-200/80 dark:hover:bg-emerald-800/80"
                            onMouseEnter={(e) => handleReviewCellHover(e, "Accepted", grandTotalEntity)}
                                    onClick={(e) => handleCellClick(e, "AcceptedReviewer", grandTotalEntity)}
                            onMouseLeave={() => setReviewTooltip(null)}
                          >
                            {totalOverallAccepted}
                          </td>
                          <td
                            className="px-2 py-1.5 text-center tabular-nums font-black text-rose-700 dark:text-rose-300 bg-emerald-100/70 dark:bg-emerald-900/40 cursor-help transition-colors hover:bg-emerald-200/80 dark:hover:bg-emerald-800/80"
                            onMouseEnter={(e) => handleReviewCellHover(e, "Rejected", grandTotalEntity)}
                                    onClick={(e) => handleCellClick(e, "RejectedReviewer", grandTotalEntity)}
                            onMouseLeave={() => setReviewTooltip(null)}
                          >
                            {totalOverallRejected}
                          </td>
                          <td
                            className="px-2 py-1.5 text-center tabular-nums font-black text-amber-700 dark:text-amber-300 border-r border-emerald-300 dark:border-emerald-700 bg-emerald-100/70 dark:bg-emerald-900/40 cursor-help transition-colors hover:bg-emerald-200/80 dark:hover:bg-emerald-800/80"
                            onMouseEnter={(e) => handleReviewCellHover(e, "Rework", grandTotalEntity)}
                                    onClick={(e) => handleCellClick(e, "ReworkReviewer", grandTotalEntity)}
                            onMouseLeave={() => setReviewTooltip(null)}
                          >
                            {totalOverallRework}
                          </td>
                        </>
                      )}
                      <td
                        className="px-2 py-1.5 text-center cursor-help"
                        onMouseEnter={(e) => handleCellHover(e, "PerformanceScore", grandTotalEntity)}
                                onClick={(e) => handleCellClick(e, "PerformanceScore", grandTotalEntity)}
                        onMouseLeave={() => setReviewTooltip(null)}
                      >
                        {avgPerformance === null ? (
                          <span className="px-2 py-1 rounded-full text-[10px] font-bold text-gray-400 dark:text-gray-500 bg-gray-200 dark:bg-gray-600 tabular-nums">
                            N/A
                          </span>
                        ) : (
                          <span
                            className={`px-2 py-1 rounded-full text-[10px] font-black tabular-nums ${avgPerformance >= 80
                              ? "bg-green-200 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                              : avgPerformance >= 50
                                ? "bg-orange-200 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300"
                                : "bg-red-200 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                              }`}
                          >
                            {avgPerformance}%
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {avgPerformance === null ? (
                          <span className="px-2 py-1 rounded-full text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30">
                            Pending Review
                          </span>
                        ) : (
                          <span
                            className={`px-2 py-1 rounded-full text-[10px] font-black ${(() => {
                              if (avgPerformance < 60) return "bg-red-100 text-red-700";
                              if (avgPerformance < 70) return "bg-orange-100 text-orange-700";
                              if (avgPerformance < 80) return "bg-yellow-100 text-yellow-700";
                              if (avgPerformance < 90) return "bg-green-100 text-green-700";
                              return "bg-emerald-100 text-emerald-700";
                            })()}`}
                          >
                            {avgPerformance < 60
                              ? "Not met performer"
                              : avgPerformance < 70
                                ? "partially met performer"
                                : avgPerformance < 80
                                  ? "Met expectation"
                                  : avgPerformance < 90
                                    ? "exceeded Performance"
                                    : "Exemplary performer"}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <span className="text-xs text-gray-400">—</span>
                      </td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
        )}
        {performanceTableData.length > 0 && totalPerformancePages > 1 && viewMode !== "cross_tenant" && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-gray-50/30 dark:bg-gray-900/30 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Show
              </label>
              <select
                value={performancePageSize}
                onChange={(e) => {
                  setPerformancePageSize(Number(e.target.value));
                  setPerformancePage(1);
                }}
                className="px-2 py-1 text-xs font-bold border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none"
              >
                {[5, 10, 20, 50].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest hidden xs:inline">
                {startIndex + 1}-{Math.min(endIndex, totalPerformanceItems)}{" "}
                of {totalPerformanceItems}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  setPerformancePage((prev) => Math.max(1, prev - 1))
                }
                disabled={performancePage === 1}
                className="p-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-30 transition-all hover:bg-gray-50 shadow-sm"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1 overflow-x-auto max-w-[120px] sm:max-w-none scrollbar-none">
                {Array.from(
                  { length: totalPerformancePages },
                  (_, i) => i + 1,
                )
                  .filter(
                    (num) =>
                      totalPerformancePages <= 3 ||
                      Math.abs(num - performancePage) <= 1 ||
                      num === 1 ||
                      num === totalPerformancePages,
                  )
                  .map((pageNum, idx, arr) => (
                    <React.Fragment key={pageNum}>
                      {idx > 0 && arr[idx - 1] !== pageNum - 1 && (
                        <span className="text-gray-300 text-[10px]">...</span>
                      )}
                      <button
                        onClick={() => setPerformancePage(pageNum)}
                        className={`min-w-[28px] h-7 text-[10px] font-black rounded-lg transition-all ${performancePage === pageNum
                          ? "bg-purple-600 text-white shadow-md shadow-purple-500/20"
                          : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
                          }`}
                      >
                        {pageNum}
                      </button>
                    </React.Fragment>
                  ))}
              </div>

              <button
                onClick={() =>
                  setPerformancePage((prev) =>
                    Math.min(totalPerformancePages, prev + 1),
                  )
                }
                disabled={performancePage === totalPerformancePages}
                className="p-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-30 transition-all hover:bg-gray-50 shadow-sm"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Performance Table Explanation Guide Modal */}
      <PerformanceGuideModal
        isOpen={showPerformanceGuide}
        onClose={() => setShowPerformanceGuide(false)}
      />

      {/* Inspector Form-Wise Breakdown Modal (Own vs Assigned Forms) */}
      {showInspectorDetailModal && selectedInspectorForDetails && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
          onClick={() => setShowInspectorDetailModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-3xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-purple-50/90 via-white to-purple-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-purple-950/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0 shadow-xs">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                      Inspector Form-Wise Activity & Cross-Tenant Audit
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200 border border-purple-200 dark:border-purple-800">
                      {selectedInspectorForDetails.tenantName || "Plant"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Inspector: <strong className="text-gray-800 dark:text-gray-200">{selectedInspectorForDetails.name}</strong> • Role: <span className="capitalize">{selectedInspectorForDetails.role || "Inspector"}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInspectorDetailModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Summary KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-3 bg-gray-50 dark:bg-gray-800/80 rounded-2xl border border-gray-200 dark:border-gray-700 text-center">
                  <p className="text-[10px] uppercase font-bold text-gray-400">Total Forms</p>
                  <p className="text-lg font-black text-gray-800 dark:text-gray-100 mt-0.5">
                    {selectedInspectorForDetails.formBreakdown?.length || (selectedInspectorForDetails.totalSubmitted > 0 ? 1 : 0)}
                  </p>
                </div>
                <div className="p-3 bg-emerald-50/80 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-center">
                  <p className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300">Own Forms</p>
                  <p className="text-lg font-black text-emerald-800 dark:text-emerald-200 mt-0.5">
                    {selectedInspectorForDetails.ownFormsCount ?? ((selectedInspectorForDetails.formBreakdown || []).filter((f: any) => f.isOwnForm).length)}
                  </p>
                </div>
                <div className="p-3 bg-purple-50/80 dark:bg-purple-950/30 rounded-2xl border border-purple-200 dark:border-purple-800 text-center">
                  <p className="text-[10px] uppercase font-bold text-purple-700 dark:text-purple-300">Assigned / Cross</p>
                  <p className="text-lg font-black text-purple-800 dark:text-purple-200 mt-0.5">
                    {selectedInspectorForDetails.assignedFormsCount ?? ((selectedInspectorForDetails.formBreakdown || []).filter((f: any) => !f.isOwnForm).length)}
                  </p>
                </div>
                <div className="p-3 bg-blue-50/80 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-800 text-center">
                  <p className="text-[10px] uppercase font-bold text-blue-700 dark:text-blue-300">Submissions</p>
                  <p className="text-lg font-black text-blue-800 dark:text-blue-200 mt-0.5">
                    {selectedInspectorForDetails.totalSubmitted || 0}
                  </p>
                </div>
                <div className="p-3 bg-purple-50/80 dark:bg-purple-950/30 rounded-2xl border border-purple-200 dark:border-purple-800 text-center">
                  <p className="text-[10px] uppercase font-bold text-purple-700 dark:text-purple-300">BIW Reviews</p>
                  <p className="text-lg font-black text-purple-800 dark:text-purple-200 mt-0.5">
                    {selectedInspectorForDetails.biwTotalReviewed || selectedInspectorForDetails.totalReviewed || 0}
                  </p>
                </div>
                <div className="p-3 bg-indigo-50/80 dark:bg-indigo-950/30 rounded-2xl border border-indigo-200 dark:border-indigo-800 text-center">
                  <p className="text-[10px] uppercase font-bold text-indigo-700 dark:text-indigo-300">TVS Reviews</p>
                  <p className="text-lg font-black text-indigo-800 dark:text-indigo-200 mt-0.5">
                    {selectedInspectorForDetails.tvsTotalReviewed || 0}
                  </p>
                </div>
              </div>

              {/* Form-Wise Table */}
              <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-xs">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 uppercase tracking-wider text-[10px] font-black">
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="px-3 py-2">Form Title & Plant</th>
                      <th className="px-3 py-2 text-center">Type</th>
                      <th className="px-3 py-2 text-center bg-gray-50/60 dark:bg-gray-800/60" colSpan={4}>Submissions</th>
                      <th className="px-3 py-2 text-center bg-purple-50/60 dark:bg-purple-950/40" colSpan={3}>BIW Review</th>
                      <th className="px-3 py-2 text-center bg-blue-50/60 dark:bg-blue-950/40" colSpan={3}>TVS Review</th>
                    </tr>
                    <tr className="border-b border-gray-200 dark:border-gray-700 text-[9px] font-extrabold text-gray-500 dark:text-gray-400">
                      <th className="px-3 py-1.5">Template</th>
                      <th className="px-3 py-1.5 text-center">Relation</th>
                      <th className="px-2 py-1.5 text-center text-emerald-600">Accepted</th>
                      <th className="px-2 py-1.5 text-center text-amber-600">Rework</th>
                      <th className="px-2 py-1.5 text-center text-rose-600">Reject</th>
                      <th className="px-2 py-1.5 text-center text-indigo-600 border-r border-gray-200 dark:border-gray-700">Total</th>
                      <th className="px-2 py-1.5 text-center text-purple-700 bg-purple-50/40 dark:bg-purple-950/20">Reviewed</th>
                      <th className="px-2 py-1.5 text-center text-emerald-600 bg-purple-50/40 dark:bg-purple-950/20">Accepted</th>
                      <th className="px-2 py-1.5 text-center text-rose-600 bg-purple-50/40 dark:bg-purple-950/20 border-r border-gray-200 dark:border-gray-700">Defects</th>
                      <th className="px-2 py-1.5 text-center text-blue-700 bg-blue-50/40 dark:bg-blue-950/20">Reviewed</th>
                      <th className="px-2 py-1.5 text-center text-emerald-600 bg-blue-50/40 dark:bg-blue-950/20">Accepted</th>
                      <th className="px-2 py-1.5 text-center text-rose-600 bg-blue-50/40 dark:bg-blue-950/20">Defects</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-[11px]">
                    {(!selectedInspectorForDetails.formBreakdown || selectedInspectorForDetails.formBreakdown.length === 0) ? (
                      <tr>
                        <td className="px-3 py-3 font-semibold text-gray-800 dark:text-gray-200">
                          Primary Form Inspection
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            🏠 Own Form
                          </span>
                        </td>
                        <td className="px-2 py-3 text-center font-bold text-emerald-600">{(selectedInspectorForDetails.directOk || 0) + (selectedInspectorForDetails.reworkQcCompleted || 0) + (selectedInspectorForDetails.accepted || 0)}</td>
                        <td className="px-2 py-3 text-center font-bold text-amber-600">{selectedInspectorForDetails.reworkQcPending || 0}</td>
                        <td className="px-2 py-3 text-center font-bold text-rose-600">{selectedInspectorForDetails.rejected || 0}</td>
                        <td className="px-2 py-3 text-center font-black text-indigo-700 dark:text-indigo-400 border-r border-gray-200 dark:border-gray-700">{selectedInspectorForDetails.totalSubmitted || 0}</td>
                        <td className="px-2 py-3 text-center font-bold text-purple-700 dark:text-purple-300 bg-purple-50/20">{selectedInspectorForDetails.biwTotalReviewed || 0}</td>
                        <td className="px-2 py-3 text-center font-bold text-emerald-600 bg-purple-50/20">{selectedInspectorForDetails.biwAccepted || 0}</td>
                        <td className="px-2 py-3 text-center font-bold text-rose-600 bg-purple-50/20 border-r border-gray-200 dark:border-gray-700">{(selectedInspectorForDetails.biwRejected || 0) + (selectedInspectorForDetails.biwReworked || 0)}</td>
                        <td className="px-2 py-3 text-center font-bold text-blue-700 dark:text-blue-300 bg-blue-50/20">{selectedInspectorForDetails.tvsTotalReviewed || 0}</td>
                        <td className="px-2 py-3 text-center font-bold text-emerald-600 bg-blue-50/20">{selectedInspectorForDetails.tvsAccepted || 0}</td>
                        <td className="px-2 py-3 text-center font-bold text-rose-600 bg-blue-50/20">{(selectedInspectorForDetails.tvsRejected || 0) + (selectedInspectorForDetails.tvsReworked || 0)}</td>
                      </tr>
                    ) : (
                      selectedInspectorForDetails.formBreakdown.map((f: any, fIdx: number) => {
                        const biwDefects = (f.biwRejected || 0) + (f.biwReworked || 0);
                        const tvsDefects = (f.tvsRejected || 0) + (f.tvsReworked || 0);
                        return (
                          <tr key={f.formId || fIdx} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/60 transition-colors">
                            <td className="px-3 py-2.5">
                              <p className="font-bold text-gray-900 dark:text-gray-100">{f.formTitle || "Inspection Form"}</p>
                              {f.formTenantName && (
                                <p className="text-[10px] text-gray-400">Owning Plant: {f.formTenantName}</p>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-center whitespace-nowrap">
                              {f.isOwnForm ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                  🏠 Own Form
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800" title={`Form belongs to ${f.formTenantName}`}>
                                  🔄 Assigned ({f.formTenantName})
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-2.5 text-center font-bold text-emerald-600 tabular-nums">{(f.directOk || 0) + (f.reworkQcCompleted || 0) + (f.accepted || 0)}</td>
                            <td className="px-2 py-2.5 text-center font-bold text-amber-600 tabular-nums">{f.reworkQcPending || 0}</td>
                            <td className="px-2 py-2.5 text-center font-bold text-rose-600 tabular-nums">{f.rejected || 0}</td>
                            <td className="px-2 py-2.5 text-center font-black text-indigo-700 dark:text-indigo-400 tabular-nums border-r border-gray-200 dark:border-gray-700">{f.totalSubmitted || 0}</td>
                            <td className="px-2 py-2.5 text-center font-bold text-purple-700 dark:text-purple-300 bg-purple-50/20 tabular-nums">{f.biwTotalReviewed || 0}</td>
                            <td className="px-2 py-2.5 text-center font-bold text-emerald-600 bg-purple-50/20 tabular-nums">{f.biwAccepted || 0}</td>
                            <td className="px-2 py-2.5 text-center font-bold text-rose-600 bg-purple-50/20 border-r border-gray-200 dark:border-gray-700 tabular-nums">{biwDefects}</td>
                            <td className="px-2 py-2.5 text-center font-bold text-blue-700 dark:text-blue-300 bg-blue-50/20 tabular-nums">{f.tvsTotalReviewed || 0}</td>
                            <td className="px-2 py-2.5 text-center font-bold text-emerald-600 bg-blue-50/20 tabular-nums">{f.tvsAccepted || 0}</td>
                            <td className="px-2 py-2.5 text-center font-bold text-rose-600 bg-blue-50/20 tabular-nums">{tvsDefects}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-850">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Data strictly reconciled against MongoDB response and review records.
              </span>
              <button
                type="button"
                onClick={() => setShowInspectorDetailModal(false)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Hover Breakdown Card for Reviewer Section */}
      {reviewTooltip && (
        <div
          className="fixed z-[99999] pointer-events-auto transition-all duration-150 animate-in fade-in zoom-in-95"
          style={{
            left: `${reviewTooltip.x}px`,
            top: `${reviewTooltip.y}px`,
            width: "360px",
          }}
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
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

            {/* Target Inspector / Plant & Source */}
            <div className="text-[11px] font-bold text-gray-700 dark:text-gray-200 mb-2 flex items-center justify-between gap-2">
              <span className="truncate">👤 {reviewTooltip.userName}</span>
              {reviewTooltip.sourceCategory && (
                <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 truncate max-w-[170px] border border-gray-200 dark:border-gray-700">
                  {reviewTooltip.sourceCategory}
                </span>
              )}
            </div>

            {/* Formula Explanation */}
            <div className="p-2.5 bg-emerald-50/70 dark:bg-emerald-950/40 rounded-xl border border-emerald-200/70 dark:border-emerald-800/70 mb-2.5 text-[11px]">
              <span className="text-[10px] uppercase font-black tracking-wider text-emerald-800 dark:text-emerald-300 block mb-0.5">
                📐 Calculation Formula / Origin:
              </span>
              <span className="font-semibold text-emerald-950 dark:text-emerald-200 leading-snug block">
                {reviewTooltip.formula}
              </span>
            </div>

            {/* Tab Switcher: Form-Wise vs Time-Wise (30d / Month) */}
            <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl mb-2.5">
              <button
                type="button"
                onClick={() => setBreakdownTab("forms")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  breakdownTab === "forms"
                    ? "bg-white dark:bg-gray-700 text-emerald-700 dark:text-emerald-300 shadow-xs"
                    : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                <FileText className="w-3 h-3" />
                <span>Form-Wise ({reviewTooltip.forms.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setBreakdownTab("time")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  breakdownTab === "time"
                    ? "bg-white dark:bg-gray-700 text-emerald-700 dark:text-emerald-300 shadow-xs"
                    : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                <Calendar className="w-3 h-3" />
                <span>Time-Wise (30d Buckets)</span>
              </button>
            </div>

            {breakdownTab === "forms" ? (
              <>
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
              </>
            ) : (
              <>
                {/* Time Wise Breakdown Header */}
                <div className="text-[10px] uppercase font-black tracking-wider text-gray-500 dark:text-gray-400 mb-1.5 flex items-center justify-between">
                  <span>Time-Wise Breakdown (30-Day Intervals)</span>
                  <span>Count</span>
                </div>

                {/* Time List */}
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 text-xs">
                  {!reviewTooltip.times || reviewTooltip.times.length === 0 ? (
                    <p className="text-[11px] text-gray-400 italic py-2 text-center">
                      No time-wise breakdown available for this date filter.
                    </p>
                  ) : (
                    reviewTooltip.times.map((t, i) => (
                      <div
                        key={i}
                        className="flex items-start justify-between gap-2 p-2 rounded-lg bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-[11px] text-gray-800 dark:text-gray-100 truncate">
                            📅 {t.title}
                          </p>
                          {t.subDetail && (
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                              {t.subDetail}
                            </p>
                          )}
                        </div>
                        <span className="font-black text-xs tabular-nums px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 shrink-0">
                          {t.count}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Interactive Pinned Breakdown Modal (Opened when clicking any Performance Table Number) */}
      {pinnedBreakdown && (
        <div
          className="fixed inset-0 z-[99999] bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setPinnedBreakdown(null)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-emerald-500/40 dark:border-emerald-500/40 w-full max-w-lg p-5 text-gray-800 dark:text-gray-100 ring-1 ring-black/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-sm font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  {pinnedBreakdown.metric} Breakdown
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                  Total: {pinnedBreakdown.totalVal}
                </span>
                <button
                  type="button"
                  onClick={() => setPinnedBreakdown(null)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Target Inspector / Plant & Source */}
            <div className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-2.5 flex items-center justify-between gap-2">
              <span className="truncate">👤 {pinnedBreakdown.userName}</span>
              {pinnedBreakdown.sourceCategory && (
                <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                  {pinnedBreakdown.sourceCategory}
                </span>
              )}
            </div>

            {/* Formula Explanation */}
            <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/40 rounded-xl border border-emerald-200/70 dark:border-emerald-800/70 mb-3.5 text-xs">
              <span className="text-[10px] uppercase font-black tracking-wider text-emerald-800 dark:text-emerald-300 block mb-0.5">
                📐 Calculation Formula / Origin:
              </span>
              <span className="font-semibold text-emerald-950 dark:text-emerald-200 leading-snug block">
                {pinnedBreakdown.formula}
              </span>
            </div>

            {/* Tab Switcher: Form-Wise vs Time-Wise (30d / Month) */}
            <div className="flex items-center gap-1.5 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl mb-3.5">
              <button
                type="button"
                onClick={() => setBreakdownTab("forms")}
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  breakdownTab === "forms"
                    ? "bg-white dark:bg-gray-700 text-emerald-700 dark:text-emerald-300 shadow-xs"
                    : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Form-Wise Breakdown ({pinnedBreakdown.forms.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setBreakdownTab("time")}
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  breakdownTab === "time"
                    ? "bg-white dark:bg-gray-700 text-emerald-700 dark:text-emerald-300 shadow-xs"
                    : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Time-Wise Breakdown (30d Intervals)</span>
              </button>
            </div>

            {breakdownTab === "forms" ? (
              <>
                {/* Form Wise Breakdown Header */}
                <div className="text-[10px] uppercase font-black tracking-wider text-gray-500 dark:text-gray-400 mb-2 flex items-center justify-between">
                  <span>Form-Wise Breakdown (Click a form to open exact filtered responses)</span>
                  <span>Count / Action</span>
                </div>

                {/* Clickable Form List */}
                <div className="max-h-72 overflow-y-auto space-y-2 pr-1 text-xs">
                  {pinnedBreakdown.forms.length === 0 ? (
                    <p className="text-xs text-gray-400 italic py-4 text-center">
                      No individual form breakdown available.
                    </p>
                  ) : (
                    pinnedBreakdown.forms.map((f, i) => {
                      const numCount = typeof f.count === "number" ? f.count : parseInt(String(f.count), 10) || 0;
                      const canOpen = Boolean(f.formId && f.formId !== "general_form" && numCount > 0);
                      const openFormResponses = () => {
                        if (!canOpen || !f.formId) return;
                        const q = new URLSearchParams();
                        q.set("tab", "responses");
                        q.set("metricLabel", pinnedBreakdown.metric);
                        if (effectiveStartDate) q.set("startDate", effectiveStartDate);
                        if (effectiveEndDate) q.set("endDate", effectiveEndDate);

                        const mk = pinnedBreakdown.metricKey;
                        const names = pinnedBreakdown.inspectorNames || [];
                        const isBiwMetric = ["BIW Total Reviewed", "BIWReviewed", "BIW Accepted", "BIWAccepted", "BIW Rejected", "BIWRejected", "BIW Reworked", "BIWReworked"].includes(mk);
                        const isReviewerCombined = ["Reviewed", "ReviewedTotal", "Pending", "ReviewedPending", "AcceptedReviewer", "ReviewedAccepted", "RejectedReviewer", "ReviewedRejected", "ReworkReviewer", "ReviewedRework"].includes(mk);

                        if (names.length > 0) {
                          if (isBiwMetric || (isReviewerCombined && (pinnedBreakdown.totalSubmitted || 0) === 0)) {
                            q.set("biwReviewedBy", names.join(","));
                          } else {
                            q.set("submittedBy", names.join(","));
                          }
                        }

                        if (mk === "Accepted" || mk === "InspectionAccepted") q.set("status", "accepted");
                        else if (mk === "Rework QC Pending" || mk === "ReworkPending") q.set("status", "rework");
                        else if (mk === "Rejected" || mk === "RejectedInspection") q.set("status", "rejected");
                        else if (mk === "Dispatch Pending" || mk === "DispatchPending") q.set("dispatch", "pending");
                        else if (mk === "Dispatched") q.set("dispatch", "dispatched");
                        else if (mk === "BIW Total Reviewed" || mk === "BIWReviewed") q.set("biwStatus", "reviewed");
                        else if (mk === "BIW Review Pending" || mk === "BIWPending") q.set("biwStatus", "pending");
                        else if (mk === "BIW Accepted" || mk === "BIWAccepted") q.set("biwStatus", "accepted");
                        else if (mk === "BIW Rejected" || mk === "BIWRejected") q.set("biwStatus", "rejected");
                        else if (mk === "BIW Reworked" || mk === "BIWReworked") q.set("biwStatus", "reworked");
                        else if (mk === "TVS Total Reviewed" || mk === "TVSReviewed") q.set("tvsStatus", "reviewed");
                        else if (mk === "TVS Review Pending" || mk === "TVSPending") q.set("tvsStatus", "pending");
                        else if (mk === "TVS Accepted" || mk === "TVSAccepted") q.set("tvsStatus", "accepted");
                        else if (mk === "TVS Rejected" || mk === "TVSRejected") q.set("tvsStatus", "rejected");
                        else if (mk === "TVS Rework" || mk === "TVSRework") q.set("tvsStatus", "rework");
                        else if (mk === "Reviewed" || mk === "ReviewedTotal") q.set("reviewedCombined", "reviewed");
                        else if (mk === "Pending" || mk === "ReviewedPending") q.set("reviewedCombined", "pending");
                        else if (mk === "AcceptedReviewer" || mk === "ReviewedAccepted") q.set("reviewedCombined", "accepted");
                        else if (mk === "RejectedReviewer" || mk === "ReviewedRejected") q.set("reviewedCombined", "rejected");
                        else if (mk === "ReworkReviewer" || mk === "ReviewedRework") q.set("reviewedCombined", "rework");

                        setPinnedBreakdown(null);
                        navigate(`/forms/${f.formId}/analytics?${q.toString()}`);
                      };

                      return (
                        <div
                          key={i}
                          onClick={canOpen ? openFormResponses : undefined}
                          className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border transition-all ${
                            canOpen
                              ? "bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:border-emerald-400 cursor-pointer group"
                              : "bg-gray-50/50 dark:bg-gray-800/30 border-gray-100 dark:border-gray-800 opacity-60"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-xs text-gray-900 dark:text-gray-100 truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                              {f.title}
                            </p>
                            {f.subDetail && (
                              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                                {f.subDetail}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-black text-sm tabular-nums text-emerald-700 dark:text-emerald-400">
                              {f.count}
                            </span>
                            {canOpen && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-bold group-hover:bg-emerald-700 shadow-xs">
                                View <ExternalLink className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Time Wise Breakdown Header */}
                <div className="text-[10px] uppercase font-black tracking-wider text-gray-500 dark:text-gray-400 mb-2 flex items-center justify-between">
                  <span>Time-Wise Breakdown (Click a 30-day bucket to view responses in that period)</span>
                  <span>Count / Action</span>
                </div>

                {/* Clickable Time List */}
                <div className="max-h-72 overflow-y-auto space-y-2 pr-1 text-xs">
                  {(!pinnedBreakdown.times || pinnedBreakdown.times.length === 0) ? (
                    <p className="text-xs text-gray-400 italic py-4 text-center">
                      No time-wise breakdown available for this date filter.
                    </p>
                  ) : (
                    pinnedBreakdown.times.map((t, i) => {
                      const numCount = typeof t.count === "number" ? t.count : parseInt(String(t.count), 10) || 0;
                      const canOpen = numCount > 0 && Boolean(t.startDate && t.endDate);

                      const openTimeResponses = () => {
                        if (!canOpen) return;
                        const targetFormId = (pinnedBreakdown.forms.find((f: any) => f.formId && f.formId !== "general_form")?.formId) || formId || (formIds && formIds[0]);
                        if (!targetFormId) return;

                        const q = new URLSearchParams();
                        q.set("tab", "responses");
                        q.set("metricLabel", pinnedBreakdown.metric);
                        if (t.startDate) q.set("startDate", t.startDate);
                        if (t.endDate) q.set("endDate", t.endDate);

                        const mk = pinnedBreakdown.metricKey;
                        const names = pinnedBreakdown.inspectorNames || [];
                        const isBiwMetric = ["BIW Total Reviewed", "BIWReviewed", "BIW Accepted", "BIWAccepted", "BIW Rejected", "BIWRejected", "BIW Reworked", "BIWReworked"].includes(mk);
                        const isReviewerCombined = ["Reviewed", "ReviewedTotal", "Pending", "ReviewedPending", "AcceptedReviewer", "ReviewedAccepted", "RejectedReviewer", "ReviewedRejected", "ReworkReviewer", "ReviewedRework"].includes(mk);

                        if (names.length > 0) {
                          if (isBiwMetric || (isReviewerCombined && (pinnedBreakdown.totalSubmitted || 0) === 0)) {
                            q.set("biwReviewedBy", names.join(","));
                          } else {
                            q.set("submittedBy", names.join(","));
                          }
                        }

                        if (mk === "Accepted" || mk === "InspectionAccepted") q.set("status", "accepted");
                        else if (mk === "Rework QC Pending" || mk === "ReworkPending") q.set("status", "rework");
                        else if (mk === "Rejected" || mk === "RejectedInspection") q.set("status", "rejected");
                        else if (mk === "Dispatch Pending" || mk === "DispatchPending") q.set("dispatch", "pending");
                        else if (mk === "Dispatched") q.set("dispatch", "dispatched");
                        else if (mk === "BIW Total Reviewed" || mk === "BIWReviewed") q.set("biwStatus", "reviewed");
                        else if (mk === "BIW Review Pending" || mk === "BIWPending") q.set("biwStatus", "pending");
                        else if (mk === "BIW Accepted" || mk === "BIWAccepted") q.set("biwStatus", "accepted");
                        else if (mk === "BIW Rejected" || mk === "BIWRejected") q.set("biwStatus", "rejected");
                        else if (mk === "BIW Reworked" || mk === "BIWReworked") q.set("biwStatus", "reworked");
                        else if (mk === "TVS Total Reviewed" || mk === "TVSReviewed") q.set("tvsStatus", "reviewed");
                        else if (mk === "TVS Review Pending" || mk === "TVSPending") q.set("tvsStatus", "pending");
                        else if (mk === "TVS Accepted" || mk === "TVSAccepted") q.set("tvsStatus", "accepted");
                        else if (mk === "TVS Rejected" || mk === "TVSRejected") q.set("tvsStatus", "rejected");
                        else if (mk === "TVS Rework" || mk === "TVSRework") q.set("tvsStatus", "rework");
                        else if (mk === "Reviewed" || mk === "ReviewedTotal") q.set("reviewedCombined", "reviewed");
                        else if (mk === "Pending" || mk === "ReviewedPending") q.set("reviewedCombined", "pending");
                        else if (mk === "AcceptedReviewer" || mk === "ReviewedAccepted") q.set("reviewedCombined", "accepted");
                        else if (mk === "RejectedReviewer" || mk === "ReviewedRejected") q.set("reviewedCombined", "rejected");
                        else if (mk === "ReworkReviewer" || mk === "ReviewedRework") q.set("reviewedCombined", "rework");

                        setPinnedBreakdown(null);
                        navigate(`/forms/${targetFormId}/analytics?${q.toString()}`);
                      };

                      return (
                        <div
                          key={i}
                          onClick={canOpen ? openTimeResponses : undefined}
                          className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-all ${
                            canOpen
                              ? "bg-emerald-50/40 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/80 hover:bg-emerald-100/50 dark:hover:bg-emerald-900/50 hover:border-emerald-500 cursor-pointer group"
                              : "bg-gray-50/50 dark:bg-gray-800/30 border-gray-100 dark:border-gray-800 opacity-60"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-xs text-gray-900 dark:text-gray-100 truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                              📅 {t.title}
                            </p>
                            {t.subDetail && (
                              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                                {t.subDetail}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-black text-sm tabular-nums text-emerald-700 dark:text-emerald-400">
                              {t.count}
                            </span>
                            {canOpen && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-bold group-hover:bg-emerald-700 shadow-xs">
                                View <ExternalLink className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceTable;
