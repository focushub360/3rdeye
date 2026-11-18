import React from "react";
import { ChevronDown, ChevronRight, Filter, X } from "lucide-react";

export interface SummaryTableProps {
  summaryLoading: boolean;
  groupedInspectorSummary: any[];
  expandedInspectorForms: Set<string>;
  toggleFormExpansion: (title: string) => void;
  localFilterName: string;
  setLocalFilterName: (name: string) => void;
  localFilterShift: string;
  setLocalFilterShift: (shift: string) => void;
  localFilterDate: string;
  setLocalFilterDate: (date: string) => void;
  dateFilter: { startDate?: string; endDate?: string };
  summaryStatuses: any;
}

export const SummaryTable: React.FC<SummaryTableProps> = ({
  summaryLoading,
  groupedInspectorSummary,
  expandedInspectorForms,
  toggleFormExpansion,
  localFilterName,
  setLocalFilterName,
  localFilterShift,
  setLocalFilterShift,
  localFilterDate,
  setLocalFilterDate,
  dateFilter,
  summaryStatuses,
}) => {
    if (summaryLoading) {
      return (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-500 text-sm">Loading summary...</p>
        </div>
      );
    }

    if (groupedInspectorSummary.length === 0) {
      return null;
    }

    // Derive unique shifts and inspectors for local filter dropdowns
    const allSummaryInspectors = Array.from(
      new Set(
        groupedInspectorSummary
          .flatMap((g: any) => g.subItems.map((i: any) => i.qcInspector))
          .filter(Boolean),
      ),
    ) as string[];
    const allSummaryShifts = Array.from(
      new Set(
        groupedInspectorSummary
          .flatMap((g: any) => g.subItems.map((i: any) => i.shift || "N/A"))
          .filter(Boolean),
      ),
    ) as string[];

    // Apply local filters to groupedInspectorSummary
    const localFilteredSummary = groupedInspectorSummary
      .map((group: any) => {
        const filteredSubItems = group.subItems.filter((row: any) => {
          const nameMatch =
            localFilterName === "All" || row.qcInspector === localFilterName;
          const shiftMatch =
            localFilterShift === "All" ||
            (row.shift || "N/A") === localFilterShift;
          const dateMatch =
            !localFilterDate ||
            (row.date &&
              new Date(row.date).toISOString().slice(0, 10) ===
              localFilterDate);
          return nameMatch && shiftMatch && dateMatch;
        });
        if (filteredSubItems.length === 0) return null;
        // Recalculate totals for filtered subItems
        const totalInspection = filteredSubItems.reduce(
          (sum: number, r: any) => sum + (r.totalInspection || 0),
          0,
        );
        const statusCounts: Record<string, number> = {};
        filteredSubItems.forEach((r: any) => {
          Object.entries(r.statusCounts || {}).forEach(([k, v]) => {
            statusCounts[k] = (statusCounts[k] || 0) + (v as number);
          });
        });
        return {
          ...group,
          subItems: filteredSubItems,
          totalInspection,
          statusCounts,
        };
      })
      .filter(Boolean);

    return (
      <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-4 flex-1">
            <div className="w-2 h-8 bg-blue-600 rounded-full shadow-sm shadow-blue-500/20"></div>
            <div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white leading-none mb-1">
                Inspection Summary
              </h3>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                Real-time inspection data
                {dateFilter.startDate && dateFilter.endDate
                  ? ` (${new Date(dateFilter.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${new Date(dateFilter.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })})`
                  : dateFilter.startDate
                    ? ` (From ${new Date(dateFilter.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })})`
                    : dateFilter.endDate
                      ? ` (Until ${new Date(dateFilter.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })})`
                      : ""}
              </p>
            </div>
          </div>
          {/* Local filters for Inspection Summary & Performance Table */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={localFilterName}
              onChange={(e) => setLocalFilterName(e.target.value)}
              className="text-[10px] font-bold bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm"
            >
              <option value="All">All Inspectors</option>
              {allSummaryInspectors.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <select
              value={localFilterShift}
              onChange={(e) => setLocalFilterShift(e.target.value)}
              className="text-[10px] font-bold bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm"
            >
              <option value="All">All Shifts</option>
              {allSummaryShifts.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={localFilterDate}
              onChange={(e) => setLocalFilterDate(e.target.value)}
              className="text-[10px] font-bold bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm"
            />
            {(localFilterName !== "All" ||
              localFilterShift !== "All" ||
              localFilterDate) && (
                <button
                  onClick={() => {
                    setLocalFilterName("All");
                    setLocalFilterShift("All");
                    setLocalFilterDate("");
                  }}
                  className="text-[10px] font-bold text-red-500 hover:text-red-700 px-2 py-1.5 rounded-lg border border-red-200 hover:border-red-400 bg-red-50 hover:bg-red-100 transition-colors"
                >
                  Clear
                </button>
              )}
          </div>
        </div>

        {(() => {
          // Flatten all subItems across all groups, then re-group by inspector name
          const allSubItems = localFilteredSummary.flatMap(
            (g: any) => g.subItems,
          );
          const inspectorMap = new Map<string, any[]>();
          allSubItems.forEach((row: any) => {
            const key = row.qcInspector || "Unknown";
            if (!inspectorMap.has(key)) inspectorMap.set(key, []);
            inspectorMap.get(key)!.push(row);
          });

          const inspectorGroups = Array.from(inspectorMap.entries()).map(
            ([inspector, rows]) => {
              const totalInspection = rows.reduce(
                (s: number, r: any) => s + (r.totalInspection || 0),
                0,
              );
              const statusCounts: Record<string, number> = {};
              rows.forEach((r: any) => {
                Object.entries(r.statusCounts || {}).forEach(([k, v]) => {
                  statusCounts[k] = (statusCounts[k] || 0) + (v as number);
                });
              });
              // Sort dates descending
              const sortedRows = [...rows].sort(
                (a: any, b: any) =>
                  new Date(b.date).getTime() - new Date(a.date).getTime(),
              );
              return {
                inspector,
                rows: sortedRows,
                totalInspection,
                statusCounts,
              };
            },
          );

          return (
            <div className="relative bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-none overflow-hidden">
              <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-gray-50/80 dark:bg-gray-700/80 backdrop-blur-md sticky top-0 z-10 text-gray-500 dark:text-gray-400 uppercase text-[10px] font-black tracking-[0.15em]">
                    <tr>
                      <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap">
                        QC Inspector
                      </th>
                      <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap">
                        Dates Active
                      </th>
                      <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center">
                        Total
                      </th>
                      {summaryStatuses.map((status) => (
                        <th
                          key={status}
                          className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center"
                        >
                          {status}
                        </th>
                      ))}
                      <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center">
                        History
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                    {inspectorGroups.map((ig, igIdx) => {
                      const expandKey = `inspector-${ig.inspector}`;
                      const isExpanded = expandedInspectorForms.has(expandKey);
                      const dateRange =
                        ig.rows.length > 1
                          ? `${new Date(ig.rows[ig.rows.length - 1].date).toLocaleDateString()} – ${new Date(ig.rows[0].date).toLocaleDateString()}`
                          : new Date(ig.rows[0].date).toLocaleDateString();

                      return (
                        <React.Fragment key={igIdx}>
                          {/* Inspector summary row */}
                          <tr
                            className={`transition-colors cursor-pointer ${isExpanded ? "bg-blue-50/50 dark:bg-blue-900/20" : "hover:bg-blue-50/30 dark:hover:bg-blue-900/10"}`}
                            onClick={() => toggleFormExpansion(expandKey)}
                          >
                            {/* Inspector name */}
                            <td className="px-4 sm:px-6 py-5 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-700 dark:text-blue-300 font-black text-[11px] shrink-0">
                                  {ig.inspector
                                    ?.split(" ")
                                    .map((n: string) => n[0])
                                    .join("")}
                                </div>
                                <span className="font-bold text-gray-800 dark:text-white text-sm">
                                  {ig.inspector}
                                </span>
                              </div>
                            </td>
                            {/* Date range summary */}
                            <td className="px-4 sm:px-6 py-5 whitespace-nowrap">
                              <div className="flex flex-col gap-1">
                                <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                                  {dateRange}
                                </span>
                                <span className="text-[10px] font-bold text-blue-500 dark:text-blue-400">
                                  {ig.rows.length} day
                                  {ig.rows.length > 1 ? "s" : ""}
                                </span>
                              </div>
                            </td>
                            {/* Total */}
                            <td className="px-4 sm:px-6 py-5 text-center">
                              <span className="text-base font-black text-gray-900 dark:text-white tabular-nums">
                                {ig.totalInspection}
                              </span>
                            </td>
                            {/* Status counts */}
                            {summaryStatuses.map((status) => {
                              const count = ig.statusCounts?.[status] || 0;
                              const isZero = count === 0;
                              return (
                                <td
                                  key={status}
                                  className={`px-4 sm:px-6 py-5 text-center font-black tabular-nums transition-opacity ${isZero
                                    ? "opacity-20 text-gray-400"
                                    : status === "Direct Ok" ||
                                      status === "Rework Accepted"
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : status.startsWith("Rework")
                                        ? "text-amber-600 dark:text-amber-400"
                                        : status === "Rejected"
                                          ? "text-rose-600 dark:text-rose-400"
                                          : "text-blue-600 dark:text-blue-400"
                                    }`}
                                >
                                  {count}
                                </td>
                              );
                            })}
                            {/* Expand toggle */}
                            <td className="px-4 sm:px-6 py-5 text-center">
                              <button className="p-2 hover:bg-white/50 dark:hover:bg-white/10 rounded-full transition-colors">
                                {isExpanded ? (
                                  <ChevronUp className="w-5 h-5" />
                                ) : (
                                  <ChevronDown className="w-5 h-5" />
                                )}
                              </button>
                            </td>
                          </tr>

                          {/* Date history rows */}
                          {isExpanded &&
                            ig.rows.map((row: any, rowIdx: number) => (
                              <tr
                                key={`${igIdx}-${rowIdx}`}
                                className="bg-gray-50/40 dark:bg-gray-900/20 border-l-4 border-l-blue-400"
                              >
                                <td className="px-4 sm:px-6 py-3 pl-16 whitespace-nowrap">
                                  <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                                    —
                                  </span>
                                </td>
                                <td className="px-4 sm:px-6 py-3 whitespace-nowrap">
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-bold tabular-nums">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(row.date).toLocaleDateString(
                                      "en-US",
                                      {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                      },
                                    )}
                                  </span>
                                </td>
                                <td className="px-4 sm:px-6 py-3 text-center">
                                  <span className="text-sm font-bold text-gray-600 dark:text-gray-300 tabular-nums">
                                    {row.totalInspection}
                                  </span>
                                </td>
                                {summaryStatuses.map((status) => {
                                  const count = row.statusCounts?.[status] || 0;
                                  const isZero = count === 0;
                                  return (
                                    <td
                                      key={status}
                                      className={`px-4 sm:px-6 py-3 text-center font-bold text-xs tabular-nums ${isZero ? "opacity-10 text-gray-400" : "opacity-70"}`}
                                    >
                                      {count}
                                    </td>
                                  );
                                })}
                                <td></td>
                              </tr>
                            ))}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

export default SummaryTable;
