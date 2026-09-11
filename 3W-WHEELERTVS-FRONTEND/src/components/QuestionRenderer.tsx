import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Eye,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Sparkles,
  Truck,
  ShieldCheck,
  MessageCircle,
  X,
  Send,
  Calendar,
  User,
  Clock,
  Loader2,
  Upload,
  Link2,
} from "lucide-react";
import type { FollowUpQuestion } from "../types";
import { useTheme } from "../context/ThemeContext";
import { questionTypes } from "../utils/questionTypes";
import DateTimeInput from "./QuestionTypes/DateTimeInput";
import FileInput from "./QuestionTypes/FileInput";
import GridQuestion from "./QuestionTypes/GridQuestion";
import RadioImageQuestion from "./QuestionTypes/RadioImageQuestion";
import RatingQuestion from "./QuestionTypes/RatingQuestion";
import RatingNumberQuestion from "./QuestionTypes/RatingNumberQuestion";
import SatisfactionRatingQuestion from "./QuestionTypes/SatisfactionRatingQuestion";
import ScaleQuestion from "./QuestionTypes/ScaleQuestion";
import SearchSelect from "./QuestionTypes/SearchSelect";
import ParagraphInput from "./QuestionTypes/ParagraphInput";
import SliderFeedback from "./QuestionTypes/SliderFeedback";
import EmojiStarFeedback from "./QuestionTypes/EmojiStarFeedback";
import EmojiReactionFeedback from "./QuestionTypes/EmojiReactionFeedback";
import ProductNPSBuckets from "./forms/ProductNPSBuckets";
import ChassisWithZone from "./forms/ChassisWithZone";
import ChassisWithoutZone from "./forms/ChassisWithoutZone";
import ZoneIn from "./forms/ZoneIn";
import ZoneOut from "./forms/ZoneOut";
import { apiClient } from "../api/client";

interface QuestionRendererProps {
  question: FollowUpQuestion;
  value: any;
  trackingValue?: any;
  onChange?: (value: any) => void;
  onTrackingChange?: (value: any) => void;
  readOnly?: boolean;
  isFollowUp?: boolean;
  error?: string;
  trackingError?: string;
  formId?: string;
  tenantSlug?: string;
  suggestedAnswers?: any[] | Record<string, any> | null;
  lastSuggestionSource?: string | null;
  onApplyFullSuggestion?: (specificAnswers?: Record<string, any>) => void;
  isFetchingSuggestions?: boolean;
  fetchingSuggestionsForId?: string | null;
  rankMatchedAnswers?: Record<string, any> | null;
  currentRank?: number | null;
  onPreviousAnswersChange?: (answers: string[]) => void;
}

const getRankStyle = (answer: any, darkMode: boolean = false) => {
  if (answer === null || answer === undefined) return "";
  // Ensure we stringify object/array answers for consistent hashing
  const str =
    typeof answer === "object"
      ? JSON.stringify(answer)
      : String(answer).trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    {
      l: "bg-blue-50 text-blue-700 border-blue-200",
      d: "bg-blue-900/30 text-blue-300 border-blue-800",
    },
    {
      l: "bg-emerald-50 text-emerald-700 border-emerald-200",
      d: "bg-emerald-900/30 text-emerald-300 border-emerald-800",
    },
    {
      l: "bg-amber-50 text-amber-700 border-amber-200",
      d: "bg-amber-900/30 text-amber-300 border-amber-800",
    },
    {
      l: "bg-orange-50 text-orange-700 border-orange-200",
      d: "bg-orange-900/30 text-orange-300 border-orange-800",
    },
    {
      l: "bg-rose-50 text-rose-700 border-rose-200",
      d: "bg-rose-900/30 text-rose-300 border-rose-800",
    },
    {
      l: "bg-purple-50 text-purple-700 border-purple-200",
      d: "bg-purple-900/30 text-purple-300 border-purple-800",
    },
    {
      l: "bg-pink-50 text-pink-700 border-pink-200",
      d: "bg-pink-900/30 text-pink-300 border-pink-800",
    },
    {
      l: "bg-indigo-50 text-indigo-700 border-indigo-200",
      d: "bg-indigo-900/30 text-indigo-300 border-indigo-800",
    },
    {
      l: "bg-teal-50 text-teal-700 border-teal-200",
      d: "bg-teal-900/30 text-teal-300 border-teal-800",
    },
    {
      l: "bg-cyan-50 text-cyan-700 border-cyan-200",
      d: "bg-cyan-900/30 text-cyan-300 border-cyan-800",
    },
  ];
  const color = colors[Math.abs(hash) % colors.length];
  return darkMode ? color.d : color.l;
};

const getGoogleDriveDirectLink = (url: string) => {
  if (!url) return url;

  // Handle Google Drive view links (the format you have)
  if (url.includes("drive.google.com/file/d/") && url.includes("/view")) {
    const fileId = url.split("/d/")[1]?.split("/")[0];
    if (fileId) {
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
    }
  }

  // Handle standard Google Drive sharing links
  if (url.includes("drive.google.com/file/d/")) {
    const fileId = url.split("/d/")[1]?.split("/")[0];
    if (fileId) {
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
    }
  }

  // Handle Google Drive open links
  if (url.includes("drive.google.com/open?id=")) {
    const fileId = url.split("id=")[1]?.split("&")[0];
    if (fileId) {
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
    }
  }

  // Handle uc?id= style
  if (url.includes("drive.google.com/uc?id=")) {
    const fileId = url.split("id=")[1]?.split("&")[0];
    if (fileId) {
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
    }
  }

  // Handle direct download links
  if (url.includes("export=download")) {
    const fileId = url.match(/id=([^&]+)/)?.[1];
    if (fileId) {
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
    }
  }

  return url;
};

const isImageUrl = (fileUrl: string) => {
  if (!fileUrl) {
    return false;
  }
  try {
    const parsed = JSON.parse(fileUrl);
    if (parsed.url) {
      return isImageUrl(parsed.url);
    }
  } catch {
    // Not JSON, continue with regular check
  }
  if (fileUrl.startsWith("data:")) {
    return fileUrl.startsWith("data:image");
  }

  // Check for Google Drive image URLs
  if (fileUrl.includes("lh3.googleusercontent.com/d/")) {
    return true;
  }

  if (fileUrl.includes("drive.google.com/thumbnail")) {
    return true;
  }

  return /\.(png|jpg|jpeg|gif|bmp|webp|svg)$/i.test(fileUrl);
};

