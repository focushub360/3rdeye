import type {
  Response,
  Section,
  Form,
  SectionPerformanceStat,
  QuestionPerformanceStat,
  ZoneAnalyticsData,
  DailyPerformanceStat,
  SectionStat,
} from "../types";

// Helper function to extract a valid, verified timestamp from response with year-format check
export const getResponseTimestamp = (response: Response): string | undefined => {
  if (!response) return undefined;

  const currentYear = new Date().getFullYear();
  const isValidYear = (d: Date | null): boolean => {
    if (!d || isNaN(d.getTime())) return false;
    const y = d.getFullYear();
    // Valid manufacturing inspection year: 2020 through next year (currentYear + 1)
    return y >= 2020 && y <= currentYear + 1;
  };

  const toDate = (val: any): Date | null => {
    if (!val) return null;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  };

  const rawCandidates = [
    response.submittedAt,
    response.createdAt,
    response.timestamp,
    (response as any).submissionMetadata?.submittedAt,
    (response as any).submissionMetadata?.capturedLocation?.capturedAt,
    (response as any).updatedAt,
    (response as any).dispatchedAt,
  ];

  // 1. Return first candidate that parses with a valid realistic year
  for (const c of rawCandidates) {
    if (!c) continue;
    const d = toDate(c);
    if (d && isValidYear(d)) {
      return d.toISOString();
    }
  }

  // 2. If all candidates have an unrealistic year (e.g. > currentYear + 1), check metadata or clamp
  const fallback =
    response.submittedAt ||
    response.createdAt ||
    response.timestamp ||
    (response as any).submissionMetadata?.submittedAt ||
    (response as any).submissionMetadata?.capturedLocation?.capturedAt;
  if (fallback) {
    const d = toDate(fallback);
    if (d) {
      if (d.getFullYear() > currentYear + 1) {
        d.setFullYear(currentYear);
      }
      return d.toISOString();
    }
  }

  return undefined;
};

