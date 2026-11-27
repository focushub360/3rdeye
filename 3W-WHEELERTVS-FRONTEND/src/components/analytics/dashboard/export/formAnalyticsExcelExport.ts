import * as XLSX from "xlsx-js-style";
import type { Form, Response, Section } from "../types";
import { getResponseTimestamp, toLocalDateString } from "../utils/analyticsCalculations";
import { formatToDDMMYYYY } from "../../../../utils/answerTemplateUtils";
import { apiClient } from "../../../../api/client";

export interface ExportFormAnalyticsToExcelParams {
  form: Form | null;
  id?: string;
  isExporting: boolean;
  setIsExporting: (val: boolean) => void;
  showToast: (msg: string, type: "info" | "success" | "warning" | "error") => void;
  searchParams: URLSearchParams;
  selectedResponseIds: string[];
  responses: Response[];
  tableResponses: Response[];
  totalResponsesCount: number;
  analyticsResponsesLoading: boolean;
  dateFilter: { type: string; startDate?: string; endDate?: string };
  selectedInspectorForTrend: string;
  responsesSearchTerm: string;
  deferredSearchTerm: string;
  responseStatuses: Record<string, string>;
  tableDisplayStatuses: Record<string, string>;
  reviewedBy: Record<string, any>;
  inspectionStats: { accepted: number; rejected: number; reworked: number };
  selectedResponsesSectionIds: string[];
  isChildFollowUpForm: boolean;
  showParentMatchColumn: boolean;
  computeParentMatch: (response: any) => any;
  getResponseChassisValue: (response: any) => string;
  columnFilters: Record<string, string[]>;
  matchSingleColumnFilter: (response: any, columnId: string, allowedValues: string[]) => boolean;
  tableSort: any;
  sortResponses: (list: Response[]) => Response[];
}

