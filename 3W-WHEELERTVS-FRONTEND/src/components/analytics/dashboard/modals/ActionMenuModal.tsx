import React from "react";
import { X, Maximize, Eye, MessageCircle, Edit, Trash2 } from "lucide-react";
import type { Response } from "../types";

export interface ActionMenuModalProps {
  isOpen: boolean;
  response: Response | null;
  chassisValue: string;
  user: any;
  responseTenantId: any;
  currentUserTenantId: any;
  isGuest: boolean;
  onClose: () => void;
  onFocus: (response: Response) => void;
  onViewDetails: (response: Response) => void;
  onOpenChat: (response: Response) => void;
  onEdit: (response: Response) => void;
  onDelete: (response: Response) => void;
}

export const ActionMenuModal: React.FC<ActionMenuModalProps> = ({
  isOpen,
  response,
  chassisValue,
  user,
  responseTenantId,
  currentUserTenantId,
  isGuest,
  onClose,
  onFocus,
  onViewDetails,
  onOpenChat,
  onEdit,
  onDelete,
}) => {
  if (!isOpen || !response) return null;

  const isOwnTenant =
    user?.role === "superadmin" ||
    user?.role === "admin" ||
    user?.role === "subadmin" ||
    user?.role === "inspector" ||
    !responseTenantId ||
    (currentUserTenantId &&
      responseTenantId.toString() === currentUserTenantId.toString());

  const isActualOwnTenant =
    user?.role === "superadmin" ||
    !responseTenantId ||
    (currentUserTenantId &&
      responseTenantId.toString() === currentUserTenantId.toString());

  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/75 flex items-center justify-center p-4 z-[120] backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform animate-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            Response Actions
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-2">
          <div className="px-2 py-1 mb-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Selected Response
            </p>
            <p className="text-sm font-bold text-gray-700 dark:text-gray-300 truncate">
              {chassisValue !== "-" ? chassisValue : response.submittedBy || "Anonymous"}
            </p>
          </div>

          {/* Focus It */}
          <button
            onClick={() => {
              onFocus(response);
              onClose();
            }}
            className="w-full flex items-center gap-3 p-3.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-700 dark:text-gray-200 rounded-xl transition-colors font-semibold text-sm"
          >
            <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg text-blue-600 dark:text-blue-400">
              <Maximize className="w-4 h-4" />
            </div>
            FOCUS IT
          </button>

          {/* View Details */}
          {isOwnTenant && (
            <button
              onClick={() => {
                onViewDetails(response);
                onClose();
              }}
              className="w-full flex items-center gap-3 p-3.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-gray-700 dark:text-gray-200 rounded-xl transition-colors font-semibold text-sm"
            >
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg text-indigo-600 dark:text-indigo-400">
                <Eye className="w-4 h-4" />
              </div>
              View Full Details
            </button>
          )}

          {/* Chat / Review */}
          {response.isDispatched && (
            <button
              onClick={() => {
                onOpenChat(response);
                onClose();
              }}
              className="w-full flex items-center gap-3 p-3.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-700 dark:text-gray-200 rounded-xl transition-colors font-semibold text-sm"
            >
              <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg text-blue-600 dark:text-blue-400">
                <MessageCircle className="w-4 h-4" />
              </div>
              Review & Discussion
            </button>
          )}

          {/* Edit - Admin only */}
          {!isGuest &&
            (user?.role === "superadmin" || user?.role === "admin") &&
            isActualOwnTenant && (
              <button
                onClick={() => {
                  onEdit(response);
                  onClose();
                }}
                className="w-full flex items-center gap-3 p-3.5 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-gray-700 dark:text-gray-200 rounded-xl transition-colors font-semibold text-sm"
              >
                <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg text-amber-600 dark:text-amber-400">
                  <Edit className="w-4 h-4" />
                </div>
                Edit Response
              </button>
            )}

          {/* Delete - Admin only */}
          {!isGuest &&
            (user?.role === "superadmin" || user?.role === "admin") &&
            isActualOwnTenant && (
              <button
                onClick={() => {
                  onDelete(response);
                  onClose();
                }}
                className="w-full flex items-center gap-3 p-3.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl transition-colors font-semibold text-sm"
              >
                <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-lg text-red-600 dark:text-red-400">
                  <Trash2 className="w-4 h-4" />
                </div>
                Delete Response
              </button>
            )}
        </div>

        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 text-center">
          <button
            onClick={onClose}
            className="text-xs font-bold text-gray-500 uppercase tracking-widest hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            Close Menu
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActionMenuModal;
