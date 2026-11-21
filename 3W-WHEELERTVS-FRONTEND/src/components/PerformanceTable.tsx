// PerformanceTable.tsx - Optimized Version
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { useAuth } from "../context/AuthContext";
import { apiClient } from "../api/client";
import { Users, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Loader2, Info, Search, X, ArrowUp, ArrowDown, ArrowUpDown, Calendar } from "lucide-react";
import PerformanceGuideModal from "./analytics/PerformanceGuideModal";

const PerformanceTable = ({
  useInternalTrackingEndpoint = false,
  startDate,
  endDate,
  formId,
  formIds,
  title,
}: {
  useInternalTrackingEndpoint?: boolean;
  startDate?: string;
  endDate?: string;
  formId?: string;
  formIds?: string[];
  title?: string;
}) => {
  const { user } = useAuth();
  const [performanceTableData, setPerformanceTableData] = useState<any[]>([]);
  const [performanceTableLoading, setPerformanceTableLoading] = useState(false);
  const [showPerformanceGuide, setShowPerformanceGuide] = useState(false);

  // ✅ Bind strictly to Top Date Filter (startDate & endDate props)
  const effectiveStartDate = useMemo(() => {
    if (startDate) return startDate.includes("T") ? startDate.split("T")[0] : startDate;
    if (startDate === undefined && endDate === undefined && !formId && !formIds) {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d.toISOString().split("T")[0];
    }
    return "";
  }, [startDate, endDate, formId, formIds]);

  const effectiveEndDate = useMemo(() => {
    if (endDate) return endDate.includes("T") ? endDate.split("T")[0] : endDate;
    if (startDate === undefined && endDate === undefined && !formId && !formIds) {
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
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Group by Plant / Tenant states (Excel Pivot style)
  const [viewMode, setViewMode] = useState<"grouped" | "flat">("grouped");
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
    return `perf_v4_${fKey}_${effectiveStartDate}_${effectiveEndDate}_${performancePage}_${performancePageSize}`;
  }, [formId, formIds, effectiveStartDate, effectiveEndDate, performancePage, performancePageSize]);

  // ✅ Load performance data with caching and timeout
  const loadPerformanceData = useCallback(async () => {
    if (!showPerformanceTable || !user) return;

    // Allow admins, superadmins, subadmins, tenant admins, managers, and inspectors
    const allowedRoles = ["admin", "superadmin", "subadmin", "tenant_admin", "manager", "staff", "inspector"];
    if (!useInternalTrackingEndpoint && !allowedRoles.includes(user.role)) {
      return;
    }

    // ✅ Check cache first
    const cacheKey = getCacheKey();
    const cachedData = sessionStorage.getItem(cacheKey);
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        const cacheAge = Date.now() - (parsed.timestamp || 0);
        if (cacheAge < 120000) {
          let cachedList = parsed.data || [];
          if (cachedList && !Array.isArray(cachedList) && Array.isArray((cachedList as any).data)) {
            cachedList = (cachedList as any).data;
          }
          if (Array.isArray(cachedList) && cachedList.length > 0) {
            console.log('[PerformanceTable] Using cached data:', cachedList.length);
            setPerformanceTableData(cachedList);
            setPerfInspectorSummary(parsed.inspectorSummary || []);
            setActiveUserNames(new Set(parsed.activeUserNames || []));
            setPerformanceTableLoading(false);
            return;
          }
        }
      } catch (e) {
        // Cache parse error, continue to fetch
      }
    }

    setPerformanceTableLoading(true);

    try {
      // ✅ Build the API call with date parameters
      let tableResponse: any;

      if (useInternalTrackingEndpoint) {
        // Internal tracking endpoint
        tableResponse = await apiClient.get(
          `/internal-tracking/performance?startDate=${effectiveStartDate}&endDate=${effectiveEndDate}&page=${performancePage}&limit=${performancePageSize}`
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

      console.log('[PerformanceTable] Table data loaded:', tableData.length);

      // Set the table data and unblock loading IMMEDIATELY!
      setPerformanceTableData(tableData);
      setPerformanceTableLoading(false);

      // Cache the immediate result so switches are instant
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

      if (user.role === "admin" || user.role === "superadmin") {
        apiClient.get(`/analytics/inspector-summary?startDate=${effectiveStartDate}&endDate=${effectiveEndDate}${inspQuery}`)
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
      } else {
        setPerformanceTableData([]);
        setPerfInspectorSummary([]);
        setActiveUserNames(new Set());
      }
    } finally {
      setPerformanceTableLoading(false);
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

  // Only load when showPerformanceTable is true
  useEffect(() => {
    if (showPerformanceTable) {
      loadPerformanceData();
    }
  }, [loadPerformanceData, showPerformanceTable]);

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
  const STANDARD_STATUSES = useMemo(() => ["Direct Ok", "Rework QC Completed", "Rework QC Pending", "Rejected", "Dispatched"], []);

  // Computed values
  const performanceStatuses = useMemo(() => {
    const isNumeric = (str: string) => /^\d+$/.test(str);
    const statuses = Array.from(
      new Set([
        ...STANDARD_STATUSES,
        ...perfInspectorSummary.flatMap((item: any) =>
          Object.keys(item.statusCounts || {}),
        ),
      ]),
    );
    return statuses.filter(status => !isNumeric(status));
  }, [STANDARD_STATUSES, perfInspectorSummary]);

  // Filter data by inspector / user search term
  const filteredData = useMemo(() => {
    let data = [...performanceTableData];
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
  }, [performanceTableData, searchTerm]);

  const {
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
    avgPerformance,
    statusTotals,
    totalDirectOk,
    totalReworkQCCompleted,
    totalDispatchPending,
    totalReviewPending,
  } = useMemo(() => {
    const inspectorStatusMap: Record<string, Record<string, number>> = {};
    perfInspectorSummary.forEach((item: any) => {
      const name = item.qcInspector;
      if (!name) return;
      if (!inspectorStatusMap[name]) inspectorStatusMap[name] = {};
      Object.entries(item.statusCounts || {}).forEach(([status, count]) => {
        inspectorStatusMap[name][status] =
          (inspectorStatusMap[name][status] || 0) + (count as number);
      });
    });

    const getUserTotalSubmitted = (rowName: string, backendTotal: number) => {
      const directOk = inspectorStatusMap[rowName]?.["Direct Ok"] || 0;
      const reworkCompleted = inspectorStatusMap[rowName]?.["Rework QC Completed"] || 0;
      const reworkPending = inspectorStatusMap[rowName]?.["Rework QC Pending"] || 0;
      const rejected = inspectorStatusMap[rowName]?.["Rejected"] || 0;
      const statusSum = directOk + reworkCompleted + reworkPending + rejected;
      return Math.max(backendTotal || 0, statusSum);
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

          case "Direct Ok":
            valA = a.directOk ?? inspectorStatusMap[a.name]?.["Direct Ok"] ?? 0;
            valB = b.directOk ?? inspectorStatusMap[b.name]?.["Direct Ok"] ?? 0;
            break;

          case "Rework QC Completed":
            valA = a.reworkQcCompleted ?? inspectorStatusMap[a.name]?.["Rework QC Completed"] ?? 0;
            valB = b.reworkQcCompleted ?? inspectorStatusMap[b.name]?.["Rework QC Completed"] ?? 0;
            break;

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
            valA = Math.max(0, (a.directOk || 0) + (a.reworkQcCompleted || 0) - dispA);
            valB = Math.max(0, (b.directOk || 0) + (b.reworkQcCompleted || 0) - dispB);
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
            const subA = getUserTotalSubmitted(a.name, a.totalSubmitted || 0);
            const subB = getUserTotalSubmitted(b.name, b.totalSubmitted || 0);
            valA = a.tvsReviewPending ?? Math.max(0, subA - (a.tvsTotalReviewed ?? 0));
            valB = b.tvsReviewPending ?? Math.max(0, subB - (b.tvsTotalReviewed ?? 0));
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
      (sum, row) =>
        sum + (inspectorStatusMap[row.name]?.["Dispatched"] || 0),
      0,
    );

    const totalTotalSubmitted = filteredData.reduce(
      (sum, row) => sum + getUserTotalSubmitted(row.name, row.totalSubmitted || 0),
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
    performanceStatuses
      .filter((s) => s !== "Dispatched")
      .forEach((status) => {
        statusTotals[status] = filteredData.reduce(
          (sum, row) =>
            sum + (inspectorStatusMap[row.name]?.[status] || 0),
          0,
        );
      });

    const totalDirectOk = filteredData.reduce(
      (sum, row) =>
        sum + (inspectorStatusMap[row.name]?.["Direct Ok"] || row.directOk || 0),
      0,
    );
    const totalReworkQCCompleted = filteredData.reduce(
      (sum, row) =>
        sum +
        (inspectorStatusMap[row.name]?.["Rework QC Completed"] ||
          row.reworkQcCompleted ||
          0),
      0,
    );
    const totalDispatchPending = Math.max(
      0,
      totalDirectOk + totalReworkQCCompleted - totalDispatched,
    );
    const totalReviewPending = Math.max(
      0,
      totalDispatched - totalTotalReviewed,
    );

    const totalTvsReviewed = filteredData.reduce(
      (sum, row) => sum + (row.tvsTotalReviewed || 0),
      0,
    );
    const totalTvsReviewPending = filteredData.reduce(
      (sum, row) => {
        const sub = getUserTotalSubmitted(row.name, row.totalSubmitted || 0);
        return sum + (row.tvsReviewPending ?? Math.max(0, sub - (row.tvsTotalReviewed || 0)));
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

    // Build tenant groups for Excel Pivot style hierarchy
    const tenantGroupsMap = new Map<string, {
      tenantName: string;
      tenantId?: string;
      rows: any[];
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
            performanceScore: 0,
          }
        });
      }

      const g = tenantGroupsMap.get(tName)!;
      g.rows.push(row);

      const dOk = row.directOk ?? 0;
      const rComp = row.reworkQcCompleted ?? 0;
      const rPend = row.reworkQcPending ?? 0;
      const rej = row.rejected ?? 0;
      const disp = row.dispatched ?? 0;
      const dPending = Math.max(0, dOk + rComp - disp);
      const sub = getUserTotalSubmitted(row.name, row.totalSubmitted || 0);

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
      g.totals.tvsPending += (row.tvsReviewPending ?? Math.max(0, sub - (row.tvsTotalReviewed ?? 0)));
      g.totals.tvsAccepted += (row.tvsAccepted ?? 0);
      g.totals.tvsRejected += (row.tvsRejected ?? 0);
      g.totals.tvsRework += (row.tvsReworked ?? 0);
    });

    tenantGroupsMap.forEach((g) => {
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
    perfInspectorSummary,
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
          {/* View Mode Toggle (Excel Pivot Hierarchy vs Flat) */}
          <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode("grouped")}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === "grouped"
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
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === "flat"
                  ? "bg-white dark:bg-gray-700 text-purple-700 dark:text-purple-300 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
              }`}
              title="Flat Inspector List"
            >
              <span>📋 Flat List</span>
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
                } catch (e) {}
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
                      className="px-2 py-2 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap text-center text-indigo-600 cursor-pointer hover:bg-gray-100/80 dark:hover:bg-gray-800/80 select-none group"
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
                  className="px-2 py-2 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap text-center text-violet-600 cursor-pointer hover:bg-gray-100/80 dark:hover:bg-gray-800/80 select-none group"
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
                    className="px-2 py-2 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap text-center text-indigo-600 cursor-pointer hover:bg-gray-100/80 dark:hover:bg-gray-800/80 select-none group"
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
                  className="px-2 py-2 border-b border-l border-purple-200 dark:border-purple-800 bg-purple-50/60 dark:bg-purple-950/30 whitespace-nowrap text-center text-purple-800 dark:text-purple-200 cursor-pointer hover:bg-purple-100/80 dark:hover:bg-purple-900/50 select-none group"
                  title="Click to sort by Total Reviewed"
                >
                  <div className="inline-flex items-center gap-1 justify-center">
                    <span>Total Reviewed</span>
                    {renderSortIcon("totalReviewed")}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("reviewPending")}
                  className="px-2 py-2 border-b bg-purple-50/60 dark:bg-purple-950/30 whitespace-nowrap text-center text-amber-600 dark:text-amber-400 cursor-pointer hover:bg-purple-100/80 dark:hover:bg-purple-900/50 select-none group"
                  title="Click to sort by Review Pending"
                >
                  <div className="inline-flex items-center gap-1 justify-center">
                    <span>Review Pending</span>
                    {renderSortIcon("reviewPending")}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("accepted")}
                  className="px-2 py-2 border-b bg-purple-50/60 dark:bg-purple-950/30 whitespace-nowrap text-center text-green-600 dark:text-green-400 font-extrabold cursor-pointer hover:bg-purple-100/80 dark:hover:bg-purple-900/50 select-none group"
                  title="Click to sort by BIW Accepted"
                >
                  <div className="inline-flex items-center gap-1 justify-center">
                    <span>BIW Accepted</span>
                    {renderSortIcon("accepted")}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("rejectedReview")}
                  className="px-2 py-2 border-b bg-purple-50/60 dark:bg-purple-950/30 whitespace-nowrap text-center text-red-600 dark:text-red-400 font-extrabold cursor-pointer hover:bg-purple-100/80 dark:hover:bg-purple-900/50 select-none group"
                  title="Click to sort by BIW Rejected"
                >
                  <div className="inline-flex items-center gap-1 justify-center">
                    <span>BIW Rejected</span>
                    {renderSortIcon("rejectedReview")}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("reworked")}
                  className="px-2 py-2 border-b border-r border-purple-200 dark:border-purple-800 bg-purple-50/60 dark:bg-purple-950/30 whitespace-nowrap text-center text-orange-600 dark:text-orange-400 font-extrabold cursor-pointer hover:bg-purple-100/80 dark:hover:bg-purple-900/50 select-none group"
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
                  className="px-2 py-2 border-b border-l border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/30 whitespace-nowrap text-center text-blue-800 dark:text-blue-200 cursor-pointer hover:bg-blue-100/80 dark:hover:bg-blue-900/50 select-none group"
                  title="Click to sort by TVS Reviewed"
                >
                  <div className="inline-flex items-center gap-1 justify-center">
                    <span>TVS Reviewed</span>
                    {renderSortIcon("tvsTotalReviewed")}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("tvsReviewPending")}
                  className="px-2 py-2 border-b bg-blue-50/60 dark:bg-blue-950/30 whitespace-nowrap text-center text-amber-600 dark:text-amber-400 cursor-pointer hover:bg-blue-100/80 dark:hover:bg-blue-900/50 select-none group"
                  title="Click to sort by TVS Pending"
                >
                  <div className="inline-flex items-center gap-1 justify-center">
                    <span>TVS Pending</span>
                    {renderSortIcon("tvsReviewPending")}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("tvsAccepted")}
                  className="px-2 py-2 border-b bg-blue-50/60 dark:bg-blue-950/30 whitespace-nowrap text-center text-emerald-600 dark:text-emerald-400 font-extrabold cursor-pointer hover:bg-blue-100/80 dark:hover:bg-blue-900/50 select-none group"
                  title="Click to sort by TVS Accepted"
                >
                  <div className="inline-flex items-center gap-1 justify-center">
                    <span>TVS Accepted</span>
                    {renderSortIcon("tvsAccepted")}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("tvsRejected")}
                  className="px-2 py-2 border-b bg-blue-50/60 dark:bg-blue-950/30 whitespace-nowrap text-center text-rose-600 dark:text-rose-400 font-extrabold cursor-pointer hover:bg-blue-100/80 dark:hover:bg-blue-900/50 select-none group"
                  title="Click to sort by TVS Rejected"
                >
                  <div className="inline-flex items-center gap-1 justify-center">
                    <span>TVS Rejected</span>
                    {renderSortIcon("tvsRejected")}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("tvsReworked")}
                  className="px-2 py-2 border-b border-r border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/30 whitespace-nowrap text-center text-amber-600 dark:text-amber-400 font-extrabold cursor-pointer hover:bg-blue-100/80 dark:hover:bg-blue-900/50 select-none group"
                  title="Click to sort by TVS Rework"
                >
                  <div className="inline-flex items-center gap-1 justify-center">
                    <span>TVS Rework</span>
                    {renderSortIcon("tvsReworked")}
                  </div>
                </th>
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
              {(viewMode === "grouped" ? tenantGroups.length === 0 : paginatedPerformance.length === 0) && (
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
              {viewMode === "grouped" ? (
                tenantGroups.map((group) => {
                  const isCollapsed = collapsedTenants.has(group.tenantName);
                  return (
                    <React.Fragment key={`group-wrapper-${group.tenantName}`}>
                      <tr
                        key={`tenant-header-${group.tenantName}`}
                        onClick={() => toggleTenantCollapse(group.tenantName)}
                        className="bg-emerald-50/90 dark:bg-emerald-950/40 border-y-2 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100/90 dark:hover:bg-emerald-900/50 transition-colors cursor-pointer font-black text-emerald-950 dark:text-emerald-100 select-none shadow-2xs"
                      >
                        {isSuperAdmin && (
                          <td className="px-2 py-2 whitespace-nowrap text-xs font-black text-emerald-800 dark:text-emerald-200">
                            {group.tenantName}
                          </td>
                        )}
                        <td className="px-2 py-2 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="p-0.5 rounded bg-emerald-200/80 dark:bg-emerald-800/80 text-emerald-900 dark:text-emerald-100">
                              {isCollapsed ? (
                                <ChevronRight className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </span>
                            <span className="text-xs font-extrabold uppercase tracking-wider">{group.tenantName}</span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-200/60 dark:bg-emerald-800/60 text-emerald-800 dark:text-emerald-200">
                              {group.rows.length} inspector{group.rows.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </td>
                        {performanceStatuses
                          .filter((status) => status !== "Dispatched")
                          .map((status) => {
                            const statusKeyMap: Record<string, string> = {
                              "Direct Ok": "directOk",
                              "Rework QC Completed": "reworkQcCompleted",
                              "Rework QC Pending": "reworkQcPending",
                              "Rejected": "rejected",
                            };
                            const key = statusKeyMap[status];
                            const count = key ? (group.totals as any)[key] ?? 0 : (group.totals as any)[status] ?? 0;
                            const colorClass =
                              status === "Direct Ok" || status === "Rework Accepted"
                                ? "text-emerald-700 dark:text-emerald-300"
                                : status.startsWith("Rework")
                                  ? "text-amber-700 dark:text-amber-300"
                                  : status === "Rejected"
                                    ? "text-rose-700 dark:text-rose-300"
                                    : "text-blue-700 dark:text-blue-300";
                            return (
                              <td
                                key={`group-status-${group.tenantName}-${status}`}
                                className={`px-2 py-2 font-black text-center tabular-nums ${colorClass}`}
                              >
                                {count}
                              </td>
                            );
                          })}
                        <td className="px-2 py-2 font-black text-center tabular-nums text-violet-700 dark:text-violet-300">
                          {group.totals.dispatchPending}
                        </td>
                        {performanceStatuses.includes("Dispatched") && (
                          <td className="px-2 py-2 font-black text-center tabular-nums text-blue-700 dark:text-blue-300">
                            {group.totals.dispatched}
                          </td>
                        )}
                        <td className="px-2 py-2 font-black text-center tabular-nums border-r border-emerald-300 dark:border-emerald-700 text-gray-900 dark:text-white">
                          {group.totals.totalSubmitted}
                        </td>
                        {/* BIW Review Subtotals */}
                        <td className="px-2 py-2 font-black text-center tabular-nums border-l border-purple-200 bg-purple-50/50 dark:bg-purple-950/20 text-purple-900 dark:text-purple-200">
                          {group.totals.totalReviewed}
                        </td>
                        <td className="px-2 py-2 font-black text-center tabular-nums bg-purple-50/50 dark:bg-purple-950/20 text-amber-700 dark:text-amber-300">
                          {group.totals.reviewPending}
                        </td>
                        <td className="px-2 py-2 font-black text-center tabular-nums bg-purple-50/50 dark:bg-purple-950/20 text-green-700 dark:text-green-300">
                          {group.totals.biwAccepted}
                        </td>
                        <td className="px-2 py-2 font-black text-center tabular-nums bg-purple-50/50 dark:bg-purple-950/20 text-red-700 dark:text-red-300">
                          {group.totals.biwRejected}
                        </td>
                        <td className="px-2 py-2 font-black text-center tabular-nums border-r border-purple-200 bg-purple-50/50 dark:bg-purple-950/20 text-orange-700 dark:text-orange-300">
                          {group.totals.biwReworked}
                        </td>
                        {/* TVS Review Subtotals */}
                        <td className="px-2 py-2 font-black text-center tabular-nums border-l border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 text-blue-900 dark:text-blue-200">
                          {group.totals.tvsReviewed}
                        </td>
                        <td className="px-2 py-2 font-black text-center tabular-nums bg-blue-50/50 dark:bg-blue-950/20 text-amber-700 dark:text-amber-300">
                          {group.totals.tvsPending}
                        </td>
                        <td className="px-2 py-2 font-black text-center tabular-nums bg-blue-50/50 dark:bg-blue-950/20 text-emerald-700 dark:text-emerald-300">
                          {group.totals.tvsAccepted}
                        </td>
                        <td className="px-2 py-2 font-black text-center tabular-nums bg-blue-50/50 dark:bg-blue-950/20 text-rose-700 dark:text-rose-300">
                          {group.totals.tvsRejected}
                        </td>
                        <td className="px-2 py-2 font-black text-center tabular-nums border-r border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 text-amber-700 dark:text-amber-300">
                          {group.totals.tvsRework}
                        </td>
                        {/* Performance Score */}
                        <td className="px-2 py-2 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 tabular-nums">
                            {group.totals.performanceScore}%
                          </span>
                        </td>
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
                              </div>
                            </td>
                            {performanceStatuses
                              .filter((status) => status !== "Dispatched")
                              .map((status) => {
                                const statusKeyMap: Record<string, string> = {
                                  "Direct Ok": "directOk",
                                  "Rework QC Completed": "reworkQcCompleted",
                                  "Rework QC Pending": "reworkQcPending",
                                  "Rejected": "rejected",
                                };
                                const key = statusKeyMap[status];
                                const count =
                                  (row[key] !== undefined ? row[key] : undefined) ??
                                  (inspectorStatusMap[row.name]?.[status] !== undefined
                                    ? inspectorStatusMap[row.name][status]
                                    : 0);
                                const isZero = count === 0;
                                const colorClass =
                                  status === "Direct Ok" || status === "Rework Accepted"
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : status.startsWith("Rework")
                                      ? "text-amber-600 dark:text-amber-400"
                                      : status === "Rejected"
                                        ? "text-rose-600 dark:text-rose-400"
                                        : "text-blue-600 dark:text-blue-400";
                                return (
                                  <td
                                    key={status}
                                    className={`px-2 py-1.5 font-bold text-center tabular-nums transition-opacity ${isZero ? "opacity-20 text-gray-400" : colorClass}`}
                                  >
                                    {count}
                                  </td>
                                );
                              })}
                            {(() => {
                              const directOk = row.directOk ?? inspectorStatusMap[row.name]?.["Direct Ok"] ?? 0;
                              const reworkQCCompleted = row.reworkQcCompleted ?? inspectorStatusMap[row.name]?.["Rework QC Completed"] ?? 0;
                              const dispatched = row.dispatched ?? inspectorStatusMap[row.name]?.["Dispatched"] ?? 0;
                              const dispatchPending = Math.max(0, directOk + reworkQCCompleted - dispatched);
                              const isZero = dispatchPending === 0;
                              return (
                                <td
                                  className={`px-2 py-1.5 font-bold text-center tabular-nums transition-opacity ${isZero ? "opacity-20 text-gray-400" : "text-violet-600 dark:text-violet-400"}`}
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
                                    className={`px-2 py-1.5 font-bold text-center tabular-nums transition-opacity ${isZero ? "opacity-20 text-gray-400" : "text-blue-600 dark:text-blue-400"}`}
                                  >
                                    {count}
                                  </td>
                                );
                              })()}
                            <td className="px-2 py-1.5 font-bold text-center tabular-nums border-r border-gray-100 dark:border-gray-700">
                              {getUserTotalSubmitted(row.name, row.totalSubmitted)}
                            </td>
                            {/* BIW Review Data Cells with distinct shading */}
                            <td className="px-2 py-1.5 font-bold text-center tabular-nums border-l border-purple-100 dark:border-purple-900/30 bg-purple-50/25 dark:bg-purple-950/10 text-purple-900 dark:text-purple-200">
                              {row.totalReviewed ?? row.biwTotalReviewed ?? 0}
                            </td>
                            <td
                              className={`px-2 py-1.5 font-bold text-center tabular-nums bg-purple-50/25 dark:bg-purple-950/10 ${(() => {
                                const dispatched = row.dispatched ?? inspectorStatusMap[row.name]?.["Dispatched"] ?? 0;
                                const pending = Math.max(0, dispatched - (row.totalReviewed || row.biwTotalReviewed || 0));
                                return pending === 0 ? "opacity-20 text-gray-400" : "text-amber-600 dark:text-amber-400";
                              })()}`}
                            >
                              {Math.max(
                                0,
                                (row.dispatched ?? inspectorStatusMap[row.name]?.["Dispatched"] ?? 0) -
                                (row.totalReviewed || row.biwTotalReviewed || 0),
                              )}
                            </td>
                            <td className="px-2 py-1.5 font-extrabold text-center text-green-600 dark:text-green-400 tabular-nums bg-purple-50/25 dark:bg-purple-950/10">
                              {row.biwAccepted ?? row.accepted ?? 0}
                            </td>
                            <td className="px-2 py-1.5 font-extrabold text-center text-red-600 dark:text-red-400 tabular-nums bg-purple-50/25 dark:bg-purple-950/10">
                              {row.biwRejected ?? row.rejectedReview ?? row.rejected ?? 0}
                            </td>
                            <td className="px-2 py-1.5 font-extrabold text-center text-orange-600 dark:text-orange-400 tabular-nums border-r border-purple-100 dark:border-purple-900/30 bg-purple-50/25 dark:bg-purple-950/10">
                              {row.biwReworked ?? row.reworked ?? row.rework ?? 0}
                            </td>
                            {/* TVS Review Data Cells with distinct shading */}
                            <td className="px-2 py-1.5 font-bold text-center tabular-nums border-l border-blue-100 dark:border-blue-900/30 bg-blue-50/25 dark:bg-blue-950/10 text-blue-900 dark:text-blue-200">
                              {row.tvsTotalReviewed ?? 0}
                            </td>
                            <td className="px-2 py-1.5 font-bold text-center tabular-nums bg-blue-50/25 dark:bg-blue-950/10 text-amber-600 dark:text-amber-400">
                              {row.tvsReviewPending ?? Math.max(0, (row.totalSubmitted || 0) - (row.tvsTotalReviewed || 0))}
                            </td>
                            <td className="px-2 py-1.5 font-extrabold text-center text-emerald-600 dark:text-emerald-400 tabular-nums bg-blue-50/25 dark:bg-blue-950/10">
                              {row.tvsAccepted ?? 0}
                            </td>
                            <td className="px-2 py-1.5 font-extrabold text-center text-rose-600 dark:text-rose-400 tabular-nums bg-blue-50/25 dark:bg-blue-950/10">
                              {row.tvsRejected ?? 0}
                            </td>
                            <td className="px-2 py-1.5 font-extrabold text-center text-amber-600 dark:text-amber-400 tabular-nums border-r border-blue-100 dark:border-blue-900/30 bg-blue-50/25 dark:bg-blue-950/10">
                              {row.tvsReworked ?? 0}
                            </td>
                            <td className="px-2 py-1.5 text-center">
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
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleRowExpansion(`${group.tenantName}-${row.name}`); }}
                                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all cursor-pointer"
                                title={expandedRows.has(`${group.tenantName}-${row.name}`) ? "Collapse" : "Expand"}
                              >
                                {expandedRows.has(`${group.tenantName}-${row.name}`) ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </button>
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
                                const directOk = v["Direct Ok"] || 0;
                                const reworkQCCompleted = v["Rework QC Completed"] || 0;
                                const dispatched = v["Dispatched"] || 0;
                                const totalSubmitted = performanceStatuses
                                  .filter(s => s !== 'Dispatched')
                                  .reduce((sum, status) => sum + (v[status] || 0), 0);

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
                                    {performanceStatuses.filter(s => s !== 'Dispatched').map(status => (
                                      <td key={status} className="px-2 py-1.5 font-bold text-center tabular-nums">
                                        {v[status] || 0}
                                      </td>
                                    ))}
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
                        {row.name}
                        {!isSuperAdmin && row.tenantName && row.tenantName !== "Unknown Tenant" && (
                          <span className="ml-1 text-xs font-normal text-gray-500 dark:text-gray-400">
                            ({row.tenantName})
                          </span>
                        )}
                      </td>
                      {performanceStatuses
                        .filter((status) => status !== "Dispatched")
                        .map((status) => {
                          const statusKeyMap: Record<string, string> = {
                            "Direct Ok": "directOk",
                            "Rework QC Completed": "reworkQcCompleted",
                            "Rework QC Pending": "reworkQcPending",
                            "Rejected": "rejected",
                          };
                          const key = statusKeyMap[status];
                          const count =
                            (inspectorStatusMap[row.name]?.[status] !== undefined
                              ? inspectorStatusMap[row.name][status]
                              : undefined) ??
                            (key && row[key] !== undefined ? row[key] : 0);
                          const isZero = count === 0;
                          const colorClass =
                            status === "Direct Ok" || status === "Rework Accepted"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : status.startsWith("Rework")
                                ? "text-amber-600 dark:text-amber-400"
                                : status === "Rejected"
                                  ? "text-rose-600 dark:text-rose-400"
                                  : "text-blue-600 dark:text-blue-400";
                          return (
                            <td
                              key={status}
                              className={`px-2 py-1.5 font-bold text-center tabular-nums transition-opacity ${isZero ? "opacity-20 text-gray-400" : colorClass}`}
                            >
                              {count}
                            </td>
                          );
                        })}
                      {(() => {
                        const directOk =
                          inspectorStatusMap[row.name]?.["Direct Ok"] ?? row.directOk ?? 0;
                        const reworkQCCompleted =
                          inspectorStatusMap[row.name]?.["Rework QC Completed"] ??
                          row.reworkQcCompleted ??
                          0;
                        const dispatched =
                          inspectorStatusMap[row.name]?.["Dispatched"] ?? row.dispatched ?? 0;
                        const dispatchPending = Math.max(
                          0,
                          directOk + reworkQCCompleted - dispatched,
                        );
                        const isZero = dispatchPending === 0;
                        return (
                          <td
                            className={`px-2 py-1.5 font-bold text-center tabular-nums transition-opacity ${isZero ? "opacity-20 text-gray-400" : "text-violet-600 dark:text-violet-400"}`}
                          >
                            {dispatchPending}
                          </td>
                        );
                      })()}
                      {performanceStatuses.includes("Dispatched") &&
                        (() => {
                          const count =
                            inspectorStatusMap[row.name]?.["Dispatched"] ?? row.dispatched ?? 0;
                          const isZero = count === 0;
                          return (
                            <td
                              className={`px-2 py-1.5 font-bold text-center tabular-nums transition-opacity ${isZero ? "opacity-20 text-gray-400" : "text-blue-600 dark:text-blue-400"}`}
                            >
                              {count}
                            </td>
                          );
                        })()}
                      <td className="px-2 py-1.5 font-bold text-center tabular-nums border-r border-gray-100 dark:border-gray-700">
                        {getUserTotalSubmitted(row.name, row.totalSubmitted)}
                      </td>
                      {/* BIW Review Data Cells with distinct shading */}
                      <td className="px-2 py-1.5 font-bold text-center tabular-nums border-l border-purple-100 dark:border-purple-900/30 bg-purple-50/25 dark:bg-purple-950/10 text-purple-900 dark:text-purple-200">
                        {row.totalReviewed}
                      </td>
                      <td
                        className={`px-2 py-1.5 font-bold text-center tabular-nums bg-purple-50/25 dark:bg-purple-950/10 ${(() => {
                          const dispatched =
                            inspectorStatusMap[row.name]?.["Dispatched"] || 0;
                          const pending = Math.max(
                            0,
                            dispatched - (row.totalReviewed || 0),
                          );
                          return pending === 0
                            ? "opacity-20 text-gray-400"
                            : "text-amber-600 dark:text-amber-400";
                        })()}`}
                      >
                        {Math.max(
                          0,
                          (inspectorStatusMap[row.name]?.["Dispatched"] || 0) -
                          (row.totalReviewed || 0),
                        )}
                      </td>
                      <td className="px-2 py-1.5 font-extrabold text-center text-green-600 dark:text-green-400 tabular-nums bg-purple-50/25 dark:bg-purple-950/10">
                        {row.accepted || 0}
                      </td>
                      <td className="px-2 py-1.5 font-extrabold text-center text-red-600 dark:text-red-400 tabular-nums bg-purple-50/25 dark:bg-purple-950/10">
                        {row.rejectedReview ?? row.rejected ?? 0}
                      </td>
                      <td className="px-2 py-1.5 font-extrabold text-center text-orange-600 dark:text-orange-400 tabular-nums border-r border-purple-100 dark:border-purple-900/30 bg-purple-50/25 dark:bg-purple-950/10">
                        {row.reworked ?? row.rework ?? 0}
                      </td>
                      {/* TVS Review Data Cells with distinct shading */}
                      <td className="px-2 py-1.5 font-bold text-center tabular-nums border-l border-blue-100 dark:border-blue-900/30 bg-blue-50/25 dark:bg-blue-950/10 text-blue-900 dark:text-blue-200">
                        {row.tvsTotalReviewed ?? 0}
                      </td>
                      <td className="px-2 py-1.5 font-bold text-center tabular-nums bg-blue-50/25 dark:bg-blue-950/10 text-amber-600 dark:text-amber-400">
                        {row.tvsReviewPending ?? Math.max(0, (row.totalSubmitted || 0) - (row.tvsTotalReviewed || 0))}
                      </td>
                      <td className="px-2 py-1.5 font-extrabold text-center text-emerald-600 dark:text-emerald-400 tabular-nums bg-blue-50/25 dark:bg-blue-950/10">
                        {row.tvsAccepted ?? 0}
                      </td>
                      <td className="px-2 py-1.5 font-extrabold text-center text-rose-600 dark:text-rose-400 tabular-nums bg-blue-50/25 dark:bg-blue-950/10">
                        {row.tvsRejected ?? 0}
                      </td>
                      <td className="px-2 py-1.5 font-extrabold text-center text-amber-600 dark:text-amber-400 tabular-nums border-r border-blue-100 dark:border-blue-900/30 bg-blue-50/25 dark:bg-blue-950/10">
                        {row.tvsReworked ?? 0}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {(row.totalReviewed || 0) === 0 ? (
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
                        {(row.totalReviewed || 0) === 0 ? (
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
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleRowExpansion(row.name); }}
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                          title={expandedRows.has(row.name) ? "Collapse" : "Expand"}
                        >
                          {expandedRows.has(row.name) ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    </tr>

                    {expandedRows.has(row.name) &&
                      (() => {
                        // 1. Group summary items by form
                        const forms = new Map<string, any[]>();
                        perfInspectorSummary
                          .filter((item: any) => item.qcInspector === row.name)
                          .forEach((item: any) => {
                            const formName = item.formTitle || "Unknown Form";
                            if (!forms.has(formName)) forms.set(formName, []);
                            forms.get(formName)!.push(item);
                          });

                        if (forms.size === 0) return null;

                        // 2. Map over forms to create a <React.Fragment> of <tr> elements
                        return Array.from(forms.entries()).map(([formName, items], formIdx) => {
                          // 3. For each form, calculate the summary stats, including review outcomes
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
                          const directOk = v["Direct Ok"] || 0;
                          const reworkQCCompleted = v["Rework QC Completed"] || 0;
                          const dispatched = v["Dispatched"] || 0;

                          const totalSubmitted = performanceStatuses
                            .filter(s => s !== 'Dispatched')
                            .reduce((sum, status) => sum + (v[status] || 0), 0);

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
                              {performanceStatuses.filter(s => s !== 'Dispatched').map(status => (
                                <td key={status} className="px-2 py-1.5 font-bold text-center tabular-nums">
                                  {v[status] || 0}
                                </td>
                              ))}
                              <td className="px-2 py-1.5 font-bold text-center tabular-nums">{dispatchPending}</td>
                              {performanceStatuses.includes("Dispatched") && (
                                <td className="px-2 py-1.5 font-bold text-center tabular-nums">
                                  {dispatched}
                                </td>
                              )}
                              <td className="px-2 py-1.5 font-bold text-center tabular-nums border-r border-purple-100 dark:border-purple-900/30">{totalSubmitted}</td>
                              {/* BIW Review cells for expanded row */}
                              <td className="px-2 py-1.5 font-bold text-center tabular-nums bg-purple-100/40 dark:bg-purple-900/20 border-l border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200">{totalReviewed}</td>
                              <td className="px-2 py-1.5 font-bold text-center tabular-nums bg-purple-100/40 dark:bg-purple-900/20 text-amber-600 dark:text-amber-400">{reviewPending}</td>
                              <td className="px-2 py-1.5 font-extrabold text-center text-green-600 dark:text-green-400 tabular-nums bg-purple-100/40 dark:bg-purple-900/20">{accepted}</td>
                              <td className="px-2 py-1.5 font-extrabold text-center text-red-600 dark:text-red-400 tabular-nums bg-purple-100/40 dark:bg-purple-900/20">{rejected_outcome}</td>
                              <td className="px-2 py-1.5 font-extrabold text-center text-orange-600 dark:text-orange-400 tabular-nums border-r border-purple-200 dark:border-purple-800 bg-purple-100/40 dark:bg-purple-900/20">{rework}</td>
                              {/* TVS Review cells for expanded row */}
                              <td className="px-2 py-1.5 font-bold text-center tabular-nums bg-blue-100/40 dark:bg-blue-900/20 border-l border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200">—</td>
                              <td className="px-2 py-1.5 font-bold text-center tabular-nums bg-blue-100/40 dark:bg-blue-900/20 text-amber-600 dark:text-amber-400">—</td>
                              <td className="px-2 py-1.5 font-extrabold text-center text-emerald-600 dark:text-emerald-400 tabular-nums bg-blue-100/40 dark:bg-blue-900/20">—</td>
                              <td className="px-2 py-1.5 font-extrabold text-center text-rose-600 dark:text-rose-400 tabular-nums bg-blue-100/40 dark:bg-blue-900/20">—</td>
                              <td className="px-2 py-1.5 font-extrabold text-center text-amber-600 dark:text-amber-400 tabular-nums border-r border-blue-200 dark:border-blue-800 bg-blue-100/40 dark:bg-blue-900/20">—</td>
                              {/* Empty cells for alignment */}
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
                      className={`px-2 py-1.5 text-center tabular-nums font-black ${status === "Direct Ok" ||
                        status === "Rework Accepted"
                        ? "text-emerald-700 dark:text-emerald-300"
                        : status.startsWith("Rework")
                          ? "text-amber-700 dark:text-amber-300"
                          : status === "Rejected"
                            ? "text-rose-700 dark:text-rose-300"
                            : "text-blue-700 dark:text-blue-300"
                        }`}
                    >
                      {statusTotals[status] || 0}
                    </td>
                  ))}
                <td className="px-2 py-1.5 text-center tabular-nums font-black text-violet-700 dark:text-violet-300">
                  {totalDispatchPending}
                </td>
                {performanceStatuses.includes("Dispatched") && (
                  <td className="px-2 py-1.5 text-center tabular-nums font-black text-blue-700 dark:text-blue-300">
                    {totalDispatched}
                  </td>
                )}
                <td className="px-2 py-1.5 text-center tabular-nums font-black border-r border-gray-300 dark:border-gray-500">
                  {totalTotalSubmitted}
                </td>
                {/* BIW Review Total Cells */}
                <td className="px-2 py-1.5 text-center tabular-nums font-black border-l border-purple-300 dark:border-purple-700 bg-purple-100/70 dark:bg-purple-900/40 text-purple-900 dark:text-purple-200">
                  {totalTotalReviewed}
                </td>
                <td className="px-2 py-1.5 text-center tabular-nums font-black text-amber-700 dark:text-amber-300 bg-purple-100/70 dark:bg-purple-900/40">
                  {totalReviewPending}
                </td>
                <td className="px-2 py-1.5 text-center tabular-nums font-black text-green-700 dark:text-green-300 bg-purple-100/70 dark:bg-purple-900/40">
                  {totalAccepted}
                </td>
                <td className="px-2 py-1.5 text-center tabular-nums font-black text-red-700 dark:text-red-300 bg-purple-100/70 dark:bg-purple-900/40">
                  {totalRejected}
                </td>
                <td className="px-2 py-1.5 text-center tabular-nums font-black text-orange-700 dark:text-orange-300 border-r border-purple-300 dark:border-purple-700 bg-purple-100/70 dark:bg-purple-900/40">
                  {totalRework}
                </td>
                {/* TVS Review Total Cells */}
                <td className="px-2 py-1.5 text-center tabular-nums font-black border-l border-blue-300 dark:border-blue-700 bg-blue-100/70 dark:bg-blue-900/40 text-blue-900 dark:text-blue-200">
                  {totalTvsReviewed}
                </td>
                <td className="px-2 py-1.5 text-center tabular-nums font-black text-amber-700 dark:text-amber-300 bg-blue-100/70 dark:bg-blue-900/40">
                  {totalTvsReviewPending}
                </td>
                <td className="px-2 py-1.5 text-center tabular-nums font-black text-emerald-700 dark:text-emerald-300 bg-blue-100/70 dark:bg-blue-900/40">
                  {totalTvsAccepted}
                </td>
                <td className="px-2 py-1.5 text-center tabular-nums font-black text-rose-700 dark:text-rose-300 bg-blue-100/70 dark:bg-blue-900/40">
                  {totalTvsRejected}
                </td>
                <td className="px-2 py-1.5 text-center tabular-nums font-black text-amber-700 dark:text-amber-300 border-r border-blue-300 dark:border-blue-700 bg-blue-100/70 dark:bg-blue-900/40">
                  {totalTvsRework}
                </td>
                <td className="px-2 py-1.5 text-center">
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
            </tbody>
          </table>
        </div>
        )}
        {performanceTableData.length > 0 && totalPerformancePages > 1 && (
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
    </div>
  );
};

export default PerformanceTable;
