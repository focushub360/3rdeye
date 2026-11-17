import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FileText,
  Eye,
  Edit,
  BarChart2,
  Plus,
  Search,
  Share2,
  Building2,
  CheckCircle2,
  Loader2,
  ArrowRight,
  GitBranch,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { apiClient } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { io } from "socket.io-client";

interface FormItem {
  id?: string;
  _id?: string;
  title: string;
  description?: string;
  tenantId?: any;
  sharedWithTenants?: any[];
  chassisTenantAssignments?: any[];
  parentFormId?: string;
  parentFormTitle?: string;
  childForms?: any[];
  responseCount?: number;
  isVisible?: boolean;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export default function FormsList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [forms, setForms] = useState<FormItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "owned" | "assigned" | "followup">("all");
  const [tenantsList, setTenantsList] = useState<any[]>([]);

  // Preload tenants minimal list for resolving names
  useEffect(() => {
    let mounted = true;
    apiClient
      .getTenantsMinimal()
      .then((res: any) => {
        if (mounted) {
          const list = res?.tenants || res?.data?.tenants || [];
          setTenantsList(list);
        }
      })
      .catch((err) => {
        console.warn("Could not load tenants for labels:", err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const tenantMap = useMemo(() => {
    const map = new Map<string, string>();
    (tenantsList || []).forEach((t: any) => {
      const id = String(t._id || t.id);
      const name = t.companyName || t.name;
      if (id && name) map.set(id, name);
    });
    return map;
  }, [tenantsList]);

  const loadForms = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.getForms({ forceNetwork: true });
      const rawForms: FormItem[] = (res as any)?.forms || (res as any)?.data?.forms || [];
      setForms(rawForms);
    } catch (err) {
      console.error("Failed to load forms in FormsList:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadForms();
  }, [loadForms, user?.tenantId]);

  // Real-time synchronization
  useEffect(() => {
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

    socket.on("forms-changed", () => {
      apiClient.invalidateFormsCache();
      loadForms();
    });

    return () => {
      socket.disconnect();
    };
  }, [loadForms]);

  const userTenantIdStr = useMemo(() => {
    if (!user?.tenantId) return "";
    return String(typeof user.tenantId === "object" ? user.tenantId._id || user.tenantId.id : user.tenantId);
  }, [user]);

  const isFormAssigned = useCallback(
    (form: FormItem): boolean => {
      if (!userTenantIdStr || user?.role === "superadmin") return false;

      const ownerId =
        typeof form.tenantId === "object"
          ? form.tenantId?._id || form.tenantId?.id
          : form.tenantId;
      const ownerIdStr = ownerId ? String(ownerId) : "";

      if (!ownerIdStr || ownerIdStr === userTenantIdStr) return false;

      const isShared =
        Array.isArray(form.sharedWithTenants) &&
        form.sharedWithTenants.some(
          (t: any) => String(typeof t === "object" && t ? t._id || t.id : t) === userTenantIdStr
        );
      const isChassisShared =
        Array.isArray(form.chassisTenantAssignments) &&
        form.chassisTenantAssignments.some(
          (a: any) =>
            Array.isArray(a.assignedTenants) &&
            a.assignedTenants.some(
              (t: any) => String(typeof t === "object" && t ? t._id || t.id : t) === userTenantIdStr
            )
        );

      return isShared || isChassisShared || !Boolean((form as any).isGlobal);
    },
    [userTenantIdStr, user]
  );

  const getTenantDisplayName = useCallback(
    (form: FormItem): string => {
      if (typeof form.tenantId === "object" && form.tenantId) {
        return (
          form.tenantId.companyName ||
          form.tenantId.name ||
          form.tenantId.slug ||
          tenantMap.get(String(form.tenantId._id || form.tenantId.id)) ||
          "Partner Org"
        );
      }
      if (form.tenantId && tenantMap.has(String(form.tenantId))) {
        return tenantMap.get(String(form.tenantId)) || "Partner Org";
      }
      return (form as any).tenantName || "Partner Org";
    },
    [tenantMap]
  );

  // Filtered and sorted forms
  const displayForms = useMemo(() => {
    let result = [...forms];

    // Filter by search
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (f) =>
          f.title?.toLowerCase().includes(q) ||
          f.description?.toLowerCase().includes(q) ||
          f.parentFormTitle?.toLowerCase().includes(q) ||
          getTenantDisplayName(f).toLowerCase().includes(q)
      );
    }

    // Filter by tab
    if (filterTab === "assigned") {
      result = result.filter((f) => isFormAssigned(f));
    } else if (filterTab === "owned") {
      result = result.filter((f) => !isFormAssigned(f));
    } else if (filterTab === "followup") {
      result = result.filter((f) => Boolean(f.parentFormId));
    }

    // Sort: assigned first, then newest
    return result.sort((a, b) => {
      const aAssigned = isFormAssigned(a);
      const bAssigned = isFormAssigned(b);

      if (aAssigned && !bAssigned) return -1;
      if (!aAssigned && bAssigned) return 1;

      const aTime = Math.max(
        a.updatedAt ? new Date(a.updatedAt).getTime() : 0,
        a.createdAt ? new Date(a.createdAt).getTime() : 0
      );
      const bTime = Math.max(
        b.updatedAt ? new Date(b.updatedAt).getTime() : 0,
        b.createdAt ? new Date(b.createdAt).getTime() : 0
      );
      return bTime - aTime;
    });
  }, [forms, searchTerm, filterTab, isFormAssigned, getTenantDisplayName]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Page Header */}
      <div className="bg-white dark:bg-gray-850 p-6 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
              Forms Management & Preview
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            View, preview, respond to, and manage your inspection forms and assigned follow-ups
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => loadForms()}
            disabled={loading}
            className="p-2 sm:px-3 sm:py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Refresh forms list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-600" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <Link
            to="/forms/analytics"
            className="px-3.5 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200/80 dark:hover:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center gap-1.5 transition-colors"
          >
            <BarChart2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Service Analytics</span>
          </Link>

          {(user?.role === "admin" || user?.role === "superadmin") && (
            <Link
              to="/forms/create"
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold text-xs inline-flex items-center gap-1.5 shadow-sm hover:shadow transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create New Form</span>
            </Link>
          )}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-gray-850 p-3 rounded-xl border border-gray-200/80 dark:border-gray-700/80 shadow-xs">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search forms by title, partner..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800/80 p-1 rounded-lg w-full sm:w-auto overflow-x-auto">
          <button
            type="button"
            onClick={() => setFilterTab("all")}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
              filterTab === "all"
                ? "bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-2xs"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
            }`}
          >
            All ({forms.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab("assigned")}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
              filterTab === "assigned"
                ? "bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-2xs"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
            }`}
          >
            Assigned ({forms.filter(isFormAssigned).length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab("owned")}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
              filterTab === "owned"
                ? "bg-white dark:bg-gray-900 text-emerald-600 dark:text-emerald-400 shadow-2xs"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
            }`}
          >
            Owned ({forms.filter((f) => !isFormAssigned(f)).length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab("followup")}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
              filterTab === "followup"
                ? "bg-white dark:bg-gray-900 text-purple-600 dark:text-purple-400 shadow-2xs"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
            }`}
          >
            Follow-ups ({forms.filter((f) => Boolean(f.parentFormId)).length})
          </button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && forms.length === 0 && (
        <div className="py-16 text-center bg-white dark:bg-gray-850 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-xs">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Loading your forms...</p>
        </div>
      )}

      {/* Form Cards Grid */}
      {!loading && displayForms.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayForms.map((form) => {
            const formId = String(form._id || form.id || "");
            const assigned = isFormAssigned(form);
            const tenantName = getTenantDisplayName(form);
            const isFollowUp = Boolean(form.parentFormId);

            return (
              <div
                key={formId}
                className="bg-white dark:bg-gray-850 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-xs hover:shadow-md transition-all duration-200 p-5 flex flex-col justify-between group"
              >
                <div>
                  {/* Badges Bar */}
                  <div className="flex items-center gap-1.5 flex-wrap mb-3">
                    {assigned ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800 shadow-2xs">
                        <Share2 className="w-2.5 h-2.5 text-indigo-600 dark:text-indigo-400" />
                        <span>Assigned from {tenantName}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                        <Building2 className="w-2.5 h-2.5 text-gray-500" />
                        <span>{tenantName}</span>
                      </span>
                    )}

                    {isFollowUp && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                        <GitBranch className="w-2.5 h-2.5 text-purple-600 dark:text-purple-400" />
                        <span>Follow-up</span>
                      </span>
                    )}

                    {form.isActive !== false && (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                        <span>Active</span>
                      </span>
                    )}
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 line-clamp-1 mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {form.title}
                  </h3>

                  {isFollowUp && form.parentFormTitle && (
                    <p className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 mb-1.5 flex items-center gap-1">
                      <span>Linked to:</span>
                      <span className="underline decoration-purple-300">{form.parentFormTitle}</span>
                    </p>
                  )}

                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed mb-4">
                    {form.description || "No description provided."}
                  </p>
                </div>

                {/* Footer Metrics & Actions */}
                <div className="pt-3.5 border-t border-gray-100 dark:border-gray-800 space-y-3">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      {form.responseCount || 0} responses
                    </span>
                    <span className="text-[11px] text-gray-400">
                      {form.updatedAt ? new Date(form.updatedAt).toLocaleDateString() : "Recent"}
                    </span>
                  </div>

                  {/* Actions Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* View / Open Form (Fill) */}
                    <button
                      type="button"
                      onClick={() => navigate(`/forms/${formId}/respond`)}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs hover:shadow transition-all cursor-pointer"
                      title="Open form to submit responses"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>View Form</span>
                    </button>

                    {/* Preview Mode */}
                    <button
                      type="button"
                      onClick={() => navigate(`/forms/${formId}/preview`)}
                      className="px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-gray-200 dark:border-gray-700 transition-all cursor-pointer"
                      title="Preview form structure and questions"
                    >
                      <Eye className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                      <span>Preview</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Analytics */}
                    <button
                      type="button"
                      onClick={() => navigate(`/forms/${formId}/analytics`)}
                      className="flex-1 py-1.5 text-[11px] font-semibold text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer border border-transparent hover:border-blue-100 dark:hover:border-blue-900"
                    >
                      <BarChart2 className="w-3 h-3 text-blue-500" />
                      <span>Analytics</span>
                    </button>

                    {/* Edit Form */}
                    {(!assigned || user?.role === "superadmin") && (
                      <button
                        type="button"
                        onClick={() => navigate(`/forms/${formId}/edit`)}
                        className="flex-1 py-1.5 text-[11px] font-semibold text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer border border-transparent hover:border-emerald-100 dark:hover:border-emerald-900"
                      >
                        <Edit className="w-3 h-3 text-emerald-500" />
                        <span>Edit Form</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!loading && displayForms.length === 0 && (
        <div className="text-center py-16 bg-white dark:bg-gray-850 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-xs p-8 max-w-lg mx-auto">
          <div className="w-14 h-14 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100 dark:border-blue-900">
            <FileText className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1">
            {searchTerm ? "No Matching Forms Found" : "No Forms Available"}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-5 leading-relaxed">
            {searchTerm
              ? `No forms matched your search "${searchTerm}". Try changing your query or filter.`
              : "No forms have been created for your organization or assigned from partner vendors yet."}
          </p>

          <div className="flex items-center justify-center gap-3">
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Clear Search
              </button>
            )}

            {(user?.role === "admin" || user?.role === "superadmin") && (
              <Link
                to="/forms/create"
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold text-xs inline-flex items-center gap-1.5 shadow-sm hover:shadow transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Your First Form</span>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
