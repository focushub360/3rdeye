import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useNotification } from '../../context/NotificationContext';
import { 
  Eye, 
  Edit2, 
  Trash2, 
  RefreshCw,
  Search,
  AlertTriangle,
  Filter,
  X,
  RotateCcw,
  Calendar,
  FileSpreadsheet
} from 'lucide-react';

interface OverallResponsesTableProps {
  rawResponses?: any[];
  formOptions?: Array<{ id: string; _id?: string; title: string; totalChecked?: number }>;
  initialFormFilter?: string;
}

export const OverallResponsesTable: React.FC<OverallResponsesTableProps> = ({ 
  rawResponses = [], 
  formOptions = [],
  initialFormFilter = 'all'
}) => {
  const navigate = useNavigate();
  const { showSuccess, showError, showConfirm } = useNotification();
  
  const [search, setSearch] = useState('');
  const [formFilter, setFormFilter] = useState(initialFormFilter);
  const [statusFilter, setStatusFilter] = useState('all');
  const [biwFilter, setBiwFilter] = useState('all');
  const [dispatchFilter, setDispatchFilter] = useState('all');
  const [datePreset, setDatePreset] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const itemsPerPage = 50;

  // Keep in sync if initialFormFilter prop changes
  useEffect(() => {
    if (initialFormFilter && initialFormFilter !== 'all') {
      setFormFilter(initialFormFilter);
    }
  }, [initialFormFilter]);

  const formsMap = useMemo(() => {
    const map: Record<string, string> = {};
    formOptions.forEach(f => {
      if (f.id) map[String(f.id)] = f.title;
      if (f._id) map[String(f._id)] = f.title;
    });
    return map;
  }, [formOptions]);

  const formatDateYMD = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handlePresetChange = (preset: string) => {
    setDatePreset(preset);
    const today = new Date();
    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'today') {
      const s = formatDateYMD(today);
      setStartDate(s);
      setEndDate(s);
    } else if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const s = formatDateYMD(y);
      setStartDate(s);
      setEndDate(s);
    } else if (preset === '7d') {
      const past = new Date();
      past.setDate(past.getDate() - 7);
      setStartDate(formatDateYMD(past));
      setEndDate(formatDateYMD(today));
    } else if (preset === '30d') {
      const past = new Date();
      past.setDate(past.getDate() - 30);
      setStartDate(formatDateYMD(past));
      setEndDate(formatDateYMD(today));
    } else if (preset === 'thisMonth') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(formatDateYMD(firstDay));
      setEndDate(formatDateYMD(today));
    }
  };

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    setDatePreset('custom');
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    setDatePreset('custom');
  };

  const handleDelete = (id: string) => {
    showConfirm(
      'Are you sure you want to delete this response?',
      async () => {
        try {
          await apiClient.deleteResponse(id);
          showSuccess('Response deleted. Please refresh the dashboard.');
        } catch (err) {
          console.error(err);
          showError('Failed to delete response');
        }
      },
      'Delete Response',
      'Delete',
      'Cancel'
    );
  };

  const getChassisNumber = (r: any) => {
    if (r.chassisNumber && r.chassisNumber !== 'N/A') return String(r.chassisNumber);
    if (!r.answers) return 'N/A';
    const ans = r.answers;
    if (ans.chassis_number) {
      const c = ans.chassis_number;
      if (typeof c === 'object') return c.chassisNumber || c.v || c.status || 'N/A';
      return String(c);
    }
    if (ans.chassis) {
      const c = ans.chassis;
      if (typeof c === 'object') return c.chassisNumber || c.v || 'N/A';
      return String(c);
    }
    if (ans.id_number) {
      const c = ans.id_number;
      if (typeof c === 'object') return c.chassisNumber || c.v || 'N/A';
      return String(c);
    }
    for (const key in ans) {
      const k = key.toLowerCase();
      if (k === 'chassis' || k.includes('chassis') || k.includes('id number') || k.includes('vin')) {
        const c = ans[key];
        if (typeof c === 'object') return c.chassisNumber || c.v || c.status || 'N/A';
        return String(c);
      }
    }
    return 'N/A';
  };

  const getChassisVin = (r: any) => {
    if (r.chassisVin && r.chassisVin !== 'N/A' && r.chassisVin !== '-') return String(r.chassisVin);
    if (r.partDescription && r.partDescription !== 'N/A' && r.partDescription !== '-') return String(r.partDescription);
    if (!r.answers) return '-';
    const ans = r.answers;
    if (ans.dealerName) return String(ans.dealerName);
    if (ans.chassis && typeof ans.chassis === 'object' && ans.chassis.partDescription) return String(ans.chassis.partDescription);
    if (ans.part_description) return String(ans.part_description);
    if (ans['Chassis / VIN']) return String(ans['Chassis / VIN']);
    return '-';
  };

  const safeString = (val: any): string => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  const filteredResponses = useMemo(() => {
    return rawResponses.filter(r => {
      // 1. Form Filter
      if (formFilter !== 'all') {
        const rFormId = String(r.formId || r.questionId || '');
        const rFormTitle = r.formTitle || formsMap[rFormId];
        const selectedForm = formOptions.find(f => f.id === formFilter || f._id === formFilter);
        const selectedTitle = selectedForm?.title;

        const matchesId = rFormId === formFilter;
        const matchesTitle = selectedTitle && (rFormTitle === selectedTitle || formsMap[rFormId] === selectedTitle);
        if (!matchesId && !matchesTitle) return false;
      }

      // 2. Status Filter
      if (statusFilter !== 'all') {
        const s = (r.status || '').toLowerCase();
        if (s !== statusFilter.toLowerCase()) return false;
      }

      // 3. BIW Review Filter
      if (biwFilter !== 'all') {
        const b = (r.biwReviewStatus || r.biwReview?.status || 'Pending').toLowerCase();
        if (b !== biwFilter.toLowerCase()) return false;
      }

      // 4. Dispatch Filter
      if (dispatchFilter !== 'all') {
        if (dispatchFilter === 'dispatched' && !r.isDispatched) return false;
        if (dispatchFilter === 'pending' && r.isDispatched) return false;
      }

      // 5. Calendar / Date Range Filter
      if (startDate || endDate) {
        const rDateVal = r.createdAt || r.date;
        if (!rDateVal) return false;
        const rDate = new Date(rDateVal);
        if (isNaN(rDate.getTime())) return false;

        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (rDate < start) return false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (rDate > end) return false;
        }
      }

      // 6. Search Text Filter
      if (search) {
        const s = search.toLowerCase();
        const submitter = safeString(r.submittedBy).toLowerCase();
        const chassis = safeString(getChassisNumber(r)).toLowerCase();
        const chassisVinVal = safeString(getChassisVin(r)).toLowerCase();
        const title = safeString(r.formTitle || formsMap[r.formId || ''] || formsMap[r.questionId || '']).toLowerCase();
        if (!submitter.includes(s) && !chassis.includes(s) && !chassisVinVal.includes(s) && !title.includes(s)) return false;
      }

      return true;
    });
  }, [rawResponses, formFilter, statusFilter, biwFilter, dispatchFilter, startDate, endDate, search, formsMap, formOptions]);

  // Reset to first page when any filter changes
  useEffect(() => {
    setPage(1);
  }, [search, formFilter, statusFilter, biwFilter, dispatchFilter, startDate, endDate]);

  const hasActiveFilters = formFilter !== 'all' || 
    statusFilter !== 'all' || 
    biwFilter !== 'all' || 
    dispatchFilter !== 'all' || 
    search.trim() !== '' || 
    Boolean(startDate) || 
    Boolean(endDate);

  const handleResetFilters = () => {
    setSearch('');
    setFormFilter('all');
    setStatusFilter('all');
    setBiwFilter('all');
    setDispatchFilter('all');
    setDatePreset('all');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const totalPages = Math.ceil(filteredResponses.length / itemsPerPage);
  const paginatedResponses = filteredResponses.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header Actions & Filters */}
      <div className="p-4 border-b border-gray-200 bg-gray-50/70 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search chassis, submitter, form..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full bg-white shadow-xs"
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Counts & Reset */}
          <div className="flex items-center gap-3">
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-lg transition-colors shadow-xs"
                title="Reset all active filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Filters
              </button>
            )}
            <div className="text-xs text-gray-600 font-semibold flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-xs">
              <Filter className="w-3.5 h-3.5 text-blue-600" />
              <span>Showing <strong className="text-gray-900">{filteredResponses.length}</strong> of {rawResponses.length} Responses</span>
            </div>
          </div>
        </div>

        {/* Filter Dropdowns & Calendar Row */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          {/* 1. Form Filter Dropdown */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Form:</label>
            <select
              value={formFilter}
              onChange={e => setFormFilter(e.target.value)}
              className={`px-3 py-1.5 text-xs font-medium border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white transition-all max-w-[230px] truncate shadow-xs ${formFilter !== 'all' ? 'border-blue-500 text-blue-700 bg-blue-50/50 font-bold' : 'border-gray-300 text-gray-700'}`}
            >
              <option value="all">All Forms ({formOptions.length})</option>
              {formOptions.map(f => (
                <option key={f.id || f._id} value={f.id || f._id}>
                  {f.title} {f.totalChecked !== undefined ? `(${f.totalChecked})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Status Filter Dropdown */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Status:</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className={`px-3 py-1.5 text-xs font-medium border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white transition-all shadow-xs ${statusFilter !== 'all' ? 'border-blue-500 text-blue-700 bg-blue-50/50 font-bold' : 'border-gray-300 text-gray-700'}`}
            >
              <option value="all">All Statuses</option>
              <option value="Direct Ok">Direct Ok</option>
              <option value="Rework 1">Rework 1</option>
              <option value="Rework Accepted">Rework Accepted</option>
              <option value="Accepted">Accepted</option>
              <option value="Rejected">Rejected</option>
              <option value="Pending Review">Pending Review</option>
            </select>
          </div>

          {/* 3. BIW Review Filter Dropdown */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">BIW:</label>
            <select
              value={biwFilter}
              onChange={e => setBiwFilter(e.target.value)}
              className={`px-3 py-1.5 text-xs font-medium border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white transition-all shadow-xs ${biwFilter !== 'all' ? 'border-blue-500 text-blue-700 bg-blue-50/50 font-bold' : 'border-gray-300 text-gray-700'}`}
            >
              <option value="all">All BIW Reviews</option>
              <option value="Accepted">Accepted</option>
              <option value="Rejected">Rejected</option>
              <option value="Reworked">Reworked</option>
              <option value="Pending">Pending</option>
            </select>
          </div>

          {/* 4. Dispatch Filter Dropdown */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Dispatch:</label>
            <select
              value={dispatchFilter}
              onChange={e => setDispatchFilter(e.target.value)}
              className={`px-3 py-1.5 text-xs font-medium border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white transition-all shadow-xs ${dispatchFilter !== 'all' ? 'border-blue-500 text-blue-700 bg-blue-50/50 font-bold' : 'border-gray-300 text-gray-700'}`}
            >
              <option value="all">All Dispatch</option>
              <option value="dispatched">Dispatched</option>
              <option value="pending">Not Dispatched</option>
            </select>
          </div>

          {/* 5. Calendar Range Filter */}
          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-gray-300 shadow-xs">
            <Calendar className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Date:</label>
            <select
              value={datePreset}
              onChange={e => handlePresetChange(e.target.value)}
              className="text-xs font-medium text-gray-700 bg-transparent outline-none cursor-pointer pr-1"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="thisMonth">This Month</option>
              <option value="custom">Custom Range</option>
            </select>

            <div className="flex items-center gap-1 pl-1.5 border-l border-gray-200">
              <input
                type="date"
                value={startDate}
                onChange={e => handleStartDateChange(e.target.value)}
                className="text-xs border border-gray-200 rounded px-1.5 py-0.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-gray-50/50"
                title="Start Date"
              />
              <span className="text-xs text-gray-400 font-medium">to</span>
              <input
                type="date"
                value={endDate}
                onChange={e => handleEndDateChange(e.target.value)}
                className="text-xs border border-gray-200 rounded px-1.5 py-0.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-gray-50/50"
                title="End Date"
              />
              {(startDate || endDate) && (
                <button
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                    setDatePreset('all');
                  }}
                  className="p-0.5 text-gray-400 hover:text-red-500 rounded"
                  title="Clear calendar filter"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-gray-50/90 backdrop-blur-md sticky top-0 z-10 text-gray-600 uppercase text-[11px] font-bold tracking-wider">
            <tr>
              <th className="px-4 py-3 border-b border-gray-200 bg-gray-100">Actions</th>
              <th className="px-4 py-3 border-b border-gray-200 bg-gray-100">Dispatch</th>
              <th className="px-4 py-3 border-b border-gray-200 bg-gray-100">Form Name</th>
              <th className="px-4 py-3 border-b border-gray-200 bg-gray-100">Chassis Number</th>
              <th className="px-4 py-3 border-b border-gray-200 bg-gray-100">Chassis / VIN</th>
              <th className="px-4 py-3 border-b border-gray-200 bg-gray-100">Submitted By</th>
              <th className="px-4 py-3 border-b border-gray-200 bg-gray-100">Status</th>
              <th className="px-4 py-3 border-b border-gray-200 bg-gray-100">BIW Review</th>
              <th className="px-4 py-3 border-b border-gray-200 bg-gray-100">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedResponses.map(r => {
              const rId = r.id || r._id!;
              const formTitle = r.formTitle || formsMap[r.formId || ''] || formsMap[r.questionId || ''] || 'Unknown Form';
              const targetForm = formOptions.find(f => f.title === formTitle || f.id === r.formId || f._id === r.formId);
              const formFilterValue = targetForm ? (targetForm.id || targetForm._id) : (r.formId || r.questionId);
              const chNum = getChassisNumber(r);
              const chVin = getChassisVin(r);
              return (
                <tr key={rId} className="hover:bg-indigo-50/50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/responses/${rId}`)}
                        className="p-1.5 text-blue-600 hover:bg-blue-100 rounded"
                        title="View"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => navigate(`/responses/${rId}/edit-form`)}
                        className="p-1.5 text-amber-600 hover:bg-amber-100 rounded"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(rId)}
                        className="p-1.5 text-red-600 hover:bg-red-100 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {r.isDispatched ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                        Dispatched
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
                        -
                      </span>
                    )}
                  </td>
                  <td 
                    className="px-4 py-3 font-medium text-gray-900 max-w-[220px] truncate cursor-pointer hover:text-blue-600 transition-colors" 
                    title={`${formTitle} (Click to filter by this form)`}
                    onClick={() => {
                      if (formFilterValue) {
                        setFormFilter(f => f === formFilterValue ? 'all' : formFilterValue);
                      }
                    }}
                  >
                    <span className="hover:underline">{formTitle}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                      {safeString(chNum)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-indigo-700 whitespace-nowrap">
                    {safeString(chVin)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                    {safeString(r.submittedBy) || 'Unknown'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                      r.status === 'Accepted' || r.status === 'Direct Ok' ? 'bg-green-50 text-green-700 border-green-200' :
                      r.status === 'Rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                      r.status === 'Rework 1' || r.status === 'Rework Accepted' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                      'bg-gray-50 text-gray-700 border-gray-200'
                    }`}>
                      {safeString(r.status) || 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {r.biwReviewStatus ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                        r.biwReviewStatus === 'Accepted' ? 'bg-green-50 text-green-700 border-green-200' :
                        r.biwReviewStatus === 'Rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                        'bg-yellow-50 text-yellow-700 border-yellow-200'
                      }`}>
                        {safeString(r.biwReviewStatus)}
                      </span>
                    ) : (
                      <span className="text-gray-400 italic text-xs">No review yet</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                    {new Date(r.date).toLocaleString()}
                  </td>
                </tr>
              );
            })}
            
            {filteredResponses.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                  <AlertTriangle className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                  <p className="text-base font-medium">No responses found</p>
                  <p className="text-sm mt-1">Adjust your filters or search query.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-gray-200 bg-white flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Showing <span className="font-medium text-gray-900">{(page - 1) * itemsPerPage + 1}</span> to <span className="font-medium text-gray-900">{Math.min(page * itemsPerPage, filteredResponses.length)}</span> of <span className="font-medium text-gray-900">{filteredResponses.length}</span> results
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <div className="text-sm text-gray-600 px-2">
              Page {page} of {totalPages}
            </div>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
