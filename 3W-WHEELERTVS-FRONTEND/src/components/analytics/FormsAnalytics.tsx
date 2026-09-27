import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
  ChangeEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  Eye,
  Users,
  Calendar,
  Layers,
  ChevronRight,
  Trash2,
  Edit2,
  PlusCircle,
  Plus,
  GitBranch,
  Sparkles,
  Search,
  Copy,
  BarChart3,
  List,
  MoreVertical,
  Link2,
  Share2,
  Check,
  Upload,
  Download,
  MapPin,
  X,
  Save,
  ChevronDown,
  Folder,
  Layout,
  Split,
  History,
  LogIn,
  AlertCircle,
} from "lucide-react";
import ImportHistoryModal from "../history/ImportHistoryModal";
import { QualitySummaryModal } from "./QualitySummaryModal";
import { useForms, useResponses, useMutation } from "../../hooks/useApi";
import { apiClient } from "../../api/client";
import { useNotification } from "../../context/NotificationContext";
import {
  downloadFormImportTemplate,
  downloadNestedFormImportTemplate,
  parseFormWorkbook,
} from "../../utils/exportUtils";
import AnswerTemplateImport from "../AnswerTemplateImport";
import type { Question as FormQuestion } from "../../types";
import { Mail, MessageCircle, MessageSquare } from "lucide-react";
import EmailInviteModal from "../EmailInviteModal";
import WhatsAppInviteModal from "../WhatsAppInviteModal";
import SMSInviteModal from "../SMSInviteModal";
import ShareAnalyticsModal from "./ShareAnalyticsModal";
import AutoSendModal from "../forms/AutoSendModal";

import { useAuth } from "../../context/AuthContext";

// Add this interface for the dropdown options
interface TemplateOption {
  id: "flat" | "nested" | "linking" | "bulk-response";
  label: string;
  description: string;
}

interface FormItem {
  _id: string;
  id?: string;
  title: string;
  tenantId?: string;
  chassisTenantAssignments?: any[];
  description?: string;
  isVisible?: boolean;
  locationEnabled?: boolean;
  isActive?: boolean;
  viewType?: "section-wise" | "question-wise";
  sections?: any[];
  questions?: any[];
  createdAt?: string;
  createdBy?: any;
  responseCount?: number;
  parentFormId?: string | null;
  childForms?: Array<{
    formId: string;
    formTitle?: string;
    order?: number;
  }>;
}

interface ResponseData {
  responses: any[];
}

