import React, { useState, useEffect } from 'react';
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
  Filter
} from 'lucide-react';

interface OverallResponsesTableProps {
  rawResponses?: any[];
  formOptions?: Array<{ id: string; title: string }>;
}

export const OverallResponsesTable: React.FC<OverallResponsesTableProps> = ({ rawResponses = [], formOptions = [] }) => {
  const navigate = useNavigate();
  const { showSuccess, showError, showConfirm } = useNotification();
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const itemsPerPage = 50;

  const formsMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    formOptions.forEach(f => {
      map[f.id] = f.title;
    });
    return map;
  }, [formOptions]);

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

  const getChassis = (r: Response) => {
    if (!r.answers) return 'N/A';
    if (r.answers.chassis_number) {
      const c = r.answers.chassis_number;
      if (typeof c === 'object') return c.chassisNumber || c.v || c.status || JSON.stringify(c);
      return String(c);
    }
    // Try to find any chassis like key
    for (const key in r.answers) {
      if (key.toLowerCase().includes('chassis') || key.toLowerCase().includes('vin')) {
        const c = r.answers[key];
        if (typeof c === 'object') return c.chassisNumber || c.v || c.status || JSON.stringify(c);
        return String(c);
      }
    }
    return 'N/A';
  };

  const safeString = (val: any): string => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  const filteredResponses = rawResponses.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    
    if (search) {
      const s = search.toLowerCase();
      const submitter = safeString(r.submittedBy).toLowerCase();
      const chassis = safeString(r.chassisNumber).toLowerCase();
      const title = safeString(formsMap[r.formId || '']).toLowerCase();
      if (!submitter.includes(s) && !chassis.includes(s) && !title.includes(s)) return false;
    }
    return true;
  });

  // Reset to first page when filters change
  React.useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const totalPages = Math.ceil(filteredResponses.length / itemsPerPage);
  const paginatedResponses = filteredResponses.slice((page - 1) * itemsPerPage, page * itemsPerPage);



  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header Actions */}
      <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/50">
        <div className="flex items-center gap-2 w-full max-w-2xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search chassis, submitter, form..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white min-w-[150px]"
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
        <div className="text-sm text-gray-500 font-medium flex items-center gap-2">
          <Filter className="w-4 h-4" />
          Showing {filteredResponses.length} Responses
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
              const formTitle = formsMap[r.formId || ''] || 'Unknown Form';
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
                  <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate" title={formTitle}>
                    {formTitle}
                  </td>
                  <td className="px-4 py-3 font-semibold text-indigo-700 whitespace-nowrap">
                    {safeString(r.chassisNumber)}
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
