import React, { useMemo } from "react";
import { Bar } from "react-chartjs-2";
import { BarChart3 } from "lucide-react";
import type { Response } from "../types";
import { computeDirectAcceptedDailyStats } from "../utils/analyticsCalculations";

export interface DirectAcceptedPerformanceGraphProps {
  dateFilteredResponses: Response[];
  responseStatuses: Record<string, string>;
  dateFilter: { startDate?: string; endDate?: string };
  darkMode: boolean;
}

export const DirectAcceptedPerformanceGraph: React.FC<DirectAcceptedPerformanceGraphProps> = ({
  dateFilteredResponses,
  responseStatuses,
  dateFilter,
  darkMode,
}) => {
    const timeData = useMemo(() => {
      return computeDirectAcceptedDailyStats(
        dateFilteredResponses,
        responseStatuses,
        dateFilter.startDate,
        dateFilter.endDate,
      );
    }, [
      dateFilteredResponses,
      responseStatuses,
      dateFilter.startDate,
      dateFilter.endDate,
    ]);

    if (timeData.length === 0) return null;

    const data = {
      labels: timeData.map((s) => s.date),
      datasets: [
        {
          label: "Direct",
          data: timeData.map((s) => s.directCount),
          backgroundColor: "rgba(34, 197, 94, 0.7)", // Green-500
          borderColor: "rgb(21, 128, 61)", // Green-700
          borderWidth: 1,
          stack: "stack1",
        },
        {
          label: "Rework",
          data: timeData.map((s) => s.reworkCount),
          backgroundColor: "rgba(234, 179, 8, 0.7)", // Yellow-500
          borderColor: "rgb(161, 98, 7)", // Yellow-700
          borderWidth: 1,
          stack: "stack1",
        },
        {
          label: "Rework Completed",
          data: timeData.map((s) => s.reworkCompletedCount),
          backgroundColor: "rgba(59, 130, 246, 0.7)", // Blue-500
          borderColor: "rgb(29, 78, 216)", // Blue-700
          borderWidth: 1,
          stack: "stack1",
        },
        {
          label: "Rejected",
          data: timeData.map((s) => s.rejectedCount),
          backgroundColor: "rgba(239, 68, 68, 0.7)", // Red-500
          borderColor: "rgb(185, 28, 28)", // Red-700
          borderWidth: 1,
          stack: "stack1",
        },
      ],
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,

      plugins: {
        legend: {
          display: true,
          position: "top" as const,
          labels: {
            color: darkMode ? "#e5e7eb" : "#374151",
            font: { size: 10, weight: "bold" as const },
            padding: 10,
            usePointStyle: true,
          },
        },

        tooltip: {
          mode: "nearest" as const,
          intersect: true,
          callbacks: {
            label: (context: any) => {
              const datasetLabel = context.dataset.label;
              const value = context.raw;
              return `${datasetLabel}: ${value}`;
            },
          },
        },

        datalabels: {
          display: (context: any) =>
            context.dataset.data[context.dataIndex] > 0,
          color: "#fff",
          font: { weight: "bold" as const, size: 9 },
          formatter: (value: number) => value,
        },
      },
      scales: {
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            color: darkMode ? "#9ca3af" : "#6b7280",
          },
          grid: {
            color: darkMode
              ? "rgba(255, 255, 255, 0.05)"
              : "rgba(0, 0, 0, 0.03)",
          },
        },
        x: {
          stacked: true,
          ticks: {
            color: darkMode ? "#9ca3af" : "#6b7280",
          },
          grid: {
            display: false,
          },
        },
      },
    };

    return (
      <div
        id="inspection-status-distribution-chart"
        className="p-6 bg-gradient-to-br from-white to-slate-50 dark:from-gray-800 dark:to-gray-900 flex flex-col h-full rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-shadow w-full mt-6"
      >
        <div
          data-pdf-hide="true"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6"
        >
          <div className="flex items-center">
            <div
              className={`p-2 bg-gradient-to-br from-blue-600 to-indigo-800 rounded-lg mr-2`}
            >
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                Inspection Status Trend
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Daily distribution of inspection outcomes (counts)
              </p>
            </div>
          </div>
        </div>
        <div style={{ height: "400px", position: "relative" }}>
          <Bar data={data} options={options} />
        </div>
      </div>
    );
};

export default DirectAcceptedPerformanceGraph;
