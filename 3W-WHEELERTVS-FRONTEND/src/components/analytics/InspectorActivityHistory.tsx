import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Download,
  Search,
  Building2,
  Calendar,
  LogIn,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  Shield,
  Activity,
  ExternalLink,
  Filter,
  Check,
  X,
  Smartphone,
  Globe,
  Radio,
} from "lucide-react";
import * as XLSX from "xlsx";
import { apiClient } from "../../api/client";

interface LoginRecord {
  id: string;
  loginTime: string;
  logoutTime: string | null;
  ipAddress?: string;
  userAgent?: string;
  isActive: boolean;
}

interface InspectionRecord {
  id: string;
  type: "inspection";
  chassisNumber: string;
  formTitle: string;
  formId: string;
  status: string;
  isDispatched: boolean;
  timeTaken: string;
  timestamp: string;
}

interface TimelineItem {
  id: string;
  type: "login" | "inspection";
  timestamp: string;
  loginTime?: string;
  logoutTime?: string | null;
  isActive?: boolean;
  ipAddress?: string;
  userAgent?: string;
  chassisNumber?: string;
  formTitle?: string;
  formId?: string;
  status?: string;
  isDispatched?: boolean;
  timeTaken?: string;
}

interface InspectorData {
  userId: string;
  name: string;
  email: string;
  role: string;
  tenantId: string;
  tenantName: string;
  totalLogins: number;
  totalInspections: number;
  directOkCount: number;
  reworkCount: number;
  lastActiveTime: string | null;
  logins: LoginRecord[];
  inspections: InspectionRecord[];
  timeline: TimelineItem[];
}

interface TenantGroup {
  tenantId: string;
  tenantName: string;
  inspectors: InspectorData[];
}

interface ActivityHistoryResponse {
  dateRange: {
    startDate: string;
    endDate: string;
    days: number;
  };
  totalTenants: number;
  totalInspectors: number;
  totalLogins: number;
  totalInspections: number;
  tenants: TenantGroup[];
}

