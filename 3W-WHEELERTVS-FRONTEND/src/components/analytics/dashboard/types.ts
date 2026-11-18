export interface Response {
  _id?: string;
  id: string;
  questionId: string;
  answers: Record<string, any>;
  timestamp?: string;
  createdAt?: string; // MongoDB timestamp field
  submittedAt?: string;
  parentResponseId?: string;
  assignedTo?: string;
  assignedAt?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  status?: "pending" | "verified" | "rejected";
  notes?: string;
  submissionMetadata?: {
    location?: {
      city?: string;
      country?: string;
      region?: string;
      latitude?: number;
      longitude?: number;
    };
    capturedLocation?: {
      latitude?: number;
      longitude?: number;
    };
  };
  questionTimings?: Array<{ questionId: string; timeSpent: number }>;
  totalTimeSpent?: number;
  responseRanks?: Record<string, number>;
  createdBy?: string;
  isDispatched?: boolean;
  dispatchedAt?: string;
  dispatchedBy?: string;
  dispatchedByName?: string;
  tenantId?: string;
  submittedBy?: string;
  timeSpent?: number;
  submitterContact?: {
    email?: string;
  };
  biwReview?: {
    status: "Accepted" | "Rejected" | "Reworked";
    remark?: string | null;
    evidenceUrl?: string | null;
    flaggedQuestions?: { questionId: string; questionText: string }[];
    reviewedBy?: string;
    reviewedByName?: string;
    reviewedAt?: string;
  };
}

export interface Section {
  weightage(weightage: any): unknown;
  id: string;
  title: string;
  description?: string;
  questions: FollowUpQuestion[];
}

export interface FollowUpQuestion {
  id: string;
  text: string;
  type: string;
  required?: boolean;
  options?: string[];
  description?: string;
  followUpQuestions?: FollowUpQuestion[];
  correctAnswer?: any;
  trackResponseRank?: boolean;
  trackResponseQuestion?: boolean;
}

export interface ChassisNumberEntry {
  _id?: string;
  chassisNumber: string;
  partDescription?: string;
}

export interface Form {
  _id: string;
  id?: string;
  title: string;
  description?: string;
  createdAt?: string;
  isVisible?: boolean;
  logoUrl?: string;
  imageUrl?: string;
  sections?: Section[];
  followUpQuestions?: FollowUpQuestion[];
  parentFormId?: string;
  parentFormTitle?: string;
  chassisNumbers?: ChassisNumberEntry[];
  tenantId?: string | { _id?: string; toString?: () => string };
}

export type SectionPerformanceStat = {
  id: string;
  title: string;
  yes: number;
  no: number;
  na: number;
  accepted?: number;
  rejected?: number;
  rework?: number;
  total: number;
  weightage: number;
};

export type QuestionPerformanceStat = {
  id: string;
  text: string;
  sectionTitle: string;
  accepted: number;
  rejected: number;
  rework: number;
  total: number;
};

export interface SectionAnalyticsData {
  sectionId: string;
  sectionTitle: string;
  description?: string;
  stats: {
    mainQuestionCount: number;
    totalFollowUpCount: number;
    answeredMainQuestions: number;
    answeredFollowUpQuestions: number;
    totalAnswered: number;
    totalResponses: number;
    completionRate: string;
    avgResponsesPerQuestion: string;
    questionsDetail: Array<{
      id: string;
      text: string;
      followUpCount: number;
      responses: number;
      followUpDetails?: Array<{
        id: string;
        text: string;
        responses: number;
      }>;
    }>;
  };
  qualityBreakdown: Array<{
    parameterName: string;
    yes: number;
    no: number;
    na: number;
    total: number;
  }>;
  overallQuality: {
    totalYes: number;
    totalNo: number;
    totalNA: number;
    totalResponses: number;
    percentages: {
      yes: string;
      no: string;
      na: string;
    };
  };
}

export interface ZoneAnalyticsData {
  inspectionStatus: {
    accepted: number;
    rework: number;
    rejected: number;
    total: number;
  };
  zoneBreakdown: Array<{
    zone: string;
    categories: Array<{
      category: string;
      count: number;
      defects: Array<{
        name: string;
        count: number;
        reworkCount: number;
        rejectedCount: number;
      }>;
    }>;
  }>;
}

export type DailyPerformanceStat = {
  date: string;
  total: number;
  accepted: number;
  rejected: number;
  rework: number;
};

export interface SectionStat {
  id: string;
  title: string;
  yes: number;
  no: number;
  na: number;
  total: number;
  accepted: number;
  rejected: number;
  rework: number;
}

export interface FormAnalyticsDashboardProps {
  formId?: string;
  embedded?: boolean;
  initialTab?: "responses" | "dashboard";
}
