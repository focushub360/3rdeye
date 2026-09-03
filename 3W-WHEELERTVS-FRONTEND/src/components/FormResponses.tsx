import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Eye,
  Calendar,
  FileText,
  User,
  X,
  ArrowLeft,
  Save,
  Download,
  Table,
  BarChart3,
  BarChart2,
  PieChart,
  Check,
  Trash2,
  Edit2,
  Hash,
  ExternalLink,
  X as XIcon,
} from "lucide-react";
import { apiClient } from "../api/client";
import { formatTimestamp } from "../utils/dateUtils";
import { useNotification } from "../context/NotificationContext";
import { exportResponsesToExcel } from "../utils/exportUtils";
import { exportResponseToPDF, exportAllResponsesToPDF, exportAllResponsesToZip } from "../utils/pdfExportUtils";
import { isImageUrl } from "../utils/answerTemplateUtils";
import ImageLink from "./ImageLink";
import { Bar, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface Response {
  _id: string;
  id: string;
  questionId: string;
  answers: Record<string, any>;
  responseRanks?: Record<string, number>;
  createdAt: string;
  updatedAt: string;
  assignedTo?: string;
  status?: string;
  parentResponseId?: string;
  childResponses?: Response[];
  score?: {
    correct: number;
    total: number;
  };
  submissionMetadata?: {
    ipAddress?: string;
    userAgent?: string;
    browser?: string;
    device?: string;
    os?: string;
    location?: {
      country?: string;
      countryCode?: string;
      region?: string;
      city?: string;
      latitude?: number;
      longitude?: number;
      timezone?: string;
      isp?: string;
    };
    capturedLocation?: {
      latitude?: number;
      longitude?: number;
      accuracy?: number;
      source?: "browser" | "ip" | "manual" | "unknown";
      capturedAt?: string;
    };
    submittedAt?: string;
  };
}

interface Question {
  id: string;
  text: string;
  type: string;
  correctAnswer?: any;
}

interface Section {
  id: string;
  title: string;
  questions: Question[];
}

interface Form {
  _id: string;
  id: string;
  title: string;
  description?: string;
  sections?: Section[];
  followUpQuestions?: Question[];
}

export default function FormResponses() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();
  const [responses, setResponses] = useState<Response[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedResponse, setSelectedResponse] = useState<Response | null>(
    null
  );
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [updating, setUpdating] = useState(false);
  const [showTableView, setShowTableView] = useState(false);
  const [chartType, setChartType] = useState<"bar" | "pie">("bar");

  const questionColumns = useMemo(() => {
    if (!form) return [] as Array<{ id: string; text: string }>;

    const uniqueQuestions = new Map<string, Question>();

    const collectRecursive = (questions: any[]) => {
      questions.forEach((q) => {
        if (q && !uniqueQuestions.has(q.id)) {
          uniqueQuestions.set(q.id, q);
        }
        if (q.followUpQuestions && Array.isArray(q.followUpQuestions)) {
          collectRecursive(q.followUpQuestions);
        }
      });
    };

    if (form.sections) {
      form.sections.forEach((section) => {
        if (section.questions) collectRecursive(section.questions);
      });
    }

    if (form.followUpQuestions) {
      collectRecursive(form.followUpQuestions);
    }

    return Array.from(uniqueQuestions.values()).map(({ id, text }) => ({
      id,
      text,
    }));
  }, [form]);

  const quizQuestions = useMemo(() => {
    return allQuestions.filter((q) => q.correctAnswer !== undefined);
  }, [allQuestions]);

  const getQuestionDistribution = useCallback(
    (questionId: string) => {
      const distribution: Record<string, number> = {};
      responses.forEach((response) => {
        const answer = response.answers?.[questionId];
        const answerStr = Array.isArray(answer)
          ? answer.join(", ")
          : String(answer || "No Answer");
        distribution[answerStr] = (distribution[answerStr] || 0) + 1;
      });
      return distribution;
    },
    [responses]
  );

  const getAnswerDisplay = useCallback(
    (response: Response, questionId: string) => {
      const answer = response.answers?.[questionId];

      if (answer === undefined || answer === null || answer === "") {
        return "--";
      }

      if (Array.isArray(answer)) {
        return answer.join(", ");
      }

      if (typeof answer === "object") {
        // Special handling for Product NPS Buckets (Hierarchy)
        if (answer.level1 || answer.level2 || answer.level3) {
          return [
            answer.level1,
            answer.level2,
            answer.level3,
            answer.level4,
            answer.level5,
            answer.level6,
          ]
            .filter(Boolean)
            .join(" > ");
        }
        try {
          return JSON.stringify(answer, null, 2);
        } catch (error) {
          return String(answer);
        }
      }

      return String(answer);
    },
    []
  );

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [responsesData, formData] = await Promise.all([
        apiClient.getResponses({ formIds: id }),
        apiClient.getForm(id!),
      ]);

      // Set the form
      if (!formData.form) {
        setError("Form not found");
        return;
      }
      setForm(formData.form);

      // Recursive helper to collect all questions including nested ones
      const collectAllQuestions = (questions: any[], result: any[] = []) => {
        questions.forEach(q => {
          result.push(q);
          if (q.followUpQuestions && Array.isArray(q.followUpQuestions)) {
            collectAllQuestions(q.followUpQuestions, result);
          }
        });
        return result;
      };

      // Collect all questions from sections and followUpQuestions
      const allQs: any[] = [];
      if (formData.form.sections) {
        formData.form.sections.forEach((section) => {
          if (section.questions) {
            collectAllQuestions(section.questions, allQs);
          }
        });
      }
      if (formData.form.followUpQuestions) {
        collectAllQuestions(formData.form.followUpQuestions, allQs);
      }
      setAllQuestions(allQs);

      // Filter responses for this form
      const formResponses = responsesData.responses.filter(
        (response: Response) => response.questionId === id
      );

      setResponses(formResponses);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load responses");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteResponse = async (responseId: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this uploaded response?")) {
      return;
    }
    try {
      await apiClient.deleteResponse(responseId);
      setResponses((prev) => prev.filter((r) => r.id !== responseId && r._id !== responseId));
      if (selectedResponse && (selectedResponse.id === responseId || selectedResponse._id === responseId)) {
        setSelectedResponse(null);
      }
      showSuccess("Response deleted successfully");
    } catch (err) {
      console.error("Failed to delete response:", err);
      showError("Failed to delete response");
    }
  };

  const getChassisNumber = (answers: Record<string, any>): string | null => {
    if (!answers) return null;
    for (const [k, v] of Object.entries(answers)) {
      if (
        typeof v === 'string' &&
        v.trim() &&
        (k.toLowerCase().includes('chassis') || k.toLowerCase().includes('vin') || k.toLowerCase().includes('id number') || k === 'chassis_number')
      ) {
        return v.trim();
      }
    }
    return null;
  };

  const getQuestionText = (questionId: string): string => {
    if (!form) return questionId;

    // Search in sections
    if (form.sections) {
      for (const section of form.sections) {
        const question = section.questions?.find((q) => q.id === questionId);
        if (question) return question.text;
      }
    }

    // Search in follow-up questions
    if (form.followUpQuestions) {
      const question = form.followUpQuestions.find((q) => q.id === questionId);
      if (question) return question.text;
    }

    return questionId;
  };

  const openResponseDetails = (response: Response) => {
    setSelectedResponse(response);
    setSelectedStatus(response.status || "pending");
  };

  const handleStatusUpdate = async (newStatus?: string) => {
    if (!selectedResponse) return;
    const targetStatus = newStatus || selectedStatus || selectedResponse.status || "pending";
    const responseId = selectedResponse.id || selectedResponse._id;
    if (!responseId) {
      showError("Response ID not found");
      return;
    }

    try {
      setUpdating(true);
      await apiClient.updateResponse(responseId, {
        status: targetStatus,
      });

      // Update local state in responses array
      setResponses((prev) =>
        prev.map((r) =>
          (r.id === responseId || r._id === responseId) ? { ...r, status: targetStatus } : r
        )
      );
      setSelectedResponse((prev) => prev ? { ...prev, status: targetStatus } : null);
      setSelectedStatus(targetStatus);

      const label =
        targetStatus === "verified"
          ? "Completed"
          : targetStatus === "rejected"
          ? "Closed"
          : "Pending";
      showSuccess(`Status updated to "${label}"`);
    } catch (err) {
      console.error("Failed to update status:", err);
      showError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  const groupResponsesByDate = (responses: Response[]) => {
    return responses.reduce((groups, response) => {
      const date = new Date(response.createdAt).toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(response);
      return groups;
    }, {} as Record<string, Response[]>);
  };

  const handleExport = (targetForm: Form) => {
    exportResponsesToExcel(responses, {
      id: targetForm.id,
      title: targetForm.title,
      description: targetForm.description,
      sections: targetForm.sections,
    } as any);
  };

  const groupedResponses = useMemo(
    () => groupResponsesByDate(responses),
    [responses]
  );

  const renderValue = (val: any): React.ReactNode => {
    if (val === null || val === undefined || val === "") return null;

    if (Array.isArray(val)) {
      return (
        <div className="flex flex-col gap-1">
          {val.map((v, i) => (
            <div key={i}>{renderValue(v)}</div>
          ))}
        </div>
      );
    }

    if (typeof val === "object") {
      // Check for direct image/file properties
      const dataValue = val.url || val.answer || val.data || val.value;
      if (typeof dataValue === "string" && isImageUrl(dataValue)) {
        return <ImageLink text={dataValue} />;
      }

      const entries = Object.entries(val);
      if (entries.length > 0) {
        return (
          <div className="flex flex-col gap-2">
            {entries.map(([k, v], i) => (
              <div key={i} className="flex flex-col gap-0.5 border-l-2 border-primary-100 pl-2">
                <span className="text-[10px] font-bold opacity-70 uppercase tracking-tighter text-primary-600">
                  {k}
                </span>
                {renderValue(v)}
              </div>
            ))}
          </div>
        );
      }
      return JSON.stringify(val);
    }

    const textVal = String(val);
    if (isImageUrl(textVal)) {
      return <ImageLink text={textVal} />;
    }
    return textVal;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <div className="text-red-600 mb-2">Error loading responses</div>
        <div className="text-primary-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => {
                if (window.history.length > 2) {
                  navigate(-1);
                } else {
                  navigate("/forms/analytics");
                }
              }}
              className="flex items-center gap-1.5 text-primary-700 dark:text-primary-300 hover:text-primary-900 bg-white dark:bg-gray-800 border border-primary-200 dark:border-gray-700 px-3.5 py-2 rounded-xl text-xs font-bold shadow-2xs hover:bg-primary-50 dark:hover:bg-gray-700 transition-all cursor-pointer mr-3"
              title="Return to previous page or Service Analytics"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-primary-700 dark:text-primary-400 mb-1">
                Customer Responses
              </h1>
              <p className="text-primary-600 font-medium">Responses for: {form?.title}</p>
              {form?.description && (
                <p className="text-sm text-primary-500 mt-0.5">
                  {form.description}
                </p>
              )}
            </div>
          </div>

          {id && (
            <button
              onClick={() => navigate(`/forms/${id}/analytics`)}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
              title="Open Service Analytics Dashboard with Chassis & Attempt Matrix"
            >
              <BarChart3 className="w-4 h-4" />
              <span>Service Analytics (Chassis Matrix)</span>
            </button>
          )}
        </div>

        {/* Response Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
          <div className="card p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary-600">
                {responses.length}
              </div>
              <div className="text-sm text-primary-500">Total Responses</div>
            </div>
          </div>
          <div className="card p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary-600">
                {responses.filter((r) => r.score && r.score.total > 0).length}
              </div>
              <div className="text-sm text-primary-500">Scored Responses</div>
            </div>
          </div>
          <div className="card p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {responses.filter((r) => r.status === "verified").length}
              </div>
              <div className="text-sm text-primary-500">Completed</div>
            </div>
          </div>
          <div className="card p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {
                  responses.filter((r) => !r.status || r.status === "pending")
                    .length
                }
              </div>
              <div className="text-sm text-primary-500">Pending</div>
            </div>
          </div>
          <div className="card p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {(() => {
                  const scoredResponses = responses.filter(
                    (r) => r.score && r.score.total > 0
                  );
                  if (scoredResponses.length === 0) return "N/A";
                  const totalScore = scoredResponses.reduce(
                    (sum, r) => sum + r.score.correct / r.score.total,
                    0
                  );
                  const average = Math.round(
                    (totalScore / scoredResponses.length) * 100
                  );
                  return isNaN(average) ? "N/A" : `${average}%`;
                })()}
              </div>
              <div className="text-sm text-primary-500">Average Score</div>
            </div>
          </div>
          <div className="card p-4 sm:col-span-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-primary-600">
                  Export Responses
                </h2>
                <p className="text-sm text-primary-500">
                  Download a full Excel report of all responses for this form.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => form && handleExport(form)}
                  className="btn-secondary flex items-center"
                  disabled={!form || responses.length === 0}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export as Excel
                </button>
                <button
                  onClick={() => form && exportAllResponsesToZip(responses as any, form as any)}
                  className="btn-secondary flex items-center"
                  disabled={!form || responses.length === 0}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Bulk Download (PDF ZIP)
                </button>
                <button
                  onClick={() => setShowTableView(true)}
                  className="btn-tertiary flex items-center"
                  disabled={responses.length === 0}
                >
                  <Table className="w-4 h-4 mr-2" />
                  View as Table
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Response Distribution by Question */}
      {/* {quizQuestions.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-primary-600">
              Response Distribution by Question
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setChartType("bar")}
                className={`btn-secondary flex items-center ${
                  chartType === "bar" ? "bg-primary-600 text-white" : ""
                }`}
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Bar
              </button>
              <button
                onClick={() => setChartType("pie")}
                className={`btn-secondary flex items-center ${
                  chartType === "pie" ? "bg-primary-600 text-white" : ""
                }`}
              >
                <PieChart className="w-4 h-4 mr-2" />
                Pie
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {quizQuestions.map((question) => {
              const distribution = getQuestionDistribution(question.id);
              const labels = Object.keys(distribution);
              const data = Object.values(distribution);
              const correctAnswerStr = Array.isArray(question.correctAnswer)
                ? question.correctAnswer.join(", ")
                : String(question.correctAnswer || "");
              const correctIndex = labels.findIndex(
                (label) =>
                  label.toLowerCase() === correctAnswerStr.toLowerCase()
              );

              const backgroundColors = labels.map((_, index) =>
                index === correctIndex ? "#10B981" : "#6B7280"
              );
              const borderColors = labels.map((_, index) =>
                index === correctIndex ? "#059669" : "#4B5563"
              );

              const chartData = {
                labels,
                datasets: [
                  {
                    label: "Responses",
                    data,
                    backgroundColor: backgroundColors,
                    borderColor: borderColors,
                    borderWidth: 1,
                  },
                ],
              };

              const options = {
                responsive: true,
                plugins: {
                  legend: {
                    position: "top" as const,
                  },
                  title: {
                    display: true,
                    text: question.text,
                  },
                },
              };

              return (
                <div key={question.id} className="card p-6">
                  <h3 className="text-lg font-medium text-primary-600 mb-2">
                    {question.text}
                  </h3>
                  <p className="text-sm text-green-600 font-medium mb-4">
                    Correct Answer: {correctAnswerStr}
                  </p>
                  <p className="text-sm text-primary-500 mb-4">
                    {responses.length} responses
                  </p>
                  <div className="h-64">
                    {chartType === "bar" ? (
                      <Bar data={chartData} options={options} />
                    ) : (
                      <Pie data={chartData} options={options} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )} */}

      {/* Responses by Date */}
      <div className="space-y-6">
        {Object.keys(groupedResponses)
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
          .map((date) => (
            <div key={date} className="card p-6">
              {/* Date Header */}
              <div className="flex items-center mb-4 pb-2 border-b border-primary-100">
                <Calendar className="w-5 h-5 text-primary-600 mr-2" />
                <h3 className="text-lg font-medium text-primary-600">{date}</h3>
                <span className="ml-2 text-sm text-primary-500">
                  ({groupedResponses[date].length} responses)
                </span>
              </div>

              {/* Responses List */}
              <div className="space-y-3">
                {groupedResponses[date].map((response) => {
                  const chassis = getChassisNumber(response.answers);
                  const responseId = response.id || response._id;

                  return (
                    <div
                      key={response._id}
                      className="flex items-center justify-between p-4 bg-primary-50 dark:bg-gray-800/60 rounded-xl hover:bg-primary-100/70 dark:hover:bg-gray-800 transition-colors gap-4"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="p-2.5 bg-white dark:bg-gray-900 rounded-xl shadow-2xs">
                          <FileText className="w-5 h-5 text-primary-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 text-sm text-primary-600 font-medium flex-wrap">
                            <span className="flex items-center">
                              <User className="w-4 h-4 mr-1 text-primary-500" />
                              {response.submittedBy || 'Excel Import'}
                            </span>
                            <span className="text-gray-400">•</span>
                            <span className="text-xs text-primary-500">
                              {formatTimestamp(response.createdAt)}
                            </span>
                          </div>

                          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                            {/* Chassis number badge */}
                            {chassis && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                {chassis}
                              </span>
                            )}

                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                response.status === "verified"
                                  ? "bg-green-500 text-white"
                                  : response.status === "rejected"
                                  ? "bg-red-500 text-white"
                                  : "bg-yellow-500 text-white"
                              }`}
                            >
                              {response.status === "verified"
                                ? "Completed"
                                : response.status === "rejected"
                                ? "Closed"
                                : "Pending"}
                            </span>

                            {response.score && response.score.total > 0 && (
                              <div className="text-xs text-primary-600 font-medium">
                                Score: {response.score.correct}/{response.score.total} (
                                {Math.round(
                                  (response.score.correct / response.score.total) * 100
                                )}%)
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons: Edit, View Details, Delete */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/responses/${responseId}/edit`)}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                          title="Edit response answers"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openResponseDetails(response)}
                          className="btn-secondary flex items-center text-xs py-1.5 px-3 rounded-lg cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1.5" />
                          <span>View Details</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteResponse(responseId)}
                          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                          title="Delete response"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

        {responses.length === 0 && (
          <div className="text-center py-16 card">
            <div className="p-4 bg-primary-50 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <FileText className="w-10 h-10 text-primary-600" />
            </div>
            <h3 className="text-lg font-medium text-primary-600 mb-2">
              No Customer Responses
            </h3>
            <p className="text-primary-500 max-w-md mx-auto">
              There are currently no responses for this form. Responses will
              appear here once customers submit the form.
            </p>
          </div>
        )}
      </div>

      {/* Response Preview Modal */}
      {selectedResponse && (() => {
        const normalizedAnswers: Record<string, any> = (() => {
          const ans = selectedResponse.answers;
          if (!ans) return {};
          if (ans instanceof Map) return Object.fromEntries(ans);
          if (typeof ans === "object") return ans;
          return {};
        })();

        const currentResponseId = selectedResponse.id || selectedResponse._id;
        const quizQuestions = (allQuestions || []).filter(
          (q) => q && q.correctAnswer !== undefined && q.correctAnswer !== null
        );

        let correctCount = 0;
        if (quizQuestions.length > 0) {
          quizQuestions.forEach((q) => {
            const ans = normalizedAnswers[q.id];
            if (ans !== undefined && ans !== null) {
              const ansStr = Array.isArray(ans) ? ans.join(", ") : String(ans);
              const corrStr = Array.isArray(q.correctAnswer)
                ? q.correctAnswer.join(", ")
                : String(q.correctAnswer);
              if (ansStr.toLowerCase() === corrStr.toLowerCase()) {
                correctCount++;
              }
            }
          });
        }

        const score = correctCount * 10;
        const totalPossible = quizQuestions.length * 10;
        const percentage =
          totalPossible > 0 ? Math.round((score / totalPossible) * 100) : 0;

        const capturedLoc = selectedResponse.submissionMetadata?.capturedLocation;
        const lat =
          capturedLoc?.latitude != null ? Number(capturedLoc.latitude) : null;
        const lng =
          capturedLoc?.longitude != null ? Number(capturedLoc.longitude) : null;
        const accuracy =
          capturedLoc?.accuracy != null ? Number(capturedLoc.accuracy) : null;

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-primary-200 dark:border-gray-800">
              <div className="px-6 py-4 border-b border-primary-200 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10 shadow-xs">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-primary-700 dark:text-primary-400">
                      {form?.title || "Form Response"}
                    </h3>
                    <p className="text-xs sm:text-sm text-primary-500 mt-0.5">
                      Submitted on {formatTimestamp(selectedResponse.createdAt)}
                    </p>
                    {quizQuestions.length > 0 && (
                      <p className="text-xs sm:text-sm text-primary-600 font-semibold mt-1">
                        Quiz Score: {score}/{totalPossible} ({percentage}%)
                      </p>
                    )}

                    {/* Status Update Section */}
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Status:
                      </span>
                      <div className="inline-flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1 border border-gray-200 dark:border-gray-700">
                        <button
                          type="button"
                          onClick={() => handleStatusUpdate("pending")}
                          disabled={updating}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            (selectedStatus || selectedResponse.status || "pending") === "pending"
                              ? "bg-amber-500 text-white shadow-xs"
                              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                          }`}
                          title="Mark response as Pending (Inspection submitted, awaiting final sign-off)"
                        >
                          <span className="w-2 h-2 rounded-full bg-amber-200" />
                          <span>Pending</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusUpdate("verified")}
                          disabled={updating}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            (selectedStatus || selectedResponse.status) === "verified"
                              ? "bg-green-600 text-white shadow-xs"
                              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                          }`}
                          title="Mark response as Completed (Verified & approved)"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Completed</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusUpdate("rejected")}
                          disabled={updating}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            (selectedStatus || selectedResponse.status) === "rejected"
                              ? "bg-red-600 text-white shadow-xs"
                              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                          }`}
                          title="Mark response as Closed / Rejected"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Closed</span>
                        </button>
                      </div>
                      {updating && (
                        <span className="text-xs font-semibold text-blue-600 animate-pulse">
                          Saving...
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/responses/${currentResponseId}/edit`)
                      }
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                      title="Edit response answers"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        window.open(`/responses/${currentResponseId}`, "_blank")
                      }
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                      title="Open full page view in new tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Full Page</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteResponse(currentResponseId)}
                      className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                      title="Delete response"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        form &&
                        exportResponseToPDF(
                          selectedResponse as any,
                          form as any
                        )
                      }
                      className="p-1.5 text-primary-600 hover:bg-primary-50 dark:hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
                      title="Download as PDF"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedResponse(null);
                        setSelectedStatus("");
                      }}
                      className="text-primary-500 hover:text-primary-700 p-1.5 rounded-lg cursor-pointer"
                      title="Close"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <h4 className="text-base font-bold text-primary-700 dark:text-primary-300 mb-4">
                  Response Details
                </h4>
                <div className="space-y-4">
                  {Object.keys(normalizedAnswers).length === 0 ? (
                    <p className="text-sm text-gray-500 italic">
                      No answers recorded for this response.
                    </p>
                  ) : (
                    Object.entries(normalizedAnswers).map(([key, value]) => {
                      const question = (allQuestions || []).find(
                        (q) => q && q.id === key
                      );
                      const isQuiz =
                        question && question.correctAnswer !== undefined;
                      const correct = isQuiz
                        ? (() => {
                            const answerStr = Array.isArray(value)
                              ? value.join(", ")
                              : typeof value === "object"
                              ? JSON.stringify(value, null, 2)
                              : String(value);
                            const corrStr = Array.isArray(
                              question.correctAnswer
                            )
                              ? question.correctAnswer.join(", ")
                              : String(question.correctAnswer);
                            return (
                              answerStr.toLowerCase() === corrStr.toLowerCase()
                            );
                          })()
                        : null;

                      return (
                        <div
                          key={key}
                          className="border-b border-primary-100 dark:border-gray-800 pb-4"
                        >
                          <div className="font-semibold text-sm text-primary-800 dark:text-primary-200 mb-1.5">
                            {getQuestionText(key)}
                          </div>
                          <div
                            className={`p-3 rounded-xl flex flex-col gap-1 text-xs sm:text-sm ${
                              isQuiz
                                ? correct
                                  ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300 border border-green-200 dark:border-green-800"
                                  : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800"
                                : "bg-primary-50/80 text-primary-700 dark:bg-gray-800/80 dark:text-gray-200 border border-primary-100 dark:border-gray-700"
                            }`}
                          >
                            <div>{renderValue(value)}</div>
                            {selectedResponse.responseRanks?.[key] && (
                              <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400 mt-1">
                                #{selectedResponse.responseRanks[key]}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* Location Information */}
                  {capturedLoc && (
                    <div className="border-t border-primary-200 dark:border-gray-800 pt-4 mt-4">
                      <h5 className="text-sm font-bold text-primary-700 dark:text-primary-300 mb-2">
                        Location Information
                      </h5>
                      <div className="text-primary-600 dark:text-gray-300 bg-primary-50 dark:bg-gray-800/60 p-3 rounded-xl space-y-1 text-xs">
                        {lat != null && lng != null && !isNaN(lat) && !isNaN(lng) && (
                          <p>
                            <strong>Coordinates:</strong> {lat.toFixed(5)},{" "}
                            {lng.toFixed(5)}
                          </p>
                        )}
                        {accuracy != null && !isNaN(accuracy) && (
                          <p>
                            <strong>Accuracy:</strong> ±{accuracy.toFixed(1)}{" "}
                            meters
                          </p>
                        )}
                        {capturedLoc.source && (
                          <p>
                            <strong>Source:</strong> {capturedLoc.source}
                          </p>
                        )}
                        {capturedLoc.capturedAt && (
                          <p>
                            <strong>Captured At:</strong>{" "}
                            {formatTimestamp(capturedLoc.capturedAt)}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedResponse.childResponses &&
                    selectedResponse.childResponses.length > 0 && (
                      <div className="mt-8 pt-6 border-t-2 border-primary-200 dark:border-gray-800">
                        <h4 className="text-base font-bold text-primary-700 dark:text-primary-300 mb-4 flex items-center">
                          <span className="text-purple-600 mr-2">📄</span>
                          Follow-up Form Responses (
                          {selectedResponse.childResponses.length})
                        </h4>
                        <div className="space-y-4">
                          {selectedResponse.childResponses.map(
                            (childResponse, idx) => (
                              <div
                                key={childResponse.id || idx}
                                className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl p-4"
                              >
                                <div className="mb-3 pb-2 border-b border-purple-200 dark:border-purple-800">
                                  <h5 className="font-bold text-purple-900 dark:text-purple-200 text-sm">
                                    Follow-up Form Response {idx + 1}
                                  </h5>
                                  <div className="text-xs text-purple-700 dark:text-purple-400 mt-0.5">
                                    {formatTimestamp(childResponse.createdAt)}
                                  </div>
                                </div>
                                <div className="space-y-2.5">
                                  {Object.entries(
                                    childResponse.answers || {}
                                  ).map(([key, value]) => (
                                    <div key={key}>
                                      <div className="font-semibold text-xs text-purple-900 dark:text-purple-200 mb-1">
                                        {getQuestionText(key)}
                                      </div>
                                      <div className="text-xs text-purple-700 dark:text-purple-300 bg-white dark:bg-gray-900 p-2 rounded-lg border border-purple-100 dark:border-purple-900 flex flex-col gap-1">
                                        <div>{renderValue(value)}</div>
                                        {childResponse.responseRanks?.[key] && (
                                          <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                            #{childResponse.responseRanks[key]}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Table View Modal */}
      {showTableView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-primary-200 flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold text-primary-700">
                  {form?.title} Responses
                </h3>
                <p className="text-sm text-primary-500">
                  Viewing {responses.length} replies in table view
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTableView(false)}
                className="text-primary-500 hover:text-primary-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="overflow-auto">
              <table className="min-w-full divide-y divide-primary-100">
                <thead className="bg-primary-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-primary-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-primary-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-primary-500 uppercase tracking-wider">
                      Submitted By
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-primary-500 uppercase tracking-wider">
                      Location
                    </th>
                    {questionColumns.map((column) => (
                      <th
                        key={column.id}
                        className="px-4 py-3 text-left text-xs font-medium text-primary-500 uppercase tracking-wider whitespace-nowrap"
                      >
                        {column.text}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-primary-100">
                  {responses.map((responseItem) => {
                    const location =
                      responseItem.submissionMetadata?.location ?? undefined;
                    const locationText = location
                      ? [location.city, location.region, location.country]
                          .filter(Boolean)
                          .join(", ")
                      : "--";

                    return (
                      <React.Fragment key={responseItem._id}>
                        <tr className="bg-primary-25">
                          <td className="px-4 py-3 text-sm text-primary-600 align-top">
                            {formatTimestamp(responseItem.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-sm text-primary-600 align-top">
                            {responseItem.status ?? "Pending"}
                          </td>
                          <td className="px-4 py-3 text-sm text-primary-600 align-top">
                            {responseItem.submissionMetadata?.ipAddress ?? "--"}
                          </td>
                          <td className="px-4 py-3 text-sm text-primary-600 align-top">
                            {locationText}
                          </td>
                          {questionColumns.map((column) => (
                            <td
                              key={`${responseItem._id}-${column.id}-value`}
                              className="px-4 py-3 text-sm text-primary-600 align-top whitespace-pre-wrap"
                            >
                              <div className="flex flex-col">
                                <span>{getAnswerDisplay(responseItem, column.id)}</span>
                                {responseItem.responseRanks && responseItem.responseRanks[column.id] !== undefined && (
                                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 dark:bg-blue-900/40 dark:text-blue-200 px-2 py-0.5 rounded-full w-fit mt-1.5 border border-blue-200 dark:border-blue-700 flex items-center shadow-sm">
                                    <span className="mr-1">Rank:</span>
                                    <span>{responseItem.responseRanks[column.id]}</span>
                                  </span>
                                )}
                              </div>
                            </td>
                          ))}
                        </tr>
                      </React.Fragment>
                    );
                  })}
                  {responses.length === 0 && (
                    <tr>
                      <td
                        colSpan={4 + questionColumns.length}
                        className="px-4 py-6 text-center text-sm text-primary-500"
                      >
                        No responses to display yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
