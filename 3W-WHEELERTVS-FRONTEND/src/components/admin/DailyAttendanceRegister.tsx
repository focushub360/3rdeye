import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Calendar,
  Download,
  Users,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Activity,
  RefreshCw,
  Search,
  Filter,
  Eye,
  X,
  Layers,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { apiClient } from "../../api/client";

interface DetailedPunch {
  type: "in" | "out";
  time?: string | null;
  rawTime?: string;
  lat?: number;
  lng?: number;
  place?: string;
  accuracy?: number;
}

interface DailyAttendanceLog {
  _id?: string;
  date: string;
  rawDate?: string;
  inspector: string;
  inspectorId?: string | null;
  role?: string;
  tenant?: string | null;
  shift: string;
  shiftStartTime?: string | null;
  shiftEndTime?: string | null;
  checkIn?: string | null;
  rawCheckInTime?: string | null;
  checkOut?: string | null;
  rawCheckOutTime?: string | null;
  hours: number;
  status: string;
  isLate?: boolean;
  isHalfDay?: boolean;
  isEarlyCheckout?: boolean;
  location?: string | null;
  punches?: DetailedPunch[];
}

interface InspectorStat {
  inspectorId?: string;
  name: string;
  role?: string;
  present: number;
  late: number;
  halfDay: number;
  absent: number;
  totalHours: number;
  rate: number;
}

interface RosterRow {
  userId: string;
  name: string;
  role: string;
  shift: string;
  shiftHours: string;
  checkIn: string | null;
  checkOut: string | null;
  hours: number;
  status: "present" | "late" | "half-day" | "absent" | "live";
  isLate: boolean;
  isHalfDay: boolean;
  isLive: boolean;
  location: string | null;
  punches: DetailedPunch[];
  logId?: string;
}

