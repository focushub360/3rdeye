import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { getBiwPerformanceLabel } from "../utils/analyticsCalculations";
import PerformanceGuideModal from "../../PerformanceGuideModal";

export interface PerformanceTableProps {
  user: any;
  performanceTableLoading: boolean;
  performanceTableData: any[];
  localFilterName: string;
  performancePage: number;
  setPerformancePage: React.Dispatch<React.SetStateAction<number>>;
  performancePageSize: number;
  setPerformancePageSize?: (size: number) => void;
  performanceHasMore?: boolean;
}

export const PerformanceTable: React.FC<PerformanceTableProps> = ({
  user,
  performanceTableLoading,
  performanceTableData,
  localFilterName,
  performancePage,
  setPerformancePage,
  performancePageSize,
  setPerformancePageSize,
  performanceHasMore,
}) => {
    const [showPerformanceGuide, setShowPerformanceGuide] = useState(false);
    if (user?.role !== "admin" && user?.role !== "superadmin") return null;

    if (performanceTableLoading) {
      return (
        <div className="mt-12 text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-500 text-sm">Loading performance data...</p>
        </div>
      );
    }

    if (performanceTableData.length === 0) return null;

    // Apply local name filter (still client-side since it's just a filter
    // over the current page, not a re-page)
    const localFilteredPerformance =
      localFilterName === "All"
        ? performanceTableData
        : performanceTableData.filter(
          (row: any) => row.name === localFilterName,
        );

    // Pagination is now server-side: `performanceTableData` already IS the
    // current page (the backend applies skip/limit), so we just render it
    // directly instead of re-slicing an in-memory array. `performanceHasMore`
    // (from the API response) tells us whether a "Next" page exists.
    const paginatedPerformance = localFilteredPerformance;
    const startIndex = (performancePage - 1) * performancePageSize;
    const endIndex = startIndex + paginatedPerformance.length;

    return (
      <div className="mt-12 border-t border-gray-100 dark:border-gray-700 pt-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-2 h-8 bg-purple-600 rounded-full shadow-sm shadow-purple-500/20"></div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-black text-gray-900 dark:text-white leading-none mb-1">
                Performance Table
              </h3>
              <button
                type="button"
                onClick={() => setShowPerformanceGuide(true)}
                className="inline-flex items-center justify-center p-1 rounded-full text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/50 dark:text-purple-300 dark:hover:bg-purple-900/60 transition-colors shadow-2xs cursor-pointer"
                title="How does the Performance Table work?"
                aria-label="How does the Performance Table work?"
              >
                <Info className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Form-specific inspector performance
            </p>
          </div>
        </div>

        <div className="relative bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-none overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-gray-50/80 dark:bg-gray-700/80 backdrop-blur-md sticky top-0 z-10 text-gray-500 dark:text-gray-400 uppercase text-[10px] font-black tracking-[0.15em]">
                <tr>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap sticky left-0 z-20 bg-gray-50/80 dark:bg-gray-700/80">
                    User Name
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center text-green-600">
                    Direct Ok
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center text-blue-600">
                    Rework QC Completed
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center text-yellow-600">
                    Rework QC Pending
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center text-red-600">
                    Rejected
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center text-orange-600">
                    Dispatch Pending
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center text-purple-600">
                    Dispatched
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center">
                    Total Submitted
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center">
                    Total Reviewed
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center">
                    Review Pending
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center text-emerald-600">
                    Accepted
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center text-rose-600">
                    Rejected
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center text-amber-600">
                    Reworked
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center">
                    <div className="inline-flex items-center gap-1.5 justify-center">
                      <span>Performance Score</span>
                      <button
                        type="button"
                        onClick={() => setShowPerformanceGuide(true)}
                        className="p-1 rounded-full text-purple-600 hover:text-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors cursor-pointer"
                        title="View Performance Score Formula & Calculation Guide"
                        aria-label="View Performance Score Formula & Calculation Guide"
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {paginatedPerformance.map((row, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-purple-50/30 dark:hover:bg-purple-900/10 transition-colors"
                  >
                    <td className="px-4 sm:px-6 py-5 font-bold text-gray-900 dark:text-white whitespace-nowrap sticky left-0 z-10 bg-white dark:bg-gray-800">
                      {row.name}
                    </td>
                    <td className="px-4 sm:px-6 py-5 font-black text-center text-green-600 tabular-nums">
                      {row.directOk || 0}
                    </td>
                    <td className="px-4 sm:px-6 py-5 font-black text-center text-blue-600 tabular-nums">
                      {row.reworkQcCompleted || 0}
                    </td>
                    <td className="px-4 sm:px-6 py-5 font-black text-center text-yellow-600 tabular-nums">
                      {row.reworkQcPending || 0}
                    </td>
                    <td className="px-4 sm:px-6 py-5 font-black text-center text-red-600 tabular-nums">
                      {row.rejected || 0}
                    </td>
                    <td className="px-4 sm:px-6 py-5 font-black text-center text-orange-600 tabular-nums">
                      {row.dispatchPending || 0}
                    </td>
                    <td className="px-4 sm:px-6 py-5 font-black text-center text-purple-600 tabular-nums">
                      {row.dispatched || 0}
                    </td>
                    <td className="px-4 sm:px-6 py-5 font-black text-center tabular-nums">
                      {row.totalSubmitted || 0}
                    </td>
                    <td className="px-4 sm:px-6 py-5 font-black text-center tabular-nums">
                      {row.totalReviewed || 0}
                    </td>
                    <td className="px-4 sm:px-6 py-5 font-black text-center text-gray-500 tabular-nums">
                      {row.reviewPending || 0}
                    </td>
                    <td className="px-4 sm:px-6 py-5 font-black text-center text-emerald-600 tabular-nums">
                      {row.accepted || 0}
                    </td>
                    <td className="px-4 sm:px-6 py-5 font-black text-center text-rose-600 tabular-nums">
                      {row.rejectedReview || 0}
                    </td>
                    <td className="px-4 sm:px-6 py-5 font-black text-center text-amber-600 tabular-nums">
                      {row.reworked || 0}
                    </td>
                    <td className="px-4 sm:px-6 py-5 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <span
                          className={`px-3 py-1 rounded-full text-[10px] font-black tabular-nums shadow-sm ${row.performanceScore >= 80
                            ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                            : row.performanceScore >= 50
                              ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400"
                              : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                            }`}
                        >
                          {row.performanceScore || 0}%
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wide whitespace-nowrap ${getBiwPerformanceLabel(row.performanceScore).className
                            }`}
                        >
                          {getBiwPerformanceLabel(row.performanceScore).label}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination controls - server-driven (page/limit sent to the
              API, "Next" enabled by `hasMore` from the response since the
              backend no longer loads the full dataset to know a total). */}
          {(performancePage > 1 || performanceHasMore) && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 bg-gray-50/50 dark:bg-gray-900/50 border-t border-gray-50 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Show
                </label>
                <select
                  value={performancePageSize}
                  onChange={(e) => {
                    if (setPerformancePageSize) setPerformancePageSize(Number(e.target.value));
                    setPerformancePage(1);
                  }}
                  className="px-3 py-1.5 text-xs font-bold border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all shadow-sm"
                >
                  {[5, 10, 20, 50].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  {startIndex + 1}-{endIndex} · page {performancePage}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setPerformancePage((prev) => Math.max(1, prev - 1))
                  }
                  disabled={performancePage === 1 || performanceTableLoading}
                  className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl disabled:opacity-30 transition-all hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="min-w-[32px] h-8 flex items-center justify-center text-[10px] font-black rounded-xl bg-purple-600 text-white shadow-lg shadow-purple-500/30 px-2">
                  {performancePage}
                </span>

                <button
                  onClick={() => setPerformancePage((prev) => prev + 1)}
                  disabled={!performanceHasMore || performanceTableLoading}
                  className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl disabled:opacity-30 transition-all hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {showPerformanceGuide && (
          <PerformanceGuideModal
            isOpen={showPerformanceGuide}
            onClose={() => setShowPerformanceGuide(false)}
          />
        )}
      </div>
    );
  };

export default PerformanceTable;
