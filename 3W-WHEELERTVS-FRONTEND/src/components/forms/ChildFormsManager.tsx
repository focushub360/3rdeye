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
  Search,
  Building2,
  Users,
  CheckCircle2,
  ShieldCheck,
  Loader2,
  Filter,
  AlertCircle,
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
  onTenantsChange?: (tenants: string[], isChildFormAssignment?: boolean) => void;
}

export default function ChildFormsManager({
  parentFormId,
  parentFormTitle = "Form",
  parentFormTenantId,
  onUpdate,
  onTenantsChange,
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
  const [errorMessage, setErrorMessage] = useState("");
  const [isExpanded, setIsExpanded] = useState(true);
  const [tenantSearch, setTenantSearch] = useState("");
  const [tenantFilter, setTenantFilter] = useState<"all" | "selected" | "unselected">("all");

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

      // Fetch follow-up forms' sharedWithTenants
      try {
        const formData = await apiClient.getFormById(parentFormId);
        const form = formData.form || formData;
        setParentFullForm(form);

        let shared: string[] = [];
        const loadedChildren = childData.childForms || [];
        if (loadedChildren.length > 0) {
          const firstChild = loadedChildren[0];
          if (Array.isArray(firstChild.sharedWithTenants) && firstChild.sharedWithTenants.length > 0) {
            shared = firstChild.sharedWithTenants.map((t: any) =>
              typeof t === 'string' ? t : t._id || t.toString()
            );
          } else {
            const firstId = firstChild.id || firstChild._id;
            if (firstId) {
              const childRes = await apiClient.getFormById(firstId);
              const cForm = childRes.form || childRes;
              shared = (cForm.sharedWithTenants || []).map((t: any) =>
                typeof t === 'string' ? t : t._id || t.toString()
              );
            }
          }
        } else {
          // If no child forms exist, read current form's sharedWithTenants
          shared = (form.sharedWithTenants || []).map((t: any) =>
            typeof t === 'string' ? t : t._id || t.toString()
          );
        }
        setAssignedTenants(shared);
        setSelectedTenants(shared);
        onTenantsChange?.(shared, loadedChildren.length > 0);
      } catch (err) {
        console.error("Failed to fetch follow-up form tenant details:", err);
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
        chassisTenantAssignments: [],
        sharedWithTenants: selectedTenants,
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
      setErrorMessage("");

      const currentChildForms = childForms || [];
      const updatePromises: Promise<any>[] = [];

      if (currentChildForms.length > 0) {
        // 1. Assign selected tenants in parallel to every follow-up form connected to this parent
        for (const cf of currentChildForms) {
          const cfId = cf.id || cf._id || (cf as any).formId;
          if (cfId) {
            updatePromises.push(
              apiClient.updateForm(cfId, {
                sharedWithTenants: selectedTenants,
              }).catch((cfErr) => {
                console.warn(`Non-blocking: could not update follow-up form ${cfId}:`, cfErr);
              })
            );
          }
        }

        // 2. Ensure parent form does not retain partner tenants so ONLY follow-up is visible to partner
        if (parentFullForm && Array.isArray(parentFullForm.sharedWithTenants) && parentFullForm.sharedWithTenants.length > 0) {
          const sanitizedParentSharing = parentFullForm.sharedWithTenants
            .map((t: any) => typeof t === "string" ? t : (t?._id || t?.id || String(t)))
            .filter((tId: string) => !selectedTenants.includes(tId));

          if (sanitizedParentSharing.length !== parentFullForm.sharedWithTenants.length) {
            updatePromises.push(
              apiClient.updateForm(parentFormId, {
                sharedWithTenants: sanitizedParentSharing,
              }).catch((pErr) => {
                console.warn("Non-blocking parent sanitize warning:", pErr);
              })
            );
          }
        }
      } else {
        // 3. If no follow-up forms exist, assign selected tenants to this standalone form directly
        updatePromises.push(
          apiClient.updateForm(parentFormId, {
            sharedWithTenants: selectedTenants,
          })
        );
      }

      await Promise.all(updatePromises);

      setAssignedTenants([...selectedTenants]);
      onTenantsChange?.(selectedTenants, currentChildForms.length > 0);
      setSuccessMessage("Assigned successfully!");
      setTimeout(() => setSuccessMessage(""), 4000);
      onUpdate?.();
    } catch (error: any) {
      console.error("Assign error:", error);
      setErrorMessage(error?.message || "Failed to update tenant assignment. Please retry.");
      setTimeout(() => setErrorMessage(""), 5000);
    } finally {
      setSaving(false);
    }
  };

  const toggleTenantCheckbox = (tenantId: string) => {
    setSelectedTenants((prev) => {
      const next = prev.includes(tenantId)
        ? prev.filter((id) => id !== tenantId)
        : [...prev, tenantId];
      onTenantsChange?.(next, (childForms || []).length > 0);
      return next;
    });
  };

  const handleSelectAll = () => {
    const allIds = tenants.map((t) => t._id);
    setSelectedTenants(allIds);
    onTenantsChange?.(allIds, (childForms || []).length > 0);
  };

  const handleClearAll = () => {
    setSelectedTenants([]);
    onTenantsChange?.([], (childForms || []).length > 0);
  };

  const hasUnsavedChanges =
    JSON.stringify([...selectedTenants].sort()) !==
    JSON.stringify([...assignedTenants].sort());

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
                          className={`text-xs px-2 py-1 rounded-full ${form.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                            }`}
                        >
                          {form.isActive ? "Active" : "Inactive"}
                        </span>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${form.isVisible
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

          {/* Enhanced Fast & Neat Tenant Assignment Section */}
          <div className="bg-white dark:bg-gray-850 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-xs overflow-hidden mb-6 transition-all">
            {/* Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-gray-50 via-white to-gray-50 dark:from-gray-800 dark:via-gray-850 dark:to-gray-800 border-b border-gray-200/80 dark:border-gray-700/80 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold shadow-2xs">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                      Assign to Tenants
                    </h4>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60">
                      {assignedTenants.length} Assigned
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Authorize external partner organizations (e.g. Saify, Sreedevi) to inspect and submit follow-up records.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {errorMessage && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-2 py-1 rounded-md border border-red-200 dark:border-red-800 animate-fade-in">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errorMessage}
                  </span>
                )}
                {successMessage && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded-md border border-emerald-200 dark:border-emerald-800 animate-fade-in">
                    <Check className="w-3.5 h-3.5" />
                    {successMessage}
                  </span>
                )}
                {hasUnsavedChanges && !successMessage && !errorMessage && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded-md border border-amber-200 dark:border-amber-800">
                    ● Unsaved changes
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleAssignTenants}
                  disabled={saving}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white rounded-xl font-semibold text-xs inline-flex items-center gap-1.5 shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-wait cursor-pointer active:scale-95"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Assignment</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Controls & Search */}
            <div className="p-5">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-3.5">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={tenantSearch}
                    onChange={(e) => setTenantSearch(e.target.value)}
                    placeholder="Quick search by organization or tenant name..."
                    className="w-full text-xs pl-8 pr-8 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
                  />
                  {tenantSearch && (
                    <button
                      type="button"
                      onClick={() => setTenantSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Filter Pills & Quick Actions */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg border border-gray-200 dark:border-gray-700">
                    <button
                      type="button"
                      onClick={() => setTenantFilter("all")}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${tenantFilter === "all"
                        ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-2xs"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
                        }`}
                    >
                      All ({tenants.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTenantFilter("selected")}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${tenantFilter === "selected"
                        ? "bg-white dark:bg-gray-700 text-purple-700 dark:text-purple-300 shadow-2xs"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
                        }`}
                    >
                      Selected ({selectedTenants.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTenantFilter("unselected")}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${tenantFilter === "unselected"
                        ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-2xs"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
                        }`}
                    >
                      Available ({Math.max(0, tenants.length - selectedTenants.length)})
                    </button>
                  </div>

                  <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-0.5" />

                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="px-2.5 py-1 text-[11px] font-medium text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-lg transition-colors cursor-pointer"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="px-2.5 py-1 text-[11px] font-medium text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Selected Tenants Tags */}
              {selectedTenants.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap mb-3.5 p-2.5 rounded-xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 ml-1 mr-0.5">
                    Selected ({selectedTenants.length}):
                  </span>
                  {selectedTenants.map((tId) => {
                    const tenantObj = tenants.find((t) => t._id === tId);
                    const label = tenantObj?.companyName || tenantObj?.name || tId;
                    return (
                      <span
                        key={tId}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-white dark:bg-gray-800 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shadow-2xs group"
                      >
                        <span>{label}</span>
                        <button
                          type="button"
                          onClick={() => toggleTenantCheckbox(tId)}
                          className="text-purple-400 hover:text-purple-700 dark:hover:text-purple-200 transition-colors cursor-pointer ml-0.5"
                          title={`Remove ${label}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Responsive Tenant Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto p-1 pr-1.5 custom-scrollbar">
                {tenants
                  .filter((tenant) => {
                    const term = tenantSearch.toLowerCase().trim();
                    const name = (tenant.name || "").toLowerCase();
                    const comp = (tenant.companyName || "").toLowerCase();
                    const matchesSearch = !term || name.includes(term) || comp.includes(term);
                    if (!matchesSearch) return false;

                    const isChecked = selectedTenants.includes(tenant._id);
                    if (tenantFilter === "selected") return isChecked;
                    if (tenantFilter === "unselected") return !isChecked;
                    return true;
                  })
                  .map((tenant) => {
                    const isChecked = selectedTenants.includes(tenant._id);
                    const isOwner = parentFormTenantId && tenant._id === parentFormTenantId;
                    const isCurrentlyAssigned = assignedTenants.includes(tenant._id);

                    return (
                      <div
                        key={tenant._id}
                        onClick={() => toggleTenantCheckbox(tenant._id)}
                        className={`group relative flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none ${isChecked
                          ? "bg-purple-50/70 dark:bg-purple-950/30 border-purple-400 dark:border-purple-600 shadow-2xs ring-1 ring-purple-400/30"
                          : "bg-white dark:bg-gray-800/80 border-gray-200 dark:border-gray-700 hover:border-purple-200 dark:hover:border-purple-800 hover:bg-gray-50/60"
                          }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors border shrink-0 ${isChecked
                              ? "bg-purple-600 border-purple-600 text-white"
                              : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-transparent group-hover:border-purple-400"
                              }`}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">
                              {tenant.companyName || tenant.name}
                            </p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                              {tenant.slug || tenant.name || "Organization"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          {isOwner && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-md uppercase tracking-wider">
                              Owner
                            </span>
                          )}
                          {isCurrentlyAssigned && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-md uppercase tracking-wider inline-flex items-center gap-0.5">
                              <Check className="w-2.5 h-2.5" />
                              Live
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                {tenants.length === 0 && (
                  <div className="col-span-full py-8 text-center text-xs text-gray-500 dark:text-gray-400">
                    No tenants available in the system
                  </div>
                )}
              </div>

              {/* Footer status bar */}
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <p className="text-xs text-gray-500 font-medium">
                    <strong className="text-gray-800 dark:text-gray-200">{selectedTenants.length}</strong> of {tenants.length} organizations selected
                  </p>
                  {errorMessage && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded-md border border-red-200 dark:border-red-800 animate-fade-in">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {errorMessage}
                    </span>
                  )}
                  {successMessage && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800 animate-fade-in">
                      <Check className="w-3.5 h-3.5" />
                      {successMessage}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleAssignTenants}
                  disabled={saving}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-xs inline-flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 disabled:cursor-wait cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3 h-3" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
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
                className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${modalTab === "create"
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
                className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${modalTab === "link"
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
                        className={`px-3 py-2 rounded-lg text-xs font-medium text-left border transition-all cursor-pointer ${selectedPresetFormat === "standard"
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
                        className={`px-3 py-2 rounded-lg text-xs font-medium text-left border transition-all cursor-pointer ${selectedPresetFormat === "xFormat"
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
                        className={`px-3 py-2 rounded-lg text-xs font-medium text-left border transition-all cursor-pointer ${selectedPresetFormat === "ordinal"
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
                        className={`px-3 py-2 rounded-lg text-xs font-medium text-left border transition-all cursor-pointer ${selectedPresetFormat === "child"
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
                        className={`flex items-start p-3 rounded-xl border cursor-pointer transition-all ${followUpSource === "parent"
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
                        className={`flex items-start p-3 rounded-xl border cursor-pointer transition-all ${followUpSource === "empty"
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
