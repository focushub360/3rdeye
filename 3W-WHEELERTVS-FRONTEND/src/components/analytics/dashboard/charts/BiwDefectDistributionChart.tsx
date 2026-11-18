import React, { useMemo } from "react";
import { Bar } from "react-chartjs-2";
import { BarChart3, CheckCircle } from "lucide-react";
import type { Response, Form } from "../types";

export interface BiwDefectDistributionChartProps {
  defectChartResponses: Response[];
  responses: Response[];
  tableResponses: Response[];
  form: Form | null;
  chartSortOrder: "default" | "percentage";
  setChartSortOrder: (order: "default" | "percentage") => void;
  chartOrientation: "h" | "v";
  setChartOrientation: (orientation: "h" | "v") => void;
  dateFilter: { startDate?: string; endDate?: string };
  commonDateRangeLabel: string;
}

export const BiwDefectDistributionChart: React.FC<BiwDefectDistributionChartProps> = ({
  defectChartResponses,
  responses,
  tableResponses,
  form,
  chartSortOrder,
  setChartSortOrder,
  chartOrientation,
  setChartOrientation,
  dateFilter,
  commonDateRangeLabel,
}) => {
    const biwProcessedQuestions = useMemo(() => {
      // ✅ STEP 1: Deduplicate responses by ID from defectChartResponses, responses, and tableResponses
      const uniqueResponsesMap = new Map();
      const allResponses = [
        ...defectChartResponses,
        ...responses,
        ...tableResponses
      ];
      allResponses.forEach((response) => {
        const id = String(response.id || (response as any)._id || "");
        if (id && !uniqueResponsesMap.has(id)) {
          uniqueResponsesMap.set(id, response);
        }
      });
      const uniqueResponses = Array.from(uniqueResponsesMap.values());

      const qMap = new Map<string, { id: string; text: string; rejected: number; rework: number }>();

      // Pre-map question text from form sections
      const questionTextMap = new Map<string, string>();
      form?.sections?.forEach((section: any) => {
        section?.questions?.forEach((q: any) => {
          if (q?.id) questionTextMap.set(q.id, q.text || q.title || q.id);
        });
      });

      uniqueResponses.forEach((response) => {
        const biwStatus = response.biwReview?.status;
        if (!biwStatus) return;

        const sNorm = String(biwStatus).trim().toLowerCase();
        const isRejected = sNorm === "rejected";
        const isRework = sNorm.includes("rework");
        if (!isRejected && !isRework) return; // Do not count Accepted as defects

        // Collect flagged questions strictly from biwReview only (TVS chat review belongs to TVS Defect Distribution)
        const rawFlagged = [
          ...(Array.isArray(response.biwReview?.flaggedQuestions) ? response.biwReview.flaggedQuestions : []),
          ...(Array.isArray((response as any).biwReview?.questionContexts) ? (response as any).biwReview.questionContexts : []),
          ...(Array.isArray((response as any).biwReview?.defects) ? (response as any).biwReview.defects : []),
        ];

        // Deduplicate per response so each defect category is counted once per submission
        const seenInThisResponse = new Set<string>();
        const flaggedInThisResponse: { id: string; text: string }[] = [];
        rawFlagged.forEach((fq: any) => {
          if (!fq) return;
          const qId = typeof fq === "object" ? (fq.questionId || fq.id || "") : String(fq);
          const qText = typeof fq === "object"
            ? (fq.questionText || fq.title || fq.text || questionTextMap.get(qId) || qId)
            : (questionTextMap.get(qId) || qId);
          const key = (qId ? String(qId).trim() : "") || String(qText).trim().toLowerCase();
          if (!key) return;
          if (!seenInThisResponse.has(key)) {
            seenInThisResponse.add(key);
            flaggedInThisResponse.push({ id: qId || key, text: qText || key });
          }
        });

        if (flaggedInThisResponse.length > 0) {
          flaggedInThisResponse.forEach(({ id: qId, text: qText }) => {
            if (!qMap.has(qId)) {
              qMap.set(qId, {
                id: qId,
                text: qText,
                rejected: 0,
                rework: 0
              });
            }
            const stat = qMap.get(qId)!;
            if (isRejected) {
              stat.rejected++;
            } else {
              stat.rework++;
            }
          });
        } else {
          // Extract defect/rework answers directly from response.answers
          let foundDefectAnswer = false;
          const answersObj = response.answers instanceof Map
            ? Object.fromEntries(response.answers)
            : response.answers;

          if (answersObj) {
            for (const [qId, ans] of Object.entries(answersObj)) {
              if (ans === null || ans === undefined || qId.includes("chassis") || qId === "chassis_number") continue;

              let ansStatus = "";
              if (typeof ans === "object" && ans !== null) {
                ansStatus = (ans as any).status || "";
              } else if (typeof ans === "string") {
                ansStatus = ans;
              }

              const sLower = ansStatus.toLowerCase().trim();
              const isAnsRejected = sLower === "rejected" || sLower === "no";
              const isAnsRework = sLower === "rework" || sLower === "reworked" || sLower.includes("re-rework") || sLower === "not ok" || sLower === "defect";

              if (isAnsRejected || isAnsRework) {
                foundDefectAnswer = true;
                const qText = questionTextMap.get(qId) || qId;
                if (!qMap.has(qId)) {
                  qMap.set(qId, {
                    id: qId,
                    text: qText,
                    rejected: 0,
                    rework: 0
                  });
                }
                const stat = qMap.get(qId)!;
                if (isRejected || isAnsRejected) {
                  stat.rejected++;
                } else {
                  stat.rework++;
                }
              }
            }
          }

          // Category is required — uncategorized reviews without specific defect questions are omitted from category breakdown
          const specificReason = (response.biwReview?.remark || response.biwReview?.reason || "")?.trim();
          if (!foundDefectAnswer && specificReason) {
            if (specificReason.toLowerCase() !== "general" && !specificReason.toLowerCase().includes("general biw")) {
              const genId = "biw-reason-" + specificReason.toLowerCase().replace(/[^a-z0-9]/g, "-");
              if (!qMap.has(genId)) {
                qMap.set(genId, {
                  id: genId,
                  text: specificReason,
                  rejected: 0,
                  rework: 0
                });
              }
              const stat = qMap.get(genId)!;
              if (isRejected) {
                stat.rejected++;
              } else {
                stat.rework++;
              }
            }
          }
        }
      });

      let filtered = Array.from(qMap.values()).map(q => ({
        ...q,
        total: q.rejected + q.rework
      })).filter(q => q.rejected > 0 || q.rework > 0);

      if (chartSortOrder === "percentage") {
        filtered = [...filtered].sort((a, b) => {
          const percentA = ((a.rejected + a.rework) / (a.total || 1)) * 100;
          const percentB = ((b.rejected + b.rework) / (b.total || 1)) * 100;
          return percentB - percentA;
        });
      } else {
        filtered = [...filtered].sort((a, b) => (b.rejected + b.rework) - (a.rejected + a.rework));
      }

      // Return all categories so no defect data is hidden
      return filtered;
    }, [defectChartResponses, responses, tableResponses, chartSortOrder, form]);

    if (
      !biwProcessedQuestions.length &&
      !dateFilter.startDate &&
      !dateFilter.endDate
    )
      return null;

    const data = {
      labels: biwProcessedQuestions.map((q) =>
        q.text.length > 25 ? q.text.substring(0, 25) + "..." : q.text,
      ),
      datasets: [
        {
          label: "Rejected (BIW)",
          data: biwProcessedQuestions.map((q) => q.rejected),
          backgroundColor: "rgba(220, 38, 38, 0.9)", // Crimson Red
          borderColor: "rgb(185, 28, 28)",
          borderWidth: 1,
          barPercentage: biwProcessedQuestions.length <= 2 ? 0.3 : 0.7,
          categoryPercentage: 0.8,
          datalabels: {
            color: "#ffffff",
            font: { weight: "bold" as const, size: 10 },
            formatter: (value: number) => (value > 0 ? value : ""),
            textAlign: "center" as const,
          },
        },
        {
          label: "Rework (BIW)",
          data: biwProcessedQuestions.map((q) => q.rework),
          backgroundColor: "rgba(71, 85, 105, 0.9)", // Slate Gray
          borderColor: "rgb(51, 65, 85)",
          borderWidth: 1,
          barPercentage: biwProcessedQuestions.length <= 2 ? 0.3 : 0.7,
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
              ? "#e5e7eb"
              : "#374151",
            font: { size: 10, weight: "600" as const },
            maxRotation: chartOrientation === "v" ? 45 : 0,
            minRotation: 0,
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
          height: `${Math.max(450, biwProcessedQuestions.length * 40)}px`,
          position: "relative" as const,
        }
        : {
          height: "400px",
          minWidth: biwProcessedQuestions.length > 8 ? `${Math.max(600, biwProcessedQuestions.length * 65)}px` : "100%",
          position: "relative" as const,
        };

    return (
      <div
        id="biw-defect-distribution-chart"
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
                BIW Defect Distribution
              </h3>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">
                BIW Rejected & Rework volume ({commonDateRangeLabel})
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

        {biwProcessedQuestions.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[300px] text-center p-8">
            <div className="p-4 bg-slate-50 dark:bg-gray-800/50 rounded-full mb-4">
              <CheckCircle className="w-12 h-12 text-green-500 opacity-50" />
            </div>
            <h4 className="text-slate-900 dark:text-white font-bold mb-1">
              No BIW Defects Found
            </h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">
              No BIW rejected or rework responses were found for your current
              selection.
            </p>
          </div>
        ) : (
          <div
            className={chartOrientation === "h" ? "overflow-y-auto max-h-[700px]" : "w-full overflow-x-auto"}
          >
            <div style={containerStyle} id="biw-issue-percentage-chart">
              <Bar data={data} options={options} />
            </div>
          </div>
        )}
      </div>
    );
};

export default BiwDefectDistributionChart;
