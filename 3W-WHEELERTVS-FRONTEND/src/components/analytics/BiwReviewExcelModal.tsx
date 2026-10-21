import React, { useState, useMemo, useRef } from "react";
import {
  X,
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Mail,
  Copy,
  Check,
  Loader2,
  ExternalLink,
  ChevronRight,
  Sparkles
} from "lucide-react";
import {
  downloadBiwReviewTemplate,
  parseBiwReviewWorkbook,
  generateBiwEmailSummaryHtml,
  type BiwExcelRow
} from "../../utils/biwReviewExcelUtils";
import { apiClient } from "../../api/client";
import type { Form } from "../../types/forms";

interface BiwReviewExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  formId: string;
  form?: Form | null;
  formTitle: string;
  currentChassisNumbers?: string[];
  onImportSuccess?: () => void;
}

export const BiwReviewExcelModal: React.FC<BiwReviewExcelModalProps> = ({
  isOpen,
  onClose,
  formId,
  form,
  formTitle,
  currentChassisNumbers = [],
  onImportSuccess
}) => {
  const [activeTab, setActiveTab] = useState<"import" | "template" | "email">("import");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<BiwExcelRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    total: number;
    updatedCount: number;
    unmatchedCount: number;
    skippedCount: number;
    errors: Array<{ row: number; chassis: string; error: string }>;
  } | null>(null);

  const [prefillChassis, setPrefillChassis] = useState(true);
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Available unique chassis numbers
  const uniqueChassisList = useMemo(() => {
    return Array.from(new Set(currentChassisNumbers.map((c) => String(c).trim()).filter(Boolean)));
  }, [currentChassisNumbers]);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setIsParsing(true);
    setImportResult(null);

    try {
      const rows = await parseBiwReviewWorkbook(file);
      // Mark whether chassis matches current form data
      const chassisSet = new Set(uniqueChassisList.map((c) => c.toUpperCase()));
      const annotated = rows.map((r) => ({
        ...r,
        matched: chassisSet.has(r.chassisNumber.toUpperCase())
      }));
      setParsedRows(annotated);
    } catch (err: any) {
      alert(`Error reading Excel file: ${err.message || String(err)}`);
      setParsedRows([]);
    } finally {
      setIsParsing(false);
    }
  };

  const handleDownloadTemplate = () => {
    downloadBiwReviewTemplate({
      form,
      formTitle,
      chassisNumbers: prefillChassis ? uniqueChassisList : []
    });
  };

  const handleExecuteImport = async () => {
    if (parsedRows.length === 0) return;

    setIsImporting(true);
    setImportResult(null);

    try {
      const res = await apiClient.importBiwReviews(
        formId,
        parsedRows,
        selectedFile?.name || "BIW_Review_Import.xlsx"
      );

      if (res && res.data) {
        setImportResult(res.data);
        if (onImportSuccess && res.data.updatedCount > 0) {
          onImportSuccess();
        }
      } else {
        throw new Error((res as any)?.message || "Import failed");
      }
    } catch (err: any) {
      alert(`Failed to import reviews: ${err.message || String(err)}`);
    } finally {
      setIsImporting(false);
    }
  };

  // Email content
  const emailDraft = generateBiwEmailSummaryHtml({
    formTitle,
    rows: parsedRows.length > 0 ? parsedRows : uniqueChassisList.map((c) => ({ chassisNumber: c }))
  });

  const handleCopyEmailHtml = () => {
    navigator.clipboard.writeText(emailDraft.html);
    setCopiedHtml(true);
    setTimeout(() => setCopiedHtml(false), 2000);
  };

  const handleCopyEmailText = () => {
    navigator.clipboard.writeText(emailDraft.text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md border border-white/20">
              <FileSpreadsheet className="w-6 h-6 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold tracking-tight">BIW Review Excel Suite</h3>
                <span className="px-2 py-0.5 text-xs font-semibold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 rounded-full">
                  Automated Dropdowns
                </span>
              </div>
              <p className="text-xs text-indigo-200/80">
                Bulk upload, dropdown validations, defect reason routing & email templates for {formTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/50 px-6 gap-2">
          <button
            onClick={() => setActiveTab("import")}
            className={`py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === "import"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <Upload className="w-4 h-4" />
            Import Filled Excel
            {parsedRows.length > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 rounded-full">
                {parsedRows.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("template")}
            className={`py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === "template"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <Download className="w-4 h-4" />
            Download Review Template (.xlsx)
          </button>
          <button
            onClick={() => setActiveTab("email")}
            className={`py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === "email"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <Mail className="w-4 h-4" />
            Email Report Template
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: IMPORT */}
          {activeTab === "import" && (
            <div className="space-y-6">
              {/* File Drop Area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer border-2 border-dashed border-indigo-200 dark:border-indigo-800 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-2xl p-6 text-center bg-indigo-50/30 dark:bg-indigo-950/20 hover:bg-indigo-50/70 transition-all group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx, .xls"
                  className="hidden"
                />
                <div className="w-12 h-12 mx-auto rounded-full bg-indigo-100 dark:bg-indigo-900/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                  {selectedFile ? selectedFile.name : "Click to select or drag & drop filled Excel workbook"}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {selectedFile
                    ? `${(selectedFile.size / 1024).toFixed(1)} KB — Ready to parse & update`
                    : "Supports .xlsx with BIW Feedback, Defect Checkpoints, TVS Reviews & Remarks"}
                </p>
              </div>

              {/* Import Results Banner */}
              {importResult && (
                <div
                  className={`p-4 rounded-xl border ${
                    importResult.updatedCount > 0
                      ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-900 dark:text-green-200"
                      : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2 font-bold text-sm">
                    {importResult.updatedCount > 0 ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600" />
                    )}
                    Import Completed: {importResult.updatedCount} chassis reviews updated successfully
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs font-semibold">
                    <span>Total Rows: {importResult.total}</span>
                    <span className="text-green-600">Updated: {importResult.updatedCount}</span>
                    {importResult.unmatchedCount > 0 && (
                      <span className="text-amber-600">Unmatched Chassis: {importResult.unmatchedCount}</span>
                    )}
                    {importResult.skippedCount > 0 && (
                      <span className="text-gray-500">Skipped: {importResult.skippedCount}</span>
                    )}
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-red-200 dark:border-red-800 text-xs">
                      <div className="font-semibold text-red-700 dark:text-red-300 mb-1">Unmatched Items:</div>
                      <ul className="list-disc list-inside space-y-0.5 text-red-600 dark:text-red-400">
                        {importResult.errors.slice(0, 5).map((err, i) => (
                          <li key={i}>
                            Row {err.row}: Chassis <strong>{err.chassis}</strong> — {err.error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Loading State */}
              {isParsing && (
                <div className="flex items-center justify-center p-8 text-gray-500 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                  <span className="text-sm">Reading and extracting Excel rows...</span>
                </div>
              )}

              {/* Parsed Rows Preview Table */}
              {!isParsing && parsedRows.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                        Extracted Review Rows ({parsedRows.length})
                      </h4>
                      <span className="text-xs text-gray-500">
                        ({parsedRows.filter((r) => r.matched).length} matched with form responses)
                      </span>
                    </div>
                    <button
                      onClick={handleExecuteImport}
                      disabled={isImporting}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all flex items-center gap-2"
                    >
                      {isImporting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Importing Reviews...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          Apply & Import {parsedRows.length} Reviews
                        </>
                      )}
                    </button>
                  </div>

                  <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold sticky top-0 border-b border-gray-200 dark:border-gray-700">
                        <tr>
                          <th className="p-2.5">Row</th>
                          <th className="p-2.5">Chassis Number</th>
                          <th className="p-2.5">BIW Feedback</th>
                          <th className="p-2.5">BIW Defect / Reason</th>
                          <th className="p-2.5">Remark</th>
                          <th className="p-2.5">TVS Feedback</th>
                          <th className="p-2.5">File Upload</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {parsedRows.map((r, i) => {
                          const biwStatus = r.biwFeedback?.toLowerCase() || "";
                          const isAccept = biwStatus.includes("accept");
                          const isRework = biwStatus.includes("rework");
                          const isReject = biwStatus.includes("reject");

                          return (
                            <tr
                              key={i}
                              className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors"
                            >
                              <td className="p-2.5 text-gray-400">{r.rowIndex || i + 1}</td>
                              <td className="p-2.5 font-bold flex items-center gap-1.5">
                                {r.chassisNumber}
                                {r.matched ? (
                                  <span className="w-2 h-2 rounded-full bg-green-500" title="Found in current form" />
                                ) : (
                                  <span className="w-2 h-2 rounded-full bg-amber-400" title="Will query in form" />
                                )}
                              </td>
                              <td className="p-2.5">
                                {r.biwFeedback ? (
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                      isAccept
                                        ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                                        : isRework
                                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                                        : isReject
                                        ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                                        : "bg-gray-100 text-gray-700"
                                    }`}
                                  >
                                    {r.biwFeedback}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="p-2.5 max-w-[160px] truncate" title={r.biwReason}>
                                {r.biwReason || "-"}
                              </td>
                              <td className="p-2.5 max-w-[120px] truncate" title={r.biwRemark || r.tvsRemark}>
                                {r.biwRemark || r.tvsRemark || "-"}
                              </td>
                              <td className="p-2.5">
                                {r.tvsFeedback ? (
                                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                                    {r.tvsFeedback}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="p-2.5">
                                {r.biwFileUrl ? (
                                  <a
                                    href={r.biwFileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-600 hover:underline flex items-center gap-1"
                                  >
                                    Link <ExternalLink className="w-3 h-3" />
                                  </a>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DOWNLOAD TEMPLATE */}
          {activeTab === "template" && (
            <div className="space-y-6">
              <div className="p-5 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-md">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                      Preconfigured Excel with Dynamic Dropdown Lists
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mb-3">
                      This template is custom-generated for <strong>{formTitle}</strong>. In Microsoft Excel or Google Sheets,
                      the review status columns and rework defect columns provide native dropdown menus populated directly
                      from this form’s inspection checkpoints!
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-700 dark:text-gray-300">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <strong>Col 2:</strong> BIW Feedback (Accepted, Rework, Rejected)
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <strong>Col 3:</strong> Defect Checkpoints from Form + Rust/Dent
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <strong>Col 6:</strong> TVS Feedback (Accepted, Rework, Rejected)
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <strong>Col 7 & 8:</strong> TVS Rework & Rejection Reasons
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Prefill Option */}
              <div className="p-4 border border-gray-200 dark:border-gray-800 rounded-xl space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefillChassis}
                    onChange={(e) => setPrefillChassis(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white">
                      Prefill with chassis numbers from current responses table
                    </span>
                    <p className="text-xs text-gray-500">
                      Populates {uniqueChassisList.length} chassis numbers currently loaded in the dashboard view.
                    </p>
                  </div>
                </label>
              </div>

              {/* Action Button */}
              <button
                onClick={handleDownloadTemplate}
                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download BIW Review Excel Template (.xlsx)
              </button>
            </div>
          )}

          {/* TAB 3: EMAIL REPORT */}
          {activeTab === "email" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white">
                    Quality Inspection Email Summary
                  </h4>
                  <p className="text-xs text-gray-500">
                    Copy preformatted HTML table or text to paste into Outlook, Gmail, or your messaging channels.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopyEmailHtml}
                    className="px-3 py-1.5 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 rounded-lg border border-indigo-200 dark:border-indigo-800 flex items-center gap-1.5 transition-colors"
                  >
                    {copiedHtml ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedHtml ? "Copied HTML!" : "Copy HTML"}
                  </button>
                  <button
                    onClick={handleCopyEmailText}
                    className="px-3 py-1.5 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300 rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    {copiedText ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedText ? "Copied Text!" : "Copy Text"}
                  </button>
                </div>
              </div>

              {/* Email Live Preview */}
              <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4 bg-white dark:bg-gray-900 max-h-96 overflow-y-auto">
                <div dangerouslySetInnerHTML={{ __html: emailDraft.html }} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60">
          <div className="text-xs text-gray-500">
            {uniqueChassisList.length} Chassis records tracked in this inspection template
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs sm:text-sm font-semibold text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