export default function QuestionRenderer({
  question,
  value,
  trackingValue,
  onChange,
  onTrackingChange,
  readOnly = false,
  isFollowUp = false,
  formId,
  tenantSlug,
  suggestedAnswers,
  lastSuggestionSource,
  onApplyFullSuggestion,
  isFetchingSuggestions = false,
  fetchingSuggestionsForId = null,
  rankMatchedAnswers = null,
  currentRank = null,
  onPreviousAnswersChange,
  error,
  trackingError,
}: QuestionRendererProps) {
  const { darkMode } = useTheme();
  const [validationError, setValidationError] = useState<string | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [previousStatus, setPreviousStatus] = useState<string | null>(null);
  const [lastResponseId, setLastResponseId] = useState<string | null>(null);
  const [rankHistory, setRankHistory] = useState<any[]>([]);
  const [dispatchInfo, setDispatchInfo] = useState<{ isDispatched: boolean; dispatchedAt?: string | null; dispatchedByName?: string | null } | null>(null);
  const [lastSubmittedBy, setLastSubmittedBy] = useState<string | null>(null);
  const [parentMatchInfo, setParentMatchInfo] = useState<{
    exists: boolean;
    isParentLinked: boolean;
    parentFormTitle?: string | null;
    parentFormId?: string | null;
    attemptsCount: number;
    lastStatus?: string | null;
    lastSubmittedBy?: string | null;
    lastCreatedAt?: string | null;
    daysElapsed?: number;
    color: "green" | "orange" | "red" | "white";
    badgeText: string;
    statusLabel?: string;
    history?: any[];
  } | null>(null);

  const userStr = typeof window !== 'undefined' ? window.localStorage.getItem('user') : null;
  const currentUser = userStr ? JSON.parse(userStr) : null;
  const isCreator = lastSubmittedBy && currentUser && (
    lastSubmittedBy === currentUser.username ||
    lastSubmittedBy === currentUser.name ||
    lastSubmittedBy === currentUser.email ||
    lastSubmittedBy === String(currentUser._id || currentUser.id)
  );
  const [biwInfo, setBiwInfo] = useState<{ status: string; reviewedByName?: string; reviewedAt?: string; notes?: string } | null>(null);
  const [chatCount, setChatCount] = useState<number>(0);
  const [showChatModal, setShowChatModal] = useState(false);
  const [showBiwModal, setShowBiwModal] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [loadingChatMessages, setLoadingChatMessages] = useState(false);
  const [newChatMessage, setNewChatMessage] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [updatingBiw, setUpdatingBiw] = useState(false);
  const [loadingRank, setLoadingRank] = useState(false);
  const [previousAnswers, setPreviousAnswers] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [pendingBiwAction, setPendingBiwAction] = useState<"Rejected" | "Reworked" | null>(null);
  const [biwReasonSelect, setBiwReasonSelect] = useState<string>("");
  const [biwReasonText, setBiwReasonText] = useState<string>("");
  const [biwEvidenceUrl, setBiwEvidenceUrl] = useState<string>("");
  const [biwUploading, setBiwUploading] = useState<boolean>(false);
  const [formQuestions, setFormQuestions] = useState<{id: string, text: string}[]>([]);
  const [biwSelectedQuestionIds, setBiwSelectedQuestionIds] = useState<string[]>([]);

  // Track global rank matched answers for this question
  useEffect(() => {
    if (rankMatchedAnswers) {
      const qId = question.id || (question as any)._id;
      const rankVal = rankMatchedAnswers[qId];
      if (rankVal !== undefined && rankVal !== null && String(rankVal).trim() !== "") {
        setPreviousAnswers(prev => {
          if (!prev.includes(rankVal)) {
            return [...prev, rankVal];
          }
          return prev;
        });
      }
    }
  }, [rankMatchedAnswers, question.id, (question as any)._id]);

  useEffect(() => {
    if (pendingBiwAction && formId && formQuestions.length === 0) {
      apiClient.getForm(formId).then((res: any) => {
        if (res?.form?.sections) {
          const options: {id: string, text: string}[] = [];
          res.form.sections.forEach((sec: any) => {
            sec.questions?.forEach((q: any) => {
              if (q.id !== "chassis" && q.type !== "chassis") {
                options.push({ id: q.id, text: q.text || q.id });
              }
            });
          });
          setFormQuestions(options);
        }
      }).catch(console.error);
    }
  }, [pendingBiwAction, formId]);

  const handleBiwEvidenceUpload = async (file: File) => {
    try {
      setBiwUploading(true);
      const result = await apiClient.uploadFile(file, "form");
      const url = apiClient.resolveUploadedFileUrl(result);
      if (url) setBiwEvidenceUrl(url);
    } catch (err) {
      console.error("BIW evidence upload failed:", err);
      alert("Evidence upload failed. Please try again.");
    } finally {
      setBiwUploading(false);
    }
  };

  const handleUpdateBiwStatus = async (status: "Accepted" | "Rejected" | "Reworked", remark?: string, evidenceUrl?: string, flaggedQuestions?: {questionId: string, questionText: string}[]) => {
    const targetId = lastResponseId || (rankHistory.length > 0 ? rankHistory[rankHistory.length - 1].id : null);
    if (!targetId) return;

    setUpdatingBiw(true);
    try {
      await apiClient.updateResponse(targetId, {
        biwReview: { 
          status, 
          remark: remark || "", 
          evidenceUrl: evidenceUrl || "",
          flaggedQuestions: flaggedQuestions || []
        }
      });

      setBiwInfo((prev) => ({
        ...(prev || {}),
        status,
        reason: remark, // Map remark to local reason state for backward compatibility in UI
        reviewedAt: new Date().toISOString(),
        reviewedByName: "You"
      }));

      // Automatically post a status message to the discussion thread
      try {
        let msg = `[BIW Review] Status marked as ${status}.`;
        if (flaggedQuestions && flaggedQuestions.length > 0) {
          msg += `\nQuestions Flagged: ${flaggedQuestions.map(q => q.questionText).join(", ")}`;
        }
        if (remark) {
          msg += `\nRemark: ${remark}`;
        }
        if (evidenceUrl) {
          msg += `\n\n![Evidence](${evidenceUrl})`;
        }
        await apiClient.request("/messages/send", {
          method: "POST",
          body: JSON.stringify({
            message: msg,
            responseId: targetId,
            formId: formId || null,
            toEmail: "inspector"
          })
        });
        await fetchChatHistory();
        setChatCount((prev) => prev + 1);
      } catch (err) {
        console.warn("Could not post review chat message", err);
      }
    } catch (error: any) {
      console.error("Failed to update BIW Review status:", error);
      alert(error?.message || "Failed to update review status. Note: You cannot review your own submission.");
    } finally {
      setUpdatingBiw(false);
    }
  };

  const fetchChatHistory = async () => {
    const targetId = lastResponseId || (rankHistory.length > 0 ? rankHistory[rankHistory.length - 1].id : null);
    if (!targetId) return;
    setLoadingChatMessages(true);
    try {
      const res: any = await apiClient.request(`/messages/response/${targetId}`);
      if (res && res.data) {
        setChatMessages(res.data);
      } else if (Array.isArray(res)) {
        setChatMessages(res);
      }
    } catch (e) {
      console.warn("Failed to load chat messages for response:", e);
    } finally {
      setLoadingChatMessages(false);
    }
  };

  const handleSendChatMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = newChatMessage.trim();
    const targetId = lastResponseId || (rankHistory.length > 0 ? rankHistory[rankHistory.length - 1].id : null);
    if (!text || !targetId) return;

    setSendingChat(true);
    try {
      const payload = {
        message: text,
        responseId: targetId,
        formId: formId || null,
        toEmail: "inspector",
      };
      const res: any = await apiClient.request("/messages/send", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (res && (res.success || res.data)) {
        setNewChatMessage("");
        await fetchChatHistory();
        setChatCount((prev) => prev + 1);
      }
    } catch (err) {
      console.error("Failed to send chat message:", err);
    } finally {
      setSendingChat(false);
    }
  };

  const imageUrl = getGoogleDriveDirectLink(question.imageUrl || "");
  const isImage = isImageUrl(imageUrl);

  const isRankTrackingEnabled = true;

  const isQuestionTrackingEnabled =
    question.trackResponseQuestion === true ||
    String(question.trackResponseQuestion) === "true";

  const isTrackingEnabled = true;

  const trackingInputType = question.trackResponseQuestionType || question.trackResponseRankType || "text";
  const trackingInputLabel =
    question.trackResponseQuestionLabel || question.trackResponseRankLabel || "Tracking Question";

  // Determine which value to use for fetching rank
  const effectiveTrackingValue = useMemo(() => {
    const val =
      trackingValue !== undefined && trackingValue !== null && String(trackingValue).trim() !== ""
        ? trackingValue
        : value;
    if (typeof val === "object" && val !== null) {
      const inner = (val as any).chassisNumber || (val as any).value || (val as any).text || (val as any).chassis || "";
      return typeof inner === "string" ? inner.trim() : inner;
    }
    return typeof val === "string" ? val.trim() : (val || "");
  }, [trackingValue, value]);

  useEffect(() => {
    let isCancelled = false;

    if (
      !(isRankTrackingEnabled || isQuestionTrackingEnabled) ||
      !effectiveTrackingValue ||
      typeof effectiveTrackingValue !== "string" ||
      effectiveTrackingValue.trim().length === 0 ||
      !formId
    ) {
      setRank(null);
      setPreviousStatus(null);
      setLastResponseId(null);
      setRankHistory([]);
      setDispatchInfo(null);
      setLastSubmittedBy(null);
      setBiwInfo(null);
      setChatCount(0);
      setLoadingRank(false);
      return;
    }

    const currentTarget = effectiveTrackingValue.trim();
    setLoadingRank(true);

    const timer = setTimeout(async () => {
      try {
        const response: any = await apiClient.getResponseRank(
          formId,
          question.id || (question as any)._id,
          currentTarget,
          tenantSlug,
        );

        if (isCancelled) return;

        const rankVal = (response && typeof response.rank === "number")
          ? response.rank
          : (response && response.data && typeof response.data.rank === "number")
            ? response.data.rank
            : (typeof response === "number")
              ? response
              : null;

        const prevStat = (response && response.previousStatus) || (response && response.data && response.data.previousStatus) || null;
        const hist = (response && response.history) || (response && response.data && response.data.history) || [];

        console.log(`[RANK LIVE] Chassis: "${currentTarget}" -> Rank: ${rankVal}, PreviousStatus: "${prevStat}", History: ${hist.length}`);
        const lastId = (response && response.lastResponseId) || (response && response.data && response.data.lastResponseId) || null;
        const isDisp = Boolean((response && response.isDispatched) || (response && response.data && response.data.isDispatched));
        const dispAt = (response && response.dispatchedAt) || (response && response.data && response.data.dispatchedAt) || null;
        const dispBy = (response && response.dispatchedByName) || (response && response.data && response.data.dispatchedByName) || null;
        const biw = (response && response.biwReview) || (response && response.data && response.data.biwReview) || null;
        const chatCnt = (response && typeof response.chatCount === "number")
          ? response.chatCount
          : (response && response.data && typeof response.data.chatCount === "number")
            ? response.data.chatCount
            : 0;
        const submittedBy = (response && response.lastSubmittedBy) || (response && response.data && response.data.lastSubmittedBy) || null;
        const pMatch = (response && response.parentMatch) || (response && response.data && response.data.parentMatch) || (response && response.followUpStatus) || (response && response.data && response.data.followUpStatus) || null;

        setRank(rankVal);
        setPreviousStatus(prevStat);
        setLastResponseId(lastId);
        setRankHistory(hist);
        setDispatchInfo(isDisp ? { isDispatched: true, dispatchedAt: dispAt, dispatchedByName: dispBy } : null);
        setLastSubmittedBy(submittedBy);
        setBiwInfo(biw);
        setChatCount(chatCnt);
        setParentMatchInfo(pMatch);
      } catch (err) {
        if (!isCancelled) {
          console.error("Failed to fetch rank:", err);
          setRank(null);
          setPreviousStatus(null);
          setRankHistory([]);
          setDispatchInfo(null);
          setBiwInfo(null);
          setChatCount(0);
          setParentMatchInfo(null);
        }
      } finally {
        if (!isCancelled) {
          setLoadingRank(false);
        }
      }
    }, 300);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [
    isRankTrackingEnabled,
    isQuestionTrackingEnabled,
    effectiveTrackingValue,
    question.id,
    (question as any)._id,
    formId,
    tenantSlug,
  ]);

  useEffect(() => {
    const fetchPreviousAnswers = async () => {
      // Only fetch suggestions for trackResponseQuestion (question-wise tracking)
      // trackResponseRank should NOT show suggestions, only display rank
      if (isQuestionTrackingEnabled && formId) {
        try {
          setLoadingSuggestions(true);
          const response = await apiClient.getQuestionPreviousAnswers(
            formId,
            question.id || (question as any)._id,
            tenantSlug,
          );
          if (response && Array.isArray(response.answers)) {
            // Filter out empty or null answers
            const filteredAnswers = response.answers.filter(
              (a) => a !== null && a !== undefined && (typeof a === "string" ? a.trim() !== "" : true),
            );
            setPreviousAnswers(filteredAnswers);
            if (onPreviousAnswersChange) {
              onPreviousAnswersChange(filteredAnswers);
            }
          }
        } catch (err) {
          console.error("Failed to fetch previous answers:", err);
        } finally {
          setLoadingSuggestions(false);
        }
      }
    };

    fetchPreviousAnswers();
  }, [
    isQuestionTrackingEnabled,
    question.id,
    (question as any)._id,
    formId,
    tenantSlug,
  ]);

  const getSuggestedValue = (qId: string) => {
    if (!suggestedAnswers || suggestedAnswers._no_match) return null;

    const normalize = (s: string) =>
      s
        .toLowerCase()
        .replace(/_tracking$/, "")
        .replace(/^_/, "")
        .trim();

    const normalizedTarget = normalize(qId);

    // If suggestedAnswers is an array of records (new behavior)
    if (Array.isArray(suggestedAnswers)) {
      if (suggestedAnswers.length === 0) return null;
      
      const allMatches = suggestedAnswers.map(s => {
        const answers = s.answers || {};
        const matchKey = Object.keys(answers).find((key) => {
          if (key.startsWith("_") && !key.includes("tracking")) return false;
          return normalize(key) === normalizedTarget;
        });
        return { 
          rank: s.rank, 
          value: matchKey ? answers[matchKey] : null,
          answers: answers // Include full answers for components like ChassisWithZone
        };
      }).filter(m => m.value !== null && m.value !== undefined && String(m.value).trim() !== "");

      return allMatches.length > 0 ? allMatches : null;
    }

    // Legacy behavior (if suggestedAnswers is a flat object)
    // Try exact match first
    if (suggestedAnswers[qId] !== undefined) return [{ rank: 1, value: suggestedAnswers[qId] }];

    // Fuzzy matching
    const matchKey = Object.keys(suggestedAnswers).find((key) => {
      if (key.startsWith("_") && !key.includes("tracking")) return false;
      return normalize(key) === normalizedTarget;
    });

    return matchKey ? [{ rank: 1, value: suggestedAnswers[matchKey] }] : null;
  };

  const [isFocused, setIsFocused] = useState(false);

  const qId = question.id || (question as any)._id;
  const suggestedMatches = getSuggestedValue(qId);
  const suggestedValue = Array.isArray(suggestedMatches) ? suggestedMatches[0]?.value : null;

  const hasRanked = suggestedMatches && suggestedMatches.length > 0;
  const hasPrevious = previousAnswers.length > 0;

  // Only show match/suggestions if the user has interacted with this field
  // or if it's the one that explicitly triggered the current fetch
  const isSearchSource = lastSuggestionSource?.startsWith(`${qId}:`);
  const shouldShowMatchInfo =
    isFocused || (value && String(value).trim() !== "") || isSearchSource;

  const hasMatch =
    shouldShowMatchInfo &&
    suggestedMatches !== null &&
    Array.isArray(suggestedMatches) &&
    suggestedMatches.length > 0;

  const isApplied =
    hasMatch &&
    (() => {
      if (typeof suggestedValue === "object") {
        return JSON.stringify(value) === JSON.stringify(suggestedValue);
      }
      const normalize = (s: any) =>
        String(s || "")
          .trim()
          .toLowerCase();
      return normalize(value) === normalize(suggestedValue);
    })();

  const renderSuggestions = () => {
    if (readOnly || !shouldShowMatchInfo) return null;

    // Inline suggestions (Rank History and Common Answers) should show
    // if we have matches from the "Track Rank" fetch (form-wide fetch)
    // OR if we have matches from "Track Question" question-wise fetch.
    // HOWEVER, if trackResponseQuestion is enabled, we show them in the Assistant sidebar instead (on Desktop).
    // On Mobile, we still show them inline because sidebar is not visible.
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    if (isQuestionTrackingEnabled && !isMobile) return null;

    if (!hasRanked && !hasPrevious) return null;

    const formatSuggestionValue = (val: any) => {
      if (val === null || val === undefined) return "";
      
      if (typeof val === "object") {
        // Handle Chassis Number objects
        if (val.chassisNumber || val.status || val.zone || val.defectCategory) {
          const parts = [];
          if (val.chassisNumber) parts.push(val.chassisNumber);
          if (val.status) {
            parts.push(String(val.status));
          }
          if (val.zone) {
            const z = Array.isArray(val.zone) ? val.zone : [val.zone];
            if (z.length > 0) parts.push(`Zone: ${z.join(', ')}`);
          }
          if (val.defectCategory) {
            const cats = Array.isArray(val.defectCategory) ? val.defectCategory : [val.defectCategory];
            if (cats.length > 0) parts.push(`Cat: ${cats.join(', ')}`);
          }
          if (val.defects && Array.isArray(val.defects) && val.defects.length > 0) {
             parts.push(`Defects: ${val.defects.length}`);
          }
          return parts.join(" | ");
        }

        // Handle generic objects or arrays to avoid [object Object]
        try {
          const str = JSON.stringify(val);
          if (str.length > 50) return str.slice(0, 47) + "...";
          return str;
        } catch (e) {
          return "Object";
        }
      }
      
      return String(val);
    };

  return (
      <div className="mt-2 space-y-2 animate-in fade-in slide-in-from-top-1 duration-300">
        {hasPrevious && !hasRanked && (
          <div className="mt-2 space-y-2 border border-gray-200 dark:border-gray-800 rounded-lg p-2.5 bg-gray-50 dark:bg-gray-900/50">
            <span className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1.5">
              <History className="w-3 h-3" /> Previous Answers
            </span>
            <div className="flex flex-wrap gap-2">
              {previousAnswers.map((prevAns, idx) => {
                const ansStr = String(prevAns);
                const isImg = isImageFile(ansStr) || ansStr.startsWith("http") && (ansStr.includes("cloudinary.com/") || ansStr.includes("/api/files/"));
                return (
                  <div key={idx} className="relative group cursor-pointer" onClick={() => {
                    if (!readOnly && onChange) {
                      onChange(prevAns);
                    }
                  }}>
                    {isImg ? (
                      <div className={`w-16 h-16 rounded overflow-hidden border-2 transition-all ${String(value) === ansStr ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'}`}>
                        <img src={ansStr} alt={`Previous answer ${idx + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={`text-xs px-2.5 py-1.5 rounded-md border font-medium transition-colors ${
                          String(value) === ansStr
                            ? "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300"
                            : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-indigo-300 dark:hover:border-indigo-600"
                        }`}
                      >
                        {ansStr}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderLoadingIndicator = () => {
    return null;
  };

  const renderNoMatchIndicator = () => {
    return null;
  };

  const renderFollowUpParentStatusCard = () => {
    if (!effectiveTrackingValue || typeof effectiveTrackingValue !== "string" || effectiveTrackingValue.trim().length === 0) return null;

    if (loadingRank) {
      return (
        <div className="mt-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 text-xs flex items-center gap-2 animate-pulse">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
          <span className="font-medium">Checking parent inspection history for "{effectiveTrackingValue}"...</span>
        </div>
      );
    }

    if (parentMatchInfo?.isParentLinked || (parentMatchInfo?.exists && parentMatchInfo?.attemptsCount > 0)) {
      const historyItems = (rankHistory && rankHistory.length > 0) ? rankHistory : (parentMatchInfo.history || []);
      const days = parentMatchInfo.daysElapsed ?? 0;
      const totalAttempts = (parentMatchInfo.attemptsCount || 0) + 1;

      return (
        <div className="mt-2.5 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 text-slate-800 dark:text-slate-200 animate-in fade-in slide-in-from-top-1 duration-200 shadow-2xs">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                <span>Parent Form:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {parentMatchInfo.parentFormTitle || "Main Inspection Form"}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {parentMatchInfo.attemptsCount} {parentMatchInfo.attemptsCount === 1 ? 'Parent Attempt' : 'Parent Attempts'}
              </span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60">
                Follow-up Attempt #{totalAttempts}
              </span>
            </div>
          </div>

          {/* Details */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-[11px]">
            <div className="flex flex-wrap items-center gap-3 text-slate-600 dark:text-slate-400">
              {parentMatchInfo.lastSubmittedBy && (
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3 text-slate-400" />
                  <span>Inspector:</span>
                  <strong className="text-slate-800 dark:text-slate-200 font-semibold">{parentMatchInfo.lastSubmittedBy}</strong>
                </span>
              )}
              {parentMatchInfo.lastCreatedAt && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  <span>{new Date(parentMatchInfo.lastCreatedAt).toLocaleDateString()}</span>
                  {days > 0 && <span className="text-slate-400">({days}d ago)</span>}
                </span>
              )}
            </div>

            {parentMatchInfo.lastStatus && (() => {
              const s = parentMatchInfo.lastStatus.toLowerCase();
              const isRej = s.includes('reject');
              const isRew = s.includes('rework');
              const statusStyle = isRej
                ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-900/50'
                : isRew
                  ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/50'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/50';

              return (
                <span className={`px-2 py-0.5 rounded-md font-semibold text-[10px] border ${statusStyle}`}>
                  Status: {parentMatchInfo.lastStatus}
                </span>
              );
            })()}
          </div>

          {/* Sequence Timeline */}
          {historyItems.length > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-800 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mr-1">Progression:</span>
              {historyItems.map((hist: any, idx: number) => {
                const sStr = String(hist.status || "").toLowerCase().trim();
                const isRej = sStr.includes("reject");
                const isAccepted = sStr.includes("accept") || sStr.includes("direct ok") || sStr.includes("ok") || sStr === "verified";
                const chipStyle = isRej
                  ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                  : isAccepted
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                    : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800";

                return (
                  <React.Fragment key={`hist-${hist.rank || idx}`}>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border ${chipStyle}`}>
                      <span className="font-semibold">Attempt #{hist.rank}:</span>
                      <span>{hist.status || 'Recorded'}</span>
                    </span>
                    {idx < historyItems.length - 1 && (
                      <span className="text-slate-300 dark:text-slate-600 text-xs">→</span>
                    )}
                  </React.Fragment>
                );
              })}
              <span className="text-slate-300 dark:text-slate-600 text-xs">→</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800">
                Attempt #{totalAttempts}: Current (Follow-up)
              </span>
            </div>
          )}
        </div>
      );
    }

    if (parentMatchInfo?.color === 'orange' || (parentMatchInfo && !parentMatchInfo.exists)) {
      return (
        <div className="mt-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 text-xs flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
            <span className="font-medium text-slate-600 dark:text-slate-400">
              New Entry: Not linked to any prior parent inspection record.
            </span>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 bg-slate-200/70 dark:bg-slate-800 rounded text-slate-700 dark:text-slate-300">
            Initial Attempt #1
          </span>
        </div>
      );
    }

    return null;
  };

  const getBorderClass = (isTrackingField: boolean = false) => {
    if (isApplied)
      return darkMode
        ? "border-emerald-500/50 bg-emerald-500/5 ring-4 ring-emerald-500/10"
        : "border-emerald-500 bg-emerald-50/30 ring-4 ring-emerald-500/10";
    if (isTrackingField)
      return darkMode
        ? "bg-blue-900/10 border-blue-800 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10"
        : "bg-blue-50/50 border-blue-200 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10";
    return darkMode
      ? "bg-slate-900/50 border-slate-800 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10"
      : "bg-white/50 border-slate-200 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10";
  };



  const renderInput = () => {
    const effectiveType = question.type;

    const renderInputWrapper = (children: React.ReactNode) => {
      const isQuestionMode =
        question.trackResponseQuestion === true ||
        String(question.trackResponseQuestion) === "true";

      // Show "Assistant" only for trackResponseQuestion fields
      const showAssistantBadge = hasMatch && isQuestionMode;
      // Show "Match Available" for all other fields if a match is found (likely from Track Rank fetch)
      const showMatchBadge = hasMatch && !isQuestionMode;
      // Show "History" badge if common answers exist
      const showHistoryBadge = !hasMatch && hasPrevious && !isApplied;

      return (
        <div className="relative group/input">
          {children}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
          </div>
        </div>
      );
    };

    switch (effectiveType) {
      case "paragraph":
      case "textarea":
        return renderInputWrapper(
          <div className="space-y-1">
            <ParagraphInput
              question={question}
              value={value}
              onChange={onChange || (() => {})}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              readOnly={readOnly}
              error={!!error}
              className={getBorderClass()}
              isApplied={isApplied}
            />
            {renderLoadingIndicator()}
            {renderNoMatchIndicator()}
            {renderSuggestions()}
          </div>,
        );

      case "search-select":
        return renderInputWrapper(
          <div className="space-y-1">
            <SearchSelect
              options={
                question.options?.map((opt) => ({ value: opt, label: opt })) ||
                []
              }
              value={value || ""}
              onChange={onChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Select an option..."
              required={question.required}
              readOnly={readOnly}
              error={!!error}
              className={getBorderClass()}
              isApplied={isApplied}
            />
            {renderLoadingIndicator()}
            {renderNoMatchIndicator()}
            {renderSuggestions()}
          </div>,
        );

      case "select":
        return renderInputWrapper(
          <div className="space-y-1">
            <select
              value={value || ""}
              onChange={(e) =>
                !readOnly && onChange && onChange(e.target.value)
              }
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              required={question.required}
              disabled={readOnly}
              className={`w-full px-3 py-1.5 border rounded-xl text-[11px] font-medium transition-all duration-300 ${getBorderClass()} ${readOnly ? "opacity-50 cursor-not-allowed" : ""} ${
                error ? "border-red-500 ring-4 ring-red-500/10" : ""
              }`}
            >
              <option value="">Select an option</option>
              {question.options?.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {renderLoadingIndicator()}
            {renderNoMatchIndicator()}
            {renderSuggestions()}
          </div>,
        );

      case "yesNoNA":
      case "radio":
      case "checkbox": {
        const options =
          question.options && question.options.length > 0
            ? question.options
            : question.type === "yesNoNA"
              ? ["Yes", "No", "N/A"]
              : [];
        const inputType = question.type === "checkbox" ? "checkbox" : "radio";
        return renderInputWrapper(
          <div className="space-y-1">
            <div className="grid gap-2">
              {options.map((option) => {
                const isSelected =
                  question.type === "checkbox"
                    ? Array.isArray(value) && value.includes(option)
                    : value === option;
                return (
                  <label
                    key={option}
                    className={`flex items-center space-x-3 cursor-pointer p-2 rounded-lg border transition-all duration-200 ${
                      isSelected
                        ? isApplied
                          ? "border-emerald-500/50 bg-emerald-500/5 dark:bg-emerald-500/10 ring-4 ring-emerald-500/5"
                          : "border-blue-500/50 bg-blue-500/5 dark:bg-blue-500/10"
                        : error
                          ? "border-red-500 bg-red-50/50 dark:bg-red-500/5"
                          : "border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div className="relative flex items-center">
                      <input
                        type={inputType}
                        name={question.id}
                        value={option}
                        checked={isSelected}
                        onChange={(e) => {
                          if (readOnly) return;
                          if (question.type === "checkbox") {
                            const newValue = Array.isArray(value)
                              ? [...value]
                              : [];
                            if (e.target.checked) {
                              newValue.push(option);
                            } else {
                              const index = newValue.indexOf(option);
                              if (index > -1) {
                                newValue.splice(index, 1);
                              }
                            }
                            onChange && onChange(newValue);
                          } else {
                            onChange && onChange(option);
                          }
                        }}
                        required={question.required && !value}
                        disabled={readOnly}
                        className={`h-3.5 w-3.5 ${
                          isApplied
                            ? "text-emerald-600 focus:ring-emerald-500/20"
                            : "text-blue-600 focus:ring-blue-500/20"
                        } border-slate-300 dark:border-slate-700 dark:bg-slate-900 ${
                          readOnly ? "cursor-not-allowed" : ""
                        } ${question.type === "radio" ? "rounded-full" : "rounded"}`}
                      />
                    </div>
                    <span
                      className={`text-[11px] font-bold ${
                        isApplied && isSelected
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-slate-700 dark:text-slate-300"
                      } transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400`}
                    >
                      {option}
                    </span>
                  </label>
                );
              })}
            </div>
            {renderLoadingIndicator()}
            {renderNoMatchIndicator()}
            {renderSuggestions()}
          </div>,
        );
      }

      case "chassisNumber":
        return (
          <GridQuestion
            question={
              {
                ...question,
                gridOptions: {
                  rows: question.options || [],
                  columns: ["Yes", "No", "N/A"],
                },
              } as any
            }
            value={value || {}}
            onChange={onChange}
            type="radio"
            readOnly={readOnly}
          />
        );
      case "radio-grid":
      case "checkbox-grid":
        return renderInputWrapper(
          <div className="space-y-1">
            <GridQuestion
              question={question}
              value={value || {}}
              onChange={onChange || (() => {})}
              type={question.type === "radio-grid" ? "radio" : "checkbox"}
              readOnly={readOnly}
              error={!!error}
              isApplied={isApplied}
            />
            {renderLoadingIndicator()}
            {renderNoMatchIndicator()}
            {renderSuggestions()}
          </div>,
        );

      case "radio-image":
        return renderInputWrapper(
          <div className="space-y-1">
            <RadioImageQuestion
              question={question}
              value={value}
              onChange={onChange || (() => {})}
              error={!!error}
              isApplied={isApplied}
            />
            {renderLoadingIndicator()}
            {renderNoMatchIndicator()}
            {renderSuggestions()}
          </div>,
        );

      case "rating":
        return renderInputWrapper(
          <div className="space-y-1">
            <RatingQuestion
              question={question}
              value={value}
              onChange={onChange || (() => {})}
              readOnly={readOnly}
              error={!!error}
              isApplied={isApplied}
            />
            {renderLoadingIndicator()}
            {renderNoMatchIndicator()}
            {renderSuggestions()}
          </div>,
        );
      case "rating-number":
        return renderInputWrapper(
          <div className="space-y-1">
            <RatingNumberQuestion
              question={question}
              value={value}
              onChange={onChange || (() => {})}
              readOnly={readOnly}
              error={!!error}
              isApplied={isApplied}
            />
            {renderLoadingIndicator()}
            {renderNoMatchIndicator()}
            {renderSuggestions()}
          </div>,
        );

      case "satisfaction-rating":
        return renderInputWrapper(
          <div className="space-y-1">
            <SatisfactionRatingQuestion
              question={question}
              value={value}
              onChange={onChange || (() => {})}
              readOnly={readOnly}
              error={!!error}
              isApplied={isApplied}
            />
            {renderLoadingIndicator()}
            {renderNoMatchIndicator()}
            {renderSuggestions()}
          </div>,
        );

      case "scale":
        return renderInputWrapper(
          <div className="space-y-1">
            <ScaleQuestion
              question={question}
              value={value}
              onChange={onChange || (() => {})}
              readOnly={readOnly}
              error={!!error}
              isApplied={isApplied}
            />
            {renderLoadingIndicator()}
            {renderNoMatchIndicator()}
            {renderSuggestions()}
          </div>,
        );

      case "slider-feedback":
        return renderInputWrapper(
          <div className="space-y-1">
            <SliderFeedback
              question={question}
              value={value}
              onChange={onChange || (() => {})}
              readOnly={readOnly}
              error={!!error}
              isApplied={isApplied}
            />
            {renderLoadingIndicator()}
            {renderNoMatchIndicator()}
            {renderSuggestions()}
          </div>,
        );

      case "emoji-star-feedback":
        return renderInputWrapper(
          <div className="space-y-1">
            <EmojiStarFeedback
              question={question}
              value={value}
              onChange={onChange || (() => {})}
              readOnly={readOnly}
              error={!!error}
              isApplied={isApplied}
            />
            {renderLoadingIndicator()}
            {renderNoMatchIndicator()}
            {renderSuggestions()}
          </div>,
        );

      case "emoji-reaction-feedback":
        return renderInputWrapper(
          <div className="space-y-1">
            <EmojiReactionFeedback
              question={question}
              value={value}
              onChange={onChange || (() => {})}
              readOnly={readOnly}
              error={!!error}
              isApplied={isApplied}
            />
            {renderLoadingIndicator()}
            {renderNoMatchIndicator()}
            {renderSuggestions()}
          </div>,
        );

      case "productNPSTGWBuckets":
        return renderInputWrapper(
          <div className="space-y-1">
            <ProductNPSBuckets
              value={value}
              onChange={onChange || (() => {})}
              disabled={readOnly}
              error={!!error}
              isApplied={isApplied}
            />
            {renderLoadingIndicator()}
            {renderNoMatchIndicator()}
            {renderSuggestions()}
          </div>,
        );

      case "chassis-with-zone":
        return renderInputWrapper(
          <div className="space-y-1">
            {isQuestionTrackingEnabled ? (
              <ChassisWithZone
                value={value}
                onChange={(val) => {
                  if (onChange) onChange(val);
                  if (
                    isQuestionTrackingEnabled &&
                    onTrackingChange &&
                    val?.chassisNumber !== trackingValue
                  ) {
                    onTrackingChange(val?.chassisNumber || "");
                  }
                }}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                disabled={readOnly}
                isApplied={isApplied}
                suggestions={suggestedMatches || []}
              />
            ) : (
              <ChassisWithZone
                value={value}
                onChange={(val) => onChange && onChange(val)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                disabled={readOnly}
                isApplied={isApplied}
                hideChassisNumber={true}
                suggestions={suggestedMatches || []}
              />
            )}
            {renderLoadingIndicator()}
            {renderNoMatchIndicator()}
            {renderSuggestions()}
          </div>,
        );

      case "chassis-without-zone":
        return renderInputWrapper(
          <div className="space-y-1">
            {isQuestionTrackingEnabled ? (
              <ChassisWithoutZone
                value={value}
                onChange={(val) => {
                  if (onChange) onChange(val);
                  if (
                    isQuestionTrackingEnabled &&
                    onTrackingChange &&
                    val?.chassisNumber !== trackingValue
                  ) {
                    onTrackingChange(val?.chassisNumber || "");
                  }
                }}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                disabled={readOnly}
                isApplied={isApplied}
                suggestions={suggestedMatches || []}
              />
            ) : (
              <ChassisWithoutZone
                value={value}
                onChange={(val) => onChange && onChange(val)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                disabled={readOnly}
                isApplied={isApplied}
                hideChassisNumber={true}
                suggestions={suggestedMatches || []}
              />
            )}
            {renderLoadingIndicator()}
            {renderNoMatchIndicator()}
            {renderSuggestions()}
          </div>,
        );

      case "zone-in":
        return renderInputWrapper(
          <div className="space-y-1">
            {isQuestionTrackingEnabled ? (
              <ZoneIn
                value={value}
                onChange={(val) => {
                  if (onChange) onChange(val);
                  if (
                    isQuestionTrackingEnabled &&
                    onTrackingChange &&
                    val?.chassisNumber !== trackingValue
                  ) {
                    onTrackingChange(val?.chassisNumber || "");
                  }
                }}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                disabled={readOnly}
                isApplied={isApplied}
                suggestions={suggestedMatches || []}
              />
            ) : (
              <ZoneIn
                value={value}
                onChange={(val) => onChange && onChange(val)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                disabled={readOnly}
                isApplied={isApplied}
                hideChassisNumber={true}
                suggestions={suggestedMatches || []}
              />
            )}
            {renderLoadingIndicator()}
            {renderNoMatchIndicator()}
            {renderSuggestions()}
          </div>,
        );

      case "zone-out":
        return renderInputWrapper(
          <div className="space-y-1">
            {isQuestionTrackingEnabled ? (
              <ZoneOut
                value={value}
                onChange={(val) => {
                  if (onChange) onChange(val);
                  if (
                    isQuestionTrackingEnabled &&
                    onTrackingChange &&
                    val?.chassisNumber !== trackingValue
                  ) {
                    onTrackingChange(val?.chassisNumber || "");
                  }
                }}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                disabled={readOnly}
                isApplied={isApplied}
                suggestions={suggestedMatches || []}
              />
            ) : (
              <ZoneOut
                value={value}
                onChange={(val) => onChange && onChange(val)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                disabled={readOnly}
                isApplied={isApplied}
                hideChassisNumber={true}
                suggestions={suggestedMatches || []}
              />
            )}
            {renderLoadingIndicator()}
            {renderNoMatchIndicator()}
            {renderSuggestions()}
          </div>,
        );

      case "file":
        return renderInputWrapper(
          <div className="space-y-1">
            <FileInput
              question={question}
              value={value}
              onChange={onChange || (() => {})}
              readOnly={readOnly}
              isValidationError={!!error}
              isApplied={isApplied}
            />
            {renderLoadingIndicator()}
            {renderNoMatchIndicator()}
            {renderSuggestions()}
          </div>,
        );

      case "date":
      case "time":
        return renderInputWrapper(
          <div className="space-y-1">
            <DateTimeInput
              question={question}
              value={value}
              onChange={onChange || (() => {})}
              readOnly={readOnly}
              error={!!error}
              isApplied={isApplied}
            />
            {renderLoadingIndicator()}
            {renderNoMatchIndicator()}
            {renderSuggestions()}
          </div>,
        );

      default:
        return renderInputWrapper(
          <div className="space-y-1">
            <input
              type={effectiveType}
              value={value || ""}
              onChange={(e) =>
                !readOnly && onChange && onChange(e.target.value)
              }
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              required={question.required}
              disabled={readOnly}
              className={`w-full px-3 py-1.5 border rounded-xl text-[11px] font-medium transition-all duration-300 ${getBorderClass()} ${readOnly ? "opacity-50 cursor-not-allowed" : ""} ${
                error ? "border-red-500 ring-4 ring-red-500/10" : ""
              }`}
              placeholder={`Enter ${effectiveType === "email" ? "email" : effectiveType === "number" ? "number" : "response"}...`}
            />
            {renderLoadingIndicator()}
            {renderNoMatchIndicator()}
            {renderSuggestions()}
          </div>,
        );
    }
  };

  const renderTrackingInput = () => {
    const shouldRenderSubTracking =
      isQuestionTrackingEnabled ||
      Boolean(question.trackResponseRankLabel && (question.trackResponseRank === true || String(question.trackResponseRank) === "true"));
    if (!shouldRenderSubTracking) return null;

    if (question.type?.startsWith("chassis-") || question.type?.startsWith("zone-")) {
      return (
        <div className="mt-4 mb-2 space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
          <label
            className={`block font-bold text-[11px] tracking-tight ${darkMode ? "text-blue-400" : "text-blue-600"}`}
          >
            {trackingInputLabel}
            <span className="text-red-500 ml-1.5">*</span>
          </label>
        </div>
      );
    }

    return (
      <div className="mt-4 space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
        <label
          className={`block font-bold text-[11px] tracking-tight ${darkMode ? "text-blue-400" : "text-blue-600"}`}
        >
          {trackingInputLabel}
          <span className="text-red-500 ml-1.5">*</span>
        </label>
        <div className="space-y-1">
          <input
            type={trackingInputType}
            value={trackingValue || ""}
            onChange={(e) =>
              !readOnly && onTrackingChange && onTrackingChange(e.target.value)
            }
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            required
            disabled={readOnly}
            className={`w-full px-3 py-1.5 border rounded-xl text-[11px] font-medium transition-all duration-300 ${getBorderClass(true)} ${readOnly ? "opacity-50 cursor-not-allowed" : ""} ${
              trackingError ? "border-red-500 ring-4 ring-red-500/10" : ""
            }`}
            placeholder={`Enter ${trackingInputType === "email" ? "email" : trackingInputType === "number" ? "number" : "tracking response"}...`}
          />
          {trackingError && (
            <p className="text-[9px] font-bold text-red-500 mt-1">
              {trackingError}
            </p>
          )}
        </div>
      </div>
    );
  };

  const questionText = question.text?.trim() || (question as any).title?.trim() || (question as any).description?.trim() || "";
  const showLabel = questionText.length > 0;

  const activeError = error || validationError;

  return (
    <div className="space-y-3" data-error={!!activeError}>
      {imageUrl ? (
        <div className="relative inline-flex mb-2">
          {isImage ? (
            <img
              src={imageUrl}
              alt={questionText || "Question image"}
              className="max-h-48 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 object-contain shadow-sm"
              onError={(e) => {
                // If image fails to load (e.g., due to permissions), show download option
                e.currentTarget.style.display = "none";
                const parent = e.currentTarget.parentElement;
                if (parent) {
                  // Extract file ID for download link
                  const fileId = imageUrl.match(/id=([^&]+)/)?.[1];
                  const downloadUrl = fileId
                    ? `https://drive.google.com/uc?export=download&id=${fileId}`
                    : imageUrl;

                  const downloadDiv = document.createElement("div");
                  downloadDiv.className =
                    "flex items-center gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm";
                  downloadDiv.innerHTML = `
              <div class="p-2 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
              </div>
              <div class="flex flex-col">
                <span class="text-[11px] font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                  Google Drive File (Preview Not Available)
                </span>
                <a href="${downloadUrl}" 
                   target="_blank" 
                   rel="noopener noreferrer"
                   class="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-bold">
                  Download File
                </a>
              </div>
            `;
                  parent.appendChild(downloadDiv);
                }
              }}
            />
          ) : (
            // File download UI for non-images
            <div className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <div className="p-2 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                  {imageUrl.split("/").pop() || "Question File"}
                </span>
                <a
                  href={
                    imageUrl.includes("thumbnail")
                      ? imageUrl.replace("thumbnail", "uc?export=download")
                      : imageUrl
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-bold"
                >
                  Download File
                </a>
              </div>
            </div>
          )}
          {question.required && !showLabel ? (
            <span className="absolute top-1.5 right-1.5 text-base font-bold text-red-500">
              *
            </span>
          ) : null}
        </div>
      ) : null}
      {showLabel ? (
        <label
          className={`block font-bold text-[13px] tracking-tight ${darkMode ? "text-white/90" : "text-slate-900"}`}
        >
          <div className="flex items-center gap-2">
            {questionText}
            {question.required && <span className="text-red-500">*</span>}
          </div>
          {loadingRank && (
            <span className="ml-2 inline-flex items-center">
              <span className="animate-spin h-3 w-3 border-2 border-blue-500 border-t-transparent rounded-full"></span>
            </span>
          )}
          {typeof rank === "number" && rank > 0 && (() => {
            const isParentFollowUp = Boolean(parentMatchInfo?.isParentLinked || (parentMatchInfo?.exists && parentMatchInfo?.attemptsCount > 0));
            const statusLower = (previousStatus || "").toLowerCase().trim();

            const historyItems = (rankHistory && rankHistory.length > 0)
              ? rankHistory
              : (Array.isArray(suggestedAnswers) ? suggestedAnswers : []);

            const hasActionableContext = dispatchInfo?.isDispatched || historyItems.length > 0 || lastResponseId || biwInfo?.status;
            const showBiw = hasActionableContext && (!isCreator || Boolean(biwInfo?.status));
            const showChat = chatCount > 0 || ((dispatchInfo?.isDispatched || (historyItems.length > 0 && lastResponseId)) && !isCreator);

            // Render BIW & Chat buttons cleanly
            const renderActionIcons = () => {
              if (!showBiw && !showChat) return null;

              return (
                <div className="flex items-center gap-1.5 ml-1 self-center">
                  {/* BIW Review Icon */}
                  {(() => {
                    if (!showBiw) return null;

                    const bStr = String(biwInfo?.status || "").toLowerCase();
                    const isBiwRej = bStr.includes("reject");
                    const isBiwAccepted = bStr.includes("accept") || bStr.includes("ok");
                    const isBiwRework = bStr.includes("rework");
                    const biwIconColor = isBiwRej
                      ? "text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800"
                      : isBiwAccepted
                        ? "text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                        : isBiwRework
                          ? "text-purple-600 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800"
                          : "text-amber-600 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800";

                    return (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowBiwModal(true);
                        }}
                        className={`relative p-1.5 rounded-lg border flex items-center justify-center transition-all cursor-pointer shadow-xs hover:scale-105 ${biwIconColor}`}
                        title={`BIW Review: ${biwInfo?.status || "Pending Review"}${biwInfo?.reviewedByName ? ` (by ${biwInfo.reviewedByName})` : ""}`}
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span
                          className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ring-white dark:ring-gray-900 ${
                            isBiwRej
                              ? "bg-rose-500"
                              : isBiwAccepted
                                ? "bg-emerald-500"
                                : isBiwRework
                                  ? "bg-purple-500"
                                  : "bg-amber-400"
                          }`}
                        />
                      </button>
                    );
                  })()}

                  {/* Overall Chat Icon */}
                  {(() => {
                    if (!showChat) return null;

                    return (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowChatModal(true);
                          fetchChatHistory();
                        }}
                        title={`Chassis Discussion / Chat (${chatCount} messages) - Click to open discussion`}
                        className="relative p-1.5 rounded-lg border text-indigo-600 dark:text-indigo-400 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 hover:scale-105 active:scale-95 border-indigo-200 dark:border-indigo-800 flex items-center justify-center transition-all cursor-pointer shadow-xs"
                      >
                        <MessageCircle className="w-4 h-4" />
                        {chatCount > 0 && (
                          <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 rounded-full text-[9px] font-black bg-indigo-600 text-white flex items-center justify-center ring-1.5 ring-white dark:ring-gray-900 leading-none">
                            {chatCount}
                          </span>
                        )}
                      </button>
                    );
                  })()}
                </div>
              );
            };

            // If follow-up parent card exists, let the bottom card display the full progression cleanly
            if (isParentFollowUp) {
              return renderActionIcons();
            }

            if (rank === 1 && historyItems.length === 0) {
              return (
                <div className="flex items-center gap-1.5 ml-2">
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md border text-xs font-semibold bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                    title="Inspection Attempt #1 (Initial inspection)"
                  >
                    <span>Attempt #1</span>
                    <span className="text-[10px] font-medium opacity-80">(Initial)</span>
                  </span>
                  {renderActionIcons()}
                </div>
              );
            }

            return (
              <div className="flex flex-wrap items-center gap-1.5 ml-2 mt-1 sm:mt-0">
                {/* Historical attempts */}
                {historyItems.map((hist: any) => {
                  const sStr = String(hist.status || "").toLowerCase().trim();
                  const isHistRej = sStr.includes("reject");
                  const isHistAccepted = sStr.includes("accept") || sStr.includes("direct ok") || sStr.includes("ok") || sStr === "verified";
                  const chipStyle = isHistRej
                    ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                    : isHistAccepted
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                      : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800";

                  const respId = hist.id || hist.responseId || hist._id;
                  const canViewRecord = isHistAccepted && Boolean(respId);

                  if (canViewRecord) {
                    return (
                      <a
                        key={`prev-attempt-${hist.rank}`}
                        href={`/responses/${hist.responseId}?tab=responses`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold border transition-all hover:scale-105 cursor-pointer ${chipStyle}`}
                        title={`Attempt #${hist.rank} (${hist.status || "Accepted"}) - Click to view response`}
                      >
                        <span>Attempt #{hist.rank}</span>
                        {hist.status && hist.status !== 'pending' && (
                          <span className="text-[10px] font-medium opacity-80">({hist.status})</span>
                        )}
                        <Eye className="w-3 h-3 ml-0.5 opacity-70" />
                      </a>
                    );
                  }

                  return (
                    <span
                      key={`prev-attempt-${hist.rank}`}
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold border ${chipStyle}`}
                    >
                      <span>Attempt #{hist.rank}</span>
                      {hist.status && (
                        <span className="text-[10px] font-medium opacity-80">({hist.status})</span>
                      )}
                    </span>
                  );
                })}

                {/* If no history items array yet, but rank > 1 */}
                {historyItems.length === 0 && rank > 1 && (() => {
                  const isPrevAccepted = statusLower.includes("accept") || statusLower.includes("direct ok") || statusLower.includes("ok") || statusLower === "verified";
                  const isPrevRej = statusLower.includes("reject");
                  const chipStyle = isPrevRej
                    ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                    : isPrevAccepted
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                      : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800";

                  return (
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold border ${chipStyle}`}
                    >
                      <span>Attempt #{rank - 1}</span>
                      {previousStatus && (
                        <span className="text-[10px] font-medium opacity-80">({previousStatus})</span>
                      )}
                    </span>
                  );
                })()}

                {/* Current Active Attempt */}
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800"
                  title={`Current inspection attempt #${rank}`}
                >
                  <span>Attempt #{rank}</span>
                  <span className="text-[10px] font-medium px-1 bg-indigo-200/50 dark:bg-indigo-800/50 rounded">Current</span>
                </span>

                {renderActionIcons()}
              </div>
            );
          })()}

          {/* Inline suggestions: show when global rank exists OR when this question has local rank */}
          {((typeof rank === "number" && rank > 0) || (typeof currentRank === "number" && currentRank > 0)) && !isQuestionTrackingEnabled && (
            /* Show for ALL questions when there's a global rank, regardless of individual question's trackResponseRank setting */
            ((typeof currentRank === "number" && currentRank > 0) || (question.trackResponseRank === true || String(question.trackResponseRank) === "true")) && (
              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex flex-wrap gap-1.5">
                  {(() => {
                    const normalize = (s: string) =>
                      String(s || "")
                        .toLowerCase()
                        .replace(/_tracking$/, "")
                        .replace(/^_/, "")
                        .trim();

                    const formatVal = (val: any) => {
                      if (val === null || val === undefined) return "";
                      if (typeof val === "object") {
                        if (Array.isArray(val)) return val.join(", ");
                        
                        // Handle common object structures by joining non-empty properties
                        const parts: string[] = [];
                        if (val.status) {
                          parts.push(String(val.status));
                        }
                        if (val.chassisNumber) parts.push(String(val.chassisNumber));
                        if (val.zone && String(val.zone).length > 0) parts.push(`Zone: ${Array.isArray(val.zone) ? val.zone.join(', ') : val.zone}`);
                        
                        // Handle hierarchical zonesData if present
                        if (val.zonesData) {
                          Object.entries(val.zonesData).forEach(([zoneName, zoneData]: [string, any]) => {
                            if (zoneData.categories && Array.isArray(zoneData.categories)) {
                              zoneData.categories.forEach((cat: any) => {
                                if (cat.defects && Array.isArray(cat.defects) && cat.defects.length > 0) {
                                  parts.push(`${zoneName} - ${cat.name}: ${cat.defects.join(', ')}`);
                                }
                              });
                            }
                          });
                        }

                        if (val.defectCategory) {
                          const cats = Array.isArray(val.defectCategory) ? val.defectCategory : [val.defectCategory];
                          if (cats.length > 0) parts.push(`Cat: ${cats.join(', ')}`);
                        }
                        if (val.defects && Array.isArray(val.defects) && val.defects.length > 0) {
                          parts.push(`Defects: ${val.defects.join(', ')}`);
                        }
                        
                        if (parts.length > 0) return parts.join(" | ");
                        
                        try {
                          // Filter out empty strings from values when stringifying
                          const cleanedObj = Object.fromEntries(
                            Object.entries(val).filter(([_, v]) => v !== "" && v !== null && v !== undefined)
                          );
                          if (Object.keys(cleanedObj).length === 0) return "";
                          return JSON.stringify(cleanedObj);
                        } catch {
                          return "Object";
                        }
                      }
                      
                      return String(val);
                    };

                    const targetKey = normalize(question.id || (question as any)._id);
                    const groupedRecords = new Map<string, { rankItems: Array<{ rank: number; status?: string }>, rawValue: any }>();

                    // Collect and group records by formatted value to avoid repetition
                    if (Array.isArray(suggestedAnswers)) {
                      suggestedAnswers.forEach((s: any) => {
                        const answers = s.answers || {};
                        const matchKey = Object.keys(answers).find(k => normalize(k) === targetKey);
                        const matchVal = matchKey ? answers[matchKey] : null;

                        if (matchVal !== null && matchVal !== undefined && String(matchVal).trim() !== "") {
                          const displayVal = formatVal(matchVal);
                          if (displayVal && displayVal.trim() !== "") {
                            let groupKey = displayVal;
                            if (typeof matchVal === 'object' && matchVal !== null && matchVal.evidence) {
                              groupKey += ` | Evidence: ${JSON.stringify(matchVal.evidence)}`;
                            } else if (typeof matchVal === 'string' && (matchVal.startsWith('http') || matchVal.startsWith('data:image'))) {
                              groupKey = matchVal;
                            } else if (Array.isArray(matchVal)) {
                              groupKey = JSON.stringify(matchVal);
                            }

                            const existing = groupedRecords.get(groupKey);
                            const item = { 
                              rank: s.rank || 0, 
                              status: s.status || "", 
                              responseId: s.id || s._id || s.responseId || "" 
                            };
                            if (existing) {
                              existing.rankItems.push(item);
                            } else {
                              groupedRecords.set(groupKey, { rankItems: [item], rawValue: matchVal });
                            }
                          }
                        }
                      });
                    }

                    if (groupedRecords.size === 0) return null;

                    const getRankColor = (rank: number, status?: string) => {
                      const s = String(status || "").toLowerCase().trim();
                      if (s.includes("reject")) {
                        return "bg-red-500 text-white";
                      }
                      if (s.includes("rework")) {
                        return "bg-amber-500 text-white";
                      }
                      if (s.includes("accept") || s.includes("direct ok") || s.includes("ok") || s === "verified") {
                        return "bg-emerald-500 text-white";
                      }
                      return rank > 1 ? "bg-amber-500 text-white" : "bg-emerald-500 text-white";
                    };

                    return (
                      <div className="flex flex-col gap-2 w-full mt-2">
                        {Array.from(groupedRecords.entries()).map(([displayVal, data], idx) => {
                          return (
                            <div key={`grouped-rec-${idx}`} className="flex flex-col gap-1.5 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                              <div className="flex flex-wrap gap-1 items-center">
                                {data.rankItems.sort((a,b) => a.rank - b.rank).map(item => {
                                  const statusStr = String(item.status || "").toLowerCase().trim();
                                  const isAcceptedTag = statusStr.includes("accept") || statusStr.includes("direct ok") || statusStr.includes("ok") || statusStr === "verified" || (!statusStr && item.rank === 1);
                                  
                                  return (
                                    <span key={`rank-tag-${item.rank}`} className="inline-flex items-center">
                                      {isAcceptedTag && item.responseId ? (
                                        <a
                                          href={`/responses/${item.responseId}?tab=responses`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          title={`View accepted response #${item.rank} (opens responses tab in new tab)`}
                                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tight hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-xs ${getRankColor(item.rank, item.status)}`}
                                        >
                                          <span>#{item.rank}</span>
                                          <Eye className="w-3.5 h-3.5 text-white" />
                                        </a>
                                      ) : (
                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tight shadow-xs ${getRankColor(item.rank, item.status)}`}>
                                          #{item.rank}
                                        </span>
                                      )}
                                    </span>
                                  );
                                })}
                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 ml-1">
                                  Historical Record
                                </span>
                                </div>
                                {(() => {
                                  const val = data.rawValue;
                                  if (!val) return null;
                                  
                                  const renderImg = (src: string, i: number) => {
                                    if (typeof src !== 'string' || (!src.startsWith('http') && !src.startsWith('data:image'))) return null;
                                    return (
                                      <a href={src} target="_blank" rel="noopener noreferrer" key={i} className="block cursor-pointer hover:opacity-80 transition-opacity">
                                        <img src={src} alt="Evidence" className="w-16 h-16 object-cover rounded-md border border-slate-200 dark:border-slate-700 shadow-sm" />
                                      </a>
                                    );
                                  };

                                  // Simple image URL
                                  if (typeof val === 'string' && (val.startsWith('http') || val.startsWith('data:image')) && val.match(/\.(jpeg|jpg|gif|png|webp)/i)) {
                                    return <div className="mt-1">{renderImg(val, 0)}</div>;
                                  }

                                  // Array of images
                                  if (Array.isArray(val) && val.length > 0 && val.every(v => typeof v === 'string' && (v.startsWith('http') || v.startsWith('data:image')))) {
                                    return (
                                      <div className="flex flex-wrap gap-2 mt-1">
                                        {val.map((v, i) => renderImg(v, i))}
                                      </div>
                                    );
                                  }

                                  // Object (like ZoneIn)
                                  if (typeof val === 'object' && !Array.isArray(val)) {
                                    const textPart = formatVal(val);
                                    let evidenceImgs: any[] = [];
                                    if (val.evidence) {
                                      evidenceImgs = Array.isArray(val.evidence) ? val.evidence : [val.evidence];
                                    }
                                    
                                    return (
                                      <div className="flex flex-col gap-1.5 mt-0.5">
                                        {textPart && (
                                          <div className={`text-[10px] font-bold leading-relaxed ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
                                            {textPart}
                                          </div>
                                        )}
                                        {evidenceImgs.length > 0 && (
                                          <div className="flex flex-wrap gap-2 mt-1">
                                            {evidenceImgs.map((img, i) => renderImg(img, i))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  }

                                  // Fallback to text
                                  return (
                                    <div className={`text-[10px] font-bold leading-relaxed mt-0.5 ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
                                      {formatVal(val)}
                                    </div>
                                  );
                                })()}
                              </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )
          )}
        </label>
      ) : null}
      {question.description ? (
        <p
          className={`text-[10px] font-medium leading-relaxed mb-3 ${darkMode ? "text-slate-500" : "text-slate-500"}`}
        >
          {question.description}
        </p>
      ) : null}
      {(question.subParam1 || question.subParam2) && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {question.subParam1 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-[0.15em] bg-blue-500/10 text-blue-500 border border-blue-500/20">
              {question.subParam1}
            </span>
          )}
          {question.subParam2 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-[0.15em] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              {question.subParam2}
            </span>
          )}
        </div>
      )}
      <div className="mt-2">
        {renderTrackingInput()}
        <div className="mt-4">{renderInput()}</div>
        {renderFollowUpParentStatusCard()}
      </div>
      {activeError && (
        <p className="text-[10px] font-bold text-red-500 mt-1 animate-in fade-in slide-in-from-top-1">
          {activeError}
        </p>
      )}

      {/* ======================================================== */}
      {/* ON-SCREEN CHAT & DISCUSSION MODAL (PORTALED)             */}
      {/* ======================================================== */}
      {showChatModal && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setShowChatModal(false)}
        >
          <div
            className="w-full max-w-xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-white/10">
                  <MessageCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">
                    Chassis Discussion & Review
                  </h3>
                  <p className="text-xs text-indigo-100 opacity-90">
                    Chassis ID: {effectiveTrackingValue || "N/A"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowChatModal(false)}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* BIW Review Action Bar inside Overall Chat */}
            <div className="px-4 py-2.5 bg-indigo-50/70 dark:bg-gray-800/80 border-b border-indigo-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
                <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>B&W Review:</span>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    biwInfo?.status === "Accepted"
                      ? "bg-green-100 text-green-800 border border-green-300"
                      : biwInfo?.status === "Rejected"
                        ? "bg-red-100 text-red-800 border border-red-300"
                        : biwInfo?.status === "Reworked"
                          ? "bg-purple-100 text-purple-800 border border-purple-300"
                          : "bg-amber-100 text-amber-800 border border-amber-300"
                  }`}
                >
                  {biwInfo?.status || "Pending"}
                </span>
                {biwInfo?.reviewedByName && (
                  <span className="text-[10px] text-gray-400 font-normal">
                    (by {biwInfo.reviewedByName})
                  </span>
                )}
              </div>

              {/* Review Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={updatingBiw}
                  onClick={() => handleUpdateBiwStatus("Accepted")}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                    biwInfo?.status === "Accepted"
                      ? "bg-green-600 text-white border-green-600 shadow-xs"
                      : "bg-green-50 hover:bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800"
                  }`}
                >
                  <span>✅</span> Accepted
                </button>
                <button
                  type="button"
                  disabled={updatingBiw}
                  onClick={() => handleUpdateBiwStatus("Rejected")}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                    biwInfo?.status === "Rejected"
                      ? "bg-red-600 text-white border-red-600 shadow-xs"
                      : "bg-red-50 hover:bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800"
                  }`}
                >
                  <span>❌</span> Rejected
                </button>
                <button
                  type="button"
                  disabled={updatingBiw}
                  onClick={() => handleUpdateBiwStatus("Reworked")}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                    biwInfo?.status === "Reworked"
                      ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                      : "bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800"
                  }`}
                >
                  <span>🔄</span> Rework
                </button>
              </div>
            </div>

            {/* Chat Messages Body */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 min-h-[220px] max-h-[360px] bg-gray-50 dark:bg-gray-950/50">
              {loadingChatMessages ? (
                <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin mb-2 text-indigo-600" />
                  <span className="text-xs">Loading conversation history...</span>
                </div>
              ) : chatMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-center px-4">
                  <MessageCircle className="w-8 h-8 stroke-1 text-gray-300 dark:text-gray-600 mb-2" />
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                    No discussion messages yet
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Send a message below or mark a review status above.
                  </p>
                </div>
              ) : (
                chatMessages.map((msg: any, idx: number) => {
                  const senderName =
                    msg.from?.name || msg.from?.username || msg.from?.email || "User";
                  const timeStr = msg.createdAt
                    ? new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "";
                  return (
                    <div
                      key={msg._id || idx}
                      className="flex flex-col p-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs"
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                        <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                          <User className="w-3.5 h-3.5" />
                          {senderName}
                        </span>
                        {timeStr && (
                          <span className="text-[10px] text-gray-400 font-normal">
                            {timeStr}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                        {msg.message}
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input Bar (No nested <form> tag) */}
            <div
              className="p-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex items-center gap-2"
            >
              <input
                type="text"
                placeholder="Type a message or note for this chassis..."
                value={newChatMessage}
                onChange={(e) => setNewChatMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendChatMessage();
                  }
                }}
                disabled={sendingChat}
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
              <button
                type="button"
                onClick={() => handleSendChatMessage()}
                disabled={sendingChat || !newChatMessage.trim()}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                {sendingChat ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Send</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ======================================================== */}
      {/* ON-SCREEN BIW REVIEW DETAILS MODAL (PORTALED)            */}
      {/* ======================================================== */}
      {showBiwModal && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setShowBiwModal(false)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-white/10">
                  <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">
                    BIW Quality Review
                  </h3>
                  <p className="text-xs text-purple-100 opacity-90">
                    Chassis: {effectiveTrackingValue || "N/A"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBiwModal(false)}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 space-y-4 bg-white dark:bg-gray-900 text-xs">
              {/* Status Banner */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <span className="font-bold text-gray-500 uppercase tracking-wider text-[10px]">
                  Review Status
                </span>
                <span
                  className={`px-3 py-1 rounded-lg font-black text-xs ${
                    String(biwInfo?.status).toLowerCase().includes("reject")
                      ? "bg-red-500 text-white"
                      : String(biwInfo?.status).toLowerCase().includes("accept")
                        ? "bg-emerald-600 text-white"
                        : "bg-purple-600 text-white"
                  }`}
                >
                  {biwInfo?.status || "Pending Review"}
                </span>
              </div>

              {/* Interactive Review Action Buttons */}
              <div className="p-3 rounded-xl bg-purple-50/60 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase block mb-2">
                  Update Quality Review Status
                </span>
                {!pendingBiwAction ? (
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      disabled={updatingBiw}
                      onClick={() => handleUpdateBiwStatus("Accepted")}
                      className={`py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        biwInfo?.status === "Accepted"
                          ? "bg-green-600 text-white border-green-600 shadow-xs"
                          : "bg-white dark:bg-gray-800 text-green-700 border-green-300 hover:bg-green-50"
                      }`}
                    >
                      <span>✅</span> Accepted
                    </button>
                    <button
                      type="button"
                      disabled={updatingBiw}
                      onClick={() => setPendingBiwAction("Rejected")}
                      className={`py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        biwInfo?.status === "Rejected"
                          ? "bg-red-600 text-white border-red-600 shadow-xs"
                          : "bg-white dark:bg-gray-800 text-red-700 border-red-300 hover:bg-red-50"
                      }`}
                    >
                      <span>❌</span> Rejected
                    </button>
                    <button
                      type="button"
                      disabled={updatingBiw}
                      onClick={() => setPendingBiwAction("Reworked")}
                      className={`py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        biwInfo?.status === "Reworked"
                          ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                          : "bg-white dark:bg-gray-800 text-purple-700 border-purple-300 hover:bg-purple-50"
                      }`}
                    >
                      <span>🔄</span> Rework
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${pendingBiwAction === "Rejected" ? "bg-red-100 text-red-700" : "bg-purple-100 text-purple-700"}`}>
                        {pendingBiwAction === "Rejected" ? "❌ Rejected" : "🔄 Rework"} Selected
                      </span>
                      <button onClick={() => { setPendingBiwAction(null); setBiwSelectedQuestionIds([]); setBiwReasonText(""); setBiwEvidenceUrl(""); }} className="text-[10px] font-bold text-gray-500 hover:text-gray-700 underline cursor-pointer">
                        Cancel
                      </button>
                    </div>

                    {/* Question Selection Checkboxes */}
                    <div>
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">
                        Which question(s) is this about?
                      </label>
                      <div className="space-y-1 max-h-32 overflow-y-auto pr-1 border border-purple-200 dark:border-purple-800 rounded-lg p-2 bg-white dark:bg-gray-800">
                        {formQuestions.length === 0 ? (
                          <div className="flex items-center justify-center p-2 text-xs text-gray-500">
                            <Loader2 className="w-3 h-3 animate-spin mr-2" /> Loading questions...
                          </div>
                        ) : (
                          formQuestions.map(q => (
                            <label key={q.id} className="flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer p-1 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded">
                              <input
                                type="checkbox"
                                checked={biwSelectedQuestionIds.includes(q.id)}
                                onChange={() => {
                                  setBiwSelectedQuestionIds(prev => 
                                    prev.includes(q.id) ? prev.filter(id => id !== q.id) : [...prev, q.id]
                                  );
                                }}
                                className="w-3.5 h-3.5 mt-0.5 rounded accent-purple-600 cursor-pointer"
                              />
                              <span className="leading-tight">{q.text}</span>
                            </label>
                          ))
                        )}
                        {/* Other option */}
                        <label className="flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer p-1 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded">
                          <input
                            type="checkbox"
                            checked={biwSelectedQuestionIds.includes("other")}
                            onChange={() => {
                              setBiwSelectedQuestionIds(prev => 
                                prev.includes("other") ? prev.filter(id => id !== "other") : [...prev, "other"]
                              );
                            }}
                            className="w-3.5 h-3.5 mt-0.5 rounded accent-purple-600 cursor-pointer"
                          />
                          <span className="leading-tight text-gray-500 italic">Other (Specify below)</span>
                        </label>
                      </div>
                    </div>

                    {/* Remark Textarea */}
                    <div>
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">
                        Remark
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Explain why this needs rework or is rejected..."
                        value={biwReasonText}
                        onChange={(e) => setBiwReasonText(e.target.value)}
                        className="w-full text-xs p-2 rounded-lg border border-purple-300 dark:border-purple-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                      />
                    </div>

                    {/* Evidence Upload */}
                    <div>
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">
                        Evidence (optional)
                      </label>
                      {biwEvidenceUrl ? (
                        <div className="relative group">
                          <img
                            src={biwEvidenceUrl}
                            alt="Evidence"
                            className="w-full h-24 object-cover rounded-lg border border-purple-300 dark:border-purple-700 cursor-pointer"
                            onClick={() => window.open(biwEvidenceUrl, "_blank")}
                          />
                          <button
                            type="button"
                            onClick={() => setBiwEvidenceUrl("")}
                            className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            title="Remove evidence"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : biwUploading ? (
                        <div className="flex items-center justify-center gap-2 p-3 bg-purple-50/50 dark:bg-purple-900/10 border border-purple-300 dark:border-purple-700 rounded-lg">
                          <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                          <span className="text-[10px] text-gray-500 font-semibold">Uploading...</span>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center gap-1 p-3 border-2 border-dashed border-purple-300 dark:border-purple-700 rounded-lg cursor-pointer hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-all bg-white dark:bg-gray-800">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) await handleBiwEvidenceUpload(file);
                              e.target.value = "";
                            }}
                          />
                          <Upload className="w-4 h-4 text-purple-400" />
                          <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold">
                            Upload photo evidence
                          </span>
                        </label>
                      )}
                    </div>

                    <button
                      disabled={
                        (biwSelectedQuestionIds.length === 0 && !biwReasonText.trim()) || 
                        (biwSelectedQuestionIds.includes("other") && !biwReasonText.trim()) || 
                        updatingBiw || 
                        biwUploading
                      }
                      onClick={() => {
                        const flaggedQuestions = biwSelectedQuestionIds
                          .filter(id => id !== "other")
                          .map(id => ({
                            questionId: id,
                            questionText: formQuestions.find(q => q.id === id)?.text || id
                          }));
                          
                        handleUpdateBiwStatus(pendingBiwAction, biwReasonText.trim(), biwEvidenceUrl, flaggedQuestions);
                        setPendingBiwAction(null);
                        setBiwSelectedQuestionIds([]);
                        setBiwReasonText("");
                        setBiwEvidenceUrl("");
                      }}
                      className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {updatingBiw ? "Updating..." : "Submit Review"}
                    </button>
                  </div>
                )}
              </div>

              {/* Reviewer Details */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">
                    Reviewed By
                  </span>
                  <span className="font-bold text-gray-800 dark:text-gray-200">
                    {biwInfo?.reviewedByName || "Quality Lead"}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">
                    Date & Time
                  </span>
                  <span className="font-bold text-gray-800 dark:text-gray-200">
                    {biwInfo?.reviewedAt
                      ? new Date(biwInfo.reviewedAt).toLocaleDateString()
                      : "Recent"}
                  </span>
                </div>
              </div>

              {/* Remarks/Notes */}
              {biwInfo?.notes && (
                <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                  <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase block mb-1">
                    Review Remarks
                  </span>
                  <p className="text-gray-700 dark:text-gray-300 italic">
                    "{biwInfo.notes}"
                  </p>
                </div>
              )}

              {/* Dispatch clearance check */}
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-gray-500" />
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    Dispatch Status:
                  </span>
                </div>
                <span
                  className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                    dispatchInfo?.isDispatched
                      ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                  }`}
                >
                  {dispatchInfo?.isDispatched ? "✓ Dispatched" : "Pending Dispatch"}
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800/60 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                type="button"
                onClick={() => setShowBiwModal(false)}
                className="px-4 py-1.5 rounded-xl bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