// Formats timestamp into YYYY-MM-DD in the local timezone (preventing UTC shifts for shift/morning inspections)
export const toLocalDateString = (timestamp: any): string => {
  if (!timestamp) return "";
  if (typeof timestamp === "string" && /^\d{4}-\d{2}-\d{2}$/.test(timestamp)) {
    return timestamp;
  }
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getSectionQualityBreakdown = (
  section: Section,
  responses: Response[],
): Array<{
  parameterName: string;
  yes: number;
  no: number;
  na: number;
  total: number;
}> => {
  const qualityData: Array<{
    parameterName: string;
    yes: number;
    no: number;
    na: number;
    total: number;
  }> = [];

  const parameterGroups = new Map<
    string,
    {
      parameterName: string;
      yes: number;
      no: number;
      na: number;
      total: number;
      isRealParameter: boolean;
    }
  >();

  const questionIdToGroup = new Map<string, any>();

  // Process all main questions in the section
  section.questions.forEach((q: any) => {
    // Only process main questions (not follow-ups)
    if (!q.parentId && !q.showWhen?.questionId) {
      // Check if this has a real parameter name
      const hasRealParameter = !!q.subParam1 || !!q.parameter;

      // Get parameter name (prefer subParam1 or parameter over question text)
      const paramName =
        q.subParam1 ||
        q.parameter ||
        (hasRealParameter
          ? null
          : q.text?.substring(0, 30) + (q.text?.length > 30 ? "..." : "")) ||
        null;

      // Skip if no parameter name can be extracted
      if (!paramName) return;

      if (!parameterGroups.has(paramName)) {
        parameterGroups.set(paramName, {
          parameterName: paramName,
          yes: 0,
          no: 0,
          na: 0,
          total: 0,
          isRealParameter: hasRealParameter,
        });
      }

      const group = parameterGroups.get(paramName)!;
      questionIdToGroup.set(q.id, group);
    }
  });

  // Count responses for these questions in one single pass over responses
  responses.forEach((response) => {
    if (!response.answers) return;
    for (const [qId, answer] of Object.entries(response.answers)) {
      if (answer === null || answer === undefined || answer === "") {
        continue;
      }
      const group = questionIdToGroup.get(qId);
      if (!group) continue;

      group.total++;

      // Check if it's an inspection status object (like from ChassisWithZone)
      if (typeof answer === "object" && answer.status) {
        const status = String(answer.status).toLowerCase().trim();
        if (
          status === "accepted" ||
          status === "rework completed" ||
          status === "verified"
        ) {
          group.yes++;
        } else if (status === "rejected") {
          group.no++;
        } else if (
          status === "rework" ||
          status === "reworked" ||
          status.includes("re-rework")
        ) {
          group.na++;
        }
      } else {
        const answerStr = String(answer).toLowerCase().trim();
        if (
          answerStr === "accepted" ||
          answerStr === "rework completed" ||
          answerStr === "verified"
        ) {
          group.yes++;
        } else if (answerStr === "rejected") {
          group.no++;
        } else if (
          answerStr === "rework" ||
          answerStr === "reworked" ||
          answerStr.includes("re-rework")
        ) {
          group.na++;
        } else if (answerStr.includes("yes") || answerStr === "y") {
          group.yes++;
        } else if (answerStr.includes("no") || answerStr === "n") {
          group.no++;
        } else if (
          answerStr.includes("na") ||
          answerStr.includes("n/a") ||
          answerStr.includes("not applicable")
        ) {
          group.na++;
        }
      }
    }
  });

  // Convert map to array and filter out groups that don't have real parameters
  parameterGroups.forEach((group) => {
    if (group.total > 0 && group.isRealParameter) {
      qualityData.push({
        parameterName: group.parameterName,
        yes: group.yes,
        no: group.no,
        na: group.na,
        total: group.total,
      });
    }
  });

  return qualityData;
};

export const calculateOverallQuality = (qualityBreakdown: any[]) => {
  let totalYes = 0;
  let totalNo = 0;
  let totalNA = 0;
  let totalResponses = 0;

  qualityBreakdown.forEach((item) => {
    totalYes += item.yes;
    totalNo += item.no;
    totalNA += item.na;
    totalResponses += item.total;
  });

  const total = totalYes + totalNo + totalNA;

  return {
    totalYes,
    totalNo,
    totalNA,
    totalResponses,
    percentages: {
      yes: total > 0 ? ((totalYes / total) * 100).toFixed(1) : "0.0",
      no: total > 0 ? ((totalNo / total) * 100).toFixed(1) : "0.0",
      na: total > 0 ? ((totalNA / total) * 100).toFixed(1) : "0.0",
    },
  };
};

export const getZoneAnalytics = (responses: Response[]): ZoneAnalyticsData => {
  const stats: ZoneAnalyticsData = {
    inspectionStatus: { accepted: 0, rework: 0, rejected: 0, total: 0 },
    zoneBreakdown: [],
  };

  const zoneMap = new Map<
    string,
    Map<
      string,
      {
        count: number;
        defects: Map<
          string,
          { total: number; rework: number; rejected: number }
        >;
      }
    >
  >();

  responses.forEach((response) => {
    if (!response.answers) return;

    Object.values(response.answers).forEach((answer) => {
      if (
        typeof answer === "object" &&
        answer !== null &&
        (answer.chassisNumber ||
          answer.status ||
          answer.zonesData ||
          answer.zones)
      ) {
        // This looks like a ChassisWithZone or ZoneIn/Out answer
        const statusVal = (answer.status || "").toLowerCase().trim();
        const isAccepted =
          statusVal === "accepted" ||
          statusVal === "rework completed" ||
          statusVal === "verified";
        const isRework =
          statusVal === "rework" ||
          statusVal === "reworked" ||
          statusVal.includes("re-rework");
        const isRejected = statusVal === "rejected";

        if (isAccepted) stats.inspectionStatus.accepted++;
        else if (isRework) stats.inspectionStatus.rework++;
        else if (isRejected) stats.inspectionStatus.rejected++;

        if (statusVal) stats.inspectionStatus.total++;

        // Handle hierarchical zonesData (ChassisWithZone)
        if (answer.zonesData) {
          Object.entries(answer.zonesData).forEach(
            ([zoneName, zoneContent]: [string, any]) => {
              if (!zoneMap.has(zoneName)) {
                zoneMap.set(zoneName, new Map());
              }
              const catMap = zoneMap.get(zoneName)!;

              if (
                zoneContent.categories &&
                Array.isArray(zoneContent.categories)
              ) {
                zoneContent.categories.forEach((cat: any) => {
                  if (!catMap.has(cat.name)) {
                    catMap.set(cat.name, { count: 0, defects: new Map() });
                  }
                  const catData = catMap.get(cat.name)!;
                  catData.count++;

                  if (cat.defects && Array.isArray(cat.defects)) {
                    cat.defects.forEach((defect: any) => {
                      const defectStats = catData.defects.get(defect.name) || {
                        total: 0,
                        rework: 0,
                        rejected: 0,
                      };
                      defectStats.total++;
                      if (isRework) defectStats.rework++;
                      else if (isRejected) defectStats.rejected++;
                      catData.defects.set(defect.name, defectStats);
                    });
                  }
                });
              }
            },
          );
        }

        // Handle simple zones array (ZoneIn/ZoneOut)
        if (answer.zones && Array.isArray(answer.zones)) {
          answer.zones.forEach((zoneName: string) => {
            if (!zoneMap.has(zoneName)) {
              zoneMap.set(zoneName, new Map());
            }
            const catMap = zoneMap.get(zoneName)!;

            // For simple zones, we might use a generic "Defect" category if it's a rework/rejected
            if (isRework || isRejected) {
              const catName = "Unspecified Defects";
              if (!catMap.has(catName)) {
                catMap.set(catName, { count: 0, defects: new Map() });
              }
              const catData = catMap.get(catName)!;
              catData.count++;

              const defectName = answer.remark || "Generic Defect";
              const defectStats = catData.defects.get(defectName) || {
                total: 0,
                rework: 0,
                rejected: 0,
              };
              defectStats.total++;
              if (isRework) defectStats.rework++;
              else if (isRejected) defectStats.rejected++;
              catData.defects.set(defectName, defectStats);
            }
          });
        }
      }
    });
  });

  // Convert map to array structure
  zoneMap.forEach((catMap, zoneName) => {
    const categories: any[] = [];
    catMap.forEach((catData, catName) => {
      const defects: any[] = [];
      catData.defects.forEach((dStats, defectName) => {
        defects.push({
          name: defectName,
          count: dStats.total,
          reworkCount: dStats.rework,
          rejectedCount: dStats.rejected,
        });
      });
      categories.push({ category: catName, count: catData.count, defects });
    });
    stats.zoneBreakdown.push({ zone: zoneName, categories });
  });

  return stats;
};

export const getSectionStats = (
  section: Section,
  responses: Response[],
  questionResponseCounts?: Map<string, number>,
) => {
  // Filter for main questions only (not follow-ups)
  const mainQuestionsOnly = section.questions.filter(
    (q: any) => !q.parentId && !q.showWhen?.questionId,
  );

  const mainQuestionCount = mainQuestionsOnly.length;
  let totalFollowUpCount = 0;
  let answeredMainQuestions = 0;
  let answeredFollowUpQuestions = 0;
  let mainQuestionResponses = 0;
  let followUpResponses = 0;

  // Count follow-up questions
  const followUpQuestionsInSection = section.questions.filter(
    (q: any) => q.parentId || q.showWhen?.questionId,
  );
  totalFollowUpCount = followUpQuestionsInSection.length;

  const countsMap = questionResponseCounts || (() => {
    const map = new Map<string, number>();
    responses.forEach((response) => {
      if (response.answers) {
        Object.keys(response.answers).forEach((qId) => {
          const answer = response.answers[qId];
          if (answer !== null && answer !== undefined && answer !== "") {
            map.set(qId, (map.get(qId) || 0) + 1);
          }
        });
      }
    });
    return map;
  })();

  // Process follow-up questions
  followUpQuestionsInSection.forEach((followUp: any) => {
    const followUpResponders = countsMap.get(followUp.id) || 0;
    if (followUpResponders > 0) {
      answeredFollowUpQuestions++;
      followUpResponses += followUpResponders;
    }
  });

  // Process main questions
  const questionsDetail = mainQuestionsOnly.map((q: any) => {
    const mainQuestionResponders = countsMap.get(q.id) || 0;

    if (mainQuestionResponders > 0) {
      answeredMainQuestions++;
      mainQuestionResponses += mainQuestionResponders;
    }

    const relatedFollowUps = section.questions.filter(
      (fq: any) => fq.parentId === q.id || fq.showWhen?.questionId === q.id,
    );

    return {
      id: q.id,
      text: q.text || "Unnamed Question",
      followUpCount: relatedFollowUps.length,
      responses: mainQuestionResponders,
      followUpDetails: relatedFollowUps.map((fq: any) => ({
        id: fq.id,
        text: fq.text || "Unnamed Follow-up",
        responses: countsMap.get(fq.id) || 0,
      })),
    };
  });

  const totalAnswered = answeredMainQuestions + answeredFollowUpQuestions;
  const totalQuestions = mainQuestionCount + totalFollowUpCount;
  const totalResponses = mainQuestionResponses + followUpResponses;

  const completionRate =
    totalQuestions > 0
      ? ((totalAnswered / totalQuestions) * 100).toFixed(1)
      : "0.0";

  const avgResponsesPerQuestion =
    totalQuestions > 0 ? (totalResponses / totalQuestions).toFixed(1) : "0.0";

  return {
    mainQuestionCount,
    totalFollowUpCount,
    answeredMainQuestions,
    answeredFollowUpQuestions,
    totalAnswered,
    totalResponses,
    completionRate,
    avgResponsesPerQuestion,
    questionsDetail,
  };
};

export const formatSectionLabel = (label: string, maxLength = 20): string => {
  if (!label) {
    return "";
  }
  const parts = label.match(/[A-Za-z0-9]+/g) || [];
  if (!parts.length) {
    return "";
  }
  const camel = parts
    .map((part, index) => {
      const lower = part.toLowerCase();
      if (index === 0) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
  if (!camel) {
    return "";
  }
  const formatted = camel.charAt(0).toUpperCase() + camel.slice(1);
  return formatted.length > maxLength
    ? `${formatted.slice(0, maxLength - 3)}...`
    : formatted;
};

export const extractYesNoValues = (value: any): string[] => {
  if (value === null || value === undefined) {
    return [];
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized ? [normalized] : [];
  }
  if (typeof value === "boolean") {
    return [value ? "yes" : "no"];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => extractYesNoValues(item));
  }
  if (typeof value === "object") {
    return Object.values(value).flatMap((item) => extractYesNoValues(item));
  }
  return [];
};

export const recognizedYesNoValues = [
  "yes",
  "no",
  "n/a",
  "na",
  "not applicable",
  "accepted",
  "rejected",
  "rework",
  "reworked",
  "verified",
  "rework completed",
];

export const getRankStyle = (answer: any, darkMode: boolean = false) => {
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

export const getBiwPerformanceLabel = (score: number) => {
  if (score < 60) {
    return {
      label: "Not Met Performer",
      className:
        "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
    };
  } else if (score < 70) {
    return {
      label: "Partially Met Performer",
      className:
        "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
    };
  } else if (score < 80) {
    return {
      label: "Met Expectation",
      className:
        "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
    };
  } else if (score < 90) {
    return {
      label: "Exceeded Performance",
      className:
        "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
    };
  } else {
    return {
      label: "Exemplary Performer",
      className:
        "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
    };
  }
};

export const computeSectionPerformanceStats = (
  form: Form | null,
  responses: Response[],
): SectionPerformanceStat[] => {
  if (!form?.sections || !responses.length) {
    return [];
  }

  // Pre-build section list and a mapping of questionId -> section's counts and question configuration
  const sectionList: Array<{
    section: Section;
    counts: {
      yes: number;
      no: number;
      na: number;
      accepted: number;
      rejected: number;
      rework: number;
      total: number;
    };
  }> = [];

  const questionMap = new Map<string, {
    question: any;
    counts: typeof sectionList[0]["counts"];
  }>();

  form.sections.forEach((section) => {
    const counts = {
      yes: 0,
      no: 0,
      na: 0,
      accepted: 0,
      rejected: 0,
      rework: 0,
      total: 0,
    };
    sectionList.push({ section, counts });

    const registerQuestions = (q: any) => {
      if (!q) return;
      questionMap.set(q.id, { question: q, counts });
      q.followUpQuestions?.forEach(registerQuestions);
    };

    section.questions?.forEach(registerQuestions);
  });

  // Now process responses in a single loop
  responses.forEach((response) => {
    if (!response.answers) return;
    for (const [qId, answer] of Object.entries(response.answers)) {
      if (answer === null || answer === undefined || answer === "") {
        continue;
      }
      const match = questionMap.get(qId);
      if (!match) continue;

      const { question, counts } = match;

      // Check if it's an inspection status object (like from ChassisWithZone)
      if (typeof answer === "object" && answer.status) {
        const status = String(answer.status).toLowerCase().trim();
        if (
          status === "accepted" ||
          status === "rework completed" ||
          status === "verified"
        ) {
          counts.accepted += 1;
          counts.total += 1;
        } else if (status === "rejected") {
          counts.rejected += 1;
          counts.total += 1;
        } else if (
          status === "rework" ||
          status === "reworked" ||
          status.includes("re-rework")
        ) {
          counts.rework += 1;
          counts.total += 1;
        }
      } else {
        const answerStr = String(answer).toLowerCase().trim();
        const normalizedValues = extractYesNoValues(answer);

        if (
          answerStr === "accepted" ||
          answerStr === "rework completed" ||
          answerStr === "verified"
        ) {
          counts.accepted += 1;
          counts.total += 1;
        } else if (answerStr === "rejected") {
          counts.rejected += 1;
          counts.total += 1;
        } else if (
          answerStr === "rework" ||
          answerStr === "reworked" ||
          answerStr.includes("re-rework")
        ) {
          counts.rework += 1;
          counts.total += 1;
        } else if (
          question.type === "yesNoNA" ||
          question.type === "chassisWithZone" ||
          question.type === "chassisWithoutZone" ||
          question.type === "chassis" ||
          question.type === "zone-in" ||
          question.type === "zone-out" ||
          question.text?.toLowerCase().includes("chassis")
        ) {
          const options = question.options || [];

          if (options.length >= 3) {
            const yesOption = String(options[0]).toLowerCase().trim();
            const noOption = String(options[1]).toLowerCase().trim();
            const naOption = String(options[2]).toLowerCase().trim();

            normalizedValues.forEach((val) => {
              if (val === yesOption) {
                counts.yes += 1;
                counts.total += 1;
              } else if (val === noOption) {
                counts.no += 1;
                counts.total += 1;
              } else if (val === naOption) {
                counts.na += 1;
                counts.total += 1;
              }
            });
          } else {
            // Fallback to recognized values
            const hasRecognizedValue = normalizedValues.some((value) =>
              recognizedYesNoValues.includes(value),
            );
            if (hasRecognizedValue) {
              counts.total += 1;
              if (
                normalizedValues.includes("yes") ||
                normalizedValues.includes("accepted") ||
                normalizedValues.includes("verified")
              ) {
                counts.yes += 1;
              }
              if (
                normalizedValues.includes("no") ||
                normalizedValues.includes("rejected")
              ) {
                counts.no += 1;
              }
              if (
                normalizedValues.includes("n/a") ||
                normalizedValues.includes("na") ||
                normalizedValues.includes("not applicable") ||
                normalizedValues.includes("rework") ||
                normalizedValues.includes("reworked") ||
                normalizedValues.some((v) => v.includes("re-rework"))
              ) {
                counts.na += 1;
              }
            }
          }
        }
      }
    }
  });

  // Map result back to SectionPerformanceStat format
  return sectionList
    .map(({ section, counts }) => {
      if (!counts.total) {
        return null;
      }
      return {
        id: section.id,
        title: section.title || "Untitled Section",
        yes: counts.yes,
        no: counts.no,
        na: counts.na,
        accepted: counts.accepted,
        rejected: counts.rejected,
        rework: counts.rework,
        total: counts.total,
        weightage: typeof section.weightage === "number" ? section.weightage : 0,
      } as SectionPerformanceStat;
    })
    .filter((s): s is SectionPerformanceStat => s !== null);
};

export const computeQuestionPerformanceStats = (
  form: Form | null,
  responses: Response[],
): QuestionPerformanceStat[] => {
  if (!form?.sections || !responses.length) {
    return [];
  }

  // Pre-build list of question info and mapping from questionId -> question info
  const questionList: Array<{
    id: string;
    text: string;
    sectionTitle: string;
    counts: {
      accepted: number;
      rejected: number;
      rework: number;
      total: number;
    };
    question: any;
  }> = [];

  const questionMap = new Map<string, typeof questionList[0]>();

  form.sections.forEach((section) => {
    section.questions.forEach((question: any) => {
      const qText = String(question.text || question.title || "").trim();
      const isTracking = question.isTrackingNumber || question.isChassisQuestion || question.type === "chassisNumber" ||
        /^(chassis(\s*number)?|vin|frame(\s*number)?|identification(\s*number)?)$/i.test(qText);
      if (isTracking) return;

      const entry = {
        id: question.id,
        text: question.text,
        sectionTitle: section.title,
        counts: {
          accepted: 0,
          rejected: 0,
          rework: 0,
          total: 0,
        },
        question,
      };
      questionList.push(entry);
      questionMap.set(question.id, entry);
    });
  });

  // Now process responses in a single loop
  responses.forEach((response) => {
    if (!response.answers) return;
    for (const [qId, answer] of Object.entries(response.answers)) {
      if (answer === null || answer === undefined || answer === "") {
        continue;
      }
      const match = questionMap.get(qId);
      if (!match) continue;

      const { question, counts } = match;

      if (typeof answer === "object" && answer.status) {
        const status = String(answer.status).toLowerCase().trim();
        if (
          status === "accepted" ||
          status === "rework completed" ||
          status === "verified"
        ) {
          counts.accepted += 1;
          counts.total += 1;
        } else if (status === "rejected") {
          counts.rejected += 1;
          counts.total += 1;
        } else if (
          status === "rework" ||
          status === "reworked" ||
          status.includes("re-rework")
        ) {
          counts.rework += 1;
          counts.total += 1;
        }
      } else {
        const answerStr = String(answer).toLowerCase().trim();
        const normalizedValues = extractYesNoValues(answer);

        if (
          answerStr === "accepted" ||
          answerStr === "rework completed" ||
          answerStr === "verified"
        ) {
          counts.accepted += 1;
          counts.total += 1;
        } else if (answerStr === "rejected") {
          counts.rejected += 1;
          counts.total += 1;
        } else if (
          answerStr === "rework" ||
          answerStr === "reworked" ||
          answerStr.includes("re-rework")
        ) {
          counts.rework += 1;
          counts.total += 1;
        } else if (
          question.type === "yesNoNA" ||
          question.type === "chassisWithZone" ||
          question.type === "chassisWithoutZone" ||
          question.type === "chassis" ||
          question.type === "zone-in" ||
          question.type === "zone-out" ||
          question.text?.toLowerCase().includes("chassis")
        ) {
          const options = question.options || [];
          if (options.length >= 3) {
            const yesOption = String(options[0]).toLowerCase().trim();
            const noOption = String(options[1]).toLowerCase().trim();
            const naOption = String(options[2]).toLowerCase().trim();

            normalizedValues.forEach((val) => {
              if (val === yesOption) {
                counts.accepted += 1;
                counts.total += 1;
              } else if (val === noOption) {
                counts.rejected += 1;
                counts.total += 1;
              } else if (val === naOption) {
                counts.rework += 1;
                counts.total += 1;
              }
            });
          } else {
            const hasRecognizedValue = normalizedValues.some((value) =>
              recognizedYesNoValues.includes(value),
            );
            if (hasRecognizedValue) {
              counts.total += 1;
              if (
                normalizedValues.includes("yes") ||
                normalizedValues.includes("accepted") ||
                normalizedValues.includes("verified")
              ) {
                counts.accepted += 1;
              }
              if (
                normalizedValues.includes("no") ||
                normalizedValues.includes("rejected")
              ) {
                counts.rejected += 1;
              }
              if (
                normalizedValues.includes("n/a") ||
                normalizedValues.includes("na") ||
                normalizedValues.includes("not applicable") ||
                normalizedValues.includes("rework") ||
                normalizedValues.includes("reworked") ||
                normalizedValues.some((v) => v.includes("re-rework"))
              ) {
                counts.rework += 1;
              }
            }
          }
        }
      }
    }

    // Process defects flagged during BIW / Quality reviews
    const allReviewFlagged = [
      ...(Array.isArray((response.biwReview as any)?.flaggedQuestions) ? (response.biwReview as any).flaggedQuestions : []),
      ...(Array.isArray((response as any)?.review?.flaggedQuestions) ? (response as any).review.flaggedQuestions : []),
      ...(Array.isArray((response as any)?.review?.questionContexts) ? (response as any).review.questionContexts : []),
      ...(Array.isArray((response as any)?.tvsReview?.flaggedQuestions) ? (response as any).tvsReview.flaggedQuestions : []),
      ...(Array.isArray((response as any)?.biwReview?.questionContexts) ? (response as any).biwReview.questionContexts : []),
    ];

    if (allReviewFlagged.length > 0) {
      const revStatus = String(response.biwReview?.status || (response as any)?.review?.status || (response as any)?.tvsReview?.status || "").toLowerCase();
      const isRej = revStatus === "rejected";
      const isRew = revStatus.includes("rework");

      if (isRej || isRew) {
        const seenQKeys = new Set<string>();
        allReviewFlagged.forEach((fq: any) => {
          if (!fq) return;
          const qId = typeof fq === "object" ? (fq.questionId || fq.id) : String(fq);
          const qText = (typeof fq === "object" ? (fq.questionText || fq.text || fq.title || "") : "").trim();
          if (/^(chassis(\s*number)?|vin|frame(\s*number)?|identification(\s*number)?)$/i.test(qText)) return;
          const dedupKey = (qId ? String(qId).trim() : "") || qText.toLowerCase();
          if (!dedupKey || seenQKeys.has(dedupKey)) return;
          seenQKeys.add(dedupKey);

          let match = qId ? questionMap.get(qId) : null;
          if (!match && qText) {
            match = questionList.find(q => q.text.toLowerCase().trim() === qText.toLowerCase());
            if (!match) {
              const entry = {
                id: qId || `biw-flagged-${qText}`,
                text: qText,
                sectionTitle: "BIW Review Flagged",
                counts: { accepted: 0, rejected: isRej ? 1 : 0, rework: isRew ? 1 : 0, total: 1 },
                question: { id: qId, text: qText }
              };
              questionList.push(entry);
              if (qId) questionMap.set(qId, entry);
              return;
            }
          }
          if (match) {
            if (isRej) {
              match.counts.rejected += 1;
            } else {
              match.counts.rework += 1;
            }
            match.counts.total += 1;
          }
        });
      }
    }
  });

  // Map result back to QuestionPerformanceStat format
  return questionList
    .filter((q) => q.counts.total > 0)
    .map((q) => ({
      id: q.id,
      text: q.text,
      sectionTitle: q.sectionTitle,
      accepted: q.counts.accepted,
      rejected: q.counts.rejected,
      rework: q.counts.rework,
      total: q.counts.total,
    }));
};

export const computeDailyPerformanceStats = (
  responses: Response[],
  statuses: Record<string, string>,
  startDate?: string,
  endDate?: string,
): DailyPerformanceStat[] => {
  const dailyMap = new Map<
    string,
    { total: number; rework: number; accepted: number }
  >();

  let start: Date | null = null;
  let end: Date | null = null;

  if (startDate) {
    start = new Date(startDate);
  }

  if (endDate) {
    end = new Date(endDate);
  }

  if (responses.length > 0 && !startDate && !endDate) {
    const timestamps = responses
      .map((r) => new Date(getResponseTimestamp(r) || 0).getTime())
      .filter((ts) => !isNaN(ts) && ts > 0);
    if (timestamps.length > 0) {
      start = new Date(Math.min(...timestamps));
      end = new Date(Math.max(...timestamps));
    }
  }

  if (!start) {
    start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }

  if (!end) {
    end = new Date();
    end.setHours(23, 59, 59, 999);
  }

  if (start && end) {
    const curr = new Date(start);
    curr.setHours(0, 0, 0, 0);
    const last = new Date(end);
    last.setHours(0, 0, 0, 0);

    while (curr <= last) {
      const dKey = toLocalDateString(curr);
      dailyMap.set(dKey, { total: 0, rework: 0, accepted: 0 });
      curr.setDate(curr.getDate() + 1);
    }
  }

  responses.forEach((response) => {
    const timestamp = getResponseTimestamp(response);
    if (!timestamp) return;

    const dateKey = toLocalDateString(timestamp);
    if (!dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, { total: 0, rework: 0, accepted: 0 });
    }

    const dayStats = dailyMap.get(dateKey)!;
    dayStats.total += 1;

    const status = statuses[response.id];
    if (status && typeof status === "string") {
      if (status.startsWith("Rework") || status === "Rework Accepted") {
        dayStats.rework += 1;
      } else if (status === "Direct Ok" || status === "Accepted") {
        dayStats.accepted += 1;
      }
    }
  });

  return Array.from(dailyMap.entries())
    .map(([dateKey, stats]) => {
      const dateObj = new Date(dateKey);
      const formattedDate = dateObj.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      return {
        date: formattedDate,
        dateKey,
        totalResponses: stats.total,
        reworkCount: stats.rework,
        acceptedCount: stats.accepted,
      };
    })
    .sort((a, b) => (a.dateKey > b.dateKey ? 1 : -1));
};

export const computeMonthlyPerformanceStats = (
  responses: Response[],
  statuses: Record<string, string>,
  startDate?: string,
  endDate?: string,
): DailyPerformanceStat[] => {
  const monthMap = new Map<
    string,
    { total: number; rework: number; accepted: number }
  >();

  let start: Date | null = null;
  let end: Date | null = null;

  if (startDate) {
    start = new Date(startDate);
  }

  if (endDate) {
    end = new Date(endDate);
  }

  if (responses.length > 0 && !startDate && !endDate) {
    const timestamps = responses
      .map((r) => new Date(getResponseTimestamp(r) || 0).getTime())
      .filter((ts) => !isNaN(ts) && ts > 0);
    if (timestamps.length > 0) {
      start = new Date(Math.min(...timestamps));
      end = new Date(Math.max(...timestamps));
    }
  }

  if (!start) {
    start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }

  if (!end) {
    end = new Date();
    end.setHours(23, 59, 59, 999);
  }

  if (start && end) {
    const curr = new Date(start);
    curr.setDate(1);
    const last = new Date(end);
    last.setDate(1);

    while (curr <= last) {
      const monthKey = `${curr.getFullYear()}-${String(
        curr.getMonth() + 1,
      ).padStart(2, "0")}`;
      monthMap.set(monthKey, { total: 0, rework: 0, accepted: 0 });
      curr.setMonth(curr.getMonth() + 1);
    }
  }

  responses.forEach((response) => {
    const timestamp = getResponseTimestamp(response);
    if (!timestamp) return;

    const dateObj = new Date(timestamp);
    const monthKey = `${dateObj.getFullYear()}-${String(
      dateObj.getMonth() + 1,
    ).padStart(2, "0")}`;

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, { total: 0, rework: 0, accepted: 0 });
    }

    const monthStats = monthMap.get(monthKey)!;
    monthStats.total += 1;

    const status = statuses[response.id];
    if (status && typeof status === "string") {
      if (status.startsWith("Rework") || status === "Rework Accepted") {
        monthStats.rework += 1;
      } else if (status === "Direct Ok" || status === "Accepted") {
        monthStats.accepted += 1;
      }
    }
  });

  return Array.from(monthMap.entries())
    .map(([monthKey, stats]) => {
      const [year, month] = monthKey.split("-");
      const dateObj = new Date(parseInt(year), parseInt(month) - 1);
      const formattedMonth = dateObj.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
      return {
        date: formattedMonth,
        dateKey: monthKey,
        totalResponses: stats.total,
        reworkCount: stats.rework,
        acceptedCount: stats.accepted,
      };
    })
    .sort((a, b) => (a.dateKey > b.dateKey ? 1 : -1));
};

