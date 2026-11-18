import React from "react";
import {
  MessageCircle,
  X,
  Check,
  CheckCircle,
  CheckCircle2,
  ChevronRight,
  Layers,
} from "lucide-react";
import { QuestionSuggestionRenderer } from "../components/QuestionSuggestionRenderer";
import { renderMessageWithImages, formatChatAnswerValue } from "../utils/chatHelpers";
import type { Response, Form } from "../types";

export interface ChatDiscussionModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatResponse: Response | null;
  form: Form | null;
  user: any;
  searchParams: URLSearchParams;
  tvsReviews: any[];
  reviewFormTabs: any[];
  activeReviewQuestionTab: string;
  setActiveReviewQuestionTab: (tab: string) => void;
  selectedReviewOptions: Record<string, string>;
  setSelectedReviewOptions: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  reviewedBy: Record<string, any>;
  setReviewedBy: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  pendingReviewOption: string | null;
  setPendingReviewOption: (option: string | null) => void;
  chatFilters: any;
  setChatFilters: React.Dispatch<React.SetStateAction<any>>;
  chatMessages: any[];
  newMessage: string;
  setNewMessage: (msg: string) => void;
  isSendingMessage: boolean;
  canUserBiwReview: (response: Response | null) => { canReview: boolean; reason?: string };
  isChildFollowUpForm: boolean;
  handleSendMessage: (messageOverride?: string) => Promise<void>;
  handleReviewSubmit: (responseId: string, option: string, note?: string) => Promise<void>;
  showToast: (message: string, type: "success" | "error" | "info") => void;
}

