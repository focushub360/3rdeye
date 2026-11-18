import React, { useMemo } from "react";
import { Bar } from "react-chartjs-2";
import { BarChart3, CheckCircle } from "lucide-react";
import type { Response, Form } from "../types";

export interface TvsDefectDistributionChartProps {
  form: Form | null;
  tvsReviews: any[];
  defectChartResponses: Response[];
  responses: Response[];
  tableResponses: Response[];
  chartSortOrder: "default" | "percentage";
  setChartSortOrder: (order: "default" | "percentage") => void;
  chartOrientation: "h" | "v";
  setChartOrientation: (orientation: "h" | "v") => void;
  dateFilter: { startDate?: string; endDate?: string };
  commonDateRangeLabel: string;
}

export const TvsDefectDistributionChart: React.FC<TvsDefectDistributionChartProps> = ({
  form,
  tvsReviews,
  defectChartResponses,
  responses,
  tableResponses,
  chartSortOrder,
  setChartSortOrder,
  chartOrientation,
  setChartOrientation,
  dateFilter,
  commonDateRangeLabel,
}) => {
    const tvsProcessedQuestions = useMemo(() => {
      // Pre-map question text from form sections
      const questionTextMap = new Map<string, string>();
      form?.sections?.forEach((section: any) => {
        section?.questions?.forEach((q: any) => {
          if (q?.id) questionTextMap.set(q.id, q.text || q.title || q.id);
        });
      });

      const qMap = new Map<string, { id: string; text: string; rejected: number; rework: number; accepted: number }>();
      const processedResponseIds = new Set<string>();

      // ✅ STEP 1: Deduplicate tvsReviews by responseId
      const uniqueReviewsMap = new Map();
      tvsReviews.forEach((review) => {
        const id = String(review.responseId || review.response_id || review.id || review._id || "");
        if (id && !uniqueReviewsMap.has(id)) {
          uniqueReviewsMap.set(id, review);
        }
      });
      const uniqueReviews = Array.from(uniqueReviewsMap.values());

      // 1. Process reviews from uniqueReviews (Chat / TVS reviews)
      uniqueReviews.forEach((review) => {
        const status = review.reviewOption || review.option || review.status;
        const normStatus = String(status || "").trim().toLowerCase();
        const isRejected = normStatus === "rejected";
        const isRework = normStatus.includes("rework");
        const isAccepted = normStatus === "accepted";

        if (!isRejected && !isRework && !isAccepted) return;

        const rId = String(review.responseId || review.response_id || review.id || review._id || "");
        if (rId) processedResponseIds.add(rId);

        // Check flagged questions on review (from Chat question selection)
        const flaggedList = (review.questionContexts && review.questionContexts.length > 0)
          ? review.questionContexts
          : (Array.isArray(review.flaggedQuestions) && review.flaggedQuestions.length > 0
            ? review.flaggedQuestions
            : []);

        if (flaggedList.length > 0) {
          flaggedList.forEach((qc: any) => {
            const qId = typeof qc === "object" ? (qc.questionId || qc.id) : String(qc);
            const qText = typeof qc === "object"
              ? (qc.title || qc.questionText || qc.text || questionTextMap.get(qId) || qId)
              : (questionTextMap.get(qId) || qId);

            if (/^(chassis(\s*number)?|vin|frame(\s*number)?|identification(\s*number)?)$/i.test(String(qText).trim())) return;

            if (!qMap.has(qId)) {
              qMap.set(qId, {
                id: qId,
                text: qText,
                rejected: 0,
                rework: 0,
                accepted: 0
              });
            }
            const stat = qMap.get(qId)!;
            if (isRejected) {
              stat.rejected++;
            } else if (isRework) {
              stat.rework++;
            } else if (isAccepted) {
              stat.accepted++;
            }
          });
        } else {
          // If review object didn't have flagged questions, inspect the corresponding Response document
          const resp = defectChartResponses.find(r => String(r.id || (r as any)._id) === rId) ||
            responses.find(r => String(r.id || (r as any)._id) === rId) ||
            tableResponses.find(r => String(r.id || (r as any)._id) === rId);

          let foundFlaggedOnResp = false;
          const respFlagged = (Array.isArray(resp?.review?.flaggedQuestions) && resp.review.flaggedQuestions.length > 0)
            ? resp.review.flaggedQuestions
            : (Array.isArray(resp?.review?.questionContexts) && resp.review.questionContexts.length > 0
              ? resp.review.questionContexts
              : []);

          if (respFlagged.length > 0) {
            foundFlaggedOnResp = true;
            respFlagged.forEach((fq: any) => {
              const qId = typeof fq === "object" ? (fq.questionId || fq.id) : String(fq);
              const qText = typeof fq === "object"
                ? (fq.questionText || fq.title || fq.text || questionTextMap.get(qId) || qId)
                : (questionTextMap.get(qId) || qId);

              if (/^(chassis(\s*number)?|vin|frame(\s*number)?|identification(\s*number)?)$/i.test(String(qText).trim())) return;

              if (!qMap.has(qId)) {
                qMap.set(qId, { id: qId, text: qText, rejected: 0, rework: 0, accepted: 0 });
              }
              const stat = qMap.get(qId)!;
              if (isRejected) stat.rejected++;
              else if (isRework) stat.rework++;
              else if (isAccepted) stat.accepted++;
            });
          }

          if (!foundFlaggedOnResp && resp && resp.answers) {
            const answersObj = resp.answers instanceof Map ? Object.fromEntries(resp.answers) : resp.answers;
            let foundDefectAns = false;
            for (const [qId, ans] of Object.entries(answersObj)) {
              if (ans === null || ans === undefined || qId.includes("chassis") || qId === "chassis_number") continue;
              const qText = questionTextMap.get(qId) || qId;
              let ansStatus = "";
              if (typeof ans === "object" && ans !== null) {
                ansStatus = (ans as any).status || "";
              } else if (typeof ans === "string") {
                ansStatus = ans;
              }
              const sLower = ansStatus.toLowerCase().trim();
              const isDefect = sLower === "rework" || sLower === "rejected" || sLower === "not ok" || sLower === "defect";

              if (isDefect || isAccepted) {
                foundDefectAns = true;
                if (!qMap.has(qId)) {
                  qMap.set(qId, { id: qId, text: qText, rejected: 0, rework: 0, accepted: 0 });
                }
                const stat = qMap.get(qId)!;
                if (isRejected && isDefect) {
                  stat.rejected++;
                } else if (isRework && isDefect) {
                  stat.rework++;
                } else if (isAccepted && !isDefect) {
                  stat.accepted++;
                }
              }
            }
            if (!foundDefectAns && (isRejected || isRework)) {
              let label = (review as any).notes || (review as any).remark || (review as any).reason || "";
              if (label) {
                const lLower = label.toLowerCase().trim();
                for (const [, formQText] of questionTextMap.entries()) {
                  if (formQText && (lLower.includes(formQText.toLowerCase()) || formQText.toLowerCase().includes(lLower))) {
                    label = formQText;
                    break;
                  }
                }
              }
              if (!label || label.toLowerCase().trim() === "rework" || label.toLowerCase().trim() === "rejected") {
                label = "TVS Review Assessment";
              }
              const qId = "tvs-gen-" + label.toLowerCase().replace(/[^a-z0-9]/g, "-");
              if (!qMap.has(qId)) {
                qMap.set(qId, { id: qId, text: label, rejected: 0, rework: 0, accepted: 0 });
              }
              const stat = qMap.get(qId)!;
              if (isRejected) stat.rejected++;
              else if (isRework) stat.rework++;
            }
          }
        }
      });

      // 2. Also process responses where response.review is set directly (e.g. from DB)
      const allResponsesToCheck = [
        ...defectChartResponses,
        ...responses,
        ...tableResponses
      ];
      const seenDocIds = new Set<string>();

      allResponsesToCheck.forEach((response) => {
        const rId = String(response.id || (response as any)._id || "");
        if (!rId || seenDocIds.has(rId) || processedResponseIds.has(rId)) return;
        seenDocIds.add(rId);

        const rev = response.review;
        const status = rev?.reviewOption || rev?.status;
        const normStatus = String(status || "").trim().toLowerCase();
        const isRejected = normStatus === "rejected";
        const isRework = normStatus.includes("rework");
        const isAccepted = normStatus === "accepted";

        if (!isRejected && !isRework && !isAccepted) return;

        // Check if rev has flaggedQuestions or questionContexts from Chat selection!
        const revFlaggedList = (Array.isArray(rev?.questionContexts) && rev.questionContexts.length > 0)
          ? rev.questionContexts
          : (Array.isArray(rev?.flaggedQuestions) && rev.flaggedQuestions.length > 0
            ? rev.flaggedQuestions
            : []);

        if (revFlaggedList.length > 0) {
          revFlaggedList.forEach((fq: any) => {
            const qId = typeof fq === "object" ? (fq.questionId || fq.id) : String(fq);
            const qText = typeof fq === "object"
              ? (fq.questionText || fq.title || fq.text || questionTextMap.get(qId) || qId)
              : (questionTextMap.get(qId) || qId);

            if (!qMap.has(qId)) {
              qMap.set(qId, { id: qId, text: qText, rejected: 0, rework: 0, accepted: 0 });
            }
            const stat = qMap.get(qId)!;
            if (isRejected) stat.rejected++;
            else if (isRework) stat.rework++;
            else if (isAccepted) stat.accepted++;
          });
          return;
        }

        let foundAny = false;
        const answersObj = response.answers instanceof Map ? Object.fromEntries(response.answers) : response.answers;
        if (answersObj) {
          for (const [qId, ans] of Object.entries(answersObj)) {
            if (ans === null || ans === undefined || qId.includes("chassis") || qId === "chassis_number") continue;
            const qText = questionTextMap.get(qId) || qId;
            let ansStatus = "";
            if (typeof ans === "object" && ans !== null) {
              ansStatus = (ans as any).status || "";
            } else if (typeof ans === "string") {
              ansStatus = ans;
            }
            const sLower = ansStatus.toLowerCase().trim();
            const isDefect = sLower === "rework" || sLower === "rejected" || sLower === "not ok" || sLower === "defect";

            if (isDefect || isAccepted) {
              foundAny = true;
              if (!qMap.has(qId)) {
                qMap.set(qId, { id: qId, text: qText, rejected: 0, rework: 0, accepted: 0 });
              }
              const stat = qMap.get(qId)!;
              if (isRejected && isDefect) {
                stat.rejected++;
              } else if (isRework && isDefect) {
                stat.rework++;
              } else if (isAccepted && !isDefect) {
                stat.accepted++;
              }
            }
          }
        }
        if (!foundAny && (isRejected || isRework)) {
          let label = rev.feedback || rev.notes || rev.remark || rev.reason || "";
          if (label) {
            const lLower = label.toLowerCase().trim();
            for (const [, formQText] of questionTextMap.entries()) {
              if (formQText && (lLower.includes(formQText.toLowerCase()) || formQText.toLowerCase().includes(lLower))) {
                label = formQText;
                break;
              }
            }
          }
          if (!label || label.toLowerCase().trim() === "rework" || label.toLowerCase().trim() === "rejected") {
            label = "TVS Review Assessment";
          }
          const qId = "tvs-gen-" + label.toLowerCase().replace(/[^a-z0-9]/g, "-");
          if (!qMap.has(qId)) {
            qMap.set(qId, { id: qId, text: label, rejected: 0, rework: 0, accepted: 0 });
          }
          const stat = qMap.get(qId)!;
          if (isRejected) stat.rejected++;
          else if (isRework) stat.rework++;
        }
      });

      let filtered = Array.from(qMap.values()).map(q => {
        const totalEvaluated = (q.accepted || 0) + q.rejected + q.rework;
        const denominator = totalEvaluated > 0 ? totalEvaluated : 1;
        return {
          ...q,
          total: denominator,
          issuePercent: ((q.rejected + q.rework) / denominator) * 100,
        };
      }).filter(q => q.rejected > 0 || q.rework > 0);

      if (chartSortOrder === "percentage") {
        filtered = [...filtered].sort((a, b) => (b.issuePercent || 0) - (a.issuePercent || 0));
      } else {
        filtered = [...filtered].sort((a, b) => (b.rejected + b.rework) - (a.rejected + a.rework));
      }

      return filtered.slice(0, 20);
    }, [tvsReviews, defectChartResponses, responses, tableResponses, chartSortOrder, form]);

    if (
      !tvsProcessedQuestions.length &&
      !dateFilter.startDate &&
      !dateFilter.endDate
    )
      return null;

    const maxDefectVal = Math.max(
      ...tvsProcessedQuestions.map((q) => q.rejected + q.rework),
      1
    );

    const data = {
      labels: tvsProcessedQuestions.map((q) =>
        q.text.length > 25 ? q.text.substring(0, 25) + "..." : q.text,
      ),
      datasets: [
        {
          label: "Rejected (TVS Review)",
          data: tvsProcessedQuestions.map((q) => q.rejected),
          backgroundColor: "rgba(153, 27, 27, 0.85)", // Dark Red
          borderColor: "rgb(127, 29, 29)",
          borderWidth: 1,
          borderRadius: 4,
          maxBarThickness: 56,
          barPercentage: tvsProcessedQuestions.length <= 2 ? 0.3 : 0.7,
          categoryPercentage: 0.8,
          datalabels: {
            color: "#ffffff",
            font: { weight: "bold" as const, size: 10 },
            formatter: (value: number) => (value > 0 ? value : ""),
            textAlign: "center" as const,
          },
        },
        {
          label: "Rework (TVS Review)",
          data: tvsProcessedQuestions.map((q) => q.rework),
          backgroundColor: "rgba(55, 65, 81, 0.85)", // Dark Gray
          borderColor: "rgb(31, 41, 55)",
          borderWidth: 1,
          borderRadius: 4,
          maxBarThickness: 56,
          barPercentage: tvsProcessedQuestions.length <= 2 ? 0.3 : 0.7,
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
          backgroundColor: "rgba(15, 23, 42, 0.95)",
          padding: 12,
          cornerRadius: 8,
          titleFont: { size: 11, weight: "bold" as const },
          bodyFont: { size: 11 },
          callbacks: {
            title: function (tooltipItems: any) {
              const idx = tooltipItems[0]?.dataIndex;
              return tvsProcessedQuestions[idx]?.text || "";
            },
            label: function (context: any) {
              const value = context.raw || 0;
              const idx = context.dataIndex;
              const q = tvsProcessedQuestions[idx];
              const totalDefects = (q?.rejected || 0) + (q?.rework || 0);
              const pctOfDefects = totalDefects > 0 ? ((value / totalDefects) * 100).toFixed(1) : "0.0";
              return `${context.dataset.label}: ${value} (${pctOfDefects}%)`;
            },
          },
        },
      },

      scales: {
        x: {
          stacked: true,
          ...(chartOrientation === "h"
            ? {
              beginAtZero: true,
              suggestedMax: maxDefectVal <= 2 ? maxDefectVal + 1 : undefined,
              ticks: {
                stepSize: 1,
                precision: 0,
                color: document.documentElement.classList.contains("dark") ? "#9ca3af" : "#6b7280",
                font: { size: 10 },
              },
            }
            : {
              ticks: {
                color: document.documentElement.classList.contains("dark")
                  ? "#e5e7eb"
                  : "#374151",
                font: { size: 10, weight: "600" as const },
                maxRotation: 45,
                minRotation: 0,
              },
              grid: {
                display: false,
              },
            }),
        },
        y: {
          stacked: true,
          ...(chartOrientation === "v"
            ? {
              beginAtZero: true,
              suggestedMax: maxDefectVal <= 2 ? maxDefectVal + 1 : undefined,
              ticks: {
                stepSize: 1,
                precision: 0,
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
            }
            : {
              ticks: {
                color: document.documentElement.classList.contains("dark")
                  ? "#e5e7eb"
                  : "#374151",
                font: { size: 10, weight: "600" as const },
              },
              grid: {
                display: false,
              },
            }),
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
          height: `${Math.max(450, tvsProcessedQuestions.length * 40)}px`,
          position: "relative" as const,
        }
        : { height: "450px", position: "relative" as const };

    return (
      <div
        id="tvs-defect-distribution-chart"
        className="p-4 sm:p-6 bg-gradient-to-br from-white to-slate-50 dark:from-gray-800 dark:to-gray-900 flex flex-col h-full rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-shadow"
      >
        <div
          data-pdf-hide="true"
          className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6"
        >
          <div className="flex items-center">
            <div className="p-2 bg-gradient-to-br from-indigo-600 to-slate-700 rounded-lg mr-2">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                TVS Defect Distribution
              </h3>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">
                TVS Review volume ({commonDateRangeLabel})
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

        {tvsProcessedQuestions.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[300px] text-center p-8">
            <div className="p-4 bg-slate-50 dark:bg-gray-800/50 rounded-full mb-4">
              <CheckCircle className="w-12 h-12 text-indigo-500 opacity-50" />
            </div>
            <h4 className="text-slate-900 dark:text-white font-bold mb-1">
              No TVS Defects Recorded
            </h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">
              No TVS defect or rework flags were recorded for your current selection.
            </p>
          </div>
        ) : (
          <div
            className={chartOrientation === "h" ? "overflow-y-auto" : "w-full"}
          >
            <div style={containerStyle} id="tvs-issue-percentage-chart">
              <Bar data={data} options={options} />
            </div>
          </div>
        )}
      </div>
    );
};

export default TvsDefectDistributionChart;