export const computeDirectAcceptedDailyStats = (
  responses: Response[],
  statuses: Record<string, string>,
  startDate?: string,
  endDate?: string,
): {
  date: string;
  dateKey: string;
  directCount: number;
  reworkCount: number;
  rejectedCount: number;
  total: number;
  questionReworkCount: number;
  reworkCompletedCount: number;
}[] => {
  const dailyMap = new Map<
    string,
    {
      total: number;
      direct: number;
      rework: number;
      rejected: number;
      questionRework: number;
      reworkCompleted: number;
    }
  >();

  let start: Date | null = null;
  let end: Date | null = null;

  if (startDate) {
    start = new Date(startDate);
  } else {
    start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }

  if (endDate) {
    end = new Date(endDate);
  } else {
    end = new Date();
    end.setHours(23, 59, 59, 999);
  }

  if (start && end) {
    const curr = new Date(start);
    curr.setHours(0, 0, 0, 0);
    const last = new Date(end);
    last.setHours(0, 0, 0, 0);

    while (curr <= last) {
      const dKey = toLocalDateString(curr);
      dailyMap.set(dKey, {
        total: 0,
        direct: 0,
        rework: 0,
        rejected: 0,
        questionRework: 0,
        reworkCompleted: 0,
      });
      curr.setDate(curr.getDate() + 1);
    }
  }

  responses.forEach((response) => {
    const timestamp = getResponseTimestamp(response);
    if (!timestamp) return;

    const dateKey = toLocalDateString(timestamp);
    if (!dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, {
        total: 0,
        direct: 0,
        rework: 0,
        rejected: 0,
        questionRework: 0,
        reworkCompleted: 0,
      });
    }

    const dayStats = dailyMap.get(dateKey)!;
    dayStats.total += 1;

    // Calculate rework count based on individual questions
    let formReworkQuestionsCount = 0;
    if (response.answers) {
      Object.values(response.answers).forEach((ans) => {
        if (typeof ans === "object" && ans !== null && (ans as any).status) {
          const s = String((ans as any).status)
            .toLowerCase()
            .trim();
          if (s === "rework" || s === "reworked" || s.includes("re-rework")) {
            formReworkQuestionsCount++;
          }
        } else if (typeof ans === "string") {
          const s = ans.toLowerCase().trim();
          if (s === "rework" || s === "reworked" || s.includes("re-rework")) {
            formReworkQuestionsCount++;
          }
        }
      });
    }
    dayStats.questionRework += formReworkQuestionsCount;

    const status = statuses[response.id];
    if (status === "Direct Ok" || status === "Accepted") {
      dayStats.direct += 1;
    } else if (
      status &&
      (status.startsWith("Rework Accepted") ||
        status.startsWith("Rework Completed"))
    ) {
      dayStats.reworkCompleted += 1;
    } else if (status && status.startsWith("Rework")) {
      dayStats.rework += 1;
    } else if (status === "Rejected") {
      dayStats.rejected += 1;
    }
  });

  return Array.from(dailyMap.entries())
    .map(([dateKey, stats]) => {
      const dateObj = new Date(dateKey);
      const formattedDate = dateObj.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      return {
        date: formattedDate,
        dateKey,
        directCount: stats.direct,
        reworkCount: stats.rework,
        rejectedCount: stats.rejected,
        total: stats.total,
        questionReworkCount: stats.questionRework,
        reworkCompletedCount: stats.reworkCompleted,
      };
    })
    .sort((a, b) => (a.dateKey > b.dateKey ? 1 : -1));
};

