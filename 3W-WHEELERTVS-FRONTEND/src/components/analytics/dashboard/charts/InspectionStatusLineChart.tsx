import React, { useMemo } from "react";
import { Line } from "react-chartjs-2";
import { TrendingUp } from "lucide-react";
import type { Response, Form } from "../types";
import { computeDailyReworkVolumeStats } from "../utils/analyticsCalculations";

export interface InspectionStatusLineChartProps {
  form: Form | null;
  dateFilteredResponses: Response[];
  dateFilter: { startDate?: string; endDate?: string };
  darkMode: boolean;
}

export const InspectionStatusLineChart: React.FC<InspectionStatusLineChartProps> = ({
  form,
  dateFilteredResponses,
  dateFilter,
  darkMode,
}) => {
    const timeData = useMemo(() => {
      return computeDailyReworkVolumeStats(
        form,
        dateFilteredResponses,
        dateFilter.startDate,
        dateFilter.endDate,
      );
    }, [form, dateFilteredResponses, dateFilter.startDate, dateFilter.endDate]);

    if (timeData.length === 0) return null;

    const data = {
      labels: timeData.map((s) => s.date),
      datasets: [
        {
          label: "Rework",
          data: timeData.map((s) => s.reworkCount),
          borderColor: "rgb(234, 179, 8)", // Yellow-500
          backgroundColor: "rgba(234, 179, 8, 0.3)",
          borderWidth: 1,
          fill: true,
          tension: 0,
        },
      ],
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          mode: "nearest" as const,
          intersect: true,
          callbacks: {
            label: (context: any) => {
              const label = context.dataset.label;
              const value = context.raw;
              return `${label}: ${value}`;
            },
          },
        },
      },
      scales: {
        y: {
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
        id="status-trends-rework-chart"
        className="p-6 bg-gradient-to-br from-white to-slate-50 dark:from-gray-800 dark:to-gray-900 flex flex-col h-full rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-shadow w-full mt-6"
      >
        <div
          data-pdf-hide="true"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6"
        >
          <div className="flex items-center">
            <div
              className={`p-2 bg-gradient-to-br from-purple-600 to-indigo-800 rounded-lg mr-2`}
            >
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                Inspection Status Trends For REWORK
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Daily Rework Volume (Response-level rework count)
              </p>
            </div>
          </div>
        </div>
        <div style={{ height: "400px", position: "relative" }}>
          <Line data={data} options={options} />
        </div>
      </div>
    );
};

export default InspectionStatusLineChart;
