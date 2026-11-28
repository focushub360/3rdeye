import React from "react";
import { Users, Activity, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import InspectorActivityHistory from "./InspectorActivityHistory";

export const InspectorActivityPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200/80 dark:border-gray-700/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                    Activity & Audit
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                    Live Audit
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Tenant-wise audit of inspector logins, active sessions, and inspection submission history.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate("/dashboard")}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gray-100 dark:bg-gray-700/60 hover:bg-gray-200 dark:hover:bg-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 transition"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <InspectorActivityHistory />
      </div>
    </div>
  );
};

export default InspectorActivityPage;
