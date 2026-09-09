import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiClient } from "../api/client";
import { useAuth } from "./AuthContext";

export interface AttendanceRecord {
  _id?: string;
  checkInTime?: string;
  checkOutTime?: string | null;
  status?: string;
  isLate?: boolean;
  isHalfDay?: boolean;
  isEarlyCheckout?: boolean;
  workingHours?: number;
  shiftName?: string;
  shiftStartTime?: string;
  shiftEndTime?: string;
  punches?: Array<{
    type: "in" | "out";
    time: string;
    lat?: number;
    lng?: number;
    place?: string;
    accuracy?: number;
  }>;
  [key: string]: any;
}

export interface ShiftRecord {
  _id?: string;
  name?: string;
  displayName?: string;
  startTime?: string;
  endTime?: string;
  isNightShift?: boolean;
  gracePeriod?: number;
  lateMarkingAfter?: number;
  halfDayMarkingAfter?: number;
  [key: string]: any;
}

interface AttendanceContextType {
  isCheckedIn: boolean;
  loading: boolean;
  attendance: AttendanceRecord | null;
  shift: ShiftRecord | null;
  canCheckIn: boolean;
  canCheckOut: boolean;
  checkInTime: string | null;
  elapsedTime: string;
  refreshStatus: () => Promise<void>;
  punchIn: (customLocation?: { lat?: number; lng?: number; accuracy?: number; otp?: string }) => Promise<{ success: boolean; message?: string }>;
  punchOut: (customLocation?: { lat?: number; lng?: number; accuracy?: number }) => Promise<{ success: boolean; message?: string }>;
}

const AttendanceContext = createContext<AttendanceContextType>({
  isCheckedIn: false,
  loading: true,
  attendance: null,
  shift: null,
  canCheckIn: false,
  canCheckOut: false,
  checkInTime: null,
  elapsedTime: "",
  refreshStatus: async () => {},
  punchIn: async () => ({ success: false, message: "Not initialized" }),
  punchOut: async () => ({ success: false, message: "Not initialized" }),
});

const getBrowserLocation = (): Promise<{ lat: number; lng: number; accuracy: number }> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ lat: 0, lng: 0, accuracy: 0 });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy || 10,
        });
      },
      () => {
        // Fallback gracefully on permission denial or timeout
        resolve({ lat: 0, lng: 0, accuracy: 0 });
      },
      { timeout: 6000, enableHighAccuracy: false }
    );
  });
};

export function AttendanceProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);
  const [shift, setShift] = useState<ShiftRecord | null>(null);
  const [canCheckIn, setCanCheckIn] = useState(false);
  const [canCheckOut, setCanCheckOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const [elapsedTime, setElapsedTime] = useState("");

  const refreshStatus = useCallback(async () => {
    if (!isAuthenticated) {
      setIsCheckedIn(false);
      setAttendance(null);
      setShift(null);
      setCanCheckIn(false);
      setCanCheckOut(false);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await apiClient.getMyHRAttendanceStatus();
      const statusData = response?.data || response;

      const att: AttendanceRecord | null = statusData?.attendance || null;
      const sh: ShiftRecord | null = statusData?.shift || null;
      const checkedIn = !!(att?.checkInTime && !att?.checkOutTime);

      setAttendance(att);
      setShift(sh);
      setIsCheckedIn(checkedIn);
      setCanCheckIn(statusData?.canCheckIn !== undefined ? !!statusData.canCheckIn : !checkedIn);
      setCanCheckOut(statusData?.canCheckOut !== undefined ? !!statusData.canCheckOut : checkedIn);
    } catch (error) {
      console.error("Error fetching attendance status:", error);
      setIsCheckedIn(false);
      setAttendance(null);
      setShift(null);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refreshStatus();
  }, [user, isAuthenticated, refreshStatus]);

  // Live timer for elapsed time since check-in
  useEffect(() => {
    if (!isCheckedIn || !attendance?.checkInTime) {
      setElapsedTime("");
      return;
    }

    const checkInMs = new Date(attendance.checkInTime).getTime();

    const updateTimer = () => {
      const nowMs = Date.now();
      const diffMs = Math.max(0, nowMs - checkInMs);
      const totalSecs = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSecs / 3600);
      const minutes = Math.floor((totalSecs % 3600) / 60);
      const seconds = totalSecs % 60;

      const pad = (n: number) => n.toString().padStart(2, "0");
      setElapsedTime(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isCheckedIn, attendance?.checkInTime]);

  const punchIn = async (customLocation?: { lat?: number; lng?: number; accuracy?: number; otp?: string }) => {
    try {
      setLoading(true);
      const coords = customLocation?.lat !== undefined && customLocation?.lng !== undefined
        ? { lat: customLocation.lat, lng: customLocation.lng, accuracy: customLocation.accuracy || 10 }
        : await getBrowserLocation();

      await apiClient.checkIn({
        lat: coords.lat,
        lng: coords.lng,
        accuracy: coords.accuracy,
        otp: customLocation?.otp,
      });

      await refreshStatus();
      return { success: true };
    } catch (err: any) {
      console.error("Punch In failed:", err);
      return { success: false, message: err?.message || "Check-in failed" };
    } finally {
      setLoading(false);
    }
  };

  const punchOut = async (customLocation?: { lat?: number; lng?: number; accuracy?: number }) => {
    try {
      setLoading(true);
      const coords = customLocation?.lat !== undefined && customLocation?.lng !== undefined
        ? { lat: customLocation.lat, lng: customLocation.lng, accuracy: customLocation.accuracy || 10 }
        : await getBrowserLocation();

      await apiClient.checkOut({
        lat: coords.lat,
        lng: coords.lng,
        accuracy: coords.accuracy,
      });

      await refreshStatus();
      return { success: true };
    } catch (err: any) {
      console.error("Punch Out failed:", err);
      return { success: false, message: err?.message || "Check-out failed" };
    } finally {
      setLoading(false);
    }
  };

  const checkInTime = attendance?.checkInTime
    ? new Date(attendance.checkInTime).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : null;

  return (
    <AttendanceContext.Provider
      value={{
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
      }}
    >
      {children}
    </AttendanceContext.Provider>
  );
}

export const useAttendanceStatus = () => useContext(AttendanceContext);
