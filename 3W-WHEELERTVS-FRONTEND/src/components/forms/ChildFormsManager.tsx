import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  X,
  Link,
  Unlink,
  ChevronDown,
  ChevronUp,
  Check,
} from "lucide-react";
import { apiClient } from "../../api/client";

interface ChildForm {
  id: string;
  _id: string;
  title: string;
  description: string;
  isVisible: boolean;
  isActive: boolean;
  order: number;
}

interface ChildFormsManagerProps {
  parentFormId: string;
  parentFormTitle?: string;
  parentFormTenantId?: string;
  onUpdate?: () => void;
}

export default function ChildFormsManager({
  parentFormId,
  parentFormTitle = "Form",
  parentFormTenantId,
  onUpdate,
}: ChildFormsManagerProps) {
  const navigate = useNavigate();
  const [childForms, setChildForms] = useState<ChildForm[]>([]);
  const [availableForms, setAvailableForms] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  
  const [selectedFormId, setSelectedFormId] = useState("");
  const [assignedTenants, setAssignedTenants] = useState<string[]>([]);
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [isExpanded, setIsExpanded] = useState(true);

  // Strip existing " - Follow up N" suffixes to get the base title
  const getBaseTitle = (title: string) => {
    return title.replace(/(\s*-\s*Follow\s*up\s*\d+)+$/i, "").trim();
  };

  const baseTitle = getBaseTitle(parentFormTitle);

  useEffect(() => {
    fetchData();
  }, [parentFormId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch follow-up forms
      const childData = await apiClient.getChildForms(parentFormId);
      setChildForms(childData.childForms || []);

      // Fetch all available forms
      const allForms = await apiClient.getForms();
      // Filter out the parent form and already linked forms
      const linkedIds = (childData.childForms || []).map(
        (cf: ChildForm) => cf.id
      );
      const available = allForms.forms.filter(
        (f: any) => f.id !== parentFormId && !linkedIds.includes(f.id)
      );
      setAvailableForms(available);

      // Fetch current form's sharedWithTenants
      try {
        const formData = await apiClient.getFormById(parentFormId);
        const form = formData.form || formData;
        const shared = (form.sharedWithTenants || []).map((t: any) => 
          typeof t === 'string' ? t : t._id || t.toString()
        );
        setAssignedTenants(shared);
        setSelectedTenants(shared);
      } catch (err) {
        console.error("Failed to fetch form details:", err);
      }

      // Fetch tenants
      try {
        const tenantRes = await apiClient.getTenantsMinimal();
        setTenants(tenantRes.tenants || []);
      } catch (err) {
        console.error("Failed to fetch tenants:", err);
      }
    } catch (error) {
      console.error("Error fetching forms:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignTenants = async () => {
    try {
      setSaving(true);
      setSuccessMessage("");
      await apiClient.updateForm(parentFormId, {
        sharedWithTenants: selectedTenants,
      });
      setAssignedTenants([...selectedTenants]);
      setSuccessMessage("Assigned successfully!");
      setTimeout(() => setSuccessMessage(""), 3500);
      onUpdate?.();
    } catch (error: any) {
      alert(error.message || "Failed to update tenant assignment");
    } finally {
      setSaving(false);
    }
  };

  const toggleTenantCheckbox = (tenantId: string) => {
    setSelectedTenants((prev) =>
      prev.includes(tenantId)
        ? prev.filter((id) => id !== tenantId)
        : [...prev, tenantId]
    );
  };

  const handleLinkForm = async () => {
    if (!selectedFormId) return;

    try {
      await apiClient.linkChildForm(parentFormId, selectedFormId);
      setShowAddModal(false);
      setSelectedFormId("");
      await fetchData();
      onUpdate?.();
    } catch (error: any) {
      alert(error.message || "Failed to link follow-up form");
    }
  };

  const handleUnlinkForm = async (childFormId: string) => {
    if (!confirm("Are you sure you want to unlink this follow-up form?")) return;

    try {
      await apiClient.unlinkChildForm(parentFormId, childFormId);
      await fetchData();
      onUpdate?.();
    } catch (error: any) {
      alert(error.message || "Failed to unlink follow-up form");
    }
  };

  const handleReorder = async (index: number, direction: "up" | "down") => {
    const newForms = [...childForms];
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newForms.length) return;

    // Swap
    [newForms[index], newForms[targetIndex]] = [
      newForms[targetIndex],
      newForms[index],
    ];

    // Update order property
    newForms.forEach((form, i) => {
      form.order = i;
    });

    setChildForms(newForms);

    try {
      const formOrder = newForms.map((f) => f.id);
      await apiClient.reorderChildForms(parentFormId, formOrder);
      onUpdate?.();
    } catch (error: any) {
      alert(error.message || "Failed to reorder follow-up forms");
      fetchData(); // Revert on error
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-20 bg-gray-100 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow border-2 border-blue-200">
      <div
        className="p-6 border-b border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                Follow-up Forms ({childForms.length})
              </h3>
              <p className="text-sm text-blue-800 dark:text-blue-400 mt-1">
                Forms that will be shown to customers after completing this form
              </p>
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="p-6">
          {/* Existing linked follow-up forms */}
          {childForms.length > 0 && (
            <div className="space-y-3 mb-6">
              {childForms.map((form, index) => (
                <div
                  key={form.id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:border-gray-600 transition-colors"
                >
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="flex flex-col space-y-1">
                      <button
                        onClick={() => handleReorder(index, "up")}
                        disabled={index === 0}
                        className="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move up"
                      >
                        <ChevronUp className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      </button>
                      <button
                        onClick={() => handleReorder(index, "down")}
                        disabled={index === childForms.length - 1}
                        className="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move down"
                      >
                        <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      </button>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-500">
                          #{index + 1}
                        </span>
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">
                          {form.title}
                        </h4>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {form.description || "No description"}
                      </p>
                      <div className="flex items-center space-x-3 mt-2">
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            form.isActive
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {form.isActive ? "Active" : "Inactive"}
                        </span>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            form.isVisible
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {form.isVisible ? "Visible" : "Hidden"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleUnlinkForm(form.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Unlink follow-up form"
                  >
                    <Unlink className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Tenant Assignment */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 mb-4">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase">
              Assign to Tenants
            </label>
            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
              {tenants.map((tenant) => {
                const isChecked = selectedTenants.includes(tenant._id);
                const isOwner = parentFormTenantId && tenant._id === parentFormTenantId;
                const isCurrentlyAssigned = assignedTenants.includes(tenant._id);
                return (
                  <label
                    key={tenant._id}
                    className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleTenantCheckbox(tenant._id)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      {tenant.companyName || tenant.name}
                      {isOwner && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded uppercase tracking-wider">
                          Owner
                        </span>
                      )}
                      {isCurrentlyAssigned && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded uppercase tracking-wider">
                          Assigned
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
              {tenants.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">No tenants available</p>
              )}
            </div>
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-3">
                <p className="text-xs font-medium text-gray-500">
                  {selectedTenants.length} tenant{selectedTenants.length !== 1 ? 's' : ''} selected
                </p>
                {successMessage && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/40 px-2 py-0.5 rounded">
                    <Check className="w-3.5 h-3.5" />
                    {successMessage}
                  </span>
                )}
              </div>
              <button
                onClick={handleAssignTenants}
                disabled={saving}
                className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm inline-flex items-center shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-wait"
              >
                {saving ? "Assigning..." : "Assign"}
              </button>
            </div>
          </div>


        </div>
      )}

      {/* Link Existing Form Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4 border-b pb-4 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Link Existing Form
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase">
                Select Form
              </label>
              <select
                value={selectedFormId}
                onChange={(e) => setSelectedFormId(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-medium"
              >
                <option value="">-- Select a form to link --</option>
                {availableForms.map((form) => (
                  <option key={form.id} value={form.id}>
                    {form.title}
                  </option>
                ))}
              </select>
              {availableForms.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  No available forms to link. Create more forms first.
                </p>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t dark:border-gray-700">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-5 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleLinkForm}
                disabled={!selectedFormId}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-md hover:shadow-lg"
              >
                Link Form
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
