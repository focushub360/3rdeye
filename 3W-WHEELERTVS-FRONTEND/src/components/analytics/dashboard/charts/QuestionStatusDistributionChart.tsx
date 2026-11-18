import React, { useMemo } from "react";
import { Bar } from "react-chartjs-2";
import { BarChart3, CheckCircle } from "lucide-react";
import type { QuestionPerformanceStat } from "../types";

export interface QuestionStatusDistributionChartProps {
  chartQuestionPerformanceStats: QuestionPerformanceStat[];
  chartSortOrder: "default" | "percentage";
  setChartSortOrder: (order: "default" | "percentage") => void;
  chartOrientation: "h" | "v";
  setChartOrientation: (orientation: "h" | "v") => void;
  complianceLabels: { no: string; na: string };
  commonDateRangeLabel: string;
}

export const QuestionStatusDistributionChart: React.FC<QuestionStatusDistributionChartProps> = ({
  chartQuestionPerformanceStats,
  chartSortOrder,
  setChartSortOrder,
  chartOrientation,
  setChartOrientation,
  complianceLabels,
  commonDateRangeLabel,
}) => {
  // Filter and Sort questions based on issue volume
  const processedQuestions = useMemo(() => {
    let filtered = chartQuestionPerformanceStats.filter(
      (q) => q.rejected > 0 || q.rework > 0,
    );

    if (chartSortOrder === "percentage") {
      filtered = [...filtered].sort((a, b) => {
        const percentA = ((a.rejected + a.rework) / (a.total || 1)) * 100;
        const percentB = ((b.rejected + b.rework) / (b.total || 1)) * 100;
        return percentB - percentA;
      });
    } else {
      // ✅ FIX: Default sort is Pareto order — descending by total defect count
      filtered = [...filtered].sort((a, b) => (b.rejected + b.rework) - (a.rejected + a.rework));
    }

    return filtered.slice(0, 20);
  }, [chartQuestionPerformanceStats, chartSortOrder]);

  // ✅ FIX: Always render the chart section (show "No Defects Found" state
  // instead of hiding entirely, so 603 and 604 both display this card)
  if (!processedQuestions.length && !chartQuestionPerformanceStats.length)
    return null;

  const data = {
    labels: processedQuestions.map((q) =>
      q.text.length > 25 ? q.text.substring(0, 25) + "..." : q.text,
    ),
    datasets: [
      {
        label: complianceLabels.no,
        data: processedQuestions.map((q) => q.rejected),
        backgroundColor: "rgba(153, 27, 27, 0.85)", // Dark Red
        borderColor: "rgb(127, 29, 29)",
        borderWidth: 1,
        barPercentage: processedQuestions.length <= 2 ? 0.3 : 0.7,
        categoryPercentage: 0.8,
        datalabels: {
          color: "#ffffff",
          font: { weight: "bold" as const, size: 10 },
          formatter: (value: number) => (value > 0 ? value : ""),
          textAlign: "center" as const,
        },
      },
      {
        label: complianceLabels.na,
        data: processedQuestions.map((q) => q.rework),
        backgroundColor: "rgba(55, 65, 81, 0.85)", // Dark Gray
        borderColor: "rgb(31, 41, 55)",
        borderWidth: 1,
        barPercentage: processedQuestions.length <= 2 ? 0.3 : 0.7,
        categoryPercentage: 0.8,
        datalabels: {
          color: "#ffffff",
          font: { weight: "bold" as const, size: 10 },
          formatter: (value: number) => (value > 0 ? value : ""),
          textAlign: "center" as const,
        },
      },
    ],
  };

  const options = {
    indexAxis: chartOrientation === "h" ? ("y" as const) : ("x" as const),
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          color: document.documentElement.classList.contains("dark")
            ? "#e5e7eb"
            : "#374151",
          font: { size: 11, weight: "bold" as const },
          padding: 20,
          usePointStyle: true,
        },
      },
      datalabels: {
        display: (context: any) => {
          return context.dataset.data[context.dataIndex] > 0;
        },
      },
      tooltip: {
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: function (context: any) {
            const value = context.raw;
            return `${context.dataset.label}: ${value}`;
          },
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        ticks: {
          color: document.documentElement.classList.contains("dark")
            ? "#f1f5f9"
            : "#0f172a",
          font: { size: 11, weight: "700" as const },
          maxRotation: chartOrientation === "v" ? 55 : 0,
          minRotation: chartOrientation === "v" ? 40 : 0,
          autoSkip: false,
        },
        grid: {
          display: false,
        },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        ticks: {
          stepSize: 1,
          color: document.documentElement.classList.contains("dark")
            ? "#9ca3af"
            : "#6b7280",
          font: { size: 10 },
        },
        grid: {
          color: document.documentElement.classList.contains("dark")
            ? "rgba(255, 255, 255, 0.05)"
            : "rgba(0, 0, 0, 0.03)",
        },
      },
    },
    interaction: {
      mode: "nearest" as const,
      intersect: true,
    },
  };

  const containerStyle =
    chartOrientation === "h"
      ? {
        height: `${Math.max(450, processedQuestions.length * 40)}px`,
        position: "relative" as const,
      }
      : { height: "450px", position: "relative" as const };

  return (
    <div
      id="defect-distribution-chart"
      className="p-4 sm:p-6 bg-gradient-to-br from-white to-slate-50 dark:from-gray-800 dark:to-gray-900 flex flex-col h-full rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-shadow"
    >
      <div
        data-pdf-hide="true"
        className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6"
      >
        <div className="flex items-center">
          <div className="p-2 bg-gradient-to-br from-red-600 to-slate-700 rounded-lg mr-2">
            <BarChart3 className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">
              Main Defect Distribution
            </h3>
            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">
              {complianceLabels.no} & {complianceLabels.na} volume (
              {commonDateRangeLabel})
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Sort Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-gray-700 p-1 rounded-lg">
            <button
              onClick={() => setChartSortOrder("default")}
              className={`px-2 py-1 text-[9px] sm:text-[10px] font-bold rounded transition-all ${chartSortOrder === "default"
                ? "bg-white dark:bg-gray-600 text-blue-600 shadow-sm"
                : "text-slate-500"
                }`}
            >
              DEFAULT
            </button>
            <button
              onClick={() => setChartSortOrder("percentage")}
              className={`px-2 py-1 text-[9px] sm:text-[10px] font-bold rounded transition-all ${chartSortOrder === "percentage"
                ? "bg-white dark:bg-gray-600 text-blue-600 shadow-sm"
                : "text-slate-500"
                }`}
            >
              ISSUE %
            </button>
          </div>

          {/* Orientation Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-gray-700 p-1 rounded-lg">
            <button
              onClick={() => setChartOrientation("v")}
              title="Vertical View"
              className={`p-1 rounded transition-all ${chartOrientation === "v"
                ? "bg-white dark:bg-gray-600 text-blue-600 shadow-sm"
                : "text-slate-500"
                }`}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2"
                />
              </svg>
            </button>
            <button
              onClick={() => setChartOrientation("h")}
              title="Horizontal View"
              className={`p-1 rounded transition-all ${chartOrientation === "h"
                ? "bg-white dark:bg-gray-600 text-blue-600 shadow-sm"
                : "text-slate-500"
                }`}
            >
              <svg
                className="w-4 h-4 rotate-90"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {processedQuestions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[300px] text-center p-8">
          <div className="p-4 bg-slate-50 dark:bg-gray-800/50 rounded-full mb-4">
            <CheckCircle className="w-12 h-12 text-green-500 opacity-50" />
          </div>
          <h4 className="text-slate-900 dark:text-white font-bold mb-1">
            No Defects Found
          </h4>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">
            No rejected or rework responses were found for your current
            selection.
          </p>
        </div>
      ) : (
        <>
          <div
            className={chartOrientation === "h" ? "overflow-y-auto" : "w-full"}
          >
            <div style={containerStyle} id="issue-percentage-chart">
              <Bar data={data} options={options} />
            </div>
          </div>

          {/* ✅ Pareto Defect Distribution Table */}
          {processedQuestions.length > 0 && (() => {
            const grandTotal = processedQuestions.reduce((sum, q) => sum + q.rejected + q.rework, 0);
            let cumulativeCount = 0;
            return (
              <div className="mt-6 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700 rounded-xl border border-gray-200 dark:border-gray-700">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-gray-50/80 dark:bg-gray-700/80 backdrop-blur-md sticky top-0 z-10 text-gray-500 dark:text-gray-400 uppercase text-[10px] font-black tracking-[0.15em]">
                    <tr>
                      <th className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap">#</th>
                      <th className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap">Defect / Question</th>
                      <th className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center">Category</th>
                      <th className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center text-red-600">{complianceLabels.no} Count</th>
                      <th className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center text-gray-600">{complianceLabels.na} Count</th>
                      <th className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center font-extrabold">Total</th>
                      <th className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center">% of Total</th>
                      <th className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center">Cumulative %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                    {processedQuestions.map((q, idx) => {
                      const totalDefects = q.rejected + q.rework;
                      cumulativeCount += totalDefects;
                      const pctOfTotal = grandTotal > 0 ? ((totalDefects / grandTotal) * 100).toFixed(1) : "0.0";
                      const cumulativePct = grandTotal > 0 ? ((cumulativeCount / grandTotal) * 100).toFixed(1) : "0.0";
                      return (
                        <tr key={q.id || idx} className="hover:bg-red-50/30 dark:hover:bg-red-900/10 transition-colors">
                          <td className="px-4 py-3 font-bold text-gray-500 tabular-nums">{idx + 1}</td>
                          <td className="px-4 py-3 font-bold text-gray-900 dark:text-white max-w-[280px] truncate" title={q.text}>{q.text}</td>
                          <td className="px-4 py-3 text-center text-gray-500 text-xs">{q.sectionTitle || "-"}</td>
                          <td className="px-4 py-3 font-black text-center text-red-600 tabular-nums">{q.rejected}</td>
                          <td className="px-4 py-3 font-black text-center text-gray-600 dark:text-gray-400 tabular-nums">{q.rework}</td>
                          <td className="px-4 py-3 font-black text-center tabular-nums">{totalDefects}</td>
                          <td className="px-4 py-3 font-bold text-center tabular-nums">{pctOfTotal}%</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black tabular-nums ${parseFloat(cumulativePct) <= 80
                              ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                              : "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400"
                              }`}>
                              {cumulativePct}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
};

export default QuestionStatusDistributionChart;