export const computeDailyReworkVolumeStats = (
  _form: Form | null,
  responses: Response[],
  startDate?: string,
  endDate?: string,
): { date: string; dateKey: string; reworkCount: number }[] => {
  const dailyMap = new Map<string, { rework: number }>();

  let start: Date | null = null;
  let end: Date | null = null;

  if (startDate) {
    start = new Date(startDate);
  }

  if (endDate) {
    end = new Date(endDate);
  }

  if (responses.length > 0 && !startDate && !endDate) {
    const timestamps = responses
      .map((r) => new Date(getResponseTimestamp(r) || 0).getTime())
      .filter((ts) => !isNaN(ts) && ts > 0);
    if (timestamps.length > 0) {
      start = new Date(Math.min(...timestamps));
      end = new Date(Math.max(...timestamps));
    }
  }

  if (!start) {
    start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }

  if (!end) {
    end = new Date();
    end.setHours(23, 59, 59, 999);
  }

  if (start && end) {
    const curr = new Date(start);
    curr.setHours(0, 0, 0, 0);
    const last = new Date(end);
    last.setHours(0, 0, 0, 0);

    while (curr <= last) {
      const dKey = toLocalDateString(curr);
      dailyMap.set(dKey, { rework: 0 });
      curr.setDate(curr.getDate() + 1);
    }
  }

  responses.forEach((response) => {
    const timestamp = getResponseTimestamp(response);
    if (!timestamp) return;

    const dateKey = toLocalDateString(timestamp);
    if (!dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, { rework: 0 });
    }

    const dayStats = dailyMap.get(dateKey)!;

    let hasRework = false;
    const rawSt = String(response.status || "").toLowerCase();
    if (rawSt.startsWith("rework")) {
      hasRework = true;
    }
    const biwSt = String(response.biwReview?.status || "").toLowerCase();
    if (biwSt === "reworked" || biwSt === "rework") {
      hasRework = true;
    }
    if (!hasRework && response.answers) {
      for (const answer of Object.values(response.answers)) {
        if (answer === null || answer === undefined || answer === "") continue;

        if (typeof answer === "object" && (answer as any).status) {
          const status = String((answer as any).status).toLowerCase().trim();
          if (status === "rework" || status === "reworked" || status.includes("re-rework")) {
            hasRework = true;
            break;
          }
        } else {
          const answerStr = String(answer).toLowerCase().trim();
          if (answerStr === "rework" || answerStr === "reworked" || answerStr.includes("re-rework")) {
            hasRework = true;
            break;
          }
        }
      }
    }
    if (hasRework) {
      dayStats.rework += 1;
    }
  });

  return Array.from(dailyMap.entries())
    .map(([dateKey, stats]) => {
      const dateObj = new Date(dateKey);
      const formattedDate = dateObj.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      return {
        date: formattedDate,
        dateKey,
        reworkCount: stats.rework,
      };
    })
    .sort((a, b) => (a.dateKey > b.dateKey ? 1 : -1));
};