export const DailyAttendanceRegister: React.FC = () => {
  // Format today's date in YYYY-MM-DD local IST
  const getTodayISO = () => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  };

  const [selectedDate, setSelectedDate] = useState<string>(getTodayISO);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [shiftFilter, setShiftFilter] = useState<string>("all");

  const [detailedLogs, setDetailedLogs] = useState<DailyAttendanceLog[]>([]);
  const [inspectorStats, setInspectorStats] = useState<InspectorStat[]>([]);
  const [shiftsList, setShiftsList] = useState<any[]>([]);
  const [selectedPunchUser, setSelectedPunchUser] = useState<RosterRow | null>(null);

  // Quick Date Jump
  const handleSetToday = () => setSelectedDate(getTodayISO());
  const handleSetYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  // Fetch data for selected date
  const loadDailyData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [reportRes, shiftsRes] = await Promise.all([
        apiClient.getHRAttendanceReport({
          startDate: selectedDate,
          endDate: selectedDate,
        }),
        apiClient.getHRShifts().catch(() => ({ data: [] })),
      ]);

      const reportData = reportRes?.data || reportRes;
      setDetailedLogs(reportData?.detailedLogs || []);
      setInspectorStats(reportData?.inspectorStats || []);
      setShiftsList(shiftsRes?.data || []);
    } catch (err) {
      console.error("Failed to load daily attendance register:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadDailyData();
  }, [loadDailyData]);

  // Merge logs with all registered users from stats so everyone appears (even absentees)
  const rosterData: RosterRow[] = useMemo(() => {
    const map = new Map<string, RosterRow>();

    // 1. Initialize with all users in roster (from inspectorStats)
    inspectorStats.forEach((stat) => {
      const key = stat.inspectorId ? String(stat.inspectorId) : stat.name.toLowerCase().trim();
      map.set(key, {
        userId: stat.inspectorId || key,
        name: stat.name,
        role: stat.role || "user",
        shift: "Standard Shift",
        shiftHours: "09:00 - 18:00",
        checkIn: null,
        checkOut: null,
        hours: 0,
        status: "absent",
        isLate: false,
        isHalfDay: false,
        isLive: false,
        location: null,
        punches: [],
      });
    });

    // 2. Overlay detailedLogs for punches recorded on this date
    detailedLogs.forEach((log) => {
      const key = log.inspectorId ? String(log.inspectorId) : log.inspector.toLowerCase().trim();
      const isLive = !!(log.checkIn && !log.checkOut);
      let calculatedStatus: "present" | "late" | "half-day" | "absent" | "live" = "absent";

      if (log.status === "late") calculatedStatus = "late";
      else if (log.status === "half-day") calculatedStatus = "half-day";
      else if (log.status === "present") calculatedStatus = isLive ? "live" : "present";
      else if (log.checkIn) calculatedStatus = isLive ? "live" : "present";

      const shiftHours =
        log.shiftStartTime && log.shiftEndTime
          ? `${log.shiftStartTime} - ${log.shiftEndTime}`
          : "09:00 - 18:00";

      map.set(key, {
        userId: log.inspectorId || key,
        name: log.inspector,
        role: log.role || map.get(key)?.role || "user",
        shift: log.shift || "General Shift",
        shiftHours,
        checkIn: log.checkIn || null,
        checkOut: log.checkOut || null,
        hours: log.hours || 0,
        status: calculatedStatus,
        isLate: !!log.isLate,
        isHalfDay: !!log.isHalfDay,
        isLive,
        location: log.location || null,
        punches: log.punches || [],
        logId: log._id,
      });
    });

    return Array.from(map.values());
  }, [detailedLogs, inspectorStats]);

  // Filtered roster
  const filteredRoster = useMemo(() => {
    return rosterData.filter((row) => {
      // Search term
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesName = row.name.toLowerCase().includes(term);
        const matchesRole = row.role.toLowerCase().includes(term);
        const matchesShift = row.shift.toLowerCase().includes(term);
        if (!matchesName && !matchesRole && !matchesShift) return false;
      }

      // Role filter
      if (roleFilter !== "all" && row.role !== roleFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== "all") {
        if (statusFilter === "live" && !row.isLive) return false;
        if (statusFilter === "present" && row.status !== "present" && !row.isLive) return false;
        if (statusFilter === "late" && row.status !== "late") return false;
        if (statusFilter === "half-day" && row.status !== "half-day") return false;
        if (statusFilter === "absent" && row.status !== "absent") return false;
      }

      // Shift filter
      if (shiftFilter !== "all") {
        if (!row.shift.toLowerCase().includes(shiftFilter.toLowerCase())) return false;
      }

      return true;
    });
  }, [rosterData, searchTerm, roleFilter, statusFilter, shiftFilter]);

  // Aggregate KPI summary stats
  const kpis = useMemo(() => {
    const total = rosterData.length;
    let presentCount = 0;
    let onTimeCount = 0;
    let lateCount = 0;
    let halfDayCount = 0;
    let absentCount = 0;
    let liveCount = 0;
    let totalWorkingHours = 0;

    rosterData.forEach((row) => {
      totalWorkingHours += row.hours;
      if (row.isLive) liveCount++;

      if (row.status === "absent") {
        absentCount++;
      } else {
        presentCount++;
        if (row.status === "late") {
          lateCount++;
        } else if (row.status === "half-day") {
          halfDayCount++;
        } else {
          onTimeCount++;
        }
      }
    });

    const presentRate = total > 0 ? Math.round((presentCount / total) * 100) : 0;

    return {
      total,
      presentCount,
      onTimeCount,
      lateCount,
      halfDayCount,
      absentCount,
      liveCount,
      presentRate,
      totalWorkingHours: Math.round(totalWorkingHours * 10) / 10,
    };
  }, [rosterData]);

  // Export Daily Register to Excel
  const handleExportDaily = async () => {
    try {
      setExporting(true);
      const blob = await apiClient.exportHRAttendanceReport({
        startDate: selectedDate,
        endDate: selectedDate,
        role: roleFilter !== "all" ? roleFilter : undefined,
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `daily_attendance_register_${selectedDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error("Export failed:", err);
      alert(err?.message || "Failed to export daily attendance");
    } finally {
      setExporting(false);
    }
  };

  // Helper for role badge colors
  const getRoleBadge = (role: string) => {
    switch (role?.toLowerCase()) {
      case "superadmin":
        return "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200 dark:border-purple-800";
      case "admin":
        return "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case "subadmin":
        return "bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300 border-teal-200 dark:border-teal-800";
      case "inspector":
        return "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      default:
        return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700";
    }
  };

  const formattedDateHeadline = new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Left Title & Date */}
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-primary-100 text-primary-700 dark:bg-primary-950/60 dark:text-primary-400">
                <UserCheck className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Daily Attendance Register
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Live inspection floor roster & punches for{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {formattedDateHeadline}
              </span>
            </p>
          </div>

          {/* Right Controls: Date Picker & Actions */}
          <div className="flex items-center flex-wrap gap-2.5">
            {/* Quick jump buttons */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-700/60 p-1 rounded-xl">
              <button
                type="button"
                onClick={handleSetToday}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  selectedDate === getTodayISO()
                    ? "bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={handleSetYesterday}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  selectedDate !== getTodayISO()
                    ? "bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                Yesterday
              </button>
            </div>

            {/* Custom Date Input */}
            <div className="relative">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                className="px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => loadDailyData(true)}
              disabled={refreshing}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              title="Refresh Register Data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-primary-500" : ""}`} />
            </button>

            {/* Export Excel Button */}
            <button
              type="button"
              onClick={handleExportDaily}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition-all disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{exporting ? "Exporting..." : "Export Register"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Roster */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Staff
            </span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
            {kpis.total}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Active profiles</div>
        </div>

        {/* Present Today */}
        <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Present
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-700 dark:text-emerald-300">
            {kpis.presentCount}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
            {kpis.presentRate}% turn-out
          </div>
        </div>

        {/* Live On Duty */}
        <div className="p-4 rounded-2xl bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800/60 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-400">
              Active Now
            </span>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal-500"></span>
            </span>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-teal-700 dark:text-teal-300">
            {kpis.liveCount}
          </div>
          <div className="text-[11px] text-teal-600 dark:text-teal-400 font-medium mt-0.5">
            Punched in currently
          </div>
        </div>

        {/* Late Arrivals */}
        <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Late
            </span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-amber-700 dark:text-amber-300">
            {kpis.lateCount}
          </div>
          <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
            After shift buffer
          </div>
        </div>

        {/* Half Day */}
        <div className="p-4 rounded-2xl bg-orange-50/60 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/60 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-orange-700 dark:text-orange-400">
              Half Day
            </span>
            <Clock className="w-4 h-4 text-orange-500" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-orange-700 dark:text-orange-300">
            {kpis.halfDayCount}
          </div>
          <div className="text-[11px] text-orange-600 dark:text-orange-400 mt-0.5">
            &lt;4 working hours
          </div>
        </div>

        {/* Absent */}
        <div className="p-4 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/60 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400">
              Absent
            </span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-rose-700 dark:text-rose-300">
            {kpis.absentCount}
          </div>
          <div className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
            No punch recorded
          </div>
        </div>
      </div>

      {/* Filter & Search Controls */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Role Filter */}
          <div className="relative">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Roles (Universal)</option>
              <option value="inspector">Inspectors Only</option>
              <option value="admin">Admins Only</option>
              <option value="subadmin">Subadmins Only</option>
              <option value="user">Users / Other</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Attendance Statuses</option>
              <option value="live">🟢 Active Now (Checked In)</option>
              <option value="present">Present (Completed)</option>
              <option value="late">Late Arrival</option>
              <option value="half-day">Half Day</option>
              <option value="absent">Absent / Not Punched</option>
            </select>
          </div>

          {/* Shift Filter */}
          <div className="relative">
            <select
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Detected Shifts</option>
              {shiftsList.map((s) => (
                <option key={s._id} value={s.displayName || s.name}>
                  {s.displayName || s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Roster Table Card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <RefreshCw className="w-8 h-8 text-primary-500 animate-spin mb-3" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              Loading daily attendance register...
            </p>
          </div>
        ) : filteredRoster.length === 0 ? (
          <div className="py-16 text-center">
            <UserCheck className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h4 className="text-base font-bold text-slate-700 dark:text-slate-200">
              No Attendance Records Found
            </h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              No employees matched the selected filters for {selectedDate}. Adjust your search or change the date.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider font-bold">
                  <th className="py-3.5 px-4">Employee</th>
                  <th className="py-3.5 px-3">Role</th>
                  <th className="py-3.5 px-3">Assigned Shift</th>
                  <th className="py-3.5 px-3">Punch In</th>
                  <th className="py-3.5 px-3">Punch Out</th>
                  <th className="py-3.5 px-3 text-center">Hours</th>
                  <th className="py-3.5 px-3 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Punches</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {filteredRoster.map((row) => (
                  <tr
                    key={row.userId}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors"
                  >
                    {/* Employee */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                          {row.name
                            .split(" ")
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            {row.name}
                            {row.isLive && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
                                LIVE
                              </span>
                            )}
                          </div>
                          {row.location && (
                            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 truncate max-w-[200px]" title={row.location}>
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{row.location}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="py-3 px-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider border ${getRoleBadge(
                          row.role
                        )}`}
                      >
                        {row.role}
                      </span>
                    </td>

                    {/* Shift */}
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {row.shift}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {row.shiftHours}
                      </div>
                    </td>

                    {/* Punch In */}
                    <td className="py-3 px-3 font-mono">
                      {row.checkIn ? (
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {row.checkIn}
                          </span>
                          {row.isLate && (
                            <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                              LATE
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">--</span>
                      )}
                    </td>

                    {/* Punch Out */}
                    <td className="py-3 px-3 font-mono">
                      {row.isLive ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-600 dark:text-teal-400">
                          <span className="w-2 h-2 rounded-full bg-teal-500 animate-ping" />
                          On Duty
                        </span>
                      ) : row.checkOut ? (
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {row.checkOut}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">--</span>
                      )}
                    </td>

                    {/* Hours */}
                    <td className="py-3 px-3 text-center font-mono font-semibold">
                      {row.hours > 0 ? (
                        <span className="text-slate-800 dark:text-slate-200">
                          {row.hours}h
                        </span>
                      ) : (
                        <span className="text-slate-400">--</span>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-3 text-center">
                      {row.status === "absent" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                          <XCircle className="w-3 h-3" />
                          Absent
                        </span>
                      ) : row.status === "late" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                          <AlertTriangle className="w-3 h-3" />
                          Late
                        </span>
                      ) : row.status === "half-day" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300">
                          <Clock className="w-3 h-3" />
                          Half-Day
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                          <CheckCircle2 className="w-3 h-3" />
                          Present
                        </span>
                      )}
                    </td>

                    {/* Actions / View Punches */}
                    <td className="py-3 px-4 text-right">
                      {row.punches && row.punches.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setSelectedPunchUser(row)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-primary-500 hover:text-primary-600 text-slate-600 dark:text-slate-300 text-xs font-medium transition-all"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Punches ({row.punches.length})</span>
                        </button>
                      ) : (
                        <span className="text-slate-400 text-xs">No punches</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Punches Detail Drawer / Modal */}
      {selectedPunchUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary-100 text-primary-700 dark:bg-primary-950/60 dark:text-primary-400">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Punch Timeline - {selectedPunchUser.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formattedDateHeadline} • {selectedPunchUser.shift}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPunchUser(null)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Punches Recorded ({selectedPunchUser.punches.length})
              </div>

              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {selectedPunchUser.punches.map((p, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 flex items-start justify-between gap-3"
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`p-2 rounded-lg font-bold text-xs uppercase ${
                          p.type === "in"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                        }`}
                      >
                        {p.type === "in" ? "IN" : "OUT"}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white font-mono text-sm">
                          {p.time || "--:--"}
                        </div>
                        {p.place && (
                          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{p.place}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {p.lat && p.lng && (
                      <div className="text-right text-[11px] font-mono text-slate-400 shrink-0">
                        <div>{p.lat.toFixed(4)}°, {p.lng.toFixed(4)}°</div>
                        {p.accuracy && <div>±{p.accuracy}m GPS</div>}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedPunchUser(null)}
                  className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
