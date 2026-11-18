import React from 'react';
import { CheckCircle, Info, XCircle } from 'lucide-react';

export interface ToastState {
  type: 'success' | 'info' | 'error';
  message: string;
}

interface ToastNotificationProps {
  toast: ToastState | null;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({ toast }) => {
  if (!toast) return null;

  return (
    <div
      className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white font-medium z-50 animate-fadeIn ${
        toast.type === 'success'
          ? 'bg-green-500 dark:bg-green-600'
          : toast.type === 'info'
          ? 'bg-blue-500 dark:bg-blue-600'
          : 'bg-red-500 dark:bg-red-600'
      }`}
    >
      <div className="flex items-center gap-2">
        {toast.type === 'success' ? (
          <CheckCircle className="w-5 h-5" />
        ) : toast.type === 'info' ? (
          <Info className="w-5 h-5" />
        ) : (
          <XCircle className="w-5 h-5" />
        )}
        {toast.message}
      </div>
    </div>
  );
};
