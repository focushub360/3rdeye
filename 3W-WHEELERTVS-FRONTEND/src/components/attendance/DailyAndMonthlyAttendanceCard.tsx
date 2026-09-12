import React, { useState, useEffect, useCallback } from "react";
import {
  Clock,
  Calendar,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Timer,
  CalendarDays,
  Sparkles,
  ArrowUpRight,
  CalendarCheck,
  RefreshCw,
} from "lucide-react";
import { apiClient } from "../../api/client";

interface AttendanceRecord {
  _id: string;
  date: string;
  checkInTime?: string;
  checkOutTime?: string;
  workingHours?: number;
  status?: string;
  isLate?: boolean;
  isHalfDay?: boolean;
  isEarlyCheckout?: boolean;
  shift?: {
    _id?: string;
    name?: string;
    displayName?: string;
    startTime?: string;
    endTime?: string;
  };
  shiftName?: string;
  shiftStartTime?: string;
  shiftEndTime?: string;
  punches?: Array<{
    type: "in" | "out";
    time: string;
    place?: string;
  }>;
}

interface MonthlyAttendanceData {
  month: number;
  year: number;
  monthName: string;
  totalWorkingHours: number;
  targetMonthlyHours: number;
  expectedHoursSoFar: number;
  presentDays: number;
  halfDays: number;
  lateDays: number;
  earlyCheckoutDays: number;
  avgDailyHours: number;
  daysInMonth: number;
  currentDay: number;
  workingDaysSoFar: number;
  totalWorkingDaysInMonth: number;
  attendanceRate: number;
  records: AttendanceRecord[];
}

interface DailyAndMonthlyAttendanceCardProps {
  user: any;
  isCheckedIn: boolean;
  checkInTime: string | null;
  elapsedTime: string;
  onOpenPunchModal: () => void;
}

export const DailyAndMonthlyAttendanceCard: React.FC<
  DailyAndMonthlyAttendanceCardProps