export const ChatDiscussionModal: React.FC<ChatDiscussionModalProps> = ({
  isOpen,
  onClose,
  chatResponse,
  form,
  user,
  searchParams,
  tvsReviews,
  reviewFormTabs,
  activeReviewQuestionTab,
  setActiveReviewQuestionTab,
  selectedReviewOptions,
  setSelectedReviewOptions,
  reviewedBy,
  setReviewedBy,
  pendingReviewOption,
  setPendingReviewOption,
  chatFilters,
  setChatFilters,
  chatMessages,
  newMessage,
  setNewMessage,
  isSendingMessage,
  canUserBiwReview,
  isChildFollowUpForm,
  handleSendMessage,
  handleReviewSubmit,
  showToast,
}) => {
  if (!isOpen || !chatResponse) return null;

  return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[60] flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-[96vw] max-w-6xl max-h-[92vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-800">
            <div className="px-6 py-4 border-b border-indigo-700/40 bg-gradient-to-r from-indigo-600 via-indigo-700 to-blue-600">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <MessageCircle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      Review & Discussion: {chatResponse.submittedBy || "Inspector"}
                    </h2>
                    <p className="text-xs text-white/70">
                      Chassis:{" "}
                      {(() => {
                        if (chatResponse.chassisNumber) return chatResponse.chassisNumber;
                        if (chatResponse.answers?.chassis_number) return chatResponse.answers.chassis_number;
                        if (chatResponse.answers?.chassisNumber) return chatResponse.answers.chassisNumber;
                        const chassisQ = form?.sections
                          ?.flatMap((s) => s.questions || [])
                          .find(
                            (q) =>
                              q.type === "chassis" ||
                              q.type === "chassisWithZone" ||
                              q.type === "chassisWithoutZone" ||
                              q.text?.toLowerCase().includes("chassis"),
                          );
                        const chassisVal =
                          chatResponse.answers?.[chassisQ?.id || ""];
                        if (
                          typeof chassisVal === "object" &&
                          chassisVal?.chassisNumber
                        ) {
                          return chassisVal.chassisNumber;
                        }
                        if (
                          typeof chassisVal === "string" &&
                          chassisVal.trim()
                        ) {
                          return chassisVal;
                        }
                        return "N/A";
                      })()}
                    </p>
                  </div>
                </div>

                {/* Review Options - Right side of header */}
                <div className="flex items-center gap-3">
                  {/* === TVS REVIEW: Review Actions (Accept / Reject / Rework) & Status === */}
                  {(() => {
                    const responseId = chatResponse?.id || "";

                    const tvsRev = tvsReviews.find(
                      (tr) =>
                        String(tr.responseId || tr.response_id || "") ===
                        String(responseId),
                    );

                    let reviewer = null;
                    let reviewOption = "";

                    if (chatResponse?.review) {
                      reviewer = chatResponse.review.reviewer;
                      reviewOption =
                        chatResponse.review.option ||
                        chatResponse.review.reviewOption;
                    } else if (tvsRev?.status || tvsRev?.reviewOption) {
                      reviewer = tvsRev.reviewer;
                      reviewOption = tvsRev.status || tvsRev.reviewOption;
                    } else {
                      reviewer = reviewedBy[responseId];
                      reviewOption = selectedReviewOptions[responseId];
                    }

                    const hasReviewer =
                      reviewer &&
                      (reviewer.id ||
                        (reviewer as any)._id ||
                        reviewer.name ||
                        reviewer.email);
                    const hasOption = reviewOption && reviewOption !== "";

                    // If a review option is currently pending, show the pending badge with cancel
                    if (pendingReviewOption) {
                      return (
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-3 py-1 text-xs font-bold rounded ${pendingReviewOption === "Rejected"
                              ? "bg-red-500/30 text-red-100 border border-red-400"
                              : "bg-yellow-500/30 text-yellow-100 border border-yellow-400"
                              }`}
                          >
                            {pendingReviewOption === "Rejected" ? "❌" : "🔄"}{" "}
                            {pendingReviewOption} — Select questions & enter feedback
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setPendingReviewOption(null);
                              setChatFilters((prev) => ({ ...prev, questions: [] }));
                            }}
                            className="px-2 py-1 text-xs font-bold rounded bg-white/10 text-white hover:bg-white/20 transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      );
                    }

                    const reviewCheck = canUserBiwReview(chatResponse);

                    // If not reviewed yet and user is authorized, show the 3 TVS review buttons
                    if (reviewCheck.canReview && (!hasOption || !hasReviewer)) {
                      return (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-white/80 uppercase tracking-wider mr-1">
                            TVS Review:
                          </span>
                          {["Accepted", "Rejected", "Rework"].map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => {
                                if (opt === "Accepted") {
                                  handleReviewSubmit(chatResponse.id, opt);
                                } else {
                                  setPendingReviewOption(opt);
                                }
                              }}
                              className={`px-3 py-1 text-xs font-bold rounded transition-all border shadow-sm ${opt === "Accepted"
                                ? "bg-green-500/30 border-green-400 text-green-100 hover:bg-green-500/50"
                                : opt === "Rejected"
                                  ? "bg-red-500/30 border-red-400 text-red-100 hover:bg-red-500/50"
                                  : "bg-yellow-500/30 border-yellow-400 text-yellow-100 hover:bg-yellow-500/50"
                                }`}
                            >
                              {opt === "Accepted" ? "✅" : opt === "Rejected" ? "❌" : "🔄"}{" "}
                              {opt}
                            </button>
                          ))}
                        </div>
                      );
                    }

                    if (!hasReviewer || !hasOption) return null;

                    const reviewerName =
                      reviewer.name ||
                      reviewer.email ||
                      user?.name ||
                      user?.email ||
                      "Reviewer";
                    const isAccepted = String(reviewOption).toLowerCase().trim() === "accepted";
                    const isRejected = String(reviewOption).toLowerCase().trim() === "rejected";
                    const emoji = isAccepted ? "✅" : isRejected ? "❌" : "🔄";
                    const badgeClass = isAccepted
                      ? "bg-green-500/20 border-green-400 text-green-100"
                      : isRejected
                        ? "bg-red-500/20 border-red-400 text-red-100"
                        : "bg-yellow-500/20 border-yellow-400 text-yellow-100";

                    return (
                      <div className="flex items-center gap-2">
                        <div
                          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg border ${badgeClass}`}
                        >
                          <span>
                            <span className="font-bold">TVS Review:</span> {emoji}{" "}
                            {reviewOption} by {reviewerName}
                          </span>
                        </div>
                        {reviewCheck.canReview && (
                          <div className="flex items-center gap-1 ml-1">
                            {["Accepted", "Rejected", "Rework"]
                              .filter((opt) => opt.toLowerCase() !== String(reviewOption).toLowerCase())
                              .map((opt) => (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => {
                                    if (opt === "Accepted") {
                                      handleReviewSubmit(chatResponse.id, opt);
                                    } else {
                                      setPendingReviewOption(opt);
                                    }
                                  }}
                                  className="px-2 py-0.5 text-[10px] font-bold rounded bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all"
                                  title={`Change TVS review to ${opt}`}
                                >
                                  {opt === "Accepted" ? "✅ Accept" : opt === "Rejected" ? "❌ Reject" : "🔄 Rework"}
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  <button
                    onClick={() => {
                      const responseId = searchParams.get("responseId");
                      if (responseId) {
                        navigate("/inspector/chat");
                      } else {
                        setShowChatModal(false);
                        setChatResponse(null);
                        setPendingReviewOption(null);
                        setSelectedReviewOptions((prev) => ({
                          ...prev,
                          [chatResponse?.id || ""]: "",
                        }));
                        setReviewedBy((prev) => ({
                          ...prev,
                          [chatResponse?.id || ""]: null,
                        }));
                      }
                    }}
                    className="p-2 hover:bg-white/10 rounded-full text-white transition-colors"
                    title="Close Chat"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-0">
              {/* Left Column: Filters & Questions */}
              <div className="lg:col-span-7 p-6 bg-slate-50/50 dark:bg-gray-900/50 border-r border-gray-200 dark:border-gray-700 overflow-y-auto space-y-5">
                <div>
                  <div className="space-y-4">
                    <p className="text-xl text-gray-700 dark:text-gray-300">
                      Chassis Number :{" "}
                      {(() => {
                        if (chatResponse.chassisNumber) return chatResponse.chassisNumber;
                        if (chatResponse.answers?.chassis_number) return chatResponse.answers.chassis_number;
                        if (chatResponse.answers?.chassisNumber) return chatResponse.answers.chassisNumber;
                        const chassisQ = form?.sections
                          ?.flatMap((s) => s.questions || [])
                          .find(
                            (q) =>
                              q.type === "chassis" ||
                              q.type === "chassisWithZone" ||
                              q.type === "chassisWithoutZone" ||
                              q.text?.toLowerCase().includes("chassis"),
                          );
                        const chassisVal =
                          chatResponse.answers?.[chassisQ?.id || ""];
                        if (
                          typeof chassisVal === "object" &&
                          chassisVal?.chassisNumber
                        ) {
                          return chassisVal.chassisNumber;
                        }
                        if (
                          typeof chassisVal === "string" &&
                          chassisVal.trim()
                        ) {
                          return chassisVal;
                        }
                        return "N/A";
                      })()}
                    </p>

                    {/* Show question selection panel when Rejected/Rework is pending */}
                    {pendingReviewOption ? (
                      <div className="space-y-3">
                        <div
                          className={`flex items-center gap-2 p-3 rounded-xl border ${pendingReviewOption === "Rejected"
                            ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                            : "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
                            }`}
                        >
                          <span className="text-xl">
                            {pendingReviewOption === "Rejected" ? "❌" : "🔄"}
                          </span>
                          <div>
                            <p
                              className={`text-xs font-bold ${pendingReviewOption === "Rejected"
                                ? "text-red-700 dark:text-red-300"
                                : "text-yellow-700 dark:text-yellow-300"
                                }`}
                            >
                              {pendingReviewOption} TVS Review
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {pendingReviewOption === "Rejected"
                                ? "Flag questions with issues (optional), then enter mandatory rejection reason in the Message Center on the right."
                                : 'Select questions requiring rework, then type feedback in the Message Center and submit.'}
                            </p>
                          </div>
                        </div>

                        {/* Tabbed Question Selection Panel for Connected Forms */}
                        {(() => {
                          const activeTab = reviewFormTabs.find((t) => t.id === activeReviewQuestionTab) || reviewFormTabs[0];

                          return (
                            <div className="space-y-3">
                              {/* Form Selection Tabs: Main Form & Child Form */}
                              {reviewFormTabs.length > 1 && (
                                <div className="p-3.5 bg-slate-100/80 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-xs space-y-2.5">
                                  <div className="flex items-center justify-between px-0.5">
                                    <div className="flex items-center gap-1.5">
                                      <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                                        Choose Form Questionnaire:
                                      </span>
                                    </div>
                                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                      Click tab to switch inspection checkpoints
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    {reviewFormTabs.map((tab) => {
                                      const isTabActive = activeTab.id === tab.id;
                                      const selectedInTabCount = (tab.questions || []).filter((q) =>
                                        chatFilters.questions.includes(q.id)
                                      ).length;
                                      const isMain = tab.badge.includes("Main") || tab.badge.includes("Parent");

                                      return (
                                        <button
                                          key={tab.id}
                                          type="button"
                                          onClick={() => setActiveReviewQuestionTab(tab.id)}
                                          className={`relative flex items-center justify-between p-3.5 rounded-xl text-left transition-all cursor-pointer border ${isTabActive
                                            ? isMain
                                              ? "bg-white dark:bg-gray-800 border-blue-500 dark:border-blue-400 shadow-md ring-2 ring-blue-500/20"
                                              : "bg-white dark:bg-gray-800 border-purple-500 dark:border-purple-400 shadow-md ring-2 ring-purple-500/20"
                                            : "bg-white/80 dark:bg-gray-800/60 border-slate-200 dark:border-slate-700/80 hover:border-slate-300 hover:bg-white dark:hover:bg-gray-800 shadow-2xs"
                                            }`}
                                        >
                                          <div className="flex items-start gap-2.5 min-w-0 pr-2">
                                            <div
                                              className={`p-2 rounded-lg shrink-0 mt-0.5 ${isTabActive
                                                ? isMain
                                                  ? "bg-blue-600 text-white shadow-xs"
                                                  : "bg-purple-600 text-white shadow-xs"
                                                : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                                                }`}
                                            >
                                              <FileText className="w-4 h-4" />
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                              <div className="flex items-center gap-1.5 mb-1">
                                                <span
                                                  className={`text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md ${isMain
                                                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                                                    : "bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                                                    }`}
                                                >
                                                  {isMain ? "Main Form" : "Child Form"}
                                                </span>
                                                {isTabActive && (
                                                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                                    <CheckCircle2 className="w-3 h-3" /> Active
                                                  </span>
                                                )}
                                              </div>
                                              <span
                                                className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-snug line-clamp-2"
                                                title={tab.title}
                                              >
                                                {tab.title}
                                              </span>
                                              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                                                {tab.questions.length} questions {tab.submittedBy ? `• ${tab.submittedBy}` : ""}
                                              </span>
                                            </div>
                                          </div>

                                          <div className="flex flex-col items-end shrink-0 pl-1">
                                            {selectedInTabCount > 0 ? (
                                              <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold shadow-xs">
                                                {selectedInTabCount} flagged
                                              </span>
                                            ) : (
                                              <span
                                                className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition-colors ${isTabActive
                                                  ? isMain
                                                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60"
                                                    : "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/60"
                                                  : "text-slate-400 border border-transparent"
                                                  }`}
                                              >
                                                {isTabActive ? "Viewing" : "Select"}
                                              </span>
                                            )}
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              <div className="flex items-center justify-between pt-1">
                                <div className="flex items-center gap-2">
                                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider block">
                                    Select Questions to Flag
                                  </label>
                                  {chatFilters.questions.length > 0 && (
                                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 text-[10px] font-black border border-amber-300">
                                      {chatFilters.questions.length} Selected
                                    </span>
                                  )}
                                </div>
                                {activeTab.questions.length > 0 && (
                                  <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                                    Showing {activeTab.questions.length} questions from {activeTab.badge}
                                  </span>
                                )}
                              </div>

                              <div className="max-h-[460px] overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl shadow-xs scrollbar-thin bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                                {activeTab.questions.length === 0 ? (
                                  <div className="p-8 text-center text-xs text-gray-500 dark:text-gray-400">
                                    <p className="font-semibold mb-1">No questions found for {activeTab.title}</p>
                                    <p className="text-[11px] opacity-75">Inspection checkpoints will appear here once loaded.</p>
                                  </div>
                                ) : (
                                  activeTab.questions.map((q: any) => {
                                    const isChecked = chatFilters.questions.includes(q.id);
                                    const qAnswer = activeTab.answers?.[q.id];

                                    return (
                                      <div
                                        key={q.id}
                                        className={`p-3 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-colors ${isChecked ? "bg-indigo-50/30 dark:bg-indigo-950/20" : ""
                                          }`}
                                      >
                                        <div className="flex items-start gap-3">
                                          <label className="mt-0.5 cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={(e) => {
                                                const checked = e.target.checked;
                                                setChatFilters((prev) => ({
                                                  ...prev,
                                                  questions: checked
                                                    ? [...prev.questions, q.id]
                                                    : prev.questions.filter((id) => id !== q.id),
                                                }));
                                              }}
                                              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                                            />
                                          </label>
                                          <div className="flex-1 min-w-0">
                                            <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 block mb-1">
                                              {q.text || q.title || q.id}
                                            </span>
                                            {qAnswer !== undefined ? (
                                              <div className="text-[11px] text-gray-500 bg-gray-50 dark:bg-gray-900/50 p-1.5 rounded mb-1 flex items-center gap-1.5 flex-wrap">
                                                <span className="font-semibold text-gray-600 dark:text-gray-400">
                                                  Current:
                                                </span>
                                                {formatChatAnswerValue(qAnswer)}
                                              </div>
                                            ) : (
                                              <div className="text-[10px] text-gray-400 italic mb-1">
                                                Not inspected in this record
                                              </div>
                                            )}
                                            {isChecked && (
                                              <div className="mt-2 space-y-2">
                                                <QuestionSuggestionRenderer
                                                  question={q}
                                                  currentAnswer={qAnswer}
                                                  value={chatFilters.suggestedAnswers?.[q.id] || {}}
                                                  onChange={(val) =>
                                                    setChatFilters((prev) => ({
                                                      ...prev,
                                                      suggestedAnswers: {
                                                        ...prev.suggestedAnswers,
                                                        [q.id]: val,
                                                      },
                                                    }))
                                                  }
                                                />
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      /* Display TVS review overview, status, feedback & discussion context */
                      <div className="space-y-4">
                        {/* 1. Review Summary Card if reviewed */}
                        {(() => {
                          const tvsRev = tvsReviews.find(
                            (tr) =>
                              String(tr.responseId || tr.response_id || "") ===
                              String(chatResponse?.id),
                          );
                          const revOption =
                            chatResponse?.review?.option ||
                            chatResponse?.review?.reviewOption ||
                            tvsRev?.status ||
                            tvsRev?.reviewOption ||
                            selectedReviewOptions[chatResponse?.id || ""];
                          const reviewerName =
                            (typeof chatResponse?.review?.reviewer === "object"
                              ? chatResponse?.review?.reviewer?.name || chatResponse?.review?.reviewer?.email
                              : chatResponse?.review?.reviewer) ||
                            tvsRev?.reviewer?.name ||
                            tvsRev?.reviewer ||
                            reviewedBy[chatResponse?.id || ""]?.name ||
                            reviewedBy[chatResponse?.id || ""]?.email ||
                            "";
                          const reviewDate =
                            chatResponse?.review?.reviewAt ||
                            chatResponse?.review?.reviewedAt ||
                            tvsRev?.createdAt ||
                            "";
                          const remark =
                            chatResponse?.review?.message ||
                            chatResponse?.review?.remark ||
                            chatResponse?.review?.reason ||
                            tvsRev?.remark ||
                            "";
                          const evidenceUrl = chatResponse?.review?.evidenceUrl;

                          if (!revOption && !reviewerName) {
                            return (
                              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs text-gray-500">
                                💬 Use the Message Center to discuss this chassis and share inspection feedback.
                              </div>
                            );
                          }

                          const isAccepted = String(revOption).toLowerCase().trim() === "accepted";
                          const isRejected = String(revOption).toLowerCase().trim() === "rejected";
                          const badgeColor = isAccepted
                            ? "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800"
                            : isRejected
                              ? "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800"
                              : "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800";

                          return (
                            <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                  TVS Review Status
                                </span>
                                <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border flex items-center gap-1.5 ${badgeColor}`}>
                                  {isAccepted ? "✅" : isRejected ? "❌" : "🔄"} {revOption}
                                </span>
                              </div>

                              {reviewerName && (
                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                  <span className="font-semibold text-gray-700 dark:text-gray-300">Reviewed By:</span> {reviewerName}
                                  {reviewDate && (
                                    <span className="ml-2 text-gray-400">
                                      ({new Date(reviewDate).toLocaleDateString()} {new Date(reviewDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                                    </span>
                                  )}
                                </p>
                              )}

                              {remark && (
                                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 text-xs">
                                  <span className="font-bold text-amber-700 dark:text-amber-400 block mb-1">
                                    Reviewer Feedback / Remarks:
                                  </span>
                                  <p className="text-gray-700 dark:text-gray-300 italic">"{remark}"</p>
                                </div>
                              )}

                              {evidenceUrl && (
                                <div>
                                  <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400 block mb-1">
                                    Reviewer Attachment / Evidence:
                                  </span>
                                  <a href={evidenceUrl} target="_blank" rel="noreferrer" className="inline-block">
                                    <img
                                      src={evidenceUrl}
                                      alt="Review evidence"
                                      className="w-32 h-20 object-cover rounded-lg border border-gray-200 hover:opacity-90 transition-opacity"
                                    />
                                  </a>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* 2. Flagged Items for Discussion */}
                        {(() => {
                          const tvsRev = tvsReviews.find(
                            (tr) =>
                              String(tr.responseId || tr.response_id || "") ===
                              String(chatResponse?.id),
                          );
                          const rawFlagged =
                            chatResponse?.review?.flaggedQuestions ||
                            tvsRev?.flaggedQuestions ||
                            [];
                          const allFlagged = rawFlagged.map((qText: any) => ({
                            questionId: typeof qText === "string" ? qText : qText.questionId || qText.text || "",
                            questionText: typeof qText === "string" ? qText : qText.questionText || qText.text || qText.title || "",
                          })).filter((item: any) => Boolean(item.questionText));

                          if (allFlagged.length === 0) return null;

                          return (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                  Flagged Items for Discussion ({allFlagged.length})
                                </label>
                              </div>
                              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                {allFlagged.map((item: any, idx: number) => {
                                  const qId = item.questionId || item.id;
                                  const qTitle = item.questionText || item.title || qId;
                                  const matchingQ = form?.sections
                                    ?.flatMap((s) => s.questions || [])
                                    .find((q: any) => q.id === qId || q.text === qTitle);
                                  const ans = chatResponse?.answers?.[matchingQ?.id || qId];

                                  return (
                                    <div
                                      key={idx}
                                      className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xs space-y-2"
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                                          {idx + 1}. {qTitle}
                                        </p>
                                        <button
                                          onClick={() => {
                                            const replyPrefix = `Replying regarding "${qTitle.substring(0, 30)}...": `;
                                            setNewMessage((prev) => prev ? `${prev}\n${replyPrefix}` : replyPrefix);
                                            const textarea = document.querySelector("textarea");
                                            if (textarea) textarea.focus();
                                          }}
                                          className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0"
                                        >
                                          Reply to this
                                        </button>
                                      </div>
                                      {ans !== undefined && (
                                        <div className="text-[11px] text-gray-500 bg-gray-50 dark:bg-gray-900/50 p-2 rounded flex items-center gap-1.5 flex-wrap">
                                          <span className="font-semibold text-gray-600 dark:text-gray-400">Current Answer:</span>
                                          {formatChatAnswerValue(ans)}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* Right Column: Chat history and input */}
              <div className="lg:col-span-5 flex flex-col bg-white dark:bg-gray-900 border-t lg:border-t-0 p-6 overflow-hidden min-h-0">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                    Message Center
                  </h3>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 rounded-full border border-green-200 dark:border-green-800">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-bold text-green-700 dark:text-green-400">
                      Live Context
                    </span>
                  </div>
                </div>

                <div className="flex-1 bg-gray-50 dark:bg-gray-800/20 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 mb-4 overflow-y-auto space-y-4 flex flex-col scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
                  {(() => {
                    const list = chatMessages.filter(
                      (msg) => !msg.message?.startsWith("[BIW Review]")
                    );

                    let visibleChatMessages = [...list];

                    // Check both Main Form (1st) and Target/Child Form (2nd) TVS reviews
                    const curRev = chatResponse?.review;
                    const parentRev = (chatResponse as any)?.parentReview || (chatResponse as any)?.followUpStatus?.parentReview;
                    const childRev = (chatResponse as any)?.childReview || (chatResponse as any)?.followUpStatus?.childReview;

                    const rev1 = isChildFollowUpForm ? parentRev : curRev;
                    const rev1Title = isChildFollowUpForm
                      ? ((chatResponse as any)?.parentFormTitle || (chatResponse as any)?.followUpStatus?.parentFormTitle || relatedFormData?.parentForm?.title || "Main Form")
                      : (form?.title || "Main Form");

                    const rev2 = isChildFollowUpForm ? curRev : childRev;
                    const rev2Title = isChildFollowUpForm
                      ? (form?.title || "Child Form")
                      : ((chatResponse as any)?.childFormTitle || (chatResponse as any)?.followUpStatus?.childFormTitle || "Child Form");

                    const createSynthReviewMsg = (revObj: any, titleTag: string, idSuffix: string) => {
                      if (!revObj) return null;
                      const status = revObj.reviewOption || revObj.status;
                      const remark = revObj.remark || revObj.reason || revObj.message;
                      if (!status && !remark) return null;

                      const reviewerName = typeof revObj.reviewer === "object"
                        ? revObj.reviewer?.name || revObj.reviewer?.email
                        : (revObj.reviewedByName || revObj.reviewerName || revObj.reviewer || "Reviewer");
                      const reviewerId = typeof revObj.reviewer === "object"
                        ? revObj.reviewer?._id || revObj.reviewer?.id
                        : (revObj.reviewedBy || revObj.reviewerId);
                      const flaggedTitles = Array.isArray(revObj.flaggedQuestions)
                        ? revObj.flaggedQuestions.map((q: any) => typeof q === "object" ? q.questionText || q.title || q.text || q.questionId : String(q))
                        : (revObj.reason ? [revObj.reason] : []);

                      const displayRemark = remark || `TVS Review: ${status}`;
                      return {
                        _id: `synthetic-review-msg-${idSuffix}`,
                        isReviewFeedback: true,
                        reviewOption: status || "Reviewed",
                        from: {
                          _id: reviewerId,
                          name: reviewerName,
                          email: typeof revObj.reviewer === "object" ? revObj.reviewer?.email : ""
                        },
                        message: `[${titleTag}] ${displayRemark}`,
                        questionTitles: flaggedTitles,
                        createdAt: revObj.reviewedAt || revObj.createdAt || new Date().toISOString()
                      };
                    };

                    // Check if 1st TVS review message is already present in visibleChatMessages
                    if (rev1) {
                      const r1Remark = rev1.remark || rev1.reason;
                      const alreadyInList = r1Remark && visibleChatMessages.some((m) => m.message && m.message.includes(r1Remark));
                      if (!alreadyInList) {
                        const m1 = createSynthReviewMsg(rev1, `1st: ${rev1Title.replace(/^1st:\s*/i, "")}`, "1");
                        if (m1) visibleChatMessages.unshift(m1);
                      }
                    }

                    // Check if 2nd TVS review message is already present in visibleChatMessages
                    if (rev2) {
                      const r2Remark = rev2.remark || rev2.reason;
                      const alreadyInList = r2Remark && visibleChatMessages.some((m) => m.message && m.message.includes(r2Remark));
                      if (!alreadyInList) {
                        const m2 = createSynthReviewMsg(rev2, `2nd: ${rev2Title.replace(/^2nd:\s*/i, "")}`, "2");
                        if (m2) {
                          // Insert after m1 if m1 was unshifted, or at the start
                          if (rev1 && visibleChatMessages.length > 0 && visibleChatMessages[0]._id === "synthetic-review-msg-1") {
                            visibleChatMessages.splice(1, 0, m2);
                          } else {
                            visibleChatMessages.unshift(m2);
                          }
                        }
                      }
                    }

                    if (visibleChatMessages.length === 0) {
                      return (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3 opacity-50">
                          <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full ring-8 ring-gray-50 dark:ring-gray-900/50">
                            <MessageCircle className="w-10 h-10" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-bold text-gray-600 dark:text-gray-300">
                              No active conversation
                            </p>
                            <p className="text-xs">
                              Send a message to start the thread.
                            </p>
                          </div>
                        </div>
                      );
                    }
                    return visibleChatMessages.map((msg, i) => {
                      const isMe = String(msg.from?._id || msg.from) === String(user?._id || (user as any)?.id);
                      const senderName = isMe
                        ? "You"
                        : (msg.from?.name || (msg.isReviewFeedback ? "Reviewer" : "Inspector"));

                      return (
                        <div
                          key={i}
                          className={`flex flex-col ${isMe ? "items-end" : "items-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                        >
                          <div
                            className={`max-w-[90%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${isMe
                              ? "bg-[#dcf8c6] text-gray-900 rounded-br-lg rounded-tr-lg rounded-tl-sm"
                              : "bg-white dark:bg-gray-100 text-gray-900 border border-gray-100 dark:border-gray-700 rounded-bl-lg rounded-tl-lg rounded-tr-sm"
                              }`}
                          >
                            {msg.isReviewFeedback && (
                              <div className="mb-1.5 flex items-center gap-1.5">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${msg.reviewOption === "Rejected"
                                  ? "bg-red-100 text-red-700 border border-red-200"
                                  : "bg-yellow-100 text-yellow-800 border border-yellow-200"
                                  }`}>
                                  TVS Review: {msg.reviewOption}
                                </span>
                              </div>
                            )}
                            {msg.questionContexts &&
                              msg.questionContexts.length > 0 ? (
                              <div className="space-y-3">
                                {msg.questionContexts.map(
                                  (ctx: any, idx: number) => (
                                    <div key={idx} className="space-y-2">
                                      <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400 border-b border-indigo-100 dark:border-indigo-800/50 pb-0.5">
                                        {ctx.title}
                                      </p>

                                      {(() => {
                                        const s = ctx.suggestion;
                                        if (!s) return null;
                                        const hasContent =
                                          typeof s === "object"
                                            ? Boolean(
                                              (s.inspectionRemark && String(s.inspectionRemark).trim()) ||
                                              (s.remark && String(s.remark).trim()) ||
                                              (s.inspectionFileUrl && String(s.inspectionFileUrl).trim()) ||
                                              (s.fileUrl && String(s.fileUrl).trim()),
                                            )
                                            : Boolean(String(s).trim());
                                        if (!hasContent) return null;

                                        return (
                                          <div className="mt-1 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100 dark:border-amber-800">
                                            <p className="text-[10px] font-bold text-amber-600 uppercase mb-1">
                                              Review Feedback:
                                            </p>
                                            {ctx.question ? (
                                              <QuestionSuggestionRenderer
                                                question={ctx.question}
                                                value={ctx.suggestion}
                                                currentAnswer={ctx.answer}
                                                readOnly={true}
                                              />
                                            ) : (
                                              <div className="text-xs text-gray-600 dark:text-gray-400">
                                                {renderAnswerDisplay(
                                                  ctx.suggestion,
                                                  { type: "text" } as any,
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  ),
                                )}
                              </div>
                            ) : (
                              msg.questionTitles &&
                              msg.questionTitles.length > 0 && (
                                <div className="mb-2 p-2 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100/50 dark:border-indigo-800/30">
                                  <p className="text-[10px] uppercase font-black text-indigo-500 dark:text-indigo-400 mb-1.5 flex items-center gap-1">
                                    <Filter className="w-2.5 h-2.5" />
                                    Linked Questions
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {msg.questionTitles.map(
                                      (title: string, idx: number) => (
                                        <span
                                          key={idx}
                                          className="px-1.5 py-0.5 bg-white dark:bg-gray-700 text-[9px] font-bold text-indigo-600 dark:text-indigo-300 rounded-md border border-indigo-100 dark:border-indigo-800"
                                        >
                                          {title}
                                        </span>
                                      ),
                                    )}
                                  </div>
                                </div>
                              )
                            )}
                            {renderMessageWithImages(msg.message)}
                          </div>
                          <div className="flex items-center gap-1 mt-1.5 px-1 opacity-60">
                            <span className="text-[9px] font-medium text-gray-500 dark:text-gray-400">
                              {senderName} •{" "}
                              {new Date(msg.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            {!isMe && (
                              <button
                                onClick={() => {
                                  setNewMessage(
                                    `Replying to: "${msg.message.substring(0, 30)}..." \n`,
                                  );
                                  const textarea =
                                    document.querySelector("textarea");
                                  if (textarea) textarea.focus();
                                }}
                                className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:underline ml-2 pointer-events-auto"
                              >
                                <Reply className="w-3 h-3" />
                                Reply
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>

                {(() => {
                  const isAssignedReviewer = canUserBiwReview(chatResponse).canReview;
                  const hasMessages = chatMessages.some(
                    (m) => !m.message?.startsWith("[BIW Review]")
                  );
                  const hasReviewFeedback = Boolean(
                    (chatResponse as any)?.review?.status ||
                    (chatResponse as any)?.review?.message ||
                    (chatResponse as any)?.review?.option ||
                    (chatResponse as any)?.review?.reviewOption
                  );
                  const hasChatArisen = hasMessages || hasReviewFeedback;

                  // If user is from creator/other tenant (not assigned reviewer) and nothing has arisen in chat:
                  if (!isAssignedReviewer && !hasChatArisen) {
                    return (
                      <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/50 text-center space-y-1.5 shadow-sm">
                        <div className="inline-flex items-center justify-center p-2.5 bg-indigo-100 dark:bg-indigo-900/50 rounded-full text-indigo-600 dark:text-indigo-400 mb-1">
                          <MessageCircle className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
                          Awaiting Discussion from Assigned Tenant
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
                          Chat must be initiated by the assigned tenant reviewer. You will be able to reply here once a review or message has been posted.
                        </p>
                      </div>
                    );
                  }

                  const userEmail = user?.email || "";
                  const userUsername = user?.username || "";
                  const userIdStr = user?._id
                    ? String(user._id)
                    : user?.id
                      ? String(user.id)
                      : "";
                  const creatorId =
                    typeof chatResponse?.createdBy === "object"
                      ? (chatResponse.createdBy as any)?._id ||
                      (chatResponse.createdBy as any)?.id
                      : chatResponse?.createdBy;
                  const creatorIdStr = creatorId ? String(creatorId) : "";

                  const isSubmitter =
                    chatResponse?.submittedBy === userEmail ||
                    chatResponse?.submittedBy === userUsername ||
                    chatResponse?.submitterContact?.email === userEmail ||
                    (creatorIdStr && creatorIdStr === userIdStr);

                  // For submitters, only show message input if no review option is pending
                  if (isSubmitter && pendingReviewOption) {
                    return null;
                  }

                  const questionRemarks = (chatFilters.questions || [])
                    .map((qId) => {
                      const s = chatFilters.suggestedAnswers?.[qId];
                      return (s?.inspectionRemark || s?.remark || "").trim();
                    })
                    .filter(Boolean)
                    .join("; ");

                  const effectiveReviewNote = (newMessage.trim() || questionRemarks).trim();
                  const isRejectionBlank = pendingReviewOption === "Rejected" && !effectiveReviewNote;
                  const isSubmitDisabled = isSendingMessage || (
                    pendingReviewOption === "Rejected"
                      ? isRejectionBlank
                      : pendingReviewOption === "Rework"
                        ? (!effectiveReviewNote && (chatFilters.questions || []).length === 0)
                        : !newMessage.trim()
                  );

                  return (
                    <div className="space-y-3">
                      {pendingReviewOption === "Rejected" && (
                        <div className="flex items-center justify-between mb-0.5 px-1">
                          <label className="text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                            Rejection Reason <span className="text-red-500 font-black">* (Mandatory)</span>
                          </label>
                          <span className="text-[10px] uppercase font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-2 py-0.5 rounded">
                            Required
                          </span>
                        </div>
                      )}
                      <div className="relative">
                        <textarea
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder={
                            pendingReviewOption === "Rejected"
                              ? questionRemarks
                                ? `Using remark from flagged question: "${questionRemarks}". Or type additional notes here...`
                                : "Enter mandatory rejection reason explaining why this chassis is rejected..."
                              : !isAssignedReviewer
                                ? "Type your reply to the reviewer..."
                                : isSubmitter
                                  ? "Send a message..."
                                  : "Type your feedback to the inspector..."
                          }
                          className={`w-full px-5 py-4 bg-gray-50 dark:bg-gray-800 border-2 rounded-2xl text-sm focus:ring-0 transition-all resize-none shadow-inner text-gray-800 dark:text-gray-200 ${pendingReviewOption === "Rejected"
                            ? isRejectionBlank
                              ? "border-red-400/80 focus:border-red-600 dark:border-red-500/80 dark:focus:border-red-400 bg-red-50/20"
                              : "border-emerald-300 focus:border-emerald-500 dark:border-emerald-600"
                            : "border-transparent focus:border-indigo-500 dark:focus:border-indigo-400"
                            }`}
                          rows={3}
                        />
                      </div>
                      {pendingReviewOption === "Rejected" && isRejectionBlank && (
                        <p className="text-[11px] text-red-600 dark:text-red-400 font-semibold flex items-center gap-1 px-1">
                          <span>⚠️</span> Rejection reason cannot be blank. Enter a reason in the box above or add a remark on any flagged question.
                        </p>
                      )}
                      {pendingReviewOption === "Rejected" && !isRejectionBlank && !newMessage.trim() && questionRemarks && (
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 px-1">
                          <span>✓</span> Rejection reason detected from question remark: <i>"{questionRemarks}"</i>
                        </p>
                      )}
                      <button
                        onClick={async () => {
                          if (pendingReviewOption === "Rejected" && !effectiveReviewNote) {
                            showToast("Rejection reason is mandatory. Please enter a reason in the chat box or on a flagged question.", "error");
                            return;
                          }
                          // If a Rejected/Rework review is pending and user is not submitter, send message + submit review together
                          if (pendingReviewOption && !isSubmitter) {
                            const option = pendingReviewOption;
                            const reviewNote = effectiveReviewNote || (option === "Rework" ? "Rework requested for flagged questions." : "");
                            if (option === "Rejected" && !reviewNote) {
                              showToast("Rejection reason is mandatory.", "error");
                              return;
                            }
                            const activeTab = reviewFormTabs.find((t) => t.id === activeReviewQuestionTab) || reviewFormTabs[0];
                            const targetResponseId = activeTab?.responseId || chatResponse!.id;
                            const targetSubmitterId = activeTab?.submittedBy || (chatResponse as any)?.submittedBy;
                            const targetFormId = activeTab?.formId;

                            setPendingReviewOption(null); // Clear pending state immediately
                            await handleSendMessage(reviewNote);
                            await handleReviewSubmit(
                              targetResponseId,
                              option,
                              reviewNote,
                              targetSubmitterId,
                              targetFormId,
                            );
                          } else {
                            await handleSendMessage();
                          }
                        }}
                        disabled={isSubmitDisabled}
                        className={`w-full flex items-center justify-center gap-2 px-6 py-3.5 text-white text-sm font-black rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] shadow-xl ${pendingReviewOption && !isSubmitter
                          ? pendingReviewOption === "Rejected"
                            ? "bg-red-600 hover:bg-red-700 shadow-red-200 dark:shadow-none"
                            : "bg-yellow-600 hover:bg-yellow-700 shadow-yellow-200 dark:shadow-none"
                          : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 dark:shadow-none"
                          }`}
                      >
                        {isSendingMessage ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <span>
                              {pendingReviewOption && !isSubmitter
                                ? `Send Feedback & Submit ${pendingReviewOption}`
                                : !isAssignedReviewer
                                  ? "Send Reply"
                                  : "Send Message"}
                            </span>
                            <ChevronRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                      <div className="flex justify-center gap-2">
                        <p className="text-[10px] text-center text-gray-400 font-medium">
                          {!isAssignedReviewer ? "Reply" : "Message"} will be sent to{" "}
                          <b>
                            {!isAssignedReviewer || isSubmitter
                              ? (typeof chatResponse.review?.reviewer === "object"
                                ? chatResponse.review?.reviewer?.name || chatResponse.review?.reviewer?.email
                                : chatResponse.review?.reviewer) ||
                              "the reviewer"
                              : chatResponse.submittedBy || "the submitter"}
                          </b>
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
  );
};

export default ChatDiscussionModal;
