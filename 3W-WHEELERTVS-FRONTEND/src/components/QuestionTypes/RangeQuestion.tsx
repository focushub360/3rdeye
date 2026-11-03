import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { FollowUpQuestion } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { apiClient } from "../../api/client";
import {
  Layers,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Sparkles,
  ChevronDown,
  Search,
  Database,
  RefreshCw,
  X,
  Tag,
  ArrowRight,
  ArrowUpRight,
  ExternalLink,
} from "lucide-react";

interface RangeQuestionProps {
  question: FollowUpQuestion;
  value: string | number | any;
  onChange: (value: string) => void;
  readOnly?: boolean;
  error?: boolean;
  isApplied?: boolean;
  formId?: string;
  tenantSlug?: string;
  availableIdentificationNumbers?: string[];
}

// Safely parse incoming range value (supports JSON object, "start - end" string, or single value)
export const parseRangeValue = (val: any): { start: string; end: string } => {
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

// Split alphanumeric string into prefix and terminal number
export const splitPrefixAndNumber = (
  str: string
): { prefix: string; num: number; padLen: number; rawNumStr: string } | null => {
  if (!str) return null;
  const s = String(str).trim();

  // 1. Matches prefix ending in non-digit and terminal digits: e.g. "Oct 05-VPM-01" -> prefix: "Oct 05-VPM-", num: 1
  const m = s.match(/^(.*[^\d])(\d+)$/);
  if (m) {
    return {
      prefix: m[1],
      num: parseInt(m[2], 10),
      padLen: m[2].length,
      rawNumStr: m[2],
    };
  }

  // 2. Pure digits: e.g. "604001"
  if (/^\d+$/.test(s)) {
    return {
      prefix: "",
      num: parseInt(s, 10),
      padLen: s.length,
      rawNumStr: s,
    };
  }

  return null;
};

// Find longest common prefix among strings
export const findLongestCommonPrefix = (strings: string[]): string => {
  if (!strings || strings.length === 0) return "";
  const clean = strings.filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) {
    const spl = splitPrefixAndNumber(clean[0]);
    return spl ? spl.prefix : "";
  }
  let prefix = clean[0];
  for (let i = 1; i < clean.length; i++) {
    while (clean[i].indexOf(prefix) !== 0) {
      prefix = prefix.substring(0, prefix.length - 1);
      if (!prefix) return "";
    }
  }
  return prefix;
};

// Calculate list of identification units from start to end
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

  const startParsed = splitPrefixAndNumber(start);
  const endParsed = splitPrefixAndNumber(end);

  // If both have numbers and matching prefix (or both pure numbers)
  if (startParsed && endParsed && startParsed.prefix === endParsed.prefix) {
    const prefix = startParsed.prefix;
    const n1 = startParsed.num;
    const n2 = endParsed.num;
    const padLen = Math.max(startParsed.padLen, endParsed.padLen);

    if (n2 < n1) {
      return {
        list: [],
        count: 0,
        isValid: false,
        errorMsg: `End identification unit (${end}) must be after or equal to start unit (${start}).`,
        highVal: end,
        lowVal: start,
      };
    }

    const total = n2 - n1 + 1;
    const count = Math.min(total, maxLimit);
    const list: string[] = [];

    for (let i = 0; i < count; i++) {
      const val = String(n1 + i).padStart(padLen, "0");
      list.push(`${prefix}${val}`);
    }

    return {
      list,
      count: total,
      isValid: true,
      highVal: `${prefix}${String(n2).padStart(padLen, "0")}`,
      lowVal: `${prefix}${String(n1).padStart(padLen, "0")}`,
    };
  }

  // Fallback string compare
  const isAscending = start.localeCompare(end, undefined, { numeric: true }) <= 0;
  return {
    list: isAscending ? [start, end] : [end, start],
    count: 2,
    isValid: isAscending,
    errorMsg: isAscending ? undefined : `End identification unit (${end}) must be after or equal to start unit (${start}).`,
    highVal: isAscending ? end : start,
    lowVal: isAscending ? start : end,
  };
};