> = ({ user, isCheckedIn, checkInTime, elapsedTime, onOpenPunchModal }) => {
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [data, setData] = useState<MonthlyAttendanceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const fetchMonthlyData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await apiClient.getMyMonthlyAttendanceSummary({
        month: currentMonth,
        year: currentYear,
      });
      if (response?.data) {
        setData(response.data);
      }
    } catch (error) {
      console.error("[DailyAndMonthlyAttendanceCard] Error fetching monthly data:", error);
    } finally {
      setLoading(false);
    }
  }, [user, currentMonth, currentYear]);

  useEffect(() => {
    fetchMonthlyData();
  }, [fetchMonthlyData, isCheckedIn]);

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    const today = new Date();
    const isFuture =
      currentYear > today.getFullYear() ||
      (currentYear === today.getFullYear() && currentMonth >= today.getMonth() + 1);

    if (isFuture) return;

    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  const exportMonthlyDataToCSV = () => {
    if (!data || !data.records || data.records.length === 0) return;

    const headers = [
      "Date",
      "Shift",
      "Check In",
      "Check Out",
      "Working Hours",
      "Status",
      "Punches Count",
    ];

    const rows = data.records.map((r) => [
      new Date(r.date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      r.shift?.displayName || r.shiftName || "General Shift",
      r.checkInTime
        ? new Date(r.checkInTime).toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })
        : "-",
      r.checkOutTime
        ? new Date(r.checkOutTime).toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })
        : "-",
      (r.workingHours || 0).toFixed(2),
      r.status || "present",
      r.punches?.length || 0,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute(
      "download",
      `Attendance_${data.monthName}_${data.year}.csv`,
    );
    link.setAttribute("href", encodedUri);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const progressPercent = data?.targetMonthlyHours
    ? Math.min(100, Math.round((data.totalWorkingHours / data.targetMonthlyHours) * 100))
    : 0;

  return (
    <div className="mb-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden transition-all">
      {/* Top Banner Row: Today's Status + Actions */}
      <div className="p-4 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-700/80 bg-gradient-to-r from-gray-50 via-white to-purple-50/30 dark:from-gray-800 dark:via-gray-800 dark:to-purple-950/20">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-10 bg-purple-600 rounded-full shadow-sm shadow-purple-500/20"></div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-none">
                Daily Attendance & Monthly Working Hours
              </h3>
              <span className="px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200 border border-purple-200 dark:border-purple-700">
                {data?.monthName || "Monthly"}
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-1.5 flex items-center gap-2">
              {isCheckedIn ? (
                <>
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-300">
                    Checked in at {checkInTime || "--"}
                  </span>
                  {elapsedTime && (
                    <span className="font-mono bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 px-2 py-0.5 rounded text-xs font-bold border border-emerald-300 dark:border-emerald-700">
                      {elapsedTime}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                  <span className="font-medium text-slate-600 dark:text-slate-400">You haven't checked in yet today.</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Month Navigator */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-700/80 rounded-xl p-1 border border-gray-300 dark:border-gray-600">
            <button
              onClick={handlePrevMonth}
              title="Previous Month"
              className="p-1 hover:bg-white dark:hover:bg-gray-600 rounded-lg text-slate-700 dark:text-slate-200 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap min-w-[120px] text-center">
              {data?.monthName || "Month"} {currentYear}
            </span>
            <button
              onClick={handleNextMonth}
              title="Next Month"
              className="p-1 hover:bg-white dark:hover:bg-gray-600 rounded-lg text-slate-700 dark:text-slate-200 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Punch Button */}
          <button
            type="button"
            onClick={onOpenPunchModal}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-xs transition-all shadow-sm border ${
              isCheckedIn
                ? "bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-700"
                : "bg-slate-900 text-white hover:bg-slate-800 border-slate-900 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            }`}
          >
            {isCheckedIn ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Checked In</span>
              </>
            ) : (
              <>
                <Clock className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />
                <span>Check In Now</span>
              </>
            )}
          </button>

          {/* Expand Details Toggle */}
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs text-purple-800 dark:text-purple-200 bg-purple-100/70 dark:bg-purple-900/40 border border-purple-300 dark:border-purple-700 hover:bg-purple-200 dark:hover:bg-purple-900/60 transition-colors"
          >
            <CalendarDays className="w-3.5 h-3.5 text-purple-700 dark:text-purple-300" />
            <span>{showDetails ? "Hide Logs" : "View Month Logs"}</span>
            {showDetails ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Middle Section: Monthly Working Hours & Metrics Cards */}
      <div className="p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Working Hours */}
          <div className="bg-purple-50/50 dark:bg-purple-950/20 rounded-2xl p-4 border border-purple-200 dark:border-purple-800/50 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wide text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5" />
                Working Hours
              </span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-purple-100 text-purple-900 dark:bg-purple-900/60 dark:text-purple-200 border border-purple-200 dark:border-purple-700">
                {progressPercent}% Goal
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                  {loading ? "--" : data?.totalWorkingHours?.toFixed(1) || "0.0"}
                </span>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  / {data?.targetMonthlyHours || 160} hrs
                </span>
              </div>
              {/* Progress Bar */}
              <div className="w-full h-2 bg-purple-200 dark:bg-purple-900/50 rounded-full mt-2.5 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-2">
                {data?.targetMonthlyHours && data.targetMonthlyHours > data.totalWorkingHours
                  ? `${(data.targetMonthlyHours - data.totalWorkingHours).toFixed(1)} hrs remaining this month`
                  : "Monthly target achieved!"}
              </p>
            </div>
          </div>

          {/* Card 2: Days Present */}
          <div className="bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl p-4 border border-emerald-200 dark:border-emerald-800/50 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                <CalendarCheck className="w-3.5 h-3.5" />
                Days Present
              </span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-700">
                {data?.attendanceRate || 0}% Rate
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                  {loading ? "--" : data?.presentDays || 0}
                </span>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  / {data?.workingDaysSoFar || data?.currentDay || 1} days so far
                </span>
              </div>
              <div className="w-full h-2 bg-emerald-200 dark:bg-emerald-900/50 rounded-full mt-2.5 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${data?.attendanceRate || 0}%` }}
                ></div>
              </div>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-2">
                {data?.totalWorkingDaysInMonth || 26} total scheduled days in {data?.monthName || "month"}
              </p>
            </div>
          </div>

          {/* Card 3: Avg Daily Working Hours */}
          <div className="bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl p-4 border border-blue-200 dark:border-blue-800/50 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wide text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                Avg Daily Hours
              </span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-900 dark:bg-blue-900/60 dark:text-blue-200 border border-blue-200 dark:border-blue-700">
                8.0h Norm
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                  {loading ? "--" : data?.avgDailyHours?.toFixed(1) || "0.0"}
                </span>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">hrs / day</span>
              </div>
              <div className="w-full h-2 bg-blue-200 dark:bg-blue-900/50 rounded-full mt-2.5 overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, ((data?.avgDailyHours || 0) / 8) * 100)}%`,
                  }}
                ></div>
              </div>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-2">
                {(data?.avgDailyHours || 0) >= 8.0
                  ? "Optimal working efficiency"
                  : "Below expected benchmark"}
              </p>
            </div>
          </div>

          {/* Card 4: Punctuality & Shifts */}
          <div className="bg-amber-50/50 dark:bg-amber-950/20 rounded-2xl p-4 border border-amber-200 dark:border-amber-800/50 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wide text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                Punctuality
              </span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-200 dark:border-amber-700">
                {data?.lateDays || 0} Late
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                  {loading ? "--" : Math.max(0, (data?.presentDays || 0) - (data?.lateDays || 0))}
                </span>
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  On-Time Days
                </span>
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                <span>Half-Days: <strong className="text-amber-700 dark:text-amber-300 font-extrabold">{data?.halfDays || 0}</strong></span>
                <span>•</span>
                <span>Early Outs: <strong className="text-rose-700 dark:text-rose-300 font-extrabold">{data?.earlyCheckoutDays || 0}</strong></span>
              </div>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-1">
                {data?.lateDays === 0 ? "Punctual check-in record! 🌟" : "Keep track of shift start times"}
              </p>
            </div>
          </div>
        </div>

        {/* Expandable Day-by-Day Monthly Log Table */}
        {showDetails && (
          <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                  {data?.monthName} {data?.year} — Daily Attendance History & Hours
                </h4>
                <span className="text-xs text-gray-400">
                  ({data?.records?.length || 0} recorded entries)
                </span>
              </div>

              {data?.records && data.records.length > 0 && (
                <button
                  onClick={exportMonthlyDataToCSV}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-bold hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors border border-gray-200 dark:border-gray-600"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Month Data
                </button>
              )}
            </div>

            {loading ? (
              <div className="text-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-purple-600 mx-auto mb-2" />
                <p className="text-xs text-gray-500">Loading monthly attendance history...</p>
              </div>
            ) : !data?.records || data.records.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 dark:bg-gray-900/30 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                <Calendar className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-xs font-bold text-gray-500">No attendance logs found for {data?.monthName} {currentYear}.</p>
                <p className="text-[11px] text-gray-400 mt-1">Check-in daily using the button above to accumulate working hours.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 max-h-[420px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-gray-50 dark:bg-gray-700/80 sticky top-0 z-10 uppercase text-[10px] font-black tracking-wider text-gray-500 dark:text-gray-300">
                    <tr>
                      <th className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-700">Date</th>
                      <th className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-700">Shift</th>
                      <th className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-700 text-center">Check-In</th>
                      <th className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-700 text-center">Check-Out</th>
                      <th className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-700 text-center">Logged Hours</th>
                      <th className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-700 text-center">Status</th>
                      <th className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-700 text-center">Punches</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700 font-medium">
                    {data.records.map((r, idx) => {
                      const recordDate = new Date(r.date);
                      const isToday =
                        new Date().toDateString() === recordDate.toDateString();

                      return (
                        <tr
                          key={r._id || idx}
                          className={`hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors ${
                            isToday ? "bg-purple-50/30 dark:bg-purple-950/20 font-bold" : ""
                          }`}
                        >
                          <td className="px-3 py-2.5 whitespace-nowrap text-gray-900 dark:text-white">
                            <div className="flex items-center gap-1.5">
                              {isToday && (
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-600"></span>
                              )}
                              <span>
                                {recordDate.toLocaleDateString("en-IN", {
                                  weekday: "short",
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-gray-600 dark:text-gray-300">
                            {r.shift?.displayName || r.shiftName || "General Shift"}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-center font-mono font-bold text-gray-800 dark:text-gray-200">
                            {r.checkInTime
                              ? new Date(r.checkInTime).toLocaleTimeString("en-IN", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: true,
                                })
                              : "—"}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-center font-mono font-bold text-gray-800 dark:text-gray-200">
                            {r.checkOutTime ? (
                              new Date(r.checkOutTime).toLocaleTimeString("en-IN", {
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: true,
                              })
                            ) : r.checkInTime ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-sans text-[11px] font-bold">
                                Running...
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-center tabular-nums font-black text-purple-700 dark:text-purple-300">
                            {(r.workingHours || 0).toFixed(2)} hrs
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                r.status === "half-day" || r.isHalfDay
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                                  : r.status === "late" || r.isLate
                                  ? "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300"
                                  : r.status === "absent"
                                  ? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                                  : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                              }`}
                            >
                              {r.isHalfDay
                                ? "Half Day"
                                : r.isLate
                                ? "Late Entry"
                                : r.status || "Present"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-center text-gray-500 dark:text-gray-400">
                            {r.punches && r.punches.length > 0 ? (
                              <span className="font-mono text-[11px]">
                                {r.punches.length} punch{r.punches.length > 1 ? "es" : ""}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
