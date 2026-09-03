import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Copy,
  Check,
  Search,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Eye,
  ExternalLink,
  AlertTriangle,
  Database,
  Edit2,
  ArrowUpRight
} from 'lucide-react';
import { apiClient } from '../../api/client';

interface ImportHistoryItem {
  _id: string;
  actionType: string;
  actionTitle: string;
  userName: string;
  userEmail?: string;
  userRole?: string;
  formId?: string;
  formTitle: string;
  batchId?: string;
  fileName?: string;
  templateType?: string;
  dataCount: {
    total: number;
    success: number;
    failed: number;
  };
  details?: {
    chassisNumbers?: string[];
    submitters?: string[];
    questionsCount?: number;
    errors?: any[];
    notes?: string;
  };
  status: 'success' | 'partial' | 'failed';
  createdAt: string;
}

interface BatchResponseItem {
  id: string;
  _id?: string;
  questionId: string;
  chassisNumber: string;
  status: string;
  submittedBy: string;
  createdAt: string;
  answersCount?: number;
  biwReview?: any;
}

interface ImportHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  formId?: string;
}

export default function ImportHistoryModal({
  isOpen,
  onClose,
  formId
}: ImportHistoryModalProps) {
  const navigate = useNavigate();
  const [items, setItems] = useState<ImportHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedBatchId, setCopiedBatchId] = useState<string | null>(null);

  // View Uploaded Data Dialog State
  const [inspectItem, setInspectItem] = useState<ImportHistoryItem | null>(null);
  const [inspectResponses, setInspectResponses] = useState<BatchResponseItem[]>([]);
  const [isLoadingInspect, setIsLoadingInspect] = useState(false);
  const [deletingResponseId, setDeletingResponseId] = useState<string | null>(null);

  // Delete Options Dialog State
  const [deleteTarget, setDeleteTarget] = useState<ImportHistoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const historyRes = await apiClient.getImportHistory({
        formId,
        search: searchTerm.trim() || undefined,
        limit: 100
      });

      const itemsList =
        historyRes?.items ||
        historyRes?.data?.items ||
        (Array.isArray(historyRes?.data) ? historyRes.data : Array.isArray(historyRes) ? historyRes : []);

      setItems(itemsList);
    } catch (error) {
      console.error('Failed to fetch upload history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen, formId]);

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      fetchHistory();
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleCopy = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedBatchId(text);
    setTimeout(() => setCopiedBatchId(null), 2000);
  };

  // Redirect to form responses table (Screen 2: row & column analytics table) filtered to only uploaded data
  const handleRedirectToFormResponses = (item: ImportHistoryItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!item.formId) return;
    onClose();
    const batchParam = item.batchId ? `&batchId=${encodeURIComponent(item.batchId)}` : `&uploadOnly=true`;
    navigate(`/forms/${item.formId}/analytics?tab=responses${batchParam}`);
  };

  // Open "View Data" modal
  const handleOpenInspect = async (item: ImportHistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setInspectItem(item);
    setIsLoadingInspect(true);
    try {
      const res = await apiClient.getImportHistoryResponses(item._id);
      const respList = res?.responses || res?.data?.responses || [];
      setInspectResponses(respList);
    } catch (err) {
      console.error('Failed to load batch responses:', err);
      setInspectResponses([]);
    } finally {
      setIsLoadingInspect(false);
    }
  };

  // Delete single response from inspect dialog
  const handleDeleteSingleResponse = async (responseId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to permanently delete this uploaded response?')) {
      return;
    }
    setDeletingResponseId(responseId);
    try {
      await apiClient.deleteResponse(responseId);
      setInspectResponses(prev => prev.filter(r => r.id !== responseId));
      // Also update counts locally
      if (inspectItem) {
        setItems(prev => prev.map(it => {
          if (it._id === inspectItem._id) {
            return {
              ...it,
              dataCount: {
                ...it.dataCount,
                total: Math.max(0, it.dataCount.total - 1),
                success: Math.max(0, it.dataCount.success - 1)
              }
            };
          }
          return it;
        }));
      }
    } catch (err) {
      console.error('Failed to delete response:', err);
      alert('Failed to delete response. Please try again.');
    } finally {
      setDeletingResponseId(null);
    }
  };

  // Open "Delete Options" modal
  const handleOpenDelete = (item: ImportHistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget(item);
  };

  // Perform delete action
  const handleConfirmDelete = async (deleteResponses: boolean) => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await apiClient.deleteImportHistory(deleteTarget._id, deleteResponses);
      setItems(prev => prev.filter(item => item._id !== deleteTarget._id));
      setDeleteTarget(null);
    } catch (err) {
      console.error('Failed to delete history item:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const getBadgeTag = (item: ImportHistoryItem) => {
    if (item.templateType === 'Template 2') return 'T2';
    if (item.templateType === 'Follow-up Form') return 'FU';
    if (item.actionType === 'BULK_REVIEW_UPDATE') return 'BIW';
    if (item.batchId && item.batchId.toLowerCase().includes('ib1')) return 'IB1';
    return 'MAIN';
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-5 animate-in fade-in duration-200">
        {/* Spacious modal container: max-w-6xl w-[94vw] */}
        <div className="bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 rounded-2xl shadow-2xl max-w-6xl w-[94vw] max-h-[92vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800 text-sm">
          
          {/* Header - matching Web App Blue Gradient */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 px-7 py-5 flex items-center justify-between text-white shadow-sm">
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-white/15 text-white border border-white/20 shadow-xs">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  Upload History
                </h2>
                <p className="text-xs sm:text-sm text-blue-100 font-medium">
                  Recent bulk response uploads, edits, and action audit records
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Search Input */}
              <div className="relative hidden sm:block">
                <Search className="w-4 h-4 text-blue-200 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search file, form, user..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9 pr-3.5 py-2 text-xs sm:text-sm bg-white/15 border border-white/25 rounded-xl text-white placeholder-blue-200 focus:outline-none focus:bg-white/25 w-64"
                />
              </div>

              {/* Refresh button */}
              <button
                onClick={fetchHistory}
                disabled={isLoading}
                className="p-2.5 text-white/80 hover:text-white hover:bg-white/15 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>

              {/* Close button */}
              <button
                onClick={onClose}
                className="p-2.5 text-white/80 hover:text-white hover:bg-white/15 rounded-xl transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Table Content */}
          <div className="flex-1 overflow-x-auto overflow-y-auto bg-white dark:bg-gray-900">
            {isLoading && items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                <RefreshCw className="w-9 h-9 animate-spin text-blue-600 mb-3.5" />
                <p className="text-base font-semibold">Loading upload history...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-24 text-gray-400">
                <FileSpreadsheet className="w-14 h-14 text-gray-300 dark:text-gray-600 mx-auto mb-3.5" />
                <p className="text-base font-bold text-gray-700 dark:text-gray-300">No upload history records found</p>
                <p className="text-sm text-gray-500 mt-1">Uploaded Excel responses and edits will show up here.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 bg-gray-50/90 dark:bg-gray-800/70">
                    <th className="py-4 px-5 w-14 text-center">#</th>
                    <th className="py-4 px-5">FILE</th>
                    <th className="py-4 px-5">FORM / SUBMITTER</th>
                    <th className="py-4 px-5 text-center">TYPE</th>
                    <th className="py-4 px-5 text-center">RECORDS</th>
                    <th className="py-4 px-5">STATUS</th>
                    <th className="py-4 px-5">DATE</th>
                    <th className="py-4 px-5 text-center w-40">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
                  {items.map((item, idx) => {
                    const isExpanded = expandedId === item._id;
                    const displayFileName = item.fileName || (item.formTitle ? `${item.formTitle.replace(/\s+/g, '_')}.xlsx` : 'Responses.xlsx');
                    const tag = getBadgeTag(item);
                    const isCompleted = item.status === 'success';

                    return (
                      <React.Fragment key={item._id}>
                        <tr
                          onClick={() => toggleExpand(item._id)}
                          className="hover:bg-blue-50/50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer group"
                        >
                          {/* Index */}
                          <td className="py-4 px-5 text-center font-bold text-gray-400 dark:text-gray-500">
                            {idx + 1}
                          </td>

                          {/* File Name */}
                          <td className="py-4 px-5 font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm text-gray-900 dark:text-gray-100 font-bold">{displayFileName}</span>
                            </div>
                          </td>

                          {/* Form / Submitter */}
                          <td className="py-4 px-5">
                            <div
                              onClick={(e) => item.formId && handleRedirectToFormResponses(item, e)}
                              className={`font-black text-gray-900 dark:text-gray-100 text-[14.5px] ${item.formId ? 'hover:text-blue-600 hover:underline cursor-pointer' : ''}`}
                              title={item.formId ? "Click to view uploaded responses in Analytics Table" : undefined}
                            >
                              {item.formTitle || 'Inspection Form'}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-1">
                              <span>Uploaded by: <strong className="text-gray-700 dark:text-gray-300 font-bold">{item.userName || item.userEmail}</strong></span>
                              {item.details?.submitters?.length > 0 && item.details.submitters[0] !== item.userName && (
                                <span className="text-blue-600 dark:text-blue-400 font-medium">
                                  • Submitter: {item.details.submitters[0]}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Tag Pill (like IB1 in purple) */}
                          <td className="py-4 px-5 text-center">
                            <span className="inline-block px-3 py-1 rounded-full text-xs font-black tracking-wider bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shadow-2xs">
                              {tag}
                            </span>
                          </td>

                          {/* Records (e.g. 386 / 386) */}
                          <td className="py-4 px-5 text-center font-mono font-black text-sm text-gray-800 dark:text-gray-200">
                            {item.dataCount.success} / {item.dataCount.total}
                          </td>

                          {/* Status (Completed with green check) */}
                          <td className="py-4 px-5">
                            <div className="flex items-center gap-1.5">
                              {isCompleted ? (
                                <>
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                  <span className="font-bold text-emerald-700 dark:text-emerald-400">Completed</span>
                                </>
                              ) : item.status === 'partial' ? (
                                <>
                                  <AlertCircle className="w-4 h-4 text-amber-500" />
                                  <span className="font-bold text-amber-600 dark:text-amber-400">Partial</span>
                                </>
                              ) : (
                                <>
                                  <AlertCircle className="w-4 h-4 text-rose-500" />
                                  <span className="font-bold text-rose-600 dark:text-rose-400">Failed</span>
                                </>
                              )}
                            </div>
                          </td>

                          {/* Date (20/08/2026) */}
                          <td className="py-4 px-5 text-gray-500 dark:text-gray-400 font-semibold text-xs sm:text-sm">
                            {formatDate(item.createdAt)}
                          </td>

                          {/* Actions: Redirect to Responses, Inspect Data, Delete Options */}
                          <td className="py-4 px-5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* 1. Redirect to Uploaded Responses Table */}
                              {item.formId && (
                                <button
                                  onClick={(e) => handleRedirectToFormResponses(item, e)}
                                  className="p-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors cursor-pointer"
                                  title="Redirect to form responses table to edit or delete uploaded data"
                                >
                                  <ArrowUpRight className="w-4 h-4" />
                                </button>
                              )}

                              {/* 2. View Data / Inspect Eye Button */}
                              <button
                                onClick={(e) => handleOpenInspect(item, e)}
                                className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors cursor-pointer"
                                title="Inspect uploaded records & edit/delete individual responses"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {/* 3. Delete Options Button */}
                              <button
                                onClick={(e) => handleOpenDelete(item, e)}
                                className="p-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                                title="Delete options (remove record or delete uploaded data from DB)"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>

                              {/* 4. Toggle Details Chevron */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleExpand(item._id);
                                }}
                                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                                title="Toggle details"
                              >
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expandable Details Row */}
                        {isExpanded && (
                          <tr className="bg-gray-50/90 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
                            <td colSpan={8} className="p-5 sm:p-6 pl-14">
                              <div className="space-y-4 text-xs sm:text-sm">
                                {/* Batch ID & Action buttons */}
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  {item.batchId && (
                                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                      <span className="font-bold text-gray-700 dark:text-gray-200">Batch ID:</span>
                                      <span className="font-mono text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-700 text-xs font-bold">{item.batchId}</span>
                                      <button
                                        onClick={(e) => handleCopy(item.batchId!, e)}
                                        className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors text-gray-500 cursor-pointer"
                                        title="Copy Batch ID"
                                      >
                                        {copiedBatchId === item.batchId ? (
                                          <Check className="w-4 h-4 text-emerald-600" />
                                        ) : (
                                          <Copy className="w-4 h-4" />
                                        )}
                                      </button>
                                    </div>
                                  )}

                                  {/* Quick Action Navigation Bar */}
                                  <div className="flex items-center gap-2.5">
                                    {item.formId && (
                                      <button
                                        onClick={(e) => handleRedirectToFormResponses(item, e)}
                                        className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                                        title="Open Service Analytics responses table (row & column view) filtered to this upload"
                                      >
                                        <ArrowUpRight className="w-4 h-4" />
                                        <span>View Uploaded Data in Table (Edit / Delete)</span>
                                      </button>
                                    )}

                                    <button
                                      onClick={(e) => handleOpenInspect(item, e)}
                                      className="px-3.5 py-2 bg-white hover:bg-gray-100 text-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-200 rounded-xl text-xs font-bold transition-all border border-gray-300 dark:border-gray-700 flex items-center gap-1.5 cursor-pointer"
                                    >
                                      <Eye className="w-4 h-4 text-blue-600" />
                                      <span>Inspect Responses ({item.dataCount.total})</span>
                                    </button>
                                  </div>
                                </div>

                                {/* Affected Chassis Numbers */}
                                {item.details?.chassisNumbers && item.details.chassisNumbers.length > 0 && (
                                  <div>
                                    <span className="font-bold text-gray-700 dark:text-gray-200 block mb-2">
                                      Chassis Numbers Uploaded ({item.details.chassisNumbers.length}):
                                    </span>
                                    <div className="flex flex-wrap gap-2">
                                      {item.details.chassisNumbers.map((chassis, cIdx) => (
                                        <span
                                          key={cIdx}
                                          className="px-2.5 py-1 rounded-md font-mono text-xs font-bold bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                                        >
                                          {chassis}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Notes */}
                                {item.details?.notes && (
                                  <div className="text-gray-600 dark:text-gray-400 italic">
                                    "{item.details.notes}"
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          <div className="px-7 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80 flex items-center justify-between text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            <span className="font-medium">Total: {items.length} upload {items.length === 1 ? 'batch' : 'batches'}</span>
            <button
              onClick={onClose}
              className="px-5 py-2 bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-xs"
            >
              Close
            </button>
          </div>

        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 1. "SEE EDITED ONE DATA" / INSPECT UPLOADED DATA MODAL                     */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {inspectItem && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-60 flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[88vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800">
            
            {/* Modal Top Bar */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-white/20">
                  <Eye className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Uploaded Data Inspection</h3>
                  <p className="text-xs text-blue-100">
                    {inspectItem.formTitle} • {inspectResponses.length} response(s) loaded
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {inspectItem.formId && (
                  <button
                    onClick={(e) => handleRedirectToFormResponses(inspectItem, e)}
                    className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                    title="Open full responses table in Service Analytics"
                  >
                    <span>Full Responses Table</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setInspectItem(null)}
                  className="p-2 rounded-xl hover:bg-white/20 text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Batch Info Header */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800 text-xs grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-gray-500 block">Uploaded By</span>
                <span className="font-bold text-gray-800 dark:text-gray-200">{inspectItem.userName}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Date & Time</span>
                <span className="font-bold text-gray-800 dark:text-gray-200">{formatDateTime(inspectItem.createdAt)}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Total Records</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{inspectItem.dataCount.success} Successful</span>
              </div>
              <div>
                <span className="text-gray-500 block">Source File</span>
                <span className="font-bold text-gray-800 dark:text-gray-200 truncate block">{inspectItem.fileName || 'Responses.xlsx'}</span>
              </div>
            </div>

            {/* Responses List Table with Direct Edit and Delete Options */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {isLoadingInspect ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mb-3" />
                  <p className="text-sm font-semibold">Loading uploaded responses...</p>
                </div>
              ) : inspectResponses.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <AlertCircle className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">No individual responses found for this batch</p>
                  <p className="text-xs text-gray-500 mt-1">The responses may have been deleted or archived.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800 text-xs font-bold uppercase text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50">
                      <th className="py-2.5 px-3 w-12 text-center">#</th>
                      <th className="py-2.5 px-3">CHASSIS NUMBER</th>
                      <th className="py-2.5 px-3">SUBMITTER</th>
                      <th className="py-2.5 px-3 text-center">STATUS</th>
                      <th className="py-2.5 px-3">SUBMITTED AT</th>
                      <th className="py-2.5 px-3 text-right">ACTIONS (EDIT / DELETE)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {inspectResponses.map((resp, rIdx) => (
                      <tr key={resp.id || rIdx} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="py-3 px-3 text-center font-bold text-gray-400">{rIdx + 1}</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-md font-mono text-xs font-bold bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            {resp.chassisNumber !== '-' ? resp.chassisNumber : 'No Chassis'}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-semibold text-gray-800 dark:text-gray-200">
                          {resp.submittedBy || 'Excel Import'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            {resp.status || 'pending'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-xs text-gray-500 dark:text-gray-400">
                          {formatDateTime(resp.createdAt)}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* 1. Edit Response (Opens edit form in new tab) */}
                            <a
                              href={`/responses/${resp.id}/edit`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-2xs transition-colors"
                              title="Edit this response's answers and data"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Edit</span>
                            </a>

                            {/* 2. Open / View Response */}
                            <a
                              href={`/responses/${resp.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition-colors"
                              title="View full response details & photos"
                            >
                              <Eye className="w-3 h-3" />
                              <span>View</span>
                            </a>

                            {/* 3. Delete this single uploaded response */}
                            <button
                              onClick={(e) => handleDeleteSingleResponse(resp.id, e)}
                              disabled={deletingResponseId === resp.id}
                              className="p-1.5 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                              title="Permanently delete this uploaded response"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                Use "Edit" to modify answers or defect data, or 🗑️ to delete individual uploaded entries.
              </span>
              <button
                onClick={() => setInspectItem(null)}
                className="px-4 py-1.5 bg-gray-800 hover:bg-gray-900 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Close View
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 2. "DELETE UPLOAD DATA" OPTIONS MODAL                                      */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-60 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-800 space-y-5">
            
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900 dark:text-gray-100">Delete Options</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {deleteTarget.formTitle} ({deleteTarget.dataCount.total} records)
                </p>
              </div>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300">
              Please choose how you would like to delete this upload:
            </p>

            <div className="space-y-3">
              {/* Option 1: Remove History Log Record Only */}
              <button
                onClick={() => handleConfirmDelete(false)}
                disabled={isDeleting}
                className="w-full p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-gray-800 dark:text-gray-200">Remove History Log Only</span>
                  <Trash2 className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Removes this record from the upload history list. The imported responses remain in the database.
                </p>
              </button>

              {/* Option 2: Delete Uploaded Data from Database (Rollback) */}
              <button
                onClick={() => handleConfirmDelete(true)}
                disabled={isDeleting}
                className="w-full p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 hover:bg-rose-100/70 dark:hover:bg-rose-950/50 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between text-rose-700 dark:text-rose-400">
                  <span className="font-black text-sm flex items-center gap-1.5">
                    <Database className="w-4 h-4" />
                    Delete Uploaded Responses from Database
                  </span>
                  <Trash2 className="w-4 h-4 text-rose-600" />
                </div>
                <p className="text-xs text-rose-600/90 dark:text-rose-400/80 mt-1 font-medium">
                  Permanently deletes all {deleteTarget.dataCount.total} response(s) created by this upload from the database and removes the history record.
                </p>
              </button>
            </div>

            {/* Cancel */}
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