export const getSectionYesNoStats = (
  form: any,
  answers: Record<string, any>,
): SectionStat[] => {
  const stats =
    form.sections?.map((section: any) => {
      const counts = {
        yes: 0,
        no: 0,
        na: 0,
        accepted: 0,
        rejected: 0,
        rework: 0,
        total: 0,
      };

      const processQuestion = (question: any) => {
        if (!question) {
          return;
        }

        const answer = answers?.[question.id];
        if (answer !== null && answer !== undefined && answer !== "") {
          // Check if it's an inspection status object
          if (typeof answer === "object" && answer.status) {
            const status = String(answer.status).toLowerCase().trim();
            if (
              status === "accepted" ||
              status === "rework completed" ||
              status === "verified"
            ) {
              counts.accepted += 1;
              counts.total += 1;
            } else if (status === "rejected") {
              counts.rejected += 1;
              counts.total += 1;
            } else if (
              status === "rework" ||
              status === "reworked" ||
              status.includes("re-rework")
            ) {
              counts.rework += 1;
              counts.total += 1;
            }
          } else {
            // Handle string answers that might be inspection statuses
            const answerStr = String(answer).toLowerCase().trim();
            const normalizedValues = extractYesNoValues(answer);

            if (
              answerStr === "accepted" ||
              answerStr === "rework completed" ||
              answerStr === "verified"
            ) {
              counts.accepted += 1;
              counts.total += 1;
            } else if (answerStr === "rejected") {
              counts.rejected += 1;
              counts.total += 1;
            } else if (
              answerStr === "rework" ||
              answerStr === "reworked" ||
              answerStr.includes("re-rework")
            ) {
              counts.rework += 1;
              counts.total += 1;
            } else if (
              question.type === "yesNoNA" ||
              question.type === "chassisWithZone" ||
              question.type === "chassisWithoutZone" ||
              question.type === "chassis" ||
              question.type === "zone-in" ||
              question.type === "zone-out" ||
              question.text?.toLowerCase().includes("chassis")
            ) {
              const options = question.options || [];

              if (options.length >= 3) {
                const yesOption = String(options[0]).toLowerCase().trim();
                const noOption = String(options[1]).toLowerCase().trim();
                const naOption = String(options[2]).toLowerCase().trim();

                normalizedValues.forEach((val) => {
                  if (val === yesOption) {
                    counts.yes += 1;
                    counts.total += 1;
                  } else if (val === noOption) {
                    counts.no += 1;
                    counts.total += 1;
                  } else if (val === naOption) {
                    counts.na += 1;
                    counts.total += 1;
                  }
                });
              } else {
                const hasRecognizedValue = normalizedValues.some((value) =>
                  recognizedYesNoValues.includes(value),
                );
                if (hasRecognizedValue) {
                  counts.total += 1;
                  if (
                    normalizedValues.includes("yes") ||
                    normalizedValues.includes("accepted") ||
                    normalizedValues.includes("verified")
                  ) {
                    counts.yes += 1;
                  }
                  if (
                    normalizedValues.includes("no") ||
                    normalizedValues.includes("rejected")
                  ) {
                    counts.no += 1;
                  }
                  if (
                    normalizedValues.includes("n/a") ||
                    normalizedValues.includes("na") ||
                    normalizedValues.includes("not applicable") ||
                    normalizedValues.includes("rework") ||
                    normalizedValues.includes("reworked") ||
                    normalizedValues.some((v) => v.includes("re-rework"))
                  ) {
                    counts.na += 1;
                  }
                }
              }
            }
          }
        }

        question.followUpQuestions?.forEach(processQuestion);
      };

      section.questions?.forEach(processQuestion);

      if (!counts.total) {
        return null;
      }

      return {
        id: section.id,
        title: section.title || "Untitled Section",
        yes: counts.yes,
        no: counts.no,
        na: counts.na,
        accepted: counts.accepted,
        rejected: counts.rejected,
        rework: counts.rework,
        total: counts.total,
      };
    }) ?? [];

  return stats.filter((stat): stat is SectionStat => Boolean(stat));
};
