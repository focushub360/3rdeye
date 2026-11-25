import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  X,
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Mail,
  Copy,
  Check,
  Loader2,
  ExternalLink,
  ChevronRight,
  Sparkles,
  User,
  Award,
  ShieldAlert,
  ShieldCheck,
  Filter,
  TrendingUp,
  BarChart3,
  ArrowRight,
  Lock,
  Unlock,
  CheckSquare,
  Square,
  RefreshCw,
  AlertCircle,
  Layers,
  HelpCircle
} from "lucide-react";
import {
  downloadBiwReviewTemplate,
  parseBiwReviewWorkbook,
  generateBiwEmailSummaryHtml,
  type BiwExcelRow
} from "../../utils/biwReviewExcelUtils";
import { apiClient } from "../../api/client";
import type { Form } from "../../types/forms";

interface BiwReviewExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  formId: string;
  form?: Form | null;
  formTitle: string;
  mainTenantName?: string;
  targetTenantForm?: any;
  targetTenantTitle?: string;
  targetTenantName?: string;
  currentChassisNumbers?: string[];
  responses?: any[];
  onImportSuccess?: () => void;
}

export const BiwReviewExcelModal: React.FC<BiwReviewExcelModalProps> = ({
  isOpen,
  onClose,
  formId,
  form,
  formTitle,
  mainTenantName,
  targetTenantForm,
  targetTenantTitle,
  targetTenantName,
  currentChassisNumbers = [],
  responses = [],
  onImportSuccess
}) => {
  const [activeTab, setActiveTab] = useState<"import" | "template" | "email">("import");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<BiwExcelRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Filter modes: Modified & New data | Mismatches | All entered | All template rows
  const [filterMode, setFilterMode] = useState<"modified" | "mismatch" | "all_entered" | "all">("modified");

  // Negotiation & Row selection states
  const [skipMismatches, setSkipMismatches] = useState<boolean>(true);
  const [excludedChassisKeys, setExcludedChassisKeys] = useState<Set<string>>(new Set());

  // Confirmation gate to unlock Apply & Import button
  const [isConfirmed, setIsConfirmed] = useState<boolean>(false);
  const [showOkConfirmModal, setShowOkConfirmModal] = useState<boolean>(false);

  const [importResult, setImportResult] = useState<{
    total: number;
    updatedCount: number;
    unmatchedCount: number;
    skippedCount: number;
    errors: Array<{ row: number; chassis: string; error: string }>;
  } | null>(null);

  const [prefillChassis, setPrefillChassis] = useState(true);
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Self-fetch form responses so metadata (worker, previous status) is always available for all units
  const [internalResponses, setInternalResponses] = useState<any[]>([]);

  useEffect(() => {
    if (!isOpen || !formId) return;
    // ⚡ INSTANT IN-MEMORY: If parent component already supplied responses, use them directly without blocking network calls
    if (responses && responses.length > 0) {
      return;
    }
    let isMounted = true;
    const fetchResponses = async () => {
      try {
        // Fetch all responses using getAllResponsesForExport which gets the full dataset for this form
        const list = await apiClient.getAllResponsesForExport(formId);

        let parentList: any[] = [];
        const parentId = (form as any)?.parentFormId || (form as any)?.parentForm?._id || (form as any)?.parentForm?.id;
        if (parentId && parentId !== formId) {
          try {
            const pList = await apiClient.getAllResponsesForExport(parentId);
            parentList = Array.isArray(pList) ? pList : [];
          } catch (_) { }
        }

        if (isMounted) {
          const combined = [...(Array.isArray(list) ? list : []), ...parentList];
          if (combined.length > 0) {
            setInternalResponses(combined);
          }
        }
      } catch (err) {
        console.warn("Could not fetch form responses in modal:", err);
      }
    };

    fetchResponses();
    return () => { isMounted = false; };
  }, [formId, form, isOpen, responses]);

  // Form-level identified chassis question ID
  const formChassisQuestionId = useMemo(() => {
    if (!form?.sections) return null;
    // Priority 1: Tracking / chassisQuestion flag
    for (const s of form.sections) {
      if (s.questions) {
        for (const q of s.questions) {
          if (
            q.trackResponseRank === true ||
            q.trackResponseQuestion === true ||
            q.isTrackingNumber === true ||
            q.isChassisQuestion === true ||
            q.type === "chassisNumber"
          ) {
            return q.id;
          }
        }
      }
    }
    // Priority 2: Title / label mentioning chassis, vin, identification
    for (const s of form.sections) {
      if (s.questions) {
        for (const q of s.questions) {
          const t = String(q.text || q.title || q.label || "").toLowerCase();
          if (
            (t.includes("chassis") ||
              t.includes("vin") ||
              t.includes("identification") ||
              t.includes("id no") ||
              t.includes("id number")) &&
            q.type !== "zone-in" &&
            q.type !== "zone-out"
          ) {
            return q.id;
          }
        }
      }
    }
    return null;
  }, [form]);

  const ignoredUnitNames = useMemo(
    () => new Set(["TVS", "EXCEL IMPORT", "SAIFY", "SRIDEVI", "SREEDEVI", "LMPL", "N/A", "-", "NONE"]),
    []
  );

  // Helper to extract clean chassis string from response using form question ID and robust fallbacks
  const getChassisFromResponse = useCallback(
    (r: any): string => {
      if (!r) return "";
      const a = r.answers || {};

      // 1. Check form-level identified chassis question
      if (formChassisQuestionId && a[formChassisQuestionId] !== undefined && a[formChassisQuestionId] !== null) {
        const val = a[formChassisQuestionId];
        const str = typeof val === "object" ? val?.chassisNumber || val?.value || val?.label : val;
        if (str && String(str).trim() !== "" && !ignoredUnitNames.has(String(str).trim().toUpperCase())) {
          return String(str).trim();
        }
      }
      if (formChassisQuestionId && a[`${formChassisQuestionId}_tracking`] !== undefined && a[`${formChassisQuestionId}_tracking`] !== null) {
        const val = a[`${formChassisQuestionId}_tracking`];
        const str = typeof val === "object" ? val?.chassisNumber || val?.value || val?.label : val;
        if (str && String(str).trim() !== "" && !ignoredUnitNames.has(String(str).trim().toUpperCase())) {
          return String(str).trim();
        }
      }

      // 2. Check candidate keys in answers
      const candidates = [
        "Identification no", "identification no", "Identification No",
        "chassisNumber", "chassis_number", "Chassis Number", "CHASSIS NUMBER",
        "Chassis / VIN", "vin", "VIN", "id_number", "idNumber", "ID Number",
        "cha", "che"
      ];
      for (const c of candidates) {
        if (a[c] !== undefined && a[c] !== null) {
          const raw = a[c];
          const val = typeof raw === "object" ? raw?.chassisNumber || raw?.value || raw?.label : raw;
          if (val && String(val).trim() !== "" && !ignoredUnitNames.has(String(val).trim().toUpperCase())) {
            return String(val).trim();
          }
        }
      }

      // 3. Scan answers for chassis / vin / identification
      for (const [k, v] of Object.entries(a)) {
        const lk = k.toLowerCase();
        if ((lk.includes("chassis") || lk.includes("vin") || lk.includes("identification")) && v) {
          const val = typeof v === "object" ? (v as any)?.chassisNumber || (v as any)?.value || (v as any)?.label : v;
          if (val && String(val).trim() !== "" && !ignoredUnitNames.has(String(val).trim().toUpperCase())) {
            return String(val).trim();
          }
        }
      }

      // 4. Scan alphanumeric string with digits
      for (const v of Object.values(a)) {
        if (typeof v === "string" || typeof v === "number") {
          const str = String(v).trim();
          if (
            str.length >= 2 &&
            str.length <= 30 &&
            /\d/.test(str) &&
            !/^\d{4}-\d{2}-\d{2}/.test(str) &&
            !str.startsWith("http") &&
            !str.startsWith("data:") &&
            !ignoredUnitNames.has(str.toUpperCase()) &&
            !["OK", "NOT OK", "PASS", "FAIL", "REWORK", "REJECT", "REJECTED", "ACCEPTED", "YES", "NO"].includes(str.toUpperCase())
          ) {
            return str;
          }
        }
      }

      // 5. Fallback root fields (excluding plant/tenant names)
      if (r.systemChassisNumber && !ignoredUnitNames.has(String(r.systemChassisNumber).trim().toUpperCase())) {
        return String(r.systemChassisNumber).trim();
      }
      if (r.chassisNumber && !ignoredUnitNames.has(String(r.chassisNumber).trim().toUpperCase())) {
        return String(r.chassisNumber).trim();
      }
      return "";
    },
    [formChassisQuestionId, ignoredUnitNames]
  );

  // All available responses combined and deduplicated by response ID
  const allAvailableResponses = useMemo(() => {
    const map = new Map<string, any>();
    internalResponses.forEach((r) => {
      const id = String(r._id || r.id || "");
      if (id) map.set(id, r);
    });
    responses.forEach((r) => {
      const id = String(r._id || r.id || "");
      if (id) map.set(id, r);
    });
    return Array.from(map.values());
  }, [internalResponses, responses]);

  // Available unique chassis numbers in database/table
  const uniqueChassisList = useMemo(() => {
    const set = new Set<string>();
    currentChassisNumbers.forEach((c) => {
      const s = String(c || "").trim();
      if (s && !ignoredUnitNames.has(s.toUpperCase())) set.add(s);
    });
    allAvailableResponses.forEach((r) => {
      const ch = getChassisFromResponse(r);
      if (ch && !ignoredUnitNames.has(ch.toUpperCase())) {
        set.add(ch);
      }
    });
    return Array.from(set);
  }, [currentChassisNumbers, allAvailableResponses, getChassisFromResponse, ignoredUnitNames]);

  // Lookup map to associate chassis with response metadata (inspector/worker, previous status, etc.)
  // Prioritizes responses with review data and latest updates
  const responseByChassisMap = useMemo(() => {
    const map = new Map<string, any>();
    allAvailableResponses.forEach((r) => {
      const ch = getChassisFromResponse(r);
      if (!ch) return;
      const raw = ch.trim();
      const norm = raw.toUpperCase();
      const stripped = norm.replace(/\s+/g, "");

      const existing = map.get(norm);
      const hasBiw = Boolean(r.biwReview && r.biwReview.status);
      const hasTvs = Boolean(r.review && (r.review.reviewOption || r.review.status));
      const score = (hasBiw ? 2 : 0) + (hasTvs ? 1 : 0);

      const existingScore = existing
        ? (existing.biwReview?.status ? 2 : 0) + (existing.review?.reviewOption || existing.review?.status ? 1 : 0)
        : -1;

      if (!existing || score > existingScore) {
        map.set(norm, r);
        map.set(stripped, r);
        map.set(raw, r);
      } else if (score === existingScore) {
        const curTime = new Date(r.updatedAt || r.createdAt || 0).getTime();
        const exTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
        if (curTime > exTime) {
          map.set(norm, r);
          map.set(stripped, r);
          map.set(raw, r);
        }
      }
    });
    return map;
  }, [allAvailableResponses, getChassisFromResponse]);

  // Current Dashboard Statistics before import (calculated across distinct prioritized chassis responses)
  const currentDashboardStats = useMemo(() => {
    let biwAccepted = 0;
    let biwRework = 0;
    let biwRejected = 0;
    let tvsAccepted = 0;
    let tvsRework = 0;
    let tvsRejected = 0;

    // Use distinct prioritized chassis responses
    const distinctResponses = Array.from(new Set(responseByChassisMap.values()));

    distinctResponses.forEach((r) => {
      const biwStatus = (r?.biwReview?.status || "").toLowerCase().trim();
      if (biwStatus.includes("accept")) biwAccepted++;
      else if (biwStatus.includes("rework") || biwStatus.includes("reworked")) biwRework++;
      else if (biwStatus.includes("reject")) biwRejected++;

      const tvsOpt = (r?.review?.reviewOption || r?.review?.status || "").toLowerCase().trim();
      if (tvsOpt.includes("accept")) tvsAccepted++;
      else if (tvsOpt.includes("rework") || tvsOpt.includes("defect") || tvsOpt.includes("reworked")) tvsRework++;
      else if (tvsOpt.includes("reject")) tvsRejected++;
    });

    const totalInspected = uniqueChassisList.length || distinctResponses.length || allAvailableResponses.length;
    const totalBiwReviewed = biwAccepted + biwRework + biwRejected;
    const biwAcceptRate = totalBiwReviewed > 0 ? (biwAccepted / totalBiwReviewed) * 100 : 0;
    const biwPending = Math.max(0, totalInspected - totalBiwReviewed);

    const totalTvsReviewed = tvsAccepted + tvsRework + tvsRejected;
    const tvsAcceptRate = totalTvsReviewed > 0 ? (tvsAccepted / totalTvsReviewed) * 100 : 0;
    const tvsPending = Math.max(0, totalInspected - totalTvsReviewed);

    return {
      totalInspected,
      biwAccepted,
      biwRework,
      biwRejected,
      totalBiwReviewed,
      biwAcceptRate,
      biwPending,
      tvsAccepted,
      tvsRework,
      tvsRejected,
      totalTvsReviewed,
      tvsAcceptRate,
      tvsPending
    };
  }, [responseByChassisMap, uniqueChassisList, allAvailableResponses]);

  // Enrich parsed rows with worker attribution, review data checks, and change detection
  const enrichedParsedRows = useMemo(() => {
    // Canonical status normalizer helper
    const normalizeStatus = (val: string) => {
      const s = (val || "").toLowerCase().trim();
      if (s.includes("accept")) return "accepted";
      if (s.includes("rework")) return "rework";
      if (s.includes("reject")) return "rejected";
      return s;
    };

    return parsedRows.map((r) => {
      const rawCh = (r.chassisNumber || "").trim();
      const chKey = rawCh.toUpperCase();
      const chKeyStripped = chKey.replace(/\s+/g, "");
      const matchedResp = responseByChassisMap.get(chKey) || responseByChassisMap.get(chKeyStripped) || responseByChassisMap.get(rawCh);
      const isMatched = Boolean(matchedResp);
      const isMismatch = !isMatched;

      const workerName = (matchedResp?.submittedBy || matchedResp?.createdBy?.name || (matchedResp ? "Inspector" : "Unassigned")).trim();
      const currentStatus = matchedResp?.status || "Pending";

      const biwFb = (r.biwFeedback || "").trim();
      const biwRea = (r.biwReason || "").trim();
      const biwRem = (r.biwRemark || "").trim();
      const biwFile = (r.biwFileUrl || "").trim();

      const tvsFb = (r.tvsFeedback || "").trim();
      const tvsRea = (r.tvsReason || r.tvsRejectReason || "").trim();
      const tvsRem = (r.tvsRemark || "").trim();
      const tvsFile = (r.tvsFileUrl || "").trim();

      const targetTvsFb = (r.targetTvsFeedback || "").trim();
      const targetTvsRea = (r.targetTvsReason || r.targetTvsRejectReason || "").trim();
      const targetTvsRem = (r.targetTvsRemark || "").trim();
      const targetTvsFile = (r.targetTvsFileUrl || "").trim();

      const hasReviewData = Boolean(
        biwFb || biwRea || biwRem || biwFile ||
        tvsFb || tvsRea || tvsRem || tvsFile ||
        targetTvsFb || targetTvsRea || targetTvsRem || targetTvsFile
      );

      // Check DB existing reviews
      const dbBiwStatus = matchedResp?.biwReview?.status ? String(matchedResp.biwReview.status).toLowerCase().trim() : "";
      const dbBiwReason = (matchedResp?.biwReview?.reason || matchedResp?.biwReview?.flaggedQuestions?.[0]?.questionText || "").trim().toLowerCase();
      const dbBiwRemark = (matchedResp?.biwReview?.remark || "").trim();

      const dbTvsStatus = (matchedResp?.review?.reviewOption || matchedResp?.review?.status)
        ? String(matchedResp.review.reviewOption || matchedResp.review.status).toLowerCase().trim()
        : "";
      const dbTvsReason = (matchedResp?.review?.reason || "").trim().toLowerCase();
      const dbTvsRemark = (matchedResp?.review?.remark || "").trim();

      // Normalization
      const normBiwFb = normalizeStatus(biwFb);
      const normPrevBiw = normalizeStatus(dbBiwStatus);
      const normTvsFb = normalizeStatus(tvsFb);
      const normPrevTvs = normalizeStatus(dbTvsStatus);

      const isBiwChanged = Boolean(biwFb && (normBiwFb !== normPrevBiw || (biwRea && biwRea.toLowerCase() !== dbBiwReason)));
      const isTvsChanged = Boolean(tvsFb && (normTvsFb !== normPrevTvs || (tvsRea && tvsRea.toLowerCase() !== dbTvsReason)));
      const isTargetTvsChanged = Boolean(targetTvsFb || targetTvsRea);
      const isRemarkChanged = Boolean((biwRem && biwRem !== dbBiwRemark) || (tvsRem && tvsRem !== dbTvsRemark) || targetTvsRem);

      let changeType: "brand_new" | "modified" | "mismatch" | "unchanged" | "empty" = "empty";
      let changeLabel = "Unchanged";
      let changeDescription = "No changes";

      if (isMismatch) {
        changeType = "mismatch";
        changeLabel = "Chassis Mismatch";
        changeDescription = "Chassis not found in form";
      } else if (!normPrevBiw && !normPrevTvs && hasReviewData) {
        changeType = "brand_new";
        changeLabel = "New Review";
        changeDescription = `Initial review: ${biwFb || tvsFb || 'Entered'}`;
      } else if (hasReviewData && (isBiwChanged || isTvsChanged || isTargetTvsChanged || isRemarkChanged || biwFile || tvsFile)) {
        changeType = "modified";
        changeLabel = "Modified Data";
        const diffs: string[] = [];
        if (isBiwChanged) diffs.push(`BIW: ${matchedResp?.biwReview?.status || 'None'} ➔ ${biwFb}`);
        if (isTvsChanged) diffs.push(`TVS: ${matchedResp?.review?.reviewOption || matchedResp?.review?.status || 'None'} ➔ ${tvsFb}`);
        if (isTargetTvsChanged) diffs.push(`2nd TVS: ${targetTvsFb}`);
        if (isRemarkChanged) diffs.push("Remarks updated");
        changeDescription = diffs.join(" | ") || "Updated review";
      } else if (hasReviewData) {
        changeType = "unchanged";
        changeLabel = "Unchanged";
        changeDescription = "Identical to current DB review";
      }

      const isBrandNew = changeType === "brand_new";
      const isModified = changeType === "modified";
      const isNewlyEnteredOrModified = isBrandNew || isModified;

      // Defect impact:
      const allFeedbackStr = `${biwFb} ${tvsFb} ${targetTvsFb}`.toLowerCase();
      const isDefect = allFeedbackStr.includes("rework") || allFeedbackStr.includes("reject") || Boolean(biwRea || tvsRea || targetTvsRea);
      const isAccepted = !isDefect && allFeedbackStr.includes("accept");

      return {
        ...r,
        workerName,
        currentStatus,
        hasReviewData,
        isMatched,
        isMismatch,
        prevBiwStatus: normPrevBiw,
        prevBiwReason: dbBiwReason,
        prevTvsStatus: normPrevTvs,
        prevTvsReason: dbTvsReason,
        isBrandNew,
        isModified,
        isNewlyEnteredOrModified,
        changeType,
        changeLabel,
        changeDescription,
        isDefect,
        isAccepted
      };
    });
  }, [parsedRows, responseByChassisMap]);

  // Slices for tabs and metrics
  const mismatchedRows = useMemo(() => {
    return enrichedParsedRows.filter((r) => r.isMismatch && r.hasReviewData);
  }, [enrichedParsedRows]);

  const modifiedRows = useMemo(() => {
    return enrichedParsedRows.filter((r) => r.changeType === "modified");
  }, [enrichedParsedRows]);

  const brandNewRows = useMemo(() => {
    return enrichedParsedRows.filter((r) => r.changeType === "brand_new");
  }, [enrichedParsedRows]);

  const modifiedAndNewRows = useMemo(() => {
    return enrichedParsedRows.filter(
      (r) => (r.changeType === "modified" || r.changeType === "brand_new") && (!skipMismatches || !r.isMismatch)
    );
  }, [enrichedParsedRows, skipMismatches]);

  const allEnteredRows = useMemo(() => {
    return enrichedParsedRows.filter((r) => r.hasReviewData);
  }, [enrichedParsedRows]);

  // Reviews to actually import based on negotiation & row exclusions
  const rowsToImport = useMemo(() => {
    return enrichedParsedRows.filter((r) => {
      if (!r.hasReviewData) return false;
      const chKey = (r.chassisNumber || "").trim().toUpperCase();
      if (excludedChassisKeys.has(chKey)) return false;
      if (r.isMismatch && skipMismatches) return false;
      return true;
    });
  }, [enrichedParsedRows, excludedChassisKeys, skipMismatches]);

  // Slices for table display
  const displayedRows = useMemo(() => {
    if (filterMode === "modified") {
      return modifiedAndNewRows.length > 0 ? modifiedAndNewRows : allEnteredRows;
    }
    if (filterMode === "mismatch") {
      return mismatchedRows;
    }
    if (filterMode === "all_entered") {
      return allEnteredRows;
    }
    return enrichedParsedRows;
  }, [filterMode, modifiedAndNewRows, mismatchedRows, allEnteredRows, enrichedParsedRows]);

  // Impact Add-up calculation & Projected Dashboard Metrics
  const impactSummary = useMemo(() => {
    let biwNewAccepted = 0;
    let biwNewRework = 0;
    let biwNewRejected = 0;

    let tvsNewAccepted = 0;
    let tvsNewRework = 0;
    let tvsNewRejected = 0;

    let newReviewsCount = 0;
    let modifiedReviewsCount = 0;
    let unchangedReviewsCount = 0;
    let mismatchReviewsCount = 0;

    rowsToImport.forEach((r) => {
      if (r.isMismatch) {
        mismatchReviewsCount++;
      } else if (r.isBrandNew) {
        newReviewsCount++;
      } else if (r.isModified) {
        modifiedReviewsCount++;
      } else {
        unchangedReviewsCount++;
      }

      // ONLY calculate deltas for rows that are genuinely new or modified!
      // Unchanged rows add ZERO delta to the dashboard counters!
      if (!r.isBrandNew && !r.isModified) {
        return;
      }

      // BIW delta calculation
      const biwStatus = (r.biwFeedback || "").toLowerCase().trim();
      const prevBiw = r.prevBiwStatus;

      if (biwStatus.includes("accept")) {
        if (!prevBiw.includes("accept")) biwNewAccepted++;
      } else if (biwStatus.includes("rework")) {
        if (!prevBiw.includes("rework")) biwNewRework++;
      } else if (biwStatus.includes("reject")) {
        if (!prevBiw.includes("reject")) biwNewRejected++;
      }

      // TVS delta calculation
      const tvsStatus = (r.tvsFeedback || "").toLowerCase().trim();
      const prevTvs = r.prevTvsStatus;

      if (tvsStatus.includes("accept")) {
        if (!prevTvs.includes("accept")) tvsNewAccepted++;
      } else if (tvsStatus.includes("rework") || tvsStatus.includes("defect")) {
        if (!prevTvs.includes("rework") && !prevTvs.includes("defect")) tvsNewRework++;
      } else if (tvsStatus.includes("reject")) {
        if (!prevTvs.includes("reject")) tvsNewRejected++;
      }
    });

    const projectedBiwAccepted = currentDashboardStats.biwAccepted + biwNewAccepted;
    const projectedBiwRework = currentDashboardStats.biwRework + biwNewRework;
    const projectedBiwRejected = currentDashboardStats.biwRejected + biwNewRejected;
    const projectedTotalBiw = projectedBiwAccepted + projectedBiwRework + projectedBiwRejected;
    const projectedBiwRate = projectedTotalBiw > 0 ? (projectedBiwAccepted / projectedTotalBiw) * 100 : 0;
    const projectedBiwPending = Math.max(0, currentDashboardStats.biwPending - (biwNewAccepted + biwNewRework + biwNewRejected));

    const projectedTvsAccepted = currentDashboardStats.tvsAccepted + tvsNewAccepted;
    const projectedTvsRework = currentDashboardStats.tvsRework + tvsNewRework;
    const projectedTvsRejected = currentDashboardStats.tvsRejected + tvsNewRejected;
    const projectedTotalTvs = projectedTvsAccepted + projectedTvsRework + projectedTvsRejected;
    const projectedTvsRate = projectedTotalTvs > 0 ? (projectedTvsAccepted / projectedTotalTvs) * 100 : 0;
    const projectedTvsPending = Math.max(0, currentDashboardStats.tvsPending - (tvsNewAccepted + tvsNewRework + tvsNewRejected));

    return {
      biwNewAccepted,
      biwNewRework,
      biwNewRejected,
      biwTotalDelta: biwNewAccepted + biwNewRework + biwNewRejected,
      tvsNewAccepted,
      tvsNewRework,
      tvsNewRejected,
      tvsTotalDelta: tvsNewAccepted + tvsNewRework + tvsNewRejected,
      newReviewsCount,
      modifiedReviewsCount,
      unchangedReviewsCount,
      mismatchReviewsCount,
      projectedBiwAccepted,
      projectedBiwRework,
      projectedBiwRejected,
      projectedBiwRate,
      projectedBiwPending,
      projectedTvsAccepted,
      projectedTvsRework,
      projectedTvsRejected,
      projectedTvsRate,
      projectedTvsPending
    };
  }, [rowsToImport, currentDashboardStats]);

  // Checkbox row toggles
  const toggleRowInclusion = (chassisNumber: string) => {
    const chKey = chassisNumber.trim().toUpperCase();
    setExcludedChassisKeys((prev) => {
      const next = new Set(prev);
      if (next.has(chKey)) {
        next.delete(chKey);
      } else {
        next.add(chKey);
      }
      return next;
    });
    // Modifying selection requires re-confirming
    setIsConfirmed(false);
  };

  const allDisplayedIncluded = useMemo(() => {
    if (displayedRows.length === 0) return false;
    return displayedRows.every((r) => {
      const chKey = (r.chassisNumber || "").trim().toUpperCase();
      if (r.isMismatch && skipMismatches) return false;
      return !excludedChassisKeys.has(chKey);
    });
  }, [displayedRows, excludedChassisKeys, skipMismatches]);

  const toggleAllDisplayedRows = () => {
    setExcludedChassisKeys((prev) => {
      const next = new Set(prev);
      if (allDisplayedIncluded) {
        // Exclude all displayed
        displayedRows.forEach((r) => {
          const chKey = (r.chassisNumber || "").trim().toUpperCase();
          next.add(chKey);
        });
      } else {
        // Include all displayed
        displayedRows.forEach((r) => {
          const chKey = (r.chassisNumber || "").trim().toUpperCase();
          next.delete(chKey);
        });
      }
      return next;
    });
    setIsConfirmed(false);
  };

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setIsParsing(true);
    setImportResult(null);
    setIsConfirmed(false);
    setExcludedChassisKeys(new Set());

    try {
      const rows = await parseBiwReviewWorkbook(file);
      // Mark whether chassis matches current form data
      const chassisSet = new Set(uniqueChassisList.map((c) => c.toUpperCase()));
      const annotated = rows.map((r) => ({
        ...r,
        matched: chassisSet.has(r.chassisNumber.toUpperCase())
      }));
      setParsedRows(annotated);
      // Default to showing modified & new data alone
      setFilterMode("modified");
    } catch (err: any) {
      alert(`Error reading Excel file: ${err.message || String(err)}`);
      setParsedRows([]);
    } finally {
      setIsParsing(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const resolvedTargetTenantName =
        targetTenantName ||
        (typeof targetTenantForm?.tenantId === "object"
          ? targetTenantForm?.tenantId?.name || targetTenantForm?.tenantId?.title
          : targetTenantForm?.organizationName || "");

      const resolvedMainTenantName =
        mainTenantName ||
        (typeof form?.tenantId === "object"
          ? (form?.tenantId as any)?.name || (form?.tenantId as any)?.title
          : "");

      let responsesToUse = responses || [];
      const formIdToFetch = (form as any)?._id || (form as any)?.id;
      if (prefillChassis && formIdToFetch) {
        try {
          const allExport = await apiClient.getAllResponsesForExport(String(formIdToFetch));
          if (allExport && allExport.length > 0) {
            responsesToUse = allExport;
          }
        } catch (_) { }
      }

      let detectedTenant = "";
      for (const r of responsesToUse) {
        const candidate = r.systemChassisNumber || r.rawChassisNumber || r.chassisNumber || r.plant || r.tenantName || r.answers?.chassis_number;
        if (typeof candidate === "string" && ["Saify", "LMPL", "Sreedevi", "TVS", "Nahars"].some(t => t.toLowerCase() === candidate.trim().toLowerCase())) {
          detectedTenant = candidate.trim().toUpperCase() === "SAIFY" ? "Saify" : candidate.trim().toUpperCase() === "LMPL" ? "LMPL" : candidate.trim();
          break;
        }
      }

      const finalMainTenant = detectedTenant || resolvedMainTenantName || "Saify";

      const reviewerOptionsList = Array.from(
        new Set(
          responsesToUse
            .map((r: any) => r.biwReview?.reviewedByName || r.submittedBy)
            .filter((n: string) => n && n !== "Excel Import" && n !== "Anonymous")
        )
      );

      await downloadBiwReviewTemplate({
        form,
        formTitle,
        mainTenantName: finalMainTenant,
        chassisNumbers: prefillChassis ? uniqueChassisList : [],
        responses: responsesToUse,
        reviewerOptions: reviewerOptionsList,
        targetTenantForm,
        targetTenantTitle,
        targetTenantName: resolvedTargetTenantName,
        filename: `BIW template - ${(formTitle || "Inspection").replace(/[^a-zA-Z0-9_-]/g, "_")}.xlsx`
      });
    } catch (err: any) {
      alert(`Error downloading template: ${err.message || err}`);
    }
  };

  const handleExecuteImport = () => {
    if (!isConfirmed) {
      alert("Please review the impact projection and check the confirmation box to enable import.");
      return;
    }

    if (rowsToImport.length === 0) {
      alert("No review rows selected to import.");
      return;
    }

    // Only if user confirms "OK" in the confirmation dialog will it apply
    setShowOkConfirmModal(true);
  };

  const executeActualImport = async () => {
    setShowOkConfirmModal(false);
    setIsImporting(true);
    setImportResult(null);

    try {
      const res = await apiClient.importBiwReviews(
        formId,
        rowsToImport,
        selectedFile?.name || "BIW_Review_Import.xlsx"
      );

      const resultData = (res && (res as any).data) ? (res as any).data : res;

      if (resultData && typeof resultData.updatedCount === "number") {
        setImportResult(resultData);
        if (onImportSuccess && resultData.updatedCount > 0) {
          onImportSuccess();
        }
      } else {
        throw new Error((res as any)?.message || "Import failed");
      }
    } catch (err: any) {
      alert(`Failed to import reviews: ${err.message || String(err)}`);
    } finally {
      setIsImporting(false);
    }
  };

  // Email content
  const emailDraft = generateBiwEmailSummaryHtml({
    formTitle,
    rows: parsedRows.length > 0 ? parsedRows : uniqueChassisList.map((c) => ({ chassisNumber: c }))
  });

  const handleCopyEmailHtml = () => {
    navigator.clipboard.writeText(emailDraft.html);
    setCopiedHtml(true);
    setTimeout(() => setCopiedHtml(false), 2000);
  };

  const handleCopyEmailText = () => {
    navigator.clipboard.writeText(emailDraft.text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md border border-white/20">
              <FileSpreadsheet className="w-6 h-6 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold tracking-tight">BIW Review Excel Suite</h3>
                <span className="px-2 py-0.5 text-xs font-semibold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 rounded-full">
                  Automated Dropdowns
                </span>
                <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 rounded-full flex items-center gap-1">
                  <BarChart3 className="w-3 h-3" />
                  Dashboard Impact Live
                </span>
              </div>
              <p className="text-xs text-indigo-200/80">
                Bulk upload, dropdown validations, defect reason routing & email templates for {formTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/50 px-6 gap-2">
          <button
            onClick={() => setActiveTab("import")}
            className={`py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 transition-all ${activeTab === "import"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
              : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
          >
            <Upload className="w-4 h-4" />
            Import Filled Excel
            {parsedRows.length > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 rounded-full">
                {parsedRows.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("template")}
            className={`py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 transition-all ${activeTab === "template"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
              : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
          >
            <Download className="w-4 h-4" />
            BIW Template
          </button>
          <button
            onClick={() => setActiveTab("email")}
            className={`py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 transition-all ${activeTab === "email"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
              : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
          >
            <Mail className="w-4 h-4" />
            Email Report Template
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* TAB 1: IMPORT */}
          {activeTab === "import" && (
            <div className="space-y-5">
              {/* File Drop Area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer border-2 border-dashed border-indigo-200 dark:border-indigo-800 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-2xl p-5 text-center bg-indigo-50/30 dark:bg-indigo-950/20 hover:bg-indigo-50/70 transition-all group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx, .xls"
                  className="hidden"
                />
                <div className="w-10 h-10 mx-auto rounded-full bg-indigo-100 dark:bg-indigo-900/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform mb-2">
                  <Upload className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-0.5">
                  {selectedFile ? selectedFile.name : "Click to select or drag & drop filled Excel workbook"}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {selectedFile
                    ? `${(selectedFile.size / 1024).toFixed(1)} KB — Ready to analyze impact & update`
                    : "Supports .xlsx with BIW Feedback, Defect Checkpoints, TVS Reviews & Remarks"}
                </p>
              </div>

              {/* Import Results Banner */}
              {importResult && (
                <div
                  className={`p-4 rounded-xl border ${importResult.updatedCount > 0
                    ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-900 dark:text-green-200"
                    : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200"
                    }`}
                >
                  <div className="flex items-center gap-2 mb-2 font-bold text-sm">
                    {importResult.updatedCount > 0 ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600" />
                    )}
                    Import Completed: {importResult.updatedCount} chassis reviews updated successfully
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs font-semibold">
                    <span>Total Rows: {importResult.total}</span>
                    <span className="text-green-600">Updated: {importResult.updatedCount}</span>
                    {importResult.unmatchedCount > 0 && (
                      <span className="text-amber-600">Unmatched Chassis: {importResult.unmatchedCount}</span>
                    )}
                    {importResult.skippedCount > 0 && (
                      <span className="text-gray-500">Skipped: {importResult.skippedCount}</span>
                    )}
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-red-200 dark:border-red-800 text-xs">
                      <div className="font-semibold text-red-700 dark:text-red-300 mb-1">Unmatched Items:</div>
                      <ul className="list-disc list-inside space-y-0.5 text-red-600 dark:text-red-400">
                        {importResult.errors.slice(0, 5).map((err, i) => (
                          <li key={i}>
                            Row {err.row}: Chassis <strong>{err.chassis}</strong> — {err.error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Loading State */}
              {isParsing && (
                <div className="flex items-center justify-center p-8 text-gray-500 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                  <span className="text-sm">Reading, verifying mismatches & calculating dashboard impact...</span>
                </div>
              )}

              {/* DASHBOARD IMPACT & ADD-UP PROJECTION PANEL */}
              {!isParsing && parsedRows.length > 0 && (
                <div className="space-y-4">
                  {/* PROJECTED DASHBOARD LIVE PREVIEW CARD - LIGHT GRADIENT DESIGN */}
                  <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-slate-50 via-indigo-50/25 to-blue-50/30 text-slate-900 border border-slate-200/90 shadow-sm space-y-4">
                    {/* Header */}
                    <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-200/80">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-white text-indigo-600 rounded-xl border border-slate-200 shadow-xs">
                          <BarChart3 className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-base font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
                            Projected Dashboard Impact
                            <span className="px-2.5 py-0.5 text-xs font-semibold tracking-wider bg-white text-emerald-700 border border-emerald-200/80 rounded-full flex items-center gap-1 shadow-2xs">
                              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                              Live Preview
                            </span>
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Real-time projection of how this Excel import will directly impact the Service Analytics BIW & TVS Quality KPIs
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Import Target</div>
                          <div className="text-sm sm:text-base font-black text-slate-900">
                            {impactSummary.newReviewsCount + impactSummary.modifiedReviewsCount > 0
                              ? `+${impactSummary.newReviewsCount + impactSummary.modifiedReviewsCount} Updates`
                              : `0 Updates (${impactSummary.unchangedReviewsCount} in DB)`}
                          </div>
                        </div>
                        <div className="h-8 w-px bg-slate-200 mx-1" />
                        <div className="text-right">
                          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Pending Cleared</div>
                          <div className="text-sm sm:text-base font-black text-slate-700">
                            -{impactSummary.newReviewsCount} Units
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 2 Side-by-Side Panels: BIW Quality Impact & TVS Quality Impact (Light Theme Gradients) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* LEFT PANEL: BIW QUALITY IMPACT */}
                      <div className="p-4 sm:p-5 rounded-xl bg-white/90 border border-slate-200 shadow-xs flex flex-col justify-between space-y-3.5">
                        {/* Panel Header */}
                        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                            <h5 className="text-xs sm:text-sm font-bold text-slate-800 tracking-wide uppercase">
                              BIW Quality Dashboard (Internal Inspection)
                            </h5>
                          </div>
                          <span className="px-2.5 py-0.5 text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 rounded-md">
                            +{impactSummary.biwTotalDelta} Total Updates
                          </span>
                        </div>

                        {/* 2 KPI Tiles side-by-side */}
                        <div className="grid grid-cols-2 gap-3">
                          {/* BIW Accepted Tile */}
                          <div className="p-3.5 rounded-lg bg-gradient-to-b from-slate-50 to-slate-100/50 border border-slate-200/80 flex flex-col justify-between shadow-2xs">
                            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
                              <span className="uppercase tracking-wider">BIW Accepted</span>
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            </div>
                            <div className="flex items-baseline gap-2 my-1">
                              <span className="text-2xl sm:text-3xl font-black text-slate-900">
                                {impactSummary.projectedBiwAccepted}
                              </span>
                              <span className="text-xs sm:text-sm text-slate-400 font-medium line-through">
                                {currentDashboardStats.biwAccepted}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                              <span>+{impactSummary.biwNewAccepted} Units Added</span>
                            </div>
                          </div>

                          {/* BIW Defects / Rework Tile */}
                          <div className="p-3.5 rounded-lg bg-gradient-to-b from-slate-50 to-slate-100/50 border border-slate-200/80 flex flex-col justify-between shadow-2xs">
                            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
                              <span className="uppercase tracking-wider">BIW Defects / Rework</span>
                              <AlertTriangle className="w-4 h-4 text-amber-600" />
                            </div>
                            <div className="flex items-baseline gap-2 my-1">
                              <span className="text-2xl sm:text-3xl font-black text-slate-900">
                                {impactSummary.projectedBiwRework}
                              </span>
                              <span className="text-xs sm:text-sm text-slate-400 font-medium line-through">
                                {currentDashboardStats.biwRework}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                              <span>+{impactSummary.biwNewRework} Defects Flagged</span>
                            </div>
                          </div>
                        </div>

                        {/* BIW Acceptance Rate Bar */}
                        <div className="p-3 rounded-lg bg-slate-50/80 border border-slate-200/70 space-y-2">
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                            <span>BIW Acceptance Rate:</span>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500">{currentDashboardStats.biwAcceptRate.toFixed(1)}%</span>
                              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-slate-900 font-black text-sm">
                                {impactSummary.projectedBiwRate.toFixed(1)}%
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-bold">
                                {impactSummary.projectedBiwRate >= currentDashboardStats.biwAcceptRate ? "+" : ""}
                                {(impactSummary.projectedBiwRate - currentDashboardStats.biwAcceptRate).toFixed(1)}%
                              </span>
                            </div>
                          </div>
                          {/* Visual Progress Bar */}
                          <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden flex shadow-inner">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, Math.max(0, impactSummary.projectedBiwRate))}%` }}
                              title={`Projected: ${impactSummary.projectedBiwRate.toFixed(1)}%`}
                            />
                          </div>
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>Pending to inspect: <strong className="text-slate-700">{impactSummary.projectedBiwPending}</strong></span>
                            <span>Total reviewed: <strong className="text-slate-700">{impactSummary.projectedTotalBiw}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* RIGHT PANEL: TVS QUALITY IMPACT */}
                      <div className="p-4 sm:p-5 rounded-xl bg-white/90 border border-slate-200 shadow-xs flex flex-col justify-between space-y-3.5">
                        {/* Panel Header */}
                        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                            <h5 className="text-xs sm:text-sm font-bold text-slate-800 tracking-wide uppercase">
                              TVS Quality Dashboard (OEM / Customer Review)
                            </h5>
                          </div>
                          <span className="px-2.5 py-0.5 text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 rounded-md">
                            +{impactSummary.tvsTotalDelta} Total Updates
                          </span>
                        </div>

                        {/* 2 KPI Tiles side-by-side */}
                        <div className="grid grid-cols-2 gap-3">
                          {/* TVS Accepted Tile */}
                          <div className="p-3.5 rounded-lg bg-gradient-to-b from-slate-50 to-slate-100/50 border border-slate-200/80 flex flex-col justify-between shadow-2xs">
                            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
                              <span className="uppercase tracking-wider">TVS Accepted</span>
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            </div>
                            <div className="flex items-baseline gap-2 my-1">
                              <span className="text-2xl sm:text-3xl font-black text-slate-900">
                                {impactSummary.projectedTvsAccepted}
                              </span>
                              <span className="text-xs sm:text-sm text-slate-400 font-medium line-through">
                                {currentDashboardStats.tvsAccepted}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                              <span>+{impactSummary.tvsNewAccepted} Units Added</span>
                            </div>
                          </div>

                          {/* TVS Defects / Rework Tile */}
                          <div className="p-3.5 rounded-lg bg-gradient-to-b from-slate-50 to-slate-100/50 border border-slate-200/80 flex flex-col justify-between shadow-2xs">
                            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
                              <span className="uppercase tracking-wider">TVS Defects / Rework</span>
                              <AlertTriangle className="w-4 h-4 text-rose-600" />
                            </div>
                            <div className="flex items-baseline gap-2 my-1">
                              <span className="text-2xl sm:text-3xl font-black text-slate-900">
                                {impactSummary.projectedTvsRework}
                              </span>
                              <span className="text-xs sm:text-sm text-slate-400 font-medium line-through">
                                {currentDashboardStats.tvsRework}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-700">
                              <span>+{impactSummary.tvsNewRework} Defects Flagged</span>
                            </div>
                          </div>
                        </div>

                        {/* TVS Acceptance Rate Bar */}
                        <div className="p-3 rounded-lg bg-slate-50/80 border border-slate-200/70 space-y-2">
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                            <span>TVS Acceptance Rate:</span>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500">{currentDashboardStats.tvsAcceptRate.toFixed(1)}%</span>
                              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-slate-900 font-black text-sm">
                                {impactSummary.projectedTvsRate.toFixed(1)}%
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-bold">
                                {impactSummary.projectedTvsRate >= currentDashboardStats.tvsAcceptRate ? "+" : ""}
                                {(impactSummary.projectedTvsRate - currentDashboardStats.tvsAcceptRate).toFixed(1)}%
                              </span>
                            </div>
                          </div>
                          {/* Visual Progress Bar */}
                          <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden flex shadow-inner">
                            <div
                              className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, Math.max(0, impactSummary.projectedTvsRate))}%` }}
                              title={`Projected: ${impactSummary.projectedTvsRate.toFixed(1)}%`}
                            />
                          </div>
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>Pending review: <strong className="text-slate-700">{impactSummary.projectedTvsPending}</strong></span>
                            <span>Total reviews: <strong className="text-slate-700">{impactSummary.projectedTotalTvs}</strong></span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* BOTTOM IMPACT STRIP: Modifications, Mismatch & Quality Action */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-200/80 text-xs">
                      <div className="p-3 rounded-lg bg-white/90 border border-slate-200 shadow-2xs flex flex-col justify-between">
                        <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider">Brand New Reviews</span>
                        <span className="text-base font-black text-slate-900 mt-0.5">+{impactSummary.newReviewsCount} Units</span>
                      </div>
                      <div className="p-3 rounded-lg bg-white/90 border border-slate-200 shadow-2xs flex flex-col justify-between">
                        <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider">Modified Data / Diffs</span>
                        <span className="text-base font-black text-slate-900 mt-0.5">{impactSummary.modifiedReviewsCount} Records</span>
                      </div>
                      <div className="p-3 rounded-lg bg-white/90 border border-slate-200 shadow-2xs flex flex-col justify-between">
                        <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider">Mismatched Chassis</span>
                        <span className="text-base font-black text-slate-900 mt-0.5">
                          {mismatchedRows.length} {skipMismatches ? "(Excluded)" : "(Included)"}
                        </span>
                      </div>
                      <div className="p-3 rounded-lg bg-white/90 border border-slate-200 shadow-2xs flex flex-col justify-between">
                        <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider">Worker Defect Impact</span>
                        <span className="text-base font-black text-slate-900 mt-0.5">+{impactSummary.biwNewRework + impactSummary.tvsNewRework} Flags</span>
                      </div>
                    </div>
                  </div>

                  {/* MISMATCH NEGOTIATION BANNER (IF MISMATCHES EXIST) */}
                  {mismatchedRows.length > 0 && (
                    <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
                          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-amber-900 dark:text-amber-200">
                            Negotiate Mismatch Data: {mismatchedRows.length} Chassis units not found in this inspection form
                          </div>
                          <p className="text-amber-800 dark:text-amber-300/90 text-xs">
                            Choose how to handle chassis in Excel that do not belong to the current template:
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSkipMismatches(true);
                            setIsConfirmed(false);
                          }}
                          className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 text-xs ${skipMismatches
                            ? "bg-amber-600 text-white shadow-xs"
                            : "bg-white dark:bg-gray-800 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
                            }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          Skip Mismatches ({mismatchedRows.length}) [Recommended]
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSkipMismatches(false);
                            setIsConfirmed(false);
                          }}
                          className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 text-xs ${!skipMismatches
                            ? "bg-amber-700 text-white shadow-xs"
                            : "bg-white dark:bg-gray-800 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
                            }`}
                        >
                          Include Mismatches
                        </button>
                        <button
                          type="button"
                          onClick={() => setFilterMode("mismatch")}
                          className="px-2.5 py-1.5 rounded-lg font-semibold text-xs text-amber-700 dark:text-amber-300 hover:underline"
                        >
                          View Mismatches ↗
                        </button>
                      </div>
                    </div>
                  )}

                  {/* FILTER CONTROLS & CONFIRMATION BAR */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    {/* View mode toggle pills */}
                    <div className="flex flex-wrap items-center gap-1.5 p-1 bg-gray-100 dark:bg-gray-800/80 rounded-xl border border-gray-200 dark:border-gray-700">
                      <button
                        type="button"
                        onClick={() => setFilterMode("modified")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${filterMode === "modified"
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                          }`}
                        title="Display only Modified Data and Brand New Reviews"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>Modified & New Data</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${filterMode === "modified" ? "bg-white/20 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                          }`}>
                          {modifiedAndNewRows.length}
                        </span>
                      </button>

                      {mismatchedRows.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setFilterMode("mismatch")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${filterMode === "mismatch"
                            ? "bg-amber-600 text-white shadow-xs"
                            : "text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200"
                            }`}
                          title="Display only Mismatched Chassis units not found in this form"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Mismatch Data</span>
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${filterMode === "mismatch" ? "bg-white/20 text-white" : "bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200"
                            }`}>
                            {mismatchedRows.length}
                          </span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setFilterMode("all_entered")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${filterMode === "all_entered"
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                          }`}
                        title="Display all chassis units that contain any review input"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                        <span>All Entered Reviews</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${filterMode === "all_entered" ? "bg-white/20 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                          }`}>
                          {allEnteredRows.length}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFilterMode("all")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${filterMode === "all"
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                          }`}
                        title="Display all rows from the Excel template including blank rows"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400" />
                        <span>All Template Rows</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${filterMode === "all" ? "bg-white/20 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                          }`}>
                          {enrichedParsedRows.length}
                        </span>
                      </button>
                    </div>

                    {/* CONFIRMATION GATE TO UNLOCK APPLY BUTTON */}
                    <div className="flex items-center gap-3">
                      <div className={`p-2 px-3 rounded-xl border transition-all flex items-center gap-2.5 ${isConfirmed
                        ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200"
                        : "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200"
                        }`}>
                        <input
                          type="checkbox"
                          id="confirmImportGate"
                          checked={isConfirmed}
                          onChange={(e) => setIsConfirmed(e.target.checked)}
                          className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500 cursor-pointer"
                        />
                        <label htmlFor="confirmImportGate" className="text-xs font-bold cursor-pointer select-none">
                          {isConfirmed ? (
                            <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Confirmed & Verified
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-amber-800 dark:text-amber-300">
                              <Lock className="w-3.5 h-3.5 text-amber-600" /> Confirm Impact to Enable Apply
                            </span>
                          )}
                        </label>
                      </div>

                      {/* TRIGGER APPLY BUTTON */}
                      <button
                        onClick={handleExecuteImport}
                        disabled={!isConfirmed || isImporting || rowsToImport.length === 0}
                        className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all flex items-center gap-2 ${isConfirmed && rowsToImport.length > 0 && !isImporting
                          ? "bg-gradient-to-r from-emerald-600 via-indigo-600 to-blue-600 hover:from-emerald-700 hover:to-indigo-700 text-white shadow-indigo-500/25 ring-2 ring-emerald-400/50"
                          : "bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed border border-gray-300 dark:border-gray-700"
                          }`}
                        title={!isConfirmed ? "Please check confirmation box to unlock Apply button" : "Click to apply verified reviews"}
                      >
                        {isImporting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                            Importing Reviews...
                          </>
                        ) : isConfirmed ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-300" />
                            {impactSummary.newReviewsCount + impactSummary.modifiedReviewsCount > 0
                              ? `Apply & Import ${impactSummary.newReviewsCount + impactSummary.modifiedReviewsCount} Update${impactSummary.newReviewsCount + impactSummary.modifiedReviewsCount !== 1 ? 's' : ''}`
                              : `Re-apply ${rowsToImport.length} Reviews (0 Changes)`}
                          </>
                        ) : (
                          <>
                            <Lock className="w-4 h-4 text-gray-400" />
                            {impactSummary.newReviewsCount + impactSummary.modifiedReviewsCount > 0
                              ? `Apply & Import (+${impactSummary.newReviewsCount + impactSummary.modifiedReviewsCount})`
                              : `No Changes Detected (0 Updates)`}
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* PARSED ROWS PREVIEW TABLE */}
                  <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold sticky top-0 border-b border-gray-200 dark:border-gray-700 z-10">
                        <tr>
                          <th className="p-2.5 w-8">
                            <input
                              type="checkbox"
                              checked={allDisplayedIncluded}
                              onChange={toggleAllDisplayedRows}
                              className="w-3.5 h-3.5 text-indigo-600 rounded border-gray-300"
                              title="Select/Deselect all displayed rows"
                            />
                          </th>
                          <th className="p-2.5">Row</th>
                          <th className="p-2.5">Chassis Number</th>
                          <th className="p-2.5">Change Impact / Diff</th>
                          <th className="p-2.5">Worker / Inspector</th>
                          <th className="p-2.5">BIW Feedback</th>
                          <th className="p-2.5">BIW Defect / Reason</th>
                          <th className="p-2.5">Remark</th>
                          <th className="p-2.5">
                            TVS Feedback ({targetTenantForm ? `1st: ${formTitle || "Main"}${mainTenantName ? ` | ${mainTenantName}` : ""}` : (mainTenantName || "Main Form")})
                          </th>
                          {parsedRows.some((row) => row.targetTvsFeedback) && (
                            <th className="p-2.5">
                              TVS Feedback (2nd: {targetTenantTitle || "Target Tenant"}{targetTenantName ? ` | ${targetTenantName}` : ""})
                            </th>
                          )}
                          <th className="p-2.5">Worker Impact</th>
                          <th className="p-2.5">File Upload</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {displayedRows.map((r, i) => {
                          const biwStatus = r.biwFeedback?.toLowerCase() || "";
                          const isAccept = biwStatus.includes("accept");
                          const isRework = biwStatus.includes("rework");
                          const isReject = biwStatus.includes("reject");
                          const chKey = (r.chassisNumber || "").trim().toUpperCase();
                          const isRowExcluded = excludedChassisKeys.has(chKey) || (r.isMismatch && skipMismatches);

                          return (
                            <tr
                              key={i}
                              className={`transition-colors ${isRowExcluded
                                ? "opacity-50 bg-gray-50/40 dark:bg-gray-900/40"
                                : r.isNewlyEnteredOrModified
                                  ? "bg-indigo-50/40 dark:bg-indigo-950/20 hover:bg-indigo-50/80 dark:hover:bg-indigo-950/40"
                                  : "hover:bg-gray-50/80 dark:hover:bg-gray-800/40"
                                }`}
                            >
                              <td className="p-2.5">
                                <input
                                  type="checkbox"
                                  checked={!isRowExcluded}
                                  onChange={() => toggleRowInclusion(r.chassisNumber)}
                                  className="w-3.5 h-3.5 text-indigo-600 rounded border-gray-300"
                                  title={isRowExcluded ? "Include this row in import" : "Exclude this row from import"}
                                />
                              </td>
                              <td className="p-2.5 text-gray-400">{r.rowIndex || i + 1}</td>
                              <td className="p-2.5 font-bold flex items-center gap-1.5">
                                {r.chassisNumber}
                                {r.isMatched ? (
                                  <span className="w-2 h-2 rounded-full bg-green-500" title="Found in current form" />
                                ) : (
                                  <span className="w-2 h-2 rounded-full bg-amber-400" title="Chassis mismatch: not found in form" />
                                )}
                              </td>
                              {/* Change Impact / Diff column */}
                              <td className="p-2.5">
                                {r.isMismatch ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                    <AlertTriangle className="w-3 h-3 text-amber-600 flex-shrink-0" />
                                    <span>Mismatch</span>
                                  </span>
                                ) : r.isBrandNew ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                                    <Sparkles className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                                    <span>New Review</span>
                                  </span>
                                ) : r.isModified ? (
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-300 dark:border-blue-700 max-w-[170px] truncate"
                                    title={r.changeDescription}
                                  >
                                    <RefreshCw className="w-3 h-3 text-blue-600 flex-shrink-0" />
                                    <span>{r.changeDescription}</span>
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-medium text-gray-400">
                                    Unchanged
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-black">
                                    <User className="w-3 h-3" />
                                  </div>
                                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                                    {r.workerName || "Inspector"}
                                  </span>
                                </div>
                              </td>
                              <td className="p-2.5">
                                {r.biwFeedback ? (
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${isAccept
                                      ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                                      : isRework
                                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                                        : isReject
                                          ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                                          : "bg-gray-100 text-gray-700"
                                      }`}
                                  >
                                    {r.biwFeedback}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="p-2.5 max-w-[160px] truncate" title={r.biwReason}>
                                {r.biwReason || "-"}
                              </td>
                              <td className="p-2.5 max-w-[120px] truncate" title={r.biwRemark || r.tvsRemark}>
                                {r.biwRemark || r.tvsRemark || "-"}
                              </td>
                              <td className="p-2.5">
                                {r.tvsFeedback ? (
                                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                                    {r.tvsFeedback}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              {parsedRows.some((row) => row.targetTvsFeedback) && (
                                <td className="p-2.5">
                                  {r.targetTvsFeedback ? (
                                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
                                      {r.targetTvsFeedback}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                              )}
                              <td className="p-2.5">
                                {r.isDefect ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                                    <AlertTriangle className="w-3 h-3 text-red-600 flex-shrink-0" />
                                    <span>Rework Flagged (Worker Defect)</span>
                                  </span>
                                ) : r.isAccepted ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-green-100 text-green-800 border border-green-200">
                                    <CheckCircle2 className="w-3 h-3 text-green-600 flex-shrink-0" />
                                    <span>Accepted (+1 Quality)</span>
                                  </span>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </td>
                              <td className="p-2.5">
                                {r.biwFileUrl ? (
                                  <a
                                    href={r.biwFileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-600 hover:underline flex items-center gap-1"
                                  >
                                    Link <ExternalLink className="w-3 h-3" />
                                  </a>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DOWNLOAD TEMPLATE */}
          {activeTab === "template" && (
            <div className="space-y-6">
              <div className="p-5 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-md">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                      Preconfigured Excel with Dynamic Dropdown Lists
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mb-3">
                      This template is custom-generated for <strong>{formTitle}</strong>. In Microsoft Excel or Google Sheets,
                      the review status columns and rework defect columns provide native dropdown menus populated directly
                      from this form’s inspection checkpoints!
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-700 dark:text-gray-300">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <strong>Col 2:</strong> BIW Feedback (Accepted, Rework, Rejected)
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <strong>Col 3:</strong> Defect Checkpoints from Form + Rust/Dent
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <strong>Col 6:</strong> TVS Feedback (Accepted, Rework, Rejected)
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <strong>Col 7 & 8:</strong> TVS Rework & Rejection Reasons
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Prefill Option */}
              <div className="p-4 border border-gray-200 dark:border-gray-800 rounded-xl space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefillChassis}
                    onChange={(e) => setPrefillChassis(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white">
                      Prefill with chassis numbers from current responses table
                    </span>
                    <p className="text-xs text-gray-500">
                      Populates {uniqueChassisList.length} chassis numbers currently loaded in the dashboard view.
                    </p>
                  </div>
                </label>
              </div>

              {/* Action Button */}
              <button
                onClick={handleDownloadTemplate}
                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download BIW Template (.xlsx)
              </button>
            </div>
          )}

          {/* TAB 3: EMAIL REPORT */}
          {activeTab === "email" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white">
                    Quality Inspection Email Summary
                  </h4>
                  <p className="text-xs text-gray-500">
                    Copy preformatted HTML table or text to paste into Outlook, Gmail, or your messaging channels.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopyEmailHtml}
                    className="px-3 py-1.5 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 rounded-lg border border-indigo-200 dark:border-indigo-800 flex items-center gap-1.5 transition-colors"
                  >
                    {copiedHtml ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedHtml ? "Copied HTML!" : "Copy HTML"}
                  </button>
                  <button
                    onClick={handleCopyEmailText}
                    className="px-3 py-1.5 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300 rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    {copiedText ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedText ? "Copied Text!" : "Copy Text"}
                  </button>
                </div>
              </div>

              {/* Email Live Preview */}
              <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4 bg-white dark:bg-gray-900 max-h-96 overflow-y-auto">
                <div dangerouslySetInnerHTML={{ __html: emailDraft.html }} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60">
          <div className="text-xs text-gray-500">
            {uniqueChassisList.length} Chassis records tracked in this inspection template
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs sm:text-sm font-semibold text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* EXPLICIT OK CONFIRMATION MODAL ("ONLY IF WE SAY OKEY IT WILL APPLY") */}
      {showOkConfirmModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="p-3 bg-indigo-50 dark:bg-slate-800 rounded-xl border border-indigo-100 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                <HelpCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Confirm Review Import</h3>
                <p className="text-xs text-slate-500 dark:text-slate-300 mt-1 leading-relaxed">
                  Are you sure you want to apply these reviews to the database? Only after you click <strong>OK</strong> will the changes be written.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs space-y-2">
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>Target Chassis Units:</span>
                <strong className="text-slate-900 dark:text-white">{rowsToImport.length}</strong>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>Brand New Reviews:</span>
                <strong className="text-slate-900 dark:text-white">+{impactSummary.newReviewsCount}</strong>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>Modified Reviews:</span>
                <strong className="text-slate-900 dark:text-white">{impactSummary.modifiedReviewsCount}</strong>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>Unchanged in DB:</span>
                <strong className="text-slate-500 dark:text-slate-400">{impactSummary.unchangedReviewsCount}</strong>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowOkConfirmModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeActualImport}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all flex items-center gap-1.5"
              >
                <Check className="w-4 h-4 text-white" />
                OK, Apply Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
