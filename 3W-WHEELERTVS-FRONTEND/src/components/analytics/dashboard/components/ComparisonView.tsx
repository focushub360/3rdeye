import React from 'react';
import { BarChart3, FileText, Users as UsersIcon } from 'lucide-react';
import { Doughnut } from 'react-chartjs-2';
import type { Form, Response, Section } from '../types';

export interface ComparisonViewProps {
  analyticsView: string;
  comparisonViewMode: 'dashboard' | 'responses';
  setComparisonViewMode: (mode: 'dashboard' | 'responses') => void;
  form: Form | null;
  filteredResponses: Response[];
  getResponseTimestamp: (r: any) => string | undefined;
  getSectionYesNoStats: (form: any, answers: any) => any[];
  renderAnswerDisplay: (answer: any, question: any) => React.ReactNode;
  hasAnswerValue: (answer: any) => boolean;
  getRankStyle: (answer: any, darkMode: boolean) => string;
  darkMode: boolean;
}

export const ComparisonView: React.FC<ComparisonViewProps> = ({
  analyticsView,
  comparisonViewMode,
  setComparisonViewMode,
  form,
  filteredResponses,
  getResponseTimestamp,
  getSectionYesNoStats,
  renderAnswerDisplay,
  hasAnswerValue,
  getRankStyle,
  darkMode,
}) => {
  if (analyticsView !== 'comparison') return null;

  return (

                <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-xl border border-gray-200 dark:border-gray-800">
                  <div className="p-4 sm:p-6">
                    {/* View Mode Tabs */}
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex gap-1 bg-white dark:bg-gray-700 rounded-lg p-1 w-fit border border-gray-200 dark:border-gray-600">
                        <button
                          onClick={() => setComparisonViewMode("dashboard")}
                          className={`flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${comparisonViewMode === "dashboard"
                            ? "text-white shadow-sm"
                            : "text-gray-900 dark:text-gray-100 hover:text-black dark:hover:text-white"
                            }`}
                          style={{
                            backgroundColor:
                              comparisonViewMode === "dashboard"
                                ? "#1e3a8a"
                                : "transparent",
                          }}
                        >
                          <BarChart3 className="w-4 h-4" />
                          Dashboard
                        </button>
                        <button
                          onClick={() => setComparisonViewMode("responses")}
                          className={`flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${comparisonViewMode === "responses"
                            ? "text-white shadow-sm"
                            : "text-gray-900 dark:text-gray-100 hover:text-black dark:hover:text-white"
                            }`}
                          style={{
                            backgroundColor:
                              comparisonViewMode === "responses"
                                ? "#1e3a8a"
                                : "transparent",
                          }}
                        >
                          <FileText className="w-4 h-4" />
                          Responses
                        </button>
                      </div>

                      <div className="flex items-center gap-6 mx-4">
                        <div className="text-center">
                          <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                            {form?.title}
                          </h2>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            Last 5 Responses Comparison
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Content Area */}
                    {comparisonViewMode === "dashboard" ? (
                      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-5 gap-4">
                        {(() => {
                          const last5 = filteredResponses
                            .filter((r) => getResponseTimestamp(r))
                            .sort((a, b) => {
                              const dateA = new Date(
                                getResponseTimestamp(a)!,
                              ).getTime();
                              const dateB = new Date(
                                getResponseTimestamp(b)!,
                              ).getTime();
                              return dateB - dateA;
                            })
                            .slice(0, 5);

                          if (last5.length === 0) {
                            return (
                              <div className="col-span-full flex flex-col items-center justify-center min-h-64 py-12">
                                <UsersIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
                                <p className="text-gray-600 dark:text-gray-400 font-medium">
                                  No responses to compare
                                </p>
                              </div>
                            );
                          }

                          return last5.map((response, idx) => {
                            const sectionStats = getSectionYesNoStats(
                              form,
                              response.answers || {},
                            );
                            const filteredSectionStats = sectionStats.filter(
                              (stat) =>
                                stat.yes > 0 ||
                                stat.no > 0 ||
                                stat.na > 0 ||
                                (stat.accepted && stat.accepted > 0) ||
                                (stat.rejected && stat.rejected > 0) ||
                                (stat.rework && stat.rework > 0),
                            );

                            const totalQuestions = filteredSectionStats.reduce(
                              (sum, stat) => sum + stat.total,
                              0,
                            );
                            const totalYes = filteredSectionStats.reduce(
                              (sum, stat) => sum + stat.yes + (stat.accepted || 0),
                              0,
                            );
                            const totalNo = filteredSectionStats.reduce(
                              (sum, stat) => sum + stat.no + (stat.rejected || 0),
                              0,
                            );
                            const totalNA = filteredSectionStats.reduce(
                              (sum, stat) => sum + stat.na + (stat.rework || 0),
                              0,
                            );
                            const totalAnswered = totalYes + totalNo + totalNA;

                            const overallScore =
                              totalQuestions > 0
                                ? ((totalYes / totalQuestions) * 100).toFixed(1)
                                : "0.0";
                            const responseRate =
                              totalQuestions > 0
                                ? ((totalAnswered / totalQuestions) * 100).toFixed(1)
                                : "0.0";
                            const yesPercent =
                              totalAnswered > 0
                                ? ((totalYes / totalAnswered) * 100).toFixed(1)
                                : "0.0";
                            const noPercent =
                              totalAnswered > 0
                                ? ((totalNo / totalAnswered) * 100).toFixed(1)
                                : "0.0";
                            const naPercent =
                              totalAnswered > 0
                                ? ((totalNA / totalAnswered) * 100).toFixed(1)
                                : "0.0";

                            return (
                              <div
                                key={response.id}
                                className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-white dark:bg-gray-800 flex flex-col h-full"
                              >
                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-600 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                                  <div className="flex flex-col items-center text-center">
                                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase mb-1">
                                      Submission #{idx + 1}
                                    </p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">
                                      {getResponseTimestamp(response)
                                        ? formatToDDMMYYYY(
                                          getResponseTimestamp(response)!,
                                          true
                                        )
                                        : "N/A"}
                                    </p>
                                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-300 mt-2">
                                      {overallScore}%
                                    </p>
                                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase mt-1">
                                      Overall Score
                                    </p>
                                  </div>
                                </div>

                                <div className="p-4 space-y-3 flex-1">
                                  <div className="grid grid-cols-3 gap-2">
                                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded border border-indigo-200 dark:border-indigo-700 text-center">
                                      <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase">
                                        Sections
                                      </p>
                                      <p className="text-xl font-bold text-indigo-900 dark:text-indigo-300">
                                        {filteredSectionStats.length}
                                      </p>
                                    </div>
                                    <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded border border-green-200 dark:border-green-700 text-center">
                                      <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase">
                                        Rate
                                      </p>
                                      <p className="text-xl font-bold text-green-900 dark:text-green-300">
                                        {responseRate}%
                                      </p>
                                    </div>
                                    <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded border border-purple-200 dark:border-purple-700 text-center">
                                      <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 uppercase">
                                        Questions
                                      </p>
                                      <p className="text-xl font-bold text-purple-900 dark:text-purple-300">
                                        {totalQuestions}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                                    <p className="text-xs font-semibold text-gray-900 dark:text-white mb-2 text-center">
                                      Distribution
                                    </p>
                                    <div className="space-y-1">
                                      <div className="text-center p-2 bg-green-100/60 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-700">
                                        <p className="text-xs font-semibold text-green-700 dark:text-green-400">
                                          {complianceLabels.yes}
                                        </p>
                                        <p className="text-sm font-bold text-green-800 dark:text-green-300">
                                          {totalYes} ({yesPercent}%)
                                        </p>
                                      </div>
                                      <div className="text-center p-2 bg-red-100/60 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-700">
                                        <p className="text-xs font-semibold text-red-700 dark:text-red-400">
                                          {complianceLabels.no}
                                        </p>
                                        <p className="text-sm font-bold text-red-800 dark:text-red-300">
                                          {totalNo} ({noPercent}%)
                                        </p>
                                      </div>
                                      <div className="text-center p-2 bg-yellow-100/60 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-700">
                                        <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400">
                                          {complianceLabels.na}
                                        </p>
                                        <p className="text-sm font-bold text-yellow-800 dark:text-yellow-300">
                                          {totalNA} ({naPercent}%)
                                        </p>
                                      </div>
                                    </div>
                                  </div>

                                  {filteredSectionStats.length > 0 && (
                                    <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                                      <p className="text-xs font-semibold text-gray-900 dark:text-white mb-3">
                                        Sections
                                      </p>
                                      <div className="space-y-4">
                                        {filteredSectionStats.map((row) => {
                                          const rowYes = row.yes + (row.accepted || 0);
                                          const rowNo = row.no + (row.rejected || 0);
                                          const rowNA = row.na + (row.rework || 0);
                                          const total = rowYes + rowNo + rowNA;
                                          const yesPercent =
                                            total > 0
                                              ? ((rowYes / total) * 100).toFixed(1)
                                              : 0;
                                          const noPercent =
                                            total > 0
                                              ? ((rowNo / total) * 100).toFixed(1)
                                              : 0;
                                          const naPercent =
                                            total > 0
                                              ? ((rowNA / total) * 100).toFixed(1)
                                              : 0;

                                          const chartData = {
                                            labels: [
                                              `${complianceLabels.yes} (${yesPercent}%)`,
                                              `${complianceLabels.no} (${noPercent}%)`,
                                              `${complianceLabels.na} (${naPercent}%)`,
                                            ],
                                            datasets: [
                                              {
                                                data: [rowYes, rowNo, rowNA],
                                                backgroundColor: [
                                                  "#1e3a8a",
                                                  "#3b82f6",
                                                  "#93c5fd",
                                                ],
                                                borderColor: [
                                                  "#1e3a8a",
                                                  "#3b82f6",
                                                  "#93c5fd",
                                                ],
                                                borderWidth: 2,
                                                borderRadius: 4,
                                              },
                                            ],
                                          };

                                          return (
                                            <div
                                              key={row.id}
                                              className="p-3 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/40 dark:to-gray-800/40 rounded-lg border border-gray-200 dark:border-gray-600"
                                            >
                                              <p className="font-semibold text-gray-900 dark:text-white text-[11px] mb-3">
                                                {row.title}
                                              </p>

                                              <div className="flex gap-3">
                                                <div className="flex-1 flex items-center justify-center">
                                                  <div className="w-24 h-24">
                                                    <Doughnut
                                                      data={chartData}
                                                      options={{
                                                        responsive: true,
                                                        maintainAspectRatio: true,
                                                        plugins: {
                                                          legend: {
                                                            display: false,
                                                          },
                                                          tooltip: {
                                                            backgroundColor:
                                                              "rgba(0, 0, 0, 0.8)",
                                                            titleColor: "#ffffff",
                                                            bodyColor: "#ffffff",
                                                            borderColor: "#ffffff",
                                                            borderWidth: 1,
                                                            callbacks: {
                                                              label: (context) => {
                                                                return `${context.label}: ${context.parsed}`;
                                                              },
                                                            },
                                                          },
                                                          datalabels: {
                                                            color: "#ffffff",
                                                            font: {
                                                              weight: "bold",
                                                              size: 10,
                                                            },
                                                            formatter: (
                                                              value,
                                                              context,
                                                            ) => {
                                                              const total =
                                                                context.dataset.data.reduce(
                                                                  (a, b) =>
                                                                    (a as number) +
                                                                    (b as number),
                                                                  0,
                                                                );
                                                              const percentage = (
                                                                ((value as number) /
                                                                  (total as number)) *
                                                                100
                                                              ).toFixed(0);
                                                              return `${percentage}%`;
                                                            },
                                                          },
                                                        },
                                                      }}
                                                    />
                                                  </div>
                                                </div>

                                                <div className="flex-1 flex flex-col justify-center gap-2 text-xs">
                                                  <div className="flex items-center gap-2">
                                                    <div
                                                      className="w-3 h-3 rounded-full"
                                                      style={{
                                                        backgroundColor: "#1e3a8a",
                                                      }}
                                                    ></div>
                                                    <span className="text-gray-700 dark:text-gray-300">
                                                      {complianceLabels.yes}:{" "}
                                                      <span className="font-bold">
                                                        {rowYes}
                                                      </span>{" "}
                                                      ({yesPercent}%)
                                                    </span>
                                                  </div>
                                                  <div className="flex items-center gap-2">
                                                    <div
                                                      className="w-3 h-3 rounded-full"
                                                      style={{
                                                        backgroundColor: "#3b82f6",
                                                      }}
                                                    ></div>
                                                    <span className="text-gray-700 dark:text-gray-300">
                                                      {complianceLabels.no}:{" "}
                                                      <span className="font-bold">
                                                        {rowNo}
                                                      </span>{" "}
                                                      ({noPercent}%)
                                                    </span>
                                                  </div>
                                                  <div className="flex items-center gap-2">
                                                    <div
                                                      className="w-3 h-3 rounded-full"
                                                      style={{
                                                        backgroundColor: "#93c5fd",
                                                      }}
                                                    ></div>
                                                    <span className="text-gray-700 dark:text-gray-300">
                                                      {complianceLabels.na}:{" "}
                                                      <span className="font-bold">
                                                        {rowNA}
                                                      </span>{" "}
                                                      ({naPercent}%)
                                                    </span>
                                                  </div>
                                                  <div className="border-t border-gray-300 dark:border-gray-500 mt-2 pt-2">
                                                    <p className="font-semibold text-gray-900 dark:text-white">
                                                      Total: <span>{total}</span>
                                                    </p>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {response.submissionMetadata?.location && (
                                    <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                                      <p className="text-xs font-semibold text-gray-900 dark:text-white mb-1">
                                        Location
                                      </p>
                                      <p className="text-xs text-gray-700 dark:text-gray-300 truncate">
                                        {response.submissionMetadata.location.city ||
                                          response.submissionMetadata.location.region ||
                                          response.submissionMetadata.location
                                            .country ||
                                          "N/A"}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    ) : (
                      <div className="card p-6">
                        {filteredResponses.length === 0 ? (
                          <div className="flex flex-col items-center justify-center min-h-96 py-12">
                            <UsersIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
                            <p className="text-gray-600 dark:text-gray-400 font-medium">
                              No responses to compare
                            </p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                            <table className="w-full text-sm border-collapse">
                              <thead>
                                <tr className="bg-indigo-50 dark:bg-indigo-900/20">
                                  <th className="sticky left-0 z-20 text-left px-4 py-3 font-semibold text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 min-w-40 bg-indigo-50 dark:bg-indigo-900/20">
                                    Question
                                  </th>
                                  {filteredResponses
                                    .filter((r) => getResponseTimestamp(r))
                                    .sort((a, b) => {
                                      const dateA = new Date(
                                        getResponseTimestamp(a)!,
                                      ).getTime();
                                      const dateB = new Date(
                                        getResponseTimestamp(b)!,
                                      ).getTime();
                                      return dateB - dateA;
                                    })
                                    .slice(0, 5)
                                    .map((response, idx) => (
                                      <th
                                        key={response.id}
                                        className="text-center px-3 py-2 font-semibold text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 min-w-28 bg-gradient-to-b from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30"
                                      >
                                        <div className="flex flex-col gap-0.5">
                                          <span className="text-xs text-gray-600 dark:text-gray-400 leading-tight font-medium">
                                            Sub #{idx + 1}
                                          </span>
                                          <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 leading-tight">
                                            {getResponseTimestamp(response)
                                              ? formatToDDMMYYYY(
                                                getResponseTimestamp(response)!
                                              )
                                              : "N/A"}
                                          </span>
                                        </div>
                                      </th>
                                    ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {form?.sections?.flatMap((section) =>
                                  section.questions?.map((question, qIdx) => {
                                    const last5Responses = filteredResponses
                                      .filter((r) => getResponseTimestamp(r))
                                      .sort((a, b) => {
                                        const dateA = new Date(
                                          getResponseTimestamp(a)!,
                                        ).getTime();
                                        const dateB = new Date(
                                          getResponseTimestamp(b)!,
                                        ).getTime();
                                        return dateB - dateA;
                                      })
                                      .slice(0, 5);

                                    return (
                                      <tr
                                        key={question.id}
                                        className={
                                          qIdx % 2 === 0
                                            ? "bg-white dark:bg-gray-900"
                                            : "bg-gray-50 dark:bg-gray-800/50"
                                        }
                                      >
                                        <td className="sticky left-0 z-10 px-4 py-3 font-medium text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 min-w-60">
                                          <div className="flex flex-col">
                                            <span className="text-sm font-semibold break-words whitespace-normal">
                                              {question.text || "Question"}
                                            </span>
                                            {question.description && (
                                              <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 break-words whitespace-normal">
                                                {question.description}
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                        {last5Responses.map((response) => {
                                          const answer =
                                            response.answers?.[question.id];
                                          const hasAnswer =
                                            answer !== null &&
                                            answer !== undefined &&
                                            answer !== "";

                                          return (
                                            <td
                                              key={`${response.id}-${question.id}`}
                                              className="text-center px-3 py-2 border border-gray-200 dark:border-gray-700 min-w-[120px]"
                                            >
                                              {hasAnswer ? (
                                                <div className="flex flex-col items-center justify-center max-w-[200px] overflow-auto max-h-[150px] gap-1">
                                                  {renderAnswerDisplay(
                                                    answer,
                                                    question,
                                                  )}
                                                  {response.responseRanks?.[
                                                    question.id
                                                  ] && (
                                                      <span
                                                        className={`text-[10px] font-bold min-w-[24px] h-6 px-1.5 rounded-full flex items-center justify-center border shadow-sm ${getRankStyle(answer, darkMode)}`}
                                                      >
                                                        #
                                                        {
                                                          response.responseRanks[
                                                          question.id
                                                          ]
                                                        }
                                                      </span>
                                                    )}
                                                </div>
                                              ) : (
                                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                                  —
                                                </span>
                                              )}
                                            </td>
                                          );
                                        })}
                                      </tr>
                                    );
                                  }),
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              
  );
};