export const InspectorActivityHistory: React.FC = () => {
  const [data, setData] = useState<ActivityHistoryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter controls
  const [daysFilter, setDaysFilter] = useState<number>(3);
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [useCustomDates, setUseCustomDates] = useState<boolean>(false);

  // Tenant selection & Search
  const [selectedTenantId, setSelectedTenantId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<"inspectors" | "stream">("inspectors");
  const [expandedInspectors, setExpandedInspectors] = useState<Record<string, boolean>>({});
  const [activeInspectorSubTab, setActiveInspectorSubTab] = useState<
    Record<string, "inspections" | "logins" | "timeline">
  >({});

  // Fetch activity history
  const fetchData = async (force: boolean = false) => {
    try {
      setLoading(true);
      setError(null);

      const params: any = { forceNetwork: force };
      if (useCustomDates && customStartDate && customEndDate) {
        params.startDate = customStartDate;
        params.endDate = customEndDate;
      } else {
        params.days = daysFilter;
      }

      const res = await apiClient.getInspectorActivityHistory(params);
      if (res && res.data) {
        setData(res.data);
      } else if (res && res.tenants) {
        setData(res);
      } else {
        setError("Failed to load inspector activity history");
      }
    } catch (err: any) {
      console.error("Error fetching inspector activity history:", err);
      setError(err?.message || "Error fetching inspector activity history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [daysFilter, useCustomDates]);

  // Handle custom date apply
  const handleApplyCustomDates = () => {
    if (!customStartDate || !customEndDate) return;
    setUseCustomDates(true);
    fetchData(true);
  };

  // Toggle inspector expand
  const toggleInspectorExpand = (userId: string) => {
    setExpandedInspectors((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  const setInspectorSubTab = (userId: string, tab: "inspections" | "logins" | "timeline") => {
    setActiveInspectorSubTab((prev) => ({
      ...prev,
      [userId]: tab,
    }));
  };

  // Filter tenants and inspectors based on UI selections
  const filteredTenants = useMemo(() => {
    if (!data?.tenants || !Array.isArray(data.tenants)) return [];

    let groups = data.tenants;

    // Filter by tenant
    if (selectedTenantId !== "all") {
      groups = groups.filter((g) => g.tenantId === selectedTenantId);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      groups = groups
        .map((group) => {
          const matchingInspectors = (group.inspectors || []).filter((insp) => {
            const matchName = (insp.name || "").toLowerCase().includes(q);
            const matchEmail = (insp.email || "").toLowerCase().includes(q);
            const inspList = insp.inspections || (insp as any).actions || [];
            const matchForm = inspList.some((i: any) =>
              (i.formTitle || "").toLowerCase().includes(q)
            );
            const matchChassis = inspList.some((i: any) =>
              (i.chassisNumber || "").toLowerCase().includes(q)
            );
            return matchName || matchEmail || matchForm || matchChassis;
          });
          return {
            ...group,
            inspectors: matchingInspectors,
          };
        })
        .filter((group) => (group.inspectors || []).length > 0);
    }

    return groups;
  }, [data, selectedTenantId, searchQuery]);

  // Aggregate metrics
  const aggregateMetrics = useMemo(() => {
    if (!data?.tenants || !Array.isArray(data.tenants)) {
      return {
        totalTenants: 0,
        totalInspectors: 0,
        totalLogins: 0,
        totalInspections: 0,
        directOkCount: 0,
        reworkCount: 0,
      };
    }

    let totalInspectors = 0;
    let totalLogins = 0;
    let totalInspections = 0;
    let directOkCount = 0;
    let reworkCount = 0;

    data.tenants.forEach((tenant) => {
      (tenant.inspectors || []).forEach((insp) => {
        totalInspectors += 1;
        totalLogins += insp.totalLogins || 0;
        totalInspections += insp.totalInspections || (insp as any).totalDone || 0;
        directOkCount += insp.directOkCount || 0;
        reworkCount += insp.reworkCount || 0;
      });
    });

    return {
      totalTenants: data.tenants.length,
      totalInspectors,
      totalLogins,
      totalInspections,
      directOkCount,
      reworkCount,
    };
  }, [data]);

  // Master chronological stream across selected tenants
  const masterStream = useMemo(() => {
    const events: Array<TimelineItem & { inspectorName: string; tenantName: string; role: string }> = [];

    (filteredTenants || []).forEach((group) => {
      (group.inspectors || []).forEach((insp) => {
        const timelineItems = insp.timeline || [];
        timelineItems.forEach((item) => {
          events.push({
            ...item,
            inspectorName: insp.name,
            tenantName: group.tenantName,
            role: insp.role,
          });
        });
      });
    });

    return events.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [filteredTenants]);

  // Export to Excel
  const handleExportToExcel = () => {
    if (!data?.tenants || !Array.isArray(data.tenants)) return;

    // 1. Inspector Summary sheet
    const summaryRows: any[] = [];
    // 2. Inspections Done sheet
    const inspectionsRows: any[] = [];
    // 3. Logins sheet
    const loginsRows: any[] = [];

    data.tenants.forEach((group) => {
      (group.inspectors || []).forEach((insp) => {
        summaryRows.push({
          Plant: group.tenantName,
          "Inspector Name": insp.name,
          Email: insp.email,
          Role: insp.role,
          "Total Logins": insp.totalLogins || 0,
          "Total Inspections": insp.totalInspections || (insp as any).totalDone || 0,
          "Direct Ok": insp.directOkCount || 0,
          Rework: insp.reworkCount || 0,
          "Last Active": insp.lastActiveTime
            ? new Date(insp.lastActiveTime).toLocaleString()
            : "-",
        });

        const inspList = insp.inspections || (insp as any).actions || [];
        inspList.forEach((item: any) => {
          inspectionsRows.push({
            Timestamp: new Date(item.timestamp).toLocaleString(),
            Plant: group.tenantName,
            Inspector: insp.name,
            "Form Name": item.formTitle,
            "Chassis / VIN": item.chassisNumber,
            Status: item.status,
            Dispatched: item.isDispatched ? "Yes" : "No",
            "Time Taken": item.timeTaken || "-",
          });
        });

        (insp.logins || []).forEach((log: any) => {
          loginsRows.push({
            "Login Time": new Date(log.loginTime).toLocaleString(),
            "Logout Time": log.logoutTime
              ? new Date(log.logoutTime).toLocaleString()
              : log.isActive
              ? "Active Now"
              : "-",
            Plant: group.tenantName,
            Inspector: insp.name,
            "IP Address": log.ipAddress || "-",
            "User Agent / Device": log.userAgent || "-",
            "Status": log.isActive ? "Active" : "Logged Out",
          });
        });
      });
    });

    const wb = XLSX.utils.book_new();
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    const wsInspections = XLSX.utils.json_to_sheet(inspectionsRows);
    const wsLogins = XLSX.utils.json_to_sheet(loginsRows);

    XLSX.utils.book_append_sheet(wb, wsSummary, "Inspector Summary");
    XLSX.utils.book_append_sheet(wb, wsInspections, "Inspections (What Done)");
    XLSX.utils.book_append_sheet(wb, wsLogins, "Login History (Who Logged)");

    const fileName = `Inspector_Activity_History_${daysFilter}Days_${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const formatDateTime = (ts?: string | null) => {
    if (!ts) return "-";
    try {
      const d = new Date(ts);
      return d.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return ts;
    }
  };

  const getStatusBadge = (status?: string) => {
    const s = (status || "").toLowerCase();
    if (s.includes("direct ok") || s === "accepted" || s === "ok") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          {status}
        </span>
      );
    }
    if (s.includes("rework accepted")) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          {status}
        </span>
      );
    }
    if (s.includes("rework")) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
          <AlertTriangle className="w-3 h-3 mr-1" />
          {status}
        </span>
      );
    }
    if (s.includes("reject")) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
          <X className="w-3 h-3 mr-1" />
          {status}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
        {status || "Pending"}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* ── Top Header Controls ──────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                <Users className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Inspector Activity History
              </h2>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                Tenant-Wise Audit
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Live audit trail of inspector logins, shifts, and inspection submissions across all plants.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* 3-Day Preset Filter Pills */}
            <div className="inline-flex rounded-lg p-1 bg-gray-100 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 text-xs font-semibold">
              <button
                onClick={() => {
                  setUseCustomDates(false);
                  setDaysFilter(3);
                }}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  !useCustomDates && daysFilter === 3
                    ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-900"
                }`}
              >
                Last 3 Days
              </button>
              <button
                onClick={() => {
                  setUseCustomDates(false);
                  setDaysFilter(1);
                }}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  !useCustomDates && daysFilter === 1
                    ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-900"
                }`}
              >
                Today
              </button>
              <button
                onClick={() => {
                  setUseCustomDates(false);
                  setDaysFilter(2);
                }}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  !useCustomDates && daysFilter === 2
                    ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-900"
                }`}
              >
                Last 2 Days
              </button>
              <button
                onClick={() => {
                  setUseCustomDates(false);
                  setDaysFilter(7);
                }}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  !useCustomDates && daysFilter === 7
                    ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-900"
                }`}
              >
                7 Days
              </button>
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => fetchData(true)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              title="Refresh activity logs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-600" : ""}`} />
              Refresh
            </button>

            {/* Excel Export Button */}
            <button
              onClick={handleExportToExcel}
              disabled={loading || !data?.tenants?.length}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              Export to Excel
            </button>
          </div>
        </div>

        {/* Custom date range expander */}
        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="font-medium">Active Window:</span>
            <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded font-mono">
              {data?.dateRange?.startDate
                ? formatDateTime(data.dateRange.startDate)
                : "-"}{" "}
              to{" "}
              {data?.dateRange?.endDate
                ? formatDateTime(data.dateRange.endDate)
                : "-"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-gray-500 dark:text-gray-400">Custom Dates:</label>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
            <button
              onClick={handleApplyCustomDates}
              className="px-2.5 py-1 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition"
            >
              Apply
            </button>
          </div>
        </div>
      </div>

      {/* ── Summary Metric Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
              Plants / Tenants
            </span>
            <Building2 className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {aggregateMetrics.totalTenants}
            </span>
            <span className="text-xs text-gray-500">active</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
              Inspectors Logged
            </span>
            <Users className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {aggregateMetrics.totalInspectors}
            </span>
            <span className="text-xs text-gray-500">staff</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
              Total Logins
            </span>
            <LogIn className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {aggregateMetrics.totalLogins}
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              sessions
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
              Inspections Done
            </span>
            <ClipboardList className="w-4 h-4 text-purple-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {aggregateMetrics.totalInspections}
            </span>
            <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
              units
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
              Direct OK
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {aggregateMetrics.directOkCount}
            </span>
            <span className="text-xs text-gray-500">
              {aggregateMetrics.totalInspections > 0
                ? `${Math.round(
                    (aggregateMetrics.directOkCount /
                      aggregateMetrics.totalInspections) *
                      100
                  )}%`
                : "0%"}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
              Rework / Defect
            </span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {aggregateMetrics.reworkCount}
            </span>
            <span className="text-xs text-gray-500">units</span>
          </div>
        </div>
      </div>

      {/* ── Tenant Selector Tabs & Search ────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Tenant selection tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            <button
              onClick={() => setSelectedTenantId("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                selectedTenantId === "all"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300 hover:bg-gray-200"
              }`}
            >
              All Plants ({data?.tenants?.length || 0})
            </button>
            {data?.tenants?.map((tenant) => (
              <button
                key={tenant.tenantId}
                onClick={() => setSelectedTenantId(tenant.tenantId)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  selectedTenantId === tenant.tenantId
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300 hover:bg-gray-200"
                }`}
              >
                <span>{tenant.tenantName}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    selectedTenantId === tenant.tenantId
                      ? "bg-white/20 text-white"
                      : "bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300"
                  }`}
                >
                  {tenant.inspectors?.length || 0}
                </span>
              </button>
            ))}
          </div>

          {/* Search bar & View toggle */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search inspector, form, chassis..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* View mode toggle */}
            <div className="inline-flex rounded-lg p-0.5 bg-gray-100 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 text-xs">
              <button
                onClick={() => setViewMode("inspectors")}
                className={`px-2.5 py-1 rounded font-medium transition ${
                  viewMode === "inspectors"
                    ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-gray-600 dark:text-gray-300"
                }`}
                title="View grouped by inspector"
              >
                Inspectors
              </button>
              <button
                onClick={() => setViewMode("stream")}
                className={`px-2.5 py-1 rounded font-medium transition ${
                  viewMode === "stream"
                    ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-gray-600 dark:text-gray-300"
                }`}
                title="View unified chronological activity timeline"
              >
                Time Stream
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content Area ────────────────────────────────────────────────── */}
      {loading ? (
        <div className="py-20 text-center bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Loading Inspector Activity History...
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Analyzing logins and inspection submissions for the last {daysFilter} days.
          </p>
        </div>
      ) : error ? (
        <div className="p-6 text-center bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <AlertTriangle className="w-8 h-8 text-red-600 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-red-900 dark:text-red-200">
            {error}
          </h3>
          <button
            onClick={() => fetchData(true)}
            className="mt-3 px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      ) : filteredTenants.length === 0 ? (
        <div className="py-16 text-center bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <Users className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            No Inspector Activity Found
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto mt-1">
            No logins or inspections match the selected date window or search query.
          </p>
        </div>
      ) : viewMode === "stream" ? (
        /* ════════════════════════════════════════════════════════════════════
           TIME-WISE MASTER STREAM VIEW
        ════════════════════════════════════════════════════════════════════ */
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-700 mb-6">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Chronological Activity Stream ({masterStream.length} Events)
              </h3>
            </div>
            <span className="text-xs text-gray-500">
              Sorted newest to oldest
            </span>
          </div>

          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-gray-200 dark:before:bg-gray-700">
            {masterStream.map((item, idx) => {
              const isInspection = item.type === "inspection";
              return (
                <div key={item.id || idx} className="relative group">
                  {/* Timeline icon dot */}
                  <div
                    className={`absolute -left-6 top-1.5 w-5 h-5 rounded-full flex items-center justify-center ring-4 ring-white dark:ring-gray-800 ${
                      isInspection
                        ? "bg-purple-600 text-white"
                        : item.isActive
                        ? "bg-emerald-500 text-white animate-pulse"
                        : "bg-blue-600 text-white"
                    }`}
                  >
                    {isInspection ? (
                      <ClipboardList className="w-3 h-3" />
                    ) : (
                      <LogIn className="w-3 h-3" />
                    )}
                  </div>

                  {/* Event card */}
                  <div className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-3.5 border border-gray-200/70 dark:border-gray-600/60 hover:border-blue-300 dark:hover:border-blue-500/50 transition">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-xs text-gray-900 dark:text-white">
                          {item.inspectorName}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300">
                          {item.tenantName}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                          {item.role}
                        </span>
                        {isInspection ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                            Inspection Submission
                          </span>
                        ) : (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.isActive
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                                : "bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300"
                            }`}
                          >
                            {item.isActive ? "Active Login Session" : "User Login"}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        <span>{formatDateTime(item.timestamp)}</span>
                      </div>
                    </div>

                    {/* Details body */}
                    {isInspection ? (
                      <div className="mt-2.5 pt-2 border-t border-gray-200/60 dark:border-gray-600/50 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            Form:
                          </span>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {item.formTitle}
                          </span>
                          <span className="text-gray-400">•</span>
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            Chassis / VIN:
                          </span>
                          <span className="font-mono bg-white dark:bg-gray-800 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white">
                            {item.chassisNumber}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {getStatusBadge(item.status)}
                          {item.isDispatched && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400">
                              Dispatched
                            </span>
                          )}
                          {item.timeTaken && item.timeTaken !== "-" && (
                            <span className="text-[11px] text-gray-500 font-mono">
                              ⏱ {item.timeTaken}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2.5 pt-2 border-t border-gray-200/60 dark:border-gray-600/50 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1 font-mono text-[11px]">
                            <Globe className="w-3.5 h-3.5 text-gray-400" />
                            <span>IP: {item.ipAddress || "127.0.0.1"}</span>
                          </div>
                          {item.logoutTime && (
                            <span className="text-gray-500 text-[11px]">
                              Logged out: {formatDateTime(item.logoutTime)}
                            </span>
                          )}
                        </div>
                        {item.userAgent && (
                          <div className="text-[10px] text-gray-400 truncate max-w-xs">
                            {item.userAgent}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ════════════════════════════════════════════════════════════════════
           INSPECTOR-CENTRIC TENANT-WISE VIEW
        ════════════════════════════════════════════════════════════════════ */
        <div className="space-y-6">
          {filteredTenants.map((group) => (
            <div
              key={group.tenantId}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              {/* Plant / Tenant Header */}
              <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Building2 className="w-5 h-5 text-blue-300" />
                  <h3 className="text-base font-bold tracking-wide">
                    {group.tenantName}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-white">
                    {(group.inspectors || []).length} Staff Logged
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <span>
                    Total Logins:{" "}
                    <strong className="text-blue-200">
                      {(group.inspectors || []).reduce(
                        (acc, i) => acc + (i.totalLogins || 0),
                        0
                      )}
                    </strong>
                  </span>
                  <span>•</span>
                  <span>
                    Inspections:{" "}
                    <strong className="text-emerald-300">
                      {(group.inspectors || []).reduce(
                        (acc, i) => acc + (i.totalInspections || (i as any).totalDone || 0),
                        0
                      )}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Inspectors List */}
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {(group.inspectors || []).map((insp) => {
                  const isExpanded = !!expandedInspectors[insp.userId];
                  const subTab = activeInspectorSubTab[insp.userId] || "inspections";
                  const hasActiveLogin = (insp.logins || []).some((l) => l.isActive);
                  const inspList = insp.inspections || (insp as any).actions || [];
                  const loginsList = insp.logins || [];
                  const timelineList = insp.timeline || [];

                  return (
                    <div
                      key={insp.userId}
                      className="transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-700/20"
                    >
                      {/* Inspector Row Card Header */}
                      <div
                        onClick={() => toggleInspectorExpand(insp.userId)}
                        className="p-4 cursor-pointer flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                      >
                        {/* Profile Info */}
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center text-sm shadow-inner">
                              {(insp.name || "U")
                                .split(" ")
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join("")
                                .toUpperCase()}
                            </div>
                            {hasActiveLogin && (
                              <span
                                className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-gray-800"
                                title="Active session right now"
                              />
                            )}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                                {insp.name}
                              </h4>
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                {insp.role}
                              </span>
                              {hasActiveLogin && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                                  Online
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {insp.email}
                            </p>
                          </div>
                        </div>

                        {/* Inspector Activity Stats */}
                        <div className="flex items-center gap-3 lg:gap-6 flex-wrap">
                          <div className="text-left lg:text-right">
                            <span className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold block">
                              Logins
                            </span>
                            <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                              {insp.totalLogins || loginsList.length} sessions
                            </span>
                          </div>

                          <div className="text-left lg:text-right">
                            <span className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold block">
                              Inspections
                            </span>
                            <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                              {insp.totalInspections || (insp as any).totalDone || inspList.length} done
                            </span>
                          </div>

                          <div className="text-left lg:text-right">
                            <span className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold block">
                              Pass / Rework
                            </span>
                            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                {insp.directOkCount || 0} OK
                              </span>
                              {" / "}
                              <span className="text-amber-600 dark:text-amber-400 font-bold">
                                {insp.reworkCount || 0} Rew
                              </span>
                            </span>
                          </div>

                          <div className="text-left lg:text-right hidden sm:block">
                            <span className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold block">
                              Last Active
                            </span>
                            <span className="text-xs font-mono text-gray-600 dark:text-gray-400">
                              {formatDateTime(insp.lastActiveTime)}
                            </span>
                          </div>

                          {/* Expand chevron */}
                          <div className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 transition">
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5" />
                            ) : (
                              <ChevronDown className="w-5 h-5" />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* ── Expanded Drawer for this Inspector ── */}
                      {isExpanded && (
                        <div className="bg-gray-50/80 dark:bg-gray-900/50 p-4 border-t border-gray-100 dark:border-gray-700">
                          {/* Sub-tab selection */}
                          <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() =>
                                  setInspectorSubTab(insp.userId, "inspections")
                                }
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                                  subTab === "inspections"
                                    ? "bg-blue-600 text-white shadow-sm"
                                    : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100"
                                }`}
                              >
                                Inspections ({inspList.length})
                              </button>
                              <button
                                onClick={() =>
                                  setInspectorSubTab(insp.userId, "logins")
                                }
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                                  subTab === "logins"
                                    ? "bg-blue-600 text-white shadow-sm"
                                    : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100"
                                }`}
                              >
                                Logins ({loginsList.length})
                              </button>
                              <button
                                onClick={() =>
                                  setInspectorSubTab(insp.userId, "timeline")
                                }
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                                  subTab === "timeline"
                                    ? "bg-blue-600 text-white shadow-sm"
                                    : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100"
                                }`}
                              >
                                Time-Wise ({timelineList.length})
                              </button>
                            </div>

                            <span className="text-[11px] text-gray-400">
                              Showing 3-day history
                            </span>
                          </div>

                          {/* Sub-tab 1: Inspections (What Done) */}
                          {subTab === "inspections" && (
                            <div>
                              {inspList.length === 0 ? (
                                <p className="text-xs text-gray-500 py-4 text-center">
                                  No inspection submissions recorded in this time window.
                                </p>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs text-left">
                                    <thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 uppercase font-semibold text-[10px]">
                                      <tr>
                                        <th className="px-3 py-2">Timestamp</th>
                                        <th className="px-3 py-2">Form Title</th>
                                        <th className="px-3 py-2">Chassis / VIN</th>
                                        <th className="px-3 py-2">Status</th>
                                        <th className="px-3 py-2">Dispatch</th>
                                        <th className="px-3 py-2">Time Taken</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                      {inspList.map((row: any) => (
                                        <tr
                                          key={row.id}
                                          className="hover:bg-white dark:hover:bg-gray-800/60"
                                        >
                                          <td className="px-3 py-2 font-mono text-gray-500">
                                            {formatDateTime(row.timestamp)}
                                          </td>
                                          <td className="px-3 py-2 font-semibold text-gray-900 dark:text-white">
                                            {row.formTitle}
                                          </td>
                                          <td className="px-3 py-2 font-mono">
                                            <span className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-600">
                                              {row.chassisNumber}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2">
                                            {getStatusBadge(row.status)}
                                          </td>
                                          <td className="px-3 py-2">
                                            {row.isDispatched ? (
                                              <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                                                ✓ Dispatched
                                              </span>
                                            ) : (
                                              <span className="text-gray-400">-</span>
                                            )}
                                          </td>
                                          <td className="px-3 py-2 font-mono text-gray-500">
                                            {row.timeTaken || "-"}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Sub-tab 2: Logins (Who Logged) */}
                          {subTab === "logins" && (
                            <div>
                              {loginsList.length === 0 ? (
                                <p className="text-xs text-gray-500 py-4 text-center">
                                  No login records found for this period.
                                </p>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs text-left">
                                    <thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 uppercase font-semibold text-[10px]">
                                      <tr>
                                        <th className="px-3 py-2">Login Time</th>
                                        <th className="px-3 py-2">Logout Time</th>
                                        <th className="px-3 py-2">Session Status</th>
                                        <th className="px-3 py-2">IP Address</th>
                                        <th className="px-3 py-2">Device / Browser</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                      {loginsList.map((log: any) => (
                                        <tr
                                          key={log.id}
                                          className="hover:bg-white dark:hover:bg-gray-800/60"
                                        >
                                          <td className="px-3 py-2 font-mono text-gray-800 dark:text-gray-200">
                                            {formatDateTime(log.loginTime)}
                                          </td>
                                          <td className="px-3 py-2 font-mono text-gray-500">
                                            {log.logoutTime
                                              ? formatDateTime(log.logoutTime)
                                              : log.isActive
                                              ? "Active Now"
                                              : "-"}
                                          </td>
                                          <td className="px-3 py-2">
                                            {log.isActive ? (
                                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                                                Active Session
                                              </span>
                                            ) : (
                                              <span className="text-gray-400">
                                                Completed
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-3 py-2 font-mono text-gray-600 dark:text-gray-400">
                                            {log.ipAddress || "127.0.0.1"}
                                          </td>
                                          <td className="px-3 py-2 text-gray-500 max-w-xs truncate text-[11px]">
                                            {log.userAgent || "-"}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Sub-tab 3: Inspector Time-Wise Timeline */}
                          {subTab === "timeline" && (
                            <div className="relative pl-5 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200 dark:before:bg-gray-700 pt-2">
                              {timelineList.map((evt: any, eIdx: number) => {
                                const isInsp = evt.type === "inspection";
                                return (
                                  <div key={evt.id || eIdx} className="relative">
                                    <div
                                      className={`absolute -left-5 top-1 w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-gray-800 ${
                                        isInsp
                                          ? "bg-purple-600 text-white"
                                          : evt.isActive
                                          ? "bg-emerald-500 text-white"
                                          : "bg-blue-600 text-white"
                                      }`}
                                    >
                                      {isInsp ? (
                                        <ClipboardList className="w-2.5 h-2.5" />
                                      ) : (
                                        <LogIn className="w-2.5 h-2.5" />
                                      )}
                                    </div>

                                    <div className="bg-white dark:bg-gray-800 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs">
                                      <div className="flex items-center justify-between">
                                        <span className="font-semibold text-gray-900 dark:text-white">
                                          {isInsp
                                            ? `Inspection: ${evt.formTitle}`
                                            : `User Login ${
                                                evt.isActive ? "(Active)" : ""
                                              }`}
                                        </span>
                                        <span className="text-[11px] font-mono text-gray-500">
                                          {formatDateTime(evt.timestamp)}
                                        </span>
                                      </div>

                                      {isInsp ? (
                                        <div className="mt-1 flex items-center gap-2">
                                          <span className="text-gray-500">
                                            Chassis:{" "}
                                            <strong className="text-gray-800 dark:text-gray-200">
                                              {evt.chassisNumber}
                                            </strong>
                                          </span>
                                          <span>•</span>
                                          {getStatusBadge(evt.status)}
                                        </div>
                                      ) : (
                                        <div className="mt-1 text-gray-500 text-[11px]">
                                          IP: {evt.ipAddress || "127.0.0.1"} •{" "}
                                          {evt.logoutTime
                                            ? `Logged out at ${formatDateTime(
                                                evt.logoutTime
                                              )}`
                                            : evt.isActive
                                            ? "Currently Active"
                                            : "Session ended"}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default InspectorActivityHistory;
