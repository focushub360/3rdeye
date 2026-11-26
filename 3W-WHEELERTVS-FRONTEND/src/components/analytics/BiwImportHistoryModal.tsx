import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  History,
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  User,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { apiClient } from "../../api/client";

interface BiwImportHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  formId: string;
  formTitle: string;
  onUndoSuccess?: () => void;
}

export const BiwImportHistoryModal: React.FC<BiwImportHistoryModalProps> = ({
  isOpen,
  onClose,
  formId,
  formTitle,
  onUndoSuccess,
}) => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [confirmUndoId, setConfirmUndoId] = useState<string | null>(null);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [bannerMsg, setBannerMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [nowTick, setNowTick] = useState<number>(Date.now());

  const fetchHistory = useCallback(async () => {
    if (!formId) return;
    setLoading(true);
    try {
      const res = await apiClient.getImportHistory({ formId, limit: 50 });
      const list = res?.data?.items || res?.items || [];
      setItems(Array.isArray(list) ? list : []);
    } catch (err: any) {
      setBannerMsg({ type: "error", text: err?.message || "Failed to load import history" });
    } finally {
      setLoading(false);
    }
  }, [formId]);

  useEffect(() => {
    if (!isOpen) {
      setConfirmUndoId(null);
      setBannerMsg(null);
      return;
    }
    fetchHistory();
  }, [isOpen, fetchHistory]);

  // 1-second timer for live 5-hour undo countdown
  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleUndo = async (item: any) => {
    setUndoingId(item._id);
    setBannerMsg(null);
    try {
      const res = await apiClient.undoImportHistory(item._id);
      setBannerMsg({
        type: "success",
        text: res?.message || "Import undone successfully and records restored.",
      });
      setConfirmUndoId(null);
      await fetchHistory();
      onUndoSuccess?.();
    } catch (err: any) {
      setBannerMsg({
        type: "error",
        text: err?.message || "Failed to undo import.",
      });
    } finally {
      setUndoingId(null);
    }
  };

  const formatCountdown = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
    }
    return `${m}m ${String(s).padStart(2, "0")}s`;
  };

  const formatRelativeTime = (iso: string) => {
    const diffSec = Math.max(0, Math.floor((nowTick - new Date(iso).getTime()) / 1000));
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${Math.floor(diffHr / 24)}d ago`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-[96vw] sm:w-[72vw] max-w-[1280px] max-h-[90vh] flex flex-col bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl border border-white/20">
              <History className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold tracking-tight text-white">Import History & Undo Timeline</h3>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-amber-500/20 text-amber-200 border border-amber-400/30 rounded-full">
                  5-Hr Undo Enabled
                </span>
              </div>
              <p className="text-xs text-indigo-200/80">
                Track applied Excel imports, timestamps, per-chassis changes & revert mistakes for {formTitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchHistory}
              disabled={loading}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              title="Refresh History"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {bannerMsg && (
            <div
              className={`p-3.5 rounded-xl border text-xs sm:text-sm font-semibold flex items-center gap-2.5 ${
                bannerMsg.type === "success"
                  ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                  : "bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200"
              }`}
            >
              {bannerMsg.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{bannerMsg.text}</span>
            </div>
          )}

          {loading && items.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 gap-2">
              <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
              <span className="text-sm font-medium">Loading import timeline...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-gray-500 dark:text-gray-400">
              <History className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold">No Excel import history found for this form yet.</p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-indigo-200 dark:before:bg-indigo-900/60">
              {items.map((item) => {
                const ageMs = nowTick - new Date(item.createdAt).getTime();
                const UNDO_WINDOW_MS = 5 * 60 * 60 * 1000;
                const liveRemainingSec = Math.max(0, Math.floor((UNDO_WINDOW_MS - ageMs) / 1000));
                const canUndoNow = Boolean(item.canUndo && !item.isUndone && liveRemainingSec > 0);
                const isExpanded = expandedIds.has(item._id);
                const changes: any[] = Array.isArray(item.changes) ? item.changes : [];

                return (
                  <div key={item._id} className="relative">
                    {/* Timeline dot */}
                    <span
                      className={`absolute -left-[21px] top-4 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-gray-900 shadow-xs ${
                        item.isUndone
                          ? "bg-amber-500"
                          : item.status === "failed"
                            ? "bg-rose-500"
                            : "bg-emerald-500"
                      }`}
                    />

                    <div
                      className={`rounded-xl border p-4 transition-all ${
                        item.isUndone
                          ? "bg-amber-50/40 dark:bg-amber-950/10 border-amber-200 dark:border-amber-800/60"
                          : "bg-white dark:bg-gray-800/70 border-gray-200 dark:border-gray-700 shadow-xs"
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200">
                              {item.actionTitle || item.actionType}
                            </span>
                            {item.isUndone && (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                ↺ Undone {item.undoneByName ? `by ${item.undoneByName}` : ""}
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 font-medium">
                              <Clock className="w-3.5 h-3.5" />
                              {new Date(item.createdAt).toLocaleString()} ({formatRelativeTime(item.createdAt)})
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-700 dark:text-gray-300">
                            <span className="inline-flex items-center gap-1 font-semibold">
                              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                              {item.fileName || "Excel Import"}
                            </span>
                            <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400">
                              <User className="w-3.5 h-3.5" />
                              {item.userName || "Admin"}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs">
                            <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                              Applied: {item.dataCount?.success ?? 0}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold">
                              Total Rows: {item.dataCount?.total ?? 0}
                            </span>
                            {(item.dataCount?.failed ?? 0) > 0 && (
                              <span className="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-semibold">
                                Skipped/Failed: {item.dataCount.failed}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions: View Changes & 5-Hr Undo */}
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {changes.length > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(item._id)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 flex items-center gap-1.5 cursor-pointer"
                            >
                              <span>{isExpanded ? "Hide Changes" : `View Changes (${changes.length})`}</span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          )}

                          {canUndoNow && (
                            confirmUndoId === item._id ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={undoingId === item._id}
                                  onClick={() => handleUndo(item)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                                >
                                  {undoingId === item._id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  )}
                                  Confirm Undo
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmUndoId(null)}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-200 cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmUndoId(item._id)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-xs flex items-center gap-1.5 cursor-pointer"
                                title="Revert all changes from this import (available for 5 hours)"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Undo ({formatCountdown(liveRemainingSec)})</span>
                              </button>
                            )
                          )}
                        </div>
                      </div>

                      {/* Expanded per-chassis change list */}
                      {isExpanded && changes.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 max-h-56 overflow-y-auto space-y-1.5">
                          {changes.map((c: any, idx: number) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-900/60 text-xs border border-gray-100 dark:border-gray-800"
                            >
                              <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300 shrink-0">
                                {c.chassisNumber || `Row ${idx + 1}`}
                                {c.target === "child" ? " (2nd Form)" : ""}
                              </span>
                              <span className="text-gray-600 dark:text-gray-300 truncate">
                                {c.changeSummary || item.details?.notes || "Updated"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Only imports made within the last 5 hours can be undone to protect historical audit integrity.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
