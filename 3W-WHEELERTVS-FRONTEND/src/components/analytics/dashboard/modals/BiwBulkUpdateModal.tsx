import React from "react";
import { CheckCircle, XCircle, RotateCcw, Trash2 } from "lucide-react";

export interface BiwBulkUpdateModalProps {
  isOpen: boolean;
  status: "Accepted" | "Rejected" | "Reworked" | null;
  targetCount: number;
  skippedCount: number;
  isUpdating: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const BiwBulkUpdateModal: React.FC<BiwBulkUpdateModalProps> = ({
  isOpen,
  status,
  targetCount,
  skippedCount,
  isUpdating,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-sm w-full animate-in fade-in zoom-in-95 duration-150">
        <div className="p-6">
          <div
            className={`flex items-center justify-center w-12 h-12 mx-auto rounded-full mb-4 ${
              status === "Accepted"
                ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                : status === "Rejected"
                ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                : status === "Reworked"
                ? "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
                : "bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400"
            }`}
          >
            {status === "Accepted" && <CheckCircle className="w-6 h-6" />}
            {status === "Rejected" && <XCircle className="w-6 h-6" />}
            {status === "Reworked" && <RotateCcw className="w-6 h-6" />}
            {status === null && <Trash2 className="w-6 h-6" />}
          </div>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">
            {status === null ? "Clear BIW Reviews" : `Mark BIW Reviews as ${status}`}
          </h3>

          <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-4">
            Are you sure you want to {status === null ? "clear the BIW review for" : `mark as ${status}`} {targetCount} response(s)?
          </p>

          {skippedCount > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 text-center bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg mb-4">
              Note: {skippedCount} submission(s) will be skipped because you cannot review your own work.
            </p>
          )}

          <div className="flex gap-2 justify-center">
            <button
              onClick={onClose}
              disabled={isUpdating}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium disabled:opacity-50 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isUpdating}
              className={`px-4 py-2 text-white rounded-lg transition-colors font-medium disabled:opacity-50 flex items-center gap-2 text-sm ${
                status === "Accepted"
                  ? "bg-green-600 hover:bg-green-700"
                  : status === "Rejected"
                  ? "bg-red-600 hover:bg-red-700"
                  : status === "Reworked"
                  ? "bg-orange-600 hover:bg-orange-700"
                  : "bg-gray-600 hover:bg-gray-700"
              }`}
            >
              {isUpdating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Updating...
                </>
              ) : (
                "Confirm"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BiwBulkUpdateModal;
