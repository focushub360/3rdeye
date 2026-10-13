import React, { useState, useEffect, useMemo } from "react";
import type { FollowUpQuestion } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import {
  Layers,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Plus,
  RotateCcw,
  Sparkles,
} from "lucide-react";

interface RangeQuestionProps {
  question: FollowUpQuestion;
  value: string | number | any;
  onChange: (value: string) => void;
  readOnly?: boolean;
  error?: boolean;
  isApplied?: boolean;
}

// Helper to safely parse incoming range value (supports JSON object, "start - end" string, or single number)
const parseRangeValue = (val: any): { start: string; end: string } => {
  if (!val && val !== 0) return { start: "", end: "" };
  if (typeof val === "object" && val !== null) {
    return {
      start: val.start !== undefined ? String(val.start) : "",
      end: val.end !== undefined ? String(val.end) : "",
    };
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && (parsed.start !== undefined || parsed.end !== undefined)) {
          return {
            start: parsed.start !== undefined ? String(parsed.start) : "",
            end: parsed.end !== undefined ? String(parsed.end) : "",
          };
        }
      } catch {}
    }
    if (trimmed.includes(" - ")) {
      const [s, e] = trimmed.split(" - ");
      return { start: s?.trim() || "", end: e?.trim() || "" };
    }
    return { start: trimmed, end: trimmed };
  }
  const s = String(val);
  return { start: s, end: s };
};

// Calculate list of chassis units from high to low (shows last 35 down to 30)
export const calculateChassisRange = (
  startStr: string,
  endStr: string,
  maxLimit: number = 200
): { list: string[]; count: number; isValid: boolean; errorMsg?: string; highVal: string; lowVal: string } => {
  const start = String(startStr || "").trim();
  const end = String(endStr || "").trim();

  if (!start && !end) return { list: [], count: 0, isValid: true, highVal: "", lowVal: "" };
  if (!start || !end) {
    const single = start || end;
    return { list: [single], count: 1, isValid: true, highVal: single, lowVal: single };
  }
  if (start === end) return { list: [start], count: 1, isValid: true, highVal: start, lowVal: start };

  // 1. Pure numbers
  const isNumericStart = /^\d+$/.test(start);
  const isNumericEnd = /^\d+$/.test(end);

  if (isNumericStart && isNumericEnd) {
    const n1 = parseInt(start, 10);
    const n2 = parseInt(end, 10);
    const low = Math.min(n1, n2);
    const high = Math.max(n1, n2);
    const total = high - low + 1;
    const count = Math.min(total, maxLimit);
    const padLen = Math.max(start.length, end.length);
    const list: string[] = [];

    // Order descending: from last high (35) down to low (30)
    for (let i = 0; i < count; i++) {
      const val = String(high - i);
      list.push(padLen > 0 ? val.padStart(padLen, "0") : val);
    }
    return {
      list,
      count: total,
      isValid: true,
      highVal: padLen > 0 ? String(high).padStart(padLen, "0") : String(high),
      lowVal: padLen > 0 ? String(low).padStart(padLen, "0") : String(low),
    };
  }

  // 2. Prefix + Numeric Suffix (e.g. S8-VRT-30 to S8-VRT-35)
  const startMatch = start.match(/^(.*?)(\d+)$/);
  const endMatch = end.match(/^(.*?)(\d+)$/);

  if (startMatch && endMatch && startMatch[1] === endMatch[1]) {
    const prefix = startMatch[1];
    const n1 = parseInt(startMatch[2], 10);
    const n2 = parseInt(endMatch[2], 10);
    const low = Math.min(n1, n2);
    const high = Math.max(n1, n2);
    const padLen = Math.max(startMatch[2].length, endMatch[2].length);

    const total = high - low + 1;
    const count = Math.min(total, maxLimit);
    const list: string[] = [];

    // Order descending: from last high (S8-VRT-35) down to low (S8-VRT-30)
    for (let i = 0; i < count; i++) {
      const val = String(high - i).padStart(padLen, "0");
      list.push(`${prefix}${val}`);
    }
    return {
      list,
      count: total,
      isValid: true,
      highVal: `${prefix}${String(high).padStart(padLen, "0")}`,
      lowVal: `${prefix}${String(low).padStart(padLen, "0")}`,
    };
  }

  // Fallback string compare
  return { list: [end, start], count: 2, isValid: true, highVal: end, lowVal: start };
};