export default function RangeQuestion({
  question,
  value,
  onChange,
  readOnly = false,
  error = false,
  isApplied = false,
  formId,
  tenantSlug,
  availableIdentificationNumbers,
}: RangeQuestionProps) {
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const routeParams = useParams<{ formId?: string; id?: string }>();
  const resolvedFormId = formId || routeParams.formId || routeParams.id;

  // Open Responses tab filtered to identification number or chassis range alone
  const handleOpenFilteredResponses = (targetUnits?: string[] | string) => {
    if (!resolvedFormId) return;
    let url = `/forms/${resolvedFormId}/analytics?tab=responses`;

    if (Array.isArray(targetUnits) && targetUnits.length > 0) {
      url += `&units=${encodeURIComponent(targetUnits.join(","))}`;
      if (rangeInfo.lowVal && rangeInfo.highVal) {
        url += `&rangeStart=${encodeURIComponent(rangeInfo.lowVal)}&rangeEnd=${encodeURIComponent(rangeInfo.highVal)}`;
      }
    } else if (typeof targetUnits === "string" && targetUnits.trim()) {
      url += `&identificationNumber=${encodeURIComponent(targetUnits.trim())}`;
    } else if (rangeInfo.isValid && rangeInfo.list.length > 0) {
      url += `&units=${encodeURIComponent(rangeInfo.list.join(","))}`;
      if (rangeInfo.lowVal && rangeInfo.highVal) {
        url += `&rangeStart=${encodeURIComponent(rangeInfo.lowVal)}&rangeEnd=${encodeURIComponent(rangeInfo.highVal)}`;
      }
    }

    try {
      const win = window.open(url, "_blank");
      if (!win) {
        navigate(url);
      }
    } catch {
      navigate(url);
    }
  };

  const startLabel = question.minLabel || "Start Identification Number";
  const endLabel = question.maxLabel || "End Identification Number";

  const initialParsed = useMemo(() => parseRangeValue(value), [value]);
  const [startVal, setStartVal] = useState<string>(initialParsed.start);
  const [endVal, setEndVal] = useState<string>(initialParsed.end);

  // Response tab identification numbers state
  const [idNumbers, setIdNumbers] = useState<string[]>(
    availableIdentificationNumbers || []
  );
  const [loadingIds, setLoadingIds] = useState<boolean>(false);

  // Live suggestions popup state
  const [showStartSuggestions, setShowStartSuggestions] = useState<boolean>(false);
  const [showEndSuggestions, setShowEndSuggestions] = useState<boolean>(false);

  const startContainerRef = useRef<HTMLDivElement>(null);
  const endContainerRef = useRef<HTMLDivElement>(null);

  // Close suggestions on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        startContainerRef.current &&
        !startContainerRef.current.contains(e.target as Node)
      ) {
        setShowStartSuggestions(false);
      }
      if (
        endContainerRef.current &&
        !endContainerRef.current.contains(e.target as Node)
      ) {
        setShowEndSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Fetch identification numbers alone from the responses tab
  const fetchResponseTabIds = async () => {
    if (!formId) return;
    setLoadingIds(true);
    try {
      const res: any = await apiClient.getFormIdentificationNumbers(
        formId,
        tenantSlug
      );
      const list =
        res?.data ||
        res?.identificationNumbers ||
        (Array.isArray(res) ? res : []);
      if (Array.isArray(list) && list.length > 0) {
        setIdNumbers(list);
      }
    } catch (err) {
      console.warn("Failed to fetch form response identification numbers:", err);
    } finally {
      setLoadingIds(false);
    }
  };

  useEffect(() => {
    if (
      availableIdentificationNumbers &&
      availableIdentificationNumbers.length > 0
    ) {
      setIdNumbers(availableIdentificationNumbers);
      return;
    }
    if (formId) {
      fetchResponseTabIds();
    }
  }, [formId, tenantSlug, availableIdentificationNumbers]);

  // Sync external changes
  useEffect(() => {
    const parsed = parseRangeValue(value);
    setStartVal(parsed.start);
    setEndVal(parsed.end);
  }, [value]);

  // Compute common prefix and suffixes across available identification numbers
  const { commonPrefix, suffixOptions } = useMemo(() => {
    if (!idNumbers || idNumbers.length === 0) {
      return { commonPrefix: "", suffixOptions: [] };
    }
    const prefix = findLongestCommonPrefix(idNumbers);
    const suffixes = idNumbers.map((id) => {
      const suf = prefix && id.startsWith(prefix) ? id.substring(prefix.length) : id;
      return { full: id, suffix: suf };
    });
    return { commonPrefix: prefix, suffixOptions: suffixes };
  }, [idNumbers]);

  // Calculate sequence slice or formula range
  const rangeInfo = useMemo(() => {
    const s = String(startVal || "").trim();
    const e = String(endVal || "").trim();

    if (!s && !e) {
      return { list: [], count: 0, isValid: true, highVal: "", lowVal: "", fromResponseTab: false };
    }
    if (!s || !e) {
      const single = s || e;
      return { list: [single], count: 1, isValid: true, highVal: single, lowVal: single, fromResponseTab: idNumbers.includes(single) };
    }
    if (s === e) {
      return { list: [s], count: 1, isValid: true, highVal: s, lowVal: s, fromResponseTab: idNumbers.includes(s) };
    }

    // Check if both exist in the response tab sequence
    const idxA = idNumbers.indexOf(s);
    const idxB = idNumbers.indexOf(e);

    if (idxA !== -1 && idxB !== -1) {
      const isValid = idxB >= idxA;
      if (!isValid) {
        return {
          list: [],
          count: 0,
          isValid: false,
          errorMsg: `End identification unit "${e}" must come after or equal to start unit "${s}" in the sequence.`,
          highVal: e,
          lowVal: s,
          fromResponseTab: true,
        };
      }
      const sliced = idNumbers.slice(idxA, idxB + 1);
      return {
        list: sliced,
        count: sliced.length,
        isValid: true,
        highVal: e,
        lowVal: s,
        fromResponseTab: true,
      };
    }

    // Prefix + Numeric computation (e.g. Oct 05-VPM-01 to Oct 05-VPM-04)
    const fallback = calculateChassisRange(s, e);
    return {
      ...fallback,
      fromResponseTab: false,
    };
  }, [startVal, endVal, idNumbers]);

  const triggerChange = (newStart: string, newEnd: string) => {
    if (readOnly) return;
    setStartVal(newStart);
    setEndVal(newEnd);

    if (!newStart && !newEnd) {
      onChange("");
      return;
    }

    const s = newStart.trim();
    const e = newEnd.trim();
    let computedList: string[] = [];

    const idxA = idNumbers.indexOf(s);
    const idxB = idNumbers.indexOf(e);
    if (idxA !== -1 && idxB !== -1 && idxB >= idxA) {
      computedList = idNumbers.slice(idxA, idxB + 1);
    } else {
      computedList = calculateChassisRange(s, e).list;
    }

    const payload = JSON.stringify({
      start: s,
      end: e,
      range: computedList,
      count: computedList.length,
    });
    onChange(payload);
  };

  // Helper to smartly expand suffix to full unit if user enters only suffix
  const smartExpandInput = (inputVal: string): string => {
    const val = inputVal.trim();
    if (!val) return "";
    // If it's already an exact match in idNumbers, keep it
    if (idNumbers.includes(val)) return val;
    // If commonPrefix exists and val matches a suffix (e.g. user typed "01" or "1")
    if (commonPrefix) {
      // 1. Direct prefix + val match
      const candidate1 = `${commonPrefix}${val}`;
      if (idNumbers.includes(candidate1)) return candidate1;
      // 2. Number zero-padded match
      if (/^\d+$/.test(val)) {
        const num = parseInt(val, 10);
        const match = idNumbers.find((id) => {
          const spl = splitPrefixAndNumber(id);
          return spl && spl.prefix === commonPrefix && spl.num === num;
        });
        if (match) return match;
      }
    }
    return val;
  };

  const handleStartInputChange = (val: string) => {
    setStartVal(val);
    setShowStartSuggestions(true);
    triggerChange(val, endVal);
  };

  const handleEndInputChange = (val: string) => {
    setEndVal(val);
    setShowEndSuggestions(true);
    triggerChange(startVal, val);
  };

  const handleSelectStartSuggestion = (fullVal: string) => {
    triggerChange(fullVal, endVal || fullVal);
    setShowStartSuggestions(false);
  };

  const handleSelectEndSuggestion = (fullVal: string) => {
    triggerChange(startVal, fullVal);
    setShowEndSuggestions(false);
  };

  const handleReset = () => {
    if (readOnly) return;
    triggerChange("", "");
  };

  // Quick preset offset jump based on response tab identification numbers sequence
  const handleApplyPresetOffset = (offset: number) => {
    if (readOnly || !startVal) return;

    if (idNumbers.length > 0) {
      const idx = idNumbers.indexOf(startVal);
      if (idx !== -1) {
        const targetIdx = Math.min(idNumbers.length - 1, idx + offset);
        const nextEnd = idNumbers[targetIdx];
        triggerChange(startVal, nextEnd);
        return;
      }
    }

    const spl = splitPrefixAndNumber(startVal);
    if (spl) {
      const nextNum = spl.num + offset;
      const nextEnd = `${spl.prefix}${String(nextNum).padStart(spl.padLen, "0")}`;
      triggerChange(startVal, nextEnd);
    }
  };

  // Suggestions filtered by what user types into Start
  const startSuggestions = useMemo(() => {
    if (!startVal.trim()) return idNumbers.slice(0, 30);
    const term = startVal.trim().toLowerCase();
    return idNumbers.filter((num) => {
      const lower = num.toLowerCase();
      // Match full string or match suffix
      if (lower.includes(term)) return true;
      if (commonPrefix && lower.startsWith(commonPrefix.toLowerCase())) {
        const suf = lower.substring(commonPrefix.length);
        if (suf.includes(term)) return true;
      }
      return false;
    }).slice(0, 30);
  }, [idNumbers, startVal, commonPrefix]);

  // Suggestions filtered by what user types into End
  const endSuggestions = useMemo(() => {
    let baseList = idNumbers;
    // If start is chosen from idNumbers, prioritize items from start onward
    if (startVal && idNumbers.includes(startVal)) {
      const sIdx = idNumbers.indexOf(startVal);
      baseList = idNumbers.slice(sIdx);
    }
    if (!endVal.trim()) return baseList.slice(0, 30);
    const term = endVal.trim().toLowerCase();
    return baseList.filter((num) => {
      const lower = num.toLowerCase();
      if (lower.includes(term)) return true;
      if (commonPrefix && lower.startsWith(commonPrefix.toLowerCase())) {
        const suf = lower.substring(commonPrefix.length);
        if (suf.includes(term)) return true;
      }
      return false;
    }).slice(0, 30);
  }, [idNumbers, startVal, endVal, commonPrefix]);

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
                Chassis Range Selection [Start &rarr; End]
              </span>
              {rangeInfo.isValid && rangeInfo.count > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {rangeInfo.count} {rangeInfo.count === 1 ? "unit" : "units"}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Enter or select start and end units from the response tab identification numbers
            </p>
          </div>
        </div>

        {/* Right Info Pill & Clear Button */}
        <div className="flex items-center gap-2">
          {idNumbers.length > 0 && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              <Database size={12} className="text-indigo-500" />
              <span>Responses Tab ({idNumbers.length})</span>
              <button
                type="button"
                onClick={fetchResponseTabIds}
                disabled={loadingIds}
                className="hover:rotate-180 transition-transform duration-300 ml-0.5 text-indigo-500 hover:text-indigo-700"
                title="Refresh response identification numbers"
              >
                <RefreshCw size={11} className={loadingIds ? "animate-spin" : ""} />
              </button>
              {resolvedFormId && (
                <button
                  type="button"
                  onClick={() => handleOpenFilteredResponses(undefined)}
                  className="ml-0.5 text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 p-0.5 rounded transition-colors"
                  title="Open Responses tab in new window"
                >
                  <ArrowUpRight size={12} className="stroke-[2.5]" />
                </button>
              )}
            </div>
          )}

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
      </div>

      {/* Common Prefix & Suffix Quick-Selection Helper Bar */}
      {commonPrefix && suffixOptions.length > 0 && (
        <div className="mb-4 p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex flex-wrap items-center justify-between gap-2 animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1 uppercase tracking-wider">
              <Tag size={12} className="text-blue-600" />
              Common Prefix:
            </span>
            <span className="px-2 py-0.5 rounded-md font-mono text-xs font-bold bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 shadow-2xs">
              {commonPrefix}
            </span>
            <span className="text-[11px] text-gray-500 dark:text-gray-400 hidden sm:inline">
              (Type or pick just the different unit suffix below)
            </span>
          </div>

          {/* Quick Click Suffix Badges */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-semibold text-gray-400 uppercase">Quick Pick:</span>
            {suffixOptions.slice(0, 6).map(({ full, suffix }, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  if (!startVal || (startVal && endVal && startVal !== endVal)) {
                    triggerChange(full, full);
                  } else {
                    triggerChange(startVal, full);
                  }
                }}
                className={`px-2 py-0.5 text-xs font-mono font-bold rounded-md border transition-all ${
                  startVal === full || endVal === full
                    ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                    : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:bg-blue-50/50"
                }`}
                title={`Select ${full}`}
              >
                {suffix || full}
              </button>
            ))}
            {suffixOptions.length > 6 && (
              <span className="text-[10px] font-mono text-gray-400 self-center">
                +{suffixOptions.length - 6} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Dual Inputs Grid: Start and End with Live Suggestions while entering */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 1. Start Identification Number */}
        <div className="space-y-1.5 relative" ref={startContainerRef}>
          <label className="flex items-center justify-between text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            <span>{startLabel} *</span>
            <span className="text-[10px] font-normal text-blue-600 dark:text-blue-400">
              Start Identification Unit
            </span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={startVal}
              onChange={(e) => handleStartInputChange(e.target.value)}
              onBlur={() => {
                const expanded = smartExpandInput(startVal);
                if (expanded !== startVal) {
                  triggerChange(expanded, endVal);
                }
              }}
              onFocus={() => setShowStartSuggestions(true)}
              disabled={readOnly}
              placeholder={idNumbers.length > 0 ? `e.g., ${idNumbers[0]}` : "Start Unit (e.g. 01 or full ID)"}
              className={`w-full pl-3.5 pr-8 py-2.5 text-sm font-mono font-semibold rounded-xl border-2 transition-all focus:outline-none ${
                !rangeInfo.isValid
                  ? "border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-200 bg-red-50/20"
                  : darkMode
                  ? "border-gray-700 bg-gray-800 text-gray-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-900"
                  : "border-gray-200 bg-white text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              } ${readOnly ? "cursor-not-allowed opacity-75" : ""}`}
            />
            {startVal && resolvedFormId && (
              <button
                type="button"
                onClick={() => handleOpenFilteredResponses(startVal)}
                className="absolute right-8 top-1/2 -translate-y-1/2 text-blue-500 hover:text-blue-700 dark:text-blue-400 p-1"
                title={`Open responses filtered to ${startVal} alone`}
              >
                <ArrowUpRight size={14} className="stroke-[2.5]" />
              </button>
            )}
            {idNumbers.length > 0 && !readOnly && (
              <button
                type="button"
                onClick={() => setShowStartSuggestions(!showStartSuggestions)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
                title="Toggle suggestions list"
              >
                <ChevronDown size={15} />
              </button>
            )}

            {/* Live Suggestions Dropdown while entering Start */}
            {showStartSuggestions && idNumbers.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl max-h-56 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">
                <div className="p-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-850 flex items-center justify-between text-[11px] text-gray-500 font-medium">
                  <span>Suggestions from Response Tab ({startSuggestions.length})</span>
                  <button
                    type="button"
                    onClick={() => setShowStartSuggestions(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={12} />
                  </button>
                </div>
                <div className="overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800 flex-1">
                  {startSuggestions.length === 0 ? (
                    <div className="p-3 text-center text-xs text-gray-400">
                      No matching identification units found
                    </div>
                  ) : (
                    startSuggestions.map((num, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectStartSuggestion(num)}
                        className={`w-full px-3 py-2 text-left text-xs font-mono font-medium flex items-center justify-between transition-colors ${
                          startVal === num
                            ? "bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold"
                            : "text-gray-700 dark:text-gray-300 hover:bg-blue-50/50 dark:hover:bg-gray-700/50"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] px-1 py-0.2 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 font-mono">
                            #{idNumbers.indexOf(num) + 1}
                          </span>
                          <span>{num}</span>
                        </div>
                        {startVal === num && (
                          <CheckCircle2 size={13} className="text-blue-600 dark:text-blue-400" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 2. End Identification Number */}
        <div className="space-y-1.5 relative" ref={endContainerRef}>
          <label className="flex items-center justify-between text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            <span>{endLabel} *</span>
            <span className="text-[10px] font-normal text-blue-600 dark:text-blue-400">
              End Identification Unit
            </span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={endVal}
              onChange={(e) => handleEndInputChange(e.target.value)}
              onBlur={() => {
                const expanded = smartExpandInput(endVal);
                if (expanded !== endVal) {
                  triggerChange(startVal, expanded);
                }
              }}
              onFocus={() => setShowEndSuggestions(true)}
              disabled={readOnly}
              placeholder={
                idNumbers.length > 1
                  ? `e.g., ${idNumbers[idNumbers.length - 1]}`
                  : "End Unit (e.g. 04 or full ID)"
              }
              className={`w-full pl-3.5 pr-8 py-2.5 text-sm font-mono font-semibold rounded-xl border-2 transition-all focus:outline-none ${
                !rangeInfo.isValid
                  ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-200 bg-red-50/30"
                  : darkMode
                  ? "border-gray-700 bg-gray-800 text-gray-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-900"
                  : "border-gray-200 bg-white text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              } ${readOnly ? "cursor-not-allowed opacity-75" : ""}`}
            />
            {endVal && resolvedFormId && (
              <button
                type="button"
                onClick={() => handleOpenFilteredResponses(endVal)}
                className="absolute right-8 top-1/2 -translate-y-1/2 text-blue-500 hover:text-blue-700 dark:text-blue-400 p-1"
                title={`Open responses filtered to ${endVal} alone`}
              >
                <ArrowUpRight size={14} className="stroke-[2.5]" />
              </button>
            )}
            {idNumbers.length > 0 && !readOnly && (
              <button
                type="button"
                onClick={() => setShowEndSuggestions(!showEndSuggestions)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
                title="Toggle suggestions list"
              >
                <ChevronDown size={15} />
              </button>
            )}

            {/* Live Suggestions Dropdown while entering End */}
            {showEndSuggestions && idNumbers.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl max-h-56 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">
                <div className="p-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-850 flex items-center justify-between text-[11px] text-gray-500 font-medium">
                  <span>End Unit Suggestions ({endSuggestions.length})</span>
                  <button
                    type="button"
                    onClick={() => setShowEndSuggestions(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={12} />
                  </button>
                </div>
                <div className="overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800 flex-1">
                  {endSuggestions.length === 0 ? (
                    <div className="p-3 text-center text-xs text-gray-400">
                      No matching identification units found
                    </div>
                  ) : (
                    endSuggestions.map((num, idx) => {
                      const isAfterStart =
                        startVal &&
                        idNumbers.indexOf(num) >= idNumbers.indexOf(startVal);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectEndSuggestion(num)}
                          className={`w-full px-3 py-2 text-left text-xs font-mono font-medium flex items-center justify-between transition-colors ${
                            endVal === num
                              ? "bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold"
                              : isAfterStart
                              ? "text-gray-900 dark:text-gray-100 hover:bg-blue-50/40 dark:hover:bg-gray-700/60 font-semibold"
                              : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] px-1 py-0.2 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 font-mono">
                              #{idNumbers.indexOf(num) + 1}
                            </span>
                            <span>{num}</span>
                            {isAfterStart && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-sans">
                                valid end
                              </span>
                            )}
                          </div>
                          {endVal === num && (
                            <CheckCircle2 size={13} className="text-blue-600 dark:text-blue-400" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Validation Message Banner */}
      {!rangeInfo.isValid && (
        <div className="mt-3.5 p-3 rounded-xl bg-red-50 border border-red-200 dark:bg-red-950/40 dark:border-red-900/60 flex items-center gap-2.5 text-red-700 dark:text-red-300 text-xs font-medium animate-in fade-in duration-200">
          <AlertCircle size={16} className="shrink-0 text-red-500" />
          <span>
            {rangeInfo.errorMsg ||
              "End identification unit must come after or equal to start identification unit."}
          </span>
        </div>
      )}

      {/* Live Preview Chips when valid and filled */}
      {rangeInfo.isValid && startVal && endVal && (
        <div className="mt-3.5 pt-3 border-t border-gray-100 dark:border-gray-800 animate-in fade-in duration-150">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
              <span>
                {rangeInfo.count} responses in range: {rangeInfo.lowVal} &rarr; {rangeInfo.highVal}
                {rangeInfo.fromResponseTab && (
                  <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300">
                    Response Tab Sequence Fit
                  </span>
                )}
              </span>
            </div>

            {/* Direct Arrow Button to view filtered responses in responses tab */}
            {resolvedFormId && (
              <button
                type="button"
                onClick={() => handleOpenFilteredResponses(rangeInfo.list)}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all hover:scale-[1.02] active:scale-95 cursor-pointer ml-auto"
                title="Open Responses tab filtered to this identification number range"
              >
                <span>View Filtered Responses ({rangeInfo.count})</span>
                <ArrowUpRight size={13} className="stroke-[2.5]" />
              </button>
            )}
          </div>

          {/* Interactive sample chassis preview tags with individual arrow buttons */}
          <div className="flex flex-wrap items-center gap-1.5 max-h-24 overflow-y-auto py-1">
            {rangeInfo.list.slice(0, 16).map((ch, idx) => (
              <span
                key={idx}
                className="group inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-medium rounded-lg bg-white dark:bg-gray-800 border border-blue-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 shadow-2xs hover:border-blue-400 transition-all"
              >
                <span>{ch}</span>
                {resolvedFormId && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenFilteredResponses(ch);
                    }}
                    className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200 p-0.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                    title={`Click arrow to show only ${ch} in responses tab`}
                  >
                    <ArrowUpRight size={12} className="stroke-[2.5]" />
                  </button>
                )}
              </span>
            ))}
            {rangeInfo.list.length > 16 && (
              <span className="px-2 py-1 text-xs font-mono text-gray-400 self-center">
                +{rangeInfo.count - 16} more
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
          {idNumbers.length > 0 && idNumbers.includes(startVal) && (
            <button
              type="button"
              onClick={() => triggerChange(startVal, idNumbers[idNumbers.length - 1])}
              className="px-2 py-1 font-mono font-medium rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 transition-colors"
            >
              To Last Unit
            </button>
          )}
        </div>
      )}
    </div>
  );
}
