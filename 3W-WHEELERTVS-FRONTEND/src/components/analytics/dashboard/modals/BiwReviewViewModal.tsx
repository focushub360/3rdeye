import React from "react";
import { X, CheckCircle, XCircle, RotateCcw } from "lucide-react";
import type { Response } from "../types";

export interface BiwReviewViewModalProps {
  isOpen: boolean;
  response: Response | null;
  chassisValue: string;
  onClose: () => void;
}

export const BiwReviewViewModal: React.FC<BiwReviewViewModalProps> = ({
  isOpen,
  response,
  chassisValue,
  onClose,
}) => {
  if (!isOpen || !response) return null;

  const biwRev = response.biwReview || (response as any).review || (response as any).tvsReview;
  const currentReviewStatus = biwRev?.status || (response as any).review?.status || (response as any).tvsReview?.status || "";
  const currentReviewerName = biwRev?.reviewedByName || biwRev?.reviewedBy || (response as any).review?.reviewedByName || (response as any).review?.reviewedBy || "Reviewer";
  const currentReviewedAt = biwRev?.reviewedAt || (response as any).review?.reviewedAt;

  const modalFlaggedQuestions: any[] = (
    Array.isArray(biwRev?.flaggedQuestions) && biwRev.flaggedQuestions.length > 0
      ? biwRev.flaggedQuestions
      : Array.isArray((response as any).review?.flaggedQuestions) && (response as any).review.flaggedQuestions.length > 0
        ? (response as any).review.flaggedQuestions
        : Array.isArray((response as any).review?.questionContexts) && (response as any).review.questionContexts.length > 0
          ? (response as any).review.questionContexts
          : Array.isArray((response as any).tvsReview?.flaggedQuestions) && (response as any).tvsReview.flaggedQuestions.length > 0
            ? (response as any).tvsReview.flaggedQuestions
            : []
  );

  const modalRemark = biwRev?.remark || biwRev?.reason || (response as any).review?.remark || (response as any).review?.reason;
  const modalEvidenceUrl = biwRev?.evidenceUrl || (response as any).review?.evidenceUrl;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150 overflow-hidden border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800/80">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                BIW Review Details
              </h3>
              {chassisValue && chassisValue !== "-" && (
                <span className="px-2 py-0.5 text-xs font-mono font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded border border-purple-200 dark:border-purple-800">
                  Chassis: {chassisValue}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Submitted by: <span className="font-semibold text-gray-700 dark:text-gray-300">{response.submittedBy || "Inspector"}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="px-5 py-4 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Review Status Card */}
          <div className="bg-gray-50 dark:bg-gray-900/40 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                {String(currentReviewStatus).toLowerCase().trim() === "accepted" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800">
                    <CheckCircle className="w-3.5 h-3.5" /> Accepted
                  </span>
                )}
                {String(currentReviewStatus).toLowerCase().trim() === "rejected" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800">
                    <XCircle className="w-3.5 h-3.5" /> Rejected
                  </span>
                )}
                {(String(currentReviewStatus).toLowerCase().trim() === "reworked" ||
                  String(currentReviewStatus).toLowerCase().trim() === "rework") && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-800">
                    <RotateCcw className="w-3.5 h-3.5" /> Rework
                  </span>
                )}
                {!currentReviewStatus && (
                  <span className="text-xs font-medium text-gray-500">No review status recorded yet</span>
                )}
              </div>
              {currentReviewerName && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Reviewed by <span className="font-semibold text-gray-800 dark:text-gray-200">{currentReviewerName}</span>
                  {currentReviewedAt && (
                    <span className="text-gray-400 ml-1">
                      on {new Date(currentReviewedAt).toLocaleString()}
                    </span>
                  )}
                </p>
              )}
            </div>

            {/* Flagged questions */}
            {modalFlaggedQuestions && modalFlaggedQuestions.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1.5">
                  Flagged Question(s)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {modalFlaggedQuestions.map((q: any, idx: number) => {
                    const catText = typeof q === "object" ? (q.questionText || q.title || q.text || q.questionId) : String(q);
                    return (
                      <span
                        key={`${q.questionId || idx}-${idx}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60"
                      >
                        <span>⚠️</span>
                        <span>{catText}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Remark */}
            {modalRemark && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">
                  Review Remark
                </label>
                <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {modalRemark}
                </p>
              </div>
            )}

            {/* Evidence Image */}
            {modalEvidenceUrl && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1.5">
                  Evidence Image
                </label>
                <img
                  src={modalEvidenceUrl}
                  alt="Evidence"
                  className="w-full max-h-48 object-contain rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:opacity-95 transition-opacity"
                  onClick={() => window.open(modalEvidenceUrl, "_blank")}
                  title="Click to view full size"
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-5 py-3.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default BiwReviewViewModal;
