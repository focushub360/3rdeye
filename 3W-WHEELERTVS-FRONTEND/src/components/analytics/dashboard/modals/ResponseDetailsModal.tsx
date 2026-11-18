import React from 'react';
import { X, Clock, Eye, CheckCircle2 } from 'lucide-react';
import type { Form, Response, Section } from '../types';

export interface ResponseDetailsModalProps {
  selectedResponse: Response | null;
  selectedFormForModal: Form | null;
  onClose: () => void;
  getResponseTimestamp: (r: any) => string | undefined;
  formatToDDMMYYYY: (d: any, time?: boolean) => string;
  getResponseChassisValue: (r: any) => string;
  computeParentMatch: (r: any) => any;
  isChildFollowUpForm: boolean;
  handleViewParentResponse: (r: any, pm?: any) => void;
  renderAnswerDisplay: (answer: any, question: any) => React.ReactNode;
  hasAnswerValue: (answer: any) => boolean;
  getRankStyle: (answer: any, darkMode: boolean) => string;
  darkMode: boolean;
}

export const ResponseDetailsModal: React.FC<ResponseDetailsModalProps> = ({
  selectedResponse,
  selectedFormForModal,
  onClose,
  getResponseTimestamp,
  formatToDDMMYYYY,
  getResponseChassisValue,
  computeParentMatch,
  isChildFollowUpForm,
  handleViewParentResponse,
  renderAnswerDisplay,
  hasAnswerValue,
  getRankStyle,
  darkMode,
}) => {
  if (!selectedResponse || !selectedFormForModal) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 rounded-lg max-w-4xl w-full my-8 max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white dark:bg-gray-900 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Response Details
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                Form
              </p>
              <p className="text-gray-900 dark:text-white">
                {selectedFormForModal?.title || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                Submitted
              </p>
              <p className="text-gray-900 dark:text-white">
                {getResponseTimestamp(selectedResponse)
                  ? formatToDDMMYYYY(
                    getResponseTimestamp(selectedResponse)!,
                    true
                  )
                  : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                Time Taken
              </p>
              <p className="text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {(() => {
                  const timeSpent =
                    selectedResponse.timeSpent ??
                    (selectedResponse as any).totalTimeSpent ??
                    0;
                  return timeSpent > 0
                    ? timeSpent > 60
                      ? `${Math.floor(timeSpent / 60)}m ${timeSpent % 60}s`
                      : `${timeSpent}s`
                    : "N/A";
                })()}
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                Chassis Number
              </p>
              <p className="text-gray-900 dark:text-white font-mono font-bold text-sm">
                {(() => {
                  const cv = getResponseChassisValue(selectedResponse);
                  return cv && cv !== "-" && cv !== "N/A" ? cv : "None";
                })()}
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">
                Parent Match / Status
              </p>
              {(() => {
                const pm = computeParentMatch(selectedResponse);
                const isMatched = pm.status === "matched" && (pm.badgeText.includes("Parent Matched") || isChildFollowUpForm);
                const Icon = pm.icon || (isMatched ? Eye : CheckCircle2);
                return (
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border shadow-xs ${pm.badgeClasses}`} title={pm.tooltip}>
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span>{pm.badgeText}</span>
                      {pm.subText && <span className="opacity-75 font-normal ml-1">({pm.subText})</span>}
                    </span>
                    {isMatched && (
                      <button
                        type="button"
                        onClick={() => handleViewParentResponse(selectedResponse, pm)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
                        title="Open parent response details page"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Parent Response</span>
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {selectedFormForModal?.sections?.map((section: Section) => (
            <div
              key={section.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
            >
              <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-4">
                {section.title}
              </h3>
              <div className="space-y-4">
                {section.questions?.map((question: any) => {
                  const answer = selectedResponse.answers?.[question.id];
                  return (
                    <div
                      key={question.id}
                      className="border-l-4 border-blue-300 dark:border-blue-700 pl-4"
                    >
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                        {question.text}
                      </p>
                      <div className="text-gray-900 dark:text-gray-100 flex flex-col gap-1">
                        {hasAnswerValue(answer) ? (
                          renderAnswerDisplay(answer, question)
                        ) : (
                          <span className="text-gray-400">No response</span>
                        )}
                        {question.trackResponseRank &&
                          selectedResponse.responseRanks?.[question.id] && (
                            <span
                              className={`text-[10px] font-bold min-w-[24px] h-6 px-1.5 rounded-full flex items-center justify-center border shadow-sm ${getRankStyle(answer, darkMode)}`}
                            >
                              #{selectedResponse.responseRanks[question.id]}
                            </span>
                          )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {selectedFormForModal?.followUpQuestions && selectedFormForModal.followUpQuestions.length > 0 && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-4">
                Follow-up Questions
              </h3>
              <div className="space-y-4">
                {selectedFormForModal.followUpQuestions.map(
                  (question: any) => {
                    const answer = selectedResponse.answers?.[question.id];
                    return (
                      <div
                        key={question.id}
                        className="border-l-4 border-purple-300 dark:border-purple-700 pl-4"
                      >
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                          {question.text}
                        </p>
                        <div className="text-gray-900 dark:text-gray-100 flex flex-col gap-1">
                          {hasAnswerValue(answer) ? (
                            renderAnswerDisplay(answer, question)
                          ) : (
                            <span className="text-gray-400">
                              No response
                            </span>
                          )}
                          {question.trackResponseRank &&
                            selectedResponse.responseRanks?.[
                            question.id
                            ] && (
                              <span
                                className={`text-[10px] font-bold min-w-[24px] h-6 px-1.5 rounded-full flex items-center justify-center border shadow-sm ${getRankStyle(answer, darkMode)}`}
                              >
                                #
                                {
                                  selectedResponse.responseRanks[
                                  question.id
                                  ]
                                }
                              </span>
                            )}
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-800 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-400 dark:hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
