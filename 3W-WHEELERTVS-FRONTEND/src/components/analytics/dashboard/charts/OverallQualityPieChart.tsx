import React from "react";
import { PieChart } from "lucide-react";
import { Doughnut } from "react-chartjs-2";

export interface OverallQualityPieChartProps {
  totalPieChartData: any;
  selectedInspectorForTrend: string;
  tvsReviews: any[];
  inspectionStats: any;
  onNavigateToResponses: (dispatchFilter?: string) => void;
}

export const OverallQualityPieChart: React.FC<OverallQualityPieChartProps> = ({
  totalPieChartData,
  selectedInspectorForTrend,
  tvsReviews,
  inspectionStats,
  onNavigateToResponses,
}) => {
  const centerAcceptedCount =
    (totalPieChartData.counts.directOk || 0) +
    (totalPieChartData.counts.reworkCompleted || 0);

  const data = {
    labels: ["Direct Ok", "Rework Accepted", "Rejected", "Rework"],
    datasets: [
      {
        data: [
          totalPieChartData.directOk,
          totalPieChartData.reworkCompleted,
          totalPieChartData.no,
          totalPieChartData.na,
        ],
        backgroundColor: [
          "rgba(34, 197, 94, 0.85)", // Green for Direct Ok
          "rgba(59, 130, 246, 0.85)", // Blue for Rework Completed / Accepted
          "rgba(239, 68, 68, 0.85)", // Red for Rejected
          "rgba(234, 179, 8, 0.85)", // Yellow for Rework
        ],
        borderColor: [
          "rgb(34, 197, 94)",
          "rgb(59, 130, 246)",
          "rgb(239, 68, 68)",
          "rgb(234, 179, 8)",
        ],
        borderWidth: 2,
        hoverOffset: 15,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      datalabels: {
        color: "white",
        font: { weight: "bold" as const, size: 10 },
        formatter: (value: number) => (value > 0 ? `${value}%` : ""),
      },
      legend: {
        position: "bottom" as const,
        labels: {
          color: document.documentElement.classList.contains("dark")
            ? "#e5e7eb"
            : "#374151",
          font: { size: 9, weight: "bold" as const },
          padding: 8,
          usePointStyle: true,
        },
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const label = context.label || "";
            const value = context.raw || 0;
            const index = context.dataIndex;

            let count = 0;
            if (index === 0) count = totalPieChartData.counts.directOk;
            else if (index === 1)
              count = totalPieChartData.counts.reworkCompleted;
            else if (index === 2) count = totalPieChartData.counts.no;
            else if (index === 3) count = totalPieChartData.counts.na;

            return `${label}: ${value}% (${count} responses)`;
          },
        },
      },
    },
    cutout: "60%",
    interaction: {
      mode: "nearest" as const,
      intersect: true,
    },
  };

  return (
    <div className="p-4 sm:p-6 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 flex flex-col h-full rounded-xl border border-gray-200 dark:border-gray-700">
      <div className="flex flex-col gap-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg mr-1.5">
              <PieChart className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-primary-900 dark:text-white">
                Overall Inspection Trend
              </h2>
              <p className="text-[10px] sm:text-xs text-primary-500 dark:text-primary-400">
                {selectedInspectorForTrend === "Overall"
                  ? "Accepted/Rejected/Rework Distribution"
                  : `Inspector: ${selectedInspectorForTrend}`}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col" id="overall-quality-chart">
        {totalPieChartData.counts.total === 0 ? (
          <div className="flex-1 flex items-center justify-center min-h-[200px]">
            <div className="text-center p-4">
              <PieChart className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-primary-500 dark:text-primary-400 font-medium text-sm">
                No inspection data available
              </p>
              <p className="text-[10px] text-primary-400 dark:text-primary-500 mt-1">
                Will appear when inspection responses are recorded
              </p>
            </div>
          </div>
        ) : (
          <>
            {(() => {
              const totalCount = totalPieChartData.counts.total || 0;
              const tvsRevCount = tvsReviews.length;
              const tvsAccCount = tvsReviews.filter((r) => (r.reviewOption || r.option || r.status) === "Accepted").length;
              const tvsRejCount = tvsReviews.filter((r) => (r.reviewOption || r.option || r.status) === "Rejected").length;
              const tvsRwCount = tvsReviews.filter((r) => String(r.reviewOption || r.option || r.status || "").toLowerCase().includes("rework")).length;
              const tvsDefCount = tvsRejCount + tvsRwCount;
              // TVS Pending = Dispatched - Total TVS Review
              const pendingTvsCount = Math.max(0, (totalPieChartData.counts.dispatched ?? inspectionStats.dispatched) - tvsRevCount);
              const tvsRevPct = totalCount > 0 ? ((tvsRevCount / totalCount) * 100).toFixed(1) : "0";
              const pendingTvsPct = totalCount > 0 ? ((pendingTvsCount / totalCount) * 100).toFixed(1) : "0";
              const tvsAccPct = totalCount > 0 ? ((tvsAccCount / totalCount) * 100).toFixed(1) : "0";
              const tvsDefPct = totalCount > 0 ? ((tvsDefCount / totalCount) * 100).toFixed(1) : "0";

              return (
                <div className="overflow-x-auto w-full pb-2">
                  <div className="grid grid-cols-[130px_minmax(260px,1fr)_130px] sm:grid-cols-[140px_minmax(300px,1fr)_140px] items-center justify-between gap-3 sm:gap-4 min-w-[560px]">
                    {/* Left: TVS Review Pipeline Cards placed Top-to-Bottom */}
                    <div className="flex flex-col gap-2 justify-center items-center flex-shrink-0">
                      {/* Total TVS Review */}
                      <div className="text-center p-2.5 bg-purple-50/60 dark:bg-purple-950/20 rounded-xl border border-purple-100/70 dark:border-purple-800/30 shadow-xs flex flex-col justify-center items-center h-[72px] w-[130px] sm:w-[140px] transition-all hover:shadow-sm">
                        <div className="text-xs sm:text-sm font-bold text-purple-600 dark:text-purple-400">
                          {tvsRevPct}%
                        </div>
                        <div className="text-[10px] sm:text-[11px] font-semibold text-purple-700 dark:text-purple-300 whitespace-nowrap">
                          Total TVS Review
                        </div>
                        <div className="text-[9px] text-gray-500 dark:text-gray-400 font-medium">
                          ({tvsRevCount})
                        </div>
                      </div>

                      {/* Pending TVS Review */}
                      <div className="text-center p-2.5 bg-amber-50/60 dark:bg-amber-950/20 rounded-xl border border-amber-100/70 dark:border-amber-800/30 shadow-xs flex flex-col justify-center items-center h-[72px] w-[130px] sm:w-[140px] transition-all hover:shadow-sm">
                        <div className="text-xs sm:text-sm font-bold text-amber-600 dark:text-amber-400">
                          {pendingTvsPct}%
                        </div>
                        <div className="text-[10px] sm:text-[11px] font-semibold text-amber-700 dark:text-amber-300 whitespace-nowrap">
                          Pending TVS Review
                        </div>
                        <div className="text-[9px] text-gray-500 dark:text-gray-400 font-medium">
                          ({pendingTvsCount})
                        </div>
                      </div>

                      {/* TVS Accepted */}
                      <div className="text-center p-2.5 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-100/70 dark:border-emerald-800/30 shadow-xs flex flex-col justify-center items-center h-[72px] w-[130px] sm:w-[140px] transition-all hover:shadow-sm">
                        <div className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400">
                          {tvsAccPct}%
                        </div>
                        <div className="text-[10px] sm:text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                          TVS Accepted
                        </div>
                        <div className="text-[9px] text-gray-500 dark:text-gray-400 font-medium">
                          ({tvsAccCount})
                        </div>
                      </div>

                      {/* TVS Defects / Rework */}
                      <div className="text-center p-2.5 bg-rose-50/70 dark:bg-rose-950/20 rounded-xl border border-rose-200/80 dark:border-rose-800/40 shadow-xs flex flex-col justify-center items-center h-[72px] w-[130px] sm:w-[140px] transition-all hover:shadow-sm">
                        <div className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400">
                          {tvsDefPct}%
                        </div>
                        <div className="text-[10px] sm:text-[11px] font-semibold text-rose-700 dark:text-rose-300 whitespace-nowrap">
                          TVS Defects / Rework
                        </div>
                        <div className="text-[9px] text-gray-500 dark:text-gray-400 font-medium">
                          ({tvsDefCount})
                        </div>
                      </div>
                    </div>

                    {/* Center: Doughnut Chart */}
                    <div style={{ height: "260px", minHeight: "260px", position: "relative" }} className="flex-1 w-full min-w-0 flex items-center justify-center">
                      <Doughnut data={data} options={options} />

                      <div
                        className="absolute pointer-events-none flex flex-col items-center justify-center select-none"
                        style={{
                          top: "calc(50% - 15px)",
                          left: "50%",
                          transform: "translate(-50%, -50%)",
                        }}
                      >
                        <span className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white leading-none tracking-tight">
                          {centerAcceptedCount}
                        </span>
                        <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 tracking-wider mt-1">
                          ACCEPTED
                        </span>
                      </div>
                    </div>

                    {/* Right: Pipeline / Dispatch Cards placed Top-to-Bottom */}
                    <div className="flex flex-col gap-2 justify-center items-center flex-shrink-0">
                      {/* Dispatched */}
                      <div
                        onClick={() => onNavigateToResponses("Dispatched / Enabled")}
                        className="text-center p-2.5 bg-indigo-50/60 dark:bg-indigo-950/20 rounded-xl border border-indigo-100/70 dark:border-indigo-800/30 shadow-xs flex flex-col justify-center items-center h-[72px] w-[130px] sm:w-[140px] transition-all hover:shadow-sm cursor-pointer hover:border-indigo-400 hover:scale-[1.02] active:scale-95"
                        title="Click to view Dispatched responses in table"
                      >
                        <div className="text-xs sm:text-sm font-bold text-indigo-600 dark:text-indigo-400">
                          {totalPieChartData.dispatched}%
                        </div>
                        <div className="text-[10px] sm:text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 whitespace-nowrap">
                          Dispatched
                        </div>
                        <div className="text-[9px] text-gray-500 dark:text-gray-400 font-medium">
                          ({totalPieChartData.counts.dispatched})
                        </div>
                      </div>

                      {/* Pending Dispatch */}
                      <div
                        onClick={() => onNavigateToResponses("Pending Dispatch")}
                        className="text-center p-2.5 bg-amber-50/60 dark:bg-amber-950/20 rounded-xl border border-amber-100/70 dark:border-amber-800/30 shadow-xs flex flex-col justify-center items-center h-[72px] w-[130px] sm:w-[140px] transition-all hover:shadow-sm cursor-pointer hover:border-amber-400 hover:scale-[1.02] active:scale-95"
                        title="Click to view Pending Dispatch responses in table"
                      >
                        <div className="text-xs sm:text-sm font-bold text-amber-600 dark:text-amber-400">
                          {totalPieChartData.pendingDispatch}%
                        </div>
                        <div className="text-[10px] sm:text-[11px] font-semibold text-amber-700 dark:text-amber-300 whitespace-nowrap">
                          Pending Dispatch
                        </div>
                        <div className="text-[9px] text-gray-500 dark:text-gray-400 font-medium">
                          ({totalPieChartData.counts.pendingDispatch})
                        </div>
                      </div>

                      {/* Total BIW Review */}
                      <div className="text-center p-2.5 bg-teal-50/60 dark:bg-teal-950/20 rounded-xl border border-teal-100/70 dark:border-teal-800/30 shadow-xs flex flex-col justify-center items-center h-[72px] w-[130px] sm:w-[140px] transition-all hover:shadow-sm">
                        <div className="text-xs sm:text-sm font-bold text-teal-600 dark:text-teal-400">
                          {totalPieChartData.biwReviewed}%
                        </div>
                        <div className="text-[10px] sm:text-[11px] font-semibold text-teal-700 dark:text-teal-300 whitespace-nowrap">
                          Total BIW Review
                        </div>
                        <div className="text-[9px] text-gray-500 dark:text-gray-400 font-medium">
                          ({totalPieChartData.counts.biwReviewed})
                        </div>
                      </div>

                      {/* Pending Data */}
                      <div className="text-center p-2.5 bg-rose-50/70 dark:bg-rose-950/20 rounded-xl border border-rose-200/80 dark:border-rose-800/40 shadow-xs flex flex-col justify-center items-center h-[72px] w-[130px] sm:w-[140px] transition-all hover:shadow-sm">
                        <div className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400">
                          {totalPieChartData.pendingData}%
                        </div>
                        <div className="text-[10px] sm:text-[11px] font-semibold text-rose-700 dark:text-rose-300 whitespace-nowrap">
                          Pending Data
                        </div>
                        <div className="text-[9px] text-gray-500 dark:text-gray-400 font-medium">
                          ({totalPieChartData.counts.pendingData})
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Bottom: Core Inspection Statuses */}
            <div className="mt-4 grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-6 gap-2">
              {/* Total Submissions */}
              <div className="text-center p-2.5 bg-purple-50/60 dark:bg-purple-900/15 rounded-xl border border-purple-100/70 dark:border-purple-800/30 shadow-xs flex flex-col justify-center items-center h-[72px]">
                <div className="text-xs sm:text-sm font-bold text-purple-600 dark:text-purple-400">
                  100%
                </div>
                <div className="text-[10px] sm:text-[11px] font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  Total Submissions
                </div>
                <div className="text-[9px] text-gray-500 dark:text-gray-400 font-medium">
                  ({totalPieChartData.counts.total})
                </div>
              </div>

              {/* Direct Ok */}
              <div className="text-center p-2.5 bg-green-50/60 dark:bg-green-900/15 rounded-xl border border-green-100/70 dark:border-green-800/30 shadow-xs flex flex-col justify-center items-center h-[72px]">
                <div className="text-xs sm:text-sm font-bold text-green-600 dark:text-green-400">
                  {totalPieChartData.directOk}%
                </div>
                <div className="text-[10px] sm:text-[11px] font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  Direct Ok
                </div>
                <div className="text-[9px] text-gray-500 dark:text-gray-400 font-medium">
                  ({totalPieChartData.counts.directOk})
                </div>
              </div>

              {/* Rework Accepted */}
              <div className="text-center p-2.5 bg-blue-50/60 dark:bg-blue-900/15 rounded-xl border border-blue-100/70 dark:border-blue-800/30 shadow-xs flex flex-col justify-center items-center h-[72px]">
                <div className="text-xs sm:text-sm font-bold text-blue-600 dark:text-blue-400">
                  {totalPieChartData.reworkCompleted}%
                </div>
                <div className="text-[10px] sm:text-[11px] font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  Rework Accepted
                </div>
                <div className="text-[9px] text-gray-500 dark:text-gray-400 font-medium">
                  ({totalPieChartData.counts.reworkCompleted})
                </div>
              </div>

              {/* Ongoing Rework */}
              <div className="text-center p-2.5 bg-amber-50/60 dark:bg-amber-900/15 rounded-xl border border-amber-100/70 dark:border-amber-800/30 shadow-xs flex flex-col justify-center items-center h-[72px]">
                <div className="text-xs sm:text-sm font-bold text-amber-600 dark:text-amber-400">
                  {totalPieChartData.na}%
                </div>
                <div className="text-[10px] sm:text-[11px] font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  Rework
                </div>
                <div className="text-[9px] text-gray-500 dark:text-gray-400 font-medium">
                  ({totalPieChartData.counts.na})
                </div>
              </div>

              {/* Rejected */}
              <div className="text-center p-2.5 bg-red-50/60 dark:bg-red-900/15 rounded-xl border border-red-100/70 dark:border-red-800/30 shadow-xs flex flex-col justify-center items-center h-[72px]">
                <div className="text-xs sm:text-sm font-bold text-red-600 dark:text-red-400">
                  {totalPieChartData.no}%
                </div>
                <div className="text-[10px] sm:text-[11px] font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  Rejected
                </div>
                <div className="text-[9px] text-gray-500 dark:text-gray-400 font-medium">
                  ({totalPieChartData.counts.no})
                </div>
              </div>

              {/* Total Defects */}
              <div className="text-center p-2.5 bg-rose-50/70 dark:bg-rose-950/20 rounded-xl border border-rose-200/80 dark:border-rose-800/40 shadow-xs flex flex-col justify-center items-center h-[72px]">
                <div className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400">
                  {totalPieChartData.defects}%
                </div>
                <div className="text-[10px] sm:text-[11px] font-semibold text-rose-700 dark:text-rose-300 whitespace-nowrap">
                  Total Defects
                </div>
                <div className="text-[9px] text-rose-600 dark:text-rose-400 font-medium">
                  ({totalPieChartData.counts.defects})
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default OverallQualityPieChart;
