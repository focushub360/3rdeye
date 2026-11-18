import React from "react";
import { ChevronLeft, ChevronRight, XCircle, RotateCcw } from "lucide-react";
import { getBiwPerformanceLabel } from "../utils/analyticsCalculations";

export interface BiwReviewTableProps {
  user: any;
  biwReviewTableData: any[];
  localFilterName: string;
  biwReviewPage: number;
  setBiwReviewPage: React.Dispatch<React.SetStateAction<number>>;
  biwReviewPageSize: number;
  setBiwReviewPageSize: (size: number) => void;
}

export const BiwReviewTable: React.FC<BiwReviewTableProps> = ({
  user,
  biwReviewTableData,
  localFilterName,
  biwReviewPage,
  setBiwReviewPage,
  biwReviewPageSize,
  setBiwReviewPageSize,
}) => {
    if (user?.role !== "admin" && user?.role !== "superadmin") return null;

    // ✅ STEP 1: Filter out users who have ALL zeros (Accepted, Rejected, Reworked are all 0)
    const filteredBiwData = biwReviewTableData.filter((row) => {
      const accepted = row.accepted || 0;
      const rejected = row.rejected || 0;
      const rework = row.rework || 0;
      // Only keep if at least one value is > 0
      return accepted > 0 || rejected > 0 || rework > 0;
    });

    // ✅ STEP 2: If no data after filtering, hide the entire table
    if (filteredBiwData.length === 0) return null;

    const localFilteredBiw =
      localFilterName === "All"
        ? filteredBiwData
        : filteredBiwData.filter(
          (row: any) => row.name === localFilterName,
        );

    // ✅ STEP 3: Check again after local filter
    if (localFilteredBiw.length === 0) return null;

    const totalBiwItems = localFilteredBiw.length;
    const totalBiwPages = Math.ceil(totalBiwItems / biwReviewPageSize);
    const biwStartIndex = (biwReviewPage - 1) * biwReviewPageSize;
    const biwEndIndex = biwStartIndex + biwReviewPageSize;
    const paginatedBiw = localFilteredBiw.slice(biwStartIndex, biwEndIndex);

    return (
      <div className="mt-12 border-t border-gray-100 dark:border-gray-700 pt-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-2 h-8 bg-purple-600 rounded-full shadow-sm shadow-purple-500/20"></div>
            <div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white leading-none mb-1">
                BIW Review Table
              </h3>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                Performance based on BIW review checkmarks
                {commonDateRangeLabel !== "All Time" && (
                  <span className="text-purple-500 ml-1">
                    ({commonDateRangeLabel})
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="relative bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-none overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-gray-50/80 dark:bg-gray-700/80 backdrop-blur-md sticky top-0 z-10 text-gray-500 dark:text-gray-400 uppercase text-[10px] font-black tracking-[0.15em]">
                <tr>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap">
                    User Name
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center">
                    Total Submitted
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center text-blue-600">
                    Dispatched
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center">
                    Total Reviewed
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center text-green-600">
                    Accepted
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center text-red-600">
                    Rejected
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center text-orange-600">
                    Reworked
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center">
                    Performance Score
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {paginatedBiw.map((row, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-purple-50/30 dark:hover:bg-purple-900/10 transition-colors"
                  >
                    <td className="px-4 sm:px-6 py-5 font-bold text-gray-900 dark:text-white whitespace-nowrap">
                      {row.name}
                    </td>
                    <td className="px-4 sm:px-6 py-5 font-black text-center tabular-nums">
                      {row.totalSubmitted}
                    </td>
                    <td className="px-4 sm:px-6 py-5 font-black text-center text-blue-600 dark:text-blue-400 tabular-nums">
                      {row.dispatched || 0}
                    </td>
                    <td className="px-4 sm:px-6 py-5 font-black text-center tabular-nums">
                      {row.totalReviewed}
                    </td>
                    <td className="px-4 sm:px-6 py-5 font-black text-center text-green-600 tabular-nums">
                      {row.accepted}
                    </td>
                    <td className="px-4 sm:px-6 py-5 font-black text-center text-red-600 tabular-nums">
                      {row.rejected}
                    </td>
                    <td className="px-4 sm:px-6 py-5 font-black text-center text-orange-600 tabular-nums">
                      {row.rework}
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
                          {row.performanceScore}%
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wide whitespace-nowrap ${getBiwPerformanceLabel(row.performanceScore).className}`}
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

          {totalBiwPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 bg-gray-50/50 dark:bg-gray-900/50 border-t border-gray-50 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Show
                </label>
                <select
                  value={biwReviewPageSize}
                  onChange={(e) => {
                    setBiwReviewPageSize(Number(e.target.value));
                    setBiwReviewPage(1);
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
                  {biwStartIndex + 1}-{Math.min(biwEndIndex, totalBiwItems)} of {totalBiwItems}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setBiwReviewPage((prev) => Math.max(1, prev - 1))
                  }
                  disabled={biwReviewPage === 1}
                  className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl disabled:opacity-30 transition-all hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-1">
                  {Array.from(
                    { length: totalBiwPages },
                    (_, i) => i + 1,
                  )
                    .filter(
                      (num) =>
                        totalBiwPages <= 5 ||
                        Math.abs(num - biwReviewPage) <= 1 ||
                        num === 1 ||
                        num === totalBiwPages,
                    )
                    .map((pageNum, idx, arr) => (
                      <React.Fragment key={pageNum}>
                        {idx > 0 && arr[idx - 1] !== pageNum - 1 && (
                          <span className="text-gray-300 mx-1">...</span>
                        )}
                        <button
                          onClick={() => setBiwReviewPage(pageNum)}
                          className={`min-w-[32px] h-8 text-[10px] font-black rounded-xl transition-all ${biwReviewPage === pageNum
                            ? "bg-purple-600 text-white shadow-lg shadow-purple-500/30"
                            : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50"
                            }`}
                        >
                          {pageNum}
                        </button>
                      </React.Fragment>
                    ))}
                </div>

                <button
                  onClick={() =>
                    setBiwReviewPage((prev) =>
                      Math.min(totalBiwPages, prev + 1),
                    )
                  }
                  disabled={biwReviewPage === totalBiwPages}
                  className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl disabled:opacity-30 transition-all hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
};

export default BiwReviewTable;
