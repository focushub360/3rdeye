import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Eye,
  BarChart3,
  Users as UsersIcon,
  Loader2,
  Filter,
  Share2,
  Send,
  Download,
  Table,
} from 'lucide-react';
import type { Form } from '../types';

export interface AnalyticsHeaderProps {
  form: Form | null;
  id?: string;
  isGuest: boolean;
  embedded: boolean;
  analyticsView: string;
  onTabSwitch: (tab: string) => void;
  hasTabPermission: (tab: string) => boolean;
  totalResponses: number;
  refreshDashboardData: () => void;
  isDashboardRefreshing: boolean;
  uniqueInspectors: string[];
  selectedInspectorForTrend: string;
  onSelectInspector: (inspector: string) => void;
  appliedFiltersCount: number;
  onOpenFilterModal: () => void;
  onShareAnalytics: () => void;
  onAutoSendSetup: () => void;
  onExportPDF: () => void;
  onExportExcel: () => void;
  isExporting: boolean;
  onLogout: () => void;
  onBack: () => void;
}

export const AnalyticsHeader: React.FC<AnalyticsHeaderProps> = ({
  form,
  id,
  isGuest,
  embedded,
  analyticsView,
  onTabSwitch,
  hasTabPermission,
  totalResponses,
  refreshDashboardData,
  isDashboardRefreshing,
  uniqueInspectors,
  selectedInspectorForTrend,
  onSelectInspector,
  appliedFiltersCount,
  onOpenFilterModal,
  onShareAnalytics,
  onAutoSendSetup,
  onExportPDF,
  onExportExcel,
  isExporting,
  onLogout,
  onBack,
}) => {
  if (!form) return null;

  return (
    <div className="bg-white dark:bg-gray-900 p-3 sm:p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 flex flex-col lg:flex-row items-center justify-between gap-4">
      {/* Left side: Back, Form Title & View Form link */}
      <div className="flex items-center gap-2 sm:gap-4 w-full lg:w-auto">
        {!isGuest && !embedded && (
          <button
            onClick={onBack}
            className="p-1.5 sm:p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Go back"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        )}
        <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate max-w-[200px] sm:max-w-md">
          {form?.title || 'Form'}
        </h1>
        {id && (
          <Link
            to={`/forms/${id}/respond`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg border border-blue-200 dark:border-blue-800 transition-colors shadow-2xs"
            title="Open and fill / view inspection form"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>View Form</span>
          </Link>
        )}
      </div>

      {/* Tabs - Center */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0 max-w-full no-scrollbar">
        {hasTabPermission('dashboard') && (
          <button
            onClick={() => onTabSwitch('dashboard')}
            className={`px-3 py-2.5 font-semibold transition-all duration-200 flex items-center gap-2 border-b-2 whitespace-nowrap text-sm ${
              analyticsView === 'dashboard'
                ? 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400'
                : 'text-gray-600 dark:text-gray-400 border-transparent hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Dashboard
          </button>
        )}

        {hasTabPermission('responses') && (
          <button
            onClick={() => onTabSwitch('responses')}
            className={`px-3 py-2.5 font-semibold transition-all duration-200 flex items-center gap-2 border-b-2 whitespace-nowrap text-sm ${
              analyticsView === 'responses'
                ? 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400'
                : 'text-gray-600 dark:text-gray-400 border-transparent hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <UsersIcon className="w-4 h-4" />
            Responses
          </button>
        )}
      </div>

      {/* Right Side - Count and Actions */}
      <div className="flex items-center gap-2 sm:gap-3 whitespace-nowrap w-full lg:w-auto justify-between lg:justify-end">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Total Responses Count */}
          <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <UsersIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 dark:text-blue-400" />
            <div className="text-right">
              <div className="text-sm sm:text-base font-bold text-gray-900 dark:text-white">
                {totalResponses}
              </div>
            </div>
          </div>

          {/* Refresh Button - Only shows on Dashboard tab */}
          {analyticsView === 'dashboard' && (
            <button
              onClick={refreshDashboardData}
              disabled={isDashboardRefreshing}
              className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
                isDashboardRefreshing
                  ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
              }`}
              title="Refresh Dashboard Data"
            >
              {isDashboardRefreshing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              )}
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {uniqueInspectors.length > 0 && (
            <select
              value={selectedInspectorForTrend}
              onChange={(e) => onSelectInspector(e.target.value)}
              className="text-[10px] font-bold bg-white dark:bg-gray-900 text-primary-700 dark:text-primary-300 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-purple-500/50 shadow-sm"
              title="Filter Performance Trend by Inspector"
            >
              <option value="Overall">All Inspectors</option>
              <optgroup label="By Inspector">
                {uniqueInspectors.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </optgroup>
            </select>
          )}
          <button
            onClick={onOpenFilterModal}
            className={`p-1.5 sm:p-2 rounded transition-colors relative ${
              appliedFiltersCount > 0
                ? 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 bg-indigo-50 dark:bg-indigo-900/20'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            title="Advanced Filters"
          >
            <Filter className="w-4 h-4" />
            {appliedFiltersCount > 0 && (
              <span className="absolute top-0 right-0 flex items-center justify-center w-3.5 h-3.5 text-[8px] font-bold text-white bg-red-500 rounded-full -translate-y-1 translate-x-1">
                {appliedFiltersCount}
              </span>
            )}
          </button>
          {/* Action buttons */}
          <div className="flex items-center gap-1">
            {!isGuest && (
              <>
                <button
                  onClick={onShareAnalytics}
                  className="p-1.5 sm:p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                  title="Share via WhatsApp/Email"
                >
                  <Share2 className="w-4 h-4" />
                </button>
                <button
                  onClick={onAutoSendSetup}
                  className="p-1.5 sm:p-2 text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                  title="Email Automation"
                >
                  <Send className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              onClick={onExportPDF}
              disabled={isExporting}
              className="p-1.5 sm:p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
              title="Export to PDF"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin text-red-500" />
              ) : (
                <Download className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={onExportExcel}
              disabled={isExporting}
              className="p-1.5 sm:p-2 text-gray-500 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors disabled:opacity-50"
              title="Export to Excel"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin text-green-600" />
              ) : (
                <Table className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
        {isGuest && (
          <button
            onClick={onLogout}
            className="px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-red-200 dark:border-red-800"
          >
            Log out
          </button>
        )}
      </div>
    </div>
  );
};