export const exportFormAnalyticsToExcel = async (
  params: ExportFormAnalyticsToExcelParams
) => {
  const {
    form,
    id,
    isExporting,
    setIsExporting,
    showToast,
    searchParams,
    selectedResponseIds,
    responses,
    tableResponses,
    totalResponsesCount,
    analyticsResponsesLoading,
    dateFilter,
    selectedInspectorForTrend,
    responsesSearchTerm,
    deferredSearchTerm,
    responseStatuses,
    tableDisplayStatuses,
    reviewedBy,
    inspectionStats,
    selectedResponsesSectionIds,
    isChildFollowUpForm,
    showParentMatchColumn,
    computeParentMatch,
    getResponseChassisValue,
    columnFilters,
    matchSingleColumnFilter,
    tableSort,
    sortResponses,
  } = params;

  if (isExporting) return;
  try {
    const currentBatchId = searchParams.get("batchId");
    const isUploadOnly = searchParams.get("uploadOnly") === "true";
    setIsExporting(true);
    showToast("Preparing Excel report...", "info");

    let rowsToExport: Response[] = [];

    // 1. Check if user has explicitly selected rows via checkboxes
    if (selectedResponseIds.length > 0) {
      const idSet = new Set(selectedResponseIds);
      const pool = [...responses, ...tableResponses];
      const seen = new Set<string>();
      rowsToExport = pool.filter((r) => {
        const rId = r.id || (r as any)._id;
        if (rId && idSet.has(rId) && !seen.has(rId)) {
          seen.add(rId);
          return true;
        }
        return false;
      });
    } else {
      // 2. No explicit selection - check if full background streaming is 100% complete
      const isStreamingComplete =
        responses.length > 0 &&
        totalResponsesCount > 0 &&
        responses.length >= totalResponsesCount &&
        !analyticsResponsesLoading;

      let fullResponses: Response[] = [];

      if (isStreamingComplete) {
        fullResponses = responses;
      } else {
        showToast("Fetching complete response dataset for export...", "info");
        const exportParams: {
          status?: string;
          startDate?: string;
          endDate?: string;
          batchId?: string;
          uploadOnly?: boolean;
          forceNetwork?: boolean;
        } = {
          forceNetwork: true,
        };

        if (dateFilter.type !== "all") {
          if (dateFilter.startDate) exportParams.startDate = dateFilter.startDate;
          if (dateFilter.endDate) exportParams.endDate = dateFilter.endDate;
        }

        if (currentBatchId) {
          exportParams.batchId = currentBatchId;
        } else if (isUploadOnly) {
          exportParams.uploadOnly = true;
        }

        const fetched = await apiClient.getAllResponsesForExport(id!, exportParams);
        fullResponses = fetched || [];
      }

      // Apply filters
      rowsToExport = fullResponses;

      // Global Date Filter
      if (dateFilter.type !== "all" && (dateFilter.startDate || dateFilter.endDate)) {
        rowsToExport = rowsToExport.filter((response) => {
          const timestamp = getResponseTimestamp(response);
          if (!timestamp) return false;
          const responseDate = toLocalDateString(timestamp);

          if (dateFilter.type === "single" && dateFilter.startDate) {
            return responseDate === dateFilter.startDate;
          }
          if (dateFilter.startDate && dateFilter.endDate) {
            return (
              responseDate >= dateFilter.startDate &&
              responseDate <= dateFilter.endDate
            );
          } else if (dateFilter.startDate) {
            return responseDate >= dateFilter.startDate;
          } else if (dateFilter.endDate) {
            return responseDate <= dateFilter.endDate;
          }
          return true;
        });
      }

      // Upload/Batch Filter
      if (currentBatchId) {
        rowsToExport = rowsToExport.filter(
          (r) => (r as any).batchId === currentBatchId
        );
      } else if (isUploadOnly) {
        rowsToExport = rowsToExport.filter(
          (r) =>
            (r as any).batchId ||
            r.submittedBy === "Excel Import" ||
            (r as any).submissionMetadata?.source === "excel_import"
        );
      }
    }

    if (!rowsToExport || rowsToExport.length === 0) {
      showToast("No responses found to export.", "warning");
      setIsExporting(false);
      return;
    }

    // Global Inspector Filter
    if (selectedInspectorForTrend !== "Overall") {
      rowsToExport = rowsToExport.filter(
        (response) => response.submittedBy === selectedInspectorForTrend
      );
    }

    // Overall search term filter
    const term = (responsesSearchTerm || deferredSearchTerm).toLowerCase().trim();
    if (term !== "") {
      rowsToExport = rowsToExport.filter((response) => {
        const submitter = (response.submittedBy || response.createdBy || "").toLowerCase();
        if (submitter.includes(term)) return true;

        const status = (responseStatuses[response.id] || "").toLowerCase();
        if (status.includes(term)) return true;

        const chResolved = getResponseChassisValue(response);
        if (chResolved && chResolved !== "-" && chResolved.toLowerCase().includes(term)) return true;
        if (response.chassisNumber && String(response.chassisNumber).toLowerCase().includes(term)) return true;
        const chVal = response.answers?.chassis_number;
        if (chVal) {
          if (typeof chVal === "object") {
            if (chVal.chassisNumber && String(chVal.chassisNumber).toLowerCase().includes(term)) return true;
            if (chVal.partDescription && String(chVal.partDescription).toLowerCase().includes(term)) return true;
          } else if (String(chVal).toLowerCase().includes(term)) {
            return true;
          }
        }

        if (response.answers) {
          for (const [_key, val] of Object.entries(response.answers)) {
            if (val === null || val === undefined) continue;
            if (typeof val === "object") {
              if (JSON.stringify(val).toLowerCase().includes(term)) return true;
            } else {
              if (String(val).toLowerCase().includes(term)) return true;
            }
          }
        }
        return false;
      });
    }

    // Column filters
    const activeColFilters = Object.entries(columnFilters).filter(
      ([_, values]) => values && values.length > 0
    );
    if (activeColFilters.length > 0) {
      rowsToExport = rowsToExport.filter((response) =>
        activeColFilters.every(([columnId, allowedValues]) =>
          matchSingleColumnFilter(response, columnId, allowedValues || [])
        )
      );
    }

    // Sort
    if (tableSort) {
      rowsToExport = sortResponses(rowsToExport);
    }

    const includeParentMatchInExcel = Boolean(isChildFollowUpForm && showParentMatchColumn);

    const headerRow: any[] = [
      "Timestamp",
      "Submitted By",
      "Status",
      "Chassis Number",
      ...(includeParentMatchInExcel ? ["Parent Match", "Parent Inspection Status"] : []),
      "Review",
      "BIW Review",
      "BIW Reviewed By",
      "BIW Reviewed At",
      "BIW Remark",
      "Dispatched",
      "Dispatched At",
    ];
    const columnInfo: Array<{
      questionId: string;
      isFollowUp: boolean;
      correctAnswer?: any;
    }> = [];

    form?.sections?.forEach((section: Section) => {
      if (selectedResponsesSectionIds.includes(section.id)) {
        section.questions?.forEach((q: any) => {
          const isFollowUp = q.parentId || q.showWhen?.questionId;
          headerRow.push(q.text || "Question");
          columnInfo.push({
            questionId: q.id,
            isFollowUp: !!isFollowUp,
            correctAnswer: q.correctAnswer,
          });
        });
      }
    });

    const wsData: any[][] = [headerRow];

    rowsToExport.forEach((response: Response) => {
      let statusVal =
        tableDisplayStatuses[response.id] ||
        responseStatuses[response.id] ||
        responseStatuses[(response as any)._id];

      if (!statusVal || statusVal === "-") {
        if (response.answers) {
          let isRework = false;
          let isAccepted = false;
          let isRejected = false;
          Object.values(response.answers).forEach((ans) => {
            if (typeof ans === "object" && ans !== null && (ans as any).status) {
              const s = String((ans as any).status).toLowerCase().trim();
              if (s === "rework" || s === "reworked" || s.includes("re-rework")) {
                isRework = true;
              } else if (s === "accepted" || s === "rework completed" || s === "verified" || s === "yes" || s === "y") {
                isAccepted = true;
              } else if (s === "rejected" || s === "no" || s === "n") {
                isRejected = true;
              }
            }
          });
          if (isRework) statusVal = "Rework 1";
          else if (isAccepted) statusVal = "Direct Ok";
          else if (isRejected) statusVal = "Rejected";
        }
      }
      if (!statusVal) statusVal = response.status || "-";

      // Extract BIW Review and Quality Review details
      const biwRev = response.biwReview;
      const serverReview = (response as any).review;
      const localReview = reviewedBy[response.id];

      let reviewObj: {
        status?: string | null;
        reviewer?: string | null;
        message?: string | null;
      } | null = null;

      if (localReview && (localReview.option || localReview.status || (localReview as any).message)) {
        reviewObj = {
          status: localReview.option || localReview.status || null,
          reviewer: (localReview.reviewer as any)?.name || localReview.reviewer || (localReview as any).name || "Reviewer",
          message: (localReview as any).message || null,
        };
      } else if (serverReview && (serverReview.status || serverReview.reviewOption || serverReview.message)) {
        reviewObj = {
          status: serverReview.status || serverReview.reviewOption || null,
          reviewer: serverReview.reviewer || serverReview.reviewerName || serverReview.name || "Reviewer",
          message: serverReview.message || serverReview.remark || serverReview.reason || null,
        };
      }

      if (biwRev && biwRev.status) {
        reviewObj = {
          status: biwRev.status,
          reviewer: biwRev.reviewedByName || reviewObj?.reviewer || "Reviewer",
          message: (reviewObj?.message && !reviewObj.message.startsWith("[BIW Review]"))
            ? reviewObj.message
            : (biwRev.remark || null),
        };
      }

      let reviewVal = "No review yet";
      if (reviewObj && reviewObj.status) {
        reviewVal = reviewObj.status;
        if (reviewObj.reviewer && reviewObj.reviewer !== "Reviewer") {
          reviewVal += ` by ${reviewObj.reviewer}`;
        }
        if (reviewObj.message && !reviewObj.message.startsWith("[BIW Review]")) {
          reviewVal += ` (${reviewObj.message})`;
        }
      }

      const biwStatusVal = biwRev?.status || "-";
      const biwReviewedByVal = biwRev?.reviewedByName || "-";
      const biwReviewedAtVal = biwRev?.reviewedAt
        ? formatToDDMMYYYY(biwRev.reviewedAt, true)
        : "-";
      const biwRemarkVal = biwRev?.remark || "-";

      let parentMatchText = "-";
      let parentMatchStatusText = "-";
      if (includeParentMatchInExcel) {
        const pm = computeParentMatch(response);
        parentMatchText = pm.badgeText || "-";
        const fs = response?.followUpStatus || (response as any)?.parentMatch;
        const directParentStatus = fs?.parentStatus && fs.parentStatus !== "pending"
          ? fs.parentStatus
          : (pm.subText?.startsWith("Status: ") ? pm.subText.replace("Status: ", "") : (pm.status === "matched" ? "Direct Ok" : "-"));
        parentMatchStatusText = directParentStatus || "-";
      }

      const rowData: any[] = [
        getResponseTimestamp(response)
          ? formatToDDMMYYYY(getResponseTimestamp(response)!)
          : "-",
        response.submittedBy || response.createdBy || "Anonymous",
        statusVal,
        getResponseChassisValue(response),
        ...(includeParentMatchInExcel ? [parentMatchText, parentMatchStatusText] : []),
        reviewVal,
        biwStatusVal,
        biwReviewedByVal,
        biwReviewedAtVal,
        biwRemarkVal,
        response.isDispatched ? "Yes" : "No",
        response.dispatchedAt
          ? formatToDDMMYYYY(response.dispatchedAt, true)
          : "-",
      ];

      columnInfo.forEach(({ questionId }) => {
        const answer = response.answers?.[questionId];
        let answerStr = "-";
        if (answer !== undefined && answer !== null) {
          if (typeof answer === "object") {
            if (answer.status) {
              answerStr = answer.status;
            } else {
              answerStr = JSON.stringify(answer);
            }
          } else {
            answerStr = String(answer);
          }
        }
        rowData.push(answerStr);
      });

      wsData.push(rowData);
    });

    // Add Overall Inspection Statistics Summary Rows
    const statsHeaderRow: any[] = [
      "Overall Inspection Statistics",
      "",
      "",
      "",
    ];
    const statsDataRow: any[] = [
      `Total Accepted: ${inspectionStats.accepted}`,
      `Total Rejected: ${inspectionStats.rejected}`,
      `Total Reworked: ${inspectionStats.reworked}`,
      ``,
    ];

    wsData.push([]); // Empty spacing row
    const statsHeaderIdx = wsData.length;
    wsData.push(statsHeaderRow);
    const statsDataIdx = wsData.length;
    wsData.push(statsDataRow);

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    const headerFill = { fgColor: { rgb: "FF4F46E5" } };
    const headerFont = { color: { rgb: "FFFFFFFF" }, bold: true };

    // Style Header Row
    for (let i = 0; i < headerRow.length; i++) {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
      if (ws[cellRef]) {
        ws[cellRef].s = {
          fill: headerFill,
          font: headerFont,
          alignment: {
            horizontal: "center",
            vertical: "center",
            wrapText: true,
          },
          border: {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          },
        };
      }
    }

    // Style response rows
    const lastResponseRowIdx = rowsToExport.length + 1;
    for (let rowIdx = 1; rowIdx < lastResponseRowIdx; rowIdx++) {
      const response = rowsToExport[rowIdx - 1];

      // Style Timestamp column (0)
      const timeCellRef = XLSX.utils.encode_cell({ r: rowIdx, c: 0 });
      if (ws[timeCellRef]) {
        ws[timeCellRef].s = {
          fill: { fgColor: { rgb: "FFF9FAFB" } },
          font: { bold: false },
          alignment: { horizontal: "center", vertical: "center" },
          border: {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          },
        };
      }

      // Style Submitted By column (1)
      const submittedByCellRef = XLSX.utils.encode_cell({ r: rowIdx, c: 1 });
      if (ws[submittedByCellRef]) {
        ws[submittedByCellRef].s = {
          fill: { fgColor: { rgb: "FFF9FAFB" } },
          font: { bold: false },
          alignment: { horizontal: "left", vertical: "center" },
          border: {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          },
        };
      }

      // Style Status column (2)
      const statusCellRef = XLSX.utils.encode_cell({ r: rowIdx, c: 2 });
      const currentStatus =
        tableDisplayStatuses[response.id] ||
        responseStatuses[response.id] ||
        response.status ||
        "-";
      let statusBgColor = "FFF9FAFB"; // Default

      if (
        currentStatus === "Direct Ok" ||
        currentStatus === "Rework Accepted" ||
        currentStatus === "Accepted"
      ) {
        statusBgColor = "FFDCFCE7"; // green-100
      } else if (currentStatus.includes("Rework")) {
        statusBgColor = "FFFEF3C7"; // amber-100
      } else if (currentStatus === "Rejected") {
        statusBgColor = "FFFEE2E2"; // red-100
      }

      if (ws[statusCellRef]) {
        ws[statusCellRef].s = {
          fill: { fgColor: { rgb: statusBgColor } },
          font: { bold: true },
          alignment: { horizontal: "center", vertical: "center" },
          border: {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          },
        };
      }

      // Style Chassis Number column (3)
      const chassisCellRef = XLSX.utils.encode_cell({ r: rowIdx, c: 3 });
      if (ws[chassisCellRef]) {
        ws[chassisCellRef].s = {
          fill: { fgColor: { rgb: "FFF9FAFB" } },
          font: { bold: false },
          alignment: { horizontal: "left", vertical: "center" },
          border: {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          },
        };
      }

      // Style Review column (4)
      const reviewCellRef = XLSX.utils.encode_cell({ r: rowIdx, c: 4 });
      if (ws[reviewCellRef]) {
        ws[reviewCellRef].s = {
          fill: { fgColor: { rgb: "FFF9FAFB" } },
          font: { bold: false },
          alignment: { horizontal: "left", vertical: "center", wrapText: true },
          border: {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          },
        };
      }

      // Style BIW Review column (5)
      const biwStatus = response.biwReview?.status || "-";
      const biwCellRef = XLSX.utils.encode_cell({ r: rowIdx, c: 5 });
      let biwBgColor = "FFF9FAFB";
      if (biwStatus === "Accepted") biwBgColor = "FFDCFCE7";
      else if (biwStatus === "Reworked" || biwStatus.includes("Rework")) biwBgColor = "FFFEF3C7";
      else if (biwStatus === "Rejected") biwBgColor = "FFFEE2E2";

      if (ws[biwCellRef]) {
        ws[biwCellRef].s = {
          fill: { fgColor: { rgb: biwBgColor } },
          font: { bold: biwStatus !== "-" },
          alignment: { horizontal: "center", vertical: "center" },
          border: {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          },
        };
      }

      // Style Question columns: starting after 11 fixed columns (indices 0..10)
      const fixedColsCount = 11;
      for (let colIdx = 0; colIdx < columnInfo.length; colIdx++) {
        const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx + fixedColsCount });
        const info = columnInfo[colIdx];
        const bgColor = info.isFollowUp ? "FFE9D5FF" : "FFFFFFFF";

        if (ws[cellRef]) {
          ws[cellRef].s = {
            fill: { fgColor: { rgb: bgColor } },
            alignment: { vertical: "center", wrapText: true },
            border: {
              top: { style: "thin" },
              left: { style: "thin" },
              bottom: { style: "thin" },
              right: { style: "thin" },
            },
          };
        }
      }
    }

    // Style Stats Header Row
    for (let i = 0; i < 4; i++) {
      const cellRef = XLSX.utils.encode_cell({ r: statsHeaderIdx, c: i });
      if (ws[cellRef]) {
        ws[cellRef].s = {
          fill: { fgColor: { rgb: "FF4F46E5" } },
          font: { color: { rgb: "FFFFFFFF" }, bold: true },
          alignment: { horizontal: "center", vertical: "center" },
          border: {
            top: { style: "medium" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          },
        };
      }
    }

    // Style Stats Data Row
    for (let i = 0; i < 4; i++) {
      const cellRef = XLSX.utils.encode_cell({ r: statsDataIdx, c: i });
      if (ws[cellRef]) {
        ws[cellRef].s = {
          fill: { fgColor: { rgb: "FFE0E7FF" } },
          font: { bold: true, color: { rgb: "FF3730A3" } },
          alignment: { horizontal: "center", vertical: "center" },
          border: {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "medium" },
            right: { style: "thin" },
          },
        };
      }
    }

    ws["!cols"] = [
      { wch: 22 }, // Timestamp
      { wch: 25 }, // Submitted By
      { wch: 15 }, // Status
      { wch: 18 }, // Chassis Number
      { wch: 30 }, // Review
      { wch: 16 }, // BIW Review
      { wch: 22 }, // BIW Reviewed By
      { wch: 22 }, // BIW Reviewed At
      { wch: 25 }, // BIW Remark
      { wch: 14 }, // Dispatched
      { wch: 22 }, // Dispatched At
      ...columnInfo.map(() => ({ wch: 35 })),
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Responses");
    XLSX.writeFile(
      wb,
      `${form?.title || "responses"}-${new Date().toLocaleDateString("en-CA")}.xlsx`,
    );
    showToast(`Exported ${rowsToExport.length} responses to Excel successfully!`, "success");
  } catch (error) {
    console.error("Error exporting to Excel:", error);
    showToast("Failed to export to Excel. Please try again.", "error");
  } finally {
    setIsExporting(false);
  }
};
