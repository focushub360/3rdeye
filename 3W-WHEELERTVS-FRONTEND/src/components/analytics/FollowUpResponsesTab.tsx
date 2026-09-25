import React, { useState, useEffect, useMemo } from "react";
import {
  Table,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  Trash2,
  Edit,
  Download,
  ExternalLink,
  ArrowRight,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  User,
  Hash,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Reply,
  Layers,
} from "lucide-react";
import { apiClient } from "../../api/client";
import * as XLSX from "xlsx-js-style";
import { formatToDDMMYYYY } from "../../utils/answerTemplateUtils";

interface Response {
  _id?: string;
  id: string;
  questionId: string;
  answers: Record<string, any>;
  timestamp?: string;
  createdAt?: string;
  submittedBy?: string;
  status?: string;
  isDispatched?: boolean;
  dispatchedAt?: string;
  dispatchedByName?: string;
  biwReview?: any;
  timeSpent?: number;
  [key: string]: any;
}

interface FollowUpResponsesTabProps {
  parentForm: any;
  onOpenResponseDetails: (response: any) => void;
  onSwitchToMainResponses: () => void;
  onNavigateToChildDashboard: (childFormId: string) => void;
  onDeleteResponse?: (responseId: string) => Promise<void>;
}

export default function FollowUpResponsesTab({
  parentForm,
  onOpenResponseDetails,
  onSwitchToMainResponses,
  onNavigateToChildDashboard,
  onDeleteResponse,
}: FollowUpResponsesTabProps) {
  const childForms = parentForm?.childForms || [];
  const [selectedChildId, setSelectedChildId] = useState<string>(() => {
    return childForms[0]?.formId || childForms[0]?._id || "";
  });

  // Automatically select first child form if not set
  useEffect(() => {
    if (!selectedChildId && childForms.length > 0) {
      setSelectedChildId(childForms[0].formId || childForms[0]._id || "");
    }
  }, [childForms, selectedChildId]);

  const activeChild = useMemo(() => {
    return childForms.find(
      (cf: any) => cf.formId === selectedChildId || cf._id === selectedChildId || cf.id === selectedChildId
    ) || childForms[0];
  }, [childForms, selectedChildId]);

  const [responses, setResponses] = useState<Response[]>([]);
  const [childFormSchema, setChildFormSchema] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch responses and child form schema
  const fetchFollowUpData = async (silent: boolean = false) => {
    const targetId = activeChild?.formId || activeChild?._id || activeChild?.id;
    if (!targetId) return;

    if (!silent) setIsLoading(true);
    try {
      // 1. Fetch child form schema for question columns
      try {
        const formData = await apiClient.request<{ form: any }>(`/forms/${targetId}`);
        if (formData && formData.form) {
          setChildFormSchema(formData.form);
        }
      } catch (err) {
        console.warn("[FollowUpResponsesTab] Failed to fetch child form schema:", err);
      }

      // 2. Fetch responses
      const resData = await apiClient.getFormResponses(targetId, {
        page,
        limit: pageSize,
        analytics: false,
        forceNetwork: true,
      });

      setResponses(resData.responses || []);
      setTotalCount(resData.pagination?.totalResponses || resData.responses?.length || 0);
    } catch (err) {
      console.error("[FollowUpResponsesTab] Error fetching follow-up responses:", err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFollowUpData();
  }, [activeChild, page, pageSize]);

  // Extract question headers from schema
  const questionsList = useMemo(() => {
    if (!childFormSchema) return [];
    const questions: Array<{ id: string; text: string }> = [];
    if (childFormSchema.sections && Array.isArray(childFormSchema.sections)) {
      childFormSchema.sections.forEach((sec: any) => {
        if (sec.questions && Array.isArray(sec.questions)) {
          sec.questions.forEach((q: any) => {
            // skip chassis question as it has its own dedicated column
            if (q.type !== "chassisNumber" && q.id !== "chassis_number") {
              questions.push({ id: q.id, text: q.text });
            }
          });
        }
      });
    }
    if (childFormSchema.followUpQuestions && Array.isArray(childFormSchema.followUpQuestions)) {
      childFormSchema.followUpQuestions.forEach((q: any) => {
        if (q.type !== "chassisNumber" && q.id !== "chassis_number") {
          questions.push({ id: q.id, text: q.text });
        }
      });
    }
    return questions;
  }, [childFormSchema]);

  // Extract chassis number helper
  const getChassis = (resp: Response): string => {
    const ans = resp.answers || {};
    const val =
      ans.chassis_number ||
      ans.chassisNumber ||
      ans.id_number ||
      ans.idNumber ||
      ans["Chassis / VIN"] ||
      ans["Chassis No"] ||
      ans["CHASSIS NUMBER"] ||
      ans["ID number"];
    if (!val) return "-";
    if (typeof val === "object") {
      return val.chassisNumber || JSON.stringify(val);
    }
    return String(val);
  };

  // Determine dynamic status
  const getDynamicStatus = (resp: Response) => {
    const rawStatus = (resp.status || "pending").toLowerCase();
    const ans = resp.answers || {};

    let hasDefect = false;
    let hasRework = false;

    Object.values(ans).forEach((v) => {
      if (typeof v === "string") {
        const lower = v.toLowerCase();
        if (lower === "no" || lower === "rejected" || lower === "not ok") hasDefect = true;
        if (lower === "rework") hasRework = true;
      }
    });

    if (hasDefect) return { label: "Rejected", bg: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800" };
    if (hasRework) return { label: "Rework", bg: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800" };
    if (rawStatus === "verified" || rawStatus === "accepted" || !hasDefect) {
      return { label: "Direct Ok", bg: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" };
    }
    return { label: "Direct Ok", bg: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" };
  };

  // Filtered responses based on search and status
  const filteredResponses = useMemo(() => {
    return responses.filter((r) => {
      const chassis = getChassis(r).toLowerCase();
      const submitter = (r.submittedBy || "").toLowerCase();
      const status = getDynamicStatus(r).label.toLowerCase();

      // Search matching
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const chassisMatch = chassis.includes(term);
        const submitterMatch = submitter.includes(term);
        const answersMatch = Object.values(r.answers || {}).some((v) =>
          String(v).toLowerCase().includes(term)
        );
        if (!chassisMatch && !submitterMatch && !answersMatch) return false;
      }

      // Status filter
      if (statusFilter !== "all") {
        if (status !== statusFilter.toLowerCase()) return false;
      }

      return true;
    });
  }, [responses, searchTerm, statusFilter]);

  // KPI Metrics
  const metrics = useMemo(() => {
    let directOk = 0;
    let rejected = 0;
    let rework = 0;

    responses.forEach((r) => {
      const st = getDynamicStatus(r).label;
      if (st === "Direct Ok") directOk++;
      else if (st === "Rejected") rejected++;
      else if (st === "Rework") rework++;
    });

    return {
      total: totalCount,
      directOk,
      rejected,
      rework,
    };
  }, [responses, totalCount]);

  // Handle Delete
  const handleDelete = async (responseId: string) => {
    if (!window.confirm("Are you sure you want to delete this follow-up response?")) return;
    try {
      setDeletingId(responseId);
      if (onDeleteResponse) {
        await onDeleteResponse(responseId);
      } else {
        await apiClient.deleteResponse(responseId);
      }
      setResponses((prev) => prev.filter((r) => (r.id || r._id) !== responseId));
      setTotalCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to delete follow-up response:", err);
      alert("Failed to delete response. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  // Export to Excel
  const handleExport = () => {
    try {
      setIsExporting(true);
      const rows = filteredResponses.map((r, idx) => {
        const rowData: Record<string, any> = {
          "S.No": idx + 1,
          "Response ID": r.id || r._id,
          "Submitted By": r.submittedBy || "Anonymous",
          "Status": getDynamicStatus(r).label,
          "Chassis Number": getChassis(r),
          "Timestamp": r.createdAt ? formatToDDMMYYYY(r.createdAt, true) : "-",
          "BIW Review": r.biwReview?.status || "Pending Review",
        };

        questionsList.forEach((q) => {
          const ans = r.answers?.[q.id];
          rowData[q.text] = typeof ans === "object" ? JSON.stringify(ans) : (ans ?? "-");
        });

        return rowData;
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Follow-up Responses");
      XLSX.writeFile(wb, `${activeChild?.formTitle || "Follow_Up_Responses"}.xlsx`);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-200">
      {/* ── Top Multi-Followup Tabs (if parent has multiple child forms) ── */}
      {childForms.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {childForms.map((cf: any, idx: number) => {
            const cfId = cf.formId || cf._id || cf.id;
            const isSelected = cfId === (activeChild?.formId || activeChild?._id || activeChild?.id);
            return (
              <button
                key={cfId || idx}
                onClick={() => {
                  setSelectedChildId(cfId);
                  setPage(1);
                }}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                  isSelected
                    ? "bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300 dark:ring-indigo-800"
                    : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
                }`}
              >
                <Reply className="w-3.5 h-3.5 rotate-180" />
                <span>{cf.formTitle || `Follow-up #${idx + 1}`}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                    isSelected
                      ? "bg-white/20 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                  }`}
                >
                  {cf.responseCount ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shrink-0">
            <Table className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate block">
              Follow-up Submissions
            </span>
            <div className="text-lg sm:text-2xl font-black text-gray-900 dark:text-white">
              {metrics.total}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/60 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 shrink-0">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 truncate block">
              Direct Ok / Accepted
            </span>
            <div className="text-lg sm:text-2xl font-black text-emerald-700 dark:text-emerald-400">
              {metrics.directOk}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-2xl border border-red-200/80 dark:border-red-800/60 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 shrink-0">
            <XCircle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-medium text-red-700 dark:text-red-400 truncate block">
              Rejected
            </span>
            <div className="text-lg sm:text-2xl font-black text-red-700 dark:text-red-400">
              {metrics.rejected}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-2xl border border-amber-200/80 dark:border-amber-800/60 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400 truncate block">
              Rework
            </span>
            <div className="text-lg sm:text-2xl font-black text-amber-700 dark:text-amber-400">
              {metrics.rework}
            </div>
          </div>
        </div>
      </div>

      {/* ── Card Container with Table Header & Controls ── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xs overflow-hidden">
        {/* Header Toolbar */}
        <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-gray-700 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Title & Sub-tab Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                  <Reply className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <span>{activeChild?.formTitle || "Follow-up Inspection Data"}</span>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/50">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                      </span>
                      Follow-up
                    </span>
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Showing {filteredResponses.length} of {totalCount} records submitted for this follow-up attempt
                  </p>
                </div>
              </div>

              {/* Toggle to Main Responses */}
              <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-700/60 rounded-xl border border-gray-200/80 dark:border-gray-600/80 w-fit">
                <button
                  type="button"
                  onClick={onSwitchToMainResponses}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-gray-800 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Table className="w-3.5 h-3.5" />
                  <span>Main Responses</span>
                </button>
                <button
                  type="button"
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-xs border border-gray-200 dark:border-gray-700 flex items-center gap-1.5 cursor-default"
                >
                  <Reply className="w-3.5 h-3.5" />
                  <span>Follow-up Responses ({totalCount})</span>
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const targetId = activeChild?.formId || activeChild?._id || activeChild?.id;
                  if (targetId) onNavigateToChildDashboard(targetId);
                }}
                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Follow-up Dashboard & Analytics ↗</span>
              </button>

              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting || filteredResponses.length === 0}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {isExporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>Export Excel</span>
              </button>

              <button
                type="button"
                onClick={() => fetchFollowUpData(false)}
                className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-all cursor-pointer"
                title="Refresh Data"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Search & Filter Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              {/* Search Bar */}
              <div className="relative flex items-center bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-xl shadow-xs w-full sm:w-64">
                <Search className="w-4 h-4 text-gray-400 mr-2 shrink-0" />
                <input
                  type="text"
                  placeholder="Search chassis, submitter, answers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-transparent text-xs text-gray-700 dark:text-gray-200 focus:outline-none w-full font-medium"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0 ml-1.5"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 rounded-xl shadow-xs">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-gray-700 dark:text-gray-200 focus:outline-none cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="direct ok">Direct Ok</option>
                  <option value="rejected">Rejected</option>
                  <option value="rework">Rework</option>
                </select>
              </div>

              {/* Page Size */}
              <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 rounded-xl shadow-xs">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Show:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="bg-transparent text-xs font-bold text-gray-700 dark:text-gray-200 focus:outline-none cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1 self-end sm:self-auto bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-1 py-1 rounded-xl shadow-xs">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 disabled:opacity-30 rounded-lg transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold text-gray-700 dark:text-gray-200 px-2">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 disabled:opacity-30 rounded-lg transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Table Content ── */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Loading follow-up responses...
              </p>
            </div>
          ) : filteredResponses.length === 0 ? (
            <div className="py-16 px-4 text-center flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-500 flex items-center justify-center">
                <Reply className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-gray-900 dark:text-white">
                No Follow-up Responses Found
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm">
                {searchTerm || statusFilter !== "all"
                  ? "No responses matched your search criteria. Try adjusting your filters."
                  : "No responses have been submitted to this follow-up form yet."}
              </p>
              {childForms.length > 0 && (
                <a
                  href={`/forms/${activeChild?.formId || activeChild?._id || activeChild?.id}/respond`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                >
                  <span>Submit New Follow-up Inspection</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-700 text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <th className="py-3.5 px-4 w-24">Actions</th>
                  <th className="py-3.5 px-4 min-w-[140px]">Submitted By</th>
                  <th className="py-3.5 px-4 min-w-[110px]">Status</th>
                  <th className="py-3.5 px-4 min-w-[140px]">Selected Chassis</th>
                  <th className="py-3.5 px-4 min-w-[160px]">Follow-up Attempt</th>
                  <th className="py-3.5 px-4 min-w-[160px]">Timestamp</th>
                  {questionsList.map((q) => (
                    <th key={q.id} className="py-3.5 px-4 min-w-[160px] truncate max-w-[220px]" title={q.text}>
                      {q.text}
                    </th>
                  ))}
                  <th className="py-3.5 px-4 min-w-[130px]">BIW Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-xs font-medium text-gray-700 dark:text-gray-200">
                {filteredResponses.map((row) => {
                  const statusInfo = getDynamicStatus(row);
                  const chassisVal = getChassis(row);
                  const rowId = row.id || row._id || "";

                  return (
                    <tr
                      key={rowId}
                      className="hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition-colors group"
                    >
                      {/* Actions */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onOpenResponseDetails(row)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition-colors cursor-pointer"
                            title="View Response Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(rowId)}
                            disabled={deletingId === rowId}
                            className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Response"
                          >
                            {deletingId === rowId ? (
                              <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Submitted By */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-[11px] shrink-0 shadow-2xs">
                            {(row.submittedBy || "A").charAt(0).toUpperCase()}
                          </div>
                          <span className="font-bold text-gray-900 dark:text-white truncate">
                            {row.submittedBy || "Anonymous"}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border shadow-2xs ${statusInfo.bg}`}
                        >
                          {statusInfo.label}
                        </span>
                      </td>

                      {/* Selected Chassis */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-bold text-gray-900 dark:text-white">
                          <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-700/80 rounded-lg border border-gray-200/80 dark:border-gray-600 flex items-center gap-1.5 text-xs">
                            <Hash className="w-3.5 h-3.5 text-indigo-500" />
                            {chassisVal}
                          </span>
                        </div>
                      </td>

                      {/* Follow-up Attempt */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 text-xs font-bold">
                          <Reply className="w-3.5 h-3.5" />
                          <span>Attempt #2: Follow-up</span>
                        </span>
                      </td>

                      {/* Timestamp */}
                      <td className="py-3 px-4 whitespace-nowrap text-xs text-gray-600 dark:text-gray-400">
                        {row.createdAt ? (
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-800 dark:text-gray-200">
                              {new Date(row.createdAt).toLocaleDateString()}
                            </span>
                            <span className="text-[11px] text-gray-400">
                              {new Date(row.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>

                      {/* Dynamic Question Answers */}
                      {questionsList.map((q) => {
                        const ans = row.answers?.[q.id];
                        const displayVal =
                          ans !== undefined && ans !== null
                            ? typeof ans === "object"
                              ? JSON.stringify(ans)
                              : String(ans)
                            : "-";

                        return (
                          <td
                            key={q.id}
                            className="py-3 px-4 text-xs text-gray-700 dark:text-gray-300 max-w-[220px] truncate"
                            title={displayVal}
                          >
                            <span className="font-semibold bg-gray-50 dark:bg-gray-800/80 px-2 py-1 rounded-md border border-gray-200/60 dark:border-gray-700">
                              {displayVal}
                            </span>
                          </td>
                        );
                      })}

                      {/* BIW Review */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {row.biwReview?.status ? (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              row.biwReview.status === "Accepted"
                                ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300"
                                : row.biwReview.status === "Rejected"
                                ? "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300"
                                : "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300"
                            }`}
                          >
                            {row.biwReview.status}
                          </span>
                        ) : (
                          <span className="text-gray-600 dark:text-gray-300 font-medium text-xs">No review yet</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
