import React from "react";
import { X, XCircle, RotateCcw, Upload, Loader2 } from "lucide-react";
import type { Response } from "../types";

export interface BiwReviewActionModalProps {
  isOpen: boolean;
  response: Response | null;
  status: "Accepted" | "Rejected" | "Reworked" | null;
  selectedQuestionIds: string[];
  remark: string;
  evidenceUrl: string;
  isUploading: boolean;
  isSubmitting: boolean;
  questionOptions: Array<{ id: string; text: string }>;
  onClose: () => void;
  onToggleQuestion: (id: string) => void;
  onRemarkChange: (remark: string) => void;
  onEvidenceChange: (url: string) => void;
  onEvidenceUpload: (file: File) => Promise<void>;
  onSubmit: () => void;
}

export const BiwReviewActionModal: React.FC<BiwReviewActionModalProps> = ({
  isOpen,
  response,
  status,
  selectedQuestionIds,
  remark,
  evidenceUrl,
  isUploading,
  isSubmitting,
  questionOptions,
  onClose,
  onToggleQuestion,
  onRemarkChange,
  onEvidenceChange,
  onEvidenceUpload,
  onSubmit,
}) => {
  if (!isOpen || !response || !status) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-md w-full max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full ${
                status === "Rejected"
                  ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                  : "bg-orange-100 dark:orange-900/30 text-orange-600 dark:text-orange-400"
              }`}
            >
              {status === "Rejected" ? (
                <XCircle className="w-4 h-4" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
            </div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              BIW Review — Mark as {status}
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          {/* Question selection */}
          <div>
            <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-2">
              Which question(s) is this about?
            </label>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 border border-gray-200 dark:border-gray-700 rounded-lg p-2">
              {questionOptions.length === 0 ? (
                <p className="text-xs text-gray-400 italic">
                  No answered questions found on this response.
                </p>
              ) : (
                questionOptions.map((q) => (
                  <label
                    key={q.id}
                    className="flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedQuestionIds.includes(q.id)}
                      onChange={() => onToggleQuestion(q.id)}
                      className="w-3.5 h-3.5 mt-0.5 rounded accent-purple-600 cursor-pointer"
                    />
                    <span>{q.text}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Remark */}
          <div>
            <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-2">
              Remark
            </label>
            <textarea
              rows={3}
              value={remark}
              onChange={(e) => onRemarkChange(e.target.value)}
              placeholder="Explain why this response is being rejected / needs rework..."
              className="w-full p-2.5 text-xs bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-400 outline-none resize-none"
            />
          </div>

          {/* Evidence upload */}
          <div>
            <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-2">
              Evidence (optional)
            </label>
            {evidenceUrl ? (
              <div className="relative group">
                <img
                  src={evidenceUrl}
                  alt="Evidence"
                  className="w-full h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer"
                  onClick={() => window.open(evidenceUrl, "_blank")}
                />
                <button
                  type="button"
                  onClick={() => onEvidenceChange("")}
                  className="absolute top-1.5 right-1.5 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove evidence"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : isUploading ? (
              <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg">
                <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                <span className="text-xs text-gray-500">Uploading...</span>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-1 p-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg cursor-pointer hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-all">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) await onEvidenceUpload(file);
                    e.target.value = "";
                  }}
                />
                <Upload className="w-4 h-4 text-gray-400" />
                <span className="text-[10px] text-gray-500 font-semibold">
                  Upload photo evidence
                </span>
              </label>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end px-5 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium disabled:opacity-50 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={isSubmitting || isUploading}
            className={`px-4 py-2 text-white rounded-lg transition-colors font-medium disabled:opacity-50 flex items-center gap-2 text-sm ${
              status === "Rejected"
                ? "bg-red-600 hover:bg-red-700"
                : "bg-orange-600 hover:bg-orange-700"
            }`}
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Submitting...
              </>
            ) : (
              "Submit"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BiwReviewActionModal;
