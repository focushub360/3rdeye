import React from "react";
import { CheckCircle } from "lucide-react";

export interface BulkDispatchConfirmModalProps {
  show: boolean;
  count: number;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const BulkDispatchConfirmModal: React.FC<BulkDispatchConfirmModalProps> = ({
  show,
  count,
  loading,
  onConfirm,
  onCancel,
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-sm w-full">
        <div className="p-6">
          <div className="flex items-center justify-center w-12 h-12 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
            <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">
            Bulk Dispatch Responses
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-2">
            Are you sure you want to enable dispatch for the {count} selected response{count === 1 ? "" : "s"}?
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 text-center mb-6">
            This will enable dispatching only for the response{count === 1 ? "" : "s"} you selected.
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Dispatching...
                </>
              ) : (
                `Dispatch ${count} Response${count === 1 ? "" : "s"}`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkDispatchConfirmModal;