export default function RangeQuestion({
  question,
  value,
  onChange,
  readOnly = false,
  error = false,
  isApplied = false,
}: RangeQuestionProps) {
  const { darkMode } = useTheme();

  const startLabel = question.minLabel || "Start Chassis Number";
  const endLabel = question.maxLabel || "End Chassis Number";

  const initialParsed = useMemo(() => parseRangeValue(value), [value]);
  const [startVal, setStartVal] = useState<string>(initialParsed.start);
  const [endVal, setEndVal] = useState<string>(initialParsed.end);

  // Sync external changes
  useEffect(() => {
    const parsed = parseRangeValue(value);
    setStartVal(parsed.start);
    setEndVal(parsed.end);
  }, [value]);

  const rangeInfo = useMemo(() => {
    return calculateChassisRange(startVal, endVal);
  }, [startVal, endVal]);

  const triggerChange = (newStart: string, newEnd: string) => {
    if (readOnly) return;
    setStartVal(newStart);
    setEndVal(newEnd);

    if (!newStart && !newEnd) {
      onChange("");
      return;
    }

    // Emit JSON structure representing the range
    const payload = JSON.stringify({
      start: newStart.trim(),
      end: newEnd.trim(),
    });
    onChange(payload);
  };

  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextStart = e.target.value;
    triggerChange(nextStart, endVal);
  };

  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextEnd = e.target.value;
    triggerChange(startVal, nextEnd);
  };

  const handleApplyPresetOffset = (offset: number) => {
    if (readOnly || !startVal) return;

    // Check if start is pure numeric
    if (/^\d+$/.test(startVal)) {
      const nStart = parseInt(startVal, 10);
      const nEnd = nStart + offset;
      const padLen = startVal.length;
      const nextEnd = padLen > 0 ? String(nEnd).padStart(padLen, "0") : String(nEnd);
      triggerChange(startVal, nextEnd);
      return;
    }

    // Check if prefix + number
    const match = startVal.match(/^(.*?)(\d+)$/);
    if (match) {
      const prefix = match[1];
      const sNum = parseInt(match[2], 10);
      const padLen = match[2].length;
      const eNum = sNum + offset;
      const nextEnd = `${prefix}${String(eNum).padStart(padLen, "0")}`;
      triggerChange(startVal, nextEnd);
    }
  };

  const handleReset = () => {
    if (readOnly) return;
    triggerChange("", "");
  };

  return (
    <div
      className={`p-5 rounded-2xl border transition-all duration-200 ${
        error || !rangeInfo.isValid
          ? "border-red-300 bg-red-50/40 dark:border-red-800 dark:bg-red-950/20"
          : isApplied
          ? "border-emerald-300 bg-emerald-50/30 dark:border-emerald-800 dark:bg-emerald-950/20"
          : darkMode
          ? "border-gray-800 bg-gray-900/60 shadow-inner"
          : "border-blue-100 bg-gradient-to-b from-blue-50/30 to-white shadow-sm"
      }`}
    >
      {/* Top Header Card */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
              !rangeInfo.isValid
                ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
                : isApplied
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                : "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
            }`}
          >
            <Layers size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider block">
                Chassis Range Selection
              </span>
              {rangeInfo.isValid && rangeInfo.count > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {rangeInfo.count} {rangeInfo.count === 1 ? "unit" : "units"}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Enter Start and End chassis number to generate responses for this range
            </p>
          </div>
        </div>

        {/* Clear Button */}
        {!readOnly && (startVal || endVal) && (
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
            title="Clear range inputs"
          >
            <RotateCcw size={13} />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Dual Inputs Grid: Start and End */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Start Chassis Number */}
        <div className="space-y-1.5">
          <label className="flex items-center justify-between text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            <span>{startLabel} *</span>
            <span className="text-[10px] font-normal text-blue-600 dark:text-blue-400">
              Starting Unit
            </span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={startVal}
              onChange={handleStartChange}
              disabled={readOnly}
              placeholder={question.min !== undefined ? String(question.min) : "e.g., 604001"}
              className={`w-full px-3.5 py-2.5 text-sm font-mono font-semibold rounded-xl border-2 transition-all focus:outline-none ${
                !rangeInfo.isValid
                  ? "border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-200 bg-red-50/20"
                  : darkMode
                  ? "border-gray-700 bg-gray-800 text-gray-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-900"
                  : "border-gray-200 bg-white text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              } ${readOnly ? "cursor-not-allowed opacity-75" : ""}`}
            />
          </div>
        </div>

        {/* End Chassis Number */}
        <div className="space-y-1.5">
          <label className="flex items-center justify-between text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            <span>{endLabel} *</span>
            <span className="text-[10px] font-normal text-blue-600 dark:text-blue-400">
              Ending Unit
            </span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={endVal}
              onChange={handleEndChange}
              disabled={readOnly}
              placeholder={question.max !== undefined ? String(question.max) : "e.g., 604010"}
              className={`w-full px-3.5 py-2.5 text-sm font-mono font-semibold rounded-xl border-2 transition-all focus:outline-none ${
                !rangeInfo.isValid
                  ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-200 bg-red-50/30"
                  : darkMode
                  ? "border-gray-700 bg-gray-800 text-gray-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-900"
                  : "border-gray-200 bg-white text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              } ${readOnly ? "cursor-not-allowed opacity-75" : ""}`}
            />
          </div>
        </div>
      </div>

      {/* Validation Message Banner */}
      {!rangeInfo.isValid && (
        <div className="mt-3.5 p-3 rounded-xl bg-red-50 border border-red-200 dark:bg-red-950/40 dark:border-red-900/60 flex items-center gap-2.5 text-red-700 dark:text-red-300 text-xs font-medium animate-in fade-in duration-200">
          <AlertCircle size={16} className="shrink-0 text-red-500" />
          <span>{rangeInfo.errorMsg || "End chassis number must be greater than or equal to start chassis number."}</span>
        </div>
      )}

      {/* Live Preview Chips when valid and filled */}
      {rangeInfo.isValid && startVal && endVal && (
        <div className="mt-3.5 pt-3 border-t border-gray-100 dark:border-gray-800">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 size={14} className="text-emerald-500" />
              <span>
                {rangeInfo.count} responses will be created ({rangeInfo.highVal} down to {rangeInfo.lowVal})
              </span>
            </div>
            {rangeInfo.count > 10 && (
              <span className="text-[11px] text-gray-400 font-mono">
                Showing first 10 of {rangeInfo.count}
              </span>
            )}
          </div>

          {/* Interactive sample chassis preview tags */}
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto py-1">
            {rangeInfo.list.slice(0, 10).map((ch, idx) => (
              <span
                key={idx}
                className="px-2.5 py-1 text-xs font-mono font-medium rounded-lg bg-white dark:bg-gray-800 border border-blue-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 shadow-2xs"
              >
                {ch}
              </span>
            ))}
            {rangeInfo.list.length > 10 && (
              <span className="px-2 py-1 text-xs font-mono text-gray-400 self-center">
                +{rangeInfo.count - 10} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Quick Batch Presets for Faster Entry on the floor */}
      {!readOnly && startVal && (
        <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs">
          <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 mr-1 flex items-center gap-1">
            <Sparkles size={12} />
            Quick Range:
          </span>
          <button
            type="button"
            onClick={() => triggerChange(startVal, startVal)}
            className="px-2 py-1 font-mono font-medium rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
          >
            Single Unit (1)
          </button>
          <button
            type="button"
            onClick={() => handleApplyPresetOffset(4)}
            className="px-2 py-1 font-mono font-medium rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/40 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 transition-colors"
          >
            +5 Units
          </button>
          <button
            type="button"
            onClick={() => handleApplyPresetOffset(9)}
            className="px-2 py-1 font-mono font-medium rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/40 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 transition-colors"
          >
            +10 Units
          </button>
          <button
            type="button"
            onClick={() => handleApplyPresetOffset(19)}
            className="px-2 py-1 font-mono font-medium rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/40 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 transition-colors"
          >
            +20 Units
          </button>
        </div>
      )}
    </div>
  );
}
