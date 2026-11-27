import React, { useState, useEffect, useMemo, useRef, useCallback, useTransition, useDeferredValue } from "react";
import {
  useParams,
  useNavigate,
  useLocation,
  useSearchParams,
  Link,
} from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import CameraCapture from "../forms/CameraCapture";
import {
  exportDashboardToPDF,
  exportFormAnalyticsToPDF,
} from "../../utils/formanalyticsexport";
import {
  Users as UsersIcon,
  Search,
  CheckCircle,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Link2,
  Clock,
  XCircle,
  BarChart3,
  Calendar,
  FileText,
  ArrowLeft,
  TrendingUp,
  PieChart,
  Download,
  FileSpreadsheet,
  Table,
  Edit,
  Trash2,
  Eye,
  MoreHorizontal,
  X,
  Share2,
  Mail,
  Send,
  MessageCircle,
  Info,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Filter,
  Reply,
  Upload,
  Camera,
  Loader2,
  Maximize,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ClipboardCheck,
  LogIn,
  Check,
} from "lucide-react";
import { createPortal } from "react-dom";
import { Pie, Doughnut, Radar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  RadialLinearScale,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { apiClient } from "../../api/client";
import ResponseQuestion from "./ResponseQuestion";
import SectionAnalytics from "./SectionAnalytics";
import CascadingFilterModal, { getLast30DaysRange } from "./CascadingFilterModal";
import * as XLSX from "xlsx-js-style";
import { io } from "socket.io-client";
import { isImageUrl, formatToDDMMYYYY } from "../../utils/answerTemplateUtils";
import ImageLink from "../ImageLink";
import FilePreview from "../FilePreview";
import TableColumnFilter from "./TableColumnFilter";
import ShareAnalyticsModal from "./ShareAnalyticsModal";
import AutoSendModal from "../forms/AutoSendModal";
import { BiwReviewExcelModal } from "./BiwReviewExcelModal";
import { BiwImportHistoryModal } from "./BiwImportHistoryModal";
import PerformanceGuideModal from "./PerformanceGuideModal";
import { downloadBiwReviewTemplate } from "../../utils/biwReviewExcelUtils";

import { useTheme } from "../../context/ThemeContext";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  RadialLinearScale,
  ChartDataLabels,
);

import type {
  Response,
  Section,
  FollowUpQuestion,
  ChassisNumberEntry,
  Form,
  SectionPerformanceStat,
  QuestionPerformanceStat,
  SectionAnalyticsData,
  ZoneAnalyticsData,
  DailyPerformanceStat,
  SectionStat,
  FormAnalyticsDashboardProps,
} from "./dashboard/types";
import {
  getResponseTimestamp,
  toLocalDateString,
  getSectionQualityBreakdown,
  calculateOverallQuality,
  getZoneAnalytics,
  getSectionStats,
  formatSectionLabel,
  extractYesNoValues,
  recognizedYesNoValues,
  getRankStyle,
  getBiwPerformanceLabel,
  computeSectionPerformanceStats,
  computeQuestionPerformanceStats,
  computeDailyPerformanceStats,
  computeMonthlyPerformanceStats,
  computeDirectAcceptedDailyStats,
  computeDailyReworkVolumeStats,
  getSectionYesNoStats,
} from "./dashboard/utils/analyticsCalculations";
import { QuestionSuggestionRenderer } from "./dashboard/components/QuestionSuggestionRenderer";
import { renderMessageWithImages } from "./dashboard/utils/chatHelpers";
import { exportFormAnalyticsToExcel } from "./dashboard/export/formAnalyticsExcelExport";
import { OverallQualityPieChart as OverallQualityPieChartComponent } from "./dashboard/charts/OverallQualityPieChart";
import { QuestionStatusDistributionChart as QuestionStatusDistributionChartComponent } from "./dashboard/charts/QuestionStatusDistributionChart";
import { BiwDefectDistributionChart as BiwDefectDistributionChartComponent } from "./dashboard/charts/BiwDefectDistributionChart";
import { TvsDefectDistributionChart as TvsDefectDistributionChartComponent } from "./dashboard/charts/TvsDefectDistributionChart";
import { TimeBasedPerformanceGraph as TimeBasedPerformanceGraphComponent } from "./dashboard/charts/TimeBasedPerformanceGraph";
import { DirectAcceptedPerformanceGraph as DirectAcceptedPerformanceGraphComponent } from "./dashboard/charts/DirectAcceptedPerformanceGraph";
import { InspectionStatusLineChart as InspectionStatusLineChartComponent } from "./dashboard/charts/InspectionStatusLineChart";
import { PerformanceTableBarChart as PerformanceTableBarChartComponent } from "./dashboard/charts/PerformanceTableBarChart";
import { BiwReviewTableBarChart as BiwReviewTableBarChartComponent } from "./dashboard/charts/BiwReviewTableBarChart";
import { SummaryTable } from "./dashboard/tables/SummaryTable";
import { PerformanceTable } from "./dashboard/tables/PerformanceTable";
import { BiwReviewTable } from "./dashboard/tables/BiwReviewTable";
import { BiwBulkUpdateModal } from "./dashboard/modals/BiwBulkUpdateModal";
import { BiwReviewActionModal } from "./dashboard/modals/BiwReviewActionModal";
import { BiwReviewViewModal } from "./dashboard/modals/BiwReviewViewModal";
import { BulkDispatchConfirmModal } from "./dashboard/modals/BulkDispatchConfirmModal";
import { ActionMenuModal } from "./dashboard/modals/ActionMenuModal";
import { ChatDiscussionModal } from "./dashboard/modals/ChatDiscussionModal";
import { DeleteResponseConfirmModal } from "./dashboard/modals/DeleteResponseConfirmModal";
import { BulkDeleteConfirmModal } from "./dashboard/modals/BulkDeleteConfirmModal";
import { ToastNotification } from "./dashboard/components/ToastNotification";
import { AnalyticsHeader } from "./dashboard/components/AnalyticsHeader";
import { ComparisonView } from "./dashboard/components/ComparisonView";
import { ResponseDetailsModal } from "./dashboard/modals/ResponseDetailsModal";

export type { SectionAnalyticsData, ZoneAnalyticsData, FormAnalyticsDashboardProps };

// Module-level in-memory cache to enable 0ms instant dashboard switching between forms
const formAnalyticsMemoryCache = new Map<string, {
  form: any;
  responses: any[];
  tableResponses: any[];
  timestamp: number;
}>();

export default function FormAnalyticsDashboard({
  formId: propFormId,
  embedded = false,
  initialTab,
  externalDateRange,
  externalStatusSlice,
}: FormAnalyticsDashboardProps = {}) {
  const [selectedForm, setSelectedForm] = useState<Form | null>(null);

  const generateTableBarChart = (
    yesPercent: number,
    noPercent: number,
    naPercent: number,
  ) => {
    const totalWidth = 160;
    const yesWidth = (yesPercent / 100) * totalWidth;
    const noWidth = (noPercent / 100) * totalWidth;
    const naWidth = (naPercent / 100) * totalWidth;

    return (
      <div
        className="relative"
        style={{
          width: `${totalWidth}px`,
          height: "20px",
        }}
      >
        <div className="absolute inset-0 bg-gray-100 dark:bg-gray-700 rounded-sm border border-gray-300 dark:border-gray-600"></div>

        {yesPercent > 0 && (
          <div
            className="absolute left-0 h-full bg-green-500"
            style={{ width: `${yesWidth}px` }}
          >
            {yesPercent >= 10 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  className="text-xs font-bold text-white"
                  style={{
                    textShadow: "0 0 2px rgba(0,0,0,0.5)",
                  }}
                >
                  {yesPercent.toFixed(0)}%
                </span>
              </div>
            )}
          </div>
        )}

        {noPercent > 0 && (
          <div
            className="absolute h-full bg-red-500"
            style={{
              left: `${yesWidth}px`,
              width: `${noWidth}px`,
            }}
          >
            {noPercent >= 10 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  className="text-xs font-bold text-white"
                  style={{
                    textShadow: "0 0 2px rgba(0,0,0,0.5)",
                  }}
                >
                  {noPercent.toFixed(0)}%
                </span>
              </div>
            )}
          </div>
        )}

        {naPercent > 0 && (
          <div
            className="absolute h-full bg-gray-400"
            style={{
              left: `${yesWidth + noWidth}px`,
              width: `${naWidth}px`,
            }}
          >
            {naPercent >= 10 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  className="text-xs font-bold text-white"
                  style={{
                    textShadow: "0 0 2px rgba(0,0,0,0.5)",
                  }}
                >
                  {naPercent.toFixed(0)}%
                </span>
              </div>
            )}
          </div>
        )}

        {yesPercent > 0 && yesPercent < 10 && (
          <div className="absolute" style={{ left: "2px", top: "1px" }}>
            <span className="text-[9px] font-bold text-green-700 bg-white/80 px-0.5 rounded">
              {yesPercent.toFixed(0)}%
            </span>
          </div>
        )}
        {noPercent > 0 && noPercent < 10 && (
          <div
            className="absolute"
            style={{
              left: `${yesWidth + 2}px`,
              top: "1px",
            }}
          >
            <span className="text-[9px] font-bold text-red-700 bg-white/80 px-0.5 rounded">
              {noPercent.toFixed(0)}%
            </span>
          </div>
        )}
        {naPercent > 0 && naPercent < 10 && (
          <div
            className="absolute"
            style={{
              left: `${yesWidth + noWidth + 2}px`,
              top: "1px",
            }}
          >
            <span className="text-[9px] font-bold text-gray-700 bg-white/80 px-0.5 rounded">
              {naPercent.toFixed(0)}%
            </span>
          </div>
        )}
      </div>
    );
  };
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<
    number | null
  >(null);
  const { darkMode } = useTheme();
  const { user } = useAuth();
  const isInspector = user?.role === "inspector";

  // Guest mode detection
  const isGuest = useMemo(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return (
      searchParams.get("guest") === "true" ||
      !!localStorage.getItem("guest_auth_token")
    );
  }, []);

  const canBulkSelectResponses =
    !isGuest && (user?.role === "superadmin" || user?.role === "admin" || user?.role === "subadmin" || user?.role === "tenant_admin");


  // Using module-level formAnalyticsMemoryCache for instant switching

  const { id: paramId } = useParams<{ id: string }>();
  const id = propFormId || paramId;
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Permission check for analytics tabs
  const hasTabPermission = (tabName: string): boolean => {
    // Admin, superadmin, tenant_admin, and subadmin bypass - see all tabs
    if (
      user?.role === "admin" ||
      user?.role === "superadmin" ||
      user?.role === "tenant_admin" ||
      user?.role === "subadmin"
    ) {
      return true;
    }

    // Default core tabs (dashboard, responses, preview) are always accessible to anyone viewing this form
    if (tabName === "dashboard" || tabName === "responses" || tabName === "preview") {
      return true;
    }

    // Non-admin / non-superadmin users need explicit permissions for granular sub-tabs
    if (!id || !form) return false;

    // Map the component's tab name to the permission tree suffix.
    // The permission tree (permissionTree.ts) uses: dashboard, response,
    // overall, questions, sections
    const suffixMap: Record<string, string> = {
      dashboard: "dashboard",
      question: "questions",
      section: "sections",
      overall: "overall",
      responses: "response",
      preview: "preview",
    };
    const suffix = suffixMap[tabName];
    if (!suffix) return false;

    // Preview tab is available by default for all users
    if (suffix === "preview") {
      return true;
    }

    const perms = user?.permissions;
    if (!perms || !Array.isArray(perms) || perms.length === 0) return false;

    // Try both URL param id and form's actual _id to handle MongoDB _id mismatch
    const formIdsToCheck = [id];
    if (form._id && form._id !== id) {
      formIdsToCheck.push(form._id);
    }
    if (form.id && form.id !== id && form.id !== form._id) {
      formIdsToCheck.push(form.id);
    }

    // Check if user has permission for ANY of the possible form IDs
    return formIdsToCheck.some((formId) => {
      const leafPermission = `analytics:form:${formId}:${suffix}`;
      const parentPermission = `analytics:form:${formId}`;
      const wildcardPermission = "analytics:*";

      return (
        perms.includes(leafPermission) ||
        perms.includes(parentPermission) ||
        perms.includes(wildcardPermission) ||
        perms.includes("analytics:view")
      );
    });
  };




  const handleLogout = () => {
    if (isGuest) {
      localStorage.removeItem("guest_auth_token");
      localStorage.removeItem("guest_email");
      localStorage.removeItem("guest_form_id");
      localStorage.removeItem("guest_expires_at");
      navigate(`/forms/${id}/analytics/login`);
    }
  };

  const handleShareAnalytics = () => {
    if (id) {
      setShareAnalyticsModal({
        open: true,
        formId: id,
        formTitle: form?.title || "Form Analytics",
      });
    }
  };

  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const handleAutoSendSetup = () => {
    if (id) {
      setAutoSendModal({
        open: true,
        formId: id,
        formTitle: form?.title || "Form Analytics",
      });
    }
  };

  const [responses, setResponses] = useState<Response[]>(() => {
    if (!id) return [];
    const mem = formAnalyticsMemoryCache.get(id);
    if (mem?.responses && mem.responses.length > 0) return mem.responses;
    try {
      const stored = sessionStorage.getItem(`form_analytics_cache_${id}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.responses && parsed.responses.length > 0) {
          formAnalyticsMemoryCache.set(id, parsed);
          return parsed.responses;
        }
      }
    } catch (_) { }
    return [];
  });
  const [form, setForm] = useState<Form | null>(() => {
    if (!id) return null;
    const mem = formAnalyticsMemoryCache.get(id);
    if (mem?.form) return mem.form;
    try {
      const stored = sessionStorage.getItem(`form_analytics_cache_${id}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.form) return parsed.form;
      }
    } catch (_) { }
    return null;
  });
  const [loading, setLoading] = useState(() => {
    if (!id) return true;
    const mem = formAnalyticsMemoryCache.get(id);
    if (mem?.form) return false;
    try {
      const stored = sessionStorage.getItem(`form_analytics_cache_${id}`);
      if (stored) return false;
    } catch (_) { }
    return true;
  });
  const [isExporting, setIsExporting] = useState(false);
  const [isBiwExcelModalOpen, setIsBiwExcelModalOpen] = useState(false);
  const [isBiwDropdownOpen, setIsBiwDropdownOpen] = useState(false);
  const biwDropdownRef = useRef<HTMLDivElement>(null);

  // Close BIW dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (biwDropdownRef.current && !biwDropdownRef.current.contains(event.target as Node)) {
        setIsBiwDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [tenantsMap, setTenantsMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let mounted = true;
    apiClient
      .getTenantsMinimal()
      .then((res: any) => {
        if (!mounted) return;
        const list = res?.tenants || res?.data?.tenants || [];
        const map = new Map<string, string>();
        list.forEach((t: any) => {
          const id = String(t._id || t.id || "");
          const name = t.companyName || t.name || t.slug;
          if (id && name) map.set(id, name);
        });
        setTenantsMap(map);
      })
      .catch((err) => console.warn("Could not load tenants for template labels:", err));
    return () => {
      mounted = false;
    };
  }, []);

  const resolveDocTenantName = useCallback((doc: any): string => {
    if (!doc) return "";
    if (typeof doc.tenantId === "object" && doc.tenantId) {
      const t = doc.tenantId;
      const n = t.companyName || t.name || t.title || t.slug;
      if (n) return String(n).trim();
    }
    const tId = String(doc.tenantId || "");
    if (tId && tenantsMap.has(tId)) {
      return tenantsMap.get(tId) || "";
    }
    if (doc.tenantName) return String(doc.tenantName).trim();
    if (doc.organizationName) return String(doc.organizationName).trim();
    if (Array.isArray(doc.chassisTenantAssignments)) {
      for (const a of doc.chassisTenantAssignments) {
        if (Array.isArray(a.assignedTenants)) {
          for (const tid of a.assignedTenants) {
            const strId = String(typeof tid === "object" && tid ? (tid._id || tid.id) : tid);
            if (strId && tenantsMap.has(strId)) return tenantsMap.get(strId) || "";
          }
        }
      }
    }
    const title = String(doc.title || "").trim();
    const parts = title.split(/\s+/);
    const last = parts[parts.length - 1];
    if (last && last.length >= 2 && last.length <= 15 && !/^\d+$/.test(last)) {
      return last;
    }
    return "";
  }, [tenantsMap]);

  // Downloads BIW template pre-loaded with filtered or full all-time table chassis, BIW reviews & TVS reviews
  const handleDownloadBiwTemplate = async (mode: "filtered" | "all" = "filtered") => {
    setIsExporting(true);
    const isFilteredMode = mode === "filtered";
    showToast(
      isFilteredMode
        ? "Preparing Filtered BIW Review Excel template..."
        : "Preparing Full All-Time BIW Review Excel template...",
      "info"
    );
    try {
      let activeResponsesSource: any[] = [];
      const hasExplicitSelection =
        isFilteredMode &&
        ((selectedResponseIds && selectedResponseIds.length > 0) ||
          (selectedBiwIds && selectedBiwIds.length > 0));
      const activeSelectionIds =
        selectedResponseIds && selectedResponseIds.length > 0
          ? selectedResponseIds
          : selectedBiwIds || [];

      let preloadedRelatedExport: any[] | null = null;

      if (hasExplicitSelection) {
        // User specifically selected response checkboxes -> only include selected rows
        activeResponsesSource = (filteredResponses || responses || tableResponses || []).filter((r: any) =>
          activeSelectionIds.includes(String(r._id || r.id))
        );
      } else {
        const targetFormId = String(id || (form as any)?._id || (form as any)?.id || propFormId || "");
        const exportParams: any = {};
        if (isFilteredMode && dateFilter && dateFilter.type !== "all") {
          if (dateFilter.startDate) exportParams.startDate = dateFilter.startDate;
          if (dateFilter.endDate) exportParams.endDate = dateFilter.endDate;
        }

        const expectedTotal = totalResponsesCount || 0;

        const isChildCheck = Boolean(
          (form as any)?.isFollowUpForm ||
          (form as any)?.parentFormId ||
          form?.parentForm ||
          relatedFormData.parentForm
        );
        const resolvedMainCheck = isChildCheck ? (form?.parentForm || relatedFormData.parentForm || form) : form;
        const firstChildCandidate = (form?.childForms && form.childForms.length > 0)
          ? form.childForms[0]
          : (relatedFormData.childForms?.[0] || null);
        const resolvedChildCheck = isChildCheck ? form : firstChildCandidate;
        const resolvedMainIdCheck = String((resolvedMainCheck as any)?._id || (resolvedMainCheck as any)?.id || "");
        const resolvedChildIdCheck = String(
          (resolvedChildCheck as any)?.formId ||
          (resolvedChildCheck as any)?._id ||
          (resolvedChildCheck as any)?.id ||
          ""
        );

        // Concurrently fetch parent or child export cleanly without truncating mid-stream
        let relatedExportPromise: Promise<any[]> | null = null;
        if (isChildCheck && resolvedMainIdCheck && resolvedMainIdCheck !== targetFormId) {
          relatedExportPromise = apiClient.getAllResponsesForExport(resolvedMainIdCheck, exportParams).catch(() => []);
        } else if (resolvedChildCheck && resolvedChildIdCheck && resolvedChildIdCheck !== targetFormId) {
          relatedExportPromise = apiClient.getAllResponsesForExport(resolvedChildIdCheck, exportParams).catch(() => []);
        }

        // Only use in-memory responses when the full dataset is confirmed loaded; otherwise fetch all pages
        const hasFullInMemory =
          expectedTotal > 0 &&
          responses &&
          responses.length >= expectedTotal &&
          !analyticsResponsesLoading &&
          (isFilteredMode || dateFilter.type === "all");

        if (hasFullInMemory) {
          activeResponsesSource = isFilteredMode ? filteredResponses : responses;
          if (relatedExportPromise) {
            try {
              preloadedRelatedExport = await relatedExportPromise;
            } catch (_) {}
          }
        } else if (targetFormId) {
          try {
            const [exportData, relatedData] = await Promise.all([
              apiClient.getAllResponsesForExport(targetFormId, exportParams),
              relatedExportPromise ? relatedExportPromise : Promise.resolve([])
            ]);
            preloadedRelatedExport = relatedData;
            if (exportData && exportData.length > 0) {
              activeResponsesSource = exportData;
            }
          } catch (e) {
            console.warn("[handleDownloadBiwTemplate] Error fetching responses:", e);
          }
        }

        // Fallback to in-memory responses if export call returns empty
        if (!activeResponsesSource || activeResponsesSource.length === 0) {
          activeResponsesSource = isFilteredMode
            ? (filteredResponses && filteredResponses.length > 0
                ? filteredResponses
                : responses && responses.length > 0
                  ? responses
                  : tableResponses && tableResponses.length > 0
                    ? tableResponses
                    : [])
            : (responses && responses.length > 0
                ? responses
                : tableResponses && tableResponses.length > 0
                  ? tableResponses
                  : []);
        }

        if (isFilteredMode) {
          // 1. Strictly enforce active date range (e.g. 30-day filter)
          if (dateFilter && dateFilter.type !== "all" && (dateFilter.startDate || dateFilter.endDate)) {
            activeResponsesSource = activeResponsesSource.filter((r: any) => {
              const raw = r.submittedAt || r.createdAt || r.timestamp;
              if (!raw) return true;
              let dStr = "";
              if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}/.test(raw)) {
                dStr = raw.substring(0, 10);
              } else {
                const d = new Date(raw);
                if (!isNaN(d.getTime())) {
                  dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                }
              }
              if (dateFilter.startDate && dStr && dStr < dateFilter.startDate) return false;
              if (dateFilter.endDate && dStr && dStr > dateFilter.endDate) return false;
              return true;
            });
          }

          // 2. Apply targetUnitsSet, inspector filter, search query, and active column filters (TVS Review, Dispatch, Status, BIW Review, etc.)
          if (targetUnitsSet.size > 0) {
            activeResponsesSource = activeResponsesSource.filter((r: any) => {
              const unitId = (getChassisOrItemId(r, chassisQuestionId) || "").toLowerCase().trim();
              if (unitId && targetUnitsSet.has(unitId)) return true;
              const fallbackCh = String(r.chassisNumber || "").toLowerCase().trim();
              return fallbackCh ? targetUnitsSet.has(fallbackCh) : false;
            });
          }

          if (selectedInspectorForTrend !== "Overall") {
            activeResponsesSource = activeResponsesSource.filter(
              (r: any) => r.submittedBy === selectedInspectorForTrend
            );
          }

          if (deferredSearchTerm.trim() !== "") {
            const term = deferredSearchTerm.toLowerCase().trim();
            activeResponsesSource = activeResponsesSource.filter((response: any) => {
              const submitter = (response.submittedBy || response.createdBy || "").toLowerCase();
              if (submitter.includes(term)) return true;
              const status = (responseStatuses[response.id] || "").toLowerCase();
              if (status.includes(term)) return true;
              const chResolved = getResponseChassisValue(response);
              if (chResolved && chResolved !== "-" && chResolved.toLowerCase().includes(term)) return true;
              if (response.chassisNumber && String(response.chassisNumber).toLowerCase().includes(term)) return true;
              if (response.answers) {
                for (const val of Object.values(response.answers)) {
                  if (val === null || val === undefined) continue;
                  const valStr = typeof val === "object" ? JSON.stringify(val).toLowerCase() : String(val).toLowerCase();
                  if (valStr.includes(term)) return true;
                }
              }
              return false;
            });
          }

          const activeColFilters = Object.entries(columnFilters).filter(
            ([, values]) => Boolean(values && values.length > 0)
          );
          if (activeColFilters.length > 0) {
            activeResponsesSource = activeResponsesSource.filter((response: any) =>
              activeColFilters.every(([columnId, allowedValues]) =>
                matchSingleColumnFilter(response, columnId, allowedValues || [])
              )
            );
          }
        }

        // Exclude active rework statuses (e.g. "Rework 1", "Rework 2", "Rework") from BIW template download,
        // while keeping "Rework Accepted", "Direct Ok", "Accepted", and dispatched units
        const hasExplicitStatusFilter = Boolean(columnFilters["__status"] && columnFilters["__status"].length > 0);
        if (!isFilteredMode || !hasExplicitStatusFilter) {
          const nonReworkResponses = activeResponsesSource.filter((r: any) => {
            if (!r) return false;
            if (r.isDispatched) return true;
            const computed = String(
              responseStatuses?.[r._id || r.id] ||
              computeFastRowStatus(r, chassisQuestionId) ||
              r.status ||
              ""
            ).toLowerCase().trim();
            return !(computed.includes("rework") && !computed.includes("accept"));
          });
          if (nonReworkResponses.length > 0) {
            activeResponsesSource = nonReworkResponses;
          }
        }

        if (isFilteredMode && hasActiveFiltersOrSort && (!activeResponsesSource || activeResponsesSource.length === 0)) {
          showToast("No responses match the current active filters.", "warning");
          setIsExporting(false);
          return;
        }
      }

      // Detect chassis question ID directly from form template if available
      let detectedChassisQId: string | null = null;
      if (form?.sections) {
        for (const sec of form.sections) {
          for (const q of (sec.questions || [])) {
            if (
              (q.trackResponseRank === true ||
                q.trackResponseRank === "true" ||
                q.trackResponseQuestion === true ||
                q.trackResponseQuestion === "true" ||
                q.isTrackingNumber === true ||
                q.isChassisQuestion === true ||
                q.type === "chassisNumber") &&
              q.type !== "zone-in" &&
              q.type !== "zone-out"
            ) {
              detectedChassisQId = q.id;
              break;
            }
          }
          if (detectedChassisQId) break;
        }
        if (!detectedChassisQId) {
          for (const sec of form.sections) {
            for (const q of (sec.questions || [])) {
              const t = String(q.text || q.title || q.label || "").toLowerCase();
              if (
                (t.includes("chassis") || t.includes("vin") || t.includes("identification")) &&
                q.type !== "zone-in" &&
                q.type !== "zone-out"
              ) {
                detectedChassisQId = q.id;
                break;
              }
            }
            if (detectedChassisQId) break;
          }
        }
      }

      const ignoredUnits = ["TVS", "EXCEL IMPORT", "SAIFY", "SRIDEVI", "SREEDEVI", "LMPL"];
      const targetChassis = (activeResponsesSource || [])
        .map((r) => {
          const a = r.answers || {};
          const qIdToCheck = detectedChassisQId;
          const tracked = qIdToCheck ? a[qIdToCheck] : null;
          const trackedVal =
            typeof tracked === "object"
              ? tracked?.chassisNumber || tracked?.value || tracked?.label
              : tracked;
          if (trackedVal && !ignoredUnits.includes(String(trackedVal).trim().toUpperCase())) {
            return String(trackedVal).trim();
          }

          // Candidate keys
          const candidateKeys = [
            "Identification no", "identification no", "Identification No",
            "chassisNumber", "chassis_number", "Chassis Number", "CHASSIS NUMBER",
            "Chassis / VIN", "VIN", "vin", "id_number", "idNumber", "ID Number",
            "cha", "che"
          ];
          for (const k of candidateKeys) {
            if (a[k]) {
              const v = typeof a[k] === "object" ? a[k]?.chassisNumber || a[k]?.value || a[k]?.label : a[k];
              const s = String(v || "").trim();
              if (s && !ignoredUnits.includes(s.toUpperCase())) {
                return s;
              }
            }
          }

          // Scan all answers for alphanumeric with digit
          for (const v of Object.values(a)) {
            if (typeof v === "string" || typeof v === "number") {
              const s = String(v).trim();
              if (
                s.length >= 2 && s.length <= 30 &&
                /\d/.test(s) &&
                !/^\d{4}-\d{2}-\d{2}/.test(s) &&
                !s.startsWith("http") &&
                !s.startsWith("data:") &&
                !ignoredUnits.includes(s.toUpperCase()) &&
                !["OK", "NOT OK", "PASS", "FAIL", "REWORK", "REJECT", "REJECTED", "ACCEPTED", "YES", "NO"].includes(s.toUpperCase())
              ) {
                return s;
              }
            }
          }

          const fallback =
            (r.systemChassisNumber && !ignoredUnits.includes(String(r.systemChassisNumber).trim().toUpperCase())
              ? r.systemChassisNumber
              : "") ||
            (r.chassisNumber && !ignoredUnits.includes(String(r.chassisNumber).trim().toUpperCase())
              ? r.chassisNumber
              : "");
          return String(fallback || "").trim();
        })
        .filter((c) => Boolean(c) && !ignoredUnits.includes(c.toUpperCase()));

      const isChild = Boolean(
        (form as any)?.isFollowUpForm ||
        (form as any)?.parentFormId ||
        form?.parentForm ||
        relatedFormData.parentForm
      );

      let mainDoc = isChild ? (form?.parentForm || relatedFormData.parentForm || form) : form;

      if (targetChassis.length === 0 && (form?.chassisNumbers || (mainDoc as any)?.chassisNumbers)) {
        const rawChList = (form?.chassisNumbers || (mainDoc as any)?.chassisNumbers || []);
        rawChList.forEach((c: any) => {
          const val = typeof c === "string" ? c : c?.chassisNumber || c?.name;
          if (val && !ignoredUnits.includes(String(val).trim().toUpperCase())) {
            targetChassis.push(String(val).trim());
          }
        });
      }

      if (isChild && (!mainDoc || mainDoc === form || !mainDoc.sections?.length) && (form as any)?.parentFormId) {
        try {
          const parentRes = await apiClient.request<{ form: any }>(`/forms/${(form as any).parentFormId}`);
          if (parentRes?.form) {
            mainDoc = parentRes.form;
          }
        } catch (_) { }
      }

      let targetTenantDoc = isChild ? form : (relatedFormData.childForms?.[0] || null);
      if (!isChild && form?.childForms?.[0]) {
        const cId = form.childForms[0].formId || form.childForms[0].id || form.childForms[0]._id;
        if (cId && (!targetTenantDoc || !targetTenantDoc.sections?.length)) {
          try {
            const childRes = await apiClient.request<{ form: any }>(`/forms/${cId}`);
            if (childRes?.form) {
              targetTenantDoc = childRes.form;
            }
          } catch (_) { }
        }
      }

      let detectedTenant = "";
      for (const r of activeResponsesSource) {
        const candidate = r.systemChassisNumber || r.rawChassisNumber || r.chassisNumber || r.plant || r.tenantName || r.answers?.chassis_number;
        if (typeof candidate === "string" && ["Saify", "LMPL", "Sreedevi", "TVS", "Nahars"].some(t => t.toLowerCase() === candidate.trim().toLowerCase())) {
          detectedTenant = candidate.trim().toUpperCase() === "SAIFY" ? "Saify" : candidate.trim().toUpperCase() === "LMPL" ? "LMPL" : candidate.trim();
          break;
        }
      }

      const targetTenantName = resolveDocTenantName(targetTenantDoc);
      const isSaifyForm =
        detectedTenant === "Saify" ||
        targetTenantName === "Saify" ||
        String(form?.title || "").toLowerCase().includes("saify") ||
        String(targetTenantDoc?.title || "").toLowerCase().includes("saify");

      const mainTenantName = isSaifyForm ? "Saify" : (detectedTenant || resolveDocTenantName(mainDoc) || "Saify");

      const mainTitle = isChild
        ? (mainDoc?.title || (form as any)?.parentFormTitle || "Main Form")
        : (form?.title || "Main Form");

      const targetTitle = isChild
        ? (form?.title || "Child Form")
        : (targetTenantDoc?.title || "");

      const tenantEmployeesMap: Record<string, string[]> = {
        Saify: [
          "Thowseef Imran",
          "Vikram B",
          "Thilak S",
          "Govindaraj R",
          "Magendiran P",
          "Divya M",
          "Saify admin",
          "vik v",
          "Ramachandran M"
        ],
        LMPL: [
          "Manoj Mohan",
          "Sathiya Seelan A",
          "Gokula Krishnan R",
          "Naveen kumar K",
          "Irfan Khan D",
          "Karthikeyan K",
          "Vinu B",
          "Nanmaran E",
          "Praveen Kumar G",
          "Velmurugan E",
          "Thilak Thilak",
          "Ajith Kumar"
        ],
        Sreedevi: [
          "Shivaliingam N",
          "Saravanan L",
          "Ranjith S",
          "Sree sree",
          "Krishna kanth",
          "Jayaprakash J",
          "Sanjai S",
          "Kishore L",
          "Sreedevi Admin"
        ],
        "TVS 3W": ["TVS 3W", "Vignesh Vignesh", "Focus c"],
        Nahars: ["Nahars admin", "Nayeemuddin N", "Nanmaran Nanmaran", "Vinu Nahars"]
      };

      const assignedTenantStaff =
        tenantEmployeesMap[mainTenantName] ||
        tenantEmployeesMap["Saify"] ||
        [];

      const reviewerOptionsList = Array.from(new Set(assignedTenantStaff));

      const dateRangeParams: any = {};
      if (dateFilter && dateFilter.type !== "all") {
        if (dateFilter.startDate) dateRangeParams.startDate = dateFilter.startDate;
        if (dateFilter.endDate) dateRangeParams.endDate = dateFilter.endDate;
      }

      const extractChassisKey = (r: any): string => {
        const a = r?.answers || {};
        const candidates = [
          r?.systemChassisNumber,
          r?.chassisNumber,
          detectedChassisQId ? a[detectedChassisQId] : null,
          a["chassis_number"],
          a["chassisNumber"],
          a["Chassis Number"],
          a["Identification no"],
          a["identification no"]
        ];
        for (const cand of candidates) {
          const val = typeof cand === "object" ? cand?.chassisNumber || cand?.value || cand?.label : cand;
          const s = String(val || "").trim();
          if (s && !ignoredUnits.includes(s.toUpperCase())) return s;
        }
        return "";
      };

      const indexResponsesByChassis = (list: any[]) => {
        const map: Record<string, any> = {};
        list.forEach((item: any) => {
          const ch = extractChassisKey(item);
          if (!ch) return;
          const norm = ch.toUpperCase();
          const stripped = norm.replace(/\s+/g, "");
          const existing = map[norm];
          const hasRev = Boolean(item?.review?.reviewOption || item?.review?.status);
          const exHasRev = Boolean(existing?.review?.reviewOption || existing?.review?.status);
          const curTime = new Date(item?.updatedAt || item?.createdAt || item?.submittedAt || 0).getTime();
          const exTime = new Date(existing?.updatedAt || existing?.createdAt || existing?.submittedAt || 0).getTime();
          if (!existing || (hasRev && !exHasRev) || (hasRev === exHasRev && curTime > exTime)) {
            map[ch] = item;
            map[norm] = item;
            map[stripped] = item;
          }
        });
        return map;
      };

      let resolvedMainResponses = activeResponsesSource;
      let resolvedChildResponses: Record<string, any> = isFilteredMode
        ? {}
        : { ...(relatedFormData.childResponses || {}) };

      const currentId = String(id || (form as any)?._id || (form as any)?.id || "");
      const mainId = String((mainDoc as any)?._id || (mainDoc as any)?.id || "");
      const childId = String((targetTenantDoc as any)?._id || (targetTenantDoc as any)?.id || "");

      if (isChild) {
        // activeResponsesSource holds the child (2nd) form's responses.
        // In filtered mode, strictly reflect the filtered child rows so blank/pending TVS reviews
        // are not overwritten by stale or other submissions in relatedFormData.childResponses.
        resolvedChildResponses = isFilteredMode
          ? indexResponsesByChassis(activeResponsesSource)
          : {
              ...resolvedChildResponses,
              ...indexResponsesByChassis(activeResponsesSource)
            };
        if (mainId && mainId !== currentId) {
          try {
            const parentExport = (preloadedRelatedExport && preloadedRelatedExport.length > 0)
              ? preloadedRelatedExport
              : await apiClient.getAllResponsesForExport(mainId, dateRangeParams);
            const parentList = Array.isArray(parentExport) ? parentExport : [];
            if (parentList.length > 0) {
              const parentByCh = indexResponsesByChassis(parentList);
              // Keep all chassis from activeResponsesSource (the user's current form & date range),
              // enriched with parent form's BIW & 1st TVS review data
              resolvedMainResponses = activeResponsesSource.map((childR: any) => {
                const ch = extractChassisKey(childR);
                const norm = ch.toUpperCase();
                const parentMatch = ch ? (parentByCh[norm] || parentByCh[norm.replace(/\s+/g, "")]) : null;
                if (parentMatch) {
                  return {
                    ...parentMatch,
                    submittedAt: childR.submittedAt || parentMatch.submittedAt,
                    createdAt: childR.createdAt || parentMatch.createdAt,
                    childResponse: childR,
                    childReview: childR.review || (isFilteredMode ? null : parentMatch.childReview)
                  };
                }
                return {
                  ...childR,
                  review: childR.parentReview || childR.followUpStatus?.parentReview || null,
                  biwReview: childR.parentBiwReview || childR.biwReview || null,
                  childResponse: childR,
                  childReview: childR.review
                };
              });
            }
          } catch (_) { }
        }
      } else if (targetTenantDoc && childId && childId !== currentId) {
        try {
          const childExport = (preloadedRelatedExport && preloadedRelatedExport.length > 0)
            ? preloadedRelatedExport
            : await Promise.race([
                apiClient.getAllResponsesForExport(childId, dateRangeParams),
                new Promise<any[]>((r) => setTimeout(() => r([]), 8000))
              ]);
          const childList = Array.isArray(childExport) ? childExport : [];
          if (childList.length > 0) {
            resolvedChildResponses = {
              ...resolvedChildResponses,
              ...indexResponsesByChassis(childList)
            };
          }
        } catch (_) { }
      }

      showToast("Generating BIW Excel file...", "info");

      await downloadBiwReviewTemplate({
        form: mainDoc,
        formTitle: mainTitle,
        mainTenantName,
        chassisNumbers: targetChassis,
        responses: resolvedMainResponses,
        reviewerOptions: reviewerOptionsList,
        targetTenantForm: targetTenantDoc,
        targetTenantTitle: targetTitle,
        targetTenantName,
        childResponses: resolvedChildResponses,
        filename: `BIW Review Template${isFilteredMode && hasActiveFiltersOrSort ? " - Filtered" : mode === "all" ? " - All Time" : ""} - ${(form?.title || "Inspection").replace(/[^a-zA-Z0-9_-]/g, "_")}.xlsx`
      });
      showToast("BIW Review template downloaded successfully!", "success");
    } catch (err: any) {
      console.error("[handleDownloadBiwTemplate] Error:", err);
      showToast(`Failed to generate template: ${err.message || err}`, "error");
    } finally {
      setIsExporting(false);
    }
  };
  const [isBulkDispatching, setIsBulkDispatching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
    id: string;
  } | null>(null);

  const showToast = (
    message: string,
    type: "success" | "error" | "info" = "success",
  ) => {
    const id = Date.now().toString();
    setToast({ message, type, id });
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };
  const [autoOpenSectionId, setAutoOpenSectionId] = useState<string | null>(
    null,
  );

  const [showParentMatchColumn, setShowParentMatchColumn] = useState<boolean>(() => {
    try {
      const formKey = id || "default";
      const saved = localStorage.getItem(`show_parent_match_${formKey}`);
      if (saved !== null) {
        return saved === "true";
      }
    } catch (e) { }
    return false;
  });

  const [tvsReviews, setTvsReviews] = useState<any[]>([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [analyticsView, setAnalyticsView] = useState<"responses" | "dashboard">(() => {
    if (initialTab && ["responses", "dashboard"].includes(initialTab)) {
      return initialTab;
    }
    const tabParam = new URLSearchParams(window.location.search).get("tab");
    if (tabParam && ["responses", "dashboard"].includes(tabParam)) {
      return tabParam as any;
    }
    return "dashboard";
  });

  const handleTabSwitch = useCallback((newTab: "dashboard" | "responses") => {
    setAnalyticsView(newTab);
    setActiveTab(newTab);
    const params = new URLSearchParams(location.search);
    params.set("tab", newTab);
    navigate({
      pathname: location.pathname,
      search: `?${params.toString()}`
    }, { replace: true });
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    if (initialTab && ["responses", "dashboard"].includes(initialTab)) {
      setAnalyticsView(initialTab);
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && ["responses", "dashboard"].includes(tabParam)) {
      setAnalyticsView(tabParam as any);
      setActiveTab(tabParam as any);
    }
  }, [searchParams]);

  const fetchedReviewIdsSetRef = useRef<Set<string>>(new Set());

  // Reset fetched review cache on form change
  useEffect(() => {
    fetchedReviewIdsSetRef.current.clear();
    setTvsReviews([]);
  }, [id]);

  useEffect(() => {
    if (responses.length === 0) return;

    const candidateIds = Array.from(
      new Set(
        responses
          .map((r: any) => String(r?.id || r?._id || ""))
          .filter(Boolean)
      )
    );

    const missingIds = candidateIds.filter((respId) => !fetchedReviewIdsSetRef.current.has(respId));
    if (missingIds.length === 0) return;

    // Mark missing IDs as fetched immediately to prevent redundant calls
    missingIds.forEach((respId) => fetchedReviewIdsSetRef.current.add(respId));

    const fetchBulkReviews = async () => {
      try {
        setIsLoadingReviews(true);
        // Process in chunks of 200
        for (let i = 0; i < missingIds.length; i += 200) {
          const chunk = missingIds.slice(i, i + 200);
          const data = await apiClient.request<any>("/responses/reviews/bulk", {
            method: "POST",
            body: JSON.stringify({ responseIds: chunk }),
          });

          const reviewsList = Array.isArray(data) ? data : (data?.data || []);
          if (reviewsList.length > 0) {
            setTvsReviews((prev) => {
              const map = new Map();
              prev.forEach((r: any) => map.set(String(r.responseId || r.response_id || r.id || r._id), r));
              reviewsList.forEach((r: any) => map.set(String(r.responseId || r.response_id || r.id || r._id), r));
              return Array.from(map.values());
            });
          }
        }
      } catch (err) {
        console.error("Error fetching bulk TVS reviews:", err);
      } finally {
        setIsLoadingReviews(false);
      }
    };

    fetchBulkReviews();
  }, [responses.length, id]);

  const getChassisDisplayValue = (value: any): string => {
    if (!value) return "-";
    if (typeof value === "object") {
      if (value.chassisNumber !== undefined && value.chassisNumber !== null) {
        return value.partDescription
          ? `${value.chassisNumber} — ${value.partDescription}`
          : String(value.chassisNumber);
      }
      if (value.value !== undefined && value.value !== null && typeof value.value !== "object") {
        return String(value.value);
      }
      // If it's a defect inspection object (with status, remark, evidenceUrl), it's NOT a chassis!
      if (value.status !== undefined || value.remark !== undefined || value.evidenceUrl !== undefined || value.defect !== undefined) {
        return "-";
      }
      return "-";
    }
    const str = String(value).trim();
    if (str.startsWith("{") && str.endsWith("}")) {
      try {
        const parsed = JSON.parse(str);
        if (parsed.chassisNumber) return String(parsed.chassisNumber);
        if (parsed.value) return String(parsed.value);
        if (parsed.status !== undefined) return "-";
      } catch { }
    }
    return str;
  };

  const chassisQuestionId = useMemo(() => {
    if (!form?.sections) {
      return null;
    }
    // Priority 1: Explicit tracking flag (exclude defect inspection questions like zone-in / zone-out)
    for (const section of form.sections) {
      if (section.questions) {
        for (const q of section.questions) {
          if (
            (q.trackResponseRank === true ||
              q.trackResponseRank === "true" ||
              q.trackResponseQuestion === true ||
              q.trackResponseQuestion === "true") &&
            q.type !== "zone-in" &&
            q.type !== "zone-out"
          ) {
            return q.id;
          }
        }
      }
    }
    // Priority 2: Question title/text explicitly mentioning Chassis, VIN, or ID Number (exclude defect inspection questions)
    for (const section of form.sections) {
      if (section.questions) {
        for (const q of section.questions) {
          const t = q.text?.toLowerCase() || "";
          if (
            (t.includes("chassis number") ||
              t.includes("chassis no") ||
              t.includes("chassis_number") ||
              t.includes("vin") ||
              t.trim() === "chassis" ||
              t.includes("id number") ||
              t.includes("identification number") ||
              t.includes("id no")) &&
            q.type !== "zone-in" &&
            q.type !== "zone-out"
          ) {
            return q.id;
          }
        }
      }
    }
    // Priority 3: Specific dedicated chassis question types
    for (const section of form.sections) {
      if (section.questions) {
        for (const q of section.questions) {
          if (
            q.type === "chassis" ||
            q.type === "chassisWithZone" ||
            q.type === "chassisWithoutZone"
          ) {
            return q.id;
          }
        }
      }
    }
    // Priority 4: Other questions mentioning chassis (exclude zone-in/out)
    for (const section of form.sections) {
      if (section.questions) {
        for (const q of section.questions) {
          const t = q.text?.toLowerCase() || "";
          if (t.includes("chassis") && !t.includes("selected") && q.type !== "zone-in" && q.type !== "zone-out") {
            return q.id;
          }
        }
      }
    }
    // Priority 5: ID Number / VIN / Serial Number / Vehicle Number questions
    for (const section of form.sections) {
      if (section.questions) {
        for (const q of section.questions) {
          const t = q.text?.toLowerCase() || "";
          if (
            (t.includes("id number") ||
              t.includes("id_number") ||
              t.includes("id no") ||
              t.includes("identification") ||
              t.includes("vin") ||
              t.includes("serial") ||
              t.includes("vehicle")) &&
            q.type !== "zone-in" &&
            q.type !== "zone-out"
          ) {
            return q.id;
          }
        }
      }
    }
    return null;
  }, [form]);

  const getResponseChassisValue = useCallback((r: Response | any): string => {
    if (!r) return "-";

    // Build master list of configured chassis options from form
    const masterOptions: { chassisNumber: string; partDescription?: string }[] = [];
    if (form?.chassisNumbers && Array.isArray(form.chassisNumbers)) {
      form.chassisNumbers.forEach((cn: any) => {
        if (typeof cn === "string" && cn.trim()) {
          masterOptions.push({ chassisNumber: cn.trim() });
        } else if (cn && typeof cn === "object" && cn.chassisNumber) {
          masterOptions.push({
            chassisNumber: String(cn.chassisNumber).trim(),
            partDescription: cn.partDescription ? String(cn.partDescription).trim() : undefined,
          });
        }
      });
    }

    const formatMasterMatch = (val: string): string => {
      const match = masterOptions.find(
        (m) => m.chassisNumber.toLowerCase() === val.toLowerCase()
      );
      if (match) {
        return match.partDescription
          ? `${match.chassisNumber} — ${match.partDescription}`
          : match.chassisNumber;
      }
      return val;
    };

    const systemChassisKeys = [
      "system_chassis",
      "systemChassis",
      "System Chassis",
      "SYSTEM CHASSIS",
      "selected_chassis",
      "selectedChassis",
      "Selected Chassis",
      "SELECTED CHASSIS",
      "selected_chassis_number",
      "chassis_number",
    ];

    // CASE A: Form HAS configured chassis options in form.chassisNumbers (e.g. "Saify", "Sridevi", "TVS")
    if (masterOptions.length > 0) {
      // 1. Check explicit system chassis answer keys first
      if (r.answers) {
        for (const k of systemChassisKeys) {
          const raw = r.answers[k];
          if (raw !== undefined && raw !== null && raw !== "") {
            const val = getChassisDisplayValue(raw);
            if (val && val !== "-" && val !== "N/A" && val !== "None") {
              const matched = masterOptions.find(m => m.chassisNumber.toLowerCase() === val.toLowerCase());
              if (matched) {
                return matched.partDescription
                  ? `${matched.chassisNumber} — ${matched.partDescription}`
                  : matched.chassisNumber;
              }
            }
          }
        }
      }

      // 2. Check top-level r.chassisNumber - if it matches configured chassis options
      if (r.chassisNumber && typeof r.chassisNumber === "string" && r.chassisNumber.trim() !== "" && r.chassisNumber !== "N/A" && r.chassisNumber !== "-") {
        const matched = masterOptions.find(m => m.chassisNumber.toLowerCase() === r.chassisNumber.trim().toLowerCase());
        if (matched) {
          return matched.partDescription
            ? `${matched.chassisNumber} — ${matched.partDescription}`
            : matched.chassisNumber;
        }
      }

      // 3. Check if ANY answer in r.answers matches one of form.chassisNumbers
      if (r.answers && typeof r.answers === "object") {
        for (const val of Object.values(r.answers)) {
          if (typeof val === "string" && val.trim()) {
            const matched = masterOptions.find(
              (m) => m.chassisNumber.toLowerCase() === val.trim().toLowerCase()
            );
            if (matched) {
              return matched.partDescription
                ? `${matched.chassisNumber} — ${matched.partDescription}`
                : matched.chassisNumber;
            }
          } else if (val && typeof val === "object" && (val as any).chassisNumber) {
            const cn = String((val as any).chassisNumber).trim();
            const matched = masterOptions.find(
              (m) => m.chassisNumber.toLowerCase() === cn.toLowerCase()
            );
            if (matched) {
              return matched.partDescription
                ? `${matched.chassisNumber} — ${matched.partDescription}`
                : matched.chassisNumber;
            }
          }
        }
      }

      // 4. Default to the configured chassis option (e.g. "Saify", "Sridevi", "TVS")
      const single = masterOptions[0];
      return single.partDescription
        ? `${single.chassisNumber} — ${single.partDescription}`
        : single.chassisNumber;
    }

    // CASE B: Form does NOT have configured chassis in form.chassisNumbers (e.g. unit ID forms)
    // 1. Direct top-level r.chassisNumber
    if (r.chassisNumber && typeof r.chassisNumber === "string" && r.chassisNumber.trim() !== "" && r.chassisNumber !== "N/A" && r.chassisNumber !== "-") {
      return formatMasterMatch(r.chassisNumber.trim());
    }

    // 2. Question-level chassisQuestionId from form template (typed chassis / VIN)
    if (chassisQuestionId && r.answers) {
      if (r.answers[chassisQuestionId] !== undefined && r.answers[chassisQuestionId] !== null && r.answers[chassisQuestionId] !== "") {
        const val = getChassisDisplayValue(r.answers[chassisQuestionId]);
        if (val && val !== "-" && val !== "N/A" && val !== "None") return formatMasterMatch(val);
      }
      const trackingKey = `${chassisQuestionId}_tracking`;
      if (r.answers[trackingKey] !== undefined && r.answers[trackingKey] !== null && r.answers[trackingKey] !== "") {
        const val = getChassisDisplayValue(r.answers[trackingKey]);
        if (val && val !== "-" && val !== "N/A" && val !== "None") return formatMasterMatch(val);
      }
    }

    // 3. Fallback answer keys
    if (r.answers) {
      for (const k of systemChassisKeys) {
        const raw = r.answers[k];
        if (raw !== undefined && raw !== null && raw !== "") {
          const val = getChassisDisplayValue(raw);
          if (val && val !== "-" && val !== "N/A" && val !== "None") return formatMasterMatch(val);
        }
      }
      const fallbackKeys = [
        "chassisNumber",
        "Chassis Number",
        "CHASSIS NUMBER",
        "Chassis / VIN",
        "VIN",
        "vin",
        "chassis",
        "Chassis",
        "id_number",
        "idNumber",
        "ID NUMBER",
        "ID Number",
        "Serial Number",
        "serialNumber"
      ];
      for (const k of fallbackKeys) {
        const raw = r.answers[k];
        if (raw !== undefined && raw !== null && raw !== "") {
          const val = getChassisDisplayValue(raw);
          if (val && val !== "-" && val !== "N/A" && val !== "None") {
            return formatMasterMatch(val);
          }
        }
      }
    }

    return "-";
  }, [chassisQuestionId, form]);

  const [editingChassisResponseId, setEditingChassisResponseId] = useState<string | null>(null);
  const [chassisEditValue, setChassisEditValue] = useState<string>("");
  const [isSavingChassis, setIsSavingChassis] = useState(false);
  const [updatingUserResponseId, setUpdatingUserResponseId] = useState<string | null>(null);
  const chassisMasterOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    const seen = new Set<string>();

    if (Array.isArray(form?.chassisNumbers)) {
      form!.chassisNumbers!.forEach((entry: any) => {
        const num = entry?.chassisNumber;
        if (num && !seen.has(String(num))) {
          seen.add(String(num));
          opts.push({
            value: String(num),
            label: entry.partDescription
              ? `${num} — ${entry.partDescription}`
              : String(num),
          });
        }
      });
    }

    responses.forEach((r) => {
      const num = getResponseChassisValue(r);
      if (num && num !== "-" && num !== "N/A" && !seen.has(String(num))) {
        seen.add(String(num));
        opts.push({ value: String(num), label: String(num) });
      }
    });

    return opts.sort((a, b) => String(a?.label ?? "").localeCompare(String(b?.label ?? "")));
  }, [form, responses, getResponseChassisValue]);

  const handleStartChassisEdit = (response: Response) => {
    setEditingChassisResponseId(response.id);
    const val = getResponseChassisValue(response);
    setChassisEditValue(val === "-" || val === "N/A" ? "" : val);
  };

  const handleCancelChassisEdit = () => {
    setEditingChassisResponseId(null);
    setChassisEditValue("");
  };

  const handleSaveChassisEdit = async (response: Response) => {
    try {
      setIsSavingChassis(true);
      const updatedAnswers = {
        ...response.answers,
        chassis_number: chassisEditValue,
        ...(!chassisMasterOptions.length && chassisQuestionId ? { [chassisQuestionId]: chassisEditValue } : {})
      };
      const responseIdentifier = response.id || (response as any)._id;
      await apiClient.updateResponse(responseIdentifier, {
        answers: updatedAnswers,
        chassisNumber: chassisEditValue
      });

      const updateChassisMatcher = (r: Response) => {
        const rId = r.id || (r as any)._id;
        return rId === responseIdentifier || r.id === response.id || (r as any)._id === responseIdentifier
          ? { ...r, answers: updatedAnswers, chassisNumber: chassisEditValue }
          : r;
      };

      setResponses((prev) => prev.map(updateChassisMatcher));
      setTableResponses((prev) => prev.map(updateChassisMatcher));

      setEditingChassisResponseId(null);
      setChassisEditValue("");
      showToast("Chassis updated successfully!", "success");
    } catch (err) {
      console.error("Error updating chassis:", err);
      showToast("Failed to update chassis. Please try again.", "error");
    } finally {
      setIsSavingChassis(false);
    }
  };

  const handleUpdateResponseUser = async (responseId: string, userId: string) => {
    try {
      setUpdatingUserResponseId(responseId);
      const payload = {
        submittedByUserId: userId || null
      };
      const result = await apiClient.updateResponse(responseId, payload);
      if (result && result.data && result.data.response) {
        const updated = result.data.response;
        setResponses((prev) =>
          prev.map((r) =>
            r.id === responseId
              ? {
                ...r,
                createdBy: updated.createdBy,
                submittedBy: updated.submittedBy,
                submitterContact: updated.submitterContact
              }
              : r
          )
        );

        showToast("Inspector assigned successfully", "success");
      }
    } catch (error: any) {
      console.error("Error updating response user:", error);
      showToast(error?.message || "Failed to assign inspector", "error");
    } finally {
      setUpdatingUserResponseId(null);
    }
  };

  // Whether the currently logged-in user is the one who submitted this
  // response (used to block a submitter from BIW-reviewing their own work —
  // mirrors the same submitter check already used for the Dispatch column).
  // Exceptions: admins/superadmins can review anything (including their own
  // submissions), and "Excel Import" responses have no real submitter, so
  // anyone can review those too.
  const isSubmitterOfResponse = (response: Response) => {
    if (user?.role === "superadmin" || user?.role === "admin") return false;
    if (response.submittedBy === "Excel Import") return false;

    const userEmail = (user?.email || "").toLowerCase();
    const userUsername = (user?.username || "").toLowerCase();
    const userIdStr = user?._id
      ? String(user._id)
      : user?.id
        ? String(user.id)
        : "";
    const creatorId =
      typeof response.createdBy === "object"
        ? (response.createdBy as any)?._id || (response.createdBy as any)?.id
        : response.createdBy;
    const creatorIdStr = creatorId ? String(creatorId) : "";

    const subBy = String(response.submittedBy || "").toLowerCase();
    const crBy = String(response.createdBy || "").toLowerCase();
    const contactEmail = String(response.submitterContact?.email || "").toLowerCase();

    return (
      (userEmail && subBy === userEmail) ||
      (userUsername && subBy === userUsername) ||
      (userEmail && crBy === userEmail) ||
      (userUsername && crBy === userUsername) ||
      (userEmail && contactEmail === userEmail) ||
      (creatorIdStr && creatorIdStr === userIdStr)
    );
  };

  const isOwnTenantResponse = (response: Response) => {
    // Only superadmins, direct form creators, or users belonging to the form's creator tenant can dispatch responses
    if (user?.role === "superadmin") {
      return true;
    }

    if (!user) return false;

    // Direct creator of the form
    const formCreatedById = form?.createdBy
      ? (typeof form.createdBy === "object" ? String((form.createdBy as any)._id || (form.createdBy as any).id) : String(form.createdBy))
      : null;
    const currentUserId = user._id || user.id ? String(user._id || user.id) : null;
    if (formCreatedById && currentUserId && formCreatedById === currentUserId) {
      return true;
    }

    const userTenantId = user?.tenantId;
    if (!userTenantId) {
      return false;
    }

    const userTenantStr = typeof userTenantId === 'object'
      ? String((userTenantId as any)?._id || (userTenantId as any)?.id || userTenantId)
      : String(userTenantId);

    const formTenantId = form?.tenantId;
    const formTenantStr = formTenantId
      ? (typeof formTenantId === 'object' ? String((formTenantId as any)?._id || (formTenantId as any)?.id || formTenantId) : String(formTenantId))
      : null;

    // If the form has an owning creator tenant, user's tenant MUST match the creator tenant
    if (formTenantStr) {
      return userTenantStr === formTenantStr;
    }

    // Legacy form with no tenant: only match if response tenant matches user's tenant
    const responseTenantId = response.tenantId;
    if (!responseTenantId) return true;
    const responseTenantStr = typeof responseTenantId === 'object'
      ? String((responseTenantId as any)?._id || (responseTenantId as any)?.id || responseTenantId)
      : String(responseTenantId);

    return userTenantStr === responseTenantStr;
  };

  // BIW Review: any reviewer other than the submitter can mark a response as
  // Accepted / Rejected / Reworked from the Responses table. Selecting one
  // option saves it to the response (biwReview) and unsets the others —
  // acts like a single-select despite being rendered as three checkboxes.
  // The server is authoritative on reviewedBy/reviewedAt and re-checks the
  // "not your own submission" rule, so we only send the status here.
  // NEW - flat list of {id, text} questions that belong to this response's
  // form, used to populate the "which question is this about" checkboxes
  // in the BIW Reject/Rework popup. Falls back to the response's answer
  // keys if the form/sections aren't loaded for some reason.
  const getResponseQuestionOptions = (
    response: Response | null | undefined,
  ): { id: string; text: string }[] => {
    if (!response || !response.answers) return [];
    const options: { id: string; text: string }[] = [];
    if (form?.sections?.length) {
      form.sections.forEach((section) => {
        section.questions?.forEach((q: any) => {
          if (response.answers && Object.prototype.hasOwnProperty.call(response.answers, q.id)) {
            options.push({ id: q.id, text: q.text || q.id });
          }
        });
      });
    }
    if (options.length === 0 && response.answers) {
      Object.keys(response.answers).forEach((qId) =>
        options.push({ id: qId, text: qId }),
      );
    }
    return options;
  };

  const handleBiwReviewChange = async (
    response: Response,
    status: "Accepted" | "Rejected" | "Reworked",
  ) => {
    const reviewAuth = canUserBiwReview(response);
    if (!reviewAuth.canReview) {
      showToast(reviewAuth.reason || "You are not authorized to BIW review this chassis", "error");
      return;
    }

    // Clicking the already-selected option clears the review; otherwise set it.
    const isUnselecting = response.biwReview?.status === status;

    // NEW - Reject/Rework (when not simply clearing an existing selection)
    // needs the question(s) + remark + evidence popup instead of an
    // immediate save.
    if (!isUnselecting && (status === "Rejected" || status === "Reworked")) {
      setBiwActionResponse(response);
      setBiwActionStatus(status);
      setBiwActionSelectedQuestionIds(
        response.biwReview?.flaggedQuestions?.map((q) => q.questionId) || [],
      );
      setBiwActionRemark(response.biwReview?.remark || "");
      setBiwActionEvidenceUrl(response.biwReview?.evidenceUrl || "");
      setShowBiwActionModal(true);
      return;
    }

    const payload = isUnselecting ? null : { status };

    try {
      setBiwSavingResponseId(response.id);
      const result = await apiClient.updateResponse(response.id, {
        biwReview: payload,
      });

      const savedBiwReview =
        (result as any)?.response?.biwReview ??
        (result as any)?.data?.response?.biwReview ??
        (payload
          ? {
            status,
            reviewedBy: user?.id,
            reviewedByName: user?.name,
            reviewedAt: new Date().toISOString(),
          }
          : undefined);

      setResponses((prev) =>
        prev.map((r) =>
          r.id === response.id ? { ...r, biwReview: savedBiwReview } : r,
        ),
      );

      // Also update tableResponses so the table UI reflects the change immediately
      setTableResponses((prev) =>
        prev.map((r) =>
          r.id === response.id ? { ...r, biwReview: savedBiwReview } : r,
        ),
      );

      // Instantly sync dashboard charts and summary
      fetchSummary();
      fetchPerformanceTable();


      showToast(
        isUnselecting
          ? "BIW review cleared"
          : `Marked as ${status} (BIW Review)`,
        "success",
      );
    } catch (err: any) {
      console.error("Error saving BIW review:", err);
      const message =
        err?.message || "Failed to save BIW review. Please try again.";
      showToast(message, "error");
    } finally {
      setBiwSavingResponseId(null);
    }
  };

  // NEW - closes and resets the Reject/Rework popup.
  const closeBiwActionModal = () => {
    setShowBiwActionModal(false);
    setBiwActionResponse(null);
    setBiwActionStatus(null);
    setBiwActionSelectedQuestionIds([]);
    setBiwActionRemark("");
    setBiwActionEvidenceUrl("");
  };

  // NEW - evidence upload inside the popup, reusing the same
  // apiClient.uploadFile("form") path used elsewhere in this dashboard.
  const handleBiwEvidenceUpload = async (file: File) => {
    try {
      setBiwActionUploading(true);
      const result = await apiClient.uploadFile(file, "form");
      const url = apiClient.resolveUploadedFileUrl(result);
      if (url) setBiwActionEvidenceUrl(url);
    } catch (err) {
      console.error("BIW evidence upload failed:", err);
      showToast("Evidence upload failed. Please try again.", "error");
    } finally {
      setBiwActionUploading(false);
    }
  };

  const toggleBiwActionQuestion = (questionId: string) => {
    setBiwActionSelectedQuestionIds((prev) =>
      prev.includes(questionId)
        ? prev.filter((id) => id !== questionId)
        : [...prev, questionId],
    );
  };

  // NEW - submits the Reject/Rework popup: saves status + remark +
  // evidence + the flagged questions (id snapshotted with its current
  // text) onto the response's biwReview.
  const submitBiwActionModal = async () => {
    if (!biwActionResponse || !biwActionStatus) return;

    if (!biwActionRemark.trim()) {
      showToast("Please add a remark before submitting", "error");
      return;
    }
    if (biwActionSelectedQuestionIds.length === 0) {
      showToast("Please select at least one question", "error");
      return;
    }

    const questionOptions = getResponseQuestionOptions(biwActionResponse);
    const flaggedQuestions = biwActionSelectedQuestionIds.map((id) => ({
      questionId: id,
      questionText:
        questionOptions.find((q) => q.id === id)?.text || id,
    }));

    try {
      setIsBiwActionSubmitting(true);
      const result = await apiClient.updateResponse(biwActionResponse.id, {
        biwReview: {
          status: biwActionStatus,
          remark: biwActionRemark.trim(),
          evidenceUrl: biwActionEvidenceUrl || null,
          flaggedQuestions,
        },
      });

      const savedBiwReview =
        (result as any)?.response?.biwReview ??
        (result as any)?.data?.response?.biwReview ?? {
          status: biwActionStatus,
          remark: biwActionRemark.trim(),
          evidenceUrl: biwActionEvidenceUrl || null,
          flaggedQuestions,
          reviewedBy: user?.id,
          reviewedByName: user?.name,
          reviewedAt: new Date().toISOString(),
        };

      setResponses((prev) =>
        prev.map((r) =>
          r.id === biwActionResponse.id ? { ...r, biwReview: savedBiwReview } : r,
        ),
      );
      setTableResponses((prev) =>
        prev.map((r) =>
          r.id === biwActionResponse.id ? { ...r, biwReview: savedBiwReview } : r,
        ),
      );

      // Instantly sync dashboard charts and summary
      fetchSummary();
      fetchPerformanceTable();

      showToast(`Marked as ${biwActionStatus} (BIW Review)`, "success");
      closeBiwActionModal();
    } catch (err: any) {
      console.error("Error saving BIW review:", err);
      showToast(
        err?.message || "Failed to save BIW review. Please try again.",
        "error",
      );
    } finally {
      setIsBiwActionSubmitting(false);
    }
  };

  const executeBulkBiwReviewUpdate = async () => {
    if (biwBulkUpdateTargetIds.length === 0) return;

    try {
      setIsBulkBiwUpdating(true);
      const result = await apiClient.bulkUpdateBiwReview(biwBulkUpdateTargetIds, biwBulkUpdateStatus);

      // Update local state
      const biwReviewUpdate = (r: Response) => {
        const rId = r.id || (r as any)._id;
        if (biwBulkUpdateTargetIds.includes(r.id) || (rId && biwBulkUpdateTargetIds.includes(rId))) {
          return {
            ...r,
            biwReview: biwBulkUpdateStatus === null ? undefined : {
              status: biwBulkUpdateStatus,
              reviewedBy: user?._id || user?.id,
              reviewedByName: user?.username || user?.email || 'Reviewer',
              reviewedAt: new Date().toISOString()
            }
          };
        }
        return r;
      };

      setResponses((prev) => prev.map(biwReviewUpdate));

      // Also update tableResponses so the table UI reflects the change immediately
      setTableResponses((prev) => prev.map(biwReviewUpdate));

      // Instantly sync dashboard charts and summary
      fetchSummary();
      fetchPerformanceTable();

      setSelectedResponseIds([]);
      setSelectedBiwIds([]);
      showToast(
        biwBulkUpdateStatus === null
          ? `Cleared BIW review for ${result?.updatedCount ?? biwBulkUpdateTargetIds.length} response(s)`
          : `Marked ${result?.updatedCount ?? biwBulkUpdateTargetIds.length} response(s) as ${biwBulkUpdateStatus} (BIW Review)` +
          ((result?.skippedCount ?? biwBulkUpdateSkippedCount) > 0 ? ` (${result?.skippedCount ?? biwBulkUpdateSkippedCount} skipped)` : ""),
        "success"
      );
    } catch (err: any) {
      console.error("Error bulk updating BIW reviews:", err);
      showToast(err?.message || "Failed to bulk update BIW reviews", "error");
    } finally {
      setIsBulkBiwUpdating(false);
      setShowBiwBulkUpdateModal(false);
    }
  };

  const handleBulkBiwReviewUpdate = (status: "Accepted" | "Rejected" | "Reworked" | null) => {
    if (selectedResponseIds.length === 0) return;

    const validResponseIds: string[] = [];
    let unauthorizedCount = 0;

    selectedResponseIds.forEach((id) => {
      // `responses` (the full analytics set) may not be loaded if the user
      // came straight to the Responses tab without visiting another tab
      // first; fall back to the server-paginated `tableResponses`, which
      // always has the rows actually checked on this page.
      const resp =
        responses.find((r) => r.id === id || (r as any)._id === id) ||
        tableResponses.find((r) => r.id === id || (r as any)._id === id) ||
        displayedTableResponses.find((r) => r.id === id || (r as any)._id === id);
      if (resp) {
        if (status !== null && !canUserBiwReview(resp).canReview) {
          unauthorizedCount++;
        } else {
          validResponseIds.push(id);
        }
      }
    });

    if (validResponseIds.length === 0) {
      showToast(
        "You are not authorized to BIW review the selected submissions (assigned tenant reviewers only).",
        "error"
      );
      return;
    }

    setBiwBulkUpdateStatus(status);
    setBiwBulkUpdateTargetIds(validResponseIds);
    setBiwBulkUpdateSkippedCount(unauthorizedCount);
    setShowBiwBulkUpdateModal(true);
  };

  const handleBulkBiwReviewUpdateAll = (status: "Accepted" | "Rejected" | "Reworked" | null) => {
    const sourceList = displayedTableResponses.length > 0 ? displayedTableResponses : tableResponses;
    if (sourceList.length === 0) return;

    const allIds = sourceList.map((r) => r.id || (r as any)._id).filter(Boolean);

    const validResponseIds: string[] = [];
    let unauthorizedCount = 0;

    allIds.forEach((id) => {
      // Same fallback as above: tableResponses always has these rows since
      // allIds was derived from it directly.
      const resp =
        responses.find((r) => r.id === id || (r as any)._id === id) ||
        tableResponses.find((r) => r.id === id || (r as any)._id === id) ||
        displayedTableResponses.find((r) => r.id === id || (r as any)._id === id);
      if (resp) {
        if (status !== null && !canUserBiwReview(resp).canReview) {
          unauthorizedCount++;
        } else {
          validResponseIds.push(id);
        }
      }
    });

    if (validResponseIds.length === 0) {
      showToast(
        "You are not authorized to BIW review the selected submissions (assigned tenant reviewers only).",
        "error"
      );
      return;
    }

    setBiwBulkUpdateStatus(status);
    setBiwBulkUpdateTargetIds(validResponseIds);
    setBiwBulkUpdateSkippedCount(unauthorizedCount);
    setShowBiwBulkUpdateModal(true);
  };

  // Bulk auto-fill: instead of looping through every response client-side,
  // this calls the backend's single bulk-update endpoint (see
  // apiClient.autoFillChassisNumbers / responseController.autoFillChassisNumbers),
  // which fills every response with no chassis_number using the first
  // configured chassis option, in one database call. Triggered manually via
  // the button in the "Selected Chassis" column header.
  const [isAutoFillingChassis, setIsAutoFillingChassis] = useState(false);

  const handleAutoFillAllChassis = async () => {
    if (!chassisMasterOptions.length) {
      showToast("No chassis numbers are configured for this form.", "error");
      return;
    }
    if (!id) return;

    const confirmed = window.confirm(
      `This will set every response that currently has no chassis number to "${chassisMasterOptions[0].label}". Continue?`,
    );
    if (!confirmed) return;

    try {
      setIsAutoFillingChassis(true);
      const result = await apiClient.autoFillChassisNumbers(id);
      const defaultValue = result.defaultValue ?? chassisMasterOptions[0].value;
      const modifiedCount = result.modifiedCount ?? 0;

      // Reflect the change locally right away instead of waiting on a refetch
      const updateChassisInResponse = (r: Response) => {
        const current = getResponseChassisValue(r);
        const isEmpty = !current || current === "-" || current === "N/A" || current === "None" || String(current).trim() === "";
        if (!isEmpty) return r;
        const newAnswers = { ...(r.answers || {}), chassis_number: defaultValue };
        if (!chassisMasterOptions.length && chassisQuestionId) {
          newAnswers[chassisQuestionId] = defaultValue;
        }
        return {
          ...r,
          chassisNumber: defaultValue,
          answers: newAnswers,
        };
      };

      setResponses((prev) => prev.map(updateChassisInResponse));
      setTableResponses((prev) => prev.map(updateChassisInResponse));
      if (typeof fetchResponsesPage === "function" && currentResponsesPage) {
        fetchResponsesPage(currentResponsesPage);
      }

      showToast(
        modifiedCount > 0
          ? `Auto-filled ${modifiedCount} response(s) with "${defaultValue}".`
          : "All responses already have a chassis number.",
        "success",
      );
    } catch (err) {
      console.error("Error auto-filling chassis numbers:", err);
      showToast("Failed to auto-fill chassis numbers. Please try again.", "error");
    } finally {
      setIsAutoFillingChassis(false);
    }
  };



  // Sync tab with URL parameter
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const tabParam = searchParams.get("tab");
    if (tabParam && ["responses", "dashboard"].includes(tabParam)) {
      if (hasTabPermission(tabParam) && tabParam !== analyticsView) {
        setAnalyticsView(tabParam as any);
        setActiveTab(tabParam as any);
      }
    }
  }, [location.search, form, analyticsView]);

  // Sync dispatch, TVS review, BIW review, and status filters with URL parameters
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const dispatchParam = searchParams.get("dispatch") || searchParams.get("dispatchStatus");
    const tvsStatusParam = searchParams.get("tvsStatus");
    const biwStatusParam = searchParams.get("biwStatus");
    const statusParam = searchParams.get("status");

    startFilterTransition(() => {
      setColumnFilters((prev) => {
        let changed = false;
        const next = { ...prev };

        // 1. Dispatch filter
        if (dispatchParam) {
          const l = dispatchParam.toLowerCase().trim();
          const target = (l === "pending" || l === "pending dispatch") ? ["Pending Dispatch"] : (l === "dispatched" ? ["Dispatched / Enabled"] : null);
          if (target && JSON.stringify(next.__dispatch) !== JSON.stringify(target)) {
            next.__dispatch = target;
            changed = true;
          }
        } else if (next.__dispatch) {
          delete next.__dispatch;
          changed = true;
        }

        // 2. TVS Review filter
        if (tvsStatusParam) {
          const ts = tvsStatusParam.toLowerCase().trim();
          let target: string[] | null = null;
          if (ts === "reviewed") target = ["Reviewed"];
          else if (ts === "accepted") target = ["Accepted"];
          else if (ts === "rework" || ts === "defects" || ts === "rejected") target = ["Rework"];
          else if (ts === "pending") {
            target = ["No review yet"];
          }
          if (target && JSON.stringify(next.__tvsReview) !== JSON.stringify(target)) {
            next.__tvsReview = target;
            changed = true;
          }
        } else if (next.__tvsReview) {
          delete next.__tvsReview;
          changed = true;
        }

        // 3. BIW Review filter
        if (biwStatusParam) {
          const bs = biwStatusParam.toLowerCase().trim();
          let target: string[] | null = null;
          if (bs === "accepted") target = ["Accepted"];
          else if (bs === "rework" || bs === "reworked") target = ["Reworked"];
          else if (bs === "rejected") target = ["Rejected"];
          else if (bs === "reviewed") target = ["Accepted", "Reworked", "Rejected"];
          else if (bs === "pending" || bs === "pending review" || bs === "no review yet") target = ["No review yet"];
          if (target && JSON.stringify(next.__biwReview) !== JSON.stringify(target)) {
            next.__biwReview = target;
            changed = true;
          }
        } else if (next.__biwReview) {
          delete next.__biwReview;
          changed = true;
        }

        // 4. Status filter
        if (statusParam) {
          const spLower = statusParam.toLowerCase().trim();
          let target: string[] | null = null;
          if (spLower === "accepted") target = ["Direct Ok", "Rework Accepted"];
          else if (spLower === "direct ok") target = ["Direct Ok"];
          else if (spLower === "rework accepted" || spLower === "rework completed") target = ["Rework Accepted"];
          else if (spLower.includes("rework")) target = ["Rework"];
          else if (spLower === "rejected") target = ["Rejected"];
          else target = [statusParam];
          if (target && JSON.stringify(next.__status) !== JSON.stringify(target)) {
            next.__status = target;
            changed = true;
          }
        }

        return changed ? next : prev;
      });
    });
  }, [location.search]);

  // Set initial tab based on permissions after form loads
  useEffect(() => {
    if (!form) return;

    // If URL has a specific valid tab param, let the sync effect handle it
    const searchParams = new URLSearchParams(location.search);
    const tabParam = searchParams.get("tab");
    if (tabParam && ["question", "section", "table", "responses", "dashboard", "comparison", "overall"].includes(tabParam)) {
      return;
    }

    // Otherwise, default to first allowed tab
    const tabOrder = ["dashboard", "responses"];
    for (const tab of tabOrder) {
      if (hasTabPermission(tab)) {
        setAnalyticsView(tab as any);
        break;
      }
    }
  }, [form]);
  const [tableViewType, setTableViewType] = useState<"question" | "section">(
    "question",
  );
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]);

  const [selectedQuestionId, setSelectedQuestionId] = useState<string>("");
  const [selectedQuestion, setSelectedQuestion] = useState<any>(null);
  const [filterValues, setFilterValues] = useState<string[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);

  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showSectionSelector, setShowSectionSelector] = useState(false);
  const [shareAnalyticsModal, setShareAnalyticsModal] = useState<{
    open: boolean;
    formId: string;
    formTitle: string;
  }>({ open: false, formId: "", formTitle: "" });
  const [autoSendModal, setAutoSendModal] = useState<{
    open: boolean;
    formId: string;
    formTitle: string;
  }>({ open: false, formId: "", formTitle: "" });
  const [appliedFilters, setAppliedFilters] = useState<
    Array<{ id: string; label: string; value: string }>
  >(() => {
    const d30 = getLast30DaysRange();
    return [
      {
        id: "date",
        label: "Date",
        value: `Last 30 Days (${d30.startDate} to ${d30.endDate})`,
      },
    ];
  });
  const [cascadingFilters, setCascadingFilters] = useState<
    Record<string, string[]>
  >({});
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatResponse, setChatResponse] = useState<Response | null>(null);
  const [chatFilters, setChatFilters] = useState(() => {
    // Load from localStorage to persist suggestedAnswers between modal opens
    try {
      const saved = localStorage.getItem("chatFilters");
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          chassisNumber: "",
          location: "",
          questions: [] as string[],
          selectedCategories: {} as Record<string, string[]>,
          suggestedAnswers: parsed.suggestedAnswers || {},
          zoneType: "both" as "with" | "without" | "both",
        };
      }
    } catch (error) {
      console.error("Failed to load chatFilters from localStorage:", error);
    }

    return {
      chassisNumber: "",
      location: "",
      questions: [] as string[],
      selectedCategories: {} as Record<string, string[]>,
      suggestedAnswers: {} as Record<string, any>,
      zoneType: "both" as "with" | "without" | "both",
    };
  });
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [activeReviewQuestionTab, setActiveReviewQuestionTab] = useState<string>("current");
  const [relatedFormData, setRelatedFormData] = useState<{
    parentForm?: any;
    childForms?: any[];
    parentAnswers?: Record<string, any>;
    childAnswers?: Record<string, any>;
    parentResponse?: any;
    childResponses?: Record<string, any>;
  }>({});
  const [selectedInspectorForTrend, setSelectedInspectorForTrend] =
    useState<string>("Overall");
  const [localFilterName, setLocalFilterName] = useState<string>("All");
  const [biwFilterStartDate, setBiwFilterStartDate] = useState<string>("");
  const [biwFilterEndDate, setBiwFilterEndDate] = useState<string>("");
  const [showPerformanceGuide, setShowPerformanceGuide] = useState(false);
  const [isBiwHistoryModalOpen, setIsBiwHistoryModalOpen] = useState(false);

  const [dateFilter, setDateFilter] = useState<{
    type: "all" | "single" | "range";
    startDate: string;
    endDate: string;
  }>(() => {
    if (externalDateRange) {
      return {
        type: externalDateRange.type,
        startDate: externalDateRange.startDate || "",
        endDate: externalDateRange.endDate || "",
      };
    }
    const sp = new URLSearchParams(window.location.search);
    const uStart = sp.get("startDate") || sp.get("rangeStart");
    const uEnd = sp.get("endDate") || sp.get("rangeEnd");
    if (uStart || uEnd) {
      return {
        type: "range",
        startDate: uStart || "",
        endDate: uEnd || "",
      };
    }
    const d30 = getLast30DaysRange();
    return {
      type: "range",
      startDate: d30.startDate,
      endDate: d30.endDate,
    };
  });

  // Sync upper QualityDashboard date range filter down into FormAnalyticsDashboard
  useEffect(() => {
    if (!externalDateRange) return;
    setDateFilter((prev) => {
      if (
        prev.type === externalDateRange.type &&
        prev.startDate === (externalDateRange.startDate || "") &&
        prev.endDate === (externalDateRange.endDate || "")
      ) {
        return prev;
      }
      return {
        type: externalDateRange.type,
        startDate: externalDateRange.startDate || "",
        endDate: externalDateRange.endDate || "",
      };
    });
  }, [externalDateRange?.type, externalDateRange?.startDate, externalDateRange?.endDate]);

  // Sync upper QualityDashboard selected status slice down into FormAnalyticsDashboard columnFilters
  const prevExternalSliceRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (externalStatusSlice === undefined) return;
    if (prevExternalSliceRef.current === undefined && externalStatusSlice === "all") {
      prevExternalSliceRef.current = externalStatusSlice;
      return;
    }
    prevExternalSliceRef.current = externalStatusSlice;

    setColumnFilters((prev) => {
      const next: Record<string, string[] | null> = { ...prev };
      delete next.__status;
      delete next.__dispatch;
      delete next.__biwReview;
      delete next.__tvsReview;

      switch (externalStatusSlice) {
        case "accepted":
          next.__status = ["Direct Ok", "Rework Accepted", "Accepted"];
          break;
        case "rework":
          next.__status = ["Rework 1", "Rework 2", "Rework"];
          break;
        case "rejected":
          next.__status = ["Rejected"];
          break;
        case "dispatched":
          next.__dispatch = ["Dispatched"];
          break;
        case "pendingDispatch":
          next.__dispatch = ["Pending Dispatch"];
          break;
        case "biwReviewed":
          next.__biwReview = ["Accepted", "Reworked", "Rejected"];
          break;
        case "pendingData":
          next.__biwReview = ["No review yet"];
          break;
        case "biwAccepted":
          next.__biwReview = ["Accepted"];
          break;
        case "biwDefects":
          next.__biwReview = ["Reworked", "Rejected"];
          break;
        case "tvsReviewed":
          next.__tvsReview = ["Accepted", "Rejected", "Rework"];
          break;
        case "pendingTvs":
          next.__tvsReview = ["No review yet"];
          break;
        case "tvsAccepted":
          next.__tvsReview = ["Accepted"];
          break;
        case "tvsDefects":
          next.__tvsReview = ["Rejected", "Rework"];
          break;
        default:
          break;
      }
      return next;
    });
  }, [externalStatusSlice]);

  // BIW Review Table data — computed client-side from the full `responses`
  // dataset (not the server-paginated `tableResponses`), grouped by
  // submitter, the same way the User Name rows are read in the Performance
  // Table. Accepted/Rejected/Reworked/Total Reviewed here only count BIW
  // review clicks, not the regular review flow.
  const biwReviewTableData = useMemo(() => {
    // Determine effective date range: local BIW date filter takes priority,
    // then fall back to global dateFilter if set
    const effectiveStart = biwFilterStartDate || dateFilter.startDate || "";
    const effectiveEnd = biwFilterEndDate || dateFilter.endDate || "";

    // Filter responses by effective date range
    let filteredByDate = responses;
    if (effectiveStart || effectiveEnd) {
      filteredByDate = responses.filter((response) => {
        const timestamp = getResponseTimestamp(response);
        if (!timestamp) return false;
        const responseDate = toLocalDateString(timestamp);
        if (effectiveStart && effectiveEnd) {
          return responseDate >= effectiveStart && responseDate <= effectiveEnd;
        } else if (effectiveStart) {
          return responseDate >= effectiveStart;
        } else if (effectiveEnd) {
          return responseDate <= effectiveEnd;
        }
        return true;
      });
    }

    const byUser = new Map<
      string,
      {
        name: string;
        totalSubmitted: number;
        dispatched: number;
        accepted: number;
        rejected: number;
        rework: number;
      }
    >();

    filteredByDate.forEach((response) => {
      const name =
        response.submittedBy || response.createdBy || "Anonymous";
      if (!byUser.has(name)) {
        byUser.set(name, {
          name,
          totalSubmitted: 0,
          dispatched: 0,
          accepted: 0,
          rejected: 0,
          rework: 0,
        });
      }
      const stats = byUser.get(name)!;
      stats.totalSubmitted += 1;
      if (response.isDispatched) stats.dispatched += 1;

      const biwStatus = response.biwReview?.status;
      if (biwStatus === "Accepted") stats.accepted += 1;
      else if (biwStatus === "Rejected") stats.rejected += 1;
      else if (biwStatus === "Reworked") stats.rework += 1;
    });

    return Array.from(byUser.values()).map((stats) => {
      const totalReviewed = stats.accepted + stats.rejected + stats.rework;
      const performanceScore =
        totalReviewed > 0
          ? Math.round((stats.accepted / totalReviewed) * 100)
          : 0;
      return { ...stats, totalReviewed, performanceScore };
    });
  }, [responses, biwFilterStartDate, biwFilterEndDate, dateFilter.startDate, dateFilter.endDate]);
  const [localFilterShift, setLocalFilterShift] = useState<string>("All");
  const [localFilterDate, setLocalFilterDate] = useState<string>("");


  const commonDateRangeLabel = useMemo(() => {
    if (dateFilter.startDate && dateFilter.endDate) {
      return `${new Date(dateFilter.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${new Date(dateFilter.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    } else if (dateFilter.startDate) {
      return `From ${new Date(dateFilter.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    } else if (dateFilter.endDate) {
      return `Until ${new Date(dateFilter.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    }
    return "All Time";
  }, [dateFilter.startDate, dateFilter.endDate]);

  const [hasUserAppliedDateFilter, setHasUserAppliedDateFilter] =
    useState(false);

  useEffect(() => {
    if (hasUserAppliedDateFilter) return; // user is in control now, don't override
    // Default to last 30 days data (as requested)
  }, [analyticsView, hasUserAppliedDateFilter]);






  const [locationFilter, setLocationFilter] = useState<string[]>([]);
  const [columnFilters, setColumnFilters] = useState<
    Record<string, string[] | null>
  >(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const dp = sp.get("dispatch") || sp.get("dispatchStatus");
      if (dp) {
        const l = dp.toLowerCase().trim();
        if (l === "pending" || l === "pending dispatch") {
          return { __dispatch: ["Pending Dispatch"] };
        } else if (l === "dispatched") {
          return { __dispatch: ["Dispatched / Enabled"] };
        }
      }
    } catch (_) { }
    return {};
  });

  // ── Performance: keep filter/sort updates non-blocking ──────────────────────
  // startFilterTransition wraps setColumnFilters / setTableSort calls so React
  // can keep the current rendered frame interactive while it re-calculates the
  // filtered table in the background. `isFilterPending` drives a subtle
  // opacity pulse on the table so the user sees work is in progress.
  const [isFilterPending, startFilterTransition] = useTransition();
  const [tableSort, setTableSort] = useState<{
    columnId: string;
    direction: "asc" | "desc";
  } | null>(null);
  const [selectedResponsesSectionIds, setSelectedResponsesSectionIds] =
    useState<string[]>([]);
  const [showResponsesFilter, setShowResponsesFilter] = useState(false);
  const [editingResponseId, setEditingResponseId] = useState<string | null>(
    null,
  );
  const [editFormData, setEditFormData] = useState<Record<string, any>>({});
  const [editFormStatus, setEditFormStatus] = useState<string>("Accepted");
  const [editFormNotes, setEditFormNotes] = useState<string>("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingResponseId, setDeletingResponseId] = useState<string | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedResponseIds, setSelectedResponseIds] = useState<string[]>([]);
  const [selectedDispatchIds, setSelectedDispatchIds] = useState<string[]>([]);
  const [selectedBiwIds, setSelectedBiwIds] = useState<string[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showBulkDispatchConfirm, setShowBulkDispatchConfirm] = useState(false);
  const [showActionMenuModal, setShowActionMenuModal] = useState(false);
  const [actionResponse, setActionResponse] = useState<Response | null>(null);

  // Performance scoring system
  const [performanceScores, setPerformanceScores] = useState<
    Record<string, number>
  >({});

  const [performanceTableData, setPerformanceTableData] = useState<any[]>([]);
  const [performanceTableLoading, setPerformanceTableLoading] = useState(false);
  const [performancePage, setPerformancePage] = useState(1);
  const [performancePageSize, setPerformancePageSize] = useState(10);
  // Server-side pagination metadata for the performance table. The backend
  // now paginates the underlying responses query (skip/limit) rather than
  // returning the entire dataset, so `hasMore` drives whether "Next" is
  // enabled instead of a locally-computed page count.
  const [performanceHasMore, setPerformanceHasMore] = useState(false);
  const [responsesPage, setResponsesPage] = useState(1);
  const [responsesPageSize, setResponsesPageSize] = useState(20);
  const [responsesSearchTerm, setResponsesSearchTerm] = useState("");
  // Deferred value: lets the input update immediately while the expensive
  // filter computation (filteredResponses useMemo) only re-runs after the
  // browser has had a chance to paint the new input character.
  const deferredSearchTerm = useDeferredValue(responsesSearchTerm);

  // Lazy-loading-by-tab state. Nothing in `loadedTabs` fires on mount —
  // each tab's data is fetched the first time the user actually views it.
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "question" | "section" | "overall" | "responses"
  >("dashboard");
  const [loadedTabs, setLoadedTabs] = useState<Set<string>>(new Set());
  // Server-side paginated data for the Responses tab (replaces the old
  // client-side slice of the full `responses` array).
  const [tableResponses, setTableResponses] = useState<Response[]>([]);
  const [totalResponsesCount, setTotalResponsesCount] = useState(0);
  const [loadingTable, setLoadingTable] = useState(false);
  // Drives the dashboard's single loading spinner. True until the full
  // analytics response set (used by the trend chart, quality pie chart,
  // defect chart, etc.) has finished its first fetch. Starts true so the
  // spinner shows immediately on the default "dashboard" tab instead of a
  // flash of "No data" while the lazy fetch is still in flight.
  const [analyticsResponsesLoading, setAnalyticsResponsesLoading] = useState(true);

  // Determine if the current form being viewed is a child/follow-up form
  const isChildFollowUpForm = useMemo(() => {
    return Boolean(
      form?.parentFormId ||
      form?.parentForm ||
      form?.parentFormTitle ||
      (form as any)?.isChild ||
      (form as any)?.isChildForm ||
      (form as any)?.isFollowUp ||
      (form as any)?.type === "child" ||
      (form as any)?.type === "followup" ||
      (form as any)?.formType === "child" ||
      (form as any)?.formType === "followup" ||
      relatedFormData?.parentForm ||
      (tableResponses?.length > 0 && tableResponses.some((r: any) => r.parentFormId || r.parentResponseId || r.followUpStatus?.matchType === "parent" || r.parentMatch?.matchType === "parent")) ||
      (responses?.length > 0 && responses.some((r: any) => r.parentFormId || r.parentResponseId || r.followUpStatus?.matchType === "parent" || r.parentMatch?.matchType === "parent"))
    );
  }, [form, relatedFormData?.parentForm, tableResponses, responses]);



  // BIW Review — a second, independent accept/reject/rework check that any
  // reviewer (other than the response's own submitter) can apply from the
  // Responses table. Saved to the response via biwReview and rolled up into
  // its own "BIW Review Table" (mirrors the main Performance Table).
  const [biwSavingResponseId, setBiwSavingResponseId] = useState<string | null>(
    null,
  );
  const [biwReviewPage, setBiwReviewPage] = useState(1);
  const [biwReviewPageSize, setBiwReviewPageSize] = useState(10);
  const [isBulkBiwUpdating, setIsBulkBiwUpdating] = useState(false);
  const [showBiwBulkUpdateModal, setShowBiwBulkUpdateModal] = useState(false);
  const [biwBulkUpdateStatus, setBiwBulkUpdateStatus] = useState<"Accepted" | "Rejected" | "Reworked" | null>(null);
  const [biwBulkUpdateTargetIds, setBiwBulkUpdateTargetIds] = useState<string[]>([]);
  const [biwBulkUpdateSkippedCount, setBiwBulkUpdateSkippedCount] = useState(0);

  // NEW - BIW Review action popup (opens for Reject/Rework instead of
  // saving immediately): lets the reviewer pick which question(s) the
  // decision is about, add a remark, and attach evidence.
  const [showBiwActionModal, setShowBiwActionModal] = useState(false);
  const [biwActionResponse, setBiwActionResponse] = useState<Response | null>(null);
  const [biwActionStatus, setBiwActionStatus] = useState<"Rejected" | "Reworked" | null>(null);
  const [biwActionSelectedQuestionIds, setBiwActionSelectedQuestionIds] = useState<string[]>([]);
  const [biwActionRemark, setBiwActionRemark] = useState("");
  const [biwActionEvidenceUrl, setBiwActionEvidenceUrl] = useState("");
  const [biwActionUploading, setBiwActionUploading] = useState(false);
  const [isBiwActionSubmitting, setIsBiwActionSubmitting] = useState(false);

  // NEW - Eye icon "view" modal: read-only look at a saved BIW review
  // (status, flagged questions, remark, evidence).
  const [showBiwViewModal, setShowBiwViewModal] = useState(false);
  const [biwViewResponse, setBiwViewResponse] = useState<Response | null>(null);


  // Server-side pagination for the "Responses" table tab: fetches only the
  // current page directly from the backend instead of slicing an
  // already-loaded full dataset in memory (see fetchResponsesPage below).
  //
  // NOTE: the existing date/inspector/location/column/cascading filters
  // below are computed against the full in-memory `responses` array for the
  // charts and other analytics tabs. They are NOT (yet) sent to the backend,
  // so they won't filter this server-paginated table — only pagination
  // (page + page size) is server-side for now.
  const isLoadingTableResponses = loadingTable;

  // Gates the entire Dashboard tab behind a single spinner instead of
  // letting each chart/table independently render its own "No data yet"
  // state while the full analytics response set is still in flight.
  // Deliberately NOT tied to the top-level `loading` flag: that only
  // covers the initial form-details fetch (see fetchData), which now
  // resolves well before the dashboard's own lazy data finishes loading —
  // wiring it to `loading` would let the empty states flash through
  // exactly as before.
  const isChartLoading = analyticsResponsesLoading;

  // fetchPerformanceTable and fetchSummary are now plain functions (not
  // auto-firing effects) — they're invoked lazily from the tab-loading
  // effects further down, the first time the Dashboard tab is opened.
  const fetchPerformanceTable = async () => {
    if (!id || (user?.role !== "admin" && user?.role !== "superadmin"))
      return;

    setPerformanceTableLoading(true);
    try {
      const response = await apiClient.getPerformanceTable({
        startDate: dateFilter.startDate,
        endDate: dateFilter.endDate,
        formId: id,
        page: performancePage,
        limit: performancePageSize,
      });
      if (response.success) {
        setPerformanceTableData(response.data || []);
        setPerformanceHasMore(!!response.pagination?.hasMore);
      }
    } catch (error) {
      console.error("Error fetching performance table:", error);
      // Don't show error toast for performance table - it's not critical
      if (error instanceof Error && !error.message?.includes('timeout')) {
        showToast("Failed to load performance data", "error");
      }
    } finally {
      setPerformanceTableLoading(false);
    }
  };

  // Re-fetch on page/page-size/filter changes, but only once the Dashboard
  // tab has already been loaded at least once — the initial load is
  // triggered by the lazy-tab effect instead, so this avoids a duplicate
  // fetch racing it on first mount.
  useEffect(() => {
    if (loadedTabs.has("dashboard")) {
      fetchPerformanceTable();
    }
    // performancePage/performancePageSize are included so paging or
    // changing page size re-fetches from the server instead of slicing an
    // already-loaded full dataset in memory.
  }, [id, dateFilter.startDate, dateFilter.endDate, user?.role, performancePage, performancePageSize]);

  // Reset back to page 1 whenever the filters that change the underlying
  // dataset change, so the user isn't stranded on a page that no longer
  // exists for the new filter set.
  useEffect(() => {
    setPerformancePage(1);
  }, [id, dateFilter.startDate, dateFilter.endDate]);

  // Load performance scores from API
  useEffect(() => {
    const loadScores = async () => {
      try {
        const response = await apiClient.getPerformanceScores();
        if (response && response.data) {
          setPerformanceScores(response.data);
        }
      } catch (error) {
        console.error("Failed to load performance scores:", error);
        // Fallback to empty scores
        setPerformanceScores({});
      }
    };
    loadScores();
  }, []);

  // Initialize performance score for current user if not exists
  useEffect(() => {
    if (user?._id && !performanceScores[user._id]) {
      setPerformanceScores((prev) => ({
        ...prev,
        [user._id]: 100, // Start with 100%
      }));
    }
  }, [user?._id, performanceScores]);

  // Review system for peer evaluation
  const [selectedReviewOptions, setSelectedReviewOptions] = useState<
    Record<string, string>
  >(() => {
    try {
      const saved = localStorage.getItem("selectedReviewOptions");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [reviewedBy, setReviewedBy] = useState<
    Record<string, { id: string; name: string; email: string } | null>
  >(() => {
    try {
      const saved = localStorage.getItem("reviewedBy");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [reviewSubmitted, setReviewSubmitted] = useState<
    Record<string, boolean>
  >(() => {
    try {
      const saved = localStorage.getItem("reviewSubmitted");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [forceUpdate, setForceUpdate] = useState(0);
  const [pendingReviewOption, setPendingReviewOption] = useState<string | null>(
    null,
  ); // for Rejected/Rework question-selection flow

  // Save chatFilters suggestedAnswers to localStorage
  useEffect(() => {
    console.log(
      "suggestedAnswers changed:",
      Object.keys(chatFilters.suggestedAnswers || {}),
    );
    try {
      const filtersToSave = {
        suggestedAnswers: chatFilters.suggestedAnswers,
      };
      localStorage.setItem("chatFilters", JSON.stringify(filtersToSave));
    } catch (error) {
      console.error("Failed to save chatFilters:", error);
    }
  }, [chatFilters.suggestedAnswers]);

  // Save review states to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        "selectedReviewOptions",
        JSON.stringify(selectedReviewOptions),
      );
    } catch (error) {
      console.error("Failed to save selectedReviewOptions:", error);
    }
  }, [selectedReviewOptions]);

  useEffect(() => {
    try {
      localStorage.setItem("reviewedBy", JSON.stringify(reviewedBy));
    } catch (error) {
      console.error("Failed to save reviewedBy:", error);
    }
  }, [reviewedBy]);

  useEffect(() => {
    try {
      localStorage.setItem("reviewSubmitted", JSON.stringify(reviewSubmitted));
    } catch (error) {
      console.error("Failed to save reviewSubmitted:", error);
    }
  }, [reviewSubmitted]);

  const tenantId = useMemo(() => {
    // Get from form
    if (form?.tenantId) {
      return typeof form.tenantId === "object"
        ? form.tenantId._id
        : form.tenantId;
    }
    // Or from user
    if (user?.tenantId) {
      return typeof user.tenantId === "object"
        ? user.tenantId._id
        : user.tenantId;
    }
    return null;
  }, [form, user]);

  // Check if the current user belongs to the same tenant as the form.
  // Dispatch enable (bulk select) should only be available for form creator tenant users,
  // not for cross-tenant users or assigned/shared partner tenants.
  const isOwnTenantForm = useMemo(() => {
    if (user?.role === "superadmin") return true;
    if (!user) return false;

    const formCreatedById = form?.createdBy
      ? (typeof form.createdBy === "object" ? String((form.createdBy as any)._id || (form.createdBy as any).id) : String(form.createdBy))
      : null;
    const currentUserId = user._id || user.id ? String(user._id || user.id) : null;
    if (formCreatedById && currentUserId && formCreatedById === currentUserId) {
      return true;
    }

    const formTenantId = form?.tenantId
      ? (typeof form.tenantId === "object" ? String((form.tenantId as any)._id || (form.tenantId as any).id) : String(form.tenantId))
      : null;
    const userTenantId = user?.tenantId
      ? (typeof user.tenantId === "object" ? String((user.tenantId as any)._id || (user.tenantId as any).id) : String(user.tenantId))
      : null;

    // If the form has no tenant, only allow direct creator user or superadmin
    if (!formTenantId) {
      return Boolean(formCreatedById && currentUserId && formCreatedById === currentUserId);
    }
    return Boolean(userTenantId && formTenantId === userTenantId);
  }, [form, user]);

  // Dispatch bulk-select is allowed strictly for superadmins and form creator tenant admins.
  const canBulkDispatchResponses = canBulkSelectResponses && isOwnTenantForm;

  // Questionnaire tabs for Connected Forms review modal (Main Form vs Child Form)
  const reviewFormTabs = useMemo(() => {
    if (!chatResponse) return [];

    const isCheckpoint = (q: any) =>
      !q.parentId &&
      !q.showWhen?.questionId &&
      !q.isTrackingNumber &&
      !q.isChassisQuestion &&
      q.type !== "chassisNumber" &&
      !/^(chassis(\s*number)?|vin|frame(\s*number)?|identification(\s*number)?)$/i.test(String(q.text || q.title || "").trim());

    const parentFormObj = form?.parentForm?.sections?.length
      ? form.parentForm
      : relatedFormData.parentForm?.sections?.length
        ? relatedFormData.parentForm
        : (form?.parentForm || relatedFormData.parentForm);
    const rawChildDocs = (form?.childForms || []).map((cf: any) => {
      const found = (relatedFormData.childForms || []).find(
        (rf: any) => rf.id === (cf.formId || cf.id) || rf._id === (cf.formId || cf.id)
      );
      return found || cf;
    });
    const seenChildIds = new Set<string>();
    const childDocs = rawChildDocs.filter((cf: any) => {
      const cId = String(cf.formId || cf.id || cf._id || "");
      if (!cId || seenChildIds.has(cId)) return false;
      seenChildIds.add(cId);
      return true;
    });

    const tabs: Array<{
      id: string;
      title: string;
      badge: string;
      questions: any[];
      answers: Record<string, any>;
      responseId?: string;
      submittedBy?: string;
      formId?: string;
    }> = [];

    const hasParent = Boolean(
      form?.parentFormId ||
      form?.parentForm ||
      parentFormObj ||
      (chatResponse as any)?.parentFormId ||
      (chatResponse as any)?.parentFormTitle ||
      (chatResponse as any)?.parentAnswers ||
      (chatResponse as any)?.followUpStatus?.parentAnswers ||
      (chatResponse as any)?.followUpStatus?.matchType === "parent"
    );
    const hasChildren = childDocs.length > 0;

    const targetParentResponseId =
      (chatResponse as any)?.parentResponseId ||
      (chatResponse as any)?.followUpStatus?.parentResponseId ||
      relatedFormData.parentResponse?.id ||
      relatedFormData.parentResponse?._id;

    const targetParentSubmitter =
      (chatResponse as any)?.parentSubmittedBy ||
      (chatResponse as any)?.followUpStatus?.parentSubmittedBy ||
      relatedFormData.parentResponse?.submittedBy ||
      relatedFormData.parentResponse?.createdBy;

    const targetParentFormId =
      form?.parentFormId ||
      form?.parentForm?.id ||
      form?.parentForm?._id ||
      (chatResponse as any)?.parentFormId ||
      (chatResponse as any)?.followUpStatus?.parentFormId;

    const currentResponseId = chatResponse?.id || (chatResponse as any)?._id;
    const currentSubmitter = (chatResponse as any)?.submittedBy || (chatResponse as any)?.createdBy;
    const currentFormId = chatResponse?.questionId || id || form?.id || (form as any)?._id;

    if (hasParent) {
      // 1. Main Form Tab
      tabs.push({
        id: "main",
        title: parentFormObj?.title || (chatResponse as any)?.parentFormTitle || (form as any)?.parentFormTitle || "Main Form",
        badge: "Main Form",
        questions: (() => {
          const secQ = (parentFormObj?.sections || []).flatMap((s: any) =>
            (s.questions || []).filter(isCheckpoint)
          );
          if (secQ.length > 0) return secQ;
          return (parentFormObj?.questions || []).filter(isCheckpoint);
        })(),
        answers:
          (chatResponse as any)?.parentAnswers ||
          (chatResponse as any)?.followUpStatus?.parentAnswers ||
          relatedFormData.parentAnswers ||
          {},
        responseId: targetParentResponseId ? String(targetParentResponseId) : currentResponseId,
        submittedBy: targetParentSubmitter || "Parent Inspector",
        formId: targetParentFormId ? String(targetParentFormId) : undefined,
      });

      // 2. Child Form Tab
      tabs.push({
        id: "child",
        title: form?.title || "Child Form",
        badge: "Child Form",
        questions: (form?.sections || []).flatMap((s: any) =>
          (s.questions || []).filter(isCheckpoint)
        ),
        answers: (
          responses.find((r) => r.id === chatResponse?.id) ||
          tableResponses.find((r) => r.id === chatResponse?.id) ||
          chatResponse
        )?.answers || {},
        responseId: currentResponseId,
        submittedBy: currentSubmitter || "Child Inspector",
        formId: currentFormId ? String(currentFormId) : undefined,
      });
    } else if (hasChildren) {
      // 1. Main Form Tab
      tabs.push({
        id: "main",
        title: form?.title || "Main Form",
        badge: "Main Form",
        questions: (form?.sections || []).flatMap((s: any) =>
          (s.questions || []).filter(isCheckpoint)
        ),
        answers: (
          responses.find((r) => r.id === chatResponse?.id) ||
          tableResponses.find((r) => r.id === chatResponse?.id) ||
          chatResponse
        )?.answers || {},
        responseId: currentResponseId,
        submittedBy: currentSubmitter || "Main Inspector",
        formId: currentFormId ? String(currentFormId) : undefined,
      });

      // 2+. Child Form Tabs
      childDocs.forEach((cf: any, idx: number) => {
        const cId = cf.formId || cf.id || cf._id;
        const matchedChildResp = relatedFormData.childResponses?.[cId];
        tabs.push({
          id: `child-${cId || idx}`,
          title: cf.formTitle || cf.title || `Child Form ${idx + 1}`,
          badge: "Child Form",
          questions: (cf.sections || []).flatMap((s: any) =>
            (s.questions || []).filter(isCheckpoint)
          ),
          answers:
            matchedChildResp?.answers ||
            (chatResponse as any)?.childAnswers ||
            (chatResponse as any)?.followUpStatus?.childAnswers ||
            relatedFormData.childAnswers ||
            {},
          responseId: matchedChildResp?.id || matchedChildResp?._id || (chatResponse as any)?.childResponseId,
          submittedBy: matchedChildResp?.submittedBy || (chatResponse as any)?.childSubmittedBy || "Child Inspector",
          formId: cId ? String(cId) : undefined,
        });
      });
    } else {
      // Standalone form
      tabs.push({
        id: "current",
        title: form?.title || "Form",
        badge: "Form",
        questions: (form?.sections || []).flatMap((s: any) =>
          (s.questions || []).filter(isCheckpoint)
        ),
        answers: (
          responses.find((r) => r.id === chatResponse?.id) ||
          tableResponses.find((r) => r.id === chatResponse?.id) ||
          chatResponse
        )?.answers || {},
        responseId: currentResponseId,
        submittedBy: currentSubmitter || "Inspector",
        formId: currentFormId ? String(currentFormId) : undefined,
      });
    }

    return tabs;
  }, [form, relatedFormData, chatResponse, responses, tableResponses, id]);

  const handleReviewSubmit = async (
    responseId: string,
    reviewOption: string,
    reviewRemark?: string,
    overrideSubmitterId?: string,
    overrideFormId?: string,
  ) => {
    console.log("=== HANDLE REVIEW SUBMIT START ===");
    console.log("responseId:", responseId);
    console.log("reviewOption:", reviewOption);

    // Get reviewerId properly
    let reviewerId = user?._id || user?.id;
    if (!reviewerId) {
      try {
        const token = localStorage.getItem("auth_token");
        if (token) {
          const payload = JSON.parse(atob(token.split(".")[1]));
          reviewerId = payload.userId || payload.id;
        }
      } catch (e) {
        console.error("Failed to parse token:", e);
      }
    }

    if (!reviewerId) {
      showToast("Cannot submit review. User ID not found.", "error");
      return;
    }

    if (!chatResponse) return;

    let submitterId = overrideSubmitterId || (chatResponse as any).submittedBy;

    if (!submitterId && chatResponse.createdBy) {
      if (typeof chatResponse.createdBy === "object") {
        submitterId =
          (chatResponse.createdBy as any)._id ||
          (chatResponse.createdBy as any).id;
      } else {
        submitterId = chatResponse.createdBy;
      }
    }

    if (!submitterId) {
      showToast(
        "Cannot submit review. Missing submitter information.",
        "error",
      );
      return;
    }

    // Enforce assigned tenant and anti-tamper permissions
    const reviewAuth = canUserBiwReview(chatResponse);
    if (!reviewAuth.canReview) {
      showToast(reviewAuth.reason || "You are not authorized to review this chassis", "error");
      return;
    }

    // Only prevent reviews for invalid draft/deleted states
    const responseStatus = responseStatuses[responseId] || (chatResponse as any)?.status || "pending";
    const invalidStatusesForReview = ["draft", "deleted"];
    if (invalidStatusesForReview.includes(String(responseStatus).toLowerCase())) {
      showToast("This response status cannot be reviewed", "error");
      return;
    }

    // Rejection reason is strictly mandatory
    if (reviewOption === "Rejected" && !reviewRemark?.trim()) {
      showToast("Rejection reason is mandatory. Please enter your reason in the Message Center.", "error");
      return;
    }

    try {
      setPendingReviewOption(null);

      const parentFormDoc = form?.parentForm?.sections?.length ? form.parentForm : relatedFormData.parentForm;
      const childDocs = (form?.childForms || []).map((cf: any) => {
        const found = (relatedFormData.childForms || []).find(
          (rf: any) => rf.id === (cf.formId || cf.id) || rf._id === (cf.formId || cf.id)
        );
        return found || cf;
      });

      const allFormQuestions = [
        ...(form?.sections?.flatMap((s: any) => s.questions || []) || []),
        ...(parentFormDoc?.sections?.flatMap((s: any) => s.questions || []) || []),
        ...(childDocs.flatMap((cf: any) => cf.sections?.flatMap((s: any) => s.questions || []) || []) || []),
      ];
      const flaggedFromFilters = (chatFilters.questions || []).map((qId) => {
        const qObj = allFormQuestions.find((q: any) => String(q.id) === String(qId));
        return {
          questionId: qId,
          questionText: qObj?.title || qObj?.text || qId,
        };
      });

      const flaggedQuestions = flaggedFromFilters.length > 0
        ? flaggedFromFilters
        : Array.isArray((chatResponse?.review as any)?.flaggedQuestions)
          ? (chatResponse?.review as any).flaggedQuestions
          : [];

      const reviewData = {
        responseId,
        reviewerId: reviewerId,
        submitterId: submitterId,
        reviewOption,
        tenantId: tenantId,
        remark: reviewRemark?.trim() || "",
        reason: reviewRemark?.trim() || "",
        flaggedQuestions,
        formId: overrideFormId || (chatResponse as any)?.questionId || id,
      };

      console.log("📤 Submitting review with data:", reviewData);

      const result = await apiClient.submitReview(reviewData);

      console.log("📥 Review API response:", result);

      // ✅ Check if successful
      if (result && result.success) {
        const isClearAction = reviewOption === "Clear" || reviewOption === "Undo";
        console.log(isClearAction ? "✅ Review undone successfully!" : "✅ Review submitted successfully!");

        if (isClearAction) {
          const clearReviewFn = (r: any) => {
            if (r.id === responseId || (r as any)._id === responseId) {
              const nextR = { ...r };
              delete nextR.review;
              return nextR;
            }
            return r;
          };
          setTableResponses((prev) => prev.map(clearReviewFn));
          setResponses((prev) => prev.map(clearReviewFn));
          setChatResponse((prev) => (prev ? clearReviewFn(prev) : prev));
          setTvsReviews((prev) => prev.filter((rv) => String(rv.responseId || rv.response_id || "") !== String(responseId)));
          setSelectedReviewOptions((prev) => ({ ...prev, [responseId]: "" }));
          setReviewedBy((prev) => ({ ...prev, [responseId]: null }));
          setChatFilters((prev) => ({ ...prev, questions: [] }));

          try {
            for (let i = sessionStorage.length - 1; i >= 0; i--) {
              const k = sessionStorage.key(i);
              if (k && k.includes('quality_summary')) sessionStorage.removeItem(k);
            }
            for (let i = localStorage.length - 1; i >= 0; i--) {
              const k = localStorage.key(i);
              if (k && k.includes('quality_summary')) localStorage.removeItem(k);
            }
          } catch (_) { }

          fetchSummary();
          fetchPerformanceTable();
          await fetchChatHistory(responseId);
          setForceUpdate((prev) => prev + 1);
          showToast(result.message || "TVS Review undone", "success");
          return;
        }

        const reviewerDisplayName = user?.name || user?.username || user?.email || "Reviewer";
        const newStatus = reviewOption === "Rejected"
          ? "Rejected"
          : (reviewOption === "Rework" || reviewOption === "Reworked")
            ? "Rework 1"
            : "Accepted";

        const updateReviewFn = (r: any) => {
          if (r.id === responseId || (r as any)._id === responseId) {
            const curRev = r.review || {};
            return {
              ...r,
              status: newStatus,
              review: {
                ...curRev,
                status: reviewOption,
                reviewOption: reviewOption,
                reviewer: reviewerDisplayName,
                reviewerName: reviewerDisplayName,
                reviewedByName: reviewerDisplayName,
                reviewedAt: new Date().toISOString(),
                remark: reviewRemark?.trim() || curRev.remark || "",
                reason: reviewRemark?.trim() || curRev.reason || "",
                flaggedQuestions,
              },
            };
          }
          return r;
        };
        setTableResponses((prev) => prev.map(updateReviewFn));
        setResponses((prev) => prev.map(updateReviewFn));
        setChatResponse((prev) => (prev ? updateReviewFn(prev) : prev));
        setChatFilters((prev) => ({ ...prev, questions: [] }));

        // Invalidate browser-level cached summary items
        try {
          for (let i = sessionStorage.length - 1; i >= 0; i--) {
            const k = sessionStorage.key(i);
            if (k && k.includes('quality_summary')) sessionStorage.removeItem(k);
          }
          for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (k && k.includes('quality_summary')) localStorage.removeItem(k);
          }
        } catch (_) { }

        fetchSummary();
        fetchPerformanceTable();
        setTvsReviews((prev) => {
          const filtered = prev.filter(rv => String(rv.responseId || rv.response_id || "") !== String(responseId));
          return [
            ...filtered,
            {
              id: responseId,
              _id: responseId,
              responseId,
              reviewOption,
              option: reviewOption,
              status: reviewOption,
              reviewer: { id: reviewerId, name: reviewerDisplayName, email: user?.email || "" },
              remark: reviewRemark?.trim() || "",
              reason: reviewRemark?.trim() || "",
              flaggedQuestions,
              questionContexts: flaggedQuestions.map((fq: any) => ({
                questionId: fq.questionId || fq.id,
                id: fq.questionId || fq.id,
                title: fq.questionText || fq.title || fq.text,
                text: fq.questionText || fq.title || fq.text,
              })),
              createdAt: new Date().toISOString()
            }
          ];
        });

        // Also sync review to parent response if parent questions were flagged
        const parentRespId = (chatResponse as any)?.parentResponseId || (chatResponse as any)?.followUpStatus?.parentResponseId;
        const parentQIds = (parentFormDoc?.sections || []).flatMap((s: any) => (s.questions || []).map((q: any) => q.id));
        const parentFlagged = flaggedQuestions.filter((fq: any) => parentQIds.includes(fq.questionId));
        if (parentRespId && parentFlagged.length > 0) {
          apiClient.submitReview({
            ...reviewData,
            responseId: parentRespId,
            flaggedQuestions: parentFlagged,
          }).catch((pErr: any) => console.warn("Parent review sync error:", pErr));
        }

        setSelectedReviewOptions((prev) => ({
          ...prev,
          [responseId]: reviewOption,
        }));
        setReviewedBy((prev) => ({
          ...prev,
          [responseId]: {
            id: String(reviewerId),
            name: reviewerDisplayName,
            email: user?.email || "",
            option: reviewOption,
            status: reviewOption,
          } as any,
        }));
        setReviewSubmitted((prev) => ({
          ...prev,
          [`${reviewerId}-${responseId}`]: true,
        }));

        // Refresh chat history to get the new review
        await fetchChatHistory(responseId);
        setForceUpdate((prev) => prev + 1);

        showToast(
          result.message || `Review submitted: ${reviewOption}`,
          "success",
        );
      } else {
        console.error("❌ Review submission failed:", result);
        showToast(result?.message || "Failed to submit review", "error");
      }
    } catch (error: any) {
      console.error("❌ Review submission error:", error);
      showToast(error.message || "Failed to submit review", "error");
    }
  };


  const [selectedResponse, setSelectedResponse] = useState<Response | null>(
    null,
  );
  const [selectedFormForModal, setSelectedFormForModal] = useState<Form | null>(
    null,
  );
  const [formLoading, setFormLoading] = useState(false);
  const [comparisonViewMode, setComparisonViewMode] = useState<
    "dashboard" | "responses"
  >("dashboard");
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [inspectorSummary, setInspectorSummary] = useState<any[]>([]);
  const [expandedInspectorForms, setExpandedInspectorForms] = useState<
    Set<string>
  >(new Set());
  const [allInspectors, setAllInspectors] = useState<any[]>([]);
  const [summaryStatuses, setSummaryStatuses] = useState<string[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [chartOrientation, setChartOrientation] = useState<"v" | "h">("v");
  const [timeSeriesView, setTimeSeriesView] = useState<"daily" | "monthly">(
    "daily",
  );
  const [chartSortOrder, setChartSortOrder] = useState<
    "default" | "percentage"
  >("percentage");

  const activeGlobalFilterCount = useMemo(() => {
    let count = 0;
    Object.values(cascadingFilters).forEach((answers) => {
      if (answers && answers.length > 0) count++;
    });
    if (locationFilter && locationFilter.length > 0) count++;
    if (
      dateFilter.type !== "all" &&
      (dateFilter.startDate || dateFilter.endDate)
    )
      count++;
    Object.values(columnFilters).forEach((values) => {
      if (values && values.length > 0) count++;
    });
    return count;
  }, [cascadingFilters, locationFilter, dateFilter, columnFilters]);

  const complianceLabels = useMemo(() => {
    const defaultLabels = { yes: "Yes", no: "No", na: "N/A" };
    const labels = { ...defaultLabels };

    // Check if the form has any inspection status based questions
    let hasInspectionQuestions = false;

    // Check form title for inspection keywords
    if (
      form?.title?.toLowerCase().includes("inspection") ||
      form?.title?.toLowerCase().includes("chassis") ||
      form?.title?.toLowerCase().includes("pdi") ||
      form?.title?.toLowerCase().includes("rework") ||
      form?.title?.toLowerCase().includes("accepted") ||
      form?.title?.toLowerCase().includes("rejected") ||
      form?.title?.toLowerCase().includes("verified")
    ) {
      hasInspectionQuestions = true;
    }

    if (!hasInspectionQuestions && form?.sections) {
      for (const section of form.sections) {
        // Check section title
        const sectionTitle = section.title?.toLowerCase() || "";
        if (
          sectionTitle.includes("inspection") ||
          sectionTitle.includes("chassis") ||
          sectionTitle.includes("rework") ||
          sectionTitle.includes("accepted") ||
          sectionTitle.includes("rejected") ||
          sectionTitle.includes("verified")
        ) {
          hasInspectionQuestions = true;
          break;
        }

        if (section.questions) {
          for (const question of section.questions) {
            // Check for ChassisWithZone or similar that might not have a specific type but we handle as status objects
            if (
              question.type === "chassisWithZone" ||
              question.type === "chassisWithoutZone" ||
              question.type === "chassis" ||
              question.type === "zone-in" ||
              question.type === "zone-out" ||
              question.text?.toLowerCase().includes("chassis") ||
              question.text?.toLowerCase().includes("inspection") ||
              question.text?.toLowerCase().includes("accepted") ||
              question.text?.toLowerCase().includes("rework") ||
              question.options?.some((opt) => {
                const o = String(opt).toLowerCase();
                return (
                  o.includes("accepted") ||
                  o.includes("rejected") ||
                  o.includes("rework") ||
                  o.includes("re-rework")
                );
              })
            ) {
              hasInspectionQuestions = true;
              break;
            }
          }
        }
        if (hasInspectionQuestions) break;
      }
    }

    if (hasInspectionQuestions) {
      return { yes: "Accepted", no: "Rejected", na: "Rework" };
    }

    // Check if the responses contain any inspection status objects
    if (!hasInspectionQuestions && responses && responses.length > 0) {
      for (const response of responses) {
        if (response.answers) {
          for (const answer of Object.values(response.answers)) {
            if (
              typeof answer === "object" &&
              answer !== null &&
              (answer as any).status
            ) {
              const status = String((answer as any).status)
                .toLowerCase()
                .trim();
              if (
                [
                  "accepted",
                  "rejected",
                  "rework",
                  "reworked",
                  "verified",
                  "rework completed",
                ].includes(status) ||
                status.includes("re-rework")
              ) {
                hasInspectionQuestions = true;
                break;
              }
            }
          }
        }
        if (hasInspectionQuestions) break;
      }
    }

    if (hasInspectionQuestions) {
      return { yes: "Accepted", no: "Rejected", na: "Rework" };
    }

    if (form?.sections) {
      for (const section of form.sections) {
        if (section.questions) {
          for (const question of section.questions) {
            if (
              question.type === "yesNoNA" &&
              question.options &&
              question.options.length >= 2
            ) {
              const hasCustomLabels =
                question.options[0] !== "Yes" ||
                question.options[1] !== "No" ||
                (question.options[2] && question.options[2] !== "N/A");

              if (hasCustomLabels) {
                return {
                  yes: question.options[0] || "Yes",
                  no: question.options[1] || "No",
                  na: question.options[2] || "N/A",
                };
              }

              if (labels.yes === "Yes") {
                labels.yes = question.options[0] || "Yes";
                labels.no = question.options[1] || "No";
                labels.na = question.options[2] || "N/A";
              }
            }
          }
        }
      }
    }
    return labels;
  }, [form, responses]);

  // Was an auto-firing useEffect keyed on [user, id]; now a plain function
  // invoked lazily the first time the Dashboard tab is opened (see the
  // tab-loading effects below), so it no longer fires on mount regardless
  // of which tab the user lands on.
  const fetchSummary = async () => {
    if (!user) return;
    setSummaryLoading(true);
    try {
      let url = "/analytics/inspector-summary";
      if (id) {
        url += `?formId=${id}`;
      }

      const hierarchyPromise = apiClient.getCachedData<any>("/users/hierarchy?role=Inspector")
        ? Promise.resolve(apiClient.getCachedData<any>("/users/hierarchy?role=Inspector"))
        : apiClient.getUsersHierarchy({ role: "Inspector" }).then(res => {
          return res;
        }).catch(() => ({ users: [] }));

      const [summaryRes, hierarchyRes] = await Promise.all([
        apiClient.get<any>(url),
        hierarchyPromise,
      ]);

      if (summaryRes.data) {
        setInspectorSummary(summaryRes.data.summary || []);
        setSummaryStatuses(summaryRes.data.allStatuses || []);
      }

      if (hierarchyRes?.users) {
        setAllInspectors(hierarchyRes.users);
      }
    } catch (error) {
      console.error("Error fetching inspector data:", error);
    } finally {
      setSummaryLoading(false);
    }
  };

  const filteredInspectorSummary = useMemo(() => {
    let result = [...inspectorSummary];

    if (dateFilter.startDate || dateFilter.endDate) {
      result = result.filter((item) => {
        if (!item.date) return true;
        try {
          const itemDate = toLocalDateString(item.date);
          if (!itemDate) return true;
          if (dateFilter.startDate && dateFilter.endDate) {
            return (
              itemDate >= dateFilter.startDate && itemDate <= dateFilter.endDate
            );
          } else if (dateFilter.startDate) {
            return itemDate >= dateFilter.startDate;
          } else if (dateFilter.endDate) {
            return itemDate <= dateFilter.endDate;
          }
        } catch (e) {
          return true;
        }
        return true;
      });
    }

    if (selectedInspectorForTrend !== "Overall") {
      result = result.filter(
        (item) =>
          item.qcInspector === selectedInspectorForTrend ||
          item.submittedBy === selectedInspectorForTrend,
      );
    }

    return result;
  }, [
    inspectorSummary,
    dateFilter.startDate,
    dateFilter.endDate,
    selectedInspectorForTrend,
  ]);

  const groupedInspectorSummary = useMemo(() => {
    const groups: Record<string, any> = {};
    filteredInspectorSummary.forEach((item) => {
      const title = item.formTitle || "N/A";
      if (!groups[title]) {
        groups[title] = {
          formTitle: title,
          tenantName: item.tenantName,
          totalInspection: 0,
          statusCounts: {},
          subItems: [],
        };
      }
      groups[title].totalInspection += item.totalInspection;
      Object.entries(item.statusCounts || {}).forEach(([status, count]) => {
        groups[title].statusCounts[status] =
          (groups[title].statusCounts[status] || 0) + (count as number);
      });
      groups[title].subItems.push(item);
    });
    return Object.values(groups);
  }, [filteredInspectorSummary]);





  const fetchData = async () => {
    console.log(
      "[ANALYTICS] fetchData called with ID:",
      id,
      "isGuest:",
      isGuest,
    );
    if (!id) return;

    // Guest access check
    if (isGuest) {
      const guestToken = localStorage.getItem("guest_auth_token");
      const guestFormId = localStorage.getItem("guest_form_id");
      const guestExpiresAt = localStorage.getItem("guest_expires_at");

      const isExpired = guestExpiresAt
        ? new Date() > new Date(guestExpiresAt)
        : true;

      if (!guestToken || guestFormId !== id || isExpired) {
        localStorage.removeItem("guest_auth_token");
        localStorage.removeItem("guest_email");
        localStorage.removeItem("guest_form_id");
        localStorage.removeItem("guest_expires_at");
        navigate(`/forms/${id}/analytics/login`);
        return;
      }
    }

    try {
      setLoading(true);
      setError(null); // Clear any previous errors

      const formCacheKey = `/forms/${id}`;
      console.log("[ANALYTICS DEBUG] Fetching form details:", id);

      // Fetch form details
      const formData = await apiClient.request<{ form: any }>(formCacheKey, {
        forceNetwork: true,
        timeout: 60000, // 60 seconds for form data
      });

      if (formData && formData.form) {
        setForm(formData.form);
        console.log("[ANALYTICS DEBUG] Form fetched:", formData.form?.title);

        if (formData.form.parentForm) {
          setRelatedFormData((prev) => ({ ...prev, parentForm: formData.form.parentForm }));
        }

        if (formData.form?.sections && formData.form.sections.length > 0) {
          setSelectedResponsesSectionIds(
            formData.form.sections.map((s: Section) => s.id),
          );
        }
      }

      // Reset retry count on success
      setRetryCount(0);

    } catch (err) {
      console.error("Error fetching analytics data:", err);

      // Better error messaging for timeouts
      let errorMessage = "Failed to load analytics";
      if (err instanceof Error) {
        if (err.message?.includes('timeout') || err.name === 'AbortError') {
          errorMessage = 'The data is taking too long to load. This might be due to a large dataset or server load. Please try again.';
        } else {
          errorMessage = err.message;
        }
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;

    // SWR: Check if we have recent analytics data for this form to display instantly
    let cached = formAnalyticsMemoryCache.get(id);
    if (!cached) {
      try {
        const stored = sessionStorage.getItem(`form_analytics_cache_${id}`) || localStorage.getItem(`form_analytics_cache_${id}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Date.now() - parsed.timestamp < 1800000) {
            cached = parsed;
            formAnalyticsMemoryCache.set(id, parsed);
          }
        }
      } catch (_) { }
    }
    if (cached && Date.now() - cached.timestamp < 1800000) {
      setForm(cached.form);
      setResponses(cached.responses);
      setTableResponses(cached.tableResponses);
      setLoading(false);
      setAnalyticsResponsesLoading(false);
      if (cached.form?.sections && cached.form.sections.length > 0) {
        setSelectedResponsesSectionIds(
          cached.form.sections.map((s: Section) => s.id),
        );
      }
      // Revalidate in background
      fetchData();
    } else {
      // If we have any cached data even older than 30m, keep it while refetching
      if (cached?.form) {
        setForm(cached.form);
        if (cached.responses?.length) setResponses(cached.responses);
      } else {
        setForm(null);
        setResponses([]);
      }
      setTableResponses([]);
      setTvsReviews([]);
      setLoadedTabs(new Set());
      setPerformanceTableData([]);
      setInspectorSummary([]);
      fetchedReviewIdsSetRef.current.clear();
      fetchData();
    }
  }, [id]);

  // Update memory cache whenever form data or responses finish loading
  useEffect(() => {
    if (id && form) {
      const payload = {
        form,
        responses,
        tableResponses,
        timestamp: Date.now(),
      };
      formAnalyticsMemoryCache.set(id, payload);
      if (!analyticsResponsesLoading && responses.length > 0) {
        try {
          const compactPayload = {
            form,
            responses: responses.slice(0, 300),
            tableResponses: tableResponses.slice(0, 100),
            timestamp: Date.now(),
          };
          const json = JSON.stringify(compactPayload);
          sessionStorage.setItem(`form_analytics_cache_${id}`, json);
          localStorage.setItem(`form_analytics_cache_${id}`, json);
        } catch (_) { }
      }
    }
  }, [id, form, responses, tableResponses, analyticsResponsesLoading]);

  // ── Lazy loading by tab ──────────────────────────────────────────────
  // Fetches the FULL analytics response set (used by Dashboard/Question/
  // Section/Overall for charts, status calc, exports, BIW review, etc).
  // The backend now paginates analytics requests (500 rows/page) instead
  // of returning a form's entire history in one unbounded query, and this
  // streams each page into `responses` as it lands via onPage - so on a
  // large form, the Status column and charts start filling in after the
  // first page (a couple seconds) instead of everything staying blank/
  // "Loading…" until the last page of a multi-minute single request.
  //
  // Note: responseStatuses groups responses by tracked item (e.g. chassis
  // number) to compute sequential rework status, which needs every page
  // to be in for a group to be 100% correct - so a row's status can
  // shift slightly as later pages arrive if its sibling responses land in
  // a subsequent page. It settles once analyticsResponsesLoading goes
  // false. This is still strictly better than the old all-or-nothing
  // wait, and most forms will have all of an item's responses within the
  // same page anyway since pages are sorted by createdAt.
  const loadedDateKeyRef = useRef<string | null>(null);

  const fetchFullAnalyticsResponses = async (overrideDateFilter?: { type: "all" | "single" | "range"; startDate: string; endDate: string }) => {
    if (!id) return;
    setAnalyticsResponsesLoading(true);
    let accumulator: any[] = [];
    try {
      const df = overrideDateFilter || dateFilter;
      const currentBatchId = searchParams.get("batchId");
      const isUploadOnly = searchParams.get("uploadOnly") === "true";
      const currentDispatch = searchParams.get("dispatch") || searchParams.get("dispatchStatus");
      const currentTvsStatus = searchParams.get("tvsStatus");
      const currentBiwStatus = searchParams.get("biwStatus");
      const currentStatus = searchParams.get("status");
      const isDerivedStatus = ["rework accepted", "rework completed", "direct ok"].includes((currentStatus || "").toLowerCase().trim());
      const currentSubmittedBy = searchParams.get("submittedBy");
      const currentBiwReviewedBy = searchParams.get("biwReviewedBy");
      const currentReviewedCombined = searchParams.get("reviewedCombined");
      const currentStartDate = searchParams.get("startDate") || (df.type !== "all" ? df.startDate : "");
      const currentEndDate = searchParams.get("endDate") || (df.type !== "all" ? df.endDate : "");
      loadedDateKeyRef.current = `${id}|${df.type}|${currentStartDate}|${currentEndDate}`;
      const responsesData = await apiClient.getAllFormResponses(id, {
        analytics: true,
        forceNetwork: true,
        ...(currentBatchId ? { batchId: currentBatchId } : {}),
        ...(isUploadOnly ? { uploadOnly: true } : {}),
        ...(currentDispatch ? { dispatch: currentDispatch } : {}),
        ...(currentTvsStatus ? { tvsStatus: currentTvsStatus } : {}),
        ...(currentBiwStatus ? { biwStatus: currentBiwStatus } : {}),
        ...(currentStatus && !isDerivedStatus ? { status: currentStatus } : {}),
        ...(currentSubmittedBy ? { submittedBy: currentSubmittedBy } : {}),
        ...(currentBiwReviewedBy ? { biwReviewedBy: currentBiwReviewedBy } : {}),
        ...(currentReviewedCombined ? { reviewedCombined: currentReviewedCombined } : {}),
        ...(currentStartDate ? { startDate: currentStartDate } : {}),
        ...(currentEndDate ? { endDate: currentEndDate } : {}),
        onPage: ({ responses: pageResponses, pageNumber, totalPages, totalResponses, isLast }: {
          responses: any[];
          pageNumber: number;
          totalPages: number;
          totalResponses?: number;
          isLast: boolean;
        }) => {
          accumulator = accumulator.concat(pageResponses);
          setResponses([...accumulator]);
          if (totalResponses && totalResponses > 0) {
            setTotalResponsesCount(totalResponses);
          } else if (accumulator.length > 0) {
            setTotalResponsesCount((prev) => Math.max(prev, accumulator.length));
          }
          if (isLast) {
            setAnalyticsResponsesLoading(false);
          }
        },
      });
      if (responsesData.responses && responsesData.responses.length > 0) {
        setResponses(responsesData.responses);
        setTotalResponsesCount(responsesData.responses.length);
      }
    } catch (err) {
      console.error("Error fetching full analytics responses:", err);
      showToast("Failed to load analytics data. Please try again.", "error");
    } finally {
      setAnalyticsResponsesLoading(false);
    }
  };

  // Fetches a single page of responses directly from the backend for the
  // Responses tab, instead of slicing an already-loaded full dataset in
  // memory. This is the server-side pagination required for large
  // (2000+) response forms.
  const fetchResponsesPage = async (page: number) => {
    if (!id) return;
    setLoadingTable(true);
    try {
      const currentBatchId = searchParams.get("batchId");
      const isUploadOnly = searchParams.get("uploadOnly") === "true";
      const currentUnits = searchParams.get("units") || searchParams.get("identificationNumber") || searchParams.get("chassisNumber");
      const currentDispatch = searchParams.get("dispatch") || searchParams.get("dispatchStatus");
      const currentTvsStatus = searchParams.get("tvsStatus");
      const currentBiwStatus = searchParams.get("biwStatus");
      const currentStatus = searchParams.get("status");
      const isDerivedStatus = ["rework accepted", "rework completed", "direct ok"].includes((currentStatus || "").toLowerCase().trim());
      const currentSubmittedBy = searchParams.get("submittedBy");
      const currentBiwReviewedBy = searchParams.get("biwReviewedBy");
      const currentReviewedCombined = searchParams.get("reviewedCombined");
      const currentStartDate = searchParams.get("startDate") || (dateFilter.type !== "all" ? dateFilter.startDate : "");
      const currentEndDate = searchParams.get("endDate") || (dateFilter.type !== "all" ? dateFilter.endDate : "");
      const data = await apiClient.getFormResponses(id, {
        page: page,
        limit: responsesPageSize,
        analytics: false,
        forceNetwork: true,
        ...(currentBatchId ? { batchId: currentBatchId } : {}),
        ...(isUploadOnly ? { uploadOnly: true } : {}),
        ...(currentDispatch ? { dispatch: currentDispatch } : {}),
        ...(currentTvsStatus ? { tvsStatus: currentTvsStatus } : {}),
        ...(currentBiwStatus ? { biwStatus: currentBiwStatus } : {}),
        ...(currentStatus && !isDerivedStatus ? { status: currentStatus } : {}),
        ...(currentSubmittedBy ? { submittedBy: currentSubmittedBy } : {}),
        ...(currentBiwReviewedBy ? { biwReviewedBy: currentBiwReviewedBy } : {}),
        ...(currentReviewedCombined ? { reviewedCombined: currentReviewedCombined } : {}),
        ...(currentStartDate ? { startDate: currentStartDate } : {}),
        ...(currentEndDate ? { endDate: currentEndDate } : {}),
      });
      setTableResponses(data.responses || []);
      setTotalResponsesCount(data.pagination?.totalResponses || 0);

      if (data.form) {
        setForm((prev: any) => {
          const mergedParentForm = data.form.parentForm?.sections?.length
            ? data.form.parentForm
            : prev?.parentForm?.sections?.length
              ? prev.parentForm
              : (data.form.parentForm || prev?.parentForm);
          return {
            ...(prev || {}),
            ...data.form,
            parentFormId: data.form.parentFormId || prev?.parentFormId,
            parentFormTitle: data.form.parentFormTitle || prev?.parentFormTitle,
            isChildForm: data.form.isChildForm ?? prev?.isChildForm,
            isParentForm: data.form.isParentForm ?? prev?.isParentForm,
            parentForm: mergedParentForm,
          };
        });
        if (data.form.parentForm?.sections?.length) {
          setRelatedFormData((prev) => ({ ...prev, parentForm: data.form.parentForm }));
        }
      }
    } catch (err) {
      console.error("Error fetching responses page:", err);
      showToast("Failed to load responses. Please try again.", "error");
    } finally {
      setLoadingTable(false);
    }
  };

  // Invalidate any stale responses cache when mounting a form's analytics dashboard
  useEffect(() => {
    if (id) {
      apiClient.invalidateFormsCache();
    }
  }, [id]);

  // Keep activeTab in sync with analyticsView (existing tab buttons already
  // set analyticsView; this propagates that choice into the lazy-loading
  // tab tracker below without needing to touch every button's onClick).
  useEffect(() => {
    const knownTabs = ["dashboard", "responses"] as const;
    const tab = (knownTabs as readonly string[]).includes(analyticsView)
      ? (analyticsView as typeof activeTab)
      : "dashboard";
    setActiveTab(tab);
  }, [analyticsView]);

  // Dashboard tab: inspector summary + performance table + the full
  // analytics response set. Always refresh summary & performance when viewing dashboard.
  useEffect(() => {
    if (activeTab === "dashboard" && id) {
      fetchSummary();
      fetchPerformanceTable();
      const dfStart = searchParams.get("startDate") || (dateFilter.type !== "all" ? dateFilter.startDate : "");
      const dfEnd = searchParams.get("endDate") || (dateFilter.type !== "all" ? dateFilter.endDate : "");
      const nextDateKey = `${id}|${dateFilter.type}|${dfStart}|${dfEnd}`;
      if (!loadedTabs.has("dashboard") || (loadedDateKeyRef.current && loadedDateKeyRef.current !== nextDateKey)) {
        fetchFullAnalyticsResponses();
        setLoadedTabs((prev) => new Set(prev).add("dashboard"));
      }
    }
  }, [activeTab, id, dateFilter.type, dateFilter.startDate, dateFilter.endDate]);

  // ── Real-time Socket.IO Connection ───────────────────────────────────────────
  // Subscribes to the form's analytics room ('form-analytics-${id}') to receive
  // instant updates when any response is created, updated (status/BIW/dispatch),
  // deleted, or batch-imported from anywhere in the system.
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const responsesPageRef = useRef(responsesPage);
  responsesPageRef.current = responsesPage;

  useEffect(() => {
    if (!id) return;

    const getSocketUrl = () => {
      const apiBase = apiClient.getBaseUrl();
      if (apiBase) {
        return apiBase.replace(/\/api\/?$/, "");
      }
      return window.location.origin;
    };

    const socketUrl = getSocketUrl();
    const socket = io(socketUrl, {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      transports: ["websocket", "polling"],
      withCredentials: true,
    });

    socket.on("connect", () => {
      console.log(`✅ [FormAnalytics] Connected to socket, joining room: form-analytics-${id}`);
      socket.emit("join-form-analytics", id);
    });

    let debounceTimer: any = null;
    const debouncedRefreshMetrics = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchSummary();
        fetchPerformanceTable();
      }, 800);
    };

    socket.on("response-created", (data: any) => {
      if (!data || !data.response) return;
      const newResp = data.response;
      const targetFormId = String(data.formId || newResp.formId || newResp.questionId || "");
      if (targetFormId && targetFormId !== String(id)) return;

      console.log("🔔 [FormAnalytics] Real-time response-created received:", newResp.id || newResp._id);

      const newRespId = newResp.id || newResp._id;
      setResponses((prev) => {
        const exists = prev.some((r) => (r.id && r.id === newRespId) || ((r as any)._id && (r as any)._id === newRespId));
        if (exists) {
          return prev.map((r) => ((r.id && r.id === newRespId) || ((r as any)._id && (r as any)._id === newRespId)) ? { ...r, ...newResp } : r);
        }
        return [newResp, ...prev];
      });

      setTableResponses((prev) => {
        const exists = prev.some((r) => (r.id && r.id === newRespId) || ((r as any)._id && (r as any)._id === newRespId));
        if (exists) {
          return prev.map((r) => ((r.id && r.id === newRespId) || ((r as any)._id && (r as any)._id === newRespId)) ? { ...r, ...newResp } : r);
        }
        return [newResp, ...prev];
      });

      setTotalResponsesCount((prev) => prev + 1);
      debouncedRefreshMetrics();
    });

    socket.on("response-updated", (data: any) => {
      if (!data) return;
      const updatedResp = data.response || data;
      const targetFormId = String(data.formId || updatedResp?.formId || updatedResp?.questionId || "");
      if (targetFormId && targetFormId !== String(id)) return;

      const respId = updatedResp?.id || updatedResp?._id;
      if (!respId) {
        // Bulk update event without a single response payload
        fetchFullAnalyticsResponses();
        fetchSummary();
        fetchPerformanceTable();
        return;
      }

      console.log("🔔 [FormAnalytics] Real-time response-updated received:", respId);

      setResponses((prev) =>
        prev.map((r) =>
          (r.id && r.id === respId) || ((r as any)._id && (r as any)._id === respId)
            ? { ...r, ...updatedResp }
            : r
        )
      );

      setTableResponses((prev) =>
        prev.map((r) =>
          (r.id && r.id === respId) || ((r as any)._id && (r as any)._id === respId)
            ? { ...r, ...updatedResp }
            : r
        )
      );

      debouncedRefreshMetrics();
    });

    socket.on("response-deleted", (data: any) => {
      if (!data) return;
      const deletedId = data.responseId || data.id;
      const targetFormId = String(data.formId || "");
      if (targetFormId && targetFormId !== String(id)) return;

      console.log("🔔 [FormAnalytics] Real-time response-deleted received:", deletedId);

      setResponses((prev) => prev.filter((r) => r.id !== deletedId && (r as any)._id !== deletedId));
      setTableResponses((prev) => prev.filter((r) => r.id !== deletedId && (r as any)._id !== deletedId));
      setTotalResponsesCount((prev) => Math.max(0, prev - 1));

      debouncedRefreshMetrics();
    });

    socket.on("batch-imported", (data: any) => {
      const targetFormId = String(data?.formId || "");
      if (targetFormId && targetFormId !== String(id)) return;

      console.log("🔔 [FormAnalytics] Real-time batch-imported received");
      fetchFullAnalyticsResponses();
      debouncedRefreshMetrics();
      if (activeTabRef.current === "responses") {
        fetchResponsesPage(responsesPageRef.current);
      }
    });

    return () => {
      clearTimeout(debounceTimer);
      console.log(`⚠️ [FormAnalytics] Leaving socket room form-analytics-${id}`);
      socket.emit("leave-form-analytics", id);
      socket.disconnect();
    };
  }, [id]);

  // Question / Section / Overall tabs also derive their charts and stats
  // from the full `responses` array. If the user lands directly on one of
  // these without visiting Dashboard first, load the full set once here.


  // Responses tab: server-side paginated fetch for the table rows.
  // When URL has batchId / uploadOnly (e.g. from Upload History modal or recent import),
  // ensure we fetch specifically that batch or reload when params change.
  const urlBatchId = searchParams.get("batchId");
  const urlUploadOnly = searchParams.get("uploadOnly");
  const urlUnitsParam = searchParams.get("units");
  const urlRangeStart = searchParams.get("rangeStart");
  const urlRangeEnd = searchParams.get("rangeEnd");
  const urlIdentification = searchParams.get("identification") || searchParams.get("identificationNumber");
  const urlChassis = searchParams.get("chassis") || searchParams.get("chassisNumber");
  const urlDispatch = searchParams.get("dispatch") || searchParams.get("dispatchStatus");
  const urlSubmittedBy = searchParams.get("submittedBy");
  const urlBiwReviewedBy = searchParams.get("biwReviewedBy");
  const urlReviewedCombined = searchParams.get("reviewedCombined");
  const urlBiwStatus = searchParams.get("biwStatus");
  const urlTvsStatus = searchParams.get("tvsStatus");
  const urlStatus = searchParams.get("status");
  const urlStartDate = searchParams.get("startDate");
  const urlEndDate = searchParams.get("endDate");
  const urlMetricLabel = searchParams.get("metricLabel");

  const targetUnitsSet = useMemo(() => {
    const set = new Set<string>();
    if (urlUnitsParam) {
      urlUnitsParam.split(",").forEach((u) => {
        const tr = u.trim().toLowerCase();
        if (tr) set.add(tr);
      });
    }
    if (urlIdentification) {
      const tr = urlIdentification.trim().toLowerCase();
      if (tr) set.add(tr);
    }
    if (urlChassis) {
      const tr = urlChassis.trim().toLowerCase();
      if (tr) set.add(tr);
    }
    return set;
  }, [urlUnitsParam, urlIdentification, urlChassis]);

  const lastBatchParamRef = useRef<string | null>(null);

  useEffect(() => {
    const unitsKey = `${urlUnitsParam || ""}_${urlRangeStart || ""}_${urlRangeEnd || ""}_${urlIdentification || ""}_${urlChassis || ""}`;
    const drillKey = `${urlSubmittedBy || ""}_${urlBiwReviewedBy || ""}_${urlReviewedCombined || ""}_${urlBiwStatus || ""}_${urlTvsStatus || ""}_${urlStatus || ""}_${urlStartDate || ""}_${urlEndDate || ""}`;
    const batchKey = `${urlBatchId || ""}_${urlUploadOnly || ""}_${urlDispatch || ""}_${unitsKey}_${drillKey}`;
    if (activeTab === "responses" && id) {
      if (!loadedTabs.has("responses") || lastBatchParamRef.current !== batchKey) {
        lastBatchParamRef.current = batchKey;
        fetchResponsesPage(1);
        if (responses.length === 0) {
          fetchFullAnalyticsResponses();
        }
        setLoadedTabs((prev) => new Set(prev).add("responses"));
      }
    }
  }, [activeTab, id, loadedTabs, urlBatchId, urlUploadOnly, urlDispatch, urlUnitsParam, urlRangeStart, urlRangeEnd, urlIdentification, urlChassis, urlSubmittedBy, urlBiwReviewedBy, urlReviewedCombined, urlBiwStatus, urlTvsStatus, urlStatus, urlStartDate, urlEndDate]);

  // Page / page-size changes on an already-loaded Responses tab re-fetch
  // from the server instead of re-slicing an in-memory array.
  useEffect(() => {
    if (activeTab === "responses" && loadedTabs.has("responses")) {
      fetchResponsesPage(responsesPage);
    }
  }, [responsesPage, responsesPageSize, activeTab, dateFilter.type, dateFilter.startDate, dateFilter.endDate]);

  const handleRetry = async () => {
    setIsRetrying(true);
    setRetryCount(prev => prev + 1);
    try {
      await fetchData();
      // fetchData only re-fetches the form now; also re-fetch whatever
      // data source the currently active tab depends on.
      if (activeTab === "responses") {
        await fetchResponsesPage(responsesPage);
      } else {
        await fetchFullAnalyticsResponses();
        if (activeTab === "dashboard") {
          await fetchPerformanceTable();
          await fetchSummary();
        }
      }
    } catch (error) {
      console.error("Retry failed:", error);
    } finally {
      setIsRetrying(false);
    }
  };
  // Add this useEffect to update selectedQuestion


  const availableLocations = useMemo(() => {
    const locations = new Set<string>();
    responses.forEach((r) => {
      const meta = r.submissionMetadata?.location;
      if (meta) {
        const city = meta.city || "";
        const country = meta.country || "";
        const locationStr =
          city && country ? `${city}, ${country}` : country || "Unknown";
        if (locationStr !== "Unknown") {
          locations.add(locationStr);
        }
      }
    });
    return Array.from(locations).sort();
  }, [responses]);

  const quizQuestions = useMemo(() => {
    if (!form?.sections) return [];
    const allQs: any[] = [];
    form.sections.forEach((section) => {
      if (section.questions) {
        section.questions.forEach((q) => {
          if (q.correctAnswer !== undefined) {
            allQs.push(q);
          }
          if (q.followUpQuestions) {
            q.followUpQuestions.forEach((fq) => {
              if (fq.correctAnswer !== undefined) {
                allQs.push(fq);
              }
            });
          }
        });
      }
    });
    return allQs;
  }, [form]);

  const calculateScores = (response: Response) => {
    let correct = 0;
    let wrong = 0;

    quizQuestions.forEach((q) => {
      const answer = response.answers?.[q.id];
      if (answer !== undefined && answer !== null && answer !== "") {
        const answerStr = Array.isArray(answer)
          ? answer.join(", ").toLowerCase()
          : String(answer).toLowerCase();
        const correctStr = Array.isArray(q.correctAnswer)
          ? q.correctAnswer.join(", ").toLowerCase()
          : String(q.correctAnswer).toLowerCase();

        if (answerStr === correctStr) {
          correct++;
        } else {
          wrong++;
        }
      }
    });

    return { correct, wrong };
  };
  const extractAnswerValues = (answer: any): string[] => {
    if (answer === null || answer === undefined) return [""];

    // Handle objects with status/chassis properties
    if (typeof answer === "object" && !Array.isArray(answer)) {
      const values: string[] = [];
      if (answer.status && typeof answer.status === "string" && answer.status.trim()) {
        values.push(answer.status.trim());
      }
      if (answer.chassisNumber && typeof answer.chassisNumber === "string" && answer.chassisNumber.trim()) {
        values.push(answer.chassisNumber.trim());
      }
      if (answer.prefix && typeof answer.prefix === "string" && answer.prefix.trim()) {
        values.push(answer.prefix.trim());
      }
      if (answer.serialNumber && typeof answer.serialNumber === "string" && answer.serialNumber.trim()) {
        values.push(answer.serialNumber.trim());
      }
      if (answer.partDescription && typeof answer.partDescription === "string" && answer.partDescription.trim()) {
        values.push(answer.partDescription.trim());
      }
      if (answer.zone && typeof answer.zone === "string" && answer.zone.trim()) {
        values.push(answer.zone.trim());
      }
      if (answer.value && typeof answer.value === "string" && answer.value.trim()) {
        values.push(answer.value.trim());
      }
      if (answer.label && typeof answer.label === "string" && answer.label.trim()) {
        values.push(answer.label.trim());
      }
      if (answer.name && typeof answer.name === "string" && answer.name.trim()) {
        values.push(answer.name.trim());
      }
      if (answer.prefix && answer.chassisNumber) {
        values.push(`${answer.prefix}${answer.chassisNumber}`);
      }
      const displayVal = getChassisDisplayValue(answer);
      if (displayVal && displayVal !== "-" && !values.includes(displayVal)) {
        values.push(displayVal);
      }

      // Fallback: if no specific fields found, use JSON string
      if (values.length === 0) {
        const str = JSON.stringify(answer);
        if (str && str !== "{}") values.push(str);
      }
      return values.length > 0 ? values : [""];
    }

    // Handle arrays
    if (Array.isArray(answer)) {
      if (answer.length === 0) return [""];
      return answer.map(item => {
        if (!item) return "";
        if (typeof item === "object") {
          return String(item.name || item.status || item.chassisNumber || JSON.stringify(item));
        }
        return String(item).trim();
      }).filter(v => typeof v === "string" && v.length > 0);
    }

    // Handle primitives
    const strValue = String(answer).trim();
    return strValue ? [strValue] : [""];
  };

  const baseFilteredResponses = useMemo(() => {
    let result = responses;

    // 0. Role-based Filter (LIFTED: Inspectors can now view and review other tenant/user responses)

    // 2. Location Filter
    if (locationFilter.length > 0) {
      result = result.filter((response) => {
        const meta = response.submissionMetadata?.location;
        if (!meta) return false;
        const city = meta.city || "";
        const country = meta.country || "";
        const locationStr =
          city && country ? `${city}, ${country}` : country || "Unknown";
        return locationFilter.includes(locationStr);
      });
    }

    // 3. Cascading Question Filters
    const cascadingFiltersArray = Object.entries(cascadingFilters).filter(
      ([_, answers]) => answers.length > 0,
    );

    if (cascadingFiltersArray.length > 0) {
      result = result.filter((response) => {
        return cascadingFiltersArray.every(([questionId, selectedAnswers]) => {
          const answer = response.answers?.[questionId];
          if (answer === null || answer === undefined) return false;

          // Use extractAnswerValues to handle all answer types consistently
          const answerValues = extractAnswerValues(answer);
          return answerValues.some(v => selectedAnswers.includes(v));
        });
      });
    }

    // 4. Column Filters (skip __attemptRank here – resolved in filteredResponses to avoid TDZ on chassisAttemptRanks/tableDisplayStatuses/responseStatuses)
    const activeColumnFilters = Object.entries(columnFilters).filter(
      ([, values]) => Boolean(values && values.length > 0)
    );

    if (activeColumnFilters.length > 0) {
      result = result.filter((response) => {
        return activeColumnFilters.every(([columnId, allowedValues]) => {
          if (!allowedValues || allowedValues.length === 0) return true;

          // Skip all virtual/custom table columns (__status, __attemptRank, __submittedBy, etc.)
          // These are resolved in filteredResponses after status and ranking maps are populated
          if (columnId.startsWith("__")) return true;

          const answer = response.answers?.[columnId];
          if (answer === null || answer === undefined) {
            return allowedValues.includes("No Response");
          }
          const answerValues = extractAnswerValues(answer);
          return answerValues.some(v => {
            if (!v) return false;
            const vLower = v.toLowerCase();
            return allowedValues.some(av => {
              if (!av) return false;
              const avLower = av.toLowerCase();
              return vLower === avLower || vLower.includes(avLower) || avLower.includes(vLower);
            });
          });
        });
      });
    }

    return result;
  }, [responses, user, locationFilter, cascadingFilters, columnFilters]);

  // Primary chassis question ID is already resolved at top (chassisQuestionId)

  // Robust helper to extract a normalized chassis / vehicle / item identifier from any response
  const getChassisOrItemId = useCallback((r: any, trackingQId: string | null): string => {
    if (!r) return "unknown";

    const IGNORED_UNIT_TOKENS = new Set([
      "TVS", "SAIFY", "LMPL", "SREEDEVI", "NAHARS",
      "OK", "NO", "YES", "NA", "N/A", "NONE", "-", "UNKNOWN",
      "NO RESPONSE", "PASS", "FAIL", "REWORK", "ACCEPTED", "REJECTED"
    ]);

    const extractValidUnit = (raw: any): string | null => {
      if (raw === undefined || raw === null || raw === "") return null;
      const candidate = typeof raw === "object"
        ? (raw.chassisNumber || raw.value || raw.label || raw.text)
        : raw;
      if (candidate === undefined || candidate === null || candidate === "") return null;
      const val = String(candidate).trim();
      if (!val || val.length < 3 || val.length > 40) return null;
      if (val.startsWith("data:image") || val.startsWith("{")) return null;
      if (IGNORED_UNIT_TOKENS.has(val.toUpperCase())) return null;
      if (!/\d/.test(val)) return null;
      return val.toLowerCase();
    };

    // 1. Explicit tracking question answer
    if (trackingQId && r.answers && r.answers[trackingQId] !== undefined) {
      const valid = extractValidUnit(r.answers[trackingQId]);
      if (valid) return valid;
    }

    // 2. Direct chassis/id properties
    const directChassis = extractValidUnit(r.chassisNumber);
    if (directChassis) return directChassis;

    // 3. Known answers key variants
    if (r.answers) {
      const directKeys = [
        "chassis_number", "chassisNumber", "chassis", "Chassis", "CHASSIS",
        "id_number", "idNumber", "ID NUMBER", "ID Number", "Id Number", "id_no", "ID No", "ID NO",
        "Identification Number", "identification_number", "identificationNumber",
        "Chassis / VIN", "Chassis Number", "VIN", "vin", "Serial Number", "serialNumber"
      ];
      for (const k of directKeys) {
        if (r.answers[k] !== undefined) {
          const valid = extractValidUnit(r.answers[k]);
          if (valid) return valid;
        }
      }
    }

    // 4. Scan form questions for any chassis/ID/VIN/tracking question
    if (form?.sections && r.answers) {
      for (const section of form.sections) {
        if (section.questions) {
          for (const q of section.questions) {
            if (q.type === "zone-in" || q.type === "zone-out") continue;
            const t = (q.text || "").toLowerCase();
            const isTrackOrId =
              q.trackResponseRank === true || q.trackResponseRank === "true" ||
              q.type === "chassis" || q.type === "chassisWithZone" || q.type === "chassisWithoutZone" || q.type === "range" ||
              t.includes("chassis") || t.includes("identification") || t.includes("id number") || t.includes("id_number") || t.includes("id no") || t.includes("vin") || t.includes("serial");

            if (isTrackOrId && r.answers[q.id] !== undefined) {
              const valid = extractValidUnit(r.answers[q.id]);
              if (valid) return valid;
            }
          }
        }
      }
    }

    // 5. Fallback scan over short answer values for a real alphanumeric unit ID
    if (r.answers) {
      for (const ans of Object.values(r.answers)) {
        const valid = extractValidUnit(ans);
        if (valid) return valid;
      }
    }

    // 5b. Scan any answer whose key name suggests an ID or chassis
    if (r.answers) {
      for (const [key, val] of Object.entries(r.answers)) {
        if (!val || typeof val === "object" || (typeof val !== "string" && typeof val !== "number")) continue;
        const strVal = String(val).trim();
        if (!strVal || strVal === "No response" || strVal === "-" || strVal.startsWith("data:image") || strVal.length > 60) continue;
        const kLower = key.toLowerCase();
        if (kLower.includes("chassis") || kLower.includes("id") || kLower.includes("vin") || kLower.includes("serial")) {
          return strVal.toLowerCase();
        }
      }
    }

    const fallbackId = r.id || r._id || "unknown";
    return `untracked-${fallbackId}`;
  }, [form]);

  // Fast, single-response status estimate — used ONLY by the Responses tab
  // table so the Status column can render as soon as `tableResponses` (the
  // paginated 20-row fetch) lands, instead of waiting on the full-dataset
  // `responseStatuses` below (which requires every page of
  // fetchFullAnalyticsResponses to stream in on large forms).
  //
  // It leans on `responseRanks`, which the backend already computes and
  // persists on the response document at submission time (a count of prior
  // submissions for the same tracked item, e.g. chassis number) — see
  // responseController.js. Because that count is already stored per-row,
  // this needs no sibling responses at all, just the row itself.
  //
  // Trade-off: in the rare case an item was rejected/skipped outright
  // without ever being flagged "rework" partway through its history, the
  // "Rework N" number here can be off by one from the fully-accurate
  // group-computed value below. That's why `tableDisplayStatuses` (below)
  // prefers the accurate `responseStatuses` value the instant it's
  // available, and only falls back to this estimate until then — so the
  // table starts correct-ish immediately and self-corrects a moment later,
  // the same "settles once loading finishes" behavior already documented
  // for the full-set streaming case above.
  const computeFastRowStatus = (r: Response, trackingQId: string | null) => {
    let isRework = false;
    let isAccepted = false;
    let isRejected = false;

    if (r.answers) {
      Object.values(r.answers).forEach((ans) => {
        if (typeof ans === "object" && ans !== null && (ans as any).status) {
          const s = String((ans as any).status).toLowerCase().trim();
          if (s === "rework" || s === "reworked" || s.includes("re-rework")) {
            isRework = true;
          } else if (
            s === "accepted" ||
            s === "rework completed" ||
            s === "verified" ||
            s === "yes" ||
            s === "y"
          ) {
            isAccepted = true;
          } else if (s === "rejected" || s === "no" || s === "n") {
            isRejected = true;
          }
        } else if (typeof ans === "string") {
          const s = ans.toLowerCase().trim();
          if (s === "rework" || s === "reworked" || s.includes("re-rework")) {
            isRework = true;
          } else if (
            s === "accepted" ||
            s === "rework completed" ||
            s === "verified" ||
            s === "yes" ||
            s === "y"
          ) {
            isAccepted = true;
          } else if (s === "rejected" || s === "no" || s === "n") {
            isRejected = true;
          }
        }
      });
    }

    const rank = trackingQId ? r.responseRanks?.[trackingQId] : null;
    const rawStatus = (r.status || "").trim();

    // 0. Dispatched units have been cleared and released:
    // They cannot remain in an active Rework or Rejected state.
    if (r.isDispatched) {
      if (isRework || (rawStatus && rawStatus.startsWith("Rework"))) {
        return "Rework Accepted";
      }
      return rawStatus === "Accepted" ? "Accepted" : "Direct Ok";
    }

    // 1. Explicit response status check
    if (rawStatus === "Rejected") return "Rejected";
    if (rawStatus === "Rework Accepted" || rawStatus === "Rework Completed") return "Rework Accepted";
    if (rawStatus === "Direct Ok") return "Direct Ok";
    if (rawStatus === "Accepted") {
      if (isRework) return "Rework 1";
      return "Direct Ok";
    }
    if (rawStatus.startsWith("Rework")) return rawStatus;

    // 2. Fallback based on answers
    if (isRejected) return "Rejected";
    if (isRework) {
      if (trackingQId && rank && rank > 1) return `Rework ${rank - 1}`;
      if (trackingQId) return "Rework 1";
      return "Rework";
    }
    if (isAccepted) {
      return "Direct Ok";
    }
    return "Direct Ok";
  };

  // Calculate sequential status (Direct Ok, Rework 1, Rework 2, etc.)
  const responseStatuses = useMemo(() => {
    if (!baseFilteredResponses.length) {
      return {};
    }

    // Group responses by unique item (e.g., chassis number)
    const itemGroups: Record<string, Response[]> = {};

    // Sort responses by timestamp ascending to determine sequential order
    const sortedResponses = [...baseFilteredResponses].sort((a, b) => {
      const tA = new Date(getResponseTimestamp(a) || 0).getTime();
      const tB = new Date(getResponseTimestamp(b) || 0).getTime();
      return tA - tB;
    });

    sortedResponses.forEach((r) => {
      const itemId = getChassisOrItemId(r, chassisQuestionId);

      if (!itemGroups[itemId]) {
        itemGroups[itemId] = [];
      }
      itemGroups[itemId].push(r);
    });

    const statuses: Record<string, string> = {};

    Object.entries(itemGroups).forEach(([groupId, group]) => {
      let reworkCount = 0;
      let hasBeenReworked = false;

      group.forEach((r, index) => {
        let isRework = false;
        let isAccepted = false;
        let isRejected = false;

        // Check individual answers for inspection status
        if (r.answers) {
          Object.values(r.answers).forEach((ans) => {
            if (
              typeof ans === "object" &&
              ans !== null &&
              (ans as any).status
            ) {
              const s = String((ans as any).status)
                .toLowerCase()
                .trim();
              if (
                s === "rework" ||
                s === "reworked" ||
                s.includes("re-rework")
              ) {
                isRework = true;
              } else if (
                s === "accepted" ||
                s === "rework completed" ||
                s === "verified" ||
                s === "yes" ||
                s === "y"
              ) {
                isAccepted = true;
              } else if (s === "rejected" || s === "no" || s === "n") {
                isRejected = true;
              }
            } else if (typeof ans === "string") {
              const s = ans.toLowerCase().trim();
              if (
                s === "rework" ||
                s === "reworked" ||
                s.includes("re-rework")
              ) {
                isRework = true;
              } else if (
                s === "accepted" ||
                s === "rework completed" ||
                s === "verified" ||
                s === "yes" ||
                s === "y"
              ) {
                isAccepted = true;
              } else if (s === "rejected" || s === "no" || s === "n") {
                isRejected = true;
              }
            }
          });
        }

        const rank = (chassisQuestionId && r.responseRanks?.[chassisQuestionId]) || (index + 1);
        const rawStatus = (r.status || "").trim();

        let calculatedStatus = hasBeenReworked ? "Rework Accepted" : "Direct Ok";

        if (rawStatus === "Rejected") {
          calculatedStatus = "Rejected";
        } else if (rawStatus === "Rework Accepted" || rawStatus === "Rework Completed") {
          calculatedStatus = "Rework Accepted";
        } else if (rawStatus === "Direct Ok") {
          calculatedStatus = "Direct Ok";
        } else if (rawStatus === "Accepted") {
          if (isRework) {
            reworkCount++;
            hasBeenReworked = true;
            calculatedStatus = !groupId.startsWith("untracked-") ? `Rework ${reworkCount}` : "Rework 1";
          } else if (hasBeenReworked) {
            calculatedStatus = "Rework Accepted";
          } else {
            calculatedStatus = "Direct Ok";
          }
        } else if (rawStatus.startsWith("Rework")) {
          hasBeenReworked = true;
          calculatedStatus = rawStatus;
        } else if (isRejected) {
          calculatedStatus = "Rejected";
        } else if (isRework) {
          if (!groupId.startsWith("untracked-")) {
            reworkCount++;
            hasBeenReworked = true;
            calculatedStatus = `Rework ${reworkCount}`;
          } else {
            calculatedStatus = "Rework 1";
          }
        } else if (isAccepted) {
          if (hasBeenReworked) {
            calculatedStatus = "Rework Accepted";
          } else {
            calculatedStatus = "Direct Ok";
          }
        }

        // Dispatched units have been cleared and released:
        // They cannot remain in an active Rework or Rejected state.
        if (r.isDispatched) {
          if (isRework || hasBeenReworked || (rawStatus && rawStatus.startsWith("Rework"))) {
            calculatedStatus = "Rework Accepted";
          } else {
            calculatedStatus = rawStatus === "Accepted" ? "Accepted" : "Direct Ok";
          }
        }

        if (r.id) statuses[r.id] = calculatedStatus;
        if ((r as any)._id) statuses[(r as any)._id] = calculatedStatus;
      });
    });

    return statuses;
  }, [baseFilteredResponses, chassisQuestionId, getChassisOrItemId]);

  // Status for the Responses tab table only: instant estimate from each
  // row's own persisted rank (computeFastRowStatus, defined above), upgraded
  // to the fully-accurate group-computed value from `responseStatuses` the
  // moment that's ready. Depends only on `tableResponses` (the fast
  // paginated 20-row fetch), so it's available immediately instead of
  // waiting on the full analytics response set.
  const tableDisplayStatuses = useMemo(() => {
    const map: Record<string, string> = {};
    const dataset = responses.length > 0 ? responses : tableResponses;
    dataset.forEach((r) => {
      const respId = r.id || (r as any)._id;
      const status =
        responseStatuses[r.id] ||
        responseStatuses[(r as any)._id] ||
        (respId ? responseStatuses[respId] : null) ||
        computeFastRowStatus(r, chassisQuestionId) ||
        (r.status && r.status !== "pending" ? r.status : "Direct Ok");
      if (r.id) map[r.id] = status;
      if ((r as any)._id) map[(r as any)._id] = status;
      if (respId) map[respId] = status;
    });
    return map;
  }, [tableResponses, responses, responseStatuses, chassisQuestionId]);

  // Helper to determine if a response is eligible for review (BIW or TVS)
  // Rule: for rework, NO BIW or TVS review and do NOT take into accountability.
  // ONLY "Direct Ok", "Accepted", and "Rework Accepted" are eligible for review.
  const isReviewEligibleResponse = (r: Response | null | undefined): boolean => {
    if (!r) return false;
    const respId = r.id || (r as any)._id;
    const status = String(
      (respId ? tableDisplayStatuses[respId] || responseStatuses[respId] : null) ||
      computeFastRowStatus(r, chassisQuestionId) ||
      (r.status && r.status !== "pending" ? r.status : "Direct Ok")
    ).toLowerCase().trim();

    if (status.includes("direct ok") || status.includes("direct_ok") || status.includes("rework accepted")) {
      return true;
    }
    if (status.includes("rework") || status.includes("reject")) {
      return false;
    }
    if (status.includes("accept") || status === "ok") {
      return true;
    }
    return false;
  };

  const isBiwEligibleResponse = isReviewEligibleResponse;

  // Only assigned tenant reviewers (or superadmin) can perform BIW review / review feedback
  // Rules enforced:
  // 1. ELIGIBILITY: Chassis under active rework or rejected CANNOT receive review
  // 2. DISPATCH PREREQUISITE: Chassis must be dispatched by the owning plant before review can be performed
  // 3. SEPARATION OF ROLES: Owning plant CANNOT review its own chassis
  // 4. TRIGGERED TENANT ALONE: Only the triggered / partner tenant can review
  // 5. ANTI-TAMPER: Submitter cannot review their own submission
  const canUserBiwReview = (response: Response | null | undefined): { canReview: boolean; reason?: string } => {
    if (!response) return { canReview: false, reason: "No response selected" };

    // 🔒 1. Only Direct Ok, Accepted, or Rework Accepted units can be reviewed
    if (!isReviewEligibleResponse(response)) {
      return {
        canReview: false,
        reason: "Units under rework or rejected are not eligible for review. Only Direct Ok, Accepted, or Rework Accepted units can be reviewed."
      };
    }

    // 🔒 2. Dispatch Prerequisite: Only dispatched chassis can be entered into review
    if (!response.isDispatched) {
      return {
        canReview: false,
        reason: "Chassis must be dispatched by the owning plant before review can be performed"
      };
    }

    // Superadmin has universal review permissions on dispatched eligible units
    if (user?.role === "superadmin") return { canReview: true };

    const userTenantStr = String((user?.tenantId as any)?._id || (user?.tenantId as any)?.id || user?.tenantId || "");
    const formTenantStr = String((form?.tenantId as any)?._id || (form?.tenantId as any)?.id || form?.tenantId || "");
    const isFormOwnerTenant = Boolean(formTenantStr && userTenantStr && formTenantStr === userTenantStr);

    // 🔒 3. Owning plant CANNOT review its own chassis
    if (isFormOwnerTenant) {
      return {
        canReview: false,
        reason: "The owning plant cannot review its own chassis. Reviews must be performed by the triggered partner tenant."
      };
    }

    // 🔒 4. Triggered tenant check: Chassis assignments or shared tenants
    const assignments = (form as any)?.chassisTenantAssignments || (form as any)?.parentForm?.chassisTenantAssignments;
    if (Array.isArray(assignments) && assignments.length > 0) {
      const chassisCandidates = new Set<string>();
      if (response.chassisNumber) chassisCandidates.add(String(response.chassisNumber).trim().toLowerCase());
      if ((response as any).systemChassisNumber) chassisCandidates.add(String((response as any).systemChassisNumber).trim().toLowerCase());
      if ((response as any).system_chassis) chassisCandidates.add(String((response as any).system_chassis).trim().toLowerCase());

      if (response.answers && typeof response.answers === "object") {
        const chassisKeyPatterns = ["chassis", "vin", "vehicle", "serial", "selected"];
        for (const [key, val] of Object.entries(response.answers)) {
          if (val !== undefined && val !== null && (typeof val === "string" || typeof val === "number")) {
            const strVal = String(val).trim().toLowerCase();
            if (!strVal) continue;
            const kLower = key.toLowerCase();
            if (chassisKeyPatterns.some(p => kLower.includes(p))) {
              chassisCandidates.add(strVal);
            }
          }
        }
      }

      const matchedAssignment = assignments.find((a: any) => {
        const aChassis = String(a.chassisNumber || "").trim().toLowerCase();
        return aChassis && chassisCandidates.has(aChassis);
      });

      if (matchedAssignment && Array.isArray(matchedAssignment.assignedTenants) && matchedAssignment.assignedTenants.length > 0) {
        const isAssigned = matchedAssignment.assignedTenants.some(
          (t: any) => String(t?._id || t?.id || t) === userTenantStr
        );
        if (!isAssigned) {
          return {
            canReview: false,
            reason: "Only the triggered / assigned tenant reviewer can perform BIW review for this chassis."
          };
        }
      }
    } else if (Array.isArray(form?.sharedWithTenants) && form.sharedWithTenants.length > 0) {
      const isFormSharedTenant = form.sharedWithTenants.some(
        (t: any) => String(t?._id || t?.id || t) === userTenantStr
      );
      if (!isFormSharedTenant && formTenantStr) {
        return {
          canReview: false,
          reason: "Only the triggered partner tenant can perform reviews for this chassis."
        };
      }
    }

    // 🔒 5. Anti-tamper check: submitter cannot review their own submission
    if (isSubmitterOfResponse(response)) {
      return {
        canReview: false,
        reason: "You cannot BIW review your own submission"
      };
    }

    return { canReview: true };
  };

  // Chronological attempt rank per chassis (1st inspection = 1, 2nd inspection = 2, etc.)
  const chassisAttemptRanks = useMemo(() => {
    const ranks: Record<string, number> = {};
    const dataset = responses.length > 0 ? responses : tableResponses;
    if (!dataset.length) return ranks;

    // Group responses by unique chassis/item
    const itemGroups: Record<string, typeof dataset> = {};

    // Sort ascending by timestamp (oldest first)
    const sorted = [...dataset].sort((a, b) => {
      const tA = new Date(getResponseTimestamp(a) || 0).getTime();
      const tB = new Date(getResponseTimestamp(b) || 0).getTime();
      return tA - tB;
    });

    sorted.forEach((r) => {
      const itemId = getChassisOrItemId(r, chassisQuestionId);

      if (!itemGroups[itemId]) {
        itemGroups[itemId] = [];
      }

      // Keep only previous responses that are within 10 days of the current response
      const rTime = new Date(getResponseTimestamp(r) || 0).getTime();
      const tenDaysMs = 10 * 24 * 60 * 60 * 1000;
      itemGroups[itemId] = itemGroups[itemId].filter(prevR => {
        const prevTime = new Date(getResponseTimestamp(prevR) || 0).getTime();
        return (rTime - prevTime) <= tenDaysMs;
      });

      itemGroups[itemId].push(r);
      const attemptNumber = itemGroups[itemId].length;
      const persistedRank = (chassisQuestionId && r.responseRanks?.[chassisQuestionId]) || (r.responseRanks && typeof r.responseRanks === 'object' ? Object.values(r.responseRanks).find((v: any) => typeof v === 'number' && v > 0) : null);
      const finalRank = (typeof persistedRank === 'number' && persistedRank > 0) ? persistedRank : attemptNumber;
      if (r.id) ranks[r.id] = finalRank;
      if ((r as any)._id) ranks[(r as any)._id] = finalRank;
    });

    return ranks;
  }, [responses, tableResponses, chassisQuestionId, getChassisOrItemId]);

  // Set of chassis / items that have achieved Rework Accepted in any attempt
  const resolvedReworkChassisSet = useMemo(() => {
    const resolved = new Set<string>();
    const dataset = responses.length > 0 ? responses : tableResponses;
    dataset.forEach((r) => {
      const respId = r.id || (r as any)._id;
      const statusVal =
        tableDisplayStatuses[r.id] ||
        tableDisplayStatuses[(r as any)._id] ||
        responseStatuses[r.id] ||
        responseStatuses[(r as any)._id] ||
        (respId ? tableDisplayStatuses[respId] || responseStatuses[respId] : null) ||
        computeFastRowStatus(r, chassisQuestionId) ||
        r.status ||
        "";
      const rawStatus = String(statusVal).trim().toLowerCase();
      if (rawStatus === "rework accepted" || rawStatus === "rework completed") {
        const itemId = getChassisOrItemId(r, chassisQuestionId);
        if (itemId && itemId !== "none" && itemId !== "-") {
          resolved.add(itemId.toLowerCase().trim());
        }
      }
    });
    return resolved;
  }, [responses, tableResponses, tableDisplayStatuses, responseStatuses, chassisQuestionId, getChassisOrItemId]);

  // Distinct filter options for Time Taken attempt rank & status color
  const attemptRankFilterOptions = useMemo(() => {
    const opts = new Set<string>();
    const dataset = responses.length > 0 ? responses : tableResponses;
    dataset.forEach((r) => {
      const respId = r.id || (r as any)._id;
      const rowStatus = tableDisplayStatuses[respId] || responseStatuses[respId] || "Direct Ok";
      const rank = chassisAttemptRanks[respId] || 1;

      let label = `Attempt ${rank} (Green - Accepted)`;
      if (rowStatus === "Rejected") {
        label = `Attempt ${rank} (Red - Rejected)`;
      } else if (rowStatus?.includes("Rework") && rowStatus !== "Rework Accepted" && rowStatus !== "Rework Completed") {
        label = `Attempt ${rank} (Yellow - Rework)`;
      } else if (rowStatus === "Direct Ok" || rowStatus === "Rework Accepted" || rowStatus === "Accepted" || rowStatus === "Rework Completed" || rowStatus === "Verified") {
        label = `Attempt ${rank} (Green - Accepted)`;
      }
      opts.add(label);
    });

    if (opts.size === 0) {
      return [
        "Attempt 1 (Green - Accepted)",
        "Attempt 1 (Yellow - Rework)",
        "Attempt 1 (Red - Rejected)"
      ];
    }

    return Array.from(opts).sort((a, b) => String(a ?? "").localeCompare(String(b ?? ""), undefined, { numeric: true }));
  }, [responses, tableResponses, tableDisplayStatuses, responseStatuses, chassisAttemptRanks]);

  // Filter options for Submitted By
  const submittedByFilterOptions = useMemo(() => {
    const opts = new Set<string>();
    const dataset = responses.length > 0 ? responses : tableResponses;
    dataset.forEach((r) => {
      const name = r.submittedBy || (r as any).createdBy?.name || (r as any).createdBy?.email || (typeof (r as any).createdBy === "string" ? (r as any).createdBy : "") || "Anonymous";
      if (name) opts.add(name);
    });
    return Array.from(opts).sort((a, b) => String(a ?? "").localeCompare(String(b ?? "")));
  }, [responses, tableResponses]);

  // Filter options for Status
  const statusFilterOptions = useMemo(() => {
    const opts = new Set<string>();
    [
      "Direct Ok",
      "Accepted",
      "Rework Accepted",
      "Ongoing Rework",
      "Rework",
      "Rejected"
    ].forEach((s) => opts.add(s));

    const dataset = responses.length > 0 ? responses : tableResponses;
    dataset.forEach((r) => {
      const respId = r.id || (r as any)._id;
      const status =
        tableDisplayStatuses[respId] ||
        responseStatuses[respId] ||
        tableDisplayStatuses[r.id] ||
        responseStatuses[r.id] ||
        computeFastRowStatus(r, chassisQuestionId) ||
        r.status;
      const norm = String(status ?? "").toLowerCase().trim();
      if (
        norm &&
        norm !== "-" &&
        norm !== "pending review" &&
        norm !== "pending" &&
        norm !== "undefined" &&
        norm !== "null"
      ) {
        opts.add(status);
      }
    });
    return Array.from(opts).sort((a, b) => String(a ?? "").localeCompare(String(b ?? "")));
  }, [responses, tableResponses, tableDisplayStatuses, responseStatuses, chassisQuestionId]);

  // Filter options for Selected Chassis
  const chassisFilterOptions = useMemo(() => {
    const opts = new Set<string>();
    chassisMasterOptions.forEach((o) => {
      if (o.value) opts.add(o.value);
    });
    const dataset = responses.length > 0 ? responses : tableResponses;
    dataset.forEach((r) => {
      const chassisVal = getResponseChassisValue(r);
      if (chassisVal && chassisVal !== "-" && chassisVal !== "No Chassis") {
        opts.add(chassisVal);
      }
    });
    return Array.from(opts).sort((a, b) => String(a ?? "").localeCompare(String(b ?? ""), undefined, { numeric: true }));
  }, [responses, tableResponses, chassisMasterOptions, getResponseChassisValue]);

  // Filter options for Parent Match
  const parentMatchFilterOptions = useMemo(() => {
    return [
      "✓ Parent Matched",
      "✓ Follow-up Done",
      "⚠ No Parent Match",
      "⏳ Pending Follow-up",
      "✕ Overdue",
      "Main Record"
    ];
  }, []);

  // Filter options for BIW Review
  const biwReviewFilterOptions = useMemo(() => {
    return [
      "Accepted",
      "Rejected",
      "Reworked",
      "No review yet"
    ];
  }, []);

  // Filter options for TVS Review (Chat) column
  const tvsReviewFilterOptions = useMemo(() => {
    return [
      "Accepted",
      "Rework",
      "Rejected",
      "Reviewed",
      "No review yet"
    ];
  }, []);
  const reviewFilterOptions = tvsReviewFilterOptions;

  // Filter options for Dispatch
  const dispatchFilterOptions = useMemo(() => {
    return [
      "Dispatched / Enabled",
      "Pending Dispatch"
    ];
  }, []);

  const fetchChatHistory = async (responseId: string) => {
    try {
      const targetId = responseId || chatResponse?.id || (chatResponse as any)?._id;
      if (!targetId) return;

      console.log(
        "[ChatModal] Fetching chat history for response:",
        targetId,
      );

      // Fetch messages for target response
      const response = await apiClient.get<any[]>(
        `/messages/response/${targetId}`,
      );
      let messages = Array.isArray(response.data) ? response.data : [];

      // Check if this response has a paired response (parent or child)
      const pairedId =
        (chatResponse as any)?.parentResponseId ||
        (chatResponse as any)?.followUpStatus?.parentResponseId ||
        (chatResponse as any)?.followUpStatus?.followUpResponseId ||
        (chatResponse as any)?.childResponseId;

      if (pairedId && String(pairedId) !== String(targetId)) {
        try {
          const pairedResp = await apiClient.get<any[]>(`/messages/response/${pairedId}`);
          const pairedMsgs = Array.isArray(pairedResp.data) ? pairedResp.data : [];
          const seen = new Set(messages.map((m: any) => String(m._id || m.id)));
          for (const pm of pairedMsgs) {
            const key = String(pm._id || pm.id);
            if (!seen.has(key)) {
              seen.add(key);
              messages.push(pm);
            }
          }
          messages.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        } catch (e) {
          console.warn("[ChatModal] Error fetching paired chat messages:", e);
        }
      }

      setChatMessages(messages);

      // Fetch reviews from API
      try {
        const reviewsResponse =
          await apiClient.getReviewsForResponse(targetId);
        console.log("[ChatModal] Reviews API response:", reviewsResponse);

        if (
          reviewsResponse &&
          reviewsResponse.reviews &&
          reviewsResponse.reviews.length > 0
        ) {
          const latestReview = reviewsResponse.reviews[0];
          console.log("[ChatModal] Latest review from API:", latestReview);

          // Update state from API
          setSelectedReviewOptions((prev) => ({
            ...prev,
            [targetId]: latestReview.option,
          }));

          setReviewedBy((prev) => ({
            ...prev,
            [targetId]: latestReview.reviewer
              ? {
                id: latestReview.reviewer.id,
                name: latestReview.reviewer.name || "Reviewer",
                email: latestReview.reviewer.email || "",
              }
              : null,
          }));

          // Also update chatResponse
          setChatResponse((prev) =>
            prev
              ? {
                ...prev,
                review: latestReview,
              }
              : null,
          );

          console.log("[ChatModal] Review state updated from API");
        } else {
          console.log("[ChatModal] No reviews found");
        }
      } catch (reviewError) {
        console.error("[ChatModal] Error fetching reviews:", reviewError);
      }
    } catch (err) {
      console.error("[ChatModal] Error fetching chat history:", err);
    }
  };
  useEffect(() => {
    if (showChatModal && chatResponse) {
      const respId = chatResponse.id || (chatResponse as any)._id;
      fetchChatHistory(respId);
    }
  }, [showChatModal, chatResponse?.id, (chatResponse as any)?._id]);

  // Load related parent/child form schemas and answers when chat modal opens
  useEffect(() => {
    if (!showChatModal || !chatResponse) return;

    setActiveReviewQuestionTab("child");

    const chassisVal =
      chatResponse.chassisNumber ||
      chatResponse.answers?.chassis_number ||
      chatResponse.answers?.chassisNumber ||
      (chatResponse as any).followUpStatus?.matchedChassis;

    // Freshly check if current form has parent or child forms (bypassing any stale cache)
    const currentFormId = id || form?.id || (form as any)?._id;
    if (currentFormId && (!form?.parentForm && !form?.parentFormId && (!form?.childForms || form.childForms.length === 0))) {
      apiClient
        .request<{ form: any }>(`/forms/${currentFormId}`, { forceNetwork: true })
        .then((res: any) => {
          if (res?.form) {
            setForm(res.form);
            if (res.form.parentForm) {
              setRelatedFormData((prev) => ({ ...prev, parentForm: res.form.parentForm }));
            }
          }
        })
        .catch(() => { });
    }

    // 1. If viewing a child form, ensure parent form sections & parent answers for this chassis are loaded
    const parentId =
      form?.parentFormId ||
      form?.parentForm?.id ||
      form?.parentForm?._id ||
      (chatResponse as any)?.parentFormId ||
      (chatResponse as any)?.parentForm?.id ||
      (chatResponse as any)?.parentForm?._id ||
      (chatResponse as any)?.followUpStatus?.parentFormId;

    if (parentId) {
      if (!form?.parentForm?.sections?.length && !relatedFormData.parentForm?.sections?.length) {
        apiClient
          .request<{ form: any }>(`/forms/${parentId}`, { forceNetwork: true })
          .then((res: any) => {
            const fetchedParent = res?.form || res;
            if (fetchedParent && (fetchedParent.sections?.length || fetchedParent.questions?.length)) {
              setRelatedFormData((prev) => ({ ...prev, parentForm: fetchedParent }));
              setForm((prev: any) => ({
                ...(prev || {}),
                parentForm: fetchedParent,
                parentFormId: fetchedParent.id || fetchedParent._id || prev?.parentFormId,
                parentFormTitle: fetchedParent.title || prev?.parentFormTitle,
              }));
            }
          })
          .catch((err) => console.warn("Could not load parent form details:", err));
      }

      if (
        !chatResponse.parentAnswers &&
        !(chatResponse as any).followUpStatus?.parentAnswers &&
        chassisVal
      ) {
        apiClient
          .getFormResponses(parentId, { units: chassisVal, limit: 1, forceNetwork: true })
          .then((res: any) => {
            const pResp = (res?.responses || [])[0];
            if (pResp) {
              setRelatedFormData((prev) => ({
                ...prev,
                parentAnswers: pResp.answers || {},
                parentResponse: pResp
              }));
            }
          })
          .catch((err) => console.warn("Could not load parent response answers:", err));
      }
    }

    // 2. If viewing a parent form, ensure child forms & child answers for this chassis are loaded
    const childList = form?.childForms || [];
    if (childList.length > 0) {
      childList.forEach((cf: any) => {
        const cId = cf.formId || cf.id || cf._id;
        if (cId && (!cf.sections || cf.sections.length === 0)) {
          apiClient
            .request<{ form: any }>(`/forms/${cId}`, { forceNetwork: true })
            .then((res: any) => {
              if (res?.form) {
                setRelatedFormData((prev) => ({
                  ...prev,
                  childForms: [
                    ...(prev.childForms || []).filter(
                      (f: any) => f.id !== cId && f._id !== cId,
                    ),
                    res.form,
                  ],
                }));
              }
            })
            .catch((err) => console.warn("Could not load child form details:", err));
        }

        if (
          !chatResponse.childAnswers &&
          !(chatResponse as any).followUpStatus?.childAnswers &&
          chassisVal
        ) {
          apiClient
            .getFormResponses(cId, { units: chassisVal, limit: 1, forceNetwork: true })
            .then((res: any) => {
              const cResp = (res?.responses || [])[0];
              if (cResp) {
                setRelatedFormData((prev) => ({
                  ...prev,
                  childAnswers: cResp.answers || {},
                  childResponses: {
                    ...(prev.childResponses || {}),
                    [cId]: cResp
                  }
                }));
              }
            })
            .catch((err) => console.warn("Could not load child response answers:", err));
        }
      });
    }
  }, [showChatModal, chatResponse?.id, (chatResponse as any)?._id]);


  // Auto-open chat modal if responseId is in URL
  useEffect(() => {
    const responseId = searchParams.get("responseId");
    if (!responseId) return;
    const response =
      responses.find((r) => r.id === responseId || r._id === responseId) ||
      tableResponses.find((r) => r.id === responseId || r._id === responseId);
    if (response && !showChatModal) {
      setChatResponse(response);
      setShowChatModal(true);
    }
  }, [searchParams, responses, tableResponses, showChatModal]);

  const handleSendMessage = async (messageOverride?: string) => {
    const messageToSend = messageOverride ?? newMessage;
    if (!messageToSend.trim() || !chatResponse) return;

    setIsSendingMessage(true);
    try {
      const questionContexts: any[] = [];
      const selectedQuestionTitles: string[] = [];

      // Collect all available form sources (current, parent, child)
      const allFormSources: Array<{ sections: any[]; formTitle: string; answers: any }> = [];
      if (form?.sections) {
        allFormSources.push({
          sections: form.sections,
          formTitle: form.title || "Form",
          answers: (
            responses.find((r) => r.id === chatResponse?.id) ||
            tableResponses.find((r) => r.id === chatResponse?.id) ||
            chatResponse
          )?.answers || {},
        });
      }
      const parentDoc = form?.parentForm?.sections?.length ? form.parentForm : relatedFormData.parentForm;
      if (parentDoc?.sections) {
        allFormSources.push({
          sections: parentDoc.sections,
          formTitle: parentDoc.title || (chatResponse as any)?.parentFormTitle || "Parent Form",
          answers:
            (chatResponse as any)?.parentAnswers ||
            (chatResponse as any)?.followUpStatus?.parentAnswers ||
            relatedFormData.parentAnswers ||
            {},
        });
      }
      const childDocsList = (form?.childForms || []).map((cf: any) => {
        const found = (relatedFormData.childForms || []).find(
          (rf: any) => rf.id === (cf.formId || cf.id) || rf._id === (cf.formId || cf.id)
        );
        return found || cf;
      });
      childDocsList.forEach((cf: any) => {
        if (cf.sections) {
          allFormSources.push({
            sections: cf.sections,
            formTitle: cf.formTitle || cf.title || "Child Form",
            answers:
              (chatResponse as any)?.childAnswers ||
              (chatResponse as any)?.followUpStatus?.childAnswers ||
              relatedFormData.childAnswers ||
              {},
          });
        }
      });

      chatFilters.questions.forEach((qid) => {
        let q: any = null;
        let section: any = null;
        let foundFormTitle = "";
        let foundAnswers: any = {};

        for (const src of allFormSources) {
          for (const sec of src.sections || []) {
            const match = (sec.questions || []).find((quest: any) => quest.id === qid);
            if (match) {
              q = match;
              section = sec;
              foundFormTitle = src.formTitle;
              foundAnswers = src.answers;
              break;
            }
          }
          if (q) break;
        }

        if (q) {
          const rawAnswer = foundAnswers?.[qid] ?? chatResponse.answers?.[qid];
          let filteredAnswer = rawAnswer;

          // Apply category filtering if selections exist
          if (
            rawAnswer &&
            typeof rawAnswer === "object" &&
            rawAnswer.categories &&
            chatFilters.selectedCategories[qid]
          ) {
            const selectedNames = chatFilters.selectedCategories[qid];
            if (selectedNames.length > 0) {
              filteredAnswer = {
                ...rawAnswer,
                categories: rawAnswer.categories.filter((cat: any) =>
                  selectedNames.includes(cat.name),
                ),
              };
            }
          }

          // Parse flat array into structured object for chassis-with-zone questions
          let structuredAnswer = filteredAnswer;
          if (
            q.type === "chassis-with-zone" ||
            q.type === "chassis-without-zone"
          ) {
            // Always use chatFilters.suggestedAnswers for current values (they have the latest changes including uploads)
            const currentValue = chatFilters.suggestedAnswers?.[qid];
            if (currentValue) {
              // Use the suggestedAnswers which has the latest data
              structuredAnswer = {
                status: currentValue.status || "",
                chassisNumber: currentValue.chassisNumber || "",
                zones: Array.isArray(currentValue.zone)
                  ? currentValue.zone.join(", ")
                  : currentValue.zone || "",
                zonesData: currentValue.zonesData,
                evidenceUrl: currentValue.evidenceUrl || "",
              };
              // Add categories from zonesData
              if (currentValue.zonesData) {
                const cats: any[] = [];
                Object.entries(currentValue.zonesData).forEach(
                  ([zoneName, zoneData]: [string, any]) => {
                    if (zoneData?.categories) {
                      zoneData.categories.forEach((cat: any) => {
                        const defectsArr = (cat.defects || []).map(
                          (d: any) => ({
                            name: d.name,
                            details: d.details || { remark: "", fileUrl: "" },
                          }),
                        );
                        cats.push({ name: cat.name, defects: defectsArr });
                      });
                    }
                  },
                );
                if (cats.length > 0) structuredAnswer.categories = cats;
              }
            } else if (
              Array.isArray(filteredAnswer) &&
              filteredAnswer.length >= 7
            ) {
              // Fallback to array parsing
              structuredAnswer = {
                status: filteredAnswer[1] || "",
                chassisNumber: filteredAnswer[0] || "",
                zones: filteredAnswer[2] || "",
                categories: filteredAnswer[3]
                  ? [
                    {
                      name: filteredAnswer[3],
                      defects: filteredAnswer[4]
                        ? [
                          {
                            name: filteredAnswer[4],
                            details: {
                              remark: filteredAnswer[5] || "",
                              fileUrl: filteredAnswer[6] || "",
                            },
                          },
                        ]
                        : [],
                    },
                  ]
                  : [],
              };
            } else if (filteredAnswer?.zonesData) {
              structuredAnswer = filteredAnswer;
            }
          }

          const rawSuggestion = chatFilters.suggestedAnswers?.[qid];
          const hasFilledSuggestion =
            rawSuggestion &&
            typeof rawSuggestion === "object" &&
            Boolean(
              (rawSuggestion.inspectionRemark && String(rawSuggestion.inspectionRemark).trim()) ||
              (rawSuggestion.remark && String(rawSuggestion.remark).trim()) ||
              (rawSuggestion.inspectionFileUrl && String(rawSuggestion.inspectionFileUrl).trim()) ||
              (rawSuggestion.fileUrl && String(rawSuggestion.fileUrl).trim())
            );

          const qDisplayName = allFormSources.length > 1 && foundFormTitle ? `${q.text || "Question"} [${foundFormTitle}]` : q.text || "Question";

          questionContexts.push({
            questionId: qid,
            title: qDisplayName,
            sectionTitle: section?.title,
            formTitle: foundFormTitle,
            answer: structuredAnswer,
            suggestion: hasFilledSuggestion ? rawSuggestion : undefined,
            question: q,
          });
          selectedQuestionTitles.push(qDisplayName);
        }
      });

      // Determine recipient email / ID:
      // If the current user is the submitter (e.g. LMPL user replying),
      // the recipient must be the reviewer!
      const isSubmitter = isSubmitterOfResponse(chatResponse);
      let targetRecipient = "";

      if (isSubmitter) {
        // Find reviewer from review, biwReview, or past messages
        const revUser = (chatResponse.review?.reviewer as any);
        const revUserEmail =
          typeof revUser === "object"
            ? revUser?.email || revUser?._id || revUser?.id
            : typeof revUser === "string"
              ? revUser
              : "";
        const biwRevId = (chatResponse.biwReview as any)?.reviewedBy;
        const lastOtherMsg = [...chatMessages].reverse().find(
          (m) => String(m.from?._id || m.from) !== String(user?._id || (user as any)?.id)
        );
        const lastOtherEmail =
          lastOtherMsg?.from?.email ||
          lastOtherMsg?.from?._id ||
          (typeof lastOtherMsg?.from === "string" ? lastOtherMsg?.from : "");

        targetRecipient =
          revUserEmail ||
          (biwRevId ? String(biwRevId) : "") ||
          lastOtherEmail ||
          "";
      }

      if (!targetRecipient) {
        const createdByObj = chatResponse.createdBy;
        targetRecipient =
          createdByObj && typeof createdByObj === "object"
            ? (createdByObj as any).email || (createdByObj as any)._id?.toString()
            : typeof createdByObj === "string"
              ? createdByObj
              : chatResponse.submittedBy || "inspector@focus.com";
      }

      console.log("[handleSendMessage] isSubmitter:", isSubmitter);
      console.log("[handleSendMessage] toEmail (targetRecipient):", targetRecipient);

      console.log("Sending message with data:", {
        toEmail: targetRecipient,
        message: messageToSend,
        responseId: chatResponse.id,
        formId: id,
        questionIds: chatFilters.questions,
        questionTitles: selectedQuestionTitles,
        questionContexts: questionContexts,
        tenantId:
          form?.tenantId || (user?.tenantId as any)?._id || user?.tenantId,
      });

      await apiClient.post("/messages/send", {
        toEmail: targetRecipient,
        message: messageToSend,
        responseId: chatResponse.id,
        formId: id,
        questionIds: chatFilters.questions,
        questionTitles: selectedQuestionTitles,
        questionContexts: questionContexts,
        tenantId:
          form?.tenantId || (user?.tenantId as any)?._id || user?.tenantId,
      });

      setNewMessage("");
      // Clear selected questions after sending
      setChatFilters((prev) => ({
        ...prev,
        questions: [],
        selectedCategories: {},
        suggestedAnswers: {},
      }));

      // Update response in table with the sent message & chat status
      const targetChatRespId = chatResponse.id;
      const senderDisplayName = user?.name || user?.email || "Reviewer";
      const updateMsgFn = (r: any) => {
        if (r.id === targetChatRespId || (r as any)._id === targetChatRespId) {
          const curRev = r.review || {};
          return {
            ...r,
            review: {
              ...curRev,
              message: messageToSend,
              chatStatus: "sent",
              messageCreatedAt: new Date(),
              messageFrom: senderDisplayName,
              reviewer: curRev.reviewer || senderDisplayName,
              flaggedQuestions: selectedQuestionTitles.length > 0 ? selectedQuestionTitles : (curRev.flaggedQuestions || [])
            }
          };
        }
        return r;
      };
      setTableResponses((prev) => prev.map(updateMsgFn));
      setResponses((prev) => prev.map(updateMsgFn));

      fetchChatHistory(chatResponse.id);
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Helper to compute Parent/Follow-up matching status and color coding
  const computeParentMatch = (response: any) => {
    // Check if this form is a child/follow-up form or parent form
    const isChildForm = Boolean(
      form?.parentFormId ||
      form?.parentForm ||
      form?.parentFormTitle ||
      (form as any)?.isChild ||
      (form as any)?.isChildForm ||
      (form as any)?.isFollowUp ||
      relatedFormData?.parentForm ||
      response?.parentFormId ||
      response?.parentFormTitle ||
      (tableResponses?.length > 0 && tableResponses.some((r: any) => r.parentFormId || r.parentResponseId || r.followUpStatus?.matchType === "parent" || r.parentMatch?.matchType === "parent")) ||
      (responses?.length > 0 && responses.some((r: any) => r.parentFormId || r.parentResponseId || r.followUpStatus?.matchType === "parent" || r.parentMatch?.matchType === "parent"))
    );
    const isParentForm = Boolean(
      (form?.childForms && form.childForms.length > 0) ||
      (form as any)?.isParentForm ||
      relatedFormData?.childForms?.length > 0
    );

    // 1. If backend already provided rich followUpStatus or parentMatch, prioritize it
    const respId = response?.id || response?._id;
    const matchedFromTable = tableResponses?.find(
      (tr: any) => (tr.id && (tr.id === respId || tr.id === response?.id)) || (tr._id && (tr._id === respId || tr._id === response?._id))
    );
    const fs = response?.followUpStatus || response?.parentMatch || matchedFromTable?.followUpStatus || (matchedFromTable as any)?.parentMatch;
    if (fs) {
      if (fs.status === "matched" || fs.isMatched === true) {
        const isParentMatch = fs.matchType === "parent" || isChildForm;
        const realParentStatus = (fs.parentStatus && fs.parentStatus !== "pending") ? fs.parentStatus : "Direct Ok";
        const realFollowUpStatus = (fs.followUpStatus && fs.followUpStatus !== "pending") ? fs.followUpStatus : "Direct Ok";
        const targetParentResponseId =
          fs.parentResponseId ||
          response?.parentResponseId ||
          matchedFromTable?.parentResponseId ||
          (matchedFromTable as any)?.followUpStatus?.parentResponseId;
        const targetParentFormId =
          fs.parentFormId ||
          response?.parentFormId ||
          form?.parentFormId ||
          form?.parentForm;
        const targetParentFormTitle =
          fs.parentFormTitle ||
          response?.parentFormTitle ||
          form?.parentFormTitle;
        const matchedChassis = fs.matchedChassis || chassisVal || unitId;

        return {
          status: "matched",
          badgeText: isParentMatch ? "✓ Parent Matched" : "✓ Follow-up Done",
          badgeClasses: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100",
          icon: isParentMatch ? Eye : CheckCircle2,
          subText: isParentMatch
            ? `Status: ${realParentStatus}`
            : (fs.followUpStatus ? `Status: ${realFollowUpStatus}` : "Follow-up Complete"),
          tooltip: fs.details || (isParentMatch
            ? `Matched parent chassis "${matchedChassis || ""}" (Status: ${realParentStatus}) by ${fs.parentSubmittedBy || "Inspector"}`
            : `Follow-up completed for chassis "${matchedChassis || ""}" by ${fs.followUpSubmittedBy || "Inspector"}`),
          parentResponseId: targetParentResponseId ? String(targetParentResponseId) : undefined,
          parentFormId: targetParentFormId ? String(targetParentFormId) : undefined,
          parentFormTitle: targetParentFormTitle,
          matchedChassis: matchedChassis,
        };
      }

      if (fs.status === "unmatched" || fs.isMatched === false || (isChildForm && fs.status === "standalone")) {
        const unitCandidate = String(fs.matchedChassis || "").trim();
        const hasValidUnit = Boolean(unitCandidate && unitCandidate !== "-" && !["TVS", "SAIFY", "LMPL", "SREEDEVI", "NAHARS"].includes(unitCandidate.toUpperCase()));
        if (!hasValidUnit) {
          return {
            status: "none",
            badgeText: "-",
            badgeClasses: "text-gray-400 dark:text-gray-500",
            icon: null,
            subText: "",
            tooltip: "Unable to determine chassis unit for parent lookup"
          };
        }
        return {
          status: "unmatched",
          badgeText: "⚠ No Parent Match",
          badgeClasses: "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800 hover:bg-amber-100",
          icon: AlertTriangle,
          subText: "Standalone Follow-up",
          tooltip: fs.details || `Chassis "${unitCandidate}" has not been inspected in the parent form yet`
        };
      }

      if (fs.status === "pending") {
        return {
          status: "pending",
          badgeText: fs.badgeText || "⏳ Pending Follow-up",
          badgeClasses: "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-800 hover:bg-sky-100",
          icon: Clock,
          subText: fs.daysElapsed !== undefined ? `Day ${fs.daysElapsed + 1}/10` : "Active window",
          tooltip: fs.details || "Follow-up inspection is currently pending within active 10-day window"
        };
      }

      if (fs.status === "overdue") {
        return {
          status: "overdue",
          badgeText: fs.badgeText || "✕ Overdue",
          badgeClasses: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 hover:bg-rose-100",
          icon: XCircle,
          subText: `${fs.daysElapsed || 0} days`,
          tooltip: fs.details || `Follow-up overdue by ${fs.daysElapsed || 0} days`
        };
      }
    }

    // 2. Client-side relation checks:
    // If response has parentResponseId, it is a follow-up matched to a parent
    if (response?.parentResponseId) {
      const parentInList = responses?.find(
        (r: any) => (r.id && r.id === response.parentResponseId) || (r._id && r._id === response.parentResponseId)
      );
      if (parentInList) {
        let parentStatus = tableDisplayStatuses[parentInList.id || parentInList._id] || parentInList.status || "Accepted";
        if (parentStatus === "pending") parentStatus = "Direct Ok";
        const parentSubmitter = parentInList.submittedBy || "Inspector";
        return {
          status: "matched",
          badgeText: "✓ Parent Matched",
          badgeClasses: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100",
          icon: Eye,
          subText: `Status: ${parentStatus}`,
          tooltip: `Linked to parent response by ${parentSubmitter} (Status: ${parentStatus})`,
          parentResponseId: String(response.parentResponseId),
          parentFormId: form?.parentFormId || form?.parentForm || response?.parentFormId,
          matchedChassis: chassisVal || unitId,
        };
      }
      return {
        status: "matched",
        badgeText: "✓ Parent Matched",
        badgeClasses: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100",
        icon: Eye,
        subText: "Linked to Parent",
        tooltip: `Linked to parent response (${response.parentResponseId.slice(0, 10)}...)`,
        parentResponseId: String(response.parentResponseId),
        parentFormId: form?.parentFormId || form?.parentForm || response?.parentFormId,
        matchedChassis: chassisVal || unitId,
      };
    }

    // Check if this response is a parent that has a child follow-up response in the list
    const chassisVal = getResponseChassisValue(response);
    const unitId = getChassisOrItemId(response, chassisQuestionId);

    const hasChildMatch = responses?.some(
      (r: any) =>
        (r.parentResponseId && (r.parentResponseId === respId || r.parentResponseId === response?.id)) ||
        (unitId && unitId !== "unknown" && r.parentResponseId && getChassisOrItemId(r, chassisQuestionId) === unitId) ||
        (unitId && unitId !== "unknown" && r.id !== respId && getChassisOrItemId(r, chassisQuestionId) === unitId && (r.batchId?.includes("-t2") || r.batchId?.includes("-fu-")))
    );

    if (hasChildMatch) {
      return {
        status: "matched",
        badgeText: "✓ Follow-up Done",
        badgeClasses: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100",
        icon: CheckCircle2,
        subText: "Follow-up Complete",
        tooltip: `Follow-up inspection completed for chassis "${chassisVal || unitId || ""}"`
      };
    }

    // Fallback: Check if child response matches a parent response in the list by unique unitId
    if (!response?.parentResponseId && isChildForm && unitId && unitId !== "unknown") {
      const parentInList = responses?.find(
        (r: any) => r.id !== respId && getChassisOrItemId(r, chassisQuestionId) === unitId
      );
      if (parentInList) {
        let parentStatus = tableDisplayStatuses[parentInList.id || parentInList._id] || parentInList.status || "Accepted";
        if (parentStatus === "pending") parentStatus = "Direct Ok";
        const pId = parentInList.id || parentInList._id;
        return {
          status: "matched",
          badgeText: "✓ Parent Matched",
          badgeClasses: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100",
          icon: Eye,
          subText: `Status: ${parentStatus}`,
          tooltip: `Matched parent response by chassis/unit "${unitId}" (Status: ${parentStatus})`,
          parentResponseId: pId ? String(pId) : undefined,
          parentFormId: form?.parentFormId || form?.parentForm || parentInList.questionId || parentInList.formId,
          matchedChassis: unitId,
        };
      }
    }

    if (isChildForm) {
      const hasValidUnit = Boolean(chassisVal && chassisVal !== "-" && !["TVS", "SAIFY", "LMPL", "SREEDEVI", "NAHARS"].includes(chassisVal.trim().toUpperCase()));
      if (!hasValidUnit) {
        return {
          status: "none",
          badgeText: "-",
          badgeClasses: "text-gray-400 dark:text-gray-500",
          icon: null,
          subText: "",
          tooltip: "Unable to determine chassis unit for parent lookup"
        };
      }
      // Child form with valid chassis but no parent matched -> "⚠ No Parent Match"
      return {
        status: "unmatched",
        badgeText: "⚠ No Parent Match",
        badgeClasses: "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800 hover:bg-amber-100",
        icon: AlertTriangle,
        subText: "Standalone Follow-up",
        tooltip: `Chassis "${chassisVal || ""}" has not been inspected in the parent form yet`
      };
    }

    if (isParentForm && chassisVal) {
      const createdAtDate = response?.createdAt ? new Date(response.createdAt) : new Date();
      const daysElapsed = Math.floor((Date.now() - createdAtDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysElapsed <= 10) {
        return {
          status: "pending",
          badgeText: `⏳ Day ${daysElapsed + 1}/10`,
          badgeClasses: "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-800 hover:bg-sky-100",
          icon: Clock,
          subText: `Day ${daysElapsed + 1}/10`,
          tooltip: `Follow-up inspection is pending within active 10-day window (Day ${daysElapsed + 1} of 10)`
        };
      }
      return {
        status: "overdue",
        badgeText: `✕ Overdue (${daysElapsed}d)`,
        badgeClasses: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 hover:bg-rose-100",
        icon: XCircle,
        subText: `${daysElapsed} days`,
        tooltip: `Follow-up overdue by ${daysElapsed} days`
      };
    }

    return {
      status: "standalone",
      badgeText: "Main Record",
      badgeClasses: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600",
      icon: CheckCircle2,
      subText: "Standard",
      tooltip: "Standard inspection submission"
    };
  };

  // Central column filter matcher for both client-filtered full dataset and paginated table responses
  const matchSingleColumnFilter = (response: any, columnId: string, allowedValues: string[]): boolean => {
    if (!allowedValues || allowedValues.length === 0) return true;
    const respId = response.id || response._id;

    // 1. __attemptRank
    if (columnId === "__attemptRank") {
      const rank = chassisAttemptRanks[respId] || (response.responseRanks && chassisQuestionId ? response.responseRanks[chassisQuestionId] : 1);
      const rowStatus = tableDisplayStatuses[respId] || responseStatuses[respId] || "Pending Review";
      let colorLabel = "Green - Accepted";
      if (rowStatus === "Rejected") {
        colorLabel = "Red - Rejected";
      } else if (rowStatus?.includes("Rework") && rowStatus !== "Rework Accepted" && rowStatus !== "Rework Completed") {
        colorLabel = "Yellow - Rework";
      } else if (rowStatus === "Direct Ok" || rowStatus === "Rework Accepted" || rowStatus === "Accepted" || rowStatus === "Rework Completed" || rowStatus === "Verified") {
        colorLabel = "Green - Accepted";
      } else {
        colorLabel = "Gray - Pending";
      }
      const fullLabel = `Attempt ${rank} (${colorLabel})`;
      return (
        allowedValues.includes(fullLabel) ||
        allowedValues.includes(`Attempt ${rank}`) ||
        allowedValues.some(v => v === `Attempt ${rank}` || v.startsWith(`Attempt ${rank}`))
      );
    }

    // 2. __submittedBy
    if (columnId === "__submittedBy") {
      const submitter = (response.submittedBy || response.createdBy?.name || response.createdBy?.email || (typeof response.createdBy === "string" ? response.createdBy : "") || "Anonymous").toLowerCase().trim();
      return allowedValues.some((av) => {
        const avLower = av.toLowerCase().trim();
        return submitter === avLower || submitter.includes(avLower);
      });
    }

    // 3. __status (ultra-fast O(1) loop)
    if (columnId === "__status") {
      const statusVal =
        (respId ? tableDisplayStatuses[respId] || responseStatuses[respId] : null) ||
        tableDisplayStatuses[response.id] ||
        responseStatuses[response.id] ||
        computeFastRowStatus(response, chassisQuestionId) ||
        response.status ||
        "Direct Ok";
      const rawStatus = String(statusVal).toLowerCase().trim();

      for (let i = 0; i < allowedValues.length; i++) {
        const avLower = allowedValues[i].toLowerCase().trim();
        if ((avLower.includes("rework") && avLower !== "rework accepted" && avLower !== "rework completed") || avLower === "ongoing rework") {
          const isReworkStatus = rawStatus.includes("rework") && rawStatus !== "rework accepted" && rawStatus !== "rework completed";
          if (isReworkStatus) {
            const itemId = getChassisOrItemId(response, chassisQuestionId);
            if (!itemId || !resolvedReworkChassisSet.has(itemId.toLowerCase().trim())) {
              return true;
            }
          }
        } else if (avLower === "direct ok" || avLower === "accepted") {
          if (rawStatus === "direct ok" || rawStatus === "accepted" || rawStatus === "verified") return true;
        } else if (avLower === "rework accepted") {
          if (rawStatus === "rework accepted" || rawStatus === "rework completed") return true;
        } else if (avLower === "pending review" || avLower === "pending" || avLower === "-") {
          if (rawStatus === "pending review" || rawStatus === "pending" || rawStatus === "-") return true;
        } else if (rawStatus === avLower || rawStatus.includes(avLower)) {
          return true;
        }
      }
      return false;
    }

    // 4. __chassisNumber
    if (columnId === "__chassisNumber") {
      const chassisVal = (getResponseChassisValue(response) || "").toLowerCase().trim();
      return allowedValues.some((av) => {
        const avLower = av.toLowerCase().trim();
        return chassisVal === avLower || chassisVal.includes(avLower);
      });
    }

    // 5. __parentMatch
    if (columnId === "__parentMatch") {
      const pm = computeParentMatch(response);
      const pmBadge = (pm.badgeText || "").toLowerCase().trim();
      const pmStatus = (pm.status || "").toLowerCase().trim();
      return allowedValues.some((av) => {
        const avLower = av.toLowerCase().trim();
        if (pmBadge === avLower) return true;
        if (pmBadge === "-" || pmStatus === "none") return avLower === "-";
        if (avLower.includes("no parent") || avLower.includes("orphan") || avLower.includes("mismatch") || avLower.includes("unmatched")) {
          return pmStatus === "unmatched" || pmBadge.includes("no parent");
        }
        if (avLower.includes("parent matched")) {
          return pmBadge.includes("parent matched") || (pmStatus === "matched" && !pmBadge.includes("follow-up done"));
        }
        if (avLower.includes("follow-up done")) {
          return pmBadge.includes("follow-up done");
        }
        if (avLower.includes("pending")) {
          return pmStatus === "pending" || pmBadge.includes("pending");
        }
        if (avLower.includes("overdue")) {
          return pmStatus === "overdue" || pmBadge.includes("overdue");
        }
        if (avLower.includes("main")) {
          return pmStatus === "standalone" || pmBadge.includes("main");
        }
        return false;
      });
    }

    // 6. __biwReview
    if (columnId === "__biwReview") {
      const biwStatus = (response.biwReview?.status || "").toLowerCase().trim();
      return allowedValues.some((av) => {
        const avLower = av.toLowerCase().trim();
        if (avLower === "no review yet" || avLower === "pending review" || avLower === "pending" || avLower === "-") {
          // 🔒 Rework units are not eligible for review and are NOT counted in pending review accountability
          if (!isReviewEligibleResponse(response)) return false;
          return !biwStatus || biwStatus === "pending review" || biwStatus === "pending" || biwStatus === "no review yet" || biwStatus === "-";
        }
        if (avLower === "rework" || avLower === "reworked") {
          return biwStatus === "rework" || biwStatus === "reworked";
        }
        if (avLower === "accepted") {
          return biwStatus === "accepted";
        }
        if (avLower === "rejected") {
          return biwStatus === "rejected";
        }
        return biwStatus === avLower;
      });
    }

    // 6b. __tvsReview / __review (Chat & Discussion Review filter)
    if (columnId === "__tvsReview" || columnId === "__review") {
      const serverRev = (response as any).review;
      const parentRev = (response as any).parentReview || (response as any).followUpStatus?.parentReview;
      const childRev = (response as any).childReview || (response as any).followUpStatus?.childReview;
      const tvsRev = tvsReviews.find((tr) =>
        String(tr.responseId || tr.response_id || "") === String(response.id) ||
        String(tr.responseId || tr.response_id || "") === String(response._id)
      );
      const localReview = reviewedBy[response.id];

      const selfStatus = String(
        serverRev?.status ||
        serverRev?.reviewOption ||
        localReview?.option ||
        localReview?.status ||
        tvsRev?.status ||
        tvsRev?.reviewOption ||
        ""
      ).toLowerCase().trim();
      const parentStatus = String(parentRev?.status || parentRev?.reviewOption || "").toLowerCase().trim();
      const childStatus = String(childRev?.status || childRev?.reviewOption || "").toLowerCase().trim();

      const activeStatuses = [selfStatus, parentStatus, childStatus].filter(
        (st) => Boolean(st && st !== "pending" && st !== "no review yet" && st !== "-")
      );

      const revReviewer = String(
        (typeof serverRev?.reviewer === "object" ? serverRev?.reviewer?.name || serverRev?.reviewer?.email : serverRev?.reviewerName || serverRev?.reviewer) ||
        localReview?.name ||
        localReview?.reviewer ||
        tvsRev?.reviewer?.name ||
        tvsRev?.reviewer ||
        ""
      ).toLowerCase().trim();

      return allowedValues.some((av) => {
        const avLower = av.toLowerCase().trim();
        if (avLower === "no review yet" || avLower === "pending review" || avLower === "unreviewed" || avLower === "pending" || avLower === "-") {
          // 🔒 Rework units are not eligible for review and are NOT counted in pending review accountability
          if (!isReviewEligibleResponse(response)) return false;
          return activeStatuses.length === 0;
        }
        if (avLower === "reviewed") {
          return activeStatuses.length > 0;
        }
        if (avLower === "accepted") {
          return activeStatuses.some((st) => st.includes("accept"));
        }
        if (avLower === "rejected") {
          return activeStatuses.some((st) => st.includes("reject"));
        }
        if (avLower === "reworked" || avLower === "rework" || avLower === "defects") {
          return activeStatuses.some((st) => st.includes("rework"));
        }
        if (revReviewer && (revReviewer === avLower || revReviewer.includes(avLower))) {
          return true;
        }
        return false;
      });
    }

    // 7. __dispatch
    if (columnId === "__dispatch") {
      const isDispatched = !!response.isDispatched;
      const status =
        tableDisplayStatuses[response.id] ||
        responseStatuses[response.id] ||
        response.status ||
        "";
      const biwStatus = (response.biwReview?.status || "").toLowerCase().trim();
      const tvsStatus = String(
        (response as any).review?.status ||
        (response as any).review?.reviewOption ||
        ""
      ).toLowerCase().trim();

      let hasDefectInAnswers = false;
      if (response.answers) {
        for (const [k, v] of Object.entries(response.answers)) {
          if (!v || k === "chassis_number" || k === "chassis") continue;
          const vStr = typeof v === "object" ? String((v as any).status || (v as any).value || "") : String(v);
          if (/rework|defect|fail|reject|not ok|no/i.test(vStr.trim())) {
            hasDefectInAnswers = true;
            break;
          }
        }
      }

      const isReworkOrRejected =
        hasDefectInAnswers ||
        status === "Rejected" ||
        status === "Rework 1" ||
        status === "Rework 2" ||
        status === "Rework" ||
        status === "Reworked" ||
        (status?.toLowerCase().includes("rework") && !status?.toLowerCase().includes("accepted") && !status?.toLowerCase().includes("completed")) ||
        biwStatus === "rejected" ||
        biwStatus === "reworked" ||
        biwStatus === "rework" ||
        tvsStatus === "rejected" ||
        tvsStatus === "rework" ||
        tvsStatus === "reworked";

      const canShowDispatch =
        !isReworkOrRejected &&
        (status === "Direct Ok" ||
          status === "Rework Accepted" ||
          status === "Rework Completed" ||
          status === "Accepted" ||
          (!hasDefectInAnswers && (status === "pending" || !status)));

      return allowedValues.some((av) => {
        const avLower = av.toLowerCase().trim();
        if (avLower.includes("dispatched") && !avLower.includes("pending")) {
          return isDispatched;
        }
        if (avLower.includes("pending") || avLower.includes("not")) {
          // A response is Pending Dispatch ONLY if it is not dispatched AND canShowDispatch AND not under rework (displays checkbox, never '-')
          return !isDispatched && canShowDispatch && !isReworkOrRejected;
        }
        return true;
      });
    }

    // Dynamic question answer filter
    let answer = response.answers?.[columnId];
    if (answer === null || answer === undefined) {
      if (
        columnId === chassisQuestionId ||
        columnId === "chassis_number" ||
        columnId === "chassisNumber"
      ) {
        answer =
          response.answers?.chassis_number ||
          response.answers?.chassisNumber ||
          response.chassisNumber;
      }
    }
    if (answer === null || answer === undefined) {
      return allowedValues.includes("No Response") || allowedValues.includes("");
    }
    const answerValues = extractAnswerValues(answer);
    return answerValues.some((v) => {
      if (!v) return false;
      const vLower = v.toLowerCase();
      return allowedValues.some((av) => {
        if (!av) return false;
        const avLower = av.toLowerCase();
        return vLower === avLower || vLower.includes(avLower) || avLower.includes(vLower);
      });
    });
  };

  // Scope-filtered responses: applies date, inspector, and location filters (overall form scope),
  // but explicitly EXCLUDES table-level column filters (__status, __dispatch) and quick search.
  // This guarantees that top KPI cards and overall inspection charts never collapse to 0 when
  // the user filters the responses table by a specific status.
  const scopeFilteredResponses = useMemo(() => {
    let result = baseFilteredResponses;

    // 0. Filter by target identification / chassis units if specified in URL
    if (targetUnitsSet.size > 0) {
      result = result.filter((response) => {
        const chResolved = getResponseChassisValue(response);
        if (chResolved && chResolved !== "-" && targetUnitsSet.has(chResolved.toLowerCase())) return true;
        if (response.chassisNumber && targetUnitsSet.has(String(response.chassisNumber).toLowerCase())) return true;
        const chVal = response.answers?.chassis_number;
        if (chVal) {
          if (typeof chVal === "object") {
            if (chVal.chassisNumber && targetUnitsSet.has(String(chVal.chassisNumber).toLowerCase())) return true;
            if (chVal.partDescription && targetUnitsSet.has(String(chVal.partDescription).toLowerCase())) return true;
          } else if (targetUnitsSet.has(String(chVal).toLowerCase())) {
            return true;
          }
        }
        if (response.answers) {
          for (const [key, val] of Object.entries(response.answers)) {
            if (val === null || val === undefined) continue;
            if (typeof val === "object") {
              const valStr = JSON.stringify(val).toLowerCase();
              for (const u of targetUnitsSet) {
                if (valStr.includes(u)) return true;
              }
            } else {
              const strVal = String(val).toLowerCase();
              if (targetUnitsSet.has(strVal)) return true;
            }
          }
        }
        return false;
      });
    }

    // 1. Global Date Filter
    if (dateFilter.type !== "all") {
      result = result.filter((response) => {
        const timestamp = getResponseTimestamp(response);
        if (!timestamp) return false;
        const responseDate = toLocalDateString(timestamp);

        if (dateFilter.type === "single" && dateFilter.startDate) {
          return responseDate === dateFilter.startDate;
        } else if (
          dateFilter.type === "range" &&
          dateFilter.startDate &&
          dateFilter.endDate
        ) {
          return (
            responseDate >= dateFilter.startDate &&
            responseDate <= dateFilter.endDate
          );
        }
        return true;
      });
    }

    // 2. Global Inspector Filter
    if (selectedInspectorForTrend !== "Overall") {
      result = result.filter(
        (response) => response.submittedBy === selectedInspectorForTrend,
      );
    }

    return result;
  }, [baseFilteredResponses, targetUnitsSet, dateFilter, selectedInspectorForTrend]);

  const filteredResponses = useMemo(() => {
    let result = scopeFilteredResponses;

    // 3. Overall search term filter — uses deferredSearchTerm so the input
    //    remains responsive while React batches the expensive filter pass.
    if (deferredSearchTerm.trim() !== "") {
      const term = deferredSearchTerm.toLowerCase().trim();
      result = result.filter((response) => {
        // Match submitter
        const submitter = (response.submittedBy || response.createdBy || "").toLowerCase();
        if (submitter.includes(term)) return true;

        // Match status
        const status = (responseStatuses[response.id] || "").toLowerCase();
        if (status.includes(term)) return true;

        // Match chassis number
        const chResolved = getResponseChassisValue(response);
        if (chResolved && chResolved !== "-" && chResolved.toLowerCase().includes(term)) return true;
        if (response.chassisNumber && String(response.chassisNumber).toLowerCase().includes(term)) return true;
        const chVal = response.answers?.chassis_number;
        if (chVal) {
          if (typeof chVal === "object") {
            if (chVal.chassisNumber && String(chVal.chassisNumber).toLowerCase().includes(term)) return true;
            if (chVal.partDescription && String(chVal.partDescription).toLowerCase().includes(term)) return true;
          } else if (String(chVal).toLowerCase().includes(term)) {
            return true;
          }
        }

        // Match any answers in the response
        if (response.answers) {
          for (const [key, val] of Object.entries(response.answers)) {
            if (val === null || val === undefined) continue;

            if (typeof val === "object") {
              const valStr = JSON.stringify(val).toLowerCase();
              if (valStr.includes(term)) return true;
            } else {
              if (String(val).toLowerCase().includes(term)) return true;
            }
          }
        }

        return false;
      });
    }

    // 4. Column filters (supports __attemptRank, __status, __submittedBy, __chassisNumber, __parentMatch, __biwReview, __dispatch, and questions)
    const activeColumnFilters = Object.entries(columnFilters).filter(
      ([, values]) => Boolean(values && values.length > 0)
    );
    if (activeColumnFilters.length > 0) {
      result = result.filter((response) => {
        return activeColumnFilters.every(([columnId, allowedValues]) =>
          matchSingleColumnFilter(response, columnId, allowedValues || [])
        );
      });
    }

    return result;
  }, [scopeFilteredResponses, deferredSearchTerm, responseStatuses, columnFilters, chassisAttemptRanks, tableDisplayStatuses, chassisQuestionId, resolvedReworkChassisSet, targetUnitsSet]);

  useEffect(() => {
    setResponsesPage(1);
  }, [dateFilter, selectedInspectorForTrend, id, responsesSearchTerm, columnFilters, tableSort, targetUnitsSet]);

  // Check if any client-side filters (column filters, search term, date, or inspector) or sort are active
  const hasActiveFiltersOrSort = useMemo(() => {
    return (
      Object.values(columnFilters).some((v) => v && v.length > 0) ||
      responsesSearchTerm.trim() !== "" ||
      dateFilter.type !== "all" ||
      selectedInspectorForTrend !== "Overall" ||
      tableSort !== null ||
      targetUnitsSet.size > 0
    );
  }, [columnFilters, responsesSearchTerm, dateFilter, selectedInspectorForTrend, tableSort, targetUnitsSet]);

  // Sort helper function that handles natural alphanumeric sorting
  const sortResponses = (list: Response[]) => {
    if (!tableSort) return list;
    const { columnId, direction } = tableSort;
    const isAsc = direction === "asc";

    return [...list].sort((a, b) => {
      // Chassis sorting
      if (
        columnId === "__chassisNumber" ||
        columnId === "chassis_number" ||
        (chassisQuestionId && columnId === chassisQuestionId)
      ) {
        const chassisValA = String(getResponseChassisValue(a) || "");
        const chassisValB = String(getResponseChassisValue(b) || "");
        const chassisCmp = chassisValA.localeCompare(chassisValB, undefined, { numeric: true, sensitivity: "base" });
        return isAsc ? chassisCmp : -chassisCmp;
      }

      // Submitted by sorting
      if (columnId === "__submittedBy") {
        const subValA = String(a.submittedBy || (a as any).createdBy?.name || (a as any).createdBy || "");
        const subValB = String(b.submittedBy || (b as any).createdBy?.name || (b as any).createdBy || "");
        const subCmp = subValA.localeCompare(subValB, undefined, { numeric: true, sensitivity: "base" });
        return isAsc ? subCmp : -subCmp;
      }

      // Status sorting
      if (columnId === "__status") {
        const statusValA = String(tableDisplayStatuses[a.id] || responseStatuses[a.id] || a.status || "");
        const statusValB = String(tableDisplayStatuses[b.id] || responseStatuses[b.id] || b.status || "");
        const statusCmp = statusValA.localeCompare(statusValB, undefined, { numeric: true, sensitivity: "base" });
        return isAsc ? statusCmp : -statusCmp;
      }

      // Timestamp sorting
      if (columnId === "timestamp" || columnId === "__timestamp") {
        const timeA = getResponseTimestamp(a) || 0;
        const timeB = getResponseTimestamp(b) || 0;
        return isAsc ? timeA - timeB : timeB - timeA;
      }

      // Time Taken sorting
      if (columnId === "__timeSpent" || columnId === "timeSpent") {
        const timeA = a.timeSpent ?? a.totalTimeSpent ?? 0;
        const timeB = b.timeSpent ?? b.totalTimeSpent ?? 0;
        return isAsc ? timeA - timeB : timeB - timeA;
      }

      // Attempt Rank sorting
      if (columnId === "__attemptRank") {
        const rankA = chassisAttemptRanks[a.id] || (a.responseRanks && chassisQuestionId ? a.responseRanks[chassisQuestionId] : 1);
        const rankB = chassisAttemptRanks[b.id] || (b.responseRanks && chassisQuestionId ? b.responseRanks[chassisQuestionId] : 1);
        return isAsc ? rankA - rankB : rankB - rankA;
      }

      // Parent Match sorting
      if (columnId === "__parentMatch") {
        const matchA = computeParentMatch(a).badgeText;
        const matchB = computeParentMatch(b).badgeText;
        const parentCmp = String(matchA).localeCompare(String(matchB));
        return isAsc ? parentCmp : -parentCmp;
      }

      // TVS Review (Chat) sorting
      if (columnId === "__review" || columnId === "__tvsReview") {
        const localRevA = reviewedBy[a.id];
        const serverRevA = (a as any).review;
        const statusA = localRevA?.option || localRevA?.status || serverRevA?.status || serverRevA?.reviewOption || "";
        const reviewerA = localRevA?.reviewer || localRevA?.name || (typeof serverRevA?.reviewer === "object" ? serverRevA?.reviewer?.name : serverRevA?.reviewer) || "";

        const localRevB = reviewedBy[b.id];
        const serverRevB = (b as any).review;
        const statusB = localRevB?.option || localRevB?.status || serverRevB?.status || serverRevB?.reviewOption || "";
        const reviewerB = localRevB?.reviewer || localRevB?.name || (typeof serverRevB?.reviewer === "object" ? serverRevB?.reviewer?.name : serverRevB?.reviewer) || "";

        const strA = `${statusA} ${reviewerA}`.trim();
        const strB = `${statusB} ${reviewerB}`.trim();
        const cmp = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: "base" });
        return isAsc ? cmp : -cmp;
      }

      // BIW Review sorting
      if (columnId === "__biwReview") {
        const statusA = String(a.biwReview?.status || "");
        const statusB = String(b.biwReview?.status || "");
        const cmp = statusA.localeCompare(statusB, undefined, { numeric: true, sensitivity: "base" });
        return isAsc ? cmp : -cmp;
      }

      // Generic question answer sorting
      const ansA = a.answers?.[columnId];
      const ansB = b.answers?.[columnId];
      const valA = String(extractAnswerValues(ansA).join(" ") || "");
      const valB = String(extractAnswerValues(ansB).join(" ") || "");
      const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: "base" });
      return isAsc ? cmp : -cmp;
    });
  };

  // Sorted and filtered responses across the entire dataset
  const sortedFilteredResponses = useMemo(() => {
    return sortResponses(filteredResponses);
  }, [filteredResponses, tableSort, chassisQuestionId, chassisAttemptRanks, tableDisplayStatuses, responseStatuses]);

  // When filters/sort are active and full dataset `responses` is in memory, total count is `sortedFilteredResponses.length`.
  // Otherwise, fallback to server count `totalResponsesCount`.
  // Special case: when dispatch=pending is in URL and full dataset hasn't streamed yet, use the
  // server-provided totalResponsesCount directly (server already filtered by dispatch).
  const activeTotalResponsesCount = (() => {
    if (hasActiveFiltersOrSort && responses.length > 0) {
      // Full dataset loaded — use accurate client-filtered count
      return sortedFilteredResponses.length;
    }
    // Not yet streamed: server count is authoritative
    return totalResponsesCount;
  })();

  const totalResponsesPages = Math.max(1, Math.ceil(activeTotalResponsesCount / responsesPageSize));
  const currentResponsesPage = Math.min(responsesPage, totalResponsesPages);
  const responsesStartIndex = activeTotalResponsesCount > 0 ? (currentResponsesPage - 1) * responsesPageSize : 0;
  const responsesEndIndex = (hasActiveFiltersOrSort && responses.length > 0)
    ? Math.min(responsesStartIndex + responsesPageSize, activeTotalResponsesCount)
    : responsesStartIndex + tableResponses.length;

  // Responses displayed in the Responses tab table (supports slicing from sortedFilteredResponses when full dataset is loaded)
  const displayedTableResponses = useMemo(() => {
    if (hasActiveFiltersOrSort && responses.length > 0) {
      const startIndex = (currentResponsesPage - 1) * responsesPageSize;
      return sortedFilteredResponses.slice(startIndex, startIndex + responsesPageSize);
    }

    let result = tableResponses;

    if (targetUnitsSet.size > 0) {
      result = result.filter((response) => {
        const chResolved = getResponseChassisValue(response);
        if (chResolved && chResolved !== "-" && targetUnitsSet.has(chResolved.toLowerCase())) return true;
        if (response.chassisNumber && targetUnitsSet.has(String(response.chassisNumber).toLowerCase())) return true;
        const chVal = response.answers?.chassis_number;
        if (chVal) {
          if (typeof chVal === "object") {
            if (chVal.chassisNumber && targetUnitsSet.has(String(chVal.chassisNumber).toLowerCase())) return true;
            if (chVal.partDescription && targetUnitsSet.has(String(chVal.partDescription).toLowerCase())) return true;
          } else if (targetUnitsSet.has(String(chVal).toLowerCase())) {
            return true;
          }
        }
        if (response.answers) {
          for (const [key, val] of Object.entries(response.answers)) {
            if (val === null || val === undefined) continue;
            if (typeof val === "object") {
              const valStr = JSON.stringify(val).toLowerCase();
              for (const u of targetUnitsSet) {
                if (valStr.includes(u)) return true;
              }
            } else {
              const strVal = String(val).toLowerCase();
              if (targetUnitsSet.has(strVal)) return true;
            }
          }
        }
        return false;
      });
    }

    const activeColumnFilters = Object.entries(columnFilters).filter(
      ([, values]) => Boolean(values && values.length > 0)
    );

    if (activeColumnFilters.length > 0) {
      result = result.filter((response) => {
        return activeColumnFilters.every(([columnId, allowedValues]) => {
          if (!allowedValues || allowedValues.length === 0) return true;
          return matchSingleColumnFilter(response, columnId, allowedValues);
        });
      });
    }

    if (tableSort) {
      result = sortResponses(result);
    }

    return result;
  }, [hasActiveFiltersOrSort, responses, sortedFilteredResponses, tableResponses, columnFilters, currentResponsesPage, responsesPageSize, chassisAttemptRanks, tableDisplayStatuses, responseStatuses, chassisQuestionId, tableSort, targetUnitsSet]);

  // Fetch TVS reviews for visible table responses when server-paginated
  useEffect(() => {
    if (!displayedTableResponses || displayedTableResponses.length === 0) return;

    const visibleIds = displayedTableResponses
      .map((r: any) => String(r?.id || r?._id || ""))
      .filter(Boolean);

    const missingIds = visibleIds.filter((respId) => !fetchedReviewIdsSetRef.current.has(respId));
    if (missingIds.length === 0) return;

    missingIds.forEach((respId) => fetchedReviewIdsSetRef.current.add(respId));

    const fetchTableReviews = async () => {
      try {
        const data = await apiClient.request<any>("/responses/reviews/bulk", {
          method: "POST",
          body: JSON.stringify({ responseIds: missingIds }),
        });
        const reviewsList = Array.isArray(data) ? data : (data?.data || []);
        if (reviewsList.length > 0) {
          setTvsReviews((prev) => {
            const map = new Map();
            prev.forEach((r: any) => map.set(String(r.id || r._id || r.responseId || r.response_id), r));
            reviewsList.forEach((r: any) => map.set(String(r.id || r._id || r.responseId || r.response_id), r));
            return Array.from(map.values());
          });
        }
      } catch (err) {
        console.error("Error fetching reviews for table rows:", err);
      }
    };

    fetchTableReviews();
  }, [displayedTableResponses]);

  // Dispatchable responses logic for bulk dispatch checkbox in table header
  const dispatchableResponses = useMemo(() => {
    return (displayedTableResponses || []).filter((response) => {
      if (!isOwnTenantResponse(response)) return false; // exclude cross-tenant

      const status =
        tableDisplayStatuses[response.id] ||
        responseStatuses[response.id] ||
        response.status ||
        "";
      const isReworkOrRejected =
        status === "Rejected" ||
        status === "Rework 1" ||
        status === "Rework 2" ||
        status === "Rework" ||
        status === "Reworked";

      const canShowDispatch =
        !isReworkOrRejected &&
        (status === "Direct Ok" ||
          status === "Rework Accepted" ||
          status === "Rework Completed" ||
          status === "Accepted");

      return canShowDispatch;
    });
  }, [displayedTableResponses, isOwnTenantResponse, tableDisplayStatuses, responseStatuses]);

  const pendingDispatchResponses = useMemo(() => {
    return dispatchableResponses.filter((response) => !response.isDispatched);
  }, [dispatchableResponses]);

  const isAllDispatchableSelected =
    pendingDispatchResponses.length > 0 &&
    pendingDispatchResponses.every((r) => selectedDispatchIds.includes(r.id));

  const handleHeaderDispatchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const selectableIds = pendingDispatchResponses
        .filter((r) => isOwnTenantResponse(r))
        .map((r) => r.id);
      setSelectedDispatchIds((prev) => Array.from(new Set([...prev, ...selectableIds])));
    } else {
      const pageIds = new Set(pendingDispatchResponses.map((r) => r.id));
      setSelectedDispatchIds((prev) => prev.filter((id) => !pageIds.has(id)));
    }
  };

  const handleExecuteBulkDispatch = async () => {
    if (selectedDispatchIds.length === 0) return;
    setIsBulkDispatching(true);
    try {
      const dispatchedAt = new Date().toISOString();
      const dispatchUpdatePayload = {
        isDispatched: true,
        dispatchedAt,
        dispatchedBy: user?._id || user?.id,
        dispatchedByName: user?.name || (user as any)?.username || "Admin",
      };

      await Promise.all(
        selectedDispatchIds.map((id) =>
          apiClient.updateResponse(id, dispatchUpdatePayload)
        )
      );

      // Update in-memory responses and tableResponses
      setResponses((currentResponses) =>
        currentResponses.map((r) =>
          selectedDispatchIds.includes(r.id)
            ? { ...r, ...dispatchUpdatePayload }
            : r
        )
      );

      setTableResponses((current) =>
        current.map((r) =>
          selectedDispatchIds.includes(r.id)
            ? { ...r, ...dispatchUpdatePayload }
            : r
        )
      );

      setSelectedDispatchIds([]);
      setShowBulkDispatchConfirm(false);
      showToast(
        `Dispatch enabled for ${selectedDispatchIds.length} response${selectedDispatchIds.length === 1 ? "" : "s"
        }.`,
        "success"
      );
    } catch (error) {
      console.error("Failed to batch enable dispatch:", error);
      showToast("Failed to enable dispatch for selected responses.", "error");
    } finally {
      setIsBulkDispatching(false);
    }
  };

  const pageSizesList = useMemo(() => {
    const base = [20, 50, 100];
    if (totalResponsesCount <= 100) {
      return base;
    }



    const sizes = [...base];
    if (totalResponsesCount <= 300) {
      for (let s = 150; s <= Math.min(300, totalResponsesCount + 50); s += 50) {
        sizes.push(s);
      }
    } else {
      const steps = [200, 300, 500, 1000, 2000, 5000];
      for (const step of steps) {
        sizes.push(step);
        if (step >= totalResponsesCount) break;
      }
    }
    return Array.from(new Set(sizes)).sort((a, b) => a - b);
  }, [totalResponsesCount]);

  const analytics = useMemo(() => {
    const total = scopeFilteredResponses.length;
    const pending = scopeFilteredResponses.filter(
      (r) => r.status === "pending" || !r.status,
    ).length;
    const verified = scopeFilteredResponses.filter(
      (r) => r.status === "verified",
    ).length;
    const rejected = scopeFilteredResponses.filter(
      (r) => r.status === "rejected",
    ).length;

    const recentResponses = scopeFilteredResponses
      .filter((r) => getResponseTimestamp(r))
      .sort((a, b) => {
        const timestampA = getResponseTimestamp(a);
        const timestampB = getResponseTimestamp(b);
        const dateA = timestampA ? new Date(timestampA).getTime() : 0;
        const dateB = timestampB ? new Date(timestampB).getTime() : 0;
        if (isNaN(dateA) && isNaN(dateB)) return 0;
        if (isNaN(dateA)) return 1;
        if (isNaN(dateB)) return -1;
        return dateB - dateA;
      })
      .slice(0, 5);

    // 🔥 FIX: Use scope-filtered responses date range, not today's date
    const responseTrend = scopeFilteredResponses.reduce(
      (acc: Record<string, number>, response) => {
        const timestamp = getResponseTimestamp(response);
        if (timestamp) {
          const dateObj = new Date(timestamp);
          if (!isNaN(dateObj.getTime())) {
            const date = dateObj.toISOString().split("T")[0];
            acc[date] = (acc[date] || 0) + 1;
          }
        }
        return acc;
      },
      {},
    );

    // 🔥 FIX: Get dates from the actual filtered responses
    let dateRange: string[] = [];

    if (dateFilter.type !== "all" && dateFilter.startDate && dateFilter.endDate) {
      // Use the filtered date range
      const start = new Date(dateFilter.startDate);
      const end = new Date(dateFilter.endDate);
      const days: string[] = [];
      const current = new Date(start);

      while (current <= end) {
        days.push(current.toISOString().split("T")[0]);
        current.setDate(current.getDate() + 1);
      }
      dateRange = days;
    } else {
      // Fallback to last 30 days if no filter applied
      dateRange = Array.from({ length: 30 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        return date.toISOString().split("T")[0];
      }).reverse();
    }

    // Get response counts for each day in the range
    const counts = dateRange.map((date) => responseTrend[date] || 0);
    const maxCount = Math.max(...counts, 1);
    const percentageData = counts.map((count) =>
      Math.round((count / maxCount) * 100),
    );

    return {
      total,
      pending,
      verified,
      rejected,
      recentResponses,
      responseTrend,
      dateRange, // ← Use this instead of last30Days
      percentageData,
    };
  }, [scopeFilteredResponses, dateFilter.startDate, dateFilter.endDate, dateFilter.type]);

  const responseTrendSummary = useMemo(() => {
    const dates = analytics?.dateRange || [];
    const trendMap = analytics?.responseTrend || {};
    const counts = dates.map((d) => trendMap[d] || 0);
    const totalInPeriod = counts.reduce((sum, c) => sum + c, 0);
    const activeDays = counts.filter((c) => c > 0).length;
    const avgPerDay = dates.length > 0 ? (totalInPeriod / dates.length).toFixed(1) : "0";

    let peakCount = 0;
    let peakDate = "";
    dates.forEach((d) => {
      const c = trendMap[d] || 0;
      if (c > peakCount) {
        peakCount = c;
        peakDate = d;
      }
    });

    const formattedPeakDate = peakDate
      ? new Date(peakDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "-";

    return {
      totalInPeriod,
      avgPerDay,
      peakCount,
      formattedPeakDate,
      activeDays,
      totalDays: dates.length,
    };
  }, [analytics.dateRange, analytics.responseTrend]);

  // qualityChartResponses and sectionChartResponses use scopeFilteredResponses
  // (scoped to date range, location, and inspector), unaffected by table column filters.
  const dateFilteredResponses = useMemo(() => {
    return scopeFilteredResponses;
  }, [scopeFilteredResponses]);

  const qualityChartResponses = dateFilteredResponses;
  const sectionChartResponses = dateFilteredResponses;

  const sharedDateFilteredSectionPerformanceStats = useMemo(() => {
    if (analyticsView !== "dashboard" && analyticsView !== "overall") {
      return [];
    }
    return computeSectionPerformanceStats(form, dateFilteredResponses);
  }, [form, dateFilteredResponses, analyticsView]);

  const qualitySectionPerformanceStats =
    sharedDateFilteredSectionPerformanceStats;

  const dashboardSectionPerformanceStats =
    sharedDateFilteredSectionPerformanceStats;





  // Helper to safely extract display values from any answer type


  const uniqueColumnValues = useMemo(() => {
    const map = new Map<string, string[]>();
    const sets = new Map<string, Set<string>>();

    responses.forEach((response) => {
      if (!response.answers) return;
      Object.entries(response.answers).forEach(([qId, answer]) => {
        if (!sets.has(qId)) {
          sets.set(qId, new Set<string>());
        }
        const s = sets.get(qId)!;
        const values = extractAnswerValues(answer);
        values.forEach(v => { if (v) s.add(v); });
      });
    });

    form?.sections?.forEach((section) => {
      section.questions?.forEach((q: any) => {
        if (!sets.has(q.id)) {
          const s = new Set<string>([""]);
          sets.set(q.id, s);
        } else {
          sets.get(q.id)!.add("");
        }
      });
    });

    sets.forEach((set, qId) => {
      const sorted = Array.from(set).sort((a, b) => {
        const strA = String(a ?? "");
        const strB = String(b ?? "");
        if (strA === "") return 1;
        if (strB === "") return -1;
        return strA.localeCompare(strB, undefined, { numeric: true, sensitivity: "base" });
      });
      map.set(qId, sorted);
    });

    return map;
  }, [form, responses]);

  const getUniqueColumnValues = (
    questionId: string,
    responses: Response[],
  ): string[] => {
    const values = new Set<string>();
    responses.forEach((response) => {
      const answer = response.answers?.[questionId];
      if (answer !== null && answer !== undefined) {
        if (Array.isArray(answer)) {
          answer.forEach((item) => {
            const strValue = String(item).trim();
            if (strValue) values.add(strValue);
          });
        } else {
          const strValue = String(answer).trim();
          if (strValue) values.add(strValue);
        }
      } else {
        values.add("");
      }
    });
    return Array.from(values).sort((a, b) => {
      const strA = String(a ?? "");
      const strB = String(b ?? "");
      if (strA === "") return 1;
      if (strB === "") return -1;
      return strA.localeCompare(strB, undefined, { numeric: true, sensitivity: "base" });
    });
  };

  const hasAnswerValue = (value: any) => {
    if (value === null || value === undefined) {
      return false;
    }
    if (typeof value === "string") {
      return value.trim() !== "";
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (typeof value === "object") {
      return Object.keys(value).length > 0;
    }
    return true;
  };

  const renderAnswerDisplay = (value: any, question?: any): React.ReactNode => {
    const ensureAbsoluteFileSource = (input: any) => {
      if (!input || typeof input !== "string") {
        return "";
      }
      if (input.startsWith("data:")) {
        return input;
      }
      if (input.startsWith("http://") || input.startsWith("https://")) {
        return input;
      }
      if (input.startsWith("//")) {
        if (typeof window !== "undefined" && window.location) {
          return `${window.location.protocol}${input}`;
        }
        return `https:${input}`;
      }
      const normalized = input.startsWith("/") ? input : `/${input}`;
      if (typeof window !== "undefined" && window.location) {
        return `${window.location.origin}${normalized}`;
      }
      return normalized;
    };

    const extractFileName = (input: any) => {
      if (!input || typeof input !== "string") {
        return undefined;
      }
      try {
        const sanitized = input.split("?")[0];
        const parts = sanitized.split("/");
        const name = parts[parts.length - 1] || undefined;
        return name ? decodeURIComponent(name) : undefined;
      } catch {
        return undefined;
      }
    };

    const resolveFileData = (input: any) => {
      if (!input) {
        return null;
      }
      const candidate =
        Array.isArray(input) && input.length === 1 ? input[0] : input;
      if (typeof candidate === "string") {
        if (candidate.startsWith("data:")) {
          return {
            data: candidate,
            fileName: question?.fileName || question?.name,
          };
        }
        if (
          candidate.startsWith("http") ||
          candidate.startsWith("//") ||
          candidate.startsWith("/") ||
          candidate.startsWith("uploads/")
        ) {
          const absolute = ensureAbsoluteFileSource(candidate);
          return {
            url: absolute,
            fileName:
              question?.fileName ||
              question?.name ||
              extractFileName(candidate),
          };
        }
        return null;
      }
      if (typeof candidate === "object") {
        const dataValue =
          candidate.data ||
          candidate.value ||
          candidate.file ||
          candidate.base64 ||
          candidate.url ||
          candidate.answer ||
          candidate.path;
        const nameValue =
          candidate.fileName ||
          candidate.filename ||
          candidate.name ||
          question?.fileName ||
          question?.name;
        if (typeof dataValue === "string" && dataValue.startsWith("data:")) {
          return { data: dataValue, fileName: nameValue };
        }
        if (typeof dataValue === "string") {
          const absolute = ensureAbsoluteFileSource(dataValue);
          return {
            url: absolute,
            fileName: nameValue || extractFileName(dataValue),
          };
        }
        if (typeof candidate.url === "string") {
          const absolute = ensureAbsoluteFileSource(candidate.url);
          return {
            url: absolute,
            fileName: nameValue || extractFileName(candidate.url),
          };
        }
      }
      return null;
    };

    if (value === null || value === undefined || value === "") {
      return <span className="text-gray-400">No response</span>;
    }

    if (question?.type === "date" || (typeof value === "string" && /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(value))) {
      return formatToDDMMYYYY(value);
    }

    if (question?.id === chassisQuestionId || (question?.text && question.text.toLowerCase().includes("chassis"))) {
      const displayVal = getChassisDisplayValue(value);
      if (displayVal && displayVal !== "-" && displayVal !== "No response" && displayVal !== "None" && displayVal !== "N/A") {
        return (
          <span className="text-gray-900 dark:text-gray-100 font-medium text-xs">
            {displayVal}
          </span>
        );
      }
      return <span className="text-gray-400 dark:text-gray-500 text-xs font-medium">None</span>;
    }

    if (typeof value === "string") {
      if (value.startsWith("data:")) {
        return (
          <FilePreview
            data={value}
            fileName={question?.fileName || question?.name}
          />
        );
      }

      if (isImageUrl(value)) {
        return <ImageLink text={value} />;
      }

      if (
        value.startsWith("http") ||
        value.startsWith("//") ||
        value.startsWith("/") ||
        value.startsWith("uploads/")
      ) {
        const absolute = ensureAbsoluteFileSource(value);
        if (isImageUrl(absolute)) {
          return <ImageLink text={absolute} />;
        }
        return (
          <a
            href={absolute}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800"
          >
            {value}
          </a>
        );
      }

      const trimmed = value.trim();
      return trimmed ? (
        trimmed
      ) : (
        <span className="text-gray-400">No response</span>
      );
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-gray-400">No response</span>;
      }

      const previews = value
        .map((entry: any, index: number) => {
          const fileData = resolveFileData(entry);
          if (!fileData) {
            if (typeof entry === "string" && isImageUrl(entry)) {
              return <ImageLink key={index} text={entry} />;
            }
            return (
              <span key={index} className="text-sm">
                {String(entry)}
              </span>
            );
          }
          if (isImageUrl(fileData.url || fileData.data || "")) {
            return (
              <ImageLink
                key={index}
                text={fileData.url || fileData.data || ""}
              />
            );
          }
          return (
            <FilePreview
              key={`${question?.id ?? "file-array"}-${index}`}
              data={fileData.data}
              url={fileData.url}
              fileName={fileData.fileName}
            />
          );
        })
        .filter(Boolean);

      if (previews.length) {
        return <div className="flex flex-wrap gap-2">{previews}</div>;
      }
    }

    if (typeof value === "object") {
      const fileData = resolveFileData(value);
      if (fileData?.url || fileData?.data) {
        const finalUrl = fileData.url || fileData.data;
        if (finalUrl && isImageUrl(finalUrl)) {
          return <ImageLink text={finalUrl} />;
        }
        if (fileData.data) {
          return (
            <FilePreview data={fileData.data} fileName={fileData.fileName} />
          );
        }
        if (fileData.url) {
          return (
            <FilePreview url={fileData.url} fileName={fileData.fileName} />
          );
        }
      }

      if (!Object.keys(value).length) {
        return <span className="text-gray-400">No response</span>;
      }

      const isChassisType =
        value.chassisNumber !== undefined ||
        value.status !== undefined ||
        value.zone !== undefined ||
        value.zones !== undefined ||
        value.categories !== undefined;

      if (isChassisType) {
        const parts: {
          label: string;
          value: string;
          zoneColor?: string;
          isImage?: boolean;
        }[] = [];

        // Get color for zone
        const getZoneColor = (zoneName: string): string => {
          const z = zoneName.toLowerCase().trim();
          if (z.includes("zone a") || z === "a") return "blue";
          if (z.includes("zone b") || z === "b") return "green";
          if (z.includes("zone c") || z === "c") return "purple";
          if (z.includes("zone d") || z === "d") return "orange";
          if (z.includes("zone e") || z === "e") return "pink";
          if (z.includes("zone f") || z === "f") return "cyan";
          return "indigo";
        };

        if (
          value.chassisNumber &&
          String(value.chassisNumber).trim() &&
          String(value.chassisNumber).toLowerCase() !== "no response"
        ) {
          parts.push({
            label: "Chassis",
            value: String(value.chassisNumber),
            zoneColor: "blue",
          });
        }
        if (
          value.status &&
          String(value.status).trim() &&
          String(value.status).toLowerCase() !== "no response"
        ) {
          parts.push({
            label: "Status",
            value: String(value.status),
            zoneColor: "red",
          });
        }
        if (
          (value.remark || value.remarks) &&
          String(value.remark || value.remarks).trim() &&
          String(value.remark || value.remarks).toLowerCase() !== "no response"
        ) {
          parts.push({
            label: "Remark",
            value: String(value.remark || value.remarks),
            zoneColor: "amber",
          });
        }
        const zoneRaw = value.zone || value.zones;
        if (zoneRaw) {
          const zoneVal = Array.isArray(zoneRaw)
            ? zoneRaw.join(", ")
            : String(zoneRaw);
          if (zoneVal.trim()) {
            // If multiple zones, use a mixed color
            if (zoneVal.includes(",")) {
              parts.push({
                label: "Zone",
                value: zoneVal,
                zoneColor: "indigo",
              });
            } else {
              parts.push({
                label: "Zone",
                value: zoneVal,
                zoneColor: getZoneColor(zoneVal),
              });
            }
          }
        }

        // Handle zonesData (categories, defects, remarks) - with zone colors
        if (value.zonesData && typeof value.zonesData === "object") {
          const zoneEntries = Object.entries(value.zonesData);
          for (const [zoneName, zoneVal] of zoneEntries) {
            const zoneColor = getZoneColor(zoneName);
            const colorMap: Record<string, string> = {
              blue: "bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200",
              green:
                "bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200",
              purple:
                "bg-purple-50 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200",
              orange:
                "bg-orange-50 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200",
              pink: "bg-pink-50 dark:bg-pink-900/30 text-pink-800 dark:text-pink-200",
              cyan: "bg-cyan-50 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-200",
              red: "bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200",
              amber:
                "bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200",
              indigo:
                "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200",
            };
            const colorClass = colorMap[zoneColor] || colorMap.indigo;

            // Add zone header
            parts.push({ label: "Zone", value: zoneName, zoneColor });

            const categories = (zoneVal as any)?.categories;
            if (categories && Array.isArray(categories)) {
              for (const cat of categories) {
                const catName =
                  typeof cat === "string"
                    ? cat
                    : cat?.name || cat?.category || cat?.categoryName || "-";
                parts.push({
                  label: "Category",
                  value: String(catName),
                  zoneColor,
                });

                const defects = cat?.defects;
                if (defects && Array.isArray(defects)) {
                  for (const defect of defects) {
                    const defectName =
                      typeof defect === "string"
                        ? defect
                        : defect?.name || defect?.defect || "-";
                    const defectDetails =
                      typeof defect === "object" ? defect?.details || {} : {};
                    const remark =
                      defectDetails?.remark || defectDetails?.remarks || "-";
                    parts.push({
                      label: "Defect",
                      value: String(defectName),
                      zoneColor,
                    });
                    if (
                      remark &&
                      String(remark).trim() &&
                      String(remark).toLowerCase() !== "-"
                    ) {
                      parts.push({
                        label: "Remark",
                        value: String(remark),
                        zoneColor,
                      });
                    }
                    const fileUrl =
                      defectDetails?.fileUrl ||
                      defectDetails?.file ||
                      defect?.fileUrl ||
                      defect?.file ||
                      defect?.imageUrl ||
                      "";
                    if (
                      fileUrl &&
                      String(fileUrl).toLowerCase() !== "no response" &&
                      String(fileUrl).trim()
                    ) {
                      parts.push({
                        label: "Evidence",
                        value: String(fileUrl),
                        zoneColor,
                        isImage: true,
                      });
                    }
                  }
                }
              }
            }
          }
        }

        // Handle categories (direct property) - both object and array formats
        if (value.categories) {
          if (Array.isArray(value.categories)) {
            // ChassisWithoutZone format: array of category objects
            for (const cat of value.categories) {
              const catName = cat?.name || cat?.category || "-";
              if (catName !== "-") {
                parts.push({
                  label: "Category",
                  value: String(catName),
                  zoneColor: "purple",
                });

                const defects = cat?.defects;
                if (defects && Array.isArray(defects)) {
                  for (const defect of defects) {
                    const defectName =
                      typeof defect === "string"
                        ? defect
                        : defect?.name || defect?.defect || "-";
                    const defectDetails =
                      typeof defect === "object" ? defect?.details || {} : {};
                    const remark =
                      defectDetails?.remark || defectDetails?.remarks || "-";
                    parts.push({
                      label: "Defect",
                      value: String(defectName),
                      zoneColor: "purple",
                    });
                    if (
                      remark &&
                      String(remark).trim() &&
                      String(remark).toLowerCase() !== "-"
                    ) {
                      parts.push({
                        label: "Remark",
                        value: String(remark),
                        zoneColor: "purple",
                      });
                    }
                    const fileUrl =
                      defectDetails?.fileUrl ||
                      defectDetails?.file ||
                      defect?.fileUrl ||
                      defect?.file ||
                      defect?.imageUrl ||
                      "";
                    if (
                      fileUrl &&
                      String(fileUrl).toLowerCase() !== "no response" &&
                      String(fileUrl).trim()
                    ) {
                      parts.push({
                        label: "Evidence",
                        value: String(fileUrl),
                        zoneColor: "purple",
                        isImage: true,
                      });
                    }
                  }
                }
              }
            }
          } else if (typeof value.categories === "object") {
            // Object format: key-value pairs
            const catEntries = Object.entries(value.categories);
            for (const [catKey, catVal] of catEntries) {
              parts.push({
                label: String(catKey),
                value: String(catVal),
                zoneColor: "amber",
              });
            }
          }
        }

        // Handle evidenceUrl or other direct evidence fields
        const directEvidence =
          value.evidenceUrl ||
          value.fileUrl ||
          value.file ||
          value.imageUrl ||
          value.evidence ||
          value.evidenceImage;

        if (
          directEvidence &&
          String(directEvidence).toLowerCase() !== "no response" &&
          String(directEvidence).trim() &&
          !parts.some((p) => p.label === "Evidence")
        ) {
          parts.push({
            label: "Evidence",
            value: String(directEvidence),
            zoneColor: "indigo",
            isImage: true,
          });
        }

        if (parts.length > 0) {
          return (
            <div className="flex flex-col gap-2">
              {parts.map((part, idx) => {
                const colorMap: Record<string, string> = {
                  blue: "bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200",
                  green:
                    "bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200",
                  purple:
                    "bg-purple-50 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200",
                  orange:
                    "bg-orange-50 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200",
                  pink: "bg-pink-50 dark:bg-pink-900/30 text-pink-800 dark:text-pink-200",
                  cyan: "bg-cyan-50 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-200",
                  red: "bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200",
                  amber:
                    "bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200",
                  indigo:
                    "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200",
                };
                const colorClass =
                  colorMap[part.zoneColor || "indigo"] || colorMap.indigo;

                return (
                  <div key={idx} className="flex items-start gap-2">
                    <span
                      className={`px-2 py-1 ${colorClass} text-xs rounded font-medium min-w-[70px]`}
                    >
                      {part.label}
                    </span>
                    {part.isImage || part.label === "Evidence" ? (
                      <ImageLink text={part.value} isImage={true} showImage={true} />
                    ) : (
                      <span
                        className={`px-2 py-1 ${colorClass} text-xs rounded font-medium`}
                      >
                        {part.value}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        }

        return <span className="text-gray-400">No response</span>;
      }

      const entries = Object.entries(value);
      return (
        <div className="flex flex-col gap-2">
          {entries.map(([k, v], i) => (
            <div
              key={i}
              className="flex flex-col gap-0.5 border-l-2 border-gray-100 dark:border-gray-800 pl-2"
            >
              <span className="text-[10px] font-bold opacity-70 uppercase tracking-tighter text-blue-800 dark:text-blue-300">
                {k}
              </span>
              {renderAnswerDisplay(v)}
            </div>
          ))}
        </div>
      );
    }

    return (
      <pre className="text-xs whitespace-pre-wrap">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  };

  const formatChatAnswerValue = (val: any): React.ReactNode => {
    if (val === undefined || val === null || val === "") {
      return <span className="text-gray-400 italic">No response</span>;
    }
    let parsed = val;
    if (typeof parsed === "string" && parsed.trim().startsWith("{") && parsed.trim().endsWith("}")) {
      try {
        parsed = JSON.parse(parsed);
      } catch { }
    }
    if (typeof parsed === "object" && parsed !== null) {
      if (parsed.status !== undefined || parsed.remark !== undefined || parsed.evidenceUrl !== undefined) {
        const s = String(parsed.status || "").trim();
        const norm = s.toLowerCase();
        const isOk = norm === "accepted" || norm === "direct ok" || norm === "ok";
        const isDefect = norm === "rejected" || norm.includes("rework") || norm === "not ok";
        return (
          <span className="inline-flex items-center gap-1.5 flex-wrap">
            {s && (
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${isOk
                  ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border border-green-200 dark:border-green-800"
                  : isDefect
                    ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-800"
                    : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200"
                  }`}
              >
                {s}
              </span>
            )}
            {parsed.remark && String(parsed.remark).trim() && (
              <span className="text-[11px] text-gray-600 dark:text-gray-300 font-medium">
                Remark: <span className="italic font-normal">"{String(parsed.remark).trim()}"</span>
              </span>
            )}
            {parsed.evidenceUrl && String(parsed.evidenceUrl).trim() && (
              <a
                href={parsed.evidenceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 underline hover:text-indigo-800"
              >
                [View Photo]
              </a>
            )}
          </span>
        );
      }
      if (parsed.chassisNumber) {
        return <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">{parsed.chassisNumber}</span>;
      }
      if (Array.isArray(parsed)) {
        if (parsed.length === 0) return <span className="text-gray-400 italic">No response</span>;
        return <span className="text-gray-700 dark:text-gray-300">{parsed.map((p) => (typeof p === "object" ? (p?.name || p?.label || JSON.stringify(p)) : String(p))).join(", ")}</span>;
      }
      const cleanEntries = Object.entries(parsed).filter(([k, v]) => Boolean(v) && typeof v !== "object");
      if (cleanEntries.length > 0) {
        return (
          <span className="inline-flex items-center gap-1.5 flex-wrap">
            {cleanEntries.map(([k, v], i) => (
              <span key={i} className="text-[11px] text-gray-700 dark:text-gray-300">
                <span className="font-semibold text-gray-500 text-[10px] uppercase mr-0.5">{k}:</span>
                {String(v)}
              </span>
            ))}
          </span>
        );
      }
    }
    return <span className="text-gray-800 dark:text-gray-200 font-medium">{String(parsed)}</span>;
  };








  const visibleDashboardSectionStats = useMemo(
    () =>
      dashboardSectionPerformanceStats.filter((stat) =>
        selectedSectionIds.includes(stat.id),
      ),
    [dashboardSectionPerformanceStats, selectedSectionIds],
  );

  const sectionSummaryRows = useMemo(
    () =>
      visibleDashboardSectionStats
        .map((stat) => {
          const rowYesCount = stat.yes + (stat.accepted || 0);
          const rowNoCount = stat.no + (stat.rejected || 0);
          const rowNaCount = stat.na + (stat.rework || 0);

          const yesPercent = stat.total ? (rowYesCount / stat.total) * 100 : 0;
          const noPercent = stat.total ? (rowNoCount / stat.total) * 100 : 0;
          const naPercent = stat.total ? (rowNaCount / stat.total) * 100 : 0;

          return {
            id: stat.id,
            title: stat.title,
            yesPercent,
            yesCount: rowYesCount,
            noPercent,
            noCount: rowNoCount,
            naPercent,
            naCount: rowNaCount,
            total: stat.total,
          };
        })
        // Sort by Yes percentage in descending order
        .sort((a, b) => b.yesPercent - a.yesPercent),
    [visibleDashboardSectionStats],
  );

  const summaryTotals = useMemo(() => {
    return sectionSummaryRows.reduce(
      (acc, row) => ({
        total: acc.total + row.total,
        yesCount: acc.yesCount + (row.yesCount || 0),
        noCount: acc.noCount + (row.noCount || 0),
        naCount: acc.naCount + (row.naCount || 0),
      }),
      {
        total: 0,
        yesCount: 0,
        noCount: 0,
        naCount: 0,
      },
    );
  }, [sectionSummaryRows]);

  const qualitySectionSummaryRows = useMemo(
    () =>
      qualitySectionPerformanceStats.map((stat) => {
        const rowYesCount = stat.yes + (stat.accepted || 0);
        const rowNoCount = stat.no + (stat.rejected || 0);
        const rowNaCount = stat.na + (stat.rework || 0);

        const yesPercent = stat.total ? (rowYesCount / stat.total) * 100 : 0;
        const noPercent = stat.total ? (rowNoCount / stat.total) * 100 : 0;
        const naPercent = stat.total ? (rowNaCount / stat.total) * 100 : 0;

        return {
          id: stat.id,
          title: stat.title,
          yesPercent,
          yesCount: rowYesCount,
          noPercent,
          noCount: rowNoCount,
          naPercent,
          naCount: rowNaCount,
          total: stat.total,
        };
      }),
    [qualitySectionPerformanceStats],
  );

  const uniqueInspectors = useMemo(() => {
    // Combine inspectors from responses, inspectorSummary, and allInspectors (Role-based)
    const inspectors = new Set<string>();

    // From Responses
    baseFilteredResponses.forEach((r) => {
      if (r.submittedBy) inspectors.add(r.submittedBy);
    });

    // From Admin/System Summary
    inspectorSummary.forEach((s) => {
      if (s.qcInspector) inspectors.add(s.qcInspector);
    });

    // From Role-based fetch (All users with Inspector role)
    allInspectors.forEach((i) => {
      if (i.name) inspectors.add(i.name);
      if (i.email) inspectors.add(i.email);
    });

    return Array.from(inspectors).sort();
  }, [baseFilteredResponses, inspectorSummary, allInspectors]);

  const inspectionStats = useMemo(() => {
    let accepted = 0;
    let rejected = 0;
    let rawReworked = 0;
    let reworkCompleted = 0;
    let dispatched = 0;
    let pending = 0;
    let rawBiwReviewed = 0;
    let rawBiwAccepted = 0;
    let rawBiwDefects = 0;
    let tvsReviewed = 0;
    let tvsAccepted = 0;
    let tvsDefects = 0;
    let nonDispatched = 0;

    const tvsReviewMap = new Map<string, any>();
    tvsReviews.forEach((tr: any) => {
      const rid = String(tr.responseId || tr.response_id || tr.id || tr._id || "");
      if (rid) tvsReviewMap.set(rid, tr);
    });

    // Track active rework per chassis so no pending rework unit is missed
    const activeReworkChassis = new Set<string>();

    // Track BIW review at distinct chassis unit level
    const biwReviewedChassis = new Set<string>();
    const allUnitChassis = new Set<string>();
    let nonChassisBiwReviewed = 0;

    // If full responses dataset is still streaming, compute stats from available table responses.
    // Use scopeFilteredResponses (scoped to date range, location, and inspector) so that
    // table-level column filters (__status, __dispatch) do not collapse the top KPI cards or
    // overall inspection charts to 0.
    const statsSource = responses.length > 0 ? scopeFilteredResponses : tableResponses;

    statsSource.forEach((response) => {
      const respId = response.id || (response as any)._id;
      const statusVal =
        tableDisplayStatuses[response.id] ||
        tableDisplayStatuses[(response as any)._id] ||
        responseStatuses[response.id] ||
        responseStatuses[(response as any)._id] ||
        (respId ? tableDisplayStatuses[respId] || responseStatuses[respId] : null) ||
        computeFastRowStatus(response, chassisQuestionId) ||
        response.status ||
        "";
      const rawStatus = String(statusVal).trim().toLowerCase();

      const isAccepted =
        rawStatus === "direct ok" ||
        rawStatus === "accepted" ||
        rawStatus === "verified" ||
        rawStatus === "ok" ||
        rawStatus === "pass";

      const isReworkAccepted =
        rawStatus === "rework accepted" ||
        rawStatus === "rework completed" ||
        rawStatus === "rework ok" ||
        rawStatus === "reworked accepted";

      const isRework =
        !isReworkAccepted &&
        (rawStatus.startsWith("rework") ||
          rawStatus === "ongoing rework" ||
          rawStatus.includes("rework"));

      const isRejected =
        rawStatus === "rejected" ||
        rawStatus === "reject" ||
        rawStatus === "fail" ||
        rawStatus === "not ok";

      const itemId = getChassisOrItemId(response, chassisQuestionId);
      const hasValidChassis = Boolean(
        itemId && itemId !== "none" && itemId !== "-" && itemId !== "unknown"
      );
      const normalizedItemId = hasValidChassis ? itemId.toLowerCase().trim() : "";

      if (isAccepted) {
        accepted++;
      } else if (isReworkAccepted) {
        reworkCompleted++;
      } else if (isRework) {
        rawReworked++;
        if (hasValidChassis) {
          // If this chassis has not reached Rework Accepted, it is an active rework
          if (!resolvedReworkChassisSet.has(normalizedItemId)) {
            activeReworkChassis.add(normalizedItemId);
          }
        }
      } else if (isRejected) {
        rejected++;
      } else {
        pending++;
      }

      // Check if response has completed BIW review (strictly BIW review, never TVS review)
      const biwStatus = String(
        response.biwReview?.status ||
        reviewedBy[response.id]?.status ||
        reviewedBy[response.id]?.option ||
        ""
      ).trim().toLowerCase();

      const hasBiwReview =
        Boolean(biwStatus) &&
        biwStatus !== "pending review" &&
        biwStatus !== "no review yet" &&
        biwStatus !== "pending" &&
        biwStatus !== "none" &&
        biwStatus !== "-";

      if (hasBiwReview) {
        rawBiwReviewed++;
        if (biwStatus === "accepted") {
          rawBiwAccepted++;
        } else if (biwStatus === "rework" || biwStatus === "reworked" || biwStatus === "rejected") {
          rawBiwDefects++;
        }
      }

      // Check if response has completed TVS review (from embedded response.review or bulk tvsReviews)
      const trEntry = respId ? tvsReviewMap.get(String(respId)) : null;
      const tvsStatus = String(
        (response as any).review?.reviewOption ||
        (response as any).review?.status ||
        trEntry?.reviewOption ||
        trEntry?.option ||
        trEntry?.status ||
        ""
      ).trim().toLowerCase();

      const hasTvsReview =
        Boolean(tvsStatus) &&
        tvsStatus !== "pending review" &&
        tvsStatus !== "no review yet" &&
        tvsStatus !== "pending" &&
        tvsStatus !== "none" &&
        tvsStatus !== "-";

      if (hasTvsReview) {
        tvsReviewed++;
        if (tvsStatus === "accepted") {
          tvsAccepted++;
        } else if (tvsStatus === "rejected" || tvsStatus.includes("rework")) {
          tvsDefects++;
        }
      }

      if (hasValidChassis) {
        allUnitChassis.add(normalizedItemId);
        if (hasBiwReview) {
          biwReviewedChassis.add(normalizedItemId);
        }
      } else {
        if (hasBiwReview) {
          nonChassisBiwReviewed++;
        }
      }

      // Dispatch is tracked independently of status - once marked dispatched, it remains counted as dispatched.
      // Units that are NOT dispatched can only be "Pending Dispatch" if they are APPROVED (Direct Ok or Rework Accepted)
      // and NOT under active rework or rejection (which display '-' in the table).
      let hasDefectInAns = false;
      if (response.answers) {
        for (const [k, v] of Object.entries(response.answers)) {
          if (!v || k === "chassis_number" || k === "chassis") continue;
          const vStr = typeof v === "object" ? String((v as any).status || (v as any).value || "") : String(v);
          if (/rework|defect|fail|reject|not ok|no/i.test(vStr.trim())) {
            hasDefectInAns = true;
            break;
          }
        }
      }

      const isEligibleForDispatch =
        !hasDefectInAns &&
        (isAccepted || isReworkAccepted) &&
        !isRework &&
        !isRejected &&
        response.biwReview?.status !== "Rejected" &&
        response.biwReview?.status !== "Reworked" &&
        (response as any).review?.status !== "Rejected" &&
        (response as any).review?.status !== "Rework";

      if (response.isDispatched) {
        dispatched++;
      } else if (isEligibleForDispatch) {
        nonDispatched++;
      }
    });

    // Keep submission-level rework count so Direct Ok + Rework Accepted + Rework + Rejected = Total Submissions
    const reworked = rawReworked;

    // If chassis tracking is present (we identified units with valid chassis),
    // distinct BIW reviewed equals reviewed distinct chassis + non-chassis reviewed responses.
    // Otherwise, it equals rawBiwReviewed.
    const isChassisTrackingActive = allUnitChassis.size > 0;
    const biwReviewed = isChassisTrackingActive
      ? biwReviewedChassis.size + nonChassisBiwReviewed
      : rawBiwReviewed;

    // Pending dispatch strictly represents approved units waiting for dispatch (excluding active rework/rejected units showing '-')
    const pendingDispatch = Math.max(0, (accepted + reworkCompleted) - dispatched);

    return {
      accepted,
      rejected,
      reworked,
      rawReworked,
      reworkCompleted,
      dispatched,
      pendingDispatch,
      pending,
      biwReviewed,
      rawBiwReviewed,
      biwAccepted: rawBiwAccepted,
      biwDefects: rawBiwDefects,
      tvsReviewed,
      tvsAccepted,
      tvsDefects,
    };
  }, [scopeFilteredResponses, responseStatuses, tableDisplayStatuses, chassisQuestionId, resolvedReworkChassisSet, getChassisOrItemId, reviewedBy, tvsReviews]);

  const totalPieChartData = useMemo(() => {
    const directOk = inspectionStats.accepted;
    const reworkCompleted = inspectionStats.reworkCompleted;
    const totalNo = inspectionStats.rejected;
    const totalNA = inspectionStats.reworked;
    const totalDispatched = inspectionStats.dispatched;
    const totalBiwReviewed = inspectionStats.rawBiwReviewed || 0;
    const totalBiwAccepted = inspectionStats.biwAccepted || 0;
    const totalBiwDefects = inspectionStats.biwDefects || 0;

    const total = directOk + reworkCompleted + totalNo + totalNA + (inspectionStats.pending || 0);

    if (total === 0) {
      return {
        directOk: 0,
        reworkCompleted: 0,
        no: 0,
        na: 0,
        defects: 0,
        dispatched: 0,
        pendingDispatch: 0,
        biwReviewed: 0,
        pendingData: 0,
        biwAccepted: 0,
        biwDefects: 0,
        counts: {
          directOk: 0,
          reworkCompleted: 0,
          no: 0,
          na: 0,
          defects: 0,
          dispatched: 0,
          pendingDispatch: 0,
          biwReviewed: 0,
          pendingData: 0,
          biwAccepted: 0,
          biwDefects: 0,
          total: 0,
        },
      };
    }

    const directOkPercent = (directOk / total) * 100;
    const reworkCompletedPercent = (reworkCompleted / total) * 100;
    const noPercent = (totalNo / total) * 100;
    const naPercent = (totalNA / total) * 100;
    const totalDefectsCount = totalNo + totalNA;
    const defectsPercent = (totalDefectsCount / total) * 100;

    const dispatchedPercent = (totalDispatched / total) * 100;
    // Pending dispatch BIW count from inspectionStats
    const pendingDispatchCount = inspectionStats.pendingDispatch ?? Math.max(0, (directOk + reworkCompleted) - totalDispatched);
    const pendingDispatchPercent = total > 0 ? (pendingDispatchCount / total) * 100 : 0;

    const biwReviewedCount = Math.min(total, totalBiwReviewed);
    const pendingDataCount = Math.max(0, totalDispatched - biwReviewedCount);
    const biwReviewedPercent = (biwReviewedCount / total) * 100;
    const pendingDataPercent = (pendingDataCount / total) * 100;

    const biwAcceptedPercent = total > 0 ? (totalBiwAccepted / total) * 100 : 0;
    const biwDefectsPercent = total > 0 ? (totalBiwDefects / total) * 100 : 0;

    return {
      directOk: Number(directOkPercent.toFixed(1)),
      reworkCompleted: Number(reworkCompletedPercent.toFixed(1)),
      no: Number(noPercent.toFixed(1)),
      na: Number(naPercent.toFixed(1)),
      defects: Number(defectsPercent.toFixed(1)),
      dispatched: Number(dispatchedPercent.toFixed(1)),
      pendingDispatch: Number(pendingDispatchPercent.toFixed(1)),
      biwReviewed: Number(biwReviewedPercent.toFixed(1)),
      pendingData: Number(pendingDataPercent.toFixed(1)),
      biwAccepted: Number(biwAcceptedPercent.toFixed(1)),
      biwDefects: Number(biwDefectsPercent.toFixed(1)),
      counts: {
        directOk: directOk,
        reworkCompleted: reworkCompleted,
        no: totalNo,
        na: totalNA,
        defects: totalDefectsCount,
        dispatched: totalDispatched,
        pendingDispatch: pendingDispatchCount,
        biwReviewed: biwReviewedCount,
        pendingData: pendingDataCount,
        biwAccepted: totalBiwAccepted,
        biwDefects: totalBiwDefects,
        total: total,
      },
    };
  }, [inspectionStats]);



  const defectChartResponses = useMemo(() => {
    if (analyticsView !== "dashboard" && analyticsView !== "overall") {
      return [];
    }

    let result = [...scopeFilteredResponses];
    result.sort((a, b) => {
      const dateA = new Date(getResponseTimestamp(a) || 0).getTime();
      const dateB = new Date(getResponseTimestamp(b) || 0).getTime();
      return dateB - dateA;
    });

    return result;
  }, [scopeFilteredResponses, analyticsView]);

  const trendChartResponses = useMemo(() => {
    let result = [...scopeFilteredResponses];
    result.sort((a, b) => {
      const dateA = new Date(getResponseTimestamp(a) || 0).getTime();
      const dateB = new Date(getResponseTimestamp(b) || 0).getTime();
      return dateA - dateB; // Sort ascending for trend
    });

    return result;
  }, [scopeFilteredResponses]);

  const chartQuestionPerformanceStats = useMemo(() => {
    if (analyticsView !== "dashboard" && analyticsView !== "overall") {
      return [];
    }
    return computeQuestionPerformanceStats(form, defectChartResponses);
  }, [form, defectChartResponses, analyticsView]);



  const handleNavigateToResponsesFromPie = useCallback((filterType?: string, filterValue?: string) => {
    setAnalyticsView("responses");
    setActiveTab("responses");
    if (filterType === "biw" && filterValue) {
      startFilterTransition(() => {
        if (filterValue === "all") {
          setColumnFilters((prev) => ({
            ...prev,
            __biwReview: ["Accepted", "Reworked", "Rejected"],
          }));
        } else if (filterValue === "pending") {
          setColumnFilters((prev) => ({
            ...prev,
            __biwReview: ["No review yet"],
          }));
        } else {
          setColumnFilters((prev) => ({
            ...prev,
            __biwReview: [filterValue],
          }));
        }
      });
    } else if (filterType) {
      startFilterTransition(() => {
        setColumnFilters((prev) => ({
          ...prev,
          __dispatch: [filterType],
        }));
      });
    }
  }, []);

  const InspectorPerformanceChart = () => {
    const currentUserScore = performanceScores[user?._id || ""] || 100;
    const circumference = 2 * Math.PI * 45; // radius = 45
    const strokeDasharray = circumference;
    const strokeDashoffset =
      circumference - (currentUserScore / 100) * circumference;

    return (
      <div className="card p-6">


      </div>
    );
  };

  const getSectionAnalyticsData = (): SectionAnalyticsData[] => {
    if (!form?.sections || !form.sections.length) {
      return [];
    }

    const map = new Map<string, number>();
    responses.forEach((response) => {
      if (response.answers) {
        Object.keys(response.answers).forEach((qId) => {
          const answer = response.answers[qId];
          if (answer !== null && answer !== undefined && answer !== "") {
            map.set(qId, (map.get(qId) || 0) + 1);
          }
        });
      }
    });

    return form.sections
      .map((section) => {
        const stats = getSectionStats(section, responses, map);
        const qualityBreakdown = getSectionQualityBreakdown(section, responses);
        const overallQuality = calculateOverallQuality(qualityBreakdown);

        return {
          sectionId: section.id,
          sectionTitle: section.title,
          description: section.description,
          stats: {
            mainQuestionCount: stats.mainQuestionCount,
            totalFollowUpCount: stats.totalFollowUpCount,
            answeredMainQuestions: stats.answeredMainQuestions,
            answeredFollowUpQuestions: stats.answeredFollowUpQuestions,
            totalAnswered: stats.totalAnswered,
            totalResponses: stats.totalResponses,
            completionRate: stats.completionRate,
            avgResponsesPerQuestion: stats.avgResponsesPerQuestion,
            questionsDetail: stats.questionsDetail || [],
          },
          qualityBreakdown,
          overallQuality,
        };
      })
      .filter((section) => section.stats.questionsDetail.length > 0);
  };

  const fullAnalyticsData = useMemo(() => {
    if (analyticsView === "responses") {
      return null as any;
    }
    return {
      total: analytics.total,
      pending: analytics.pending,
      verified: analytics.verified,
      rejected: analytics.rejected,
      inspectionStats: inspectionStats,
      sectionSummaryRows: sectionSummaryRows,
      totalPieChartData: totalPieChartData,
      sectionAnalyticsData: getSectionAnalyticsData(),
      inspectorSummary: filteredInspectorSummary,
      summaryStatuses: summaryStatuses,
      performanceTableData: performanceTableData,
      defectStartDate: dateFilter.startDate,
      defectEndDate: dateFilter.endDate,
    };
  }, [
    analytics,
    inspectionStats,
    sectionSummaryRows,
    totalPieChartData,
    inspectorSummary,
    summaryStatuses,
    performanceTableData,
    dateFilter.startDate,
    dateFilter.endDate,
    form,
    responses,
  ]);

  const handleExportToPDF = async () => {
    try {
      setIsExporting(true);
      showToast("Generating PDF report...", "info");

      const success = await exportDashboardToPDF(
        form?.title || "Form Analytics",
        fullAnalyticsData,
        analyticsView === "section",
      );

      if (success) {
        showToast("PDF report generated successfully!", "success");
      } else {
        showToast("Failed to generate PDF. Please try again.", "error");
      }
    } catch (error) {
      console.error("Error downloading PDF:", error);
      showToast("Failed to generate PDF. Please try again.", "error");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportToExcel = async () => {
    await exportFormAnalyticsToExcel({
      form,
      id,
      isExporting,
      setIsExporting,
      showToast,
      searchParams,
      selectedResponseIds,
      responses,
      tableResponses,
      totalResponsesCount,
      analyticsResponsesLoading,
      dateFilter,
      selectedInspectorForTrend,
      responsesSearchTerm,
      deferredSearchTerm,
      responseStatuses,
      tableDisplayStatuses,
      reviewedBy,
      inspectionStats,
      selectedResponsesSectionIds,
      isChildFollowUpForm,
      showParentMatchColumn,
      computeParentMatch,
      getResponseChassisValue,
      columnFilters,
      matchSingleColumnFilter,
      tableSort,
      sortResponses,
    });
  };

  const handleViewDetails = (response: Response) => {
    const responseId = response._id || response.id;
    console.log("Navigating to response:", responseId);
    navigate(`/responses/${responseId}`);
  };

  const [loadingParentRedirectId, setLoadingParentRedirectId] = useState<string | null>(null);

  const handleViewParentResponse = async (response: any, pm?: any) => {
    const rowId = response?._id || response?.id;
    const targetParentResponseId =
      pm?.parentResponseId ||
      response?.parentResponseId ||
      response?.parentMatch?.parentResponseId ||
      response?.followUpStatus?.parentResponseId ||
      (response?.followUpStatus as any)?.parentResponseId;

    if (targetParentResponseId) {
      console.log("Navigating directly to parent response:", targetParentResponseId);
      navigate(`/responses/${targetParentResponseId}`);
      return;
    }

    // Check if matched in current loaded responses dataset
    const chassisVal = getResponseChassisValue(response) || pm?.matchedChassis;
    if (chassisVal && Array.isArray(responses)) {
      const norm = chassisVal.toLowerCase().trim();
      const parentInDataset = responses.find((r: any) => {
        const rId = r.id || r._id;
        if (rId === rowId) return false;
        const cv = getResponseChassisValue(r);
        return cv && cv.toLowerCase().trim() === norm;
      });
      const pId = parentInDataset?.id || parentInDataset?._id;
      if (pId) {
        navigate(`/responses/${pId}`);
        return;
      }
    }

    // Fallback: Query the parent form by chassis number
    const parentFId = form?.parentFormId || form?.parentForm || response?.parentFormId || pm?.parentFormId;
    if (parentFId && chassisVal) {
      try {
        setLoadingParentRedirectId(rowId);
        const searchRes: any = await apiClient.getResponsesByForm(parentFId, { search: chassisVal, limit: 10 });
        const list = searchRes?.responses || searchRes?.data || [];
        const norm = chassisVal.toLowerCase().trim();
        const matched = list.find((r: any) => {
          const cv = getResponseChassisValue(r);
          return cv && cv.toLowerCase().trim() === norm;
        }) || list[0];
        const foundId = matched?.id || matched?._id;
        if (foundId) {
          navigate(`/responses/${foundId}`);
          return;
        }
      } catch (err) {
        console.warn("Could not resolve parent response by chassis:", err);
      } finally {
        setLoadingParentRedirectId(null);
      }
    }

    // If parentFormId is known, redirect to parent form analytics responses tab filtered by chassis
    if (parentFId) {
      navigate(`/forms/${parentFId}/analytics?tab=responses&search=${encodeURIComponent(chassisVal || '')}`);
    } else {
      showToast("Parent response details could not be found for this chassis", "error");
    }
  };



  const handleEditResponse = (response: Response) => {
    const responseId = response.id || response._id;
    navigate(`/responses/${responseId}/edit-form`);
  };

  const handleOpenModal = async (response: Response) => {
    try {
      const formIdentifier = response.questionId;
      if (!formIdentifier) {
        throw new Error("Missing form identifier for response");
      }
      const formData = await apiClient.getForm(formIdentifier);
      const formDetails = formData.form;
      setSelectedResponse(response);
      setSelectedFormForModal(formDetails);
    } catch (err) {
      console.error("Failed to load form for modal:", err);
      showToast("Failed to load form. Please try again.", "error");
    }
  };

  const handleEditStart = (response: Response) => {
    setEditingResponseId(response.id);
    setEditFormData({ ...response.answers });
    setEditFormStatus(response.status || "Accepted");
    setEditFormNotes(response.notes || "");
  };

  const handleSaveEdit = async () => {
    if (!editingResponseId) return;

    try {
      setIsSaving(true);
      await apiClient.updateResponse(editingResponseId, {
        answers: editFormData,
        status: editFormStatus,
        notes: editFormNotes,
      });

      setResponses(
        responses.map((r) =>
          r.id === editingResponseId
            ? {
              ...r,
              answers: editFormData,
              status: editFormStatus,
              notes: editFormNotes,
            }
            : r,
        ),
      );

      setTableResponses((prev) =>
        prev.map((r) =>
          r.id === editingResponseId
            ? {
              ...r,
              answers: editFormData,
              status: editFormStatus,
              notes: editFormNotes,
            }
            : r,
        ),
      );

      setEditingResponseId(null);
      setEditFormData({});
      setEditFormStatus("Accepted");
      setEditFormNotes("");
      showToast("Response updated successfully!", "success");
    } catch (err) {
      console.error("Error updating response:", err);
      showToast("Failed to update response. Please try again.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingResponseId(null);
    setEditFormData({});
    setEditFormStatus("Accepted");
    setEditFormNotes("");
  };


  const [isDashboardRefreshing, setIsDashboardRefreshing] = useState(false);
  const refreshDashboardData = async () => {
    setIsDashboardRefreshing(true);
    try {
      // Clear only the relevant cache entries
      try {
        const cacheKeys = Object.keys(localStorage).filter(key =>
          key.startsWith("api_cache:") && (
            key.includes("/analytics/inspector-summary") ||
            key.includes("/analytics/performance-table") ||
            key.includes("/responses/form/") ||
            key.includes("/responses/reviews/bulk")
          )
        );
        cacheKeys.forEach(key => localStorage.removeItem(key));
      } catch (_) { }

      // Refresh all dashboard data
      await Promise.all([
        fetchFullAnalyticsResponses(),
        fetchPerformanceTable(),
        fetchSummary()
      ]);

      showToast("Dashboard refreshed successfully!", "success");
    } catch (error) {
      console.error("Refresh failed:", error);
      showToast("Failed to refresh dashboard", "error");
    } finally {
      setIsDashboardRefreshing(false);
    }
  };

  const handleDeleteResponse = async () => {
    if (!deletingResponseId) return;

    try {
      setIsDeleting(true);
      await apiClient.deleteResponse(deletingResponseId);

      setResponses(responses.filter((r) => r.id !== deletingResponseId));

      setShowDeleteConfirm(false);
      setDeletingResponseId(null);
      showToast("Response deleted successfully!", "success");
    } catch (err) {
      console.error("Error deleting response:", err);
      showToast("Failed to delete response. Please try again.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDeleteResponses = async () => {
    if (selectedResponseIds.length === 0) return;

    try {
      setIsDeleting(true);

      for (const responseId of selectedResponseIds) {
        await apiClient.deleteResponse(responseId);
      }

      setResponses(
        responses.filter((r) => !selectedResponseIds.includes(r.id)),
      );
      setSelectedResponseIds([]);
      setShowBulkDeleteConfirm(false);
      showToast(
        `${selectedResponseIds.length} response(s) deleted successfully!`,
        "success",
      );
    } catch (err) {
      console.error("Error deleting responses:", err);
      showToast("Failed to delete some responses. Please try again.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleFormExpansion = (formTitle: string) => {
    setExpandedInspectorForms((prev) => {
      const next = new Set(prev);
      if (next.has(formTitle)) {
        next.delete(formTitle);
      } else {
        next.add(formTitle);
      }
      return next;
    });
  };

  const renderSummaryTable = () => (
    <SummaryTable
      summaryLoading={summaryLoading}
      groupedInspectorSummary={groupedInspectorSummary}
      expandedInspectorForms={expandedInspectorForms}
      toggleFormExpansion={toggleFormExpansion}
      localFilterName={localFilterName}
      setLocalFilterName={setLocalFilterName}
      localFilterShift={localFilterShift}
      setLocalFilterShift={setLocalFilterShift}
      localFilterDate={localFilterDate}
      setLocalFilterDate={setLocalFilterDate}
      dateFilter={dateFilter}
      summaryStatuses={summaryStatuses}
    />
  );

  const renderPerformanceTable = () => (
    <PerformanceTable
      user={user}
      performanceTableLoading={performanceTableLoading}
      performanceTableData={performanceTableData}
      localFilterName={localFilterName}
      performanceHasMore={performanceHasMore}
      performancePage={performancePage}
      setPerformancePage={setPerformancePage}
      performancePageSize={performancePageSize}
      setPerformancePageSize={setPerformancePageSize}
    />
  );

  const renderBiwReviewTable = () => (
    <BiwReviewTable
      user={user}
      biwReviewTableData={biwReviewTableData}
      localFilterName={localFilterName}
      biwReviewPage={biwReviewPage}
      setBiwReviewPage={setBiwReviewPage}
      biwReviewPageSize={biwReviewPageSize}
      setBiwReviewPageSize={setBiwReviewPageSize}
      commonDateRangeLabel={commonDateRangeLabel}
    />
  );

  if ((loading && !form) || (analyticsView === "dashboard" && analyticsResponsesLoading && responses.length === 0)) {
    return (
      <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900 p-4 sm:p-6 md:p-8 space-y-6 animate-pulse">
        {/* Header Skeleton */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
            <div>
              <div className="w-64 h-7 bg-gray-200 dark:bg-gray-700 rounded-md mb-2"></div>
              <div className="w-40 h-4 bg-gray-100 dark:bg-gray-700/60 rounded-md"></div>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-28 h-10 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
            <div className="w-28 h-10 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
          </div>
        </div>

        {/* 2-Column Grid Skeletons */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Response Trend Chart Skeleton */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm h-[380px] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="w-40 h-6 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
              <div className="w-20 h-4 bg-gray-100 dark:bg-gray-700 rounded-md"></div>
            </div>
            <div className="w-full h-56 bg-gradient-to-t from-blue-50 to-transparent dark:from-blue-900/10 rounded-xl"></div>
          </div>

          {/* Overall Inspection Trend Donut Skeleton */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm h-[380px] flex flex-col justify-between items-center">
            <div className="w-full flex items-center justify-between">
              <div className="w-48 h-6 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
            </div>
            <div className="w-48 h-48 rounded-full border-8 border-gray-100 dark:border-gray-700"></div>
            <div className="w-3/4 h-8 bg-gray-100 dark:bg-gray-700 rounded-md"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    const isTimeoutError = error.includes('timeout') || error.includes('too long');
    const isAuthError = Boolean(
      error &&
      (String(error).toLowerCase().includes("invalid token") ||
        String(error).toLowerCase().includes("jwt expired") ||
        String(error).toLowerCase().includes("unauthorized") ||
        String(error).toLowerCase().includes("401") ||
        String(error).toLowerCase().includes("not authorized") ||
        String(error).toLowerCase().includes("no token provided") ||
        String(error).toLowerCase().includes("access denied"))
    );

    return (
      <div className="p-6">
        <div className="text-center py-12 max-w-md mx-auto">
          <div className={`rounded-2xl p-6 mb-4 border shadow-sm ${isAuthError
            ? "bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/40"
            : isTimeoutError
              ? "bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/40"
              : "bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/40"
            }`}>
            {isAuthError ? (
              <LogIn className="w-12 h-12 text-blue-600 dark:text-blue-400 mx-auto mb-4" />
            ) : isTimeoutError ? (
              <Clock className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            ) : (
              <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            )}
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">
              {isAuthError ? "Session Expired" : isTimeoutError ? "Request Timed Out" : "Error Loading Analytics"}
            </h3>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
              {isAuthError
                ? "Your login session has expired or no authentication token was found. Please log in again to continue viewing analytics."
                : error}
            </p>
          </div>

          <div className="flex gap-3 justify-center flex-wrap">
            {isAuthError ? (
              <button
                onClick={() => {
                  const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
                  window.location.href = `/login?redirect=${returnUrl}`;
                }}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-semibold shadow-md transition-all active:scale-95"
              >
                <LogIn className="w-4 h-4" />
                Log In Again
              </button>
            ) : (
              <button
                onClick={handleRetry}
                disabled={isRetrying || loading}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                {isRetrying || loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Loading...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    Retry
                  </>
                )}
              </button>
            )}

            {!isGuest && (
              <button
                onClick={() => navigate(-1)}
                className="px-6 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Go Back
              </button>
            )}

            {isGuest && (
              <button
                onClick={handleLogout}
                className="px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Log out
              </button>
            )}
          </div>

          {retryCount > 2 && (
            <p className="text-xs text-gray-400 mt-4">
              Multiple retry attempts failed. Please refresh the page or contact support.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={embedded ? "space-y-4" : "p-2 sm:p-6 space-y-4 sm:space-y-6 bg-gray-50 dark:bg-gray-950 min-h-screen"}
      id="analytics-scroll-container"
    >
      {/* Header with Tabs - Single Row */}
      <AnalyticsHeader
        form={form}
        id={id}
        isGuest={isGuest}
        embedded={embedded}
        analyticsView={analyticsView}
        onTabSwitch={handleTabSwitch}
        hasTabPermission={hasTabPermission}
        totalResponses={analytics.total}
        refreshDashboardData={refreshDashboardData}
        isDashboardRefreshing={isDashboardRefreshing}
        uniqueInspectors={uniqueInspectors}
        selectedInspectorForTrend={selectedInspectorForTrend}
        onSelectInspector={setSelectedInspectorForTrend}
        appliedFiltersCount={appliedFilters.length}
        onOpenFilterModal={() => setShowFilterModal(true)}
        onShareAnalytics={handleShareAnalytics}
        onAutoSendSetup={handleAutoSendSetup}
        onExportPDF={handleExportToPDF}
        onExportExcel={handleExportToExcel}
        isExporting={isExporting}
        onLogout={handleLogout}
        onBack={() => navigate(-1)}
      />

      {/* Dashboard View - Always render for PDF export capability, but hide if not active */}
      {(analyticsView === "dashboard" || isExporting) && (
        <div
          className={
            analyticsView === "dashboard"
              ? "space-y-6"
              : "absolute -left-[9999px] top-0 w-full opacity-0 pointer-events-none"
          }
          aria-hidden={analyticsView !== "dashboard"}
        >
          {/* Active Date / Filter Control Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-indigo-50/90 via-blue-50/60 to-purple-50/90 dark:from-indigo-950/40 dark:via-blue-950/30 dark:to-purple-950/40 border border-indigo-200/90 dark:border-indigo-800/60 rounded-xl px-4 py-2.5 shadow-xs">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                {dateFilter.type === "all" ? (
                  <span>Date: <span className="text-emerald-700 dark:text-emerald-300 font-extrabold">All Data (All Time)</span></span>
                ) : (
                  <span>Date: <span className="text-indigo-700 dark:text-indigo-300 font-extrabold">Last 30 Days ({commonDateRangeLabel})</span></span>
                )}
              </span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-600 dark:text-gray-300 font-medium">
                {isChartLoading && responses.length === 0 ? (
                  <span className="inline-flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                    <span>Loading inspections...</span>
                  </span>
                ) : (
                  <>
                    Showing <strong className="text-gray-900 dark:text-white font-bold">{scopeFilteredResponses.length}</strong> of {responses.length} inspections
                  </>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {dateFilter.type !== "all" ? (
                <button
                  type="button"
                  onClick={() => {
                    setHasUserAppliedDateFilter(true);
                    setDateFilter({ type: "all", startDate: "", endDate: "" });
                    setAppliedFilters((prev) => prev.filter((f) => f.id !== "date"));
                  }}
                  className="px-3 py-1 bg-white hover:bg-emerald-50 dark:bg-gray-800 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-lg border border-emerald-300 dark:border-emerald-700 shadow-2xs transition-all hover:scale-[1.02] flex items-center gap-1.5"
                  title="Mark and show all inspection data across all time"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Mark All Data</span>
                  <span className="text-[10px] text-gray-500 font-normal">({responses.length})</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setHasUserAppliedDateFilter(true);
                    const d30 = getLast30DaysRange();
                    setDateFilter({ type: "range", startDate: d30.startDate, endDate: d30.endDate });
                    setAppliedFilters((prev) => [
                      ...prev.filter((f) => f.id !== "date"),
                      { id: "date", label: "Date", value: `Last 30 Days (${d30.startDate} to ${d30.endDate})` },
                    ]);
                  }}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-2xs transition-all hover:scale-[1.02] flex items-center gap-1.5"
                  title="Filter to default last 30 days"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Last 30 Days (Default)</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowFilterModal(true)}
                className="px-2.5 py-1 bg-white hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-semibold rounded-lg border border-gray-300 dark:border-gray-600 transition-colors flex items-center gap-1"
                title="Open Advanced Filters"
              >
                <Filter className="w-3.5 h-3.5 text-indigo-500" />
                <span>Filter</span>
              </button>
            </div>
          </div>
          {responses.length === 0 && isChartLoading && !isExporting ? (
            <div className="space-y-6 animate-pulse">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full">
                <div className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm min-h-[340px] flex flex-col justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700"></div>
                    <div className="space-y-1.5">
                      <div className="w-28 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                      <div className="w-16 h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    </div>
                  </div>
                  <div className="h-44 w-full bg-gray-100 dark:bg-gray-700/50 rounded-lg flex items-end justify-between p-4 gap-2">
                    <div className="w-full h-1/3 bg-gray-200 dark:bg-gray-600 rounded"></div>
                    <div className="w-full h-2/3 bg-gray-200 dark:bg-gray-600 rounded"></div>
                    <div className="w-full h-1/2 bg-gray-200 dark:bg-gray-600 rounded"></div>
                    <div className="w-full h-4/5 bg-gray-200 dark:bg-gray-600 rounded"></div>
                    <div className="w-full h-3/5 bg-gray-200 dark:bg-gray-600 rounded"></div>
                  </div>
                </div>
                <div className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm min-h-[340px] flex flex-col justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700"></div>
                    <div className="space-y-1.5">
                      <div className="w-28 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                      <div className="w-20 h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    </div>
                  </div>
                  <div className="w-44 h-44 mx-auto rounded-full border-8 border-gray-200 dark:border-gray-600"></div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="w-full" id="summary-cards">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full">
                  {/* Response Trend Chart */}
                  <div className="p-4 sm:p-6 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 flex flex-col h-full rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-shadow w-full">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg mr-2">
                          <BarChart3 className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <h3 className="text-md font-bold text-primary-900 dark:text-white">
                            Response Trend
                          </h3>
                          <p className="text-xs text-primary-500 dark:text-primary-400">
                            {dateFilter.type === "all" ? "All Time Trend" : `Trend: ${commonDateRangeLabel}`}
                          </p>
                        </div>
                      </div>
                    </div>

                    {Object.keys(analytics.responseTrend).length === 0 ? (
                      <div className="flex-1 flex items-center justify-center min-h-[280px]">
                        <div className="text-center">
                          <div className="mb-2">
                            <BarChart3 className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto" />
                          </div>
                          <p className="text-sm text-primary-500 dark:text-primary-400 font-medium">
                            No responses yet
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col justify-between w-full">
                        <div
                          style={{ height: "260px", minHeight: "260px", width: "100%", position: "relative" }}
                          id="response-trend-chart"
                        >
                          <Line
                            data={{
                              labels: analytics.dateRange.map((date) =>
                                new Date(date).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                }),
                              ),
                              datasets: [
                                {
                                  label: "Responses %",
                                  data: analytics.percentageData,
                                  borderColor: "rgb(59, 130, 246)",
                                  backgroundColor: "rgba(59, 130, 246, 0.1)",
                                  fill: true,
                                  tension: 0.4,
                                  pointRadius: 4,
                                  pointHoverRadius: 6,
                                  pointBackgroundColor: "rgb(59, 130, 246)",
                                  pointBorderColor: "#fff",
                                  pointBorderWidth: 2,
                                  borderWidth: 2,
                                },
                              ],
                            }}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              devicePixelRatio: 2,
                              interaction: {
                                mode: "index" as const,
                                axis: "x" as const,
                                intersect: false,
                              },
                              plugins: {
                                legend: {
                                  display: false,
                                },
                                tooltip: {
                                  backgroundColor: "rgba(0, 0, 0, 0.8)",
                                  titleColor: "#fff",
                                  bodyColor: "#fff",
                                  cornerRadius: 6,
                                  padding: 10,
                                  titleFont: { size: 11, weight: "bold" },
                                  bodyFont: { size: 11 },
                                  callbacks: {
                                    title: (context: any) => {
                                      const index = context[0].dataIndex;
                                      const date = analytics.dateRange[index];
                                      if (!date) return "";
                                      const [y, m, d] = date.split("-").map(Number);
                                      return new Date(y, m - 1, d).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                      });
                                    },
                                    label: function (context) {
                                      return `Responses: ${context.parsed.y}`;
                                    },
                                  },
                                },
                              },
                              scales: {
                                y: {
                                  beginAtZero: true,
                                  max: 100,
                                  grid: {
                                    color: "rgba(0, 0, 0, 0.05)",
                                    drawBorder: false,
                                  },
                                  ticks: {
                                    color: "rgb(107, 114, 128)",
                                    font: { size: 10 },
                                    callback: function (value) {
                                      return value + "%";
                                    },
                                  },
                                },
                                x: {
                                  grid: {
                                    display: false,
                                    drawBorder: false,
                                  },
                                  ticks: {
                                    color: "rgb(107, 114, 128)",
                                    font: { size: 10 },
                                    maxRotation: 45,
                                    minRotation: 0,
                                    autoSkip: true,
                                    maxTicksLimit: 15,
                                  },
                                },
                              },
                            }}
                          />
                        </div>

                        {/* Bottom: Trend Summary Metrics (matching height with Overall Inspection Trend boxes) */}
                        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {/* Total In Period */}
                          <div className="text-center p-2.5 bg-blue-50/60 dark:bg-blue-900/15 rounded-xl border border-blue-100/70 dark:border-blue-800/30 shadow-xs flex flex-col justify-center items-center h-[72px]">
                            <div className="text-xs sm:text-sm font-bold text-blue-600 dark:text-blue-400">
                              {responseTrendSummary.totalInPeriod}
                            </div>
                            <div className="text-[10px] sm:text-[11px] font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                              Submissions
                            </div>
                            <div className="text-[9px] text-gray-500 dark:text-gray-400 font-medium">
                              ({responseTrendSummary.totalDays} Days)
                            </div>
                          </div>

                          {/* Daily Average */}
                          <div className="text-center p-2.5 bg-indigo-50/60 dark:bg-indigo-900/15 rounded-xl border border-indigo-100/70 dark:border-indigo-800/30 shadow-xs flex flex-col justify-center items-center h-[72px]">
                            <div className="text-xs sm:text-sm font-bold text-indigo-600 dark:text-indigo-400">
                              {responseTrendSummary.avgPerDay} / day
                            </div>
                            <div className="text-[10px] sm:text-[11px] font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                              Daily Average
                            </div>
                            <div className="text-[9px] text-gray-500 dark:text-gray-400 font-medium">
                              Inspection Pace
                            </div>
                          </div>

                          {/* Peak Day Volume */}
                          <div className="text-center p-2.5 bg-purple-50/60 dark:bg-purple-900/15 rounded-xl border border-purple-100/70 dark:border-purple-800/30 shadow-xs flex flex-col justify-center items-center h-[72px]">
                            <div className="text-xs sm:text-sm font-bold text-purple-600 dark:text-purple-400">
                              {responseTrendSummary.peakCount} units
                            </div>
                            <div className="text-[10px] sm:text-[11px] font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                              Peak Day Volume
                            </div>
                            <div className="text-[9px] text-gray-500 dark:text-gray-400 font-medium truncate max-w-full px-1">
                              {responseTrendSummary.formattedPeakDate}
                            </div>
                          </div>

                          {/* Active Days */}
                          <div className="text-center p-2.5 bg-emerald-50/60 dark:bg-emerald-900/15 rounded-xl border border-emerald-100/70 dark:border-emerald-800/30 shadow-xs flex flex-col justify-center items-center h-[72px]">
                            <div className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400">
                              {responseTrendSummary.activeDays} / {responseTrendSummary.totalDays}
                            </div>
                            <div className="text-[10px] sm:text-[11px] font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                              Active Days
                            </div>
                            <div className="text-[9px] text-gray-500 dark:text-gray-400 font-medium">
                              Production Days
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Pie Chart - COMPACT */}
                  <OverallQualityPieChartComponent
                    totalPieChartData={totalPieChartData}
                    selectedInspectorForTrend={selectedInspectorForTrend}
                    tvsReviews={tvsReviews}
                    inspectionStats={inspectionStats}
                    onNavigateToResponses={handleNavigateToResponsesFromPie}
                  />
                </div>
              </div>

              {/* Question Distribution Chart */}

              {(chartQuestionPerformanceStats.length > 0 ||
                trendChartResponses.length > 0) && (
                  <div className="w-full" id="question-distribution-card">
                    <div className="w-full space-y-6">
                      <InspectionStatusLineChartComponent
                        form={form}
                        dateFilteredResponses={dateFilteredResponses}
                        dateFilter={dateFilter}
                        darkMode={darkMode}
                      />
                      <QuestionStatusDistributionChartComponent
                        chartQuestionPerformanceStats={chartQuestionPerformanceStats}
                        chartSortOrder={chartSortOrder}
                        setChartSortOrder={setChartSortOrder}
                        chartOrientation={chartOrientation}
                        setChartOrientation={setChartOrientation}
                        complianceLabels={complianceLabels}
                        commonDateRangeLabel={commonDateRangeLabel}
                      />
                      <BiwDefectDistributionChartComponent
                        defectChartResponses={defectChartResponses}
                        responses={responses}
                        tableResponses={tableResponses}
                        form={form}
                        chartSortOrder={chartSortOrder}
                        setChartSortOrder={setChartSortOrder}
                        chartOrientation={chartOrientation}
                        setChartOrientation={setChartOrientation}
                        dateFilter={dateFilter}
                        commonDateRangeLabel={commonDateRangeLabel}
                      />
                      <TvsDefectDistributionChartComponent
                        form={form}
                        tvsReviews={tvsReviews}
                        defectChartResponses={defectChartResponses}
                        responses={responses}
                        tableResponses={tableResponses}
                        chartSortOrder={chartSortOrder}
                        setChartSortOrder={setChartSortOrder}
                        chartOrientation={chartOrientation}
                        setChartOrientation={setChartOrientation}
                        dateFilter={dateFilter}
                        commonDateRangeLabel={commonDateRangeLabel}
                      />
                      <TimeBasedPerformanceGraphComponent
                        timeSeriesView={timeSeriesView}
                        setTimeSeriesView={setTimeSeriesView}
                        trendChartResponses={trendChartResponses}
                        responseStatuses={responseStatuses}
                        dateFilter={dateFilter}
                        darkMode={darkMode}
                      />
                      <DirectAcceptedPerformanceGraphComponent
                        dateFilteredResponses={dateFilteredResponses}
                        responseStatuses={responseStatuses}
                        dateFilter={dateFilter}
                        darkMode={darkMode}
                      />
                      {renderSummaryTable()}
                      {renderPerformanceTable()}
                      {renderBiwReviewTable()}
                      <InspectorPerformanceChart />

                      <PerformanceTableBarChartComponent
                        performanceTableData={performanceTableData}
                        darkMode={darkMode}
                      />

                      {/* ✅ NEW: BIW Review Table Bar Chart */}
                      <BiwReviewTableBarChartComponent
                        biwReviewTableData={biwReviewTableData}
                        darkMode={darkMode}
                      />
                    </div>
                  </div>
                )}
            </>
          )}
        </div>
      )}

      {form && (
        <>
          {/* Responses as Table */}
          {analyticsView === "responses" && (
            <div className="space-y-4 sm:space-y-6">
              {/* Active Upload/Batch Filter Banner */}
              {(urlBatchId || urlUploadOnly === "true") && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-blue-900 dark:text-blue-200 shadow-sm animate-fadeIn">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">📁</span>
                    <div>
                      <p className="text-xs sm:text-sm font-bold flex flex-wrap items-center gap-2">
                        <span>Filtered to Uploaded Data ({activeTotalResponsesCount} records)</span>
                        {urlBatchId && (
                          <span className="font-mono text-[11px] bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 rounded text-blue-800 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-700">
                            {urlBatchId}
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-blue-600 dark:text-blue-400">
                        Showing records from Excel import. Click "Show All Form Responses" to view the complete history.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const nextParams = new URLSearchParams(searchParams);
                      nextParams.delete("batchId");
                      nextParams.delete("uploadOnly");
                      navigate(`/forms/${id}/analytics?${nextParams.toString()}`);
                    }}
                    className="shrink-0 px-3 py-1.5 text-xs font-semibold bg-white dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-center"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Show All Form Responses</span>
                  </button>
                </div>
              )}

              {/* Active Identification / Chassis Range Filter Banner */}
              {(targetUnitsSet.size > 0 || urlRangeStart || urlIdentification || urlChassis) && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl text-indigo-900 dark:text-indigo-200 shadow-sm animate-fadeIn">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">🎯</span>
                    <div>
                      <p className="text-xs sm:text-sm font-bold flex flex-wrap items-center gap-2">
                        <span>Filtered to Identification / Chassis:</span>
                        <span className="font-mono text-[11px] bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.5 rounded text-indigo-800 dark:text-indigo-300 font-semibold border border-indigo-200 dark:border-indigo-700">
                          {urlRangeStart && urlRangeEnd
                            ? `${urlRangeStart} → ${urlRangeEnd}`
                            : (urlIdentification || urlChassis || urlUnitsParam)}
                        </span>
                        <span className="text-xs text-indigo-700 dark:text-indigo-300 font-normal">
                          ({filteredResponses.length} records matching)
                        </span>
                      </p>
                      <p className="text-[11px] text-indigo-600 dark:text-indigo-400">
                        Showing only responses matching this identification or chassis range. Click "Show All Form Responses" to view complete history.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const nextParams = new URLSearchParams(searchParams);
                      nextParams.delete("units");
                      nextParams.delete("rangeStart");
                      nextParams.delete("rangeEnd");
                      nextParams.delete("identification");
                      nextParams.delete("identificationNumber");
                      nextParams.delete("chassis");
                      nextParams.delete("chassisNumber");
                      navigate(`/forms/${id}/analytics?${nextParams.toString()}`);
                    }}
                    className="shrink-0 px-3 py-1.5 text-xs font-semibold bg-white dark:bg-gray-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-center"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Show All Form Responses</span>
                  </button>
                </div>
              )}

              {/* Active Performance Table Drill-Down Banner */}
              {(urlSubmittedBy || urlBiwReviewedBy || urlReviewedCombined || urlMetricLabel) && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-900 dark:text-emerald-200 shadow-sm animate-fadeIn">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">📊</span>
                    <div>
                      <p className="text-xs sm:text-sm font-bold flex flex-wrap items-center gap-2">
                        <span>Filtered from Performance Table:</span>
                        {urlMetricLabel && (
                          <span className="text-[11px] bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-700">
                            {urlMetricLabel}
                          </span>
                        )}
                        {(urlSubmittedBy || urlBiwReviewedBy) && (
                          <span className="font-mono text-[11px] bg-white dark:bg-gray-800 px-2 py-0.5 rounded text-emerald-800 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-700">
                            {urlBiwReviewedBy ? `BIW Reviewer: ${urlBiwReviewedBy}` : `Inspector: ${urlSubmittedBy}`}
                          </span>
                        )}
                        <span className="text-xs text-emerald-700 dark:text-emerald-300 font-bold">
                          ({totalResponsesCount} exact matching records)
                        </span>
                      </p>
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                        Showing only responses contributing to this exact count{urlStartDate || urlEndDate ? ` (${urlStartDate || "..."} to ${urlEndDate || "..."})` : ""}.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const nextParams = new URLSearchParams(searchParams);
                      ["submittedBy", "biwReviewedBy", "reviewedCombined", "biwStatus", "tvsStatus", "status", "dispatch", "startDate", "endDate", "metricLabel"].forEach((k) => nextParams.delete(k));
                      navigate(`/forms/${id}/analytics?${nextParams.toString()}`);
                    }}
                    className="shrink-0 px-3 py-1.5 text-xs font-semibold bg-white dark:bg-gray-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-center"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Show All Form Responses</span>
                  </button>
                </div>
              )}

              <div className="card p-3 sm:p-6">
                <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-col">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <Table className="w-5 h-5 text-indigo-600" />
                      All Responses
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                      {isLoadingTableResponses
                        ? "Loading…"
                        : `Showing ${activeTotalResponsesCount > 0 ? responsesStartIndex + 1 : 0}-${Math.min(responsesEndIndex, activeTotalResponsesCount)} of ${activeTotalResponsesCount} responses`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center relative">
                    {/* Overall Search Bar */}
                    <div className="relative flex items-center bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 rounded-lg shadow-sm w-full sm:w-60">
                      <Search className="w-4 h-4 text-gray-400 mr-2 shrink-0" />
                      <input
                        type="text"
                        placeholder="Search responses..."
                        value={responsesSearchTerm}
                        onChange={(e) => setResponsesSearchTerm(e.target.value)}
                        className="bg-transparent text-xs text-gray-700 dark:text-gray-200 focus:outline-none w-full font-medium"
                      />
                      {responsesSearchTerm && (
                        <button
                          onClick={() => setResponsesSearchTerm("")}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-205 shrink-0 ml-1.5"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-2 py-1.5 rounded-lg shadow-sm">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Show</span>
                      <select
                        value={responsesPageSize}
                        onChange={(e) => {
                          setResponsesPageSize(Number(e.target.value));
                          setResponsesPage(1);
                        }}
                        className="bg-transparent text-xs font-bold text-gray-700 dark:text-gray-200 focus:outline-none cursor-pointer"
                      >
                        {pageSizesList.map((size) => (
                          <option key={size} value={size}>
                            {size}
                          </option>
                        ))}
                      </select>
                    </div>

                    {totalResponsesPages > 1 && (
                      <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-1 py-1 rounded-lg shadow-sm">
                        <button
                          onClick={() => setResponsesPage((prev) => Math.max(1, prev - 1))}
                          disabled={currentResponsesPage === 1}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 disabled:opacity-30 rounded transition-colors"
                          title="Previous Page"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <div className="flex items-center text-xs font-bold text-gray-700 dark:text-gray-200 px-1">
                          <input
                            type="number"
                            min={1}
                            max={totalResponsesPages}
                            value={responsesPage}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              if (val >= 1 && val <= totalResponsesPages) {
                                setResponsesPage(val);
                              }
                            }}
                            className="w-11 text-center bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 mr-1 py-0.5 text-xs font-bold"
                          />
                          <span className="text-gray-400 dark:text-gray-500 font-normal">/ {totalResponsesPages}</span>
                        </div>
                        <button
                          onClick={() => setResponsesPage((prev) => Math.min(totalResponsesPages, prev + 1))}
                          disabled={currentResponsesPage === totalResponsesPages}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 disabled:opacity-30 rounded transition-colors"
                          title="Next Page"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Top Parent Match Tick Box - Only for Follow-up / Child forms */}
                    {isChildFollowUpForm && (
                      <label
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer select-none shadow-2xs ${showParentMatchColumn
                          ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700 ring-1 ring-indigo-400"
                          : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                          }`}
                        title={showParentMatchColumn ? "Untick to hide Parent Match column" : "Tick to show Parent Match column"}
                      >
                        <input
                          type="checkbox"
                          checked={showParentMatchColumn}
                          onChange={(e) => {
                            const nextVal = e.target.checked;
                            setShowParentMatchColumn(nextVal);
                            try {
                              const formKey = id || (form as any)?._id || "default";
                              localStorage.setItem(`show_parent_match_${formKey}`, String(nextVal));
                            } catch (err) { }
                          }}
                          className="w-4 h-4 text-indigo-600 rounded border-gray-300 dark:border-gray-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                        />
                        <Link2 className={`w-3.5 h-3.5 ${showParentMatchColumn ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400"}`} />
                        <span className="whitespace-nowrap">Parent Match</span>
                      </label>
                    )}

                    <button
                      onClick={() => setShowFilterModal(true)}
                      className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center gap-1.5 border shadow-xs ${appliedFilters.length > 0 || Object.values(columnFilters).some((v) => v && v.length > 0)
                        ? "bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-500 ring-2 ring-indigo-400 ring-offset-2 dark:ring-offset-gray-900"
                        : "bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700"
                        }`}
                      title="Open Filters Dialog"
                    >
                      <Filter className="w-3.5 h-3.5" />
                      <span className="hidden xs:inline">Filters</span>
                      {(appliedFilters.length > 0 || Object.values(columnFilters).filter((v) => v && v.length > 0).length > 0) && (
                        <span className="ml-0.5 px-1.5 py-0.2 bg-white dark:bg-gray-900 text-indigo-700 dark:text-indigo-300 font-black rounded-full text-[10px]">
                          {appliedFilters.length + Object.values(columnFilters).filter((v) => v && v.length > 0).length}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() =>
                        setShowResponsesFilter(!showResponsesFilter)
                      }
                      className={`px-3 sm:px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${showResponsesFilter ? "ring-2 ring-indigo-400 ring-offset-2 dark:ring-offset-gray-900" : ""}`}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                        />
                      </svg>
                      <span className="hidden xs:inline">Filter Sections</span>
                      <span className="xs:hidden">Filter</span>
                    </button>
                    <button
                      onClick={() => handleExportToExcel()}
                      disabled={selectedResponsesSectionIds.length === 0 || isExporting}
                      className="px-3 sm:px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2"
                    >
                      {isExporting ? (
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      <span className="hidden xs:inline">
                        {isExporting ? "Exporting..." : "Export"}
                      </span>
                    </button>
                    {/* Unified BIW Review Dropdown */}
                    <div className="relative inline-block text-left" ref={biwDropdownRef}>
                      <button
                        onClick={() => setIsBiwDropdownOpen((prev) => !prev)}
                        className="px-3 sm:px-4 py-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-700 hover:to-indigo-700 text-white rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 shadow-sm"
                        title="BIW Review: Download pre-filled template or import & validate review results"
                      >
                        <ClipboardCheck className="w-4 h-4" />
                        <span>BIW Review</span>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isBiwDropdownOpen ? "rotate-180" : ""}`} />
                      </button>

                      {isBiwDropdownOpen && (
                        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                          <button
                            onClick={async () => {
                              setIsBiwDropdownOpen(false);
                              await handleDownloadBiwTemplate("filtered");
                            }}
                            className="w-full px-4 py-2.5 text-left text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-3 transition-colors"
                          >
                            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg text-emerald-600 dark:text-emerald-300 shrink-0">
                              <Download className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-gray-900 dark:text-white flex items-center justify-between gap-2">
                                <span>Download Filtered BIW Template</span>
                                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded">
                                  {(hasActiveFiltersOrSort ? filteredResponses.length : activeTotalResponsesCount).toLocaleString()}
                                </span>
                              </div>
                              <div className="text-[10px] text-gray-500 dark:text-gray-400">
                                {hasActiveFiltersOrSort
                                  ? "Only filtered chassis numbers & status"
                                  : "Pre-loads current table chassis & status"}
                              </div>
                            </div>
                          </button>

                          <button
                            onClick={async () => {
                              setIsBiwDropdownOpen(false);
                              await handleDownloadBiwTemplate("all");
                            }}
                            className="w-full px-4 py-2.5 text-left text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-3 transition-colors border-t border-gray-100 dark:border-gray-700/50"
                          >
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg text-blue-600 dark:text-blue-300 shrink-0">
                              <FileSpreadsheet className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-gray-900 dark:text-white flex items-center justify-between gap-2">
                                <span>Download Full All-Time Template</span>
                                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded">
                                  {(totalResponsesCount || responses.length).toLocaleString()}
                                </span>
                              </div>
                              <div className="text-[10px] text-gray-500 dark:text-gray-400">
                                Full all-time data across entire form
                              </div>
                            </div>
                          </button>

                          <button
                            onClick={() => {
                              setIsBiwDropdownOpen(false);
                              setIsBiwExcelModalOpen(true);
                            }}
                            className="w-full px-4 py-2.5 text-left text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-3 transition-colors border-t border-gray-100 dark:border-gray-700/50"
                          >
                            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg text-indigo-600 dark:text-indigo-300">
                              <Upload className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900 dark:text-white">Import & Validate Reviews</div>
                              <div className="text-[10px] text-gray-500 dark:text-gray-400">Validate chassis & fill review table</div>
                            </div>
                          </button>

                          <button
                            onClick={() => {
                              setIsBiwDropdownOpen(false);
                              setIsBiwHistoryModalOpen(true);
                            }}
                            className="w-full px-4 py-2.5 text-left text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-700 dark:hover:text-amber-300 flex items-center gap-3 transition-colors border-t border-gray-100 dark:border-gray-700/50"
                          >
                            <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg text-amber-600 dark:text-amber-300">
                              <Clock className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900 dark:text-white">Import History & Timeline</div>
                              <div className="text-[10px] text-gray-500 dark:text-gray-400">View changes & 5-hr undo</div>
                            </div>
                          </button>
                        </div>
                      )}
                    </div>
                    {selectedResponseIds.length > 0 && !isGuest && (
                      <>
                        <button
                          onClick={() => handleBulkBiwReviewUpdate("Accepted")}
                          disabled={isBulkBiwUpdating}
                          className="px-3 sm:px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2 animate-in fade-in zoom-in-95 duration-150"
                          title="Bulk Accept (BIW Review)"
                        >
                          {isBulkBiwUpdating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle className="w-4 h-4" />
                          )}
                          <span className="hidden md:inline">BIW Accept</span>
                          <span className="md:hidden">Accept</span>
                        </button>
                        <button
                          onClick={() => handleBulkBiwReviewUpdate("Rejected")}
                          disabled={isBulkBiwUpdating}
                          className="px-3 sm:px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2 animate-in fade-in zoom-in-95 duration-150"
                          title="Bulk Reject (BIW Review)"
                        >
                          {isBulkBiwUpdating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                          <span className="hidden md:inline">BIW Reject</span>
                          <span className="md:hidden">Reject</span>
                        </button>
                        <button
                          onClick={() => handleBulkBiwReviewUpdate("Reworked")}
                          disabled={isBulkBiwUpdating}
                          className="px-3 sm:px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2 animate-in fade-in zoom-in-95 duration-150"
                          title="Bulk Rework (BIW Review)"
                        >
                          {isBulkBiwUpdating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RotateCcw className="w-4 h-4" />
                          )}
                          <span className="hidden md:inline">BIW Rework</span>
                          <span className="md:hidden">Rework</span>
                        </button>
                        <button
                          onClick={() => handleBulkBiwReviewUpdate(null)}
                          disabled={isBulkBiwUpdating}
                          className="px-3 sm:px-4 py-2 bg-gray-500 hover:bg-gray-600 disabled:opacity-50 text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2 animate-in fade-in zoom-in-95 duration-150"
                          title="Bulk Clear BIW Review"
                        >
                          {isBulkBiwUpdating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                          <span className="hidden md:inline">BIW Clear</span>
                          <span className="md:hidden">Clear</span>
                        </button>
                        <button
                          onClick={() => setShowBulkDeleteConfirm(true)}
                          disabled={isBulkBiwUpdating}
                          className="px-3 sm:px-4 py-2 bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2 animate-in fade-in zoom-in-95 duration-150"
                          title="Delete selected responses"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="hidden xs:inline">
                            Delete ({selectedResponseIds.length})
                          </span>
                        </button>
                      </>
                    )}

                    {showResponsesFilter && (
                      <div className="absolute top-full right-0 mt-2 p-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 w-[280px] sm:w-80 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="sticky top-0 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 px-3 sm:px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                              Select Sections
                            </h4>
                            <button
                              onClick={() => setShowResponsesFilter(false)}
                              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                            >
                              <svg
                                className="w-4 h-4 text-gray-600 dark:text-gray-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                setSelectedResponsesSectionIds(
                                  form?.sections?.map((s: Section) => s.id) ||
                                  [],
                                )
                              }
                              className="flex-1 px-2 py-1.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 rounded transition-colors"
                            >
                              Select All
                            </button>
                            <button
                              onClick={() => setSelectedResponsesSectionIds([])}
                              className="flex-1 px-2 py-1.5 text-[10px] font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                            >
                              Clear All
                            </button>
                          </div>
                        </div>

                        <div className="p-2 sm:p-4 max-h-64 sm:max-h-96 overflow-y-auto space-y-1">
                          {form?.sections && form.sections.length > 0 ? (
                            form.sections.map((section: Section) => (
                              <label
                                key={section.id}
                                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 cursor-pointer transition-colors group"
                              >
                                <div className="relative flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={selectedResponsesSectionIds.includes(
                                      section.id,
                                    )}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedResponsesSectionIds([
                                          ...selectedResponsesSectionIds,
                                          section.id,
                                        ]);
                                      } else {
                                        setSelectedResponsesSectionIds(
                                          selectedResponsesSectionIds.filter(
                                            (id) => id !== section.id,
                                          ),
                                        );
                                      }
                                    }}
                                    className="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded cursor-pointer accent-indigo-600"
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="text-xs font-medium text-gray-900 dark:text-gray-200 block truncate">
                                    {section.title}
                                  </span>
                                </div>
                              </label>
                            ))
                          ) : (
                            <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">
                              No sections available
                            </p>
                          )}

                          {isChildFollowUpForm && (
                            <div className="pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
                              <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/30 cursor-pointer transition-colors group">
                                <input
                                  type="checkbox"
                                  checked={showParentMatchColumn}
                                  onChange={(e) => {
                                    const nextVal = e.target.checked;
                                    setShowParentMatchColumn(nextVal);
                                    try {
                                      const formKey = id || form?._id || "default";
                                      localStorage.setItem(`show_parent_match_${formKey}`, String(nextVal));
                                    } catch (err) { }
                                  }}
                                  className="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded cursor-pointer accent-indigo-600"
                                />
                                <div className="flex-1 min-w-0 flex items-center gap-1.5">
                                  <Link2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                  <span className="text-xs font-bold text-gray-900 dark:text-gray-200 block truncate">
                                    Parent Match Column
                                  </span>
                                </div>
                              </label>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {selectedResponsesSectionIds.length > 0 ? (
                  <>
                    {/* Active Filters Bar */}
                    {(Object.entries(columnFilters).some(([_, v]) => v && v.length > 0) || responsesSearchTerm.trim() !== "" || appliedFilters.length > 0 || dateFilter.type !== "all") && (
                      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 mb-3 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs shadow-2xs">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1">
                            <Filter className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            Active Filters:
                          </span>
                          {dateFilter.type !== "all" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-700 shadow-2xs">
                              <Calendar className="w-3 h-3 text-amber-600" />
                              <span className="font-bold">Date:</span> {commonDateRangeLabel || (dateFilter.startDate ? `${dateFilter.startDate} to ${dateFilter.endDate}` : "Filtered")}
                              <button
                                onClick={() => {
                                  setDateFilter({ type: "all", startDate: "", endDate: "" });
                                  setAppliedFilters((prev) => prev.filter((f) => f.id !== "date"));
                                }}
                                className="hover:text-red-600 dark:hover:text-red-400 font-bold ml-1 text-xs cursor-pointer p-0.5 rounded hover:bg-red-100/60 dark:hover:bg-red-900/40 inline-flex items-center justify-center"
                                title="Remove date filter and show all time"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          )}
                          {responsesSearchTerm.trim() !== "" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 shadow-2xs">
                              Search: "{responsesSearchTerm}"
                              <button onClick={() => setResponsesSearchTerm("")} className="hover:text-red-500 ml-0.5 cursor-pointer flex items-center justify-center"><X className="w-3 h-3" /></button>
                            </span>
                          )}
                          {Object.entries(columnFilters).map(([colId, vals]) => {
                            if (!vals || vals.length === 0) return null;
                            let colLabel = colId;
                            if (colId === "__status") colLabel = "Status";
                            else if (colId === "__submittedBy") colLabel = "Submitted by";
                            else if (colId === "__chassisNumber") colLabel = "Chassis";
                            else if (colId === "__parentMatch") colLabel = "Parent Match";
                            else if (colId === "__biwReview") colLabel = "BIW Review";
                            else if (colId === "__review" || colId === "__tvsReview") colLabel = "TVS Review";
                            else if (colId === "__dispatch") colLabel = "Dispatch";
                            else if (colId === "__attemptRank") colLabel = "Attempt";
                            else {
                              const q = form?.sections?.flatMap((s: any) => s.questions || []).find((q: any) => q.id === colId);
                              if (q) colLabel = q.text || q.label || colId;
                            }

                            return (
                              <span
                                key={colId}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-700 shadow-2xs"
                              >
                                <span className="font-bold">{colLabel}:</span> {vals.slice(0, 2).join(", ")}{vals.length > 2 ? ` +${vals.length - 2}` : ""}
                                <button
                                  onClick={() => {
                                    const nextParams = new URLSearchParams(searchParams);
                                    let urlChanged = false;
                                    if (colId === "__dispatch") {
                                      if (nextParams.has("dispatch") || nextParams.has("dispatchStatus")) {
                                        nextParams.delete("dispatch");
                                        nextParams.delete("dispatchStatus");
                                        urlChanged = true;
                                      }
                                    } else if (colId === "__tvsReview" || colId === "__review") {
                                      if (nextParams.has("tvsStatus") || nextParams.has("review") || nextParams.has("tvsReview")) {
                                        nextParams.delete("tvsStatus");
                                        nextParams.delete("review");
                                        nextParams.delete("tvsReview");
                                        urlChanged = true;
                                      }
                                    } else if (colId === "__biwReview") {
                                      if (nextParams.has("biwStatus") || nextParams.has("biwReview")) {
                                        nextParams.delete("biwStatus");
                                        nextParams.delete("biwReview");
                                        urlChanged = true;
                                      }
                                    } else if (colId === "__status") {
                                      if (nextParams.has("status")) {
                                        nextParams.delete("status");
                                        urlChanged = true;
                                      }
                                    } else if (colId === "__chassisNumber") {
                                      if (nextParams.has("chassisNumber") || nextParams.has("chassis")) {
                                        nextParams.delete("chassisNumber");
                                        nextParams.delete("chassis");
                                        urlChanged = true;
                                      }
                                    } else if (colId === "__submittedBy") {
                                      if (nextParams.has("submittedBy")) {
                                        nextParams.delete("submittedBy");
                                        urlChanged = true;
                                      }
                                    }

                                    if (urlChanged) {
                                      navigate(`/forms/${id}/analytics?${nextParams.toString()}`, { replace: true });
                                    }

                                    startFilterTransition(() => {
                                      setColumnFilters((prev) => {
                                        const next = { ...prev };
                                        delete next[colId];
                                        return next;
                                      });
                                    });
                                  }}
                                  className="hover:text-red-600 dark:hover:text-red-400 font-bold ml-1 text-xs cursor-pointer p-0.5 rounded hover:bg-red-100/60 dark:hover:bg-red-900/40 inline-flex items-center justify-center"
                                  title={`Remove ${colLabel} filter`}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                        <button
                          onClick={() => {
                            const nextParams = new URLSearchParams(searchParams);
                            const keysToDelete = [
                              "dispatch",
                              "dispatchStatus",
                              "tvsStatus",
                              "review",
                              "tvsReview",
                              "biwStatus",
                              "biwReview",
                              "status",
                              "chassisNumber",
                              "chassis",
                              "submittedBy",
                              "batchId",
                              "uploadOnly",
                            ];
                            let urlChanged = false;
                            for (const k of keysToDelete) {
                              if (nextParams.has(k)) {
                                nextParams.delete(k);
                                urlChanged = true;
                              }
                            }
                            if (urlChanged) {
                              navigate(`/forms/${id}/analytics?${nextParams.toString()}`, { replace: true });
                            }
                            startFilterTransition(() => {
                              setColumnFilters({});
                              setAppliedFilters([]);
                              setDateFilter({ type: "all", startDate: "", endDate: "" });
                            });
                            setResponsesSearchTerm("");
                          }}
                          className="text-[11px] font-bold text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 underline cursor-pointer shrink-0 ml-auto"
                        >
                          Clear All Filters
                        </button>
                      </div>
                    )}

                    {/* Overall Inspection Statistics Summary Bar (Clickable Quick-Filters) */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 mb-4">
                      <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2 sm:gap-3 items-center">
                        {/* Total Submissions */}
                        <div
                          onClick={() => {
                            const nextParams = new URLSearchParams(searchParams);
                            const keysToDelete = [
                              "dispatch",
                              "dispatchStatus",
                              "tvsStatus",
                              "review",
                              "tvsReview",
                              "biwStatus",
                              "biwReview",
                              "status",
                            ];
                            let urlChanged = false;
                            for (const k of keysToDelete) {
                              if (nextParams.has(k)) {
                                nextParams.delete(k);
                                urlChanged = true;
                              }
                            }
                            if (urlChanged) {
                              navigate(`/forms/${id}/analytics?${nextParams.toString()}`, { replace: true });
                            }
                            startFilterTransition(() => {
                              setColumnFilters((prev) => {
                                const next = { ...prev };
                                delete next["__status"];
                                delete next["__dispatch"];
                                delete next["__tvsReview"];
                                delete next["__biwReview"];
                                return next;
                              });
                            });
                          }}
                          className={`flex flex-col p-2.5 bg-purple-50 dark:bg-purple-900/10 rounded-lg border border-purple-100 dark:border-purple-900/20 cursor-pointer select-none transition-all hover:scale-[1.02] hover:shadow-md active:scale-95 ${!columnFilters["__status"]?.length && !columnFilters["__dispatch"]?.length
                            ? "ring-2 ring-purple-500 shadow-sm"
                            : "opacity-80 hover:opacity-100"
                            }`}
                          title="Click to show all submissions"
                        >
                          <span className="text-[10px] text-purple-700 dark:text-purple-400 font-bold uppercase truncate" title="Total Submissions">
                            Total Submissions
                          </span>
                          <div className="flex items-baseline justify-between mt-0.5">
                            <span className="text-lg font-black text-purple-600 dark:text-purple-400">
                              {totalPieChartData.counts.total || activeTotalResponsesCount}
                            </span>
                            <BarChart3 className="w-4 h-4 text-purple-500" />
                          </div>
                        </div>

                        {/* Direct Ok / Accepted */}
                        <div
                          onClick={() => {
                            startFilterTransition(() => {
                              setColumnFilters((prev) => {
                                const curr = prev["__status"] || [];
                                const isOnlyDirectOk = curr.length === 2 && curr.includes("Direct Ok") && curr.includes("Accepted");
                                const next = { ...prev };
                                if (isOnlyDirectOk) {
                                  delete next["__status"];
                                } else {
                                  next["__status"] = ["Direct Ok", "Accepted"];
                                }
                                return next;
                              });
                            });
                          }}
                          className={`flex flex-col p-2.5 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-100 dark:border-green-900/20 cursor-pointer select-none transition-all hover:scale-[1.02] hover:shadow-md active:scale-95 ${columnFilters["__status"]?.includes("Direct Ok") || columnFilters["__status"]?.includes("Accepted")
                            ? "ring-2 ring-green-500 shadow-sm"
                            : "opacity-80 hover:opacity-100"
                            }`}
                          title="Click to filter by Accepted / Direct OK"
                        >
                          <span className="text-[10px] text-green-700 dark:text-green-400 font-bold uppercase truncate" title="Accepted / Direct OK">
                            Direct Ok
                          </span>
                          <div className="flex items-baseline justify-between mt-0.5">
                            <span className="text-lg font-black text-green-600 dark:text-green-400">
                              {inspectionStats.accepted}
                            </span>
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          </div>
                        </div>

                        {/* Rework Accepted */}
                        <div
                          onClick={() => {
                            startFilterTransition(() => {
                              setColumnFilters((prev) => {
                                const curr = prev["__status"] || [];
                                const isOnlyReworkAccepted = curr.length === 1 && curr.includes("Rework Accepted");
                                const next = { ...prev };
                                if (isOnlyReworkAccepted) {
                                  delete next["__status"];
                                } else {
                                  next["__status"] = ["Rework Accepted"];
                                }
                                return next;
                              });
                            });
                          }}
                          className={`flex flex-col p-2.5 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/20 cursor-pointer select-none transition-all hover:scale-[1.02] hover:shadow-md active:scale-95 ${columnFilters["__status"]?.includes("Rework Accepted")
                            ? "ring-2 ring-blue-500 shadow-sm"
                            : "opacity-80 hover:opacity-100"
                            }`}
                          title="Click to filter by Rework Accepted"
                        >
                          <span className="text-[10px] text-blue-700 dark:text-blue-400 font-bold uppercase truncate" title="Rework Accepted">
                            Rework Accepted
                          </span>
                          <div className="flex items-baseline justify-between mt-0.5">
                            <span className="text-lg font-black text-blue-600 dark:text-blue-400">
                              {inspectionStats.reworkCompleted}
                            </span>
                            <CheckCircle className="w-4 h-4 text-blue-500" />
                          </div>
                        </div>

                        {/* Ongoing Rework */}
                        <div
                          onClick={() => {
                            startFilterTransition(() => {
                              setColumnFilters((prev) => {
                                const curr = prev["__status"] || [];
                                const isOngoingRework = curr.includes("Ongoing Rework") || curr.includes("Rework");
                                const next = { ...prev };
                                if (isOngoingRework) {
                                  delete next["__status"];
                                } else {
                                  next["__status"] = ["Ongoing Rework", "Rework", "Rework 1", "Rework 2"];
                                }
                                return next;
                              });
                            });
                          }}
                          className={`flex flex-col p-2.5 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-100 dark:border-amber-900/20 cursor-pointer select-none transition-all hover:scale-[1.02] hover:shadow-md active:scale-95 ${columnFilters["__status"]?.some(s => s.toLowerCase().includes("rework") && s !== "Rework Accepted")
                            ? "ring-2 ring-amber-500 shadow-sm"
                            : "opacity-80 hover:opacity-100"
                            }`}
                          title="Click to filter by Ongoing Rework"
                        >
                          <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase truncate" title="Ongoing Rework">
                            {complianceLabels.na || "Rework"}
                          </span>
                          <div className="flex items-baseline justify-between mt-0.5">
                            <span className="text-lg font-black text-amber-500 dark:text-amber-400">
                              {inspectionStats.reworked}
                            </span>
                            <RotateCcw className="w-4 h-4 text-amber-500" />
                          </div>
                        </div>

                        {/* Rejected */}
                        <div
                          onClick={() => {
                            startFilterTransition(() => {
                              setColumnFilters((prev) => {
                                const curr = prev["__status"] || [];
                                const isRejected = curr.length === 1 && curr.includes("Rejected");
                                const next = { ...prev };
                                if (isRejected) {
                                  delete next["__status"];
                                } else {
                                  next["__status"] = ["Rejected"];
                                }
                                return next;
                              });
                            });
                          }}
                          className={`flex flex-col p-2.5 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/20 cursor-pointer select-none transition-all hover:scale-[1.02] hover:shadow-md active:scale-95 ${columnFilters["__status"]?.includes("Rejected")
                            ? "ring-2 ring-red-500 shadow-sm"
                            : "opacity-80 hover:opacity-100"
                            }`}
                          title="Click to filter by Rejected"
                        >
                          <span className="text-[10px] text-red-700 dark:text-red-400 font-bold uppercase truncate" title="Rejected">
                            {complianceLabels.no || "Rejected"}
                          </span>
                          <div className="flex items-baseline justify-between mt-0.5">
                            <span className="text-lg font-black text-red-600 dark:text-red-400">
                              {inspectionStats.rejected}
                            </span>
                            <XCircle className="w-4 h-4 text-red-500" />
                          </div>
                        </div>

                        {/* Dispatched */}
                        <div
                          onClick={() => {
                            const nextParams = new URLSearchParams(searchParams);
                            const isDispatched = columnFilters["__dispatch"]?.includes("Dispatched / Enabled");
                            if (isDispatched) {
                              nextParams.delete("dispatch");
                              nextParams.delete("dispatchStatus");
                            } else {
                              nextParams.set("dispatch", "dispatched");
                            }
                            navigate(`/forms/${id}/analytics?${nextParams.toString()}`, { replace: true });
                            startFilterTransition(() => {
                              setColumnFilters((prev) => {
                                const next = { ...prev };
                                if (isDispatched) {
                                  delete next["__dispatch"];
                                } else {
                                  next["__dispatch"] = ["Dispatched / Enabled"];
                                }
                                return next;
                              });
                            });
                          }}
                          className={`flex flex-col p-2.5 bg-indigo-50 dark:bg-indigo-900/10 rounded-lg border border-indigo-100 dark:border-indigo-900/20 cursor-pointer select-none transition-all hover:scale-[1.02] hover:shadow-md active:scale-95 ${columnFilters["__dispatch"]?.includes("Dispatched / Enabled")
                            ? "ring-2 ring-indigo-500 shadow-sm"
                            : "opacity-80 hover:opacity-100"
                            }`}
                          title="Click to filter by Dispatched"
                        >
                          <span className="text-[10px] text-indigo-700 dark:text-indigo-400 font-bold uppercase truncate" title="Dispatched">
                            Dispatched
                          </span>
                          <div className="flex items-baseline justify-between mt-0.5">
                            <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                              {inspectionStats.dispatched}
                            </span>
                            <Send className="w-4 h-4 text-indigo-500" />
                          </div>
                        </div>

                        {/* Pending Dispatch */}
                        <div
                          onClick={() => {
                            const nextParams = new URLSearchParams(searchParams);
                            const isPending = columnFilters["__dispatch"]?.includes("Pending Dispatch");
                            if (isPending) {
                              nextParams.delete("dispatch");
                              nextParams.delete("dispatchStatus");
                            } else {
                              nextParams.set("dispatch", "pending");
                            }
                            navigate(`/forms/${id}/analytics?${nextParams.toString()}`, { replace: true });
                            startFilterTransition(() => {
                              setColumnFilters((prev) => {
                                const next = { ...prev };
                                if (isPending) {
                                  delete next["__dispatch"];
                                } else {
                                  next["__dispatch"] = ["Pending Dispatch"];
                                }
                                return next;
                              });
                            });
                          }}
                          className={`flex flex-col p-2.5 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-100 dark:border-amber-900/20 cursor-pointer select-none transition-all hover:scale-[1.02] hover:shadow-md active:scale-95 ${columnFilters["__dispatch"]?.includes("Pending Dispatch")
                            ? "ring-2 ring-amber-500 shadow-sm"
                            : "opacity-80 hover:opacity-100"
                            }`}
                          title="Click to filter by Pending Dispatch"
                        >
                          <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase truncate" title="Pending Dispatch">
                            Pending Dispatch
                          </span>
                          <div className="flex items-baseline justify-between mt-0.5">
                            <span className="text-lg font-black text-amber-600 dark:text-amber-400">
                              {/* When dispatch=pending is in URL and stats source is tableResponses (pre-streaming),
                                  use the server-provided totalResponsesCount for the pending dispatch count */}
                              {(urlDispatch?.toLowerCase().includes("pending") && responses.length === 0 && totalResponsesCount > 0)
                                ? totalResponsesCount
                                : (inspectionStats.pendingDispatch ?? Math.max(0, (inspectionStats.accepted + inspectionStats.reworkCompleted) - inspectionStats.dispatched))}
                            </span>
                            <Clock className="w-4 h-4 text-amber-500" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className={`overflow-auto no-scrollbar rounded-xl border border-gray-200 dark:border-gray-700 max-h-[90vh] transition-opacity duration-150 ${isFilterPending ? "opacity-60 pointer-events-none" : "opacity-100"}`}>
                      <table className="text-xs border-collapse w-full">
                        <thead className="sticky top-0 z-30">
                          <tr className="bg-gray-100 dark:bg-gray-800">
                            <th className="hidden sm:table-cell sticky left-0 z-30 text-center px-3 py-3 font-semibold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
                              <input
                                type="checkbox"
                                checked={
                                  selectedResponseIds.length > 0 &&
                                  selectedResponseIds.length ===
                                  tableResponses.length
                                }
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedResponseIds(
                                      tableResponses.map((r) => r.id),
                                    );
                                  } else {
                                    setSelectedResponseIds([]);
                                  }
                                }}
                                className="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded cursor-pointer accent-indigo-600"
                              />
                            </th>
                            <th className="sticky left-0 sm:left-12 z-30 text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border border-gray-200 dark:border-gray-700 border-r border-r-gray-300 dark:border-r-gray-600 shadow-[inset_-1px_0_0_#d1d5db] dark:shadow-[inset_-1px_0_0_#4b5563] whitespace-nowrap bg-gray-100 dark:bg-gray-800 min-w-[120px]">
                              <span>Actions</span>
                            </th>
                            <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border border-gray-200 dark:border-gray-700 border-l border-l-gray-300 dark:border-l-gray-600 whitespace-nowrap bg-gray-50 dark:bg-gray-800 min-w-[150px]">
                              <div className="flex items-center justify-between gap-1.5">
                                <div
                                  onClick={() => {
                                    startFilterTransition(() => {
                                      setTableSort((prev) =>
                                        prev?.columnId === "__tvsReview"
                                          ? prev.direction === "asc"
                                            ? { columnId: "__tvsReview", direction: "desc" }
                                            : null
                                          : { columnId: "__tvsReview", direction: "asc" }
                                      );
                                    });
                                  }}
                                  className="flex items-center gap-1.5 cursor-pointer select-none hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                  title="Click to sort TVS Review Ascending / Descending"
                                >
                                  <span>TVS Review</span>
                                  {tableSort?.columnId === "__tvsReview" ? (
                                    tableSort.direction === "asc" ? (
                                      <ArrowUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                    ) : (
                                      <ArrowDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                    )
                                  ) : (
                                    <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 shrink-0 opacity-40 hover:opacity-100" />
                                  )}
                                </div>
                                <TableColumnFilter
                                  columnId="__tvsReview"
                                  title="TVS Review"
                                  options={tvsReviewFilterOptions}
                                  selectedValues={columnFilters["__tvsReview"] || null}
                                  onFilterChange={(columnId, values) => {
                                    startFilterTransition(() => {
                                      setColumnFilters((prev) => ({
                                        ...prev,
                                        [columnId]: values,
                                      }));
                                    });
                                  }}
                                />
                              </div>
                            </th>
                            <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border border-gray-200 dark:border-gray-700 whitespace-nowrap bg-gray-50 dark:bg-gray-800">
                              <div className="flex flex-col items-center gap-1.5 justify-center">
                                <div className="flex items-center gap-1">
                                  <span>Dispatch</span>
                                  <TableColumnFilter
                                    columnId="__dispatch"
                                    title="Dispatch Status"
                                    options={dispatchFilterOptions}
                                    selectedValues={columnFilters["__dispatch"] || null}
                                    onFilterChange={(columnId, values) => {
                                      startFilterTransition(() => {
                                        setColumnFilters((prev) => ({
                                          ...prev,
                                          [columnId]: values,
                                        }));
                                      });
                                    }}
                                  />
                                </div>
                                {canBulkDispatchResponses && (
                                  <label className="flex items-center gap-1.5 cursor-pointer font-normal text-[10px] text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 normal-case">
                                    <input
                                      type="checkbox"
                                      checked={isAllDispatchableSelected}
                                      disabled={dispatchableResponses.length === 0 || pendingDispatchResponses.length === 0 || isBulkDispatching}
                                      onChange={handleHeaderDispatchChange}
                                      className="w-3.5 h-3.5 text-green-600 border-gray-300 dark:border-gray-600 rounded cursor-pointer accent-green-600"
                                    />
                                    <span>Select All</span>
                                  </label>
                                )}
                                {selectedDispatchIds.length > 0 && (
                                  <button
                                    onClick={() => setShowBulkDispatchConfirm(true)}
                                    className="mt-1 bg-green-600 hover:bg-green-700 text-white text-[10px] px-2 py-0.5 rounded shadow transition-colors"
                                    title={`Dispatch ${selectedDispatchIds.length} selected items`}
                                  >
                                    Proceed ({selectedDispatchIds.length})
                                  </button>
                                )}
                              </div>
                            </th>
                            <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border border-gray-200 dark:border-gray-700 min-w-48 whitespace-nowrap bg-gray-50 dark:bg-gray-800">
                              <div className="flex items-center justify-between gap-1.5">
                                <div
                                  onClick={() => {
                                    startFilterTransition(() => {
                                      setTableSort((prev) =>
                                        prev?.columnId === "__submittedBy"
                                          ? prev.direction === "asc"
                                            ? { columnId: "__submittedBy", direction: "desc" }
                                            : null
                                          : { columnId: "__submittedBy", direction: "asc" }
                                      );
                                    });
                                  }}
                                  className="flex items-center gap-1.5 cursor-pointer select-none hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                  title="Click to sort by Submitter"
                                >
                                  <span>Submitted by</span>
                                  {tableSort?.columnId === "__submittedBy" ? (
                                    tableSort.direction === "asc" ? (
                                      <ArrowUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                    ) : (
                                      <ArrowDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                    )
                                  ) : (
                                    <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 shrink-0 opacity-40 hover:opacity-100" />
                                  )}
                                </div>
                                <TableColumnFilter
                                  columnId="__submittedBy"
                                  title="Submitted by"
                                  options={submittedByFilterOptions}
                                  selectedValues={columnFilters["__submittedBy"] || null}
                                  onFilterChange={(columnId, values) => {
                                    startFilterTransition(() => {
                                      setColumnFilters((prev) => ({
                                        ...prev,
                                        [columnId]: values,
                                      }));
                                    });
                                  }}
                                />
                              </div>
                            </th>
                            <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border border-gray-200 dark:border-gray-700 min-w-36 whitespace-nowrap bg-gray-50 dark:bg-gray-800">
                              <div className="flex items-center justify-between gap-1.5">
                                <div
                                  onClick={() => {
                                    startFilterTransition(() => {
                                      setTableSort((prev) =>
                                        prev?.columnId === "__status"
                                          ? prev.direction === "asc"
                                            ? { columnId: "__status", direction: "desc" }
                                            : null
                                          : { columnId: "__status", direction: "asc" }
                                      );
                                    });
                                  }}
                                  className="flex items-center gap-1.5 cursor-pointer select-none hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                  title="Click to sort by Status"
                                >
                                  <span>Status</span>
                                  {tableSort?.columnId === "__status" ? (
                                    tableSort.direction === "asc" ? (
                                      <ArrowUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                    ) : (
                                      <ArrowDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                    )
                                  ) : (
                                    <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 shrink-0 opacity-40 hover:opacity-100" />
                                  )}
                                </div>
                                <TableColumnFilter
                                  columnId="__status"
                                  title="Status"
                                  options={statusFilterOptions}
                                  selectedValues={columnFilters["__status"] || null}
                                  onFilterChange={(columnId, values) => {
                                    startFilterTransition(() => {
                                      setColumnFilters((prev) => ({
                                        ...prev,
                                        [columnId]: values,
                                      }));
                                    });
                                  }}
                                />
                              </div>
                            </th>
                            <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border border-gray-200 dark:border-gray-700 min-w-44 whitespace-nowrap bg-gray-50 dark:bg-gray-800">
                              <div className="flex items-center justify-between gap-1.5">
                                <div
                                  onClick={() => {
                                    startFilterTransition(() => {
                                      setTableSort((prev) =>
                                        prev?.columnId === "__chassisNumber"
                                          ? prev.direction === "asc"
                                            ? { columnId: "__chassisNumber", direction: "desc" }
                                            : null
                                          : { columnId: "__chassisNumber", direction: "asc" }
                                      );
                                    });
                                  }}
                                  className="flex items-center gap-1.5 cursor-pointer select-none hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                  title="Click to sort Chassis Ascending / Descending"
                                >
                                  <span>System Chassis</span>
                                  {tableSort?.columnId === "__chassisNumber" ? (
                                    tableSort.direction === "asc" ? (
                                      <ArrowUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                    ) : (
                                      <ArrowDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                    )
                                  ) : (
                                    <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 shrink-0 opacity-40 hover:opacity-100" />
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  {canBulkSelectResponses && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAutoFillAllChassis();
                                      }}
                                      disabled={isAutoFillingChassis || !chassisMasterOptions.length}
                                      title="Auto-fill every response with no chassis number using the first option"
                                      className="p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed normal-case tracking-normal"
                                    >
                                      {isAutoFillingChassis ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <CheckCircle className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  )}
                                  <TableColumnFilter
                                    columnId="__chassisNumber"
                                    title="System Chassis"
                                    options={chassisFilterOptions}
                                    selectedValues={columnFilters["__chassisNumber"] || null}
                                    onFilterChange={(columnId, values) => {
                                      startFilterTransition(() => {
                                        setColumnFilters((prev) => ({
                                          ...prev,
                                          [columnId]: values,
                                        }));
                                      });
                                    }}
                                  />
                                </div>
                              </div>
                            </th>
                            {isChildFollowUpForm && showParentMatchColumn && (
                              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border border-gray-200 dark:border-gray-700 min-w-44 whitespace-nowrap bg-indigo-50/60 dark:bg-indigo-950/20">
                                <div className="flex items-center justify-between gap-1.5">
                                  <div
                                    onClick={() => {
                                      startFilterTransition(() => {
                                        setTableSort((prev) =>
                                          prev?.columnId === "__parentMatch"
                                            ? prev.direction === "asc"
                                              ? { columnId: "__parentMatch", direction: "desc" }
                                              : null
                                            : { columnId: "__parentMatch", direction: "asc" }
                                        );
                                      });
                                    }}
                                    className="flex items-center gap-1.5 cursor-pointer select-none hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                    title="Click to sort by Parent Match status"
                                  >
                                    <Link2 className="w-3.5 h-3.5 text-indigo-500" />
                                    <span>Parent Match</span>
                                    {tableSort?.columnId === "__parentMatch" ? (
                                      tableSort.direction === "asc" ? (
                                        <ArrowUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                      ) : (
                                        <ArrowDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                      )
                                    ) : (
                                      <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 shrink-0 opacity-40 hover:opacity-100" />
                                    )}
                                  </div>
                                  <TableColumnFilter
                                    columnId="__parentMatch"
                                    title="Parent Match"
                                    options={parentMatchFilterOptions}
                                    selectedValues={columnFilters["__parentMatch"] || null}
                                    onFilterChange={(columnId, values) => {
                                      startFilterTransition(() => {
                                        setColumnFilters((prev) => ({
                                          ...prev,
                                          [columnId]: values,
                                        }));
                                      });
                                    }}
                                  />
                                </div>
                              </th>
                            )}
                            <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border border-gray-200 dark:border-gray-700 min-w-44 whitespace-nowrap bg-purple-50 dark:bg-purple-900/20">
                              <div className="flex flex-col items-center gap-1.5 justify-center">
                                <div className="flex items-center gap-1">
                                  <span>BIW Review</span>
                                  <TableColumnFilter
                                    columnId="__biwReview"
                                    title="BIW Review"
                                    options={biwReviewFilterOptions}
                                    selectedValues={columnFilters["__biwReview"] || null}
                                    onFilterChange={(columnId, values) => {
                                      startFilterTransition(() => {
                                        setColumnFilters((prev) => ({
                                          ...prev,
                                          [columnId]: values,
                                        }));
                                      });
                                    }}
                                  />
                                </div>
                                {canBulkSelectResponses && (() => {
                                  const eligibleBiwResponses = tableResponses.filter(r => isBiwEligibleResponse(r));
                                  const eligibleBiwIds = eligibleBiwResponses.map(r => r.id);
                                  const isAllEligibleSelected = eligibleBiwIds.length > 0 && eligibleBiwIds.every(id => selectedBiwIds.includes(id));

                                  return (
                                    <label className="flex items-center gap-1.5 cursor-pointer font-normal text-[10px] text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 normal-case">
                                      <input
                                        type="checkbox"
                                        checked={isAllEligibleSelected}
                                        disabled={eligibleBiwIds.length === 0 || isBulkBiwUpdating}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          console.log('[BIW] Header select all clicked:', e.target.checked);

                                          if (e.target.checked) {
                                            console.log('[BIW] Selecting all eligible:', eligibleBiwIds.length, 'items');
                                            setSelectedBiwIds(prev => Array.from(new Set([...prev, ...eligibleBiwIds])));
                                          } else {
                                            console.log('[BIW] Clearing all eligible selections');
                                            setSelectedBiwIds(prev => prev.filter(id => !eligibleBiwIds.includes(id)));
                                          }
                                        }}
                                        className="w-3.5 h-3.5 text-purple-600 border-gray-300 dark:border-gray-600 rounded cursor-pointer accent-purple-600 disabled:opacity-40 disabled:cursor-not-allowed"
                                      />
                                      <span>Select All</span>
                                      {selectedBiwIds.length > 0 && (
                                        <span className="text-[9px] font-bold text-purple-600 bg-purple-100 dark:bg-purple-900/30 px-1.5 py-0.5 rounded ml-1">
                                          {selectedBiwIds.length}
                                        </span>
                                      )}
                                    </label>
                                  );
                                })()}

                                {/* BIW Review Filter dropdown */}
                                <select
                                  value={columnFilters["__biwReview"]?.[0] || "all"}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    startFilterTransition(() => {
                                      setColumnFilters((prev) => {
                                        const next = { ...prev };
                                        if (!val || val === "all") {
                                          delete next["__biwReview"];
                                        } else {
                                          next["__biwReview"] = [val];
                                        }
                                        return next;
                                      });
                                    });
                                    if (!val || val === "all") {
                                      showToast("Showing all BIW reviews", "info");
                                    } else {
                                      showToast(`Filtered by BIW: ${val}`, "info");
                                    }
                                  }}
                                  disabled={tableResponses.length === 0}
                                  className="px-2 py-1 text-[11px] font-semibold border border-purple-200 dark:border-purple-700 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none normal-case tracking-normal cursor-pointer shadow-sm hover:border-purple-400 transition-colors w-full"
                                >
                                  <option value="all">All Reviews</option>
                                  <option value="Accepted">Accepted</option>
                                  <option value="Reworked">Reworked</option>
                                  <option value="Rejected">Rejected</option>
                                  <option value="No review yet">Unreviewed</option>
                                </select>
                              </div>
                            </th>
                            <th className="text-left px-6 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border border-gray-200 dark:border-gray-700 min-w-40 whitespace-nowrap">
                              <div
                                onClick={() => {
                                  startFilterTransition(() => {
                                    setTableSort((prev) =>
                                      prev?.columnId === "__timestamp"
                                        ? prev.direction === "asc"
                                          ? { columnId: "__timestamp", direction: "desc" }
                                          : null
                                        : { columnId: "__timestamp", direction: "asc" }
                                    );
                                  });
                                }}
                                className="flex items-center justify-between gap-2 cursor-pointer select-none hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                title="Click to sort by Timestamp"
                              >
                                <span>Timestamp</span>
                                {tableSort?.columnId === "__timestamp" ? (
                                  tableSort.direction === "asc" ? (
                                    <ArrowUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                  ) : (
                                    <ArrowDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                  )
                                ) : (
                                  <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 opacity-40 hover:opacity-100" />
                                )}
                              </div>
                            </th>

                            <th className="text-center px-4 py-3 font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider border border-gray-200 dark:border-gray-700 whitespace-nowrap bg-gray-50 dark:bg-gray-800">
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  onClick={() => {
                                    startFilterTransition(() => {
                                      setTableSort((prev) =>
                                        prev?.columnId === "__timeSpent"
                                          ? prev.direction === "asc"
                                            ? { columnId: "__timeSpent", direction: "desc" }
                                            : null
                                          : { columnId: "__timeSpent", direction: "asc" }
                                      );
                                    });
                                  }}
                                  className="flex-1 text-center cursor-pointer select-none hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center justify-center gap-1"
                                  title="Click to sort by Time Taken"
                                >
                                  <span>Time Taken</span>
                                  {tableSort?.columnId === "__timeSpent" && (
                                    <span className="text-indigo-600 dark:text-indigo-400">
                                      {tableSort.direction === "asc" ? (
                                        <ArrowUp className="w-3.5 h-3.5" />
                                      ) : (
                                        <ArrowDown className="w-3.5 h-3.5" />
                                      )}
                                    </span>
                                  )}
                                </span>
                                <TableColumnFilter
                                  columnId="__attemptRank"
                                  title="Attempt & Status"
                                  options={attemptRankFilterOptions}
                                  selectedValues={
                                    columnFilters["__attemptRank"] || null
                                  }
                                  onFilterChange={(columnId, values) => {
                                    startFilterTransition(() => {
                                      setColumnFilters((prev) => ({
                                        ...prev,
                                        [columnId]: values,
                                      }));
                                    });
                                  }}
                                />
                              </div>
                            </th>
                            {form?.sections?.map(
                              (section: Section) =>
                                selectedResponsesSectionIds.includes(
                                  section.id,
                                ) &&
                                section.questions?.map((q: any) => {
                                  const isFollowUp =
                                    q.parentId || q.showWhen?.questionId;
                                  const columnOptions = uniqueColumnValues.get(q.id) || [];
                                  const isChassisQ =
                                    q.id === chassisQuestionId ||
                                    q.type === "chassis" ||
                                    q.type === "chassisWithZone" ||
                                    q.type === "chassisWithoutZone" ||
                                    q.type === "zone-in" ||
                                    q.type === "zone-out" ||
                                    q.text?.toLowerCase().includes("chassis");

                                  return (
                                    <th
                                      key={q.id}
                                      className={`text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider border border-gray-200 dark:border-gray-700 max-w-xs ${isFollowUp ? "bg-purple-100 dark:bg-purple-900/30" : "bg-gray-100 dark:bg-gray-800"}`}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div
                                          onClick={() => {
                                            const sortKey = isChassisQ ? "__chassisNumber" : q.id;
                                            startFilterTransition(() => {
                                              setTableSort((prev) =>
                                                prev?.columnId === sortKey || prev?.columnId === q.id
                                                  ? prev.direction === "asc"
                                                    ? { columnId: sortKey, direction: "desc" }
                                                    : null
                                                  : { columnId: sortKey, direction: "asc" }
                                              );
                                            });
                                          }}
                                          className="line-clamp-2 overflow-hidden text-ellipsis flex-1 cursor-pointer select-none hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1"
                                          title={`Click to sort by ${q.text || "Question"}`}
                                        >
                                          <span>{q.text || "Question"}</span>
                                          {(tableSort?.columnId === q.id || (isChassisQ && tableSort?.columnId === "__chassisNumber")) && (
                                            <span className="text-indigo-600 dark:text-indigo-400 shrink-0">
                                              {tableSort.direction === "asc" ? (
                                                <ArrowUp className="w-3.5 h-3.5" />
                                              ) : (
                                                <ArrowDown className="w-3.5 h-3.5" />
                                              )}
                                            </span>
                                          )}
                                        </div>
                                        <TableColumnFilter
                                          columnId={q.id}
                                          title={q.text || "Question"}
                                          options={columnOptions}
                                          selectedValues={
                                            columnFilters[q.id] || null
                                          }
                                          onFilterChange={(
                                            columnId,
                                            values,
                                          ) => {
                                            startFilterTransition(() => {
                                              setColumnFilters((prev) => ({
                                                ...prev,
                                                [columnId]: values,
                                              }));
                                            });
                                          }}
                                        />
                                      </div>
                                    </th>
                                  );
                                }),
                            )}
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {displayedTableResponses.length > 0 ? (
                            displayedTableResponses.map(
                              (response: Response, idx: number) => (
                                <tr
                                  key={response.id}
                                  className={`${editingResponseId === response.id ? "bg-blue-50 dark:bg-blue-900/20" : idx % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800"}`}
                                >
                                  <td
                                    className={`hidden sm:table-cell  px-3 py-3 text-center border border-gray-200 dark:border-gray-700 whitespace-nowrap sticky left-0 z-20 ${editingResponseId === response.id ? "bg-blue-50 dark:bg-blue-900/20" : idx % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800"}`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedResponseIds.includes(
                                        response.id,
                                      )}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedResponseIds([
                                            ...selectedResponseIds,
                                            response.id,
                                          ]);
                                        } else {
                                          setSelectedResponseIds(
                                            selectedResponseIds.filter(
                                              (id) => id !== response.id,
                                            ),
                                          );
                                        }
                                      }}
                                      className="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded cursor-pointer accent-indigo-600"
                                    />
                                  </td>
                                  <td
                                    className={`px-4 py-3 text-center border border-gray-200 dark:border-gray-700 border-r border-r-gray-300 dark:border-r-gray-600 shadow-[inset_-1px_0_0_#d1d5db] dark:shadow-[inset_-1px_0_0_#4b5563] whitespace-nowrap sticky left-0 sm:left-12 z-20 transition-all duration-300 ${editingResponseId === response.id ? "bg-blue-50 dark:bg-blue-900/20" : idx % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800"}`}
                                  >
                                    <div className="flex items-center gap-1.5 justify-center">
                                      {editingResponseId === response.id ? (
                                        <>
                                          <button
                                            onClick={handleSaveEdit}
                                            disabled={isSaving}
                                            title="Save Response"
                                            className="p-1 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors disabled:opacity-50"
                                          >
                                            <CheckCircle className="w-4 h-4" />
                                          </button>
                                          <button
                                            onClick={handleCancelEdit}
                                            disabled={isSaving}
                                            title="Cancel"
                                            className="p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
                                          >
                                            <XCircle className="w-4 h-4" />
                                          </button>
                                        </>
                                      ) : (
                                        <>
                                          {/* Focus It */}
                                          <button
                                            onClick={() =>
                                              handleOpenModal(response)
                                            }
                                            className="p-1.5 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                                            title="Focus It"
                                          >
                                            <Maximize className="w-4 h-4" />
                                          </button>

                                          {(() => {
                                            const responseTenantId =
                                              response.tenantId;
                                            const currentUserTenantId =
                                              user?.tenantId;
                                            const isActualOwnTenant =
                                              user?.role === "superadmin" ||
                                              !responseTenantId ||
                                              (currentUserTenantId &&
                                                responseTenantId.toString() ===
                                                currentUserTenantId.toString());
                                            const isOwnTenant =
                                              isActualOwnTenant;

                                            return (
                                              <>
                                                {/* View Details */}
                                                {isOwnTenant && (
                                                  <button
                                                    onClick={() =>
                                                      handleViewDetails(
                                                        response,
                                                      )
                                                    }
                                                    className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all"
                                                    title="View Full Details"
                                                  >
                                                    <Eye className="w-4 h-4" />
                                                  </button>
                                                )}

                                                {/* Review & Discussion - Only after dispatch */}
                                                {Boolean(response.isDispatched) && (
                                                  <button
                                                    onClick={() => {
                                                      setChatResponse(response);
                                                      setShowChatModal(true);
                                                      setSelectedReviewOptions(
                                                        (prev) => ({
                                                          ...prev,
                                                          [response.id]: "",
                                                        }),
                                                      );
                                                      setReviewedBy((prev) => ({
                                                        ...prev,
                                                        [response.id]: null,
                                                      }));
                                                    }}
                                                    className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                                                    title="Review & Discussion"
                                                  >
                                                    <MessageCircle className="w-4 h-4" />
                                                  </button>
                                                )}

                                                {/* Edit & Delete - Admin only */}
                                                {!isGuest &&
                                                  (user?.role ===
                                                    "superadmin" ||
                                                    user?.role === "admin") &&
                                                  isActualOwnTenant && (
                                                    <>
                                                      <button
                                                        onClick={() =>
                                                          handleEditResponse(
                                                            response,
                                                          )
                                                        }
                                                        className="p-1.5 text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-all"
                                                        title="Edit Response"
                                                      >
                                                        <Edit className="w-4 h-4" />
                                                      </button>
                                                      <button
                                                        onClick={() => {
                                                          setDeletingResponseId(
                                                            response.id,
                                                          );
                                                          setShowDeleteConfirm(
                                                            true,
                                                          );
                                                        }}
                                                        className="p-1.5 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                                        title="Delete Response"
                                                      >
                                                        <Trash2 className="w-4 h-4" />
                                                      </button>
                                                    </>
                                                  )}
                                              </>
                                            );
                                          })()}
                                        </>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2.5 text-center border border-gray-200 dark:border-gray-700 border-l border-l-gray-300 dark:border-l-gray-600 min-w-[170px] max-w-[280px]">
                                    {(() => {
                                      const serverRev = (response as any).review;
                                      const localRev = reviewedBy[response.id];
                                      const tvsRev = tvsReviews.find((r) => String(r.responseId || r.response_id || "") === String(response.id));
                                      const parentRev = (response as any).parentReview || (response as any).followUpStatus?.parentReview;
                                      const childRev = (response as any).childReview || (response as any).followUpStatus?.childReview;

                                      const extractReviewData = (rev: any, fallbackReviewer?: any) => {
                                        if (!rev) return null;
                                        const status = rev.status || rev.reviewOption || rev.option || null;
                                        const reviewer = (typeof rev.reviewer === "object"
                                          ? rev.reviewer?.name || rev.reviewer?.email
                                          : rev.reviewerName || rev.reviewer) || (typeof fallbackReviewer === "object" ? fallbackReviewer?.name : fallbackReviewer) || null;
                                        const reviewDate = rev.reviewedAt || rev.createdAt || null;
                                        const remark = rev.remark || rev.reason || rev.message || null;
                                        const rawFlagged = (rev.flaggedQuestions && rev.flaggedQuestions.length > 0)
                                          ? rev.flaggedQuestions
                                          : (Array.isArray(rev.questionContexts) ? rev.questionContexts : []);
                                        const flaggedCategories: string[] = rawFlagged
                                          .map((q: any) => typeof q === "string" ? q : q?.questionText || q?.title || q?.text || q?.questionId || "")
                                          .filter(Boolean);

                                        if (!status && !remark && flaggedCategories.length === 0) return null;
                                        return { status, reviewer, reviewDate, remark, flaggedCategories };
                                      };

                                      const selfRevData = extractReviewData(serverRev || localRev || tvsRev, reviewedBy[response.id]);
                                      const parentRevData = extractReviewData(parentRev);
                                      const childRevData = extractReviewData(childRev);

                                      // Main Form Review (1st) vs Target/Child Form Review (2nd)
                                      const mainRevData = isChildFollowUpForm ? parentRevData : selfRevData;
                                      const mainTitle = isChildFollowUpForm
                                        ? ((response as any).parentFormTitle || (response as any).followUpStatus?.parentFormTitle || relatedFormData?.parentForm?.title || "1st: Main Form")
                                        : (form?.title || "1st: Main Form");

                                      const childRevDataFinal = isChildFollowUpForm ? selfRevData : childRevData;
                                      const childTitle = isChildFollowUpForm
                                        ? (form?.title || "2nd: Child Form")
                                        : ((response as any).childFormTitle || (response as any).followUpStatus?.childFormTitle || relatedFormData?.childForms?.[0]?.title || "2nd: Child Form");

                                      // If neither review exists
                                      if (!mainRevData && !childRevDataFinal) {
                                        // 🔒 Rework units do not receive TVS review: render '-'
                                        if (!isReviewEligibleResponse(response)) {
                                          return (
                                            <div className="flex items-center justify-center text-center">
                                              <span className="text-gray-400 text-xs font-medium" title="Under rework: not eligible for review">-</span>
                                            </div>
                                          );
                                        }
                                        if (!response.isDispatched) {
                                          return (
                                            <div
                                              className="inline-flex items-center justify-center gap-1 px-2 py-1 text-amber-600/80 dark:text-amber-400/80 bg-amber-50/60 dark:bg-amber-950/20 rounded-lg text-xs italic select-none border border-amber-200/50 dark:border-amber-900/30"
                                              title="Review is locked until chassis is dispatched by the owning plant"
                                            >
                                              <Lock className="w-3 h-3 text-amber-500/80" />
                                              <span>Pending Dispatch</span>
                                            </div>
                                          );
                                        }
                                        return (
                                          <div
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setChatResponse(response);
                                              setShowChatModal(true);
                                            }}
                                            className="inline-flex items-center justify-center gap-1.5 px-2 py-1 text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30 rounded-lg cursor-pointer transition-colors text-xs italic select-none"
                                            title="Click to open chassis discussion & review"
                                          >
                                            <MessageCircle className="w-3.5 h-3.5 text-gray-400" />
                                            <span>No review yet</span>
                                          </div>
                                        );
                                      }

                                      const renderReviewBadge = (revData: any, titlePrefix: string) => {
                                        const normStatus = String(revData.status || "").toLowerCase().trim();
                                        const isAccepted = normStatus === "accepted";
                                        const isRejected = normStatus === "rejected";
                                        const isRework = normStatus.includes("rework");

                                        const badgeClass = isAccepted
                                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-300 dark:border-green-800"
                                          : isRejected
                                            ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-300 dark:border-red-800"
                                            : isRework
                                              ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-300 dark:border-purple-800"
                                              : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-300 dark:border-blue-800";

                                        const emoji = isAccepted ? "✅" : isRejected ? "❌" : isRework ? "🔄" : "💬";
                                        const label = isAccepted ? "Accepted" : isRejected ? "Rejected" : isRework ? "Rework" : revData.status;

                                        return (
                                          <div
                                            key={titlePrefix}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setChatResponse(response);
                                              setShowChatModal(true);
                                            }}
                                            className="p-1.5 rounded-lg border border-indigo-100 dark:border-gray-700 bg-white/95 dark:bg-gray-800/95 shadow-2xs hover:border-indigo-400 dark:hover:border-indigo-500 cursor-pointer text-left transition-all w-full mb-1.5 last:mb-0 group"
                                            title="Click to open chassis discussion & review"
                                          >
                                            <div className="flex items-center justify-between gap-1 mb-1">
                                              <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 truncate max-w-[130px]" title={titlePrefix}>
                                                {titlePrefix}
                                              </span>
                                              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold uppercase border shadow-2xs ${badgeClass}`}>
                                                <span>{emoji}</span>
                                                <span>{label}</span>
                                              </span>
                                            </div>
                                            {revData.reviewer && (
                                              <p className="text-[9px] text-gray-500 dark:text-gray-400 truncate">
                                                by <span className="font-semibold text-gray-700 dark:text-gray-300">{revData.reviewer}</span>
                                              </p>
                                            )}
                                            {revData.remark && (
                                              <p className="text-[10px] text-gray-800 dark:text-gray-200 italic line-clamp-2 leading-tight break-words mt-0.5" title={revData.remark}>
                                                "{revData.remark}"
                                              </p>
                                            )}
                                            {revData.flaggedCategories?.length > 0 && (
                                              <div className="flex flex-wrap gap-0.5 mt-0.5">
                                                {revData.flaggedCategories.slice(0, 2).map((cat: string, ci: number) => (
                                                  <span key={ci} className="text-[9px] px-1 py-0.2 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 truncate max-w-[140px]" title={cat}>
                                                    ⚠️ {cat}
                                                  </span>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      };

                                      return (
                                        <div className="flex flex-col items-center justify-center w-full">
                                          {mainRevData && renderReviewBadge(mainRevData, `1st: ${mainTitle.replace(/^1st:\s*/i, "")}`)}
                                          {childRevDataFinal && renderReviewBadge(childRevDataFinal, `2nd: ${childTitle.replace(/^2nd:\s*/i, "")}`)}
                                        </div>
                                      );
                                    })()}
                                  </td>
                                  <td className="px-3 py-3 text-center border border-gray-200 dark:border-gray-700 whitespace-nowrap">
                                    {(() => {
                                      const respId = response.id || (response as any)._id;
                                      const status =
                                        tableDisplayStatuses[response.id] ||
                                        tableDisplayStatuses[(response as any)._id] ||
                                        (respId ? tableDisplayStatuses[respId] : null) ||
                                        responseStatuses[response.id] ||
                                        responseStatuses[(response as any)._id] ||
                                        (respId ? responseStatuses[respId] : null) ||
                                        computeFastRowStatus(response, chassisQuestionId) ||
                                        (response.status && response.status !== "pending" ? response.status : "Direct Ok");

                                      const biwStatus = String(response.biwReview?.status || "").toLowerCase();
                                      const tvsStatus = String(response.review?.reviewOption || response.review?.status || "").toLowerCase();
                                      const isReworkOrRejected =
                                        biwStatus === "rework" ||
                                        biwStatus === "reworked" ||
                                        biwStatus === "rejected" ||
                                        tvsStatus === "rework" ||
                                        tvsStatus === "rejected";

                                      // 1️⃣ Check if response is eligible for dispatch based on status and reviews
                                      const canShowDispatch = !isReworkOrRejected && (
                                        status === "Direct Ok" ||
                                        status === "Rework Accepted" ||
                                        status === "Rework Completed" ||
                                        status === "Accepted"
                                      );

                                      // 2️⃣ Use the tenant check function
                                      const isSameTenant = isOwnTenantResponse(response);

                                      // ✅ 1️⃣ FIRST: Already dispatched - show read-only badge!
                                      // Entering chat or TVS review must NEVER hide the dispatch record.
                                      if (response.isDispatched) {
                                        const dispatchDate = response.dispatchedAt ? new Date(response.dispatchedAt) : null;
                                        return (
                                          <div className="flex flex-col items-center justify-center text-xs text-center gap-0.5">
                                            <div className="flex items-center text-green-600 dark:text-green-400 font-semibold">
                                              <CheckCircle className="w-3.5 h-3.5 mr-1" />
                                              <span>Enabled</span>
                                            </div>
                                            {response.dispatchedByName ? (
                                              <span className="text-gray-600 dark:text-gray-300 text-[10px] font-semibold whitespace-nowrap">
                                                {response.dispatchedByName}
                                              </span>
                                            ) : (
                                              <span className="text-gray-400 text-[10px] italic">Unknown user</span>
                                            )}
                                            {dispatchDate && (
                                              <span className="text-gray-400 text-[9px] whitespace-nowrap">
                                                {dispatchDate.toLocaleDateString()} · {dispatchDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                              </span>
                                            )}
                                          </div>
                                        );
                                      }

                                      // ❌ If under active rework or rejection, dispatch is blocked
                                      if (isReworkOrRejected || !canShowDispatch) {
                                        return <span className="text-gray-400 text-xs">-</span>;
                                      }

                                      // 🔒 NOT CREATOR TENANT: Show dash (NO CHECKBOX)
                                      if (!isOwnTenantForm || !isSameTenant) {
                                        return <span className="text-gray-400 text-xs">-</span>;
                                      }

                                      // ✅ SAME TENANT: Show checkboxa
                                      return (
                                        <input
                                          type="checkbox"
                                          checked={selectedDispatchIds.includes(response.id)}
                                          disabled={isBulkDispatching}
                                          onChange={(e) => {
                                            e.stopPropagation();
                                            if (e.target.checked) {
                                              setSelectedDispatchIds(prev => [...prev, response.id]);
                                            } else {
                                              setSelectedDispatchIds(prev => prev.filter(id => id !== response.id));
                                            }
                                          }}
                                          className="w-4 h-4 text-green-600 border-gray-300 dark:border-gray-600 rounded cursor-pointer accent-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                          title="Select for dispatch"
                                        />
                                      );
                                    })()}
                                  </td>
                                  <td className="px-6 py-3 text-sm text-gray-900 dark:text-white font-bold border border-gray-200 dark:border-gray-700 min-w-48 whitespace-nowrap bg-gray-50/50 dark:bg-gray-800/30">
                                    {response.submittedBy ||
                                      response.createdBy ||
                                      "Anonymous"}
                                  </td>
                                  <td className="px-6 py-3 text-sm font-bold border border-gray-200 dark:border-gray-700 min-w-32 whitespace-nowrap bg-gray-50/50 dark:bg-gray-800/30">
                                    {(() => {
                                      const respId = response.id || (response as any)._id;
                                      const rowStatus =
                                        tableDisplayStatuses[response.id] ||
                                        tableDisplayStatuses[(response as any)._id] ||
                                        (respId ? tableDisplayStatuses[respId] : null) ||
                                        responseStatuses[response.id] ||
                                        responseStatuses[(response as any)._id] ||
                                        (respId ? responseStatuses[respId] : null) ||
                                        computeFastRowStatus(response, chassisQuestionId) ||
                                        (response.status && response.status !== "pending" ? response.status : "Direct Ok");

                                      return (
                                        <span
                                          className={`px-2 py-1 rounded-full text-xs ${rowStatus === "Rejected"
                                            ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                                            : rowStatus?.includes("Rework") &&
                                              rowStatus !== "Rework Accepted"
                                              ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                                              : rowStatus === "Direct Ok" ||
                                                rowStatus === "Rework Accepted" ||
                                                rowStatus === "Accepted"
                                                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                                                : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                                            }`}
                                        >
                                          {rowStatus || "Direct Ok"}
                                        </span>
                                      );
                                    })()}
                                  </td>
                                  <td className="px-6 py-3 text-sm text-gray-900 dark:text-white font-medium border border-gray-200 dark:border-gray-700 min-w-40 whitespace-nowrap bg-gray-50/50 dark:bg-gray-800/30">
                                    {editingChassisResponseId === response.id ? (
                                      <div className="flex items-center gap-1.5">
                                        {chassisMasterOptions.length > 0 ? (
                                          <select
                                            value={chassisEditValue}
                                            onChange={(e) => setChassisEditValue(e.target.value)}
                                            autoFocus
                                            className="flex-1 px-2 py-1 text-xs border border-blue-400 dark:border-blue-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                          >
                                            <option value="">Select Chassis</option>
                                            {chassisMasterOptions.map((opt) => (
                                              <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                              </option>
                                            ))}
                                            {chassisEditValue &&
                                              !chassisMasterOptions.some((o) => o.value === chassisEditValue) && (
                                                <option value={chassisEditValue}>
                                                  {chassisEditValue} (current)
                                                </option>
                                              )}
                                          </select>
                                        ) : (
                                          <input
                                            type="text"
                                            value={chassisEditValue}
                                            onChange={(e) => setChassisEditValue(e.target.value)}
                                            autoFocus
                                            placeholder="Enter chassis"
                                            className="flex-1 px-2 py-1 text-xs border border-blue-400 dark:border-blue-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                          />
                                        )}
                                        <button
                                          onClick={() => handleSaveChassisEdit(response)}
                                          disabled={isSavingChassis}
                                          title="Save"
                                          className="p-1 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors disabled:opacity-50"
                                        >
                                          <CheckCircle className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={handleCancelChassisEdit}
                                          disabled={isSavingChassis}
                                          title="Cancel"
                                          className="p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
                                        >
                                          <XCircle className="w-4 h-4" />
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1.5 group">
                                        {(() => {
                                          const chassisVal = getResponseChassisValue(response);
                                          return chassisVal && chassisVal !== "-" && chassisVal !== "N/A" && chassisVal !== "None" ? (
                                            <span className="text-gray-900 dark:text-gray-100 font-medium text-xs">
                                              {chassisVal}
                                            </span>
                                          ) : (
                                            <span className="text-gray-400 dark:text-gray-500 text-xs font-medium">None</span>
                                          );
                                        })()}
                                        <button
                                          onClick={() => handleStartChassisEdit(response)}
                                          title="Edit Chassis"
                                          className="p-1 text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded transition-all opacity-0 group-hover:opacity-100"
                                        >
                                          <Edit className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                  {isChildFollowUpForm && showParentMatchColumn && (
                                    <td className="px-4 py-3 text-xs border border-gray-200 dark:border-gray-700 min-w-44 whitespace-nowrap bg-indigo-50/20 dark:bg-indigo-950/10">
                                      {(() => {
                                        const pm = computeParentMatch(response);
                                        const isMatched = pm.status === "matched" && (pm.badgeText.includes("Parent Matched") || isChildFollowUpForm);
                                        const rowId = response?._id || response?.id;
                                        const isLoadingThis = loadingParentRedirectId === rowId;
                                        const matchedChassis = pm.matchedChassis || getResponseChassisValue(response);

                                        return (
                                          <div className="flex flex-col gap-0.5" title={pm.tooltip}>
                                            <div className="flex items-center gap-1.5">
                                              {isMatched ? (
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleViewParentResponse(response, pm);
                                                  }}
                                                  className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border transition-all shadow-2xs hover:shadow-sm hover:scale-[1.02] cursor-pointer ${pm.badgeClasses} hover:ring-2 hover:ring-emerald-400/50`}
                                                  title={`Click to view parent response details for chassis "${matchedChassis || ''}" (${pm.tooltip})`}
                                                >
                                                  {isLoadingThis ? (
                                                    <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-emerald-600 dark:text-emerald-400" />
                                                  ) : (
                                                    <Eye className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400 group-hover:text-emerald-800 dark:group-hover:text-emerald-200 transition-colors" />
                                                  )}
                                                  <span>{pm.badgeText}</span>
                                                </button>
                                              ) : (
                                                <span
                                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border transition-colors shadow-2xs ${pm.badgeClasses}`}
                                                >
                                                  {(() => {
                                                    const Icon = pm.icon || AlertTriangle;
                                                    return <Icon className="w-3 h-3 shrink-0" />;
                                                  })()}
                                                  <span>{pm.badgeText}</span>
                                                </span>
                                              )}
                                            </div>
                                            {pm.subText && (
                                              <span className="text-xs text-gray-600 dark:text-gray-300 pl-0.5 font-medium truncate max-w-[170px]">
                                                {pm.subText}
                                              </span>
                                            )}
                                          </div>
                                        );
                                      })()}
                                    </td>
                                  )}
                                  {/* BIW Review Column - Complete Fixed Version */}
                                  <td className="px-4 py-3 border border-gray-200 dark:border-gray-700 min-w-40 bg-purple-50/50 dark:bg-purple-900/10">
                                    {(() => {
                                      const isSubmitter = isSubmitterOfResponse(response);
                                      const reviewAuth = canUserBiwReview(response);
                                      const canReview = reviewAuth.canReview;
                                      const reviewBlockReason = reviewAuth.reason || (isSubmitter ? "You cannot BIW review your own submission" : "Only assigned tenant reviewers can perform BIW review");
                                      const currentStatus = response.biwReview?.status;
                                      const isSaving = biwSavingResponseId === response.id;
                                      const isEligible = isBiwEligibleResponse(response);

                                      // Extract BIW flagged categories (strictly from biwReview only)
                                      const biwFlaggedCategories: string[] = (
                                        Array.isArray(response.biwReview?.flaggedQuestions) && response.biwReview.flaggedQuestions.length > 0
                                          ? response.biwReview.flaggedQuestions
                                          : Array.isArray(response.biwReview?.defects) && response.biwReview.defects.length > 0
                                            ? response.biwReview.defects
                                            : []
                                      )
                                        .map((q: any) => typeof q === "object" ? (q.questionText || q.title || q.text || q.questionId) : String(q))
                                        .filter((s): s is string => Boolean(s && s.trim()));

                                      // ❌ Rework responses do not receive BIW review:
                                      // Only "Direct Ok", "Accepted", and "Rework Accepted" can receive BIW review.
                                      if (!isEligible) {
                                        if (currentStatus) {
                                          return (
                                            <div className="flex flex-col items-center justify-center gap-1">
                                              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                                                {currentStatus}
                                              </span>
                                              {biwFlaggedCategories.length > 0 && (
                                                <div className="flex flex-wrap gap-1 justify-center mt-0.5 max-w-full">
                                                  {biwFlaggedCategories.map((cat, i) => (
                                                    <span
                                                      key={i}
                                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 max-w-[200px] truncate"
                                                      title={`BIW Defect Category: ${cat}`}
                                                    >
                                                      <span>⚠️</span>
                                                      <span className="truncate">{cat}</span>
                                                    </span>
                                                  ))}
                                                </div>
                                              )}
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setBiwViewResponse(response);
                                                  setShowBiwViewModal(true);
                                                }}
                                                className="flex items-center gap-1 text-[11px] font-medium text-purple-600 dark:text-purple-400 hover:underline"
                                              >
                                                <Eye className="w-3 h-3" />
                                                <span>View</span>
                                              </button>
                                            </div>
                                          );
                                        }
                                        return (
                                          <div className="flex items-center justify-center text-center">
                                            <span className="text-gray-400 text-xs font-medium">-</span>
                                          </div>
                                        );
                                      }

                                      // 🔥 FIX: Define options here - this is the missing piece!
                                      const biwOptions: {
                                        status: "Accepted" | "Rejected" | "Reworked";
                                        label: string;
                                        icon: any;
                                        activeClass: string;
                                      }[] = [
                                          {
                                            status: "Accepted",
                                            label: "Accept",
                                            icon: CheckCircle,
                                            activeClass: "text-green-600 dark:text-green-400",
                                          },
                                          {
                                            status: "Rejected",
                                            label: "Reject",
                                            icon: XCircle,
                                            activeClass: "text-red-600 dark:text-red-400",
                                          },
                                          {
                                            status: "Reworked",
                                            label: "Rework",
                                            icon: RotateCcw,
                                            activeClass: "text-orange-600 dark:text-orange-400",
                                          },
                                        ];

                                      // Get checked state
                                      const isChecked = selectedBiwIds.includes(response.id);
                                      const rowKey = `biw-${response.id}-${isChecked ? 'selected' : 'unselected'}`;

                                      return (
                                        <div className="flex flex-col gap-1.5" key={rowKey}>
                                          {/* Selection checkbox */}
                                          <div className="flex items-center gap-2 mb-1 border-b border-gray-200 dark:border-gray-700 pb-1">
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              disabled={!canReview}
                                              onChange={(e) => {
                                                if (!canReview) return;
                                                e.stopPropagation();
                                                e.preventDefault();

                                                if (e.target.checked) {
                                                  setSelectedBiwIds(prev => [...prev, response.id]);
                                                } else {
                                                  setSelectedBiwIds(prev => prev.filter(id => id !== response.id));
                                                }
                                              }}
                                              className={`w-3.5 h-3.5 text-purple-600 border-gray-300 dark:border-gray-600 rounded accent-purple-600 ${!canReview ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
                                              title={!canReview ? reviewBlockReason : "Select for bulk review"}
                                            />
                                            <span className={`text-xs font-bold uppercase ${!canReview ? "text-gray-400 dark:text-gray-600" : "text-gray-700 dark:text-gray-300"}`}>Select</span>
                                            {isChecked && (
                                              <span className="ml-auto text-[9px] font-bold text-purple-600 bg-purple-100 dark:bg-purple-900/30 px-1.5 py-0.5 rounded">
                                                ✓
                                              </span>
                                            )}
                                          </div>

                                          {/* BIW Review Status Options */}
                                          {biwOptions.map((opt) => {
                                            const Icon = opt.icon;
                                            const checked = currentStatus === opt.status;
                                            return (
                                              <label
                                                key={opt.status}
                                                title={!canReview ? reviewBlockReason : opt.label}
                                                className={`flex items-center gap-1.5 text-xs font-medium ${!canReview
                                                  ? "opacity-40 cursor-not-allowed"
                                                  : "cursor-pointer"
                                                  } ${checked ? opt.activeClass : "text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white"}`}
                                              >
                                                <input
                                                  type="checkbox"
                                                  checked={checked}
                                                  disabled={!canReview || isSaving}
                                                  onChange={() => {
                                                    if (!canReview) return;
                                                    console.log(`[BIW] Status change for ${response.id}: ${opt.status}`);
                                                    handleBiwReviewChange(response, opt.status);
                                                  }}
                                                  className="w-3.5 h-3.5 rounded cursor-pointer accent-current disabled:cursor-not-allowed"
                                                />
                                                <Icon className="w-3.5 h-3.5" />
                                                <span>{opt.label}</span>
                                              </label>
                                            );
                                          })}

                                          {isSaving && (
                                            <span className="flex items-center gap-1 text-[10px] text-gray-400">
                                              <Loader2 className="w-3 h-3 animate-spin" />
                                              Saving...
                                            </span>
                                          )}

                                          {/* Eye icon: view modal showing BIW remark/questions/evidence and discussion */}
                                          {Boolean(currentStatus || response.biwReview?.remark || response.biwReview?.reviewedBy) && (
                                            <div className="flex flex-col gap-1 border-t border-gray-200 dark:border-gray-700 pt-1.5 mt-0.5">
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setBiwViewResponse(response);
                                                  setShowBiwViewModal(true);
                                                }}
                                                className="flex items-center gap-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300"
                                                title="View BIW review details"
                                              >
                                                <Eye className="w-3.5 h-3.5" />
                                                <span>View</span>
                                              </button>
                                              {biwFlaggedCategories.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-0.5 max-w-full">
                                                  {biwFlaggedCategories.map((cat, i) => (
                                                    <span
                                                      key={i}
                                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 max-w-[200px] truncate"
                                                      title={`BIW Defect Category: ${cat}`}
                                                    >
                                                      <span>⚠️</span>
                                                      <span className="truncate">{cat}</span>
                                                    </span>
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })()}
                                  </td>
                                  <td className="px-6 py-3 text-xs border border-gray-200 dark:border-gray-700 min-w-44 whitespace-nowrap">
                                    {(() => {
                                      const rawTs = getResponseTimestamp(response);
                                      if (!rawTs) return <span className="text-gray-400 font-normal">-</span>;
                                      const d = new Date(rawTs);
                                      if (isNaN(d.getTime())) {
                                        return (
                                          <span className="text-gray-600 dark:text-gray-300 font-medium">
                                            {formatToDDMMYYYY(rawTs)}
                                          </span>
                                        );
                                      }
                                      const day = String(d.getDate()).padStart(2, "0");
                                      const month = String(d.getMonth() + 1).padStart(2, "0");
                                      const year = d.getFullYear();
                                      const dateFormatted = `${day}/${month}/${year}`;
                                      // Suppress time display for synthetic midday UTC (12:00:00Z)
                                      // which is the sentinel value used by parseExcelDate to prevent
                                      // timezone day-flips on date-only Excel imports.
                                      const isSyntheticMidday = d.getUTCHours() === 12 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;
                                      const timeFormatted = isSyntheticMidday ? null : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

                                      return (
                                        <div className="flex flex-col gap-0.5 select-text">
                                          <span className="font-semibold text-gray-800 dark:text-gray-200 tracking-tight">
                                            {dateFormatted}
                                          </span>
                                          {timeFormatted && (
                                            <span className="text-[11px] text-gray-500 dark:text-gray-400 font-normal">
                                              {timeFormatted}
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })()}
                                  </td>

                                  <td className="px-4 py-3 text-sm text-center border border-gray-200 dark:border-gray-700 whitespace-nowrap">
                                    {(() => {
                                      const timeSpent =
                                        response.timeSpent ??
                                        response.totalTimeSpent;
                                      const respId = response.id || (response as any)._id;
                                      const rank =
                                        chassisAttemptRanks[respId] ||
                                        (response.responseRanks && typeof response.responseRanks === 'object'
                                          ? (chassisQuestionId && response.responseRanks[chassisQuestionId]) || Object.values(response.responseRanks).find((v: any) => typeof v === 'number' && v > 0)
                                          : null) ||
                                        1;
                                      const rowStatus =
                                        tableDisplayStatuses[respId] ||
                                        responseStatuses[respId] ||
                                        computeFastRowStatus(response, chassisQuestionId) ||
                                        "Direct Ok";

                                      const getRankBadgeClass = (status: string) => {
                                        if (status === "Rejected") {
                                          return "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700";
                                        }
                                        if (
                                          status?.includes("Rework") &&
                                          status !== "Rework Accepted" &&
                                          status !== "Rework Completed"
                                        ) {
                                          return "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700";
                                        }
                                        if (
                                          status === "Direct Ok" ||
                                          status === "Rework Accepted" ||
                                          status === "Accepted" ||
                                          status === "Rework Completed" ||
                                          status === "Verified"
                                        ) {
                                          return "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700";
                                        }
                                        return "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600";
                                      };

                                      return (
                                        <div className="flex items-center justify-center gap-2">
                                          {/* Time Taken duration */}
                                          {timeSpent !== undefined &&
                                            timeSpent !== null &&
                                            timeSpent > 0 && (
                                              <div className="flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400 text-xs">
                                                <Clock className="w-3.5 h-3.5 text-blue-500" />
                                                <span>
                                                  {timeSpent > 60
                                                    ? `${Math.floor(timeSpent / 60)}m ${timeSpent % 60}s`
                                                    : `${timeSpent}s`}
                                                </span>
                                              </div>
                                            )}

                                          {/* Chassis Attempt Rank Badge (1, 2, etc.) placed AFTER time taken with status-based color */}
                                          <span
                                            title={`Chassis inspection attempt #${rank} (${rowStatus})`}
                                            className={`text-[11px] font-extrabold min-w-[22px] h-[22px] px-1.5 rounded-full flex items-center justify-center border shadow-xs ${getRankBadgeClass(rowStatus)}`}
                                          >
                                            {rank}
                                          </span>
                                        </div>
                                      );
                                    })()}
                                  </td>
                                  {form?.sections?.map(
                                    (section: Section) =>
                                      selectedResponsesSectionIds.includes(
                                        section.id,
                                      ) &&
                                      section.questions?.map((q: any) => {
                                        const isFollowUp =
                                          q.parentId || q.showWhen?.questionId;
                                        const isEditing =
                                          editingResponseId === response.id;
                                        const hasCorrectAnswer =
                                          q.correctAnswer !== undefined;
                                        const answer = response.answers?.[q.id];

                                        let isCorrect = false;
                                        if (
                                          hasCorrectAnswer &&
                                          answer !== undefined &&
                                          answer !== null &&
                                          answer !== ""
                                        ) {
                                          const answerStr = Array.isArray(
                                            answer,
                                          )
                                            ? answer.join(", ").toLowerCase()
                                            : String(answer).toLowerCase();
                                          const correctStr = Array.isArray(
                                            q.correctAnswer,
                                          )
                                            ? q.correctAnswer
                                              .join(", ")
                                              .toLowerCase()
                                            : String(
                                              q.correctAnswer,
                                            ).toLowerCase();
                                          isCorrect = answerStr === correctStr;
                                        }

                                        return (
                                          <td
                                            key={`${response.id}-${q.id}`}
                                            className={`px-6 py-3 text-sm border border-gray-200 dark:border-gray-700 min-w-64 break-words ${isFollowUp
                                              ? "bg-purple-50 dark:bg-purple-900/10"
                                              : ""
                                              } ${hasCorrectAnswer && !isEditing
                                                ? isCorrect
                                                  ? "bg-green-100 dark:bg-green-900/30"
                                                  : "bg-red-100 dark:bg-red-900/30"
                                                : ""
                                              }`}
                                          >
                                            {isEditing ? (
                                              <input
                                                type="text"
                                                value={
                                                  typeof editFormData[q.id] ===
                                                    "object" &&
                                                    "status" in editFormData[q.id]
                                                    ? editFormData[q.id].status
                                                    : editFormData[q.id]
                                                      ? typeof editFormData[
                                                        q.id
                                                      ] === "string"
                                                        ? editFormData[q.id]
                                                        : JSON.stringify(
                                                          editFormData[q.id],
                                                          null,
                                                          2,
                                                        )
                                                      : ""
                                                }
                                                onChange={(e) => {
                                                  const val = e.target.value;
                                                  if (
                                                    editFormData[q.id] &&
                                                    typeof editFormData[
                                                    q.id
                                                    ] === "object" &&
                                                    "status" in
                                                    editFormData[q.id]
                                                  ) {
                                                    setEditFormData({
                                                      ...editFormData,
                                                      [q.id]: {
                                                        ...editFormData[q.id],
                                                        status: val,
                                                      },
                                                    });
                                                  } else {
                                                    let parsed;
                                                    try {
                                                      parsed = JSON.parse(val);
                                                    } catch {
                                                      parsed = val;
                                                    }
                                                    setEditFormData({
                                                      ...editFormData,
                                                      [q.id]: parsed,
                                                    });
                                                  }
                                                }}
                                                className="w-full px-2 py-1 border border-blue-400 dark:border-blue-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="Enter answer"
                                              />
                                            ) : (
                                              <div className="flex flex-col gap-1 max-w-[250px] overflow-auto max-h-[250px]">
                                                {renderAnswerDisplay(answer, q)}
                                                {q.trackResponseRank &&
                                                  response.responseRanks?.[
                                                  q.id
                                                  ] && (
                                                    <span
                                                      className={`text-[10px] font-bold min-w-[24px] h-6 px-1.5 rounded-full flex items-center justify-center border shadow-sm w-fit mt-1 ${getRankStyle(answer, darkMode)}`}
                                                    >
                                                      #
                                                      {
                                                        response.responseRanks[
                                                        q.id
                                                        ]
                                                      }
                                                    </span>
                                                  )}
                                              </div>
                                            )}
                                          </td>
                                        );
                                      }),
                                  )}
                                </tr>
                              ),
                            )
                          ) : loadingTable ? (
                            Array.from({ length: 6 }).map((_, rIdx) => (
                              <tr key={`skel-row-${rIdx}`} className="animate-pulse">
                                <td className="hidden sm:table-cell px-3 py-4 border border-gray-200 dark:border-gray-700">
                                  <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded mx-auto"></div>
                                </td>
                                <td className="px-4 py-4 border border-gray-200 dark:border-gray-700">
                                  <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded mx-auto"></div>
                                </td>
                                <td className="px-6 py-4 border border-gray-200 dark:border-gray-700">
                                  <div className="w-20 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                </td>
                                <td className="px-6 py-4 border border-gray-200 dark:border-gray-700">
                                  <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                </td>
                                <td className="px-6 py-4 border border-gray-200 dark:border-gray-700">
                                  <div className="w-24 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                </td>
                                <td className="px-6 py-4 border border-gray-200 dark:border-gray-700">
                                  <div className="w-24 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                </td>
                                {isChildFollowUpForm && showParentMatchColumn && (
                                  <td className="px-4 py-4 border border-gray-200 dark:border-gray-700">
                                    <div className="w-24 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                  </td>
                                )}
                                <td className="px-4 py-4 border border-gray-200 dark:border-gray-700">
                                  <div className="w-20 h-4 bg-gray-200 dark:bg-gray-700 rounded mx-auto"></div>
                                </td>
                                <td className="px-6 py-4 border border-gray-200 dark:border-gray-700">
                                  <div className="w-24 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                </td>
                                <td className="px-4 py-4 border border-gray-200 dark:border-gray-700">
                                  <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded mx-auto"></div>
                                </td>
                                {form?.sections?.map(
                                  (section: Section) =>
                                    selectedResponsesSectionIds.includes(section.id) &&
                                    section.questions?.map((q: any) => (
                                      <td key={`skel-${q.id}`} className="px-4 py-4 border border-gray-200 dark:border-gray-700">
                                        <div className="w-20 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                      </td>
                                    ))
                                )}
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td
                                colSpan={100}
                                className="p-0 border-0"
                              />
                            </tr>
                          )}
                        </tbody>
                      </table>

                      {/* Prominent, Centered Sticky Empty State when 0 responses match active filters */}
                      {!loadingTable && displayedTableResponses.length === 0 && (
                        <div className="sticky left-0 w-full min-h-[320px] flex flex-col items-center justify-center py-16 px-4 text-center bg-gray-50/60 dark:bg-gray-900/40 border-t border-gray-200 dark:border-gray-700">
                          {(() => {
                            const biwFilter = columnFilters["__biwReview"]?.[0];
                            const statusFilter = columnFilters["__status"]?.[0];
                            const tvsFilter = columnFilters["__tvsReview"]?.[0] || columnFilters["__review"]?.[0];
                            const dispatchFilter = columnFilters["__dispatch"]?.[0];

                            let badge = "FILTER";
                            let title = "None found matching filter";
                            let description = "No inspection records match the current filter criteria.";
                            let actionLabel: string | null = null;
                            let actionFn: (() => void) | null = null;

                            if (biwFilter) {
                              badge = "BIW REVIEW";
                              title = `None found for ${biwFilter}`;
                              description = `0 inspection records are marked as "${biwFilter}" under BIW Review in this date range.`;
                              actionLabel = `Clear "${biwFilter}" Filter`;
                              actionFn = () => {
                                startFilterTransition(() => {
                                  setColumnFilters((prev) => {
                                    const next = { ...prev };
                                    delete next["__biwReview"];
                                    return next;
                                  });
                                });
                                showToast("Cleared BIW review filter", "info");
                              };
                            } else if (statusFilter) {
                              badge = "STATUS";
                              title = `None found for ${statusFilter}`;
                              description = `0 inspection records match status "${statusFilter}".`;
                              actionLabel = `Clear "${statusFilter}" Filter`;
                              actionFn = () => {
                                startFilterTransition(() => {
                                  setColumnFilters((prev) => {
                                    const next = { ...prev };
                                    delete next["__status"];
                                    return next;
                                  });
                                });
                              };
                            } else if (hasActiveFiltersOrSort) {
                              badge = "FILTERS";
                              title = "None found for current filters";
                              description = "Try adjusting your date range or clearing active filters to see records.";
                              actionLabel = "Clear All Filters";
                              actionFn = () => {
                                startFilterTransition(() => {
                                  setColumnFilters({});
                                  setAppliedFilters([]);
                                });
                              };
                            }

                            return (
                              <div className="max-w-md mx-auto flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-200">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-100 to-indigo-100 dark:from-purple-900/40 dark:to-indigo-900/40 text-purple-600 dark:text-purple-300 flex items-center justify-center mb-3.5 shadow-sm border border-purple-200/60 dark:border-purple-700/50">
                                  <Filter className="w-6 h-6" />
                                </div>
                                <span className="inline-block px-2.5 py-0.5 mb-2 text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-300 bg-purple-100/80 dark:bg-purple-900/50 rounded-full border border-purple-200 dark:border-purple-800">
                                  {badge}
                                </span>
                                <h3 className="text-base font-bold text-gray-900 dark:text-white uppercase tracking-wide mb-1.5">
                                  {title}
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-5 max-w-sm leading-relaxed">
                                  {description}
                                </p>
                                {actionLabel && actionFn && (
                                  <button
                                    type="button"
                                    onClick={actionFn}
                                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-95"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>{actionLabel}</span>
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                    Select at least one section to view responses
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Cascading Filter Modal */}
      {/* Cascading Filter Modal */}
      <CascadingFilterModal
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        questions={
          (form?.sections?.flatMap((s: any) => s.questions || []) || []).filter(
            (q: any) => !q.parentId && !q.showWhen?.questionId,
          )
        }
        responses={responses}
        initialDateRange={{
          startDate: dateFilter.type === "all" ? "" : dateFilter.startDate,
          endDate: dateFilter.type === "all" ? "" : dateFilter.endDate,
        }}
        onApplyFilters={(filters) => {
          setHasUserAppliedDateFilter(true); // user has taken explicit control of filtering
          const { dates, locations, ...questionFilters } = filters as any;

          // ✅ Build applied filters array for display
          const newAppliedFilters: Array<{ id: string; label: string; value: string }> = [];

          // Add question filters
          Object.entries(questionFilters).forEach(([questionId, answers]) => {
            if (Array.isArray(answers) && answers.length > 0) {
              // Find the question text from the form
              let questionText = questionId;
              if (form?.sections) {
                for (const section of form.sections) {
                  const found = section.questions?.find((q: any) => q.id === questionId);
                  if (found) {
                    questionText = found.text || found.label || questionId;
                    break;
                  }
                }
              }
              newAppliedFilters.push({
                id: questionId,
                label: questionText,
                value: answers.join(', ')
              });
            }
          });

          // Add location filters
          if (locations && locations.length > 0) {
            newAppliedFilters.push({
              id: 'location',
              label: 'Location',
              value: locations.join(', ')
            });
          }

          // Add date filters
          if (dates && (dates.startDate || dates.endDate)) {
            let dateLabel = 'Date';
            let dateValue = '';
            if (dates.startDate && dates.endDate) {
              dateValue = `${dates.startDate} to ${dates.endDate}`;
            } else if (dates.startDate) {
              dateValue = `From ${dates.startDate}`;
            } else if (dates.endDate) {
              dateValue = `Until ${dates.endDate}`;
            }
            newAppliedFilters.push({
              id: 'date',
              label: dateLabel,
              value: dateValue
            });
          }

          // ✅ Update appliedFilters state
          setAppliedFilters(newAppliedFilters);

          // Update other filter states
          setCascadingFilters(questionFilters);
          if (dates) {
            setDateFilter({
              type: dates.startDate || dates.endDate ? "range" : "all",
              startDate: dates.startDate || "",
              endDate: dates.endDate || "",
            });
          }
          if (locations && locations.length > 0) {
            setLocationFilter(locations);
          }

          // Close the modal
          setShowFilterModal(false);
        }}
      />

      {/* Response Details Modal */}
      <ResponseDetailsModal
        selectedResponse={selectedResponse}
        selectedFormForModal={selectedFormForModal}
        onClose={() => {
          setSelectedResponse(null);
          setSelectedFormForModal(null);
        }}
        getResponseTimestamp={getResponseTimestamp}
        formatToDDMMYYYY={formatToDDMMYYYY}
        getResponseChassisValue={getResponseChassisValue}
        computeParentMatch={computeParentMatch}
        isChildFollowUpForm={isChildFollowUpForm}
        handleViewParentResponse={handleViewParentResponse}
        renderAnswerDisplay={renderAnswerDisplay}
        hasAnswerValue={hasAnswerValue}
        getRankStyle={getRankStyle}
        darkMode={darkMode}
      />

      {/* Comparison View - Last 3 Responses */}
      <ComparisonView
        analyticsView={analyticsView}
        comparisonViewMode={comparisonViewMode}
        setComparisonViewMode={setComparisonViewMode}
        form={form}
        filteredResponses={filteredResponses}
        getResponseTimestamp={getResponseTimestamp}
        getSectionYesNoStats={getSectionYesNoStats}
        renderAnswerDisplay={renderAnswerDisplay}
        hasAnswerValue={hasAnswerValue}
        getRankStyle={getRankStyle}
        darkMode={darkMode}
      />

      {/* Delete Confirmation Modal */}
      <DeleteResponseConfirmModal
        isOpen={showDeleteConfirm}
        isDeleting={isDeleting}
        onConfirm={handleDeleteResponse}
        onClose={() => {
          setShowDeleteConfirm(false);
          setDeletingResponseId(null);
        }}
      />

      {/* Bulk Delete Confirmation Modal */}
      <BulkDeleteConfirmModal
        isOpen={showBulkDeleteConfirm}
        count={selectedResponseIds.length}
        isDeleting={isDeleting}
        onConfirm={handleBulkDeleteResponses}
        onClose={() => {
          setShowBulkDeleteConfirm(false);
        }}
      />

      {/* Bulk BIW Review Confirmation Modal */}
      <BiwBulkUpdateModal
        show={showBiwBulkUpdateModal}
        status={biwBulkUpdateStatus}
        count={selectedResponseIds.length}
        loading={isBulkBiwUpdating}
        onConfirm={executeBulkBiwReviewUpdate}
        onCancel={() => {
          setShowBiwBulkUpdateModal(false);
          setBiwBulkUpdateStatus(null);
        }}
      />

      {/* NEW - BIW Review Action Popup (Reject / Rework) */}
      <BiwReviewActionModal
        isOpen={showBiwActionModal}
        response={biwActionResponse}
        status={biwActionStatus}
        selectedQuestionIds={biwActionSelectedQuestionIds}
        remark={biwActionRemark}
        evidenceUrl={biwActionEvidenceUrl}
        isUploading={biwActionUploading}
        isSubmitting={isBiwActionSubmitting}
        questionOptions={biwActionResponse ? getResponseQuestionOptions(biwActionResponse) : []}
        onClose={closeBiwActionModal}
        onToggleQuestion={toggleBiwActionQuestion}
        onRemarkChange={setBiwActionRemark}
        onEvidenceChange={setBiwActionEvidenceUrl}
        onEvidenceUpload={handleBiwEvidenceUpload}
        onSubmit={submitBiwActionModal}
      />

      {/* NEW - BIW Review Eye/View Modal (read-only) */}
      <BiwReviewViewModal
        isOpen={showBiwViewModal}
        response={biwViewResponse}
        chassisValue={biwViewResponse ? getResponseChassisValue(biwViewResponse) : "-"}
        onClose={() => {
          setShowBiwViewModal(false);
          setBiwViewResponse(null);
        }}
      />

      {/* Bulk Dispatch Confirmation Modal */}
      <BulkDispatchConfirmModal
        show={showBulkDispatchConfirm}
        count={selectedDispatchIds.length}
        loading={isBulkDispatching}
        onConfirm={handleExecuteBulkDispatch}
        onCancel={() => {
          setShowBulkDispatchConfirm(false);
        }}
      />

      {/* Action Menu Modal */}
      <ActionMenuModal
        isOpen={showActionMenuModal}
        response={actionResponse}
        chassisValue={
          getResponseChassisValue(actionResponse) !== "-"
            ? getResponseChassisValue(actionResponse)
            : actionResponse?.submittedBy || "Anonymous"
        }
        user={user}
        responseTenantId={actionResponse?.tenantId}
        currentUserTenantId={user?.tenantId}
        isGuest={isGuest}
        onClose={() => {
          setShowActionMenuModal(false);
          setActionResponse(null);
        }}
        onFocus={(resp) => {
          handleOpenModal(resp);
          setShowActionMenuModal(false);
        }}
        onViewDetails={(resp) => {
          handleViewDetails(resp);
          setShowActionMenuModal(false);
        }}
        onOpenChat={(resp) => {
          setChatResponse(resp);
          setShowChatModal(true);
          setSelectedReviewOptions((prev) => ({
            ...prev,
            [resp.id]: "",
          }));
          setReviewedBy((prev) => ({
            ...prev,
            [resp.id]: null,
          }));
          setShowActionMenuModal(false);
        }}
        onEdit={(resp) => {
          handleEditResponse(resp);
          setShowActionMenuModal(false);
        }}
        onDelete={(resp) => {
          setDeletingResponseId(resp.id);
          setShowDeleteConfirm(true);
          setShowActionMenuModal(false);
        }}
      />

      {/* Share Analytics Modal */}
      <ShareAnalyticsModal
        isOpen={shareAnalyticsModal.open}
        onClose={() =>
          setShareAnalyticsModal((prev) => ({ ...prev, open: false }))
        }
        formId={shareAnalyticsModal.formId}
        formTitle={shareAnalyticsModal.formTitle}
        analyticsData={fullAnalyticsData}
      />

      {/* Auto Send Modal */}
      <AutoSendModal
        isOpen={autoSendModal.open}
        onClose={() => setAutoSendModal((prev) => ({ ...prev, open: false }))}
        formId={autoSendModal.formId}
        formTitle={autoSendModal.formTitle}
      />

      {/* Toast Notification */}
      <ToastNotification toast={toast} />

      {/* Chat Modal */}
      <ChatDiscussionModal
        isOpen={showChatModal}
        onClose={() => {
          setShowChatModal(false);
          setChatResponse(null);
        }}
        chatResponse={chatResponse}
        form={form}
        user={user}
        searchParams={searchParams}
        tvsReviews={tvsReviews}
        reviewFormTabs={reviewFormTabs}
        activeReviewQuestionTab={activeReviewQuestionTab}
        setActiveReviewQuestionTab={setActiveReviewQuestionTab}
        selectedReviewOptions={selectedReviewOptions}
        setSelectedReviewOptions={setSelectedReviewOptions}
        reviewedBy={reviewedBy}
        setReviewedBy={setReviewedBy}
        pendingReviewOption={pendingReviewOption}
        setPendingReviewOption={setPendingReviewOption}
        chatFilters={chatFilters}
        setChatFilters={setChatFilters}
        chatMessages={chatMessages}
        newMessage={newMessage}
        setNewMessage={setNewMessage}
        isSendingMessage={isSendingMessage}
        canUserBiwReview={canUserBiwReview}
        isChildFollowUpForm={isChildFollowUpForm}
        handleSendMessage={handleSendMessage}
        handleReviewSubmit={handleReviewSubmit}
        showToast={showToast}
      />

      {/* BIW Review Excel Modal (Dropdown validation, Bulk import & Email template) */}
      <BiwReviewExcelModal
        isOpen={isBiwExcelModalOpen}
        onClose={() => setIsBiwExcelModalOpen(false)}
        formId={id || ""}
        form={
          ((form as any)?.isFollowUpForm || (form as any)?.parentFormId || form?.parentForm || relatedFormData.parentForm)
            ? (form?.parentForm || relatedFormData.parentForm || form)
            : form
        }
        formTitle={
          ((form as any)?.isFollowUpForm || (form as any)?.parentFormId || form?.parentForm || relatedFormData.parentForm)
            ? (form?.parentForm?.title || (form as any)?.parentFormTitle || relatedFormData.parentForm?.title || form?.title || "Main Form")
            : (form?.title || "Main Form")
        }
        mainTenantName={resolveDocTenantName(
          ((form as any)?.isFollowUpForm || (form as any)?.parentFormId || form?.parentForm || relatedFormData.parentForm)
            ? (form?.parentForm || relatedFormData.parentForm || form)
            : form
        )}
        targetTenantForm={
          ((form as any)?.isFollowUpForm || (form as any)?.parentFormId || form?.parentForm || relatedFormData.parentForm)
            ? form
            : (relatedFormData.childForms?.[0] || form?.childForms?.[0] || null)
        }
        targetTenantTitle={
          ((form as any)?.isFollowUpForm || (form as any)?.parentFormId || form?.parentForm || relatedFormData.parentForm)
            ? form?.title
            : (relatedFormData.childForms?.[0]?.title || (form?.childForms?.[0] as any)?.formTitle || (form?.childForms?.[0] as any)?.title || "")
        }
        targetTenantName={resolveDocTenantName(
          ((form as any)?.isFollowUpForm || (form as any)?.parentFormId || form?.parentForm || relatedFormData.parentForm)
            ? form
            : (relatedFormData.childForms?.[0] || form?.childForms?.[0] || null)
        )}
        currentChassisNumbers={Array.from(
          new Set(
            (hasActiveFiltersOrSort ? filteredResponses : (responses.length > 0 ? responses : tableResponses)).flatMap((r) => {
              const a = r.answers || {};
              const vals: string[] = [];
              if (r.chassisNumber) vals.push(String(r.chassisNumber).trim());
              if ((r as any).systemChassisNumber) vals.push(String((r as any).systemChassisNumber).trim());
              if (chassisQuestionId && a[chassisQuestionId] !== undefined) {
                const tr = a[chassisQuestionId];
                const trVal = typeof tr === "object" ? tr?.chassisNumber || tr?.value : tr;
                if (trVal) vals.push(String(trVal).trim());
              }
              Object.values(a).forEach((v) => {
                if (
                  (typeof v === "string" || typeof v === "number") &&
                  String(v).trim().length >= 1 &&
                  String(v).trim().length <= 60
                ) {
                  vals.push(String(v).trim());
                }
              });
              return vals;
            }).filter(Boolean)
          )
        )}
        responses={responses.length > 0 ? responses : tableResponses}
        startDate={dateFilter?.type !== "all" ? dateFilter?.startDate : undefined}
        endDate={dateFilter?.type !== "all" ? dateFilter?.endDate : undefined}
        onImportSuccess={() => {
          showToast("BIW & TVS Reviews imported successfully!", "success");
          try {
            localStorage.setItem("analytics_data_updated", String(Date.now()));
          } catch (_) {}
          fetchResponsesPage(responsesPage || 1);
          refreshDashboardData();
        }}
      />

      {/* BIW Import History Timeline & 5-Hr Undo Modal */}
      <BiwImportHistoryModal
        isOpen={isBiwHistoryModalOpen}
        onClose={() => setIsBiwHistoryModalOpen(false)}
        formId={id || ""}
        formTitle={form?.title || "Inspection Form"}
        onUndoSuccess={() => {
          showToast("Import undone successfully! Records restored.", "success");
          try {
            localStorage.setItem("analytics_data_updated", String(Date.now()));
          } catch (_) {}
          fetchResponsesPage(responsesPage || 1);
          refreshDashboardData();
        }}
      />

      {/* Performance Table Explanation Guide Modal */}
      <PerformanceGuideModal
        isOpen={showPerformanceGuide}
        onClose={() => setShowPerformanceGuide(false)}
      />
    </div>
  );
}
