import React, { useState, useEffect } from "react";
import type { FollowUpQuestion } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { Sliders, Minus, Plus, RotateCcw } from "lucide-react";

interface RangeQuestionProps {
  question: FollowUpQuestion;
  value: string | number;
  onChange: (value: string) => void;
  readOnly?: boolean;
  error?: boolean;
  isApplied?: boolean;
}

export default function RangeQuestion({
  question,
  value,
  onChange,
  readOnly = false,
  error = false,
  isApplied = false,
}: RangeQuestionProps) {
  const { darkMode } = useTheme();

  const min = question.min !== undefined && !isNaN(Number(question.min)) ? Number(question.min) : 0;
  const max = question.max !== undefined && !isNaN(Number(question.max)) ? Number(question.max) : (min + 100);
  const step = question.step && !isNaN(Number(question.step)) && Number(question.step) > 0 ? Number(question.step) : 1;
  const minLabel = question.minLabel || "Start";
  const maxLabel = question.maxLabel || "End";

  const numValue =
    value !== undefined && value !== null && value !== "" && !isNaN(Number(value))
      ? Number(value)
      : null;

  // Calculate percentage for progress fill
  const percentage = numValue !== null && max > min
    ? Math.max(0, Math.min(100, ((numValue - min) / (max - min)) * 100))
    : 0;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    onChange(e.target.value);
  };

  const handleDirectNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    const valStr = e.target.value;
    if (valStr === "") {
      onChange("");
      return;
    }
    const val = Number(valStr);
    if (!isNaN(val)) {
      const clamped = Math.max(min, Math.min(max, val));
      onChange(clamped.toString());
    }
  };

  const handleStepDelta = (delta: number) => {
    if (readOnly) return;
    const current = numValue !== null ? numValue : Math.round((min + max) / 2);
    const next = Math.max(min, Math.min(max, Number((current + delta).toFixed(4))));
    onChange(next.toString());
  };

  const handlePreset = (presetValue: number) => {
    if (readOnly) return;
    onChange(presetValue.toString());
  };

  return (
    <div
      className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 ${
        error
          ? "border-red-300 bg-red-50/30 dark:border-red-800 dark:bg-red-950/20"
          : isApplied
          ? "border-emerald-300 bg-emerald-50/20 dark:border-emerald-800 dark:bg-emerald-950/20"
          : darkMode
          ? "border-gray-800 bg-gray-900/50 shadow-inner"
          : "border-gray-200 bg-white shadow-sm"
      }`}
    >
      {/* Top Header: Badge, Live Value Display & Direct Input */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
              isApplied
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                : "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
            }`}
          >
            <Sliders size={16} />
          </div>
          <div>
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
              Range Value
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Limits: [{min} to {max}] &bull; Step: {step}
            </span>
          </div>
        </div>

        {/* Selected value counter & input */}
        <div className="flex items-center gap-2">
          <div
            className={`px-3.5 py-1.5 rounded-xl border font-mono font-bold text-base sm:text-lg flex items-center gap-1.5 transition-all ${
              numValue !== null
                ? isApplied
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20"
                  : "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20"
                : darkMode
                ? "bg-gray-800 text-gray-400 border-gray-700"
                : "bg-gray-100 text-gray-400 border-gray-200"
            }`}
          >
            <span>{numValue !== null ? numValue : "--"}</span>
          </div>

          {!readOnly && (
            <input
              type="number"
              min={min}
              max={max}
              step={step}
              value={numValue !== null ? numValue : ""}
              onChange={handleDirectNumberChange}
              placeholder={String(min)}
              className={`w-20 px-2.5 py-1.5 text-sm font-mono text-center rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                darkMode
                  ? "bg-gray-800 border-gray-700 text-gray-100 focus:bg-gray-750"
                  : "bg-gray-50 border-gray-200 text-gray-800 focus:bg-white"
              }`}
            />
          )}
        </div>
      </div>

      {/* Slider Track Container */}
      <div className="relative py-2 px-1">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={numValue !== null ? numValue : min}
          onChange={handleSliderChange}
          disabled={readOnly}
          style={{
            background: `linear-gradient(to right, ${
              isApplied ? "#10b981" : "#2563eb"
            } 0%, ${
              isApplied ? "#10b981" : "#2563eb"
            } ${percentage}%, ${
              darkMode ? "#374151" : "#e5e7eb"
            } ${percentage}%, ${
              darkMode ? "#374151" : "#e5e7eb"
            } 100%)`,
          }}
          className={`w-full h-2.5 rounded-lg appearance-none cursor-pointer focus:outline-none accent-blue-600 dark:accent-blue-500 transition-all ${
            readOnly ? "cursor-not-allowed opacity-70" : ""
          }`}
        />
      </div>

      {/* Range Start & End Boundary Labels */}
      <div className="flex items-center justify-between text-xs font-medium text-gray-500 dark:text-gray-400 mt-2 px-1">
        <div className="flex flex-col items-start">
          <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 tracking-wide">
            {minLabel} (Min)
          </span>
          <span className="font-mono font-bold text-gray-700 dark:text-gray-200 text-sm">
            {min}
          </span>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 tracking-wide">
            Midpoint
          </span>
          <span className="font-mono text-xs text-gray-400 dark:text-gray-500">
            {Number(((min + max) / 2).toFixed(2))}
          </span>
        </div>

        <div className="flex flex-col items-end">
          <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 tracking-wide">
            {maxLabel} (Max)
          </span>
          <span className="font-mono font-bold text-gray-700 dark:text-gray-200 text-sm">
            {max}
          </span>
        </div>
      </div>

      {/* Preset Buttons & Quick Step Adjusters */}
      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
          {/* Quick Presets */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 mr-1">
              Quick:
            </span>
            <button
              type="button"
              onClick={() => handlePreset(min)}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
            >
              Start ({min})
            </button>
            <button
              type="button"
              onClick={() => handlePreset(Number(((min + max) / 2).toFixed(2)))}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
            >
              Mid
            </button>
            <button
              type="button"
              onClick={() => handlePreset(max)}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
            >
              End ({max})
            </button>
          </div>

          {/* Step Increment / Decrement */}
          <div className="flex items-center gap-1.5 ml-auto">
            <button
              type="button"
              onClick={() => handleStepDelta(-step)}
              className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
              title={`Subtract step (${step})`}
            >
              <Minus size={14} />
            </button>
            <button
              type="button"
              onClick={() => handleStepDelta(step)}
              className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
              title={`Add step (${step})`}
            >
              <Plus size={14} />
            </button>
            {numValue !== null && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-950/30 text-gray-400 hover:text-red-500 transition-colors ml-1"
                title="Clear value"
              >
                <RotateCcw size={14} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
