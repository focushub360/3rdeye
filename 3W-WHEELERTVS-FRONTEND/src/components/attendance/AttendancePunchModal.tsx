import React, { useState, useEffect } from "react";
import {
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  X,
  LogOut,
  LogIn,
  Layers,
  Timer,
  RefreshCw,
} from "lucide-react";
import { useAttendanceStatus } from "../../context/AttendanceContext";
import { useAuth } from "../../context/AuthContext";

interface AttendancePunchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AttendancePunchModal: React.FC<AttendancePunchModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user } = useAuth();
  const {
    isCheckedIn,
    loading,
    attendance,
    shift,
    canCheckIn,
    canCheckOut,
    checkInTime,
    elapsedTime,
    refreshStatus,
    punchIn,
    punchOut,
  } = useAttendanceStatus();

  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [gpsStatus, setGpsStatus] = useState<"ready" | "fetching" | "denied">("ready");
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Live IST Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
      setCurrentDate(
        now.toLocaleDateString("en-IN", {
          weekday: "long",
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      );
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Geolocation on modal open
  useEffect(() => {
    if (!isOpen) return;
    setActionError(null);

    if (navigator.geolocation) {
      setGpsStatus("fetching");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocationCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy || 10),
          });
          setGpsStatus("ready");
        },
        (err) => {
          console.warn("Geolocation prompt denied or timed out:", err.message);
          setGpsStatus("denied");
          // Fallback coords
          setLocationCoords({ lat: 0, lng: 0, accuracy: 0 });
        },
        { enableHighAccuracy: false, timeout: 6000 }
      );
    } else {
      setGpsStatus("denied");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePunchIn = async () => {
    try {
      setSubmitting(true);
      setActionError(null);
      const res = await punchIn(locationCoords || undefined);
      if (res.success) {
        onClose();
      } else {
        setActionError(res.message || "Failed to check in");
      }
    } catch (err: any) {
      setActionError(err?.message || "An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePunchOut = async () => {
    try {
      setSubmitting(true);
      setActionError(null);
      const res = await punchOut(locationCoords || undefined);
      if (res.success) {
        onClose();
      } else {
        setActionError(res.message || "Failed to check out");
      }
    } catch (err: any) {
      setActionError(err?.message || "An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const shiftDisplayName =
    shift?.displayName || shift?.name || attendance?.shiftName || "Auto-detected Shift";
  const shiftTimeRange =
    shift?.startTime && shift?.endTime
      ? `${shift.startTime} - ${shift.endTime}`
      : attendance?.shiftStartTime && attendance?.shiftEndTime
      ? `${attendance.shiftStartTime} - ${attendance.shiftEndTime}`
      : "Standard Hours";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-800/80">
          <div className="flex items-center space-x-3">
            <div
              className={`p-2.5 rounded-xl ${
                isCheckedIn
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                  : "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400"
              }`}
            >
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">
                Attendance Punch Console
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Logged in as <span className="font-semibold text-slate-700 dark:text-slate-200">{user?.name || user?.firstName || "User"}</span> ({user?.role || "Staff"})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Live Clock Card */}
          <div className="flex flex-col items-center justify-center py-8 bg-slate-50 dark:bg-slate-800/50 rounded-2xl relative">
            <div className="absolute top-3 right-4 flex items-center space-x-1.5 text-xs text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>IST</span>
            </div>
            <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
              {currentDate}
            </div>
            <div className="text-5xl font-bold tracking-tight text-slate-800 dark:text-white drop-shadow-sm font-sans mb-1">
              {currentTime || "--:--:--"}
            </div>

            {/* Current Status Pill */}
            <div className="mt-4 flex items-center gap-2">
              {isCheckedIn ? (
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Checked In since {checkInTime || "--"}
                  {elapsedTime && (
                    <span className="ml-1 font-mono text-emerald-600 dark:text-emerald-500">
                      ({elapsedTime})
                    </span>
                  )}
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Ready to Check In
                </div>
              )}
            </div>
          </div>

          {/* Detected Shift & Location Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Shift Card */}
            <div className="flex flex-col p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 mb-2">
                <Layers className="w-4 h-4 text-slate-400" />
                <span>Detected Shift</span>
              </div>
              <div className="text-sm font-bold text-slate-800 dark:text-white truncate" title={shiftDisplayName}>
                {shiftDisplayName}
              </div>
              <div className="text-xs text-slate-500 font-medium mt-1">
                {shiftTimeRange}
              </div>
            </div>

            {/* GPS Location Card */}
            <div className="flex flex-col p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 mb-2">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span>Punch Location</span>
              </div>
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {gpsStatus === "fetching" ? (
                  <span className="text-slate-400 italic">Detecting location...</span>
                ) : gpsStatus === "denied" ? (
                  <span className="text-amber-600 dark:text-amber-400 text-xs font-medium">Browser location optional</span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                    GPS Locked (±{locationCoords?.accuracy || 10}m)
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 truncate mt-1">
                {locationCoords?.lat && locationCoords?.lng
                  ? `${locationCoords.lat.toFixed(6)}, ${locationCoords.lng.toFixed(6)}`
                  : "Auto-stamped by system"}
              </div>
            </div>
          </div>

          {/* Today's Punch History Timeline if punches exist */}
          {attendance?.punches && attendance.punches.length > 0 && (
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Timer className="w-3.5 h-3.5 text-slate-400" />
                  Today's Punches ({attendance.punches.length})
                </span>
                {attendance.workingHours !== undefined && (
                  <span className="text-[11px] font-mono text-slate-500">
                    Logged: {attendance.workingHours} hrs
                  </span>
                )}
              </div>
              <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                {attendance.punches.map((p, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs py-1 px-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          p.type === "in" ? "bg-emerald-500" : "bg-rose-500"
                        }`}
                      />
                      <span className="font-semibold uppercase tracking-wider text-[10px] text-slate-700 dark:text-slate-300">
                        {p.type === "in" ? "Punch In" : "Punch Out"}
                      </span>
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      {p.time
                        ? new Date(p.time).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                            hour12: true,
                          })
                        : "--"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Message */}
          {actionError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{actionError}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2">
            {!isCheckedIn ? (
              <button
                type="button"
                onClick={handlePunchIn}
                disabled={submitting || loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Recording Punch In...
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    Punch In Now
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePunchOut}
                disabled={submitting || loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-bold text-sm text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Recording Punch Out...
                  </>
                ) : (
                  <>
                    <LogOut className="w-5 h-5" />
                    Punch Out Now
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