export default function FormsAnalytics() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // --- Permission Helpers ---
  const userPermissions = user?.permissions || [];
  const userRole = user?.role;
  
  const isAdminOrTenantAdmin =
    userRole === 'admin' ||
    userRole === 'superadmin' ||
    userRole === 'tenant_admin';

  // Check if user has a specific permission
  const hasPermission = (permissionId: string): boolean => {
    if (isAdminOrTenantAdmin) {
      return true;
    }
    return userPermissions.includes(permissionId);
  };

  // Check if user has any of the given permissions
  const hasAnyPermission = (permissionIds: string[]): boolean => {
    if (isAdminOrTenantAdmin) {
      return true;
    }
    return permissionIds.some(id => userPermissions.includes(id));
  };

  // Check if user has analytics form permission for a specific form
  const hasFormAnalyticsPermission = (formIdOrObj: string | FormItem, subType: string = 'response'): boolean => {
    if (isAdminOrTenantAdmin) {
      return true;
    }

    const idsToCheck: string[] = [];
    if (typeof formIdOrObj === 'string') {
      if (formIdOrObj) idsToCheck.push(formIdOrObj);
    } else if (formIdOrObj) {
      if (formIdOrObj._id) idsToCheck.push(formIdOrObj._id);
      if (formIdOrObj.id) idsToCheck.push(formIdOrObj.id);
    }

    // SPECIAL RULE: Preview is AVAILABLE BY DEFAULT for all users!
    if (subType === 'preview') {
      for (const fId of idsToCheck) {
        if (
          userPermissions.includes(`analytics:form:${fId}:no_preview`) ||
          userPermissions.includes(`analytics:form:${fId}:deny_preview`)
        ) {
          return false;
        }
      }
      return true; // Default available for all users!
    }

    if (subType === 'edit' && (
      userPermissions.includes('analytics:editForms') ||
      userPermissions.includes('analytics:manageForms') ||
      userPermissions.includes('analytics:manage') ||
      userPermissions.includes('analytics:edit') ||
      userPermissions.includes('analytics:*')
    )) {
      return true;
    }

    if (subType === 'duplicate' && (
      userPermissions.includes('analytics:duplicateForms') ||
      userPermissions.includes('analytics:manageForms') ||
      userPermissions.includes('analytics:manage') ||
      userPermissions.includes('analytics:duplicate') ||
      userPermissions.includes('analytics:*')
    )) {
      return true;
    }

    if (subType === 'delete' && (
      userPermissions.includes('analytics:deleteForms') ||
      userPermissions.includes('analytics:manageForms') ||
      userPermissions.includes('analytics:manage') ||
      userPermissions.includes('analytics:delete') ||
      userPermissions.includes('analytics:*')
    )) {
      return true;
    }

    if (userPermissions.includes('analytics:view') || userPermissions.includes('analytics:*')) {
      if (subType === 'edit' || subType === 'delete' || subType === 'duplicate') {
        if (userPermissions.includes('analytics:manage') || userPermissions.includes('analytics:manageForms') || userPermissions.includes('analytics:*')) {
          return true;
        }
      } else {
        return true;
      }
    }

    for (const fId of idsToCheck) {
      if (
        userPermissions.includes(`analytics:form:${fId}:${subType}`) ||
        (userPermissions.includes(`analytics:form:${fId}`) && subType !== 'delete')
      ) {
        return true;
      }
    }

    return false;
  };

  // Check if user can view a specific form
  const canViewForm = (formItem: FormItem | string): boolean => {
    if (!formItem) return false;
    if (isAdminOrTenantAdmin) {
      return true;
    }

    if (userPermissions.includes('analytics:view') || userPermissions.includes('analytics:*')) {
      return true;
    }

    const idsToCheck: string[] = [];
    if (typeof formItem === 'string') {
      idsToCheck.push(formItem);
    } else {
      if (formItem._id) idsToCheck.push(formItem._id);
      if (formItem.id) idsToCheck.push(formItem.id);
    }

    for (const fId of idsToCheck) {
      if (
        userPermissions.includes(`analytics:form:${fId}:no_preview`) ||
        userPermissions.includes(`analytics:form:${fId}:deny_preview`)
      ) {
        const subTypes = ['response', 'dashboard', 'overall', 'questions', 'sections', 'edit', 'duplicate', 'delete', 'uploads'];
        if (userPermissions.includes(`analytics:form:${fId}`)) return true;
        for (const subType of subTypes) {
          if (userPermissions.includes(`analytics:form:${fId}:${subType}`)) {
            return true;
          }
        }
        return false;
      }
    }

    // Default: all forms can be viewed/previewed by all users
    return true;
  };

  // Check if user has specific analytics global permissions
  const canDownloadTemplate = hasPermission('analytics:downloadTemplate');
  const canImportExcel = hasPermission('analytics:importExcel');
  const canCreateServiceForm = hasPermission('analytics:createService');
  const canGlobalManageForms = hasPermission('analytics:manageForms') || hasPermission('analytics:manage');
  const canGlobalEditForms = hasPermission('analytics:editForms') || hasPermission('analytics:edit') || canGlobalManageForms;
  const canGlobalDuplicateForms = hasPermission('analytics:duplicateForms') || hasPermission('analytics:duplicate') || canGlobalManageForms;
  const canGlobalDeleteForms = hasPermission('analytics:deleteForms') || hasPermission('analytics:delete') || canGlobalManageForms;
  const canViewDashboard = hasPermission('dashboard:view');
  const canViewOverall = hasPermission('Overall:view');

  // Role-based checks
  const isInspector = user?.role === "inspector";
  const canManage = 
    (user?.role === "admin" || 
     user?.role === "superadmin" || 
     user?.role === "subadmin" ||
     canGlobalManageForms) && 
    !isInspector;
  
  const canBulkSelectResponses = 
    user?.role === "superadmin" ||
    (user?.role === "admin" && user?.granularPermissions?.canBulkSelectResponses === true);
  
  // Check if user can edit/delete forms (admin or superadmin or granted global permissions)
  const canEdit = user?.role === "admin" || user?.role === "superadmin" || canGlobalEditForms;
  const canDelete = user?.role === "admin" || user?.role === "superadmin" || canGlobalDeleteForms;
  const canDuplicate = canEdit || canGlobalDuplicateForms;

  const { showSuccess, showError, showConfirm } = useNotification();
  const [searchTerm, setSearchTerm] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isAnswerTemplateOpen, setIsAnswerTemplateOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isQualitySummaryOpen, setIsQualitySummaryOpen] = useState(false);
  const [previewFormData, setPreviewFormData] = useState<FormQuestion | null>(
    null,
  );
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSavingForm, setIsSavingForm] = useState(false);
  // Add these states for template dropdown
  const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] =
    useState<TemplateOption | null>(null);

  const [actualResponseCounts, setActualResponseCounts] = useState<Record<string, number>>({});
  const [expandedChildFormIds, setExpandedChildFormIds] = useState<Record<string, boolean>>({});
  const [deletingFormId, setDeletingFormId] = useState<string | null>(null);

  // Add Follow-up Form Modal state
  const [addFollowUpModalOpen, setAddFollowUpModalOpen] = useState(false);
  const [targetParentForm, setTargetParentForm] = useState<any>(null);
  const [followUpTitle, setFollowUpTitle] = useState("");
  const [followUpDescription, setFollowUpDescription] = useState("");
  const [followUpSource, setFollowUpSource] = useState<"parent" | "empty">("parent");
  const [isCreatingFollowUp, setIsCreatingFollowUp] = useState(false);
  const [activeFollowUpTab, setActiveFollowUpTab] = useState<"create" | "link">("create");
  const [selectedExistingFormId, setSelectedExistingFormId] = useState("");
  const [targetChildrenCount, setTargetChildrenCount] = useState(0);
  const [followUpSequenceNumber, setFollowUpSequenceNumber] = useState(1);
  const [selectedPresetFormat, setSelectedPresetFormat] = useState<"standard" | "xFormat" | "ordinal" | "child" | "custom">("standard");

  const getBaseFormTitle = (title: string) => {
    return (title || "")
      .replace(/(\s*-\s*Follow\s*up\s*(?:x\d+|\d+))+$/i, "")
      .replace(/(\s*-\s*\d+(?:st|nd|rd|th)\s*Follow-?up)+$/i, "")
      .replace(/(\s*-\s*Child\s*Follow\s*up\s*\d+)+$/i, "")
      .trim();
  };

  const getOrdinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  const getPresetTitle = (
    presetType: "standard" | "xFormat" | "ordinal" | "child",
    seq: number,
    baseName?: string
  ) => {
    const base = baseName || getBaseFormTitle(targetParentForm?.title || "Form");
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
    const num = seq !== undefined ? seq : followUpSequenceNumber;
    setSelectedPresetFormat(presetType);
    const newTitle = getPresetTitle(presetType, num);
    setFollowUpTitle(newTitle);
  };

  const handleSequenceChange = (newSeq: number) => {
    if (newSeq < 1) return;
    setFollowUpSequenceNumber(newSeq);
    if (selectedPresetFormat !== "custom") {
      setFollowUpTitle(getPresetTitle(selectedPresetFormat, newSeq));
    }
  };

  const handleOpenAddFollowUpModal = async (parentForm: any, existingChildren: any[] = []) => {
    setTargetParentForm(parentForm);
    const count = existingChildren?.length || 0;
    setTargetChildrenCount(count);
    const nextNum = count + 1;
    const base = getBaseFormTitle(parentForm.title || "Form");

    setFollowUpSequenceNumber(nextNum);
    setSelectedPresetFormat("standard");
    setFollowUpTitle(`${base} - Follow up ${nextNum}`);
    setFollowUpDescription(`Follow-up form for ${parentForm.title || base}`);
    setFollowUpSource("parent");
    setActiveFollowUpTab("create");
    setSelectedExistingFormId("");
    setAddFollowUpModalOpen(true);

    // If sections are missing or empty, fetch the full form from backend to populate question/section count
    const parentId = parentForm._id || parentForm.id;
    if (parentId && (!parentForm.sections || parentForm.sections.length === 0)) {
      try {
        const res = await apiClient.getForm(parentId);
        const fullForm = (res as any)?.form || (res as any)?.data?.form || res;
        if (fullForm?.sections?.length) {
          setTargetParentForm((prev: any) => ({
            ...prev,
            ...fullForm,
          }));
        }
      } catch (err) {
        console.warn("Could not fetch full parent form details:", err);
      }
    }
  };



  const toggleChildForms = (parentFormId: string) => {
    setExpandedChildFormIds((prev) => ({
      ...prev,
      [parentFormId]: !prev[parentFormId],
    }));
  };

  const templateOptions: TemplateOption[] = [
    {
      id: "flat",
      label: "Follow-up Only",
      description: "Flat structure with unlimited main follow-ups (FU1-FU99)",
    },
    {
      id: "nested",
      label: "Nested Follow-up",
      description:
        "Hierarchical structure with nested follow-ups (FU1.1, FU1.1.1)",
    },
    {
      id: "bulk-response",
      label: "Bulk Response Import",
      description:
        "Import responses for an existing form using an Excel template",
    },
  ];

  useEffect(() => {
    if (templateOptions.length > 0 && !selectedTemplate) {
      setSelectedTemplate(templateOptions[0]);
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        templateDropdownRef.current &&
        !templateDropdownRef.current.contains(event.target as Node) &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setIsTemplateDropdownOpen(false);
      }
    };

    if (isTemplateDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isTemplateDropdownOpen]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const templateDropdownRef = useRef<HTMLDivElement>(null);

  const {
    data: formsData,
    loading,
    error,
    execute: refetchForms,
  } = useForms(!isAnswerTemplateOpen);

  useEffect(() => {
    refetchForms({ forceNetwork: true });
  }, [user?.tenantId]);

  const {
    data: responsesData,
    refetch: refetchResponses,
  } = useResponses();

  const deleteMutation = useMutation((id: string) => apiClient.deleteForm(id), {
    onSuccess: () => {
      refetchForms({ forceNetwork: true });
      showSuccess("Form deleted successfully", "Success");
    },
    onError: (error: any) => {
      console.error("Delete form error:", error);
      showError(
        typeof error === "string" ? error : error?.message || "Failed to delete form",
        "Delete Failed"
      );
    },
  });

  const duplicateMutation = useMutation(
    (id: string) => apiClient.duplicateForm(id),
    {
      onSuccess: () => {
        refetchForms();
      },
    },
  );

  const visibilityMutation = useMutation(
    ({ id, isVisible }: { id: string; isVisible: boolean }) =>
      apiClient.updateFormVisibility(id, isVisible),
    {
      onSuccess: () => {
        refetchForms();
      },
    },
  );

  const locationMutation = useMutation(
    ({ id, locationEnabled }: { id: string; locationEnabled: boolean }) =>
      apiClient.updateFormLocationEnabled(id, locationEnabled),
    {
      onSuccess: () => {
        refetchForms();
      },
      onError: (error: any) => {
        showError(
          error.message || "Failed to update location setting",
          "Error",
        );
      },
    },
  );
 

  const viewTypeMutation = useMutation(
    ({
      id,
      viewType,
    }: {
      id: string;
      viewType: "section-wise" | "question-wise";
    }) => apiClient.updateFormViewType(id, viewType),
    {
      onSuccess: () => {
        refetchForms();
        showSuccess("Form view type updated successfully");
      },
      onError: (error: any) => {
        console.error("View Type Update Error:", error);
        showError(
          typeof error === "string"
            ? error
            : error.message || "Failed to update view type setting",
          "Error",
        );
      },
    },
  );

  const forms = formsData?.forms || [];
  const parentForms = forms.filter((form: FormItem) => !form.parentFormId);

  const availableFormsToLink = useMemo(() => {
    if (!targetParentForm) return [];
    const parentId = targetParentForm._id || targetParentForm.id;
    const existingChildIds = new Set(
      (targetParentForm.childForms || []).map((cf: any) =>
        typeof cf === "string" ? cf : cf.formId || cf.id || cf._id
      )
    );
    return (forms || []).filter((f: any) => {
      const fId = f._id || f.id;
      return fId !== parentId && !existingChildIds.has(fId);
    });
  }, [forms, targetParentForm]);

  const handleCreateFollowUpForm = async (openEditor: boolean = false) => {
    if (!targetParentForm || !followUpTitle.trim()) return;
    try {
      setIsCreatingFollowUp(true);
      const parentId = targetParentForm._id || targetParentForm.id;
      const parentTenantId =
        typeof targetParentForm.tenantId === "object"
          ? targetParentForm.tenantId?._id
          : targetParentForm.tenantId || user?.tenantId;

      let parentSections = targetParentForm.sections || [];
      if (followUpSource === "parent" && parentSections.length === 0) {
        try {
          const res = await apiClient.getForm(parentId);
          const fullForm = (res as any)?.form || (res as any)?.data?.form || res;
          if (fullForm?.sections?.length) {
            parentSections = fullForm.sections;
          }
        } catch (err) {
          console.warn("Could not fetch full parent form sections on create:", err);
        }
      }

      let sections = [];
      if (followUpSource === "parent" && parentSections.length > 0) {
        sections = parentSections.map((sec: any, sIdx: number) => ({
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
          followUpDescription.trim() ||
          `Follow-up form for ${targetParentForm.title}`,
        parentFormId: parentId,
        parentFormTitle: targetParentForm.title,
        tenantId: parentTenantId,
        isGlobal: Boolean(targetParentForm.isGlobal),
        isVisible: true,
        sections,
        chassisNumbers: targetParentForm.chassisNumbers || [],
        chassisTenantAssignments:
          targetParentForm.chassisTenantAssignments || [],
        sharedWithTenants: targetParentForm.sharedWithTenants || [],
      };

      const res = await apiClient.createForm(payload);
      const createdForm = (res as any).form || (res as any).data?.form || res;
      const newFormId = createdForm?._id || createdForm?.id;

      if (newFormId) {
        try {
          await apiClient.linkChildForm(parentId, newFormId);
        } catch (linkErr) {
          // Auto-linked
        }
      }

      setAddFollowUpModalOpen(false);
      showSuccess(
        `Follow-up form "${followUpTitle}" created and linked successfully!`,
        "Follow-up Created"
      );

      setExpandedChildFormIds((prev) => ({
        ...prev,
        [parentId]: true,
      }));

      await refetchForms({ forceNetwork: true });

      if (openEditor && newFormId) {
        navigate(`/forms/${newFormId}/edit`);
      }
    } catch (err: any) {
      showError(err.message || "Failed to create follow-up form", "Error");
    } finally {
      setIsCreatingFollowUp(false);
    }
  };

  const handleLinkExistingFollowUp = async () => {
    if (!targetParentForm || !selectedExistingFormId) return;
    try {
      setIsCreatingFollowUp(true);
      const parentId = targetParentForm._id || targetParentForm.id;
      await apiClient.linkChildForm(parentId, selectedExistingFormId);
      setAddFollowUpModalOpen(false);
      showSuccess("Follow-up form linked successfully!", "Success");
      setExpandedChildFormIds((prev) => ({
        ...prev,
        [parentId]: true,
      }));
      await refetchForms({ forceNetwork: true });
    } catch (err: any) {
      showError(err.message || "Failed to link follow-up form", "Error");
    } finally {
      setIsCreatingFollowUp(false);
    }
  };
  
  // Debug logging
  console.log("User role:", userRole);
  console.log("User permissions:", userPermissions);
  console.log("All forms from API:", forms.map(f => ({ id: f._id, title: f.title })));
  
  // Filter forms based on permissions
  const visibleForms = useMemo(() => {
    const filtered = forms.filter((form: FormItem) => {
      const formId = form._id || form.id;
      if (!formId) {
        console.log("Form missing ID:", form);
        return false;
      }
      
      // Admins and superadmins see all forms
      if (userRole === 'admin' || userRole === 'superadmin') {
        console.log(`Admin/Superadmin - showing form: ${formId}`);
        return true;
      }
      
      // For inspector/subadmin, check if they have permission for this form
      const hasPermission = canViewForm(formId);
      console.log(`Form ${formId} (${form.title}) - has permission: ${hasPermission}`);
      return hasPermission;
    });
    
    console.log("Visible forms count:", filtered.length);
    console.log("Visible forms:", filtered.map(f => ({ id: f._id, title: f.title })));
    return filtered;
  }, [forms, userRole, userPermissions]);
  useEffect(() => {
    if (!visibleForms.length) return;
    const counts: Record<string, number> = {};
    for (const form of visibleForms) {
      const c = form.responseCount || 0;
      if (form._id) counts[form._id] = c;
      if (form.id) counts[form.id] = c;
    }
    setActualResponseCounts(counts);
  }, [visibleForms]);

  // Set of all child form IDs linked in any form's childForms array or with parentFormId
  const allChildFormIds = useMemo(() => {
    const set = new Set<string>();
    forms.forEach((form: FormItem) => {
      if (Array.isArray(form.childForms)) {
        form.childForms.forEach((cf: any) => {
          const cfId = typeof cf === "string" ? cf : cf.formId || cf.id || cf._id;
          if (cfId) set.add(String(cfId));
        });
      }
      if (form.parentFormId) {
        if (form.id) set.add(String(form.id));
        if (form._id) set.add(String(form._id));
      }
    });
    return set;
  }, [forms]);

  const isFormAChild = useCallback(
    (form: FormItem) => {
      if (form.parentFormId) return true;
      const formIdStr = form.id ? String(form.id) : "";
      const formMongoIdStr = form._id ? String(form._id) : "";
      return (
        Boolean(formIdStr && allChildFormIds.has(formIdStr)) ||
        Boolean(formMongoIdStr && allChildFormIds.has(formMongoIdStr))
      );
    },
    [allChildFormIds],
  );

  const totalForms = visibleForms.filter((form: FormItem) => !isFormAChild(form)).length;
  const activeFormsCount = visibleForms.filter(
    (form: FormItem) => form.isActive === true && !isFormAChild(form),
  ).length;
  const inactiveFormsCount = visibleForms.filter(
    (form: FormItem) => form.isActive === false && !isFormAChild(form),
  ).length;

  const formsMap = useMemo(() => {
    const map = new Map<string, FormItem>();
    visibleForms.forEach((form) => {
      if (form._id) {
        map.set(form._id, form);
      }
      if (form.id) {
        map.set(form.id, form);
      }
    });
    return map;
  }, [visibleForms]);

  const filteredForms = visibleForms.filter((form: FormItem) => {
    const titleMatch = form.title
      ?.toLowerCase()
      .includes(searchTerm.toLowerCase());
    const descriptionMatch = form.description
      ?.toLowerCase()
      .includes(searchTerm.toLowerCase());
    return titleMatch || descriptionMatch;
  });

  const groupedForms = useMemo(() => {
    const result = filteredForms.reduce(
      (acc, form) => {
        const isChild = isFormAChild(form);

        if (isChild) {
          const parentKey = form.parentFormId;
          if (parentKey) {
            acc[parentKey] = acc[parentKey] || {
              parent: null,
              children: [],
            };
            const childId = form.id || form._id;
            if (!acc[parentKey].children.some((c) => (c.id || c._id) === childId)) {
              acc[parentKey].children.push(form);
            }
          }
          return acc;
        }

        const key = form.id || form._id;
        if (!key) {
          return acc;
        }

        if (!acc[key]) {
          acc[key] = {
            parent: form,
            children: [],
          };
        } else {
          acc[key].parent = form;
        }

        return acc;
      },
      {} as Record<string, { parent: FormItem | null; children: FormItem[] }>,
    );

    Object.values(result).forEach((group) => {
      const parent = group.parent;
      if (!parent) {
        return;
      }

      const childRefs = [...(parent.childForms || [])].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0),
      );

      const existingChildrenMap = new Map<string, FormItem>();
      group.children.forEach((child) => {
        const childKey = child.id || child._id;
        if (childKey) {
          existingChildrenMap.set(childKey, child);
        }
      });

      const orderedChildren: FormItem[] = [];
      const usedChildIds = new Set<string>();

      childRefs.forEach((childRef) => {
        const childId = childRef.formId;
        if (!childId || usedChildIds.has(childId)) {
          return;
        }

        usedChildIds.add(childId);

        let child = existingChildrenMap.get(childId) || formsMap.get(childId);
        if (child) {
          orderedChildren.push(child);
        }
      });

      group.children.forEach((child) => {
        const childId = child.id || child._id;
        if (!childId || usedChildIds.has(childId)) {
          return;
        }
        usedChildIds.add(childId);
        orderedChildren.push(child);
      });

      group.children = orderedChildren;
    });

    return result;
  }, [filteredForms, formsMap, isFormAChild]);

  const allForms = filteredForms.length;
  const totalResponses = filteredForms.reduce((sum, form) => {
    return sum + (form.responseCount || 0);
  }, 0);

  const handleDelete = async (id: string, title: string) => {
    showConfirm(
      `Are you sure you want to delete "${title}"? This action cannot be undone.`,
      async () => {
        try {
          setDeletingFormId(id);
          const res = await deleteMutation.mutate(id);
          if (res) {
            await refetchForms({ forceNetwork: true });
          }
        } catch (err: any) {
          console.error("Delete error:", err);
          showError(err?.message || "Failed to delete form", "Delete Failed");
        } finally {
          setDeletingFormId(null);
        }
      },
      "Delete Form",
      "Delete",
      "Cancel",
    );
  };

  const handleDuplicate = async (id: string) => {
    await duplicateMutation.mutate(id);
  };

  const handleToggleVisibility = async (
    id: string,
    currentVisibility: boolean | undefined,
  ) => {
    await visibilityMutation.mutate({
      id,
      isVisible: !currentVisibility,
    });
  };

  const handleToggleLocation = async (
    id: string,
    currentLocationEnabled: boolean | undefined,
  ) => {
    const isCurrentlyEnabled = currentLocationEnabled !== false;
    await locationMutation.mutate({
      id,
      locationEnabled: !isCurrentlyEnabled,
    });
  };

  const handleToggleViewType = (
    id: string,
    currentViewType: "section-wise" | "question-wise" | undefined,
  ) => {
    console.log("Toggling view type for ID:", id, "current:", currentViewType);
    const nextViewType =
      currentViewType === "question-wise" ? "section-wise" : "question-wise";

    viewTypeMutation.mutate({
      id,
      viewType: nextViewType,
    });
  };

  const handleExportTemplate = (
    templateId?: "flat" | "nested" | "linking" | "bulk-response",
  ) => {
    const templateToUse =
      templateId || (selectedTemplate?.id as "flat" | "nested");

    if (templateToUse === "nested") {
      downloadNestedFormImportTemplate();
      showSuccess("Nested Follow-up template downloaded", "Success");
    } else {
      downloadFormImportTemplate();
      showSuccess("Follow-up Only template downloaded", "Success");
    }

    setIsTemplateDropdownOpen(false);
  };

  const handleTemplateSelect = (template: TemplateOption) => {
    setSelectedTemplate(template);
    if (template.id === "bulk-response") {
      setIsAnswerTemplateOpen(true);
      setIsTemplateDropdownOpen(false);
    } else {
      handleExportTemplate(template.id);
    }
  };

  const toggleTemplateDropdown = () => {
    setIsTemplateDropdownOpen(!isTemplateDropdownOpen);
  };

  const handleFileInputChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const isValidType =
      file.type ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.name.toLowerCase().endsWith(".xlsx");
    if (!isValidType) {
      showError("Please select a valid .xlsx file", "Invalid File");
      return;
    }

    setIsImporting(true);

    try {
      const parsed = await parseFormWorkbook(file);
      const formPayload = {
        ...parsed,
        isVisible: parsed.isVisible ?? true,
        followUpQuestions: parsed.followUpQuestions || [],
      } as FormQuestion;

      setPreviewFormData(formPayload);
      setIsPreviewOpen(true);
    } catch (error: any) {
      showError(error?.message || "Failed to parse form", "Import Failed");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleConfirmImport = async () => {
    if (!previewFormData) return;

    setIsSavingForm(true);

    try {
      await apiClient.createForm(previewFormData);
      showSuccess("Form imported successfully", "Import Complete");
      refetchForms();
      setIsPreviewOpen(false);
      setPreviewFormData(null);
    } catch (error: any) {
      showError(error?.message || "Failed to import form", "Import Failed");
    } finally {
      setIsSavingForm(false);
    }
  };

  const handleCancelImport = () => {
    setIsPreviewOpen(false);
    setPreviewFormData(null);
  };

  const handleImportClick = () => {
    if (isImporting) {
      return;
    }
    fileInputRef.current?.click();
  };

  const toggleMenu = (formId: string) => {
    setOpenMenuId(openMenuId === formId ? null : formId);
  };

  const handleManageChildForms = (formId: string) => {
    navigate(`/forms/${formId}/edit`);
    setOpenMenuId(null);
    setTimeout(() => {
      const childFormsSection = document.querySelector(
        '[data-section="child-forms"]',
      );
      if (childFormsSection) {
        childFormsSection.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }, 500);
  };

  const handleLinkToParent = (formId: string) => {
    navigate(`/forms/${formId}/edit`);
    setOpenMenuId(null);
    setTimeout(() => {
      const childFormsSection = document.querySelector(
        '[data-section="child-forms"]',
      );
      if (childFormsSection) {
        childFormsSection.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }, 500);
  };

  const handleCopyShareLink = (formId: string, tenantSlug?: string) => {
    const baseUrl = window.location.origin;
    const shareLink = tenantSlug
      ? `${baseUrl}/${tenantSlug}/form/${formId}`
      : `${baseUrl}/form/${formId}`;

    navigator.clipboard.writeText(shareLink).then(() => {
      setCopiedId(formId);
      setTimeout(() => setCopiedId(null), 2000);
    });
    setOpenMenuId(null);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };

    if (openMenuId) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openMenuId]);

  const [emailInviteModal, setEmailInviteModal] = useState<{
    open: boolean;
    formId: string | null;
    formTitle: string;
  }>({ open: false, formId: null, formTitle: "" });

  const [whatsappInviteModal, setWhatsappInviteModal] = useState<{
    open: boolean;
    formId: string | null;
    formTitle: string;
  }>({ open: false, formId: null, formTitle: "" });

  const [smsInviteModal, setSmsInviteModal] = useState<{
    open: boolean;
    formId: string | null;
    formTitle: string;
  }>({ open: false, formId: null, formTitle: "" });

  const [shareAnalyticsModal, setShareAnalyticsModal] = useState<{
    open: boolean;
    formId: string | null;
    formTitle: string;
  }>({ open: false, formId: null, formTitle: "" });

  const [autoSendModal, setAutoSendModal] = useState<{
    open: boolean;
    formId: string | null;
    formTitle: string;
  }>({ open: false, formId: null, formTitle: "" });

  const [inviteCounts, setInviteCounts] = useState<Record<string, number>>({});

  const openEmailInviteModal = (formId: string) => {
    const form = forms.find((f) => f.id === formId || f._id === formId);
    if (form) {
      setEmailInviteModal({
        open: true,
        formId,
        formTitle: form.title,
      });
    }
  };

  const openWhatsAppInviteModal = (formId: string) => {
    const form = forms.find((f) => f.id === formId || f._id === formId);
    if (form) {
      setWhatsappInviteModal({
        open: true,
        formId,
        formTitle: form.title,
      });
    }
  };

  const openSMSInviteModal = (formId: string) => {
    const form = forms.find((f) => f.id === formId || f._id === formId);
    if (form) {
      setSmsInviteModal({
        open: true,
        formId,
        formTitle: form.title,
      });
    }
  };

  const openShareAnalyticsModal = (formId: string) => {
    const form = forms.find((f) => f.id === formId || f._id === formId);
    if (form) {
      setShareAnalyticsModal({
        open: true,
        formId,
        formTitle: form.title,
      });
    }
  };

  useEffect(() => {
  if (formsData?.forms) {
    console.log("📊 Forms data with response counts:", formsData.forms.map(f => ({
      title: f.title,
      _id: f._id,
      responseCount: f.responseCount,
      hasResponseCount: 'responseCount' in f
    })));
  }
}, [formsData]);
  const openAutoSendModal = (formId: string) => {
    const form = forms.find((f) => f.id === formId || f._id === formId);
    if (form) {
      setAutoSendModal({
        open: true,
        formId,
        formTitle: form.title,
      });
    }
  };

  // Removed wasteful bulk getInviteStats loop that blocked the network with 20+ parallel requests

  const isDataLoading = loading || !formsData;
  const combinedError = error;

  const isAuthError = Boolean(
    combinedError &&
    (String(combinedError).toLowerCase().includes("invalid token") ||
      String(combinedError).toLowerCase().includes("jwt expired") ||
      String(combinedError).toLowerCase().includes("unauthorized") ||
      String(combinedError).toLowerCase().includes("401") ||
      String(combinedError).toLowerCase().includes("not authorized"))
  );

  if (combinedError) {
    return (
      <div className="p-6">
        <div className="text-center py-12 max-w-md mx-auto">
          <div className={`rounded-2xl p-6 mb-4 border shadow-sm ${
            isAuthError 
              ? "bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/40" 
              : "bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/40"
          }`}>
            {isAuthError ? (
              <LogIn className="w-12 h-12 text-blue-600 dark:text-blue-400 mx-auto mb-4" />
            ) : (
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            )}
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">
              {isAuthError ? "Session Expired" : "Error Loading Analytics"}
            </h3>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
              {isAuthError
                ? "Your login session has expired. Please log in again to continue managing forms."
                : String(combinedError)}
            </p>
          </div>

          <div className="flex gap-3 justify-center flex-wrap">
            {isAuthError ? (
              <button
                onClick={() => {
                  window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
                }}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                Log In Again
              </button>
            ) : (
              <button
                onClick={() => refetchForms({ forceNetwork: true })}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-md cursor-pointer"
              >
                Try Again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isDataLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-primary-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={handleFileInputChange}
      />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-primary-800">
            Service Analytics
          </h1>
          <p className="text-xs sm:text-sm text-primary-600">
            Create, edit, and analyze service request forms
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
          {/* Only show action buttons for users who have permissions or are admin/superadmin */}
          {(userRole === 'admin' || userRole === 'superadmin' || canManage) && (
            <>
              {/* Summary Box Button */}
              <button
                onClick={() => navigate('/forms/analytics/summary')}
                className="btn-secondary flex items-center justify-center px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-sm font-semibold rounded-lg transition-all whitespace-nowrap"
                title="View Inspector TVS performance, BIW quality defects & daily trend summary"
              >
                <BarChart3 className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-400" />
                Summary Box
              </button>

              {/* Download Template - admins always see this, others need permission */}
              {(userRole === 'admin' || userRole === 'superadmin' || canDownloadTemplate) && (
                <div
                  className="relative w-full sm:w-auto"
                  ref={templateDropdownRef}
                >
                  <button
                    onClick={toggleTemplateDropdown}
                    className="btn-secondary flex items-center justify-center w-full sm:min-w-[240px]"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    <span className="truncate">
                      {selectedTemplate
                        ? `Download ${selectedTemplate.label} Template`
                        : "Download Import Template"}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 ml-2 flex-shrink-0 transition-transform ${isTemplateDropdownOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {/* Dropdown Menu */}
                  {isTemplateDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 w-full sm:w-72 bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-primary-200 py-2 z-50 animate-fadeIn">
                      <div className="px-4 py-2 border-b border-primary-100">
                        <p className="text-xs font-medium text-primary-700">
                          Select Template Type:
                        </p>
                      </div>

                      {templateOptions.map((template) => (
                        <button
                          key={template.id}
                          onClick={() => handleTemplateSelect(template)}
                          className={`w-full flex flex-col items-start px-4 py-3 text-left hover:bg-primary-50 transition-colors ${selectedTemplate?.id === template.id ? "bg-primary-50 border-l-4 border-primary-600" : ""}`}
                        >
                          <div className="flex items-center w-full">
                            <div
                              className={`p-1.5 rounded-lg mr-3 ${selectedTemplate?.id === template.id ? "bg-primary-100" : "bg-primary-50"}`}
                            >
                              {template.id === "flat" ? (
                                <Layers className="w-4 h-4 text-primary-600" />
                              ) : template.id === "bulk-response" ? (
                                <Upload className="w-4 h-4 text-green-600" />
                              ) : (
                                <Layers className="w-4 h-4 text-purple-600" />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-primary-800 text-sm">
                                {template.label}
                              </div>
                              <div className="text-[10px] text-primary-600 mt-0.5">
                                {template.description}
                              </div>
                            </div>
                            {selectedTemplate?.id === template.id && (
                              <Check className="w-4 h-4 text-primary-600 ml-2" />
                            )}
                          </div>
                        </button>
                      ))}

                      <div className="px-4 py-2 border-t border-primary-100 mt-1">
                        <p className="text-[10px] text-primary-500">
                          {selectedTemplate?.id === "flat"
                            ? "Each question can have unlimited main-level follow-ups"
                            : "Supports hierarchical follow-up questions with nesting"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Import Form (Excel) - admins always see this, others need permission */}
              {(userRole === 'admin' || userRole === 'superadmin' || canImportExcel) && (
                <button
                  onClick={handleImportClick}
                  className="btn-secondary flex items-center justify-center w-full sm:w-auto"
                  disabled={isImporting}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {isImporting ? "Importing..." : "Import Form (Excel)"}
                </button>
              )}

              {canBulkSelectResponses && (
                <>
                  <button
                    onClick={() => setIsAnswerTemplateOpen(true)}
                    className="btn-secondary flex items-center justify-center w-full sm:w-auto"
                    title="Bulk import responses for a form"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Bulk Import Responses
                  </button>

                  <button
                    onClick={() => setIsHistoryModalOpen(true)}
                    className="btn-secondary flex items-center justify-center w-full sm:w-auto text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                    title="View Bulk Import & Activity Timeline History"
                  >
                    <History className="w-4 h-4 mr-2" />
                    Import History
                  </button>
                </>
              )}

              {/* Create New Service Form - admins always see this, others need permission */}
              {(userRole === 'admin' || userRole === 'superadmin' || canCreateServiceForm) && (
                <button
                  onClick={() =>
                    navigate("/forms/create", { state: { mode: "create" } })
                  }
                  className="btn-primary flex items-center justify-center w-full sm:w-auto"
                >
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Create New Service Form
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Stats cards - always show for admins, others need permission */}
      {(userRole === 'admin' || userRole === 'superadmin' || canViewDashboard || canViewOverall) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="card p-6">
            <div className="flex items-center">
              <div className="p-3 bg-primary-50 rounded-lg mr-4">
                <FileText className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <div className="text-2xl font-medium text-primary-600">
                  {totalForms}
                </div>
                <div className="text-sm text-primary-500">Total Forms</div>
              </div>
            </div>
          </div>
          <div className="card p-6">
            <div className="flex items-center">
              <div className="p-3 bg-primary-50 rounded-lg mr-4">
                <Users className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <div className="text-2xl font-medium text-primary-600">
                  {totalResponses}
                </div>
                <div className="text-sm text-primary-500">Total Responses</div>
              </div>
            </div>
          </div>
          <div className="card p-6">
            <div className="flex items-center">
              <div className="p-3 bg-primary-50 rounded-lg mr-4">
                <Layers className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <div className="text-2xl font-medium text-primary-600">
                  {Object.keys(groupedForms).length}
                </div>
                <div className="text-sm text-primary-500">Form Groups</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-primary-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Search service forms..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 input-field"
        />
      </div>

      {filteredForms.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-lg border border-neutral-200 dark:border-gray-700">
          <FileText className="w-12 h-12 text-primary-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-primary-600 mb-2">
            {searchTerm
              ? "No service forms found"
              : "No service forms available"}
          </h3>
          <p className="text-primary-500 mb-6">
            {searchTerm ? "Try adjusting your search criteria" : "You don't have permission to view any forms or no forms have been created yet."}
          </p>
          {!searchTerm && (userRole === 'admin' || userRole === 'superadmin' || canCreateServiceForm) && (
            <button
              onClick={() => navigate("/forms/create")}
              className="btn-primary"
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              Create Your First Form            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.values(groupedForms).map(({ parent, children }) => {
            if (!parent) return null;

            const formId = parent._id || parent.id;
            const responseCount = (parent.id && actualResponseCounts[parent.id]) || (parent._id && actualResponseCounts[parent._id]) || actualResponseCounts[formId] || parent.responseCount || 0;

            const totalChildResponses = children.reduce((sum, c) => {
              const cId = c._id || c.id;
              const count = (cId && actualResponseCounts[cId]) || (c.id && actualResponseCounts[c.id]) || (c._id && actualResponseCounts[c._id]) || c.responseCount || 0;
              return sum + count;
            }, 0);

            const isLocationEnabled = parent.locationEnabled !== false;

            // Check if user can view this specific form
            const canViewThisForm = canViewForm(parent);
            
            // If user can't view this form, skip rendering it
            if (!canViewThisForm) return null;

            // Check if user has specific analytics permissions for this form
            const hasPreviewPermission = hasFormAnalyticsPermission(parent, 'preview');
            const hasResponsePermission = hasFormAnalyticsPermission(parent, 'response');
            const hasDashboardPermission = hasFormAnalyticsPermission(parent, 'dashboard');
            const hasOverallPermission = hasFormAnalyticsPermission(parent, 'overall');
            const hasQuestionsPermission = hasFormAnalyticsPermission(parent, 'questions');
            const hasSectionsPermission = hasFormAnalyticsPermission(parent, 'sections');
            const hasEditPermission = hasFormAnalyticsPermission(parent, 'edit');
            const hasDuplicatePermission = hasFormAnalyticsPermission(parent, 'duplicate');
            const hasDeletePermission = hasFormAnalyticsPermission(parent, 'delete');
            const hasUploadsPermission = hasFormAnalyticsPermission(parent, 'uploads');

            const ownerTenantId =
              typeof parent.tenantId === "object"
                ? (parent.tenantId?._id || parent.tenantId?.id)
                : parent.tenantId;
            const userTenantId =
              typeof user?.tenantId === "object"
                ? (user?.tenantId?._id || user?.tenantId?.id)
                : user?.tenantId;

            const ownerTenantIdStr = ownerTenantId ? String(ownerTenantId) : "";
            const userTenantIdStr = userTenantId ? String(userTenantId) : "";

            const isOwner =
              userRole === "superadmin" ||
              !parent.tenantId ||
              (ownerTenantIdStr && userTenantIdStr && ownerTenantIdStr === userTenantIdStr);

            const tenantName =
              typeof parent.tenantId === "object"
                ? parent.tenantId?.companyName || parent.tenantId?.name
                : null;

            return (
              <div
                key={formId}
                className="card p-6 hover:border-primary-300 transition-colors duration-200"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium text-primary-800 line-clamp-2 mb-0">
                        {parent.title}
                      </h3>
                      {tenantName && !isOwner && userRole !== "superadmin" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100 uppercase tracking-wider">
                          {tenantName}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-primary-600 line-clamp-2">
                      {parent.description}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-primary-500 mb-6 gap-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center bg-primary-50 dark:bg-gray-800 px-2 py-1 rounded-md">
                      <Users className="w-3.5 h-3.5 mr-1.5 text-primary-600" />
                      <span className="font-medium text-primary-700">
                        {responseCount}
                      </span>
                      <span className="ml-1 text-primary-500">responses</span>
                    </div>
                    {isOwner && (
                      <div className="flex items-center gap-1 bg-white dark:bg-gray-900 border border-primary-100 rounded-lg p-0.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEmailInviteModal(formId);
                          }}
                          title="Send Email Invites"
                          className="p-1.5 rounded-md hover:bg-blue-50 transition-colors group relative"
                        >
                          <Mail className="w-4 h-4 text-blue-600 group-hover:text-blue-700" />
                          {inviteCounts[formId] > 0 && (
                            <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[8px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                              {inviteCounts[formId]}
                            </span>
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openWhatsAppInviteModal(formId);
                          }}
                          title="Send WhatsApp Invites"
                          className="p-1.5 rounded-md hover:bg-green-50 transition-colors group"
                        >
                          <MessageCircle className="w-4 h-4 text-green-600 group-hover:text-green-700" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openSMSInviteModal(formId);
                          }}
                          title="Send SMS Invites"
                          className="p-1.5 rounded-md hover:bg-purple-50 transition-colors group"
                        >
                          <MessageSquare className="w-4 h-4 text-purple-600 group-hover:text-purple-700" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto border-t sm:border-t-0 border-primary-50 pt-3 sm:pt-0">
                    <div className="relative">
                      <button
                        onClick={() =>
                          setOpenMenuId(openMenuId === formId ? null : formId)
                        }
                        className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50 transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                        <span>Options</span>
                      </button>

                      {openMenuId === formId && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setOpenMenuId(null)}
                          />

                          <div
                            className="
        fixed z-50
        left-4 right-4
        sm:absolute sm:left-auto sm:right-0 sm:w-64
        top-1/2 -translate-y-1/2
        sm:top-10 sm:translate-y-0
        bg-white dark:bg-gray-900 
        rounded-xl shadow-2xl 
        border border-primary-100 
        py-2 
        animate-fadeIn 
        overflow-hidden
        max-h-[80vh] overflow-y-auto
      "
                          >
                            <div className="px-4 py-2 border-b border-primary-50 mb-1 flex items-center justify-between">
                              <span className="text-[10px] font-bold text-primary-400 uppercase tracking-wider">
                                Form Actions
                              </span>
                              <button
                                onClick={() => setOpenMenuId(null)}
                                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 transition-colors"
                                title="Close"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                            {isOwner && (
                              <>
                                {canEdit && (
                                  <button
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      handleOpenAddFollowUpModal(parent, children);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-purple-700 hover:bg-purple-50 dark:text-purple-300 dark:hover:bg-purple-900/30 transition-colors"
                                  >
                                    <div className="p-1.5 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                                      <Plus className="w-4 h-4 text-purple-600 dark:text-purple-300" />
                                    </div>
                                    <div className="text-left flex-1">
                                      <div className="font-semibold text-purple-900 dark:text-purple-100">
                                        Add Follow-up Form
                                      </div>
                                      <div className="text-[10px] text-purple-500 dark:text-purple-400">
                                        Create or link follow-up {children.length + 1}
                                      </div>
                                    </div>
                                  </button>
                                )}

                                <button
                                  onClick={() => handleManageChildForms(formId)}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-primary-700 hover:bg-primary-50 transition-colors"
                                >
                                  <div className="p-1.5 bg-primary-50 rounded-lg">
                                    <Layers className="w-4 h-4 text-primary-600" />
                                  </div>
                                  <div className="text-left flex-1">
                                    <div className="font-medium">
                                      Manage Follow-up Forms
                                    </div>
                                    <div className="text-[10px] text-primary-500">
                                      Link & organize forms
                                    </div>
                                  </div>
                                  {children.length > 0 && (
                                    <span className="px-2 py-0.5 bg-primary-600 text-white text-[10px] font-bold rounded-full">
                                      {children.length}
                                    </span>
                                  )}
                                </button>

                                <button
                                  onClick={() => handleLinkToParent(formId)}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-primary-700 hover:bg-primary-50 transition-colors"
                                >
                                  <div className="p-1.5 bg-blue-50 rounded-lg">
                                    <Link2 className="w-4 h-4 text-blue-600" />
                                  </div>
                                  <div className="text-left">
                                    <div className="font-medium">
                                      Link to Parent
                                    </div>
                                    <div className="text-[10px] text-primary-500">
                                      Connect to existing form
                                    </div>
                                  </div>
                                </button>

                                <button
                                  onClick={() =>
                                    handleToggleViewType(formId, parent.viewType)
                                  }
                                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-primary-700 hover:bg-primary-50 transition-colors"
                                >
                                  <div className="p-1.5 bg-orange-50 rounded-lg">
                                    {parent.viewType === "question-wise" ? (
                                      <Layout className="w-4 h-4 text-orange-600" />
                                    ) : (
                                      <Split className="w-4 h-4 text-orange-600" />
                                    )}
                                  </div>
                                  <div className="text-left">
                                    <div className="font-medium">
                                      {parent.viewType === "question-wise"
                                        ? "Section-wise View"
                                        : "Question-wise View"}
                                    </div>
                                    <div className="text-[10px] text-primary-500">
                                      Change display layout
                                    </div>
                                  </div>
                                </button>

                                <div className="border-t border-primary-50 my-1"></div>
                                <div className="px-4 py-2">
                                  <span className="text-[10px] font-bold text-primary-400 uppercase tracking-wider">
                                    Sharing
                                  </span>
                                </div>
                              </>
                            )}

                            <button
                              onClick={() => handleCopyShareLink(formId)}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-primary-700 hover:bg-primary-50 transition-colors"
                            >
                              <div className="p-1.5 bg-green-50 rounded-lg">
                                {copiedId === formId ? (
                                  <Check className="w-4 h-4 text-green-600" />
                                ) : (
                                  <Link2 className="w-4 h-4 text-green-600" />
                                )}
                              </div>
                              <div className="text-left">
                                <div className="font-medium">
                                  {copiedId === formId
                                    ? "Link Copied!"
                                    : "Copy Form Link"}
                                </div>
                                <div className="text-[10px] text-primary-500">
                                  Share with responders
                                </div>
                              </div>
                            </button>

                            {isOwner && (
                              <button
                                onClick={() => openShareAnalyticsModal(formId)}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-primary-700 hover:bg-primary-50 transition-colors"
                              >
                                <div className="p-1.5 bg-indigo-50 rounded-lg">
                                  <Share2 className="w-4 h-4 text-indigo-600" />
                                </div>
                                <div className="text-left">
                                  <div className="font-medium">
                                    Share Analytics
                                  </div>
                                  <div className="text-[10px] text-primary-500">
                                    Invite external viewers
                                  </div>
                                </div>
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex items-center text-primary-400 font-medium">
                      <Calendar className="w-3.5 h-3.5 mr-1.5" />
                      {parent.createdAt
                        ? new Date(parent.createdAt).toLocaleDateString()
                        : "Unknown"}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium ${
                        parent.isVisible
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {parent.isVisible ? "Public" : "Private"}
                    </span>
                    {children.length > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleChildForms(formId)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-purple-100 hover:bg-purple-200 text-purple-800 border border-purple-200 transition-colors cursor-pointer"
                        title="Click to toggle follow-up forms"
                      >
                        <Layers className="w-3 h-3 text-purple-600" />
                        <span>Child Forms ({children.length}{totalChildResponses > 0 ? ` • ${totalChildResponses} resp` : ''})</span>
                        <ChevronDown
                          className={`w-3 h-3 text-purple-600 transition-transform duration-200 ${
                            expandedChildFormIds[formId] ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                    )}
                    {isOwner && (
                      <>
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium ${
                            isLocationEnabled
                              ? "bg-blue-100 text-blue-800"
                              : "bg-neutral-200 text-neutral-700"
                          }`}
                        >
                          <MapPin className="w-3 h-3" />
                          {isLocationEnabled
                            ? "Location Enabled"
                            : "Location Disabled"}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 sm:px-2.5 sm:py-0.5 rounded-full text-[9px] sm:text-[10px] font-medium border ${
                            parent.viewType === "question-wise"
                              ? "bg-orange-100 text-orange-800 border-orange-200"
                              : "bg-blue-100 text-blue-800 border-blue-200"
                          }`}
                        >
                          {parent.viewType === "question-wise" ? (
                            <>
                              <Split className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                              Question-wise
                            </>
                          ) : (
                            <>
                              <Layout className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                              Section-wise
                            </>
                          )}
                        </span>
                      </>
                    )}
                  </div>
                  {isOwner && (
                    <div className="flex items-center gap-2 sm:gap-3">
                      <button
                        onClick={() =>
                          handleToggleVisibility(formId, parent.isVisible)
                        }
                        disabled={visibilityMutation.loading}
                        className={`relative inline-flex h-5 w-9 sm:h-6 sm:w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                          parent.isVisible
                            ? "bg-green-500 focus:ring-green-500"
                            : "bg-red-500 focus:ring-red-500"
                        } ${
                          visibilityMutation.loading
                            ? "opacity-50 cursor-not-allowed"
                            : "cursor-pointer"
                        }`}
                        title={
                          parent.isVisible
                            ? "Active - Click to deactivate"
                            : "Inactive - Click to activate"
                        }
                      >
                        <span
                          className={`inline-block h-3 w-3 sm:h-4 sm:w-4 transform rounded-full bg-white transition-transform ${
                            parent.isVisible
                              ? "translate-x-5 sm:translate-x-6"
                              : "translate-x-1"
                          }`}
                        />
                      </button>
                      <button
                        onClick={() =>
                          handleToggleLocation(formId, parent.locationEnabled)
                        }
                        disabled={locationMutation.loading}
                        className={`relative inline-flex h-5 w-9 sm:h-6 sm:w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                          isLocationEnabled
                            ? "bg-primary-600 focus:ring-primary-600"
                            : "bg-neutral-400 focus:ring-neutral-400"
                        } ${
                          locationMutation.loading
                            ? "opacity-50 cursor-not-allowed"
                            : "cursor-pointer"
                        }`}
                        title={
                          isLocationEnabled
                            ? "Location enabled - Click to disable"
                            : "Location disabled - Click to enable"
                        }
                      >
                        <span
                          className={`inline-block h-3 w-3 sm:h-4 sm:w-4 transform rounded-full bg-white transition-transform ${
                            isLocationEnabled
                              ? "translate-x-5 sm:translate-x-6"
                              : "translate-x-1"
                          }`}
                        />
                      </button>
                      <button
                        onClick={() =>
                          handleToggleViewType(parent._id, parent.viewType)
                        }
                        disabled={viewTypeMutation.loading}
                        className={`relative inline-flex h-5 w-9 sm:h-6 sm:w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                          parent.viewType === "question-wise"
                            ? "bg-orange-500 focus:ring-orange-500"
                            : "bg-blue-500 focus:ring-blue-500"
                        } ${
                          viewTypeMutation.loading
                            ? "opacity-50 cursor-not-allowed"
                            : "cursor-pointer"
                        }`}
                        title={
                          parent.viewType === "question-wise"
                            ? "Question-wise view - Click for Section-wise"
                            : "Section-wise view - Click for Question-wise"
                        }
                      >
                        <span
                          className={`inline-block h-3 w-3 sm:h-4 sm:w-4 transform rounded-full bg-white transition-transform ${
                            parent.viewType === "question-wise"
                              ? "translate-x-5 sm:translate-x-6"
                              : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {isOwner && (
                      <>
                        {hasPreviewPermission && (
                          <button
                            onClick={() => navigate(`/forms/${formId}/preview`)}
                            className="flex-1 sm:flex-none px-3 py-2 text-xs sm:text-sm font-medium text-white bg-primary-600 rounded-lg transition-colors hover:bg-primary-700 flex items-center justify-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>
                        )}
                        {(canEdit || hasEditPermission) && (
                          <button
                            onClick={() => navigate(`/forms/${formId}/edit`)}
                            className="flex-1 sm:flex-none px-3 py-2 text-xs sm:text-sm font-medium text-white bg-primary-600 rounded-lg transition-colors hover:bg-primary-700 flex items-center justify-center gap-1.5"
                            title="Edit form"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                        )}
                        {(hasPreviewPermission || hasResponsePermission || hasDashboardPermission || hasOverallPermission || hasQuestionsPermission || hasSectionsPermission) && (
                          <button
                            onClick={() => navigate(`/forms/${formId}/analytics`)}
                            className="flex-1 sm:flex-none px-3 py-2 text-xs sm:text-sm font-medium text-white bg-primary-600 rounded-lg transition-colors hover:bg-primary-700 flex items-center justify-center gap-1.5"
                            title="View analytics"
                          >
                            <BarChart3 className="w-3.5 h-3.5" />
                            <span>Analytics</span>
                          </button>
                        )}
                        {(canManage || hasUploadsPermission || hasResponsePermission) && (
                          <button
                            onClick={() => navigate(`/forms/${formId}/uploads`)}
                            className="flex-1 sm:flex-none px-3 py-2 text-xs sm:text-sm font-medium text-white bg-primary-600 rounded-lg transition-colors hover:bg-primary-700 flex items-center justify-center gap-1.5"
                            title="View uploads"
                          >
                            <Folder className="w-3.5 h-3.5" />
                            <span>Uploads</span>
                          </button>
                        )}
                      </>
                    )}

                    {!isOwner && (
                      <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                        {hasPreviewPermission && (
                          <button
                            onClick={() => navigate(`/forms/${formId}/preview`)}
                            className="flex-1 sm:flex-none px-3 py-2 text-xs sm:text-sm font-medium text-white bg-indigo-600 rounded-lg transition-colors hover:bg-indigo-700 flex items-center justify-center gap-1.5"
                            title="View / Preview Form"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Review</span>
                          </button>
                        )}
                        {hasEditPermission && (
                          <button
                            onClick={() => navigate(`/forms/${formId}/edit`)}
                            className="flex-1 sm:flex-none px-3 py-2 text-xs sm:text-sm font-medium text-white bg-indigo-600 rounded-lg transition-colors hover:bg-indigo-700 flex items-center justify-center gap-1.5"
                            title="Edit form"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                        )}
                        {(hasPreviewPermission || hasResponsePermission || hasDashboardPermission || hasOverallPermission || hasQuestionsPermission || hasSectionsPermission) && (
                          <button
                            onClick={() => navigate(`/forms/${formId}/analytics`)}
                            className="flex-1 sm:flex-none px-3 py-2 text-xs sm:text-sm font-medium text-white bg-indigo-600 rounded-lg transition-colors hover:bg-indigo-700 flex items-center justify-center gap-1.5"
                            title="View Shared Responses"
                          >
                            <List className="w-3.5 h-3.5" />
                            <span>Analytics</span>
                          </button>
                        )}
                        {(hasUploadsPermission || hasResponsePermission) && (
                          <button
                            onClick={() => navigate(`/forms/${formId}/uploads`)}
                            className="flex-1 sm:flex-none px-3 py-2 text-xs sm:text-sm font-medium text-white bg-indigo-600 rounded-lg transition-colors hover:bg-indigo-700 flex items-center justify-center gap-1.5"
                            title="View Shared Uploads"
                          >
                            <Folder className="w-3.5 h-3.5" />
                            <span>Uploads</span>
                          </button>
                        )}
                      </div>
                    )}

                    {children.length > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleChildForms(formId)}
                        className={`flex-1 sm:flex-none px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 border shadow-sm cursor-pointer ${
                          expandedChildFormIds[formId]
                            ? "bg-purple-600 text-white border-purple-700 hover:bg-purple-700 shadow-purple-200"
                            : "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 hover:border-purple-300 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800"
                        }`}
                        title={
                          expandedChildFormIds[formId]
                            ? "Click to collapse follow-up forms"
                            : "Click to expand follow-up forms"
                        }
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Child Forms ({children.length}{totalChildResponses > 0 ? ` • ${totalChildResponses} ${totalChildResponses === 1 ? 'resp' : 'resps'}` : ''})</span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform duration-300 ${
                            expandedChildFormIds[formId] ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                    )}

                    {(((isOwner && canDelete) || hasDuplicatePermission || hasDeletePermission)) && (
                      <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                        {((isOwner && canEdit) || hasDuplicatePermission) && (
                          <button
                            onClick={() => handleDuplicate(formId)}
                            className="flex-1 sm:flex-none px-3 py-2 text-xs sm:text-sm font-medium text-white bg-primary-600 rounded-lg transition-colors hover:bg-primary-700 flex items-center justify-center gap-1.5"
                            title="Duplicate form"
                            disabled={duplicateMutation.loading}
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>Duplicate</span>
                          </button>
                        )}
                        {((isOwner && canDelete) || hasDeletePermission) && (
                          <button
                            onClick={() => handleDelete(formId, parent.title)}
                            className="flex-1 sm:flex-none px-3 py-2 text-xs sm:text-sm font-medium text-white bg-red-600 rounded-lg transition-colors hover:bg-red-700 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Delete form"
                            disabled={deleteMutation.loading && deletingFormId === formId}
                          >
                            {deleteMutation.loading && deletingFormId === formId ? (
                              <>
                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>Deleting...</span>
                              </>
                            ) : (
                              <>
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {children.length > 0 && expandedChildFormIds[formId] && (
                  <div className="border-t border-neutral-200 dark:border-gray-700 mt-6 bg-gradient-to-r from-primary-50/30 to-purple-50/30 -mx-6 px-6 pt-4 pb-6 rounded-b-lg transition-all animate-fadeIn">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-2 rounded-xl bg-purple-100/40 dark:bg-purple-900/20 gap-2">
                      <button
                        type="button"
                        onClick={() => toggleChildForms(formId)}
                        className="flex-1 flex items-center group cursor-pointer text-left focus:outline-none"
                      >
                        <div className="p-2 bg-gradient-to-br from-primary-500 to-purple-500 rounded-lg mr-3 shadow-sm group-hover:scale-105 transition-transform">
                          <Layers className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h4 className="text-base sm:text-lg font-semibold text-primary-800 dark:text-gray-100 flex items-center flex-wrap gap-2">
                            Child Forms
                            <span className="px-2.5 py-0.5 text-xs font-bold bg-gradient-to-r from-primary-500 to-purple-500 text-white rounded-full shadow-sm">
                              {children.length} {children.length === 1 ? "Form" : "Forms"}
                            </span>
                            <span className="px-2.5 py-0.5 text-xs font-bold bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 rounded-full border border-purple-200 dark:border-purple-700 shadow-sm flex items-center gap-1">
                              <Users className="w-3 h-3 text-purple-500" />
                              {totalChildResponses} {totalChildResponses === 1 ? "response" : "responses"}
                            </span>
                          </h4>
                          <p className="text-xs text-primary-600 dark:text-gray-400 mt-0.5">
                            Connected follow-up forms &bull;{" "}
                            <span className="font-medium text-purple-600 dark:text-purple-400">
                              Click to collapse
                            </span>
                          </p>
                        </div>
                      </button>

                      <div className="flex items-center gap-2 pr-1">
                        <span className="hidden sm:inline-block text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/60 px-2.5 py-1 rounded-md border border-purple-200 dark:border-purple-700">
                          Hide Forms
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleChildForms(formId)}
                          className="p-2 rounded-full bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-200 hover:bg-purple-200 dark:group-hover:bg-purple-700 transition-colors shadow-sm"
                        >
                          <ChevronDown className="w-5 h-5 transition-transform duration-300 rotate-180" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4 pt-4 border-t border-purple-100 dark:border-gray-700 animate-fadeIn">
                      {children.map((child, index) => {
                        const childId = child._id || child.id;
                        const childResponseCount = (childId && actualResponseCounts[childId]) || (child.id && actualResponseCounts[child.id]) || (child._id && actualResponseCounts[child._id]) || child.responseCount || 0;
                        
                        // Check if user can view this child form
                        const canViewChild = canViewForm(childId);
                        if (!canViewChild) return null;

                        const childHasPreviewPermission = hasFormAnalyticsPermission(childId, 'preview');
                        const childHasResponsePermission = hasFormAnalyticsPermission(childId, 'response');
                        const childHasDashboardPermission = hasFormAnalyticsPermission(childId, 'dashboard');
                        const childHasOverallPermission = hasFormAnalyticsPermission(childId, 'overall');
                        const childHasQuestionsPermission = hasFormAnalyticsPermission(childId, 'questions');
                        const childHasSectionsPermission = hasFormAnalyticsPermission(childId, 'sections');
                        const childHasEditPermission = hasFormAnalyticsPermission(childId, 'edit');
                        const childHasDuplicatePermission = hasFormAnalyticsPermission(childId, 'duplicate');
                        const childHasDeletePermission = hasFormAnalyticsPermission(childId, 'delete');
                        const childHasUploadsPermission = hasFormAnalyticsPermission(childId, 'uploads');

                        return (
                          <div
                            key={childId}
                            className="relative bg-white dark:bg-gray-900 rounded-xl p-4 border-2 border-primary-100 hover:border-primary-300 hover:shadow-lg transition-all duration-300 group transform hover:-translate-y-1"
                            style={{
                              animationDelay: `${index * 50}ms`,
                              animation: "fadeInUp 0.5s ease-out forwards",
                            }}
                          >
                            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-primary-100 to-purple-100 rounded-bl-full opacity-50"></div>

                            <div className="relative">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center space-x-2">
                                  <div className="p-2.5 bg-gradient-to-br from-primary-500 to-purple-500 rounded-lg shadow-md group-hover:scale-110 transition-transform duration-300">
                                    <FileText className="w-4 h-4 text-white" />
                                  </div>
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-primary-100 to-purple-100 text-primary-700 border border-primary-200">
                                    ✦ Child
                                  </span>
                                </div>
                              </div>

                              <h5 className="font-semibold text-primary-800 mb-2 line-clamp-2 text-sm group-hover:text-primary-600 transition-colors">
                                {child.title}
                              </h5>

                              {child.description && (
                                <p className="text-xs text-primary-600 mb-3 line-clamp-2">
                                  {child.description}
                                </p>
                              )}

                              <div className="flex items-center justify-between text-xs text-primary-600 mb-3 pb-3 border-b border-primary-100">
                                <div className="flex items-center space-x-1">
                                  <Users className="w-3.5 h-3.5 text-primary-500" />
                                  <span className="font-medium">
                                    {childResponseCount}
                                  </span>
                                  <span className="text-primary-500">
                                    responses
                                  </span>
                                </div>
                                {child.createdAt && (
                                  <div className="flex items-center space-x-1 text-primary-500">
                                    <Calendar className="w-3.5 h-3.5" />
                                    <span>
                                      {new Date(
                                        child.createdAt,
                                      ).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                      })}
                                    </span>
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center justify-between gap-2 mt-auto pt-3 border-t border-primary-100">
                                {childHasPreviewPermission && (
                                  <button
                                    onClick={() =>
                                      navigate(`/forms/${childId}/preview`)
                                    }
                                    className="flex-1 min-w-[60px] px-2 py-1.5 text-[10px] sm:text-xs font-medium rounded-lg bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:from-primary-600 hover:to-primary-700 transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center gap-1"
                                    title="View form"
                                  >
                                    <Eye className="w-3 h-3" />
                                    View
                                  </button>
                                )}
                                {((isOwner && canEdit) || childHasEditPermission) && (
                                  <button
                                    onClick={() =>
                                      navigate(`/forms/${childId}/edit`)
                                    }
                                    className="p-1.5 rounded-lg border border-primary-200 text-primary-600 hover:bg-primary-50 transition-colors flex items-center justify-center"
                                    title="Edit form"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {(childHasResponsePermission || childHasDashboardPermission || childHasOverallPermission || childHasQuestionsPermission || childHasSectionsPermission) && (
                                  <button
                                    onClick={() =>
                                      navigate(`/forms/${childId}/analytics`)
                                    }
                                    className={`${
                                      isOwner ? "p-1.5 border border-primary-200 text-primary-600" : "flex-1 px-2 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm flex items-center justify-center gap-1"
                                    } transition-all flex items-center justify-center rounded-lg`}
                                    title="Analytics"
                                  >
                                    <BarChart3 className="w-3.5 h-3.5" />
                                    {!isOwner && (
                                      <span className="ml-1">Analytics</span>
                                    )}
                                  </button>
                                )}
                                <button
                                  onClick={() =>
                                    navigate(`/forms/${childId}/responses`)
                                  }
                                  className={`${
                                    isOwner ? "p-1.5 border border-primary-200 text-primary-600" : "p-1.5 border border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                                  } transition-all rounded-lg flex items-center justify-center`}
                                  title="Responses"
                                >
                                  <List className="w-3.5 h-3.5" />
                                </button>
                                {isOwner && canEdit && (
                                  <button
                                    onClick={() => handleOpenAddFollowUpModal(parent, children)}
                                    className="p-1.5 rounded-lg border border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/40 dark:border-purple-700 dark:text-purple-300 transition-colors flex items-center justify-center"
                                    title={`Add follow-up ${children.length + 1}`}
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {((isOwner && canDelete) || childHasDeletePermission) && (
                                  <button
                                    onClick={() =>
                                      handleDelete(childId, child.title || "")
                                    }
                                    className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Delete"
                                    disabled={deleteMutation.loading && deletingFormId === childId}
                                  >
                                    {deleteMutation.loading && deletingFormId === childId ? (
                                      <div className="w-3.5 h-3.5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      <Trash2 className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Dashed Add Follow-up Card */}
                      {isOwner && canEdit && (
                        <div
                          onClick={() => handleOpenAddFollowUpModal(parent, children)}
                          className="relative flex flex-col items-center justify-center min-h-[190px] border-2 border-dashed border-purple-300 hover:border-purple-500 bg-purple-50/40 hover:bg-purple-50/80 dark:border-purple-800 dark:bg-purple-950/20 dark:hover:bg-purple-950/40 rounded-xl p-4 transition-all duration-300 cursor-pointer group hover:shadow-md"
                        >
                          <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-600 dark:text-purple-300 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-purple-600 group-hover:text-white transition-all shadow-sm">
                            <Plus className="w-6 h-6" />
                          </div>
                          <p className="font-semibold text-sm text-purple-900 dark:text-purple-200 group-hover:text-purple-700 text-center">
                            + Add Follow-up {children.length + 1}
                          </p>
                          <p className="text-xs text-purple-600 dark:text-purple-400 mt-1 text-center">
                            Follow up {children.length + 1}, Follow up x{children.length + 1}, or {getOrdinal(children.length + 1)} Follow-up
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AnswerTemplateImport
        isOpen={isAnswerTemplateOpen}
        onClose={() => setIsAnswerTemplateOpen(false)}
        onSuccess={() => {
          refetchForms();
          refetchResponses();
        }}
      />

      <ImportHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
      />

      {isPreviewOpen && previewFormData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[95vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-primary-800 dark:text-primary-100">
                  Edit Imported Form
                </h2>
                <p className="text-sm text-primary-600 dark:text-primary-400">
                  Modify form details and then save
                </p>
              </div>
              <button
                onClick={handleCancelImport}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-2">
                    Form Title
                  </label>
                  <input
                    type="text"
                    value={previewFormData.title || ""}
                    onChange={(e) =>
                      setPreviewFormData({
                        ...previewFormData,
                        title: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary-500"
                    placeholder="Enter form title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={previewFormData.description || ""}
                    onChange={(e) =>
                      setPreviewFormData({
                        ...previewFormData,
                        description: e.target.value,
                      })
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary-500"
                    placeholder="Enter form description (optional)"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-2">
                      Sections
                    </label>
                    <p className="text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg font-medium">
                      {previewFormData.sections?.length || 0} section(s)
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-2">
                      Total Questions
                    </label>
                    <p className="text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg font-medium">
                      {previewFormData.sections?.reduce(
                        (sum, s) => sum + (s.questions?.length || 0),
                        0,
                      ) || 0}{" "}
                      question(s)
                    </p>
                  </div>
                </div>

                {previewFormData.sections &&
                  previewFormData.sections.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-primary-700 dark:text-primary-300 mb-3">
                        Sections & Questions
                      </label>
                      <div className="space-y-3 max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-800">
                        {previewFormData.sections.map((section, idx) => (
                          <div
                            key={idx}
                            className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700"
                          >
                            <div className="mb-3">
                              <label className="text-xs font-medium text-primary-600 dark:text-primary-400 block mb-1">
                                Section {idx + 1} Title
                              </label>
                              <input
                                type="text"
                                value={section.title || ""}
                                onChange={(e) => {
                                  const updatedSections = [
                                    ...(previewFormData.sections || []),
                                  ];
                                  updatedSections[idx] = {
                                    ...updatedSections[idx],
                                    title: e.target.value,
                                  };
                                  setPreviewFormData({
                                    ...previewFormData,
                                    sections: updatedSections,
                                  });
                                }}
                                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary-500"
                              />
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                              <p className="font-medium">
                                Questions ({section.questions?.length || 0}):
                              </p>
                              {section.questions &&
                                section.questions.length > 0 ? (
                                <ul className="space-y-1 ml-2">
                                  {section.questions.map((q, qIdx) => (
                                    <li
                                      key={qIdx}
                                      className="text-xs text-gray-600 dark:text-gray-400 flex items-start"
                                    >
                                      <span className="mr-2">•</span>
                                      <span className="break-words">
                                        {q.text || `Question ${qIdx + 1}`}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-xs text-gray-500 ml-2">
                                  No questions
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={handleCancelImport}
                  disabled={isSavingForm}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmImport}
                  disabled={isSavingForm || !previewFormData.title?.trim()}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSavingForm ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Form
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Follow-up Modal */}
      {addFollowUpModalOpen && targetParentForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-xl w-full border border-purple-100 dark:border-gray-800 overflow-hidden animate-fadeIn">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-xl">
                  <GitBranch className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Add Follow-up Form</h3>
                  <p className="text-xs text-purple-100">
                    Target Form: <span className="font-semibold text-white">{targetParentForm.title}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAddFollowUpModalOpen(false)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-800 px-6 pt-3 bg-gray-50/50 dark:bg-gray-900/50">
              <button
                onClick={() => setActiveFollowUpTab("create")}
                className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
                  activeFollowUpTab === "create"
                    ? "border-purple-600 text-purple-700 dark:text-purple-400"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <Sparkles className="w-4 h-4" />
                Create New Follow-up
              </button>
              <button
                onClick={() => setActiveFollowUpTab("link")}
                className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
                  activeFollowUpTab === "link"
                    ? "border-purple-600 text-purple-700 dark:text-purple-400"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <Link2 className="w-4 h-4" />
                Link Existing Form
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {activeFollowUpTab === "create" ? (
                <>
                  {/* Sequence & Preset Selection */}
                  <div className="bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-900 dark:text-purple-200 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                        Follow-up Sequence & Preset Names
                      </span>
                      <div className="flex items-center space-x-1.5 bg-white dark:bg-gray-800 px-2 py-1 rounded-lg border border-purple-200 dark:border-purple-700 shadow-sm">
                        <span className="text-xs font-medium text-gray-500 mr-1">Seq:</span>
                        <button
                          type="button"
                          onClick={() => handleSequenceChange(followUpSequenceNumber - 1)}
                          disabled={followUpSequenceNumber <= 1}
                          className="w-5 h-5 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-bold disabled:opacity-40"
                        >
                          -
                        </button>
                        <span className="text-xs font-bold px-1.5 text-purple-700 dark:text-purple-300">
                          {followUpSequenceNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSequenceChange(followUpSequenceNumber + 1)}
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
                            ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                            : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:border-purple-400"
                        }`}
                      >
                        <div className="text-[10px] opacity-75 font-semibold">Standard</div>
                        <div className="font-semibold truncate">Follow up {followUpSequenceNumber}</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApplyPreset("xFormat")}
                        className={`px-3 py-2 rounded-lg text-xs font-medium text-left border transition-all cursor-pointer ${
                          selectedPresetFormat === "xFormat"
                            ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                            : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:border-purple-400"
                        }`}
                      >
                        <div className="text-[10px] opacity-75 font-semibold">x-Format</div>
                        <div className="font-semibold truncate">Follow up x{followUpSequenceNumber}</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApplyPreset("ordinal")}
                        className={`px-3 py-2 rounded-lg text-xs font-medium text-left border transition-all cursor-pointer ${
                          selectedPresetFormat === "ordinal"
                            ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                            : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:border-purple-400"
                        }`}
                      >
                        <div className="text-[10px] opacity-75 font-semibold">Ordinal Format</div>
                        <div className="font-semibold truncate">{getOrdinal(followUpSequenceNumber)} Follow-up</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApplyPreset("child")}
                        className={`px-3 py-2 rounded-lg text-xs font-medium text-left border transition-all cursor-pointer ${
                          selectedPresetFormat === "child"
                            ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                            : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:border-purple-400"
                        }`}
                      >
                        <div className="text-[10px] opacity-75 font-semibold">Child Format</div>
                        <div className="font-semibold truncate">Child Follow-up {followUpSequenceNumber}</div>
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
                      placeholder="e.g. Chassis N603 (Imported) - Follow up 2"
                      className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
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
                      className="w-full px-3.5 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
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
                            ? "border-purple-500 bg-purple-50/50 dark:bg-purple-950/20"
                            : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                        }`}
                      >
                        <input
                          type="radio"
                          name="followUpSource"
                          value="parent"
                          checked={followUpSource === "parent"}
                          onChange={() => setFollowUpSource("parent")}
                          className="mt-0.5 text-purple-600 focus:ring-purple-500"
                        />
                        <div className="ml-2.5">
                          <span className="text-xs font-semibold text-gray-900 dark:text-white block">
                            Copy from Parent
                          </span>
                          <span className="text-[11px] text-gray-500 dark:text-gray-400 block mt-0.5">
                            Duplicate {targetParentForm?.sections?.length || 0} sections & questions
                          </span>
                        </div>
                      </label>

                      <label
                        className={`flex items-start p-3 rounded-xl border cursor-pointer transition-all ${
                          followUpSource === "empty"
                            ? "border-purple-500 bg-purple-50/50 dark:bg-purple-950/20"
                            : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                        }`}
                      >
                        <input
                          type="radio"
                          name="followUpSource"
                          value="empty"
                          checked={followUpSource === "empty"}
                          onChange={() => setFollowUpSource("empty")}
                          className="mt-0.5 text-purple-600 focus:ring-purple-500"
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
                      value={selectedExistingFormId}
                      onChange={(e) => setSelectedExistingFormId(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                    >
                      <option value="">-- Choose a form to link --</option>
                      {availableFormsToLink.map((f: any) => (
                        <option key={f._id || f.id} value={f._id || f.id}>
                          {f.title}
                        </option>
                      ))}
                    </select>
                    {availableFormsToLink.length === 0 && (
                      <p className="text-xs text-amber-600 mt-2">
                        No other unlinked forms found. Create a new follow-up form instead.
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
                onClick={() => setAddFollowUpModalOpen(false)}
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>

              {activeFollowUpTab === "create" ? (
                <>
                  <button
                    type="button"
                    disabled={isCreatingFollowUp || !followUpTitle.trim()}
                    onClick={() => handleCreateFollowUpForm(false)}
                    className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-purple-700 bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/50 dark:text-purple-300 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isCreatingFollowUp ? (
                      <div className="w-3.5 h-3.5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    Quick Create & Link
                  </button>

                  <button
                    type="button"
                    disabled={isCreatingFollowUp || !followUpTitle.trim()}
                    onClick={() => handleCreateFollowUpForm(true)}
                    className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isCreatingFollowUp ? (
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
                  disabled={isCreatingFollowUp || !selectedExistingFormId}
                  onClick={handleLinkExistingFollowUp}
                  className="w-full sm:w-auto px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isCreatingFollowUp ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Link2 className="w-3.5 h-3.5" />
                  )}
                  Link Selected Form
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <EmailInviteModal
        isOpen={emailInviteModal.open}
        onClose={() =>
          setEmailInviteModal((prev) => ({ ...prev, open: false }))
        }
        formId={emailInviteModal.formId || ""}
        formTitle={emailInviteModal.formTitle}
      />
      <WhatsAppInviteModal
        isOpen={whatsappInviteModal.open}
        onClose={() =>
          setWhatsappInviteModal((prev) => ({ ...prev, open: false }))
        }
        formId={whatsappInviteModal.formId || ""}
        formTitle={whatsappInviteModal.formTitle}
      />
      <SMSInviteModal
        isOpen={smsInviteModal.open}
        onClose={() => setSmsInviteModal((prev) => ({ ...prev, open: false }))}
        formId={smsInviteModal.formId || ""}
        formTitle={smsInviteModal.formTitle}
      />
      <ShareAnalyticsModal
        isOpen={shareAnalyticsModal.open}
        onClose={() =>
          setShareAnalyticsModal((prev) => ({ ...prev, open: false }))
        }
        formId={shareAnalyticsModal.formId || ""}
        formTitle={shareAnalyticsModal.formTitle}
        formSchema={forms.find((f: any) => f.id === shareAnalyticsModal.formId || f._id === shareAnalyticsModal.formId)}
      />
      <QualitySummaryModal
        isOpen={isQualitySummaryOpen}
        onClose={() => setIsQualitySummaryOpen(false)}
        forms={(forms || []).map((f: any) => ({ id: f.id || f._id, title: f.title }))}
      />
    </div>
  );
}