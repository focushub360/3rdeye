import React, { useMemo } from "react";
import { Line } from "react-chartjs-2";
import { TrendingUp } from "lucide-react";
import type { Response } from "../types";
import {
  computeMonthlyPerformanceStats,
  computeDailyPerformanceStats,
} from "../utils/analyticsCalculations";

export interface TimeBasedPerformanceGraphProps {
  timeSeriesView: "daily" | "monthly";
  setTimeSeriesView: (view: "daily" | "monthly") => void;
  trendChartResponses: Response[];
  responseStatuses: Record<string, string>;
  dateFilter: { startDate?: string; endDate?: string };
  darkMode: boolean;
}

export const TimeBasedPerformanceGraph: React.FC<TimeBasedPerformanceGraphProps> = ({
  timeSeriesView,
  setTimeSeriesView,
  trendChartResponses,
  responseStatuses,
  dateFilter,
  darkMode,
}) => {
    const timeData = useMemo(() => {
      if (timeSeriesView === "monthly") {
        return computeMonthlyPerformanceStats(
          trendChartResponses,
          responseStatuses,
          dateFilter.startDate,
          dateFilter.endDate,
        );
      }
      return computeDailyPerformanceStats(
        trendChartResponses,
        responseStatuses,
        dateFilter.startDate,
        dateFilter.endDate,
      );
    }, [
      trendChartResponses,
      responseStatuses,
      timeSeriesView,
      dateFilter.startDate,
      dateFilter.endDate,
    ]);

    if (timeData.length === 0) return null;

    const data = {
      labels: timeData.map((s) => s.date),
      datasets: [
        {
          label: "Total Responses",
          data: timeData.map((s) => s.totalResponses),
          borderColor: "rgb(55, 65, 81)", // Dark Gray
          backgroundColor: "rgba(55, 65, 81, 0.1)",
          borderWidth: 3,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: "rgb(55, 65, 81)",
          fill: true,
          datalabels: {
            color: darkMode ? "#e5e7eb" : "#374151",
            align: "top" as const,
            offset: 4,
            font: { weight: "bold" as const, size: 10 },
            formatter: (value: number) => (value > 0 ? value : ""),
          },
        },
        {
          label: "Rework Received",
          data: timeData.map((s) => s.reworkCount),
          borderColor: "rgb(153, 27, 27)", // Dark Red
          backgroundColor: "rgba(153, 27, 27, 0.1)",
          borderWidth: 3,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: "rgb(153, 27, 27)",
          fill: true,
          datalabels: {
            color: "rgb(153, 27, 27)",
            align: "bottom" as const,
            offset: 4,
            font: { weight: "bold" as const, size: 10 },
            formatter: (value: number) => (value > 0 ? value : ""),
          },
        },
      ],
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom" as const,
          labels: {
            color: darkMode ? "#e5e7eb" : "#374151",
            font: { size: 11, weight: "bold" as const },
            usePointStyle: true,
            padding: 20,
          },
        },
        tooltip: {
          mode: "nearest" as const,
          intersect: true,
          backgroundColor: darkMode ? "#1f2937" : "#ffffff",
          titleColor: darkMode ? "#ffffff" : "#111827",
          bodyColor: darkMode ? "#d1d5db" : "#374151",
          borderColor: darkMode ? "#374151" : "#e5e7eb",
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
        },
        datalabels: {
          display: true,
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            color: darkMode ? "#e5e7eb" : "#374151",
            font: { size: 10, weight: "500" as const },
          },
        },
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            color: darkMode ? "#9ca3af" : "#6b7280",
            font: { size: 10 },
          },
          grid: {
            color: darkMode
              ? "rgba(255, 255, 255, 0.05)"
              : "rgba(0, 0, 0, 0.03)",
          },
        },
      },
      interaction: {
        mode: "nearest" as const,
        intersect: true,
        axis: "x" as const,
      },
    };

    return (
      <div
        id="performance-trend-chart"
        className="p-6 bg-gradient-to-br from-white to-slate-50 dark:from-gray-800 dark:to-gray-900 flex flex-col h-full rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-shadow w-full mt-6"
      >
        <div
          data-pdf-hide="true"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6"
        >
          <div className="flex items-center">
            <div className="p-2 bg-gradient-to-br from-slate-700 to-red-600 rounded-lg mr-2">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                Performance Trend
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Total responses received vs total rework received over time
                (Response-wise)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-slate-100 dark:bg-gray-700 p-1 rounded-lg">
              <button
                onClick={() => setTimeSeriesView("daily")}
                className={`px-3 py-1 text-[10px] font-bold rounded transition-all ${timeSeriesView === "daily"
                  ? "bg-white dark:bg-gray-600 text-blue-600 shadow-sm"
                  : "text-slate-500"
                  }`}
              >
                DAILY
              </button>
              <button
                onClick={() => setTimeSeriesView("monthly")}
                className={`px-3 py-1 text-[10px] font-bold rounded transition-all ${timeSeriesView === "monthly"
                  ? "bg-white dark:bg-gray-600 text-blue-600 shadow-sm"
                  : "text-slate-500"
                  }`}
              >
                MONTHLY
              </button>
            </div>
          </div>
        </div>
        <div style={{ height: "400px", position: "relative" }}>
          <Line data={data} options={options} />
        </div>
      </div>
    );
};

export default TimeBasedPerformanceGraph;
