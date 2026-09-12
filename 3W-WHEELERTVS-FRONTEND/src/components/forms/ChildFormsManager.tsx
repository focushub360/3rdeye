import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  X,
  Link,
  Unlink,
  ChevronDown,
  ChevronUp,
  Check,
  Plus,
  Sparkles,
  GitBranch,
  Edit2,
  Link2,
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
  const [modalTab, setModalTab] = useState<"create" | "link">("create");
  
  const [selectedFormId, setSelectedFormId] = useState("");
  const [assignedTenants, setAssignedTenants] = useState<string[]>([]);
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [isExpanded, setIsExpanded] = useState(true);

  // Follow-up creation state
  const [followUpTitle, setFollowUpTitle] = useState("");
  const [followUpDescription, setFollowUpDescription] = useState("");
  const [followUpSource, setFollowUpSource] = useState<"parent" | "empty">("parent");
  const [sequenceNumber, setSequenceNumber] = useState(1);
  const [selectedPresetFormat, setSelectedPresetFormat] = useState<"standard" | "xFormat" | "ordinal" | "child" | "custom">("standard");
  const [isCreating, setIsCreating] = useState(false);
  const [parentFullForm, setParentFullForm] = useState<any>(null);

  const getOrdinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  // Strip existing " - Follow up N" suffixes to get the base title
  const getBaseTitle = (title: string) => {
    return (title || "")
      .replace(/(\s*-\s*Follow\s*up\s*(?:x\d+|\d+))+$/i, "")
      .replace(/(\s*-\s*\d+(?:st|nd|rd|th)\s*Follow-?up)+$/i, "")
      .replace(/(\s*-\s*Child\s*Follow\s*up\s*\d+)+$/i, "")
      .trim();
  };

  const getPresetTitle = (presetType: "standard" | "xFormat" | "ordinal" | "child", seq: number) => {
    const base = getBaseTitle(parentFormTitle || "Form");
    switch (presetType) {
      case "standard":
        return `${base} - Follow up ${seq}`;
      case "xFormat":
        return `${base} - Follow up x${seq}`;
      case "ordinal":
        return `${base} - ${getOrdinal(seq)} Follow-up`;
      case "child":
        return `${base} - Child Follow-up ${seq}`;
      default:
        return `${base} - Follow up ${seq}`;
    }
  };

  const handleApplyPreset = (presetType: "standard" | "xFormat" | "ordinal" | "child", seq?: number) => {
    const num = seq !== undefined ? seq : sequenceNumber;
    setSelectedPresetFormat(presetType);
    setFollowUpTitle(getPresetTitle(presetType, num));
  };

  const handleSequenceChange = (newSeq: number) => {
    if (newSeq < 1) return;
    setSequenceNumber(newSeq);
    if (selectedPresetFormat !== "custom") {
      setFollowUpTitle(getPresetTitle(selectedPresetFormat, newSeq));
    }
  };

  const openAddFollowUpModal = () => {
    const nextSeq = childForms.length + 1;
    setSequenceNumber(nextSeq);
    setSelectedPresetFormat("standard");
    const base = getBaseTitle(parentFormTitle || "Form");
    setFollowUpTitle(`${base} - Follow up ${nextSeq}`);
    setFollowUpDescription(`Follow-up form for ${parentFormTitle || base}`);
    setFollowUpSource("parent");
    setModalTab("create");
    setSelectedFormId("");
    setShowAddModal(true);
  };

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
        setParentFullForm(form);
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

  const handleCreateFollowUp = async (openEditor: boolean = false) => {
    if (!followUpTitle.trim()) return;
    try {
      setIsCreating(true);
      let sections = [];
      if (followUpSource === "parent" && parentFullForm?.sections?.length > 0) {
        sections = parentFullForm.sections.map((sec: any, sIdx: number) => ({
          ...sec,
          id: crypto.randomUUID(),
          questions: (sec.questions || []).map((q: any, qIdx: number) => {
            if (sIdx === 0 && qIdx === 0) {
              return {
                ...q,
                id: crypto.randomUUID(),
                text: q.text && q.text.toLowerCase().includes("chassis") ? q.text : "Chassis Number",
                trackResponseQuestion: true,
                trackResponseRank: true,
                trackResponseRankLabel: "Chassis Number",
                trackResponseQuestionLabel: "Chassis Number",
                placeholder: "Enter Chassis Number / VIN...",
              };
            }
            return {
              ...q,
              id: crypto.randomUUID(),
            };
          }),
        }));
      } else {
        sections = [
          {
            id: crypto.randomUUID(),
            title: "Chassis Details",
            description: "Chassis identification and tracking",
            questions: [
              {
                id: crypto.randomUUID(),
                text: "Chassis Number",
                type: "text",
                required: true,
                trackResponseQuestion: true,
                trackResponseRank: true,
                trackResponseRankLabel: "Chassis Number",
                trackResponseQuestionLabel: "Chassis Number",
                placeholder: "Enter Chassis Number / VIN...",
              },
            ],
          },
        ];
      }

      const payload = {
        title: followUpTitle.trim(),
        description:
          followUpDescription.trim() || `Follow-up form for ${parentFormTitle}`,
        parentFormId,
        parentFormTitle,
        tenantId:
          parentFullForm?.tenantId?._id ||
          parentFullForm?.tenantId ||
          parentFormTenantId,
        isGlobal: Boolean(parentFullForm?.isGlobal),
        isVisible: true,
        sections,
        chassisNumbers: parentFullForm?.chassisNumbers || [],
        chassisTenantAssignments:
          parentFullForm?.chassisTenantAssignments || [],
        sharedWithTenants: parentFullForm?.sharedWithTenants || [],
      };

      const res = await apiClient.createForm(payload);
      const createdForm = (res as any).form || (res as any).data?.form || res;
      const newFormId = createdForm?._id || createdForm?.id;

      if (newFormId) {
        try {
          await apiClient.linkChildForm(parentFormId, newFormId);
        } catch (linkErr) {
          // Handled / auto-linked
        }
      }

      setShowAddModal(false);
      await fetchData();
      onUpdate?.();

      if (openEditor && newFormId) {
        navigate(`/forms/${newFormId}/edit`);
      }
    } catch (err: any) {
      alert(err.message || "Failed to create follow-up form");
    } finally {
      setIsCreating(false);
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
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100 dark:border-gray-800">
            <div>
              <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Connected Follow-up Sequence
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Forms executed sequentially in follow-up rounds
              </p>
            </div>
            <button
              type="button"
              onClick={openAddFollowUpModal}
              className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Follow-up Form</span>
            </button>
          </div>

          {/* Existing linked follow-up forms */}
          {childForms.length > 0 ? (
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
          ) : (
            <div className="text-center py-8 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg mb-6">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">No follow-up forms connected yet</p>
              <button
                type="button"
                onClick={openAddFollowUpModal}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Create Follow-up Form</span>
              </button>
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

      {/* Add / Link Follow-up Form Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-xl w-full border border-blue-100 dark:border-gray-800 shadow-2xl overflow-hidden animate-fadeIn">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-xl">
                  <GitBranch className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Add Follow-up Form</h3>
                  <p className="text-xs text-blue-100">
                    Target Form: <span className="font-semibold text-white">{parentFormTitle}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-800 px-6 pt-3 bg-gray-50/50 dark:bg-gray-900/50">
              <button
                type="button"
                onClick={() => setModalTab("create")}
                className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                  modalTab === "create"
                    ? "border-blue-600 text-blue-700 dark:text-blue-400"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <Sparkles className="w-4 h-4" />
                Create New Follow-up
              </button>
              <button
                type="button"
                onClick={() => setModalTab("link")}
                className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                  modalTab === "link"
                    ? "border-blue-600 text-blue-700 dark:text-blue-400"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <Link2 className="w-4 h-4" />
                Link Existing Form
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {modalTab === "create" ? (
                <>
                  {/* Sequence & Preset Selection */}
                  <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-900 dark:text-blue-200 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                        Follow-up Sequence & Preset Names
                      </span>
                      <div className="flex items-center space-x-1.5 bg-white dark:bg-gray-800 px-2 py-1 rounded-lg border border-blue-200 dark:border-blue-700 shadow-sm">
                        <span className="text-xs font-medium text-gray-500 mr-1">Seq:</span>
                        <button
                          type="button"
                          onClick={() => handleSequenceChange(sequenceNumber - 1)}
                          disabled={sequenceNumber <= 1}
                          className="w-5 h-5 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-bold disabled:opacity-40"
                        >
                          -
                        </button>
                        <span className="text-xs font-bold px-1.5 text-blue-700 dark:text-blue-300">
                          {sequenceNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSequenceChange(sequenceNumber + 1)}
                          className="w-5 h-5 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-bold"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Presets Chips */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleApplyPreset("standard")}
                        className={`px-3 py-2 rounded-lg text-xs font-medium text-left border transition-all cursor-pointer ${
                          selectedPresetFormat === "standard"
                            ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                            : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:border-blue-400"
                        }`}
                      >
                        <div className="text-[10px] opacity-75 font-semibold">Standard</div>
                        <div className="font-semibold truncate">Follow up {sequenceNumber}</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApplyPreset("xFormat")}
                        className={`px-3 py-2 rounded-lg text-xs font-medium text-left border transition-all cursor-pointer ${
                          selectedPresetFormat === "xFormat"
                            ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                            : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:border-blue-400"
                        }`}
                      >
                        <div className="text-[10px] opacity-75 font-semibold">x-Format</div>
                        <div className="font-semibold truncate">Follow up x{sequenceNumber}</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApplyPreset("ordinal")}
                        className={`px-3 py-2 rounded-lg text-xs font-medium text-left border transition-all cursor-pointer ${
                          selectedPresetFormat === "ordinal"
                            ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                            : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:border-blue-400"
                        }`}
                      >
                        <div className="text-[10px] opacity-75 font-semibold">Ordinal Format</div>
                        <div className="font-semibold truncate">{getOrdinal(sequenceNumber)} Follow-up</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApplyPreset("child")}
                        className={`px-3 py-2 rounded-lg text-xs font-medium text-left border transition-all cursor-pointer ${
                          selectedPresetFormat === "child"
                            ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                            : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:border-blue-400"
                        }`}
                      >
                        <div className="text-[10px] opacity-75 font-semibold">Child Format</div>
                        <div className="font-semibold truncate">Child Follow-up {sequenceNumber}</div>
                      </button>
                    </div>
                  </div>

                  {/* Title Input */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                      Follow-up Form Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={followUpTitle}
                      onChange={(e) => {
                        setFollowUpTitle(e.target.value);
                        setSelectedPresetFormat("custom");
                      }}
                      placeholder={`e.g. ${parentFormTitle} - Follow up 2`}
                      className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                  </div>

                  {/* Description Input */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                      Description (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={followUpDescription}
                      onChange={(e) => setFollowUpDescription(e.target.value)}
                      placeholder="Purpose of this follow-up form..."
                      className="w-full px-3.5 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>

                  {/* Template Source Option */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Questions & Template Source
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label
                        className={`flex items-start p-3 rounded-xl border cursor-pointer transition-all ${
                          followUpSource === "parent"
                            ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
                            : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                        }`}
                      >
                        <input
                          type="radio"
                          name="followUpSource"
                          value="parent"
                          checked={followUpSource === "parent"}
                          onChange={() => setFollowUpSource("parent")}
                          className="mt-0.5 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="ml-2.5">
                          <span className="text-xs font-semibold text-gray-900 dark:text-white block">
                            Copy from Parent
                          </span>
                          <span className="text-[11px] text-gray-500 dark:text-gray-400 block mt-0.5">
                            Duplicate {parentFullForm?.sections?.length || 0} sections & questions
                          </span>
                        </div>
                      </label>

                      <label
                        className={`flex items-start p-3 rounded-xl border cursor-pointer transition-all ${
                          followUpSource === "empty"
                            ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
                            : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                        }`}
                      >
                        <input
                          type="radio"
                          name="followUpSource"
                          value="empty"
                          checked={followUpSource === "empty"}
                          onChange={() => setFollowUpSource("empty")}
                          className="mt-0.5 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="ml-2.5">
                          <span className="text-xs font-semibold text-gray-900 dark:text-white block">
                            Start Blank
                          </span>
                          <span className="text-[11px] text-gray-500 dark:text-gray-400 block mt-0.5">
                            Fresh inspection questions
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>
                </>
              ) : (
                /* Link Existing Tab */
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Select Existing Form to Link as Follow-up
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
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>

              {modalTab === "create" ? (
                <>
                  <button
                    type="button"
                    disabled={isCreating || !followUpTitle.trim()}
                    onClick={() => handleCreateFollowUp(false)}
                    className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-blue-700 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-300 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isCreating ? (
                      <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    Quick Create & Link
                  </button>

                  <button
                    type="button"
                    disabled={isCreating || !followUpTitle.trim()}
                    onClick={() => handleCreateFollowUp(true)}
                    className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isCreating ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Edit2 className="w-3.5 h-3.5" />
                    )}
                    Create & Open Builder
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={!selectedFormId}
                  onClick={handleLinkForm}
                  className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-md hover:shadow-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  Link Form
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
