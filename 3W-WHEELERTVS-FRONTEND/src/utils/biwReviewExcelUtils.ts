import * as XLSX from "xlsx";
import XLSX_STYLE from "xlsx-js-style";
import JSZip from "jszip";
import type { Form, Section, Question } from "../types/forms";

export interface BiwExcelRow {
  date?: string;
  assignedTenant?: string;
  submittedBy?: string;
  reviewedBy?: string;
  chassisNumber: string;
  biwFeedback?: string;
  biwReason?: string;
  biwRemark?: string;
  biwFileUrl?: string;
  tvsFeedback?: string;
  tvsReason?: string;
  tvsRejectReason?: string;
  tvsRemark?: string;
  tvsFileUrl?: string;
  // Cloned F to J for Target Tenant:
  targetTvsFeedback?: string;
  targetTvsReason?: string;
  targetTvsRejectReason?: string;
  targetTvsRemark?: string;
  targetTvsFileUrl?: string;
  // Metadata for preview
  rowIndex?: number;
  matched?: boolean;
  workerName?: string;
  isNewlyEnteredOrModified?: boolean;
  hasReviewData?: boolean;
  isDefect?: boolean;
  isAccepted?: boolean;
}

export const BIW_REVIEW_COLUMNS = [
  "Chassis Number",
  "Date",
  "Assigned Tenant",
  "Reviewed By",
  "BIW Feed back(Accept,Rework,Reject)",
  "Rework and Rejected Resion (Rust..)",
  "Remark",
  "File Upload",
  "TVS Feed back",
  "Rework and Rejected Resion (Rust..)",
  "Remark",
  "File Upload"
];

const STANDARD_DEFECTS = [
  "Rust / Corrosion",
  "Dent / Surface deformation",
  "Weld defect / Open seam",
  "Paint scratch / Peel / Run",
  "Alignment / Gap mismatch",
  "Burr / Sharp edge",
  "Missing fastener / Hole mismatch",
  "Dimensional variance",
  "Sheet metal crack",
  "Underbody clearance defect"
];

/**
 * Extracts defect checkpoint questions from the active form and current responses.
 */
export function extractFormDefectReasons(form?: Form | null, responses?: any[]): string[] {
  const defectReasons: string[] = [];

  const isUUID = (s: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) ||
    /^[0-9a-f]{24}$/i.test(s);

  // Build question text lookup map from form schema
  const questionMap: Record<string, string> = {};
  if (form?.sections && Array.isArray(form.sections)) {
    form.sections.forEach((sec: Section) => {
      if (sec.questions && Array.isArray(sec.questions)) {
        sec.questions.forEach((q: any) => {
          const txt = q.text || q.title || (q as any).question;
          if (q.id && txt) questionMap[q.id] = txt;
          if (q._id && txt) questionMap[String(q._id)] = txt;
        });
      }
    });
  }

  const addReason = (txt?: string) => {
    if (!txt || typeof txt !== "string") return;
    const clean = txt.trim();
    if (!clean || clean.length < 2) return;
    if (isUUID(clean)) return; // Never display raw UUIDs in the dropdown

    const lower = clean.toLowerCase();
    // Exclude purely administrative/meta fields
    if (
      lower.includes("identification") ||
      lower.includes("chassis") ||
      lower.includes("signature") ||
      lower.includes("geo location") ||
      lower.includes("gps") ||
      lower.includes("inspector name") ||
      lower.includes("timestamp") ||
      lower.includes("date and part no")
    ) {
      return;
    }
    if (!defectReasons.includes(clean)) {
      defectReasons.push(clean);
    }
  };

  // 1. Extract from form checkpoint sections
  if (form?.sections && Array.isArray(form.sections)) {
    form.sections.forEach((sec: Section) => {
      if (sec.questions && Array.isArray(sec.questions)) {
        sec.questions.forEach((q: any) => {
          addReason(q.text || q.title || (q as any).question);
        });
      }
    });
  }

  // 2. Extract from root form questions (question-wise mode)
  if ((form as any)?.questions && Array.isArray((form as any).questions)) {
    (form as any).questions.forEach((q: any) => {
      addReason(q.text || q.title || (q as any).question);
    });
  }

  // 3. Extract from response answers by mapping UUID to question title
  if (responses && Array.isArray(responses)) {
    responses.forEach((resp) => {
      if (resp.answers && typeof resp.answers === "object") {
        Object.keys(resp.answers).forEach((k) => {
          if (questionMap[k]) {
            addReason(questionMap[k]);
          } else if (!isUUID(k) && !k.startsWith("_") && k.length > 2) {
            addReason(k);
          }
        });
      }
    });
  }

  // 4. Combine form checkpoints with standard defect terms
  STANDARD_DEFECTS.forEach((d) => {
    if (!defectReasons.some((item) => item.toLowerCase() === d.toLowerCase())) {
      defectReasons.push(d);
    }
  });

  return defectReasons;
}

// Known tenant staff directory (inspectors & subadmins)
export const TENANT_EMPLOYEES: Record<string, string[]> = {
  Saify: [
    "Thowseef Imran",
    "Vikram B",
    "Thilak S",
    "Govindaraj R",
    "Magendiran P",
    "Divya M",
    "Saify admin",
    "vik v",
    "Ramachandran M"
  ],
  LMPL: [
    "Manoj Mohan",
    "Sathiya Seelan A",
    "Gokula Krishnan R",
    "Naveen kumar K",
    "Irfan Khan D",
    "Karthikeyan K",
    "Vinu B",
    "Nanmaran E",
    "Praveen Kumar G",
    "Velmurugan E",
    "Thilak Thilak",
    "Ajith Kumar"
  ],
  Sreedevi: [
    "Shivaliingam N",
    "Saravanan L",
    "Ranjith S",
    "Sree sree",
    "Krishna kanth",
    "Jayaprakash J",
    "Sanjai S",
    "Kishore L",
    "Sreedevi Admin"
  ],
  "TVS 3W": ["TVS 3W", "Vignesh Vignesh", "Focus c"],
  Nahars: ["Nahars admin", "Nayeemuddin N", "Nanmaran Nanmaran", "Vinu Nahars"]
};

/**
 * Generates and downloads the BIW Review Excel Template with native OpenXML dropdown data validations.
 * If a target tenant / child form is present, clones columns F to J into K to O with target tenant defect checkpoints!
 */
export async function downloadBiwReviewTemplate(options: {
  form?: Form | null;
  formTitle?: string;
  mainTenantName?: string;
  chassisNumbers?: string[];
  responses?: any[];
  filename?: string;
  targetTenantForm?: Form | any;
  targetTenantTitle?: string;
  targetTenantName?: string;
  childResponses?: any;
  reviewerOptions?: string[];
  prefillTvsAccepted?: boolean;
}) {
  const {
    form,
    formTitle,
    mainTenantName,
    chassisNumbers = [],
    responses = [],
    filename,
    targetTenantForm,
    targetTenantTitle,
    targetTenantName,
    childResponses = {},
    reviewerOptions = [],
    prefillTvsAccepted = false
  } = options;

  const hasTargetTenant = Boolean(targetTenantForm);
  const mainTitle = formTitle || form?.title || "Main Form";
  const mainTenant = mainTenantName || "";
  const targetTitle = targetTenantTitle || targetTenantForm?.title || "Child Form";
  const targetTenant = targetTenantName || "";

  const mainHeaderLabel = hasTargetTenant
    ? `1st: ${mainTitle}${mainTenant ? ` | ${mainTenant}` : ""}`
    : `${mainTitle}${mainTenant ? ` | ${mainTenant}` : ""}`;

  const targetHeaderLabel = `2nd: ${targetTitle}${targetTenant ? ` | ${targetTenant}` : ""}`;

  const defectOptions = extractFormDefectReasons(form, responses);
  const targetDefectOptions = hasTargetTenant ? extractFormDefectReasons(targetTenantForm, responses) : [];
  const statusOptions = ["Accepted", "Rejected", "Rework"];

  // Tenant ID to name lookup map
  const tenantIdMap: Record<string, string> = {
    "6a461748cbbdff3abd815c29": "LMPL",
    "6a47564e60eb9da6a9b29e3e": "Saify",
    "6a47539460eb9da6a9b29b58": "Sreedevi",
    "6a4c9d8fcd7f99bc91eee120": "TVS 3W",
    "6a4faadde1b1feb23fa74124": "Nahars"
  };

  // Priority order for Tenant & Inspector dropdown:
  // Show ONLY assigned tenant (e.g. Saify) and its employees (inspectors & subadmins) alone
  const assignedTenantKey = Object.keys(TENANT_EMPLOYEES).find(
    (k) => k.toLowerCase() === (mainTenantName || "").toLowerCase().trim()
  ) || "Saify";

  const priorityStaff = TENANT_EMPLOYEES[assignedTenantKey] || TENANT_EMPLOYEES["Saify"] || [];

  const orderedTenantOptions: string[] = [];
  const seenTenantOpts = new Set<string>();

  // Add assigned tenant name (e.g. "Saify")
  const primaryTenantName = mainTenantName && String(mainTenantName).trim() ? String(mainTenantName).trim() : "Saify";
  if (!seenTenantOpts.has(primaryTenantName)) {
    orderedTenantOptions.push(primaryTenantName);
    seenTenantOpts.add(primaryTenantName);
  }

  // Add assigned tenant's inspectors and subadmins (Saify staff) alone - other tenants/employees excluded
  priorityStaff.forEach((emp) => {
    if (!seenTenantOpts.has(emp)) {
      orderedTenantOptions.push(emp);
      seenTenantOpts.add(emp);
    }
  });

  const finalTenantOptions = orderedTenantOptions;

  // Reviewer Options: Only assigned tenant's staff (e.g. Saify inspectors & subadmins)
  const orderedReviewers: string[] = [];
  const seenReviewers = new Set<string>();

  priorityStaff.forEach((emp) => {
    if (!seenReviewers.has(emp)) {
      orderedReviewers.push(emp);
      seenReviewers.add(emp);
    }
  });

  const finalReviewerOptions = orderedReviewers;

  // 1. Prepare Main Sheet Data (Header + Rows)
  const mainSheetData: any[][] = [];

  // Header row: Columns A (Chassis), B (Date), C (Assigned Tenant), D (Reviewed By), E-H (BIW), I-L (1st Main TVS), and M-P (2nd Target Tenant TVS cloned!)
  const headers = [
    "Chassis Number",
    "Date",
    "Assigned Tenant",
    "Reviewed By",
    "BIW Feed back(Accept,Rework,Reject)",
    "Rework and Rejected Resion (Rust..)",
    "Remark",
    "File Upload",
    `TVS Feed back (${mainHeaderLabel})`,
    `Rework and Rejected Resion (Rust..) - ${mainTitle}`,
    `Remark - ${mainTitle}`,
    `File Upload - ${mainTitle}`
  ];

  if (hasTargetTenant) {
    headers.push(
      `TVS Feed back (${targetHeaderLabel})`,
      `Rework and Rejected Resion (Rust..) - ${targetTitle}`,
      `Remark - ${targetTitle}`,
      `File Upload - ${targetTitle}`
    );
  }

  mainSheetData.push(headers);

  // Identify chassis question ID from form template if available
  let formChassisQuestionId: string | null = null;
  if (form?.sections && Array.isArray(form.sections)) {
    // Priority 1: Explicit tracking flag (exclude defect inspection questions like zone-in / zone-out)
    for (const section of form.sections) {
      if (section.questions) {
        for (const q of section.questions) {
          if (
            (q.trackResponseRank === true ||
              q.trackResponseRank === "true" ||
              q.trackResponseQuestion === true ||
              q.trackResponseQuestion === "true") &&
            q.type !== "zone-in" &&
            q.type !== "zone-out"
          ) {
            formChassisQuestionId = q.id;
            break;
          }
        }
      }
      if (formChassisQuestionId) break;
    }
    // Priority 2: Title or text explicitly mentioning Chassis, VIN, or Identification
    if (!formChassisQuestionId) {
      for (const section of form.sections) {
        if (section.questions) {
          for (const q of section.questions) {
            const t = String(q.text || q.title || "").toLowerCase();
            if (
              (t.includes("chassis") ||
                t.includes("vin") ||
                t.includes("identification") ||
                t.includes("id no") ||
                t.includes("id number")) &&
              q.type !== "zone-in" &&
              q.type !== "zone-out"
            ) {
              formChassisQuestionId = q.id;
              break;
            }
          }
        }
        if (formChassisQuestionId) break;
      }
    }
  }

  // Plant / vendor identifiers that should NOT be mistaken for individual unit chassis numbers
  const ignoredUnitNames = new Set(["TVS", "EXCEL IMPORT", "SAIFY", "SRIDEVI", "SREEDEVI", "LMPL", "N/A", "-", "NONE"]);

  // Helper to extract clean chassis string from response
  const getChassisFromResponse = (r: any): string => {
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
      "Identification no",
      "identification no",
      "Identification No",
      "chassisNumber",
      "chassis_number",
      "Chassis Number",
      "CHASSIS NUMBER",
      "Chassis / VIN",
      "vin",
      "VIN",
      "id_number",
      "idNumber",
      "ID Number",
      "cha",
      "che"
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

    // 3. Scan any answer containing "chassis", "vin", or "identification"
    for (const [k, v] of Object.entries(a)) {
      const lk = k.toLowerCase();
      if ((lk.includes("chassis") || lk.includes("vin") || lk.includes("identification")) && v) {
        const val = typeof v === "object" ? (v as any)?.chassisNumber || (v as any)?.value || (v as any)?.label : v;
        if (val && String(val).trim() !== "" && !ignoredUnitNames.has(String(val).trim().toUpperCase())) {
          return String(val).trim();
        }
      }
    }

    // 3b. Scan all answers for alphanumeric values containing digits (e.g., 4486N, 4056N, 1031)
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
          !["OK", "NOT OK", "PASS", "FAIL", "REWORK", "REJECT", "REJECTED", "ACCEPTED", "YES", "NO", "TRUE", "FALSE"].includes(str.toUpperCase())
        ) {
          return str;
        }
      }
    }

    // 4. Direct top-level systemChassisNumber or chassisNumber (exclude known plant/vendor tags)
    if (r.systemChassisNumber && !ignoredUnitNames.has(String(r.systemChassisNumber).trim().toUpperCase())) {
      return String(r.systemChassisNumber).trim();
    }
    if (r.chassisNumber && !ignoredUnitNames.has(String(r.chassisNumber).trim().toUpperCase())) {
      return String(r.chassisNumber).trim();
    }

    // 5. Fallback if nothing else found
    if (r.chassisNumber && r.chassisNumber !== "TVS" && r.chassisNumber !== "Excel Import") {
      return String(r.chassisNumber).trim();
    }

    return "";
  };

  // Helper to extract formatted date and timestamp
  const getDateInfo = (r: any): { dateStr: string; timestampNum: number } => {
    const raw =
      r?.submittedAt ||
      r?.createdAt ||
      r?.timestamp ||
      r?.submissionMetadata?.submittedAt ||
      r?.submissionMetadata?.capturedLocation?.capturedAt;
    if (raw) {
      if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}/.test(raw)) {
        const datePart = raw.substring(0, 10);
        const parsedTime = new Date(raw).getTime();
        return { dateStr: datePart, timestampNum: isNaN(parsedTime) ? 0 : parsedTime };
      }

      const d = new Date(raw);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return { dateStr: `${y}-${m}-${day}`, timestampNum: d.getTime() };
      }
    }

    // Default to today's date YYYY-MM-DD so Date column is NEVER blank upon download
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return { dateStr: `${y}-${m}-${day}`, timestampNum: now.getTime() };
  };

  // Helper to extract submitter / inspector name
  const getSubmitterName = (r: any): string => {
    if (!r) return "";
    return (
      r.submittedBy ||
      r.submittedByName ||
      r.createdBy ||
      (r as any).workerName ||
      r.answers?.["inspector_name"] ||
      r.answers?.["Inspector Name"] ||
      r.answers?.["inspector"] ||
      ""
    );
  };

  // Helper to resolve assigned tenant based on performance table truth
  const getAssignedTenantForChassis = (ch: string, r: any): string => {
    // 0. Direct candidate checking on response (systemChassisNumber, rawChassisNumber, chassisNumber, plant, etc.)
    const plantCandidates = [
      r?.systemChassisNumber,
      r?.rawChassisNumber,
      r?.chassisNumber,
      r?.plant,
      r?.assignedTenant,
      r?.tenantName,
      r?.answers?.chassis_number
    ];
    for (const c of plantCandidates) {
      if (typeof c === "string" && c.trim()) {
        const cn = c.trim();
        if (["Saify", "LMPL", "Sreedevi", "TVS", "Nahars"].some((t) => t.toLowerCase() === cn.toLowerCase())) {
          return cn.toUpperCase() === "SAIFY" ? "Saify" : cn.toUpperCase() === "LMPL" ? "LMPL" : cn;
        }
      }
    }

    // 1. Direct tenant property on response if present
    if (r?.tenantName && typeof r.tenantName === "string" && r.tenantName.trim()) {
      return r.tenantName.trim();
    }
    if (r?.plant && typeof r.plant === "string" && r.plant.trim()) {
      return r.plant.trim();
    }
    if (r?.assignedTenant && typeof r.assignedTenant === "string" && r.assignedTenant.trim()) {
      return r.assignedTenant.trim();
    }
    if (r?.tenantId) {
      if (typeof r.tenantId === "object" && (r.tenantId.name || r.tenantId.companyName)) {
        return (r.tenantId.name || r.tenantId.companyName).trim();
      }
      const tIdStr = String(r.tenantId).trim();
      if (tenantIdMap[tIdStr]) return tenantIdMap[tIdStr];
    }

    // 2. Check form chassisTenantAssignments
    if (form?.chassisTenantAssignments && Array.isArray(form.chassisTenantAssignments)) {
      const chClean = (ch || "").toUpperCase().trim();
      const rChClean = (r?.chassisNumber || "").toUpperCase().trim();
      const rSysClean = (r?.systemChassisNumber || "").toUpperCase().trim();

      const foundAssignment = form.chassisTenantAssignments.find((a: any) => {
        const aCh = String(a.chassisNumber || "").toUpperCase().trim();
        return (
          aCh === chClean ||
          aCh === rChClean ||
          aCh === rSysClean ||
          (r?.answers && Object.values(r.answers).some((val) => String(val).toUpperCase().trim() === aCh))
        );
      });

      if (foundAssignment) {
        if (foundAssignment.tenantName) return String(foundAssignment.tenantName).trim();
        const aChRaw = String(foundAssignment.chassisNumber || "").trim();
        if (["Saify", "LMPL", "Sreedevi", "TVS", "Nahars"].some((t) => t.toLowerCase() === aChRaw.toLowerCase())) {
          return aChRaw;
        }
        if (Array.isArray(foundAssignment.assignedTenants) && foundAssignment.assignedTenants.length > 0) {
          const tId = String(foundAssignment.assignedTenants[0]);
          if (tenantIdMap[tId]) return tenantIdMap[tId];
        }
      }
    }

    // 3. If chassisNumber itself was used as the plant/vendor tag (e.g. 'Saify', 'LMPL', 'Sreedevi')
    if (r?.chassisNumber && typeof r.chassisNumber === "string") {
      const cn = r.chassisNumber.trim();
      if (["Saify", "LMPL", "Sreedevi", "TVS", "Nahars"].some((t) => t.toLowerCase() === cn.toLowerCase())) {
        return cn;
      }
    }

    // 4. Submitter / Inspector mapping (matches performance table truth)
    const sub = String(r?.submittedBy || r?.submittedByName || "").toLowerCase().trim();
    if (sub) {
      if (
        sub.includes("sathiya") ||
        sub.includes("naveen") ||
        sub.includes("gokula") ||
        sub.includes("irfan") ||
        sub.includes("karthikeyan") ||
        sub.includes("vinu") ||
        sub.includes("nanmaran") ||
        sub.includes("lmpl")
      ) {
        return "LMPL";
      }
      if (
        sub.includes("thowseef") ||
        sub.includes("vikram") ||
        sub.includes("thilak") ||
        sub.includes("govindaraj") ||
        sub.includes("magendiran") ||
        sub.includes("divya") ||
        sub.includes("saify")
      ) {
        return "Saify";
      }
      if (
        sub.includes("shivaliingam") ||
        sub.includes("saravanan") ||
        sub.includes("ranjith") ||
        sub.includes("sree") ||
        sub.includes("krishna") ||
        sub.includes("jayaprakash") ||
        sub.includes("sanjai") ||
        sub.includes("kishore")
      ) {
        return "Sreedevi";
      }
    }

    // 5. Fallback to mainTenantName
    if (mainTenantName && typeof mainTenantName === "string" && mainTenantName.trim()) {
      return mainTenantName.trim();
    }

    return "LMPL";
  };

  // Helper to score response completeness (BIW + TVS + childReview + recency)
  const getResponseScore = (r: any) => {
    if (!r) return -1;
    const hasBiw = Boolean(r.biwReview && r.biwReview.status);
    const hasTvs = Boolean(r.review && (r.review.reviewOption || r.review.status));
    const hasChildTvs = Boolean(
      r.childResponse?.review?.reviewOption ||
      r.childResponse?.review?.status ||
      r.childReview?.reviewOption ||
      r.childReview?.status ||
      r.followUpStatus?.childReview?.reviewOption ||
      r.followUpStatus?.childReview?.status
    );
    return (hasBiw ? 4 : 0) + (hasTvs ? 2 : 0) + (hasChildTvs ? 1 : 0);
  };

  // Map existing responses by chassis identifiers to pre-load current review status
  const responseMap = new Map<string, any>();
  if (responses && Array.isArray(responses)) {
    responses.forEach((r) => {
      // 🔒 Dispatch Prerequisite: Only dispatched chassis can be included in TVS review template
      if (!r.isDispatched) return;
      const a = r.answers || {};
      const resolvedChassis = getChassisFromResponse(r);
      const keys: string[] = [
        resolvedChassis,
        r.chassisNumber,
        (r as any).systemChassisNumber,
        formChassisQuestionId ? a[formChassisQuestionId] : null,
        a["Identification no"],
        a["identification no"],
        a["Identification No"],
        a["chassisNumber"],
        a["chassis_number"],
        a["Chassis Number"],
        a["cha"],
        a["che"]
      ];
      Object.values(a).forEach((v) => {
        if (
          (typeof v === "string" || typeof v === "number") &&
          String(v).trim().length >= 1 &&
          String(v).trim().length <= 60
        ) {
          keys.push(String(v).trim());
        }
      });
      const rScore = getResponseScore(r);
      const rTime = new Date(r.updatedAt || r.createdAt || r.submittedAt || 0).getTime();
      keys.filter(Boolean).forEach((k) => {
        const norm = String(k).trim().toUpperCase();
        const existing = responseMap.get(norm);
        if (!existing) {
          responseMap.set(norm, r);
        } else {
          const exScore = getResponseScore(existing);
          const exTime = new Date(existing.updatedAt || existing.createdAt || existing.submittedAt || 0).getTime();
          if (rScore > exScore || (rScore === exScore && rTime > exTime)) {
            responseMap.set(norm, r);
          }
        }
      });
    });
  }

  // Build unified inspection items list: chassis, date, assignedTenant, submittedBy, response
  interface TemplateRowItem {
    chassis: string;
    date: string;
    assignedTenant: string;
    submittedBy: string;
    timestamp: number;
    matchedResp: any;
  }

  const items: TemplateRowItem[] = [];
  const itemIndexByChassis = new Map<string, number>();

  // If responses provided, build items from them (preferring highest-scored / most recent per chassis)
  if (responses && Array.isArray(responses) && responses.length > 0) {
    responses.forEach((r) => {
      // 🔒 Dispatch Prerequisite: Only dispatched chassis can be included in BIW review template
      if (!r.isDispatched) return;
      const ch = getChassisFromResponse(r);
      if (ch && !ignoredUnitNames.has(ch.toUpperCase())) {
        const normCh = ch.toUpperCase();
        const { dateStr, timestampNum } = getDateInfo(r);
        const sub = getSubmitterName(r);
        const assignedTenantStr = getAssignedTenantForChassis(ch, r);
        const existingIdx = itemIndexByChassis.get(normCh);
        if (existingIdx === undefined) {
          itemIndexByChassis.set(normCh, items.length);
          items.push({
            chassis: ch,
            date: dateStr,
            assignedTenant: assignedTenantStr,
            submittedBy: sub,
            timestamp: timestampNum,
            matchedResp: r
          });
        } else {
          const exItem = items[existingIdx];
          const rScore = getResponseScore(r);
          const exScore = getResponseScore(exItem.matchedResp);
          if (rScore > exScore || (rScore === exScore && timestampNum > exItem.timestamp)) {
            items[existingIdx] = {
              chassis: ch,
              date: dateStr,
              assignedTenant: assignedTenantStr,
              submittedBy: sub,
              timestamp: timestampNum,
              matchedResp: r
            };
          }
        }
      }
    });
  }

  // Also include any chassisNumbers that weren't in responses
  if (Array.isArray(chassisNumbers)) {
    chassisNumbers.forEach((rawCh) => {
      const ch = String(rawCh || "").trim();
      if (ch && !ignoredUnitNames.has(ch.toUpperCase()) && !itemIndexByChassis.has(ch.toUpperCase())) {
        const matchedResp = responseMap.get(ch.toUpperCase()) || null;
        const { dateStr, timestampNum } = getDateInfo(matchedResp);
        const sub = getSubmitterName(matchedResp);
        const assignedTenantStr = getAssignedTenantForChassis(ch, matchedResp);
        itemIndexByChassis.set(ch.toUpperCase(), items.length);
        items.push({
          chassis: ch,
          date: dateStr,
          assignedTenant: assignedTenantStr,
          submittedBy: sub,
          timestamp: timestampNum,
          matchedResp
        });
      }
    });
  }

  // If no responses or chassis passed, fallback from responseMap
  if (items.length === 0 && responseMap.size > 0) {
    responseMap.forEach((r, normKey) => {
      if (!ignoredUnitNames.has(normKey) && !itemIndexByChassis.has(normKey)) {
        const ch = getChassisFromResponse(r) || normKey;
        if (ch && !ignoredUnitNames.has(ch.toUpperCase()) && !itemIndexByChassis.has(ch.toUpperCase())) {
          const { dateStr, timestampNum } = getDateInfo(r);
          const sub = getSubmitterName(r);
          const assignedTenantStr = getAssignedTenantForChassis(ch, r);
          itemIndexByChassis.set(ch.toUpperCase(), items.length);
          items.push({
            chassis: ch,
            date: dateStr,
            assignedTenant: assignedTenantStr,
            submittedBy: sub,
            timestamp: timestampNum,
            matchedResp: r
          });
        }
      }
    });
  }

  // Fallback if items is still empty: provide standard chassis units and today's date so template is never blank
  if (items.length === 0) {
    const fallbackChassis = [
      "4056N", "4328N", "4424N", "4482N", "4483N", "4484N", "4486N", "4487N",
      "4490N", "4493N", "4496N", "4498N", "4502N", "4503N", "4507N", "4510N",
      "4515N", "4516N", "4517N", "4519N", "4520N", "4521N", "4523N", "4512N",
      "4501N", "4511N", "4489N", "4488N", "4495N", "4504N"
    ];
    const { dateStr, timestampNum } = getDateInfo(null);
    fallbackChassis.forEach((ch) => {
      items.push({
        chassis: ch,
        date: dateStr,
        assignedTenant: mainTenantName || "Saify",
        submittedBy: "",
        timestamp: timestampNum,
        matchedResp: null
      });
    });
  }

  // Sort by most recent date/timestamp first (newest on top, older at bottom)
  items.sort((a, b) => {
    const timeDiff = (b.timestamp || 0) - (a.timestamp || 0);
    if (timeDiff !== 0) return timeDiff;
    return String(b.chassis || "").localeCompare(String(a.chassis || ""), undefined, { numeric: true });
  });

  // Provide rows: generate rows for all items
  const rowsCount = items.length;
  for (let i = 0; i < rowsCount; i++) {
    const item = items[i];
    const ch = item?.chassis || "";
    const matchedResp = item?.matchedResp || (ch ? responseMap.get(ch.toUpperCase()) : null);
    const dateVal = item?.date || (matchedResp ? getDateInfo(matchedResp).dateStr : getDateInfo(null).dateStr);
    const assignedTenantVal = item?.assignedTenant || (ch ? getAssignedTenantForChassis(ch, matchedResp) : (mainTenantName || "Saify"));

    const reviewerVal =
      matchedResp?.biwReview?.reviewedByName ||
      (typeof matchedResp?.biwReview?.reviewedBy === "string" && !/^[0-9a-f]{24}$/i.test(matchedResp.biwReview.reviewedBy)
        ? matchedResp.biwReview.reviewedBy
        : "") ||
      "";

    let biwStatus = "";
    if (matchedResp?.status === "Rework Accepted" || matchedResp?.status === "Rework Completed") {
      biwStatus = "Accepted";
    } else if (matchedResp?.biwReview?.status) {
      const st = String(matchedResp.biwReview.status).toLowerCase();
      if (st.includes("accept")) biwStatus = "Accepted";
      else if (st.includes("reject")) biwStatus = "Rejected";
      else if (st.includes("rework")) biwStatus = "Rework";
    }

    const biwReason =
      matchedResp?.biwReview?.reason ||
      matchedResp?.biwReview?.flaggedQuestions?.[0]?.questionText ||
      "";
    const biwRemark = matchedResp?.biwReview?.remark || "";
    const biwFileUrl = matchedResp?.biwReview?.evidenceUrl || "";

    const tvsRev = matchedResp?.review || null;
    let tvsStatus = "";
    const rawTvsOpt = tvsRev?.reviewOption || tvsRev?.status || "";
    if (prefillTvsAccepted) {
      tvsStatus = "Accepted";
    } else if (matchedResp?.status === "Rework Accepted" || matchedResp?.status === "Rework Completed") {
      tvsStatus = rawTvsOpt && String(rawTvsOpt).toLowerCase().includes("reject") ? "Rejected" : "Accepted";
    } else if (rawTvsOpt) {
      const st = String(rawTvsOpt).toLowerCase();
      if (st.includes("accept")) tvsStatus = "Accepted";
      else if (st.includes("reject")) tvsStatus = "Rejected";
      else if (st.includes("rework") || st.includes("defect")) tvsStatus = "Rework";
    }
    const tvsReason = prefillTvsAccepted
      ? ""
      : (tvsRev?.reason ||
         (Array.isArray(tvsRev?.flaggedQuestions) && tvsRev.flaggedQuestions.length > 0
           ? tvsRev.flaggedQuestions.map((fq: any) => fq?.questionText || fq?.text).filter(Boolean).join(", ")
           : "") ||
         "");
    const tvsRemark = prefillTvsAccepted ? "" : (tvsRev?.remark || tvsRev?.message || "");
    const tvsFileUrl = prefillTvsAccepted ? "" : (tvsRev?.evidenceUrl || "");

    const row = [
      ch,                 // Col 1 (A): Chassis Number
      dateVal,            // Col 2 (B): Date
      assignedTenantVal,  // Col 3 (C): Assigned Tenant (pre-filled from performance table / response / chassis assignments)
      reviewerVal,        // Col 4 (D): Reviewed By (pre-loaded if already reviewed, else dropdown selectable)
      biwStatus,          // Col 5 (E): BIW Feed back (pre-loaded if already reviewed)
      biwReason,          // Col 6 (F): BIW Reason
      biwRemark,          // Col 7 (G): BIW Remark
      biwFileUrl,         // Col 8 (H): BIW File URL
      tvsStatus,          // Col 9 (I): TVS Feed back
      tvsReason,          // Col 10 (J): TVS Reason (Rework and Rejected Reason)
      tvsRemark,          // Col 11 (K): TVS Remark
      tvsFileUrl          // Col 12 (L): TVS File URL
    ];

    if (hasTargetTenant) {
      let targetTvsStatus = prefillTvsAccepted ? "Accepted" : "";
      let targetTvsReason = "";
      let targetTvsRemark = "";
      let targetTvsFileUrl = "";

      if (!prefillTvsAccepted) {
        const normChUpper = ch.toUpperCase();
        const normChStripped = normChUpper.replace(/\s+/g, "");
        const childResp =
          matchedResp?.childResponse ||
          (childResponses &&
            (childResponses[ch] ||
              childResponses[normChUpper] ||
              childResponses[normChStripped])) ||
          null;

        const childRev =
          childResp?.review ||
          matchedResp?.childReview ||
          matchedResp?.followUpStatus?.childReview ||
          null;

        const rawTargetTvsOpt = childRev?.reviewOption || childRev?.status || "";
        if (rawTargetTvsOpt) {
          const st = String(rawTargetTvsOpt).toLowerCase();
          if (st.includes("accept")) targetTvsStatus = "Accepted";
          else if (st.includes("reject")) targetTvsStatus = "Rejected";
          else if (st.includes("rework") || st.includes("defect")) targetTvsStatus = "Rework";
        }
        if (childRev) {
          targetTvsReason =
            childRev.reason ||
            (Array.isArray(childRev.flaggedQuestions) && childRev.flaggedQuestions.length > 0
              ? childRev.flaggedQuestions.map((fq: any) => fq?.questionText || fq?.text).filter(Boolean).join(", ")
              : "") ||
            "";
          targetTvsRemark = childRev.remark || childRev.message || "";
          targetTvsFileUrl = childRev.evidenceUrl || "";
        }
      }

      row.push(
        targetTvsStatus,   // Col 11 (K): TVS Feed back (Target Tenant)
        targetTvsReason,   // Col 12 (L): Rework and Rejected Reason
        targetTvsRemark,   // Col 13 (M): Remark
        targetTvsFileUrl   // Col 14 (N): File Upload
      );
    }

    mainSheetData.push(row);
  }

  const mainWs = XLSX_STYLE.utils.aoa_to_sheet(mainSheetData);

  // Column widths
  const colWidths = [
    { wch: 20 }, // Chassis Number (Col A)
    { wch: 16 }, // Date (Col B)
    { wch: 20 }, // Assigned Tenant (Col C)
    { wch: 26 }, // Reviewed By (Col D)
    { wch: 34 }, // BIW Feed back(Accept,Rework,Reject) (Col E)
    { wch: 36 }, // Rework and Rejected Resion (Rust..) (Col F)
    { wch: 24 }, // Remark (Col G)
    { wch: 22 }, // File Upload (Col H)
    { wch: 38 }, // TVS Feed back (1st Main Form) (Col I)
    { wch: 36 }, // Rework and Rejected Resion (Rust..) (Col J)
    { wch: 24 }, // Remark (Col K)
    { wch: 22 }  // File Upload (Col L)
  ];

  if (hasTargetTenant) {
    colWidths.push(
      { wch: 38 }, // TVS Feed back (2nd Target Tenant) (Col M)
      { wch: 36 }, // Rework and Rejected Resion (Col N)
      { wch: 24 }, // Remark (Col O)
      { wch: 22 }  // File Upload (Col P)
    );
  }

  mainWs["!cols"] = colWidths;

  // Header Styles
  const endCol = hasTargetTenant ? 15 : 11;
  const range = XLSX.utils.decode_range(mainWs["!ref"] || (hasTargetTenant ? "A1:P1" : "A1:L1"));

  for (let c = range.s.c; c <= range.e.c; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c });
    if (!mainWs[cellRef]) continue;

    let fillBg = "1E293B"; // Dark slate (Chassis Number, Date, Assigned Tenant)
    if (c === 3) {
      fillBg = "1E3A8A"; // Reviewed By (Navy Blue)
    } else if (c >= 4 && c <= 7) {
      fillBg = "1E40AF"; // BIW Royal Blue
    } else if (c >= 8 && c <= 11) {
      fillBg = "065F46"; // TVS Emerald Green
    } else if (c >= 12 && c <= 15) {
      fillBg = "0F766E"; // Target Tenant Deep Teal
    }

    mainWs[cellRef].s = {
      fill: { fgColor: { rgb: fillBg } },
      font: { name: "Calibri", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
      alignment: { vertical: "center", horizontal: "center", wrapText: true },
      border: {
        top: { style: "thin", color: { rgb: "CBD5E1" } },
        bottom: { style: "medium", color: { rgb: "0F172A" } },
        left: { style: "thin", color: { rgb: "CBD5E1" } },
        right: { style: "thin", color: { rgb: "CBD5E1" } }
      }
    };
  }

  // Style data cells
  for (let r = 1; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      if (!mainWs[cellRef]) {
        mainWs[cellRef] = { t: "s", v: "" };
      }
      const isAlt = r % 2 === 1;
      mainWs[cellRef].s = {
        fill: { fgColor: { rgb: isAlt ? "F8FAFC" : "FFFFFF" } },
        font: { name: "Calibri", sz: 10, color: { rgb: "1E293B" } },
        alignment: {
          vertical: "center",
          horizontal: c === 0 || c === 1 || c === 2 || c === 4 || c === 8 || c === 12 ? "center" : "left"
        },
        border: {
          top: { style: "thin", color: { rgb: "E2E8F0" } },
          bottom: { style: "thin", color: { rgb: "E2E8F0" } },
          left: { style: "thin", color: { rgb: "E2E8F0" } },
          right: { style: "thin", color: { rgb: "E2E8F0" } }
        }
      };
    }
  }

  // 2. Prepare Lookups Sheet
  const maxLookupRows = Math.max(
    statusOptions.length,
    defectOptions.length,
    targetDefectOptions.length,
    finalReviewerOptions.length,
    finalTenantOptions.length
  );
  const lookupSheetData: any[][] = [
    ["Status Options", "Defect Checkpoints / Reasons", "Target Tenant Defects", "Reviewer Options", "Tenant Options"]
  ];

  for (let i = 0; i < maxLookupRows; i++) {
    lookupSheetData.push([
      statusOptions[i] || "",
      defectOptions[i] || "",
      targetDefectOptions[i] || "",
      finalReviewerOptions[i] || "",
      finalTenantOptions[i] || ""
    ]);
  }

  const lookupWs = XLSX_STYLE.utils.aoa_to_sheet(lookupSheetData);
  lookupWs["!cols"] = [{ wch: 20 }, { wch: 50 }, { wch: 50 }, { wch: 30 }, { wch: 25 }];

  // 3. Build Initial Workbook
  const wb = XLSX_STYLE.utils.book_new();
  XLSX_STYLE.utils.book_append_sheet(wb, mainWs, "BIW template");
  XLSX_STYLE.utils.book_append_sheet(wb, lookupWs, "Lookups");

  const cleanTitle = (formTitle || "Inspection").replace(/[^a-zA-Z0-9_-]/g, "_");
  const actualFilename = filename || `BIW template - ${cleanTitle}.xlsx`;

  // 4. Generate array buffer and inject native OpenXML dataValidations via JSZip
  const initialBuf = XLSX_STYLE.write(wb, { type: "array", bookType: "xlsx" });
  const zip = await JSZip.loadAsync(initialBuf);

  // 4a. Add Defined Names for StatusList, DefectList, TargetDefectList, ReviewerList & TenantList in workbook.xml
  let wbXml = await zip.file("xl/workbook.xml")?.async("text");
  if (wbXml) {
    const defectLastRow = defectOptions.length + 1;
    const targetDefectLastRow = targetDefectOptions.length + 1;
    const reviewerLastRow = finalReviewerOptions.length + 1;
    const tenantLastRow = finalTenantOptions.length + 1;

    let definedNamesInner =
      `<definedName name="StatusList">Lookups!$A$2:$A$4</definedName>` +
      `<definedName name="DefectList">Lookups!$B$2:$B$${defectLastRow}</definedName>`;

    if (hasTargetTenant && targetDefectOptions.length > 0) {
      definedNamesInner += `<definedName name="TargetDefectList">Lookups!$C$2:$C$${targetDefectLastRow}</definedName>`;
    }
    if (finalReviewerOptions.length > 0) {
      definedNamesInner += `<definedName name="ReviewerList">Lookups!$D$2:$D$${reviewerLastRow}</definedName>`;
    }
    if (finalTenantOptions.length > 0) {
      definedNamesInner += `<definedName name="TenantList">Lookups!$E$2:$E$${tenantLastRow}</definedName>`;
    }

    if (wbXml.includes("<definedNames>")) {
      wbXml = wbXml.replace("</definedNames>", `${definedNamesInner}</definedNames>`);
    } else {
      wbXml = wbXml.replace("</sheets>", `</sheets><definedNames>${definedNamesInner}</definedNames>`);
    }
    zip.file("xl/workbook.xml", wbXml);
  }

  // 4b. Add autoFilter + dataValidations in sheet1.xml (autoFilter after </sheetData>, dataValidations before <ignoredErrors or </worksheet>)
  let sheet1Xml = await zip.file("xl/worksheets/sheet1.xml")?.async("text");
  if (sheet1Xml) {
    const lastColLetter = hasTargetTenant ? "P" : "L";
    const lastRowNum = Math.max(2, mainSheetData.length);
    if (!sheet1Xml.includes("<autoFilter")) {
      sheet1Xml = sheet1Xml.replace(
        "</sheetData>",
        `</sheetData><autoFilter ref="A1:${lastColLetter}${lastRowNum}"/>`
      );
    }

    let dataValidationsXml = "";
    if (hasTargetTenant && targetDefectOptions.length > 0) {
      dataValidationsXml =
        `<dataValidations count="8">` +
        `<dataValidation sqref="C2:C10000" allowBlank="1" type="list"><formula1>TenantList</formula1></dataValidation>` +
        `<dataValidation sqref="D2:D10000" allowBlank="1" type="list"><formula1>ReviewerList</formula1></dataValidation>` +
        `<dataValidation sqref="E2:E10000" allowBlank="1" type="list"><formula1>StatusList</formula1></dataValidation>` +
        `<dataValidation sqref="F2:F10000" allowBlank="1" type="list"><formula1>DefectList</formula1></dataValidation>` +
        `<dataValidation sqref="I2:I10000" allowBlank="1" type="list"><formula1>StatusList</formula1></dataValidation>` +
        `<dataValidation sqref="J2:J10000" allowBlank="1" type="list"><formula1>DefectList</formula1></dataValidation>` +
        `<dataValidation sqref="M2:M10000" allowBlank="1" type="list"><formula1>StatusList</formula1></dataValidation>` +
        `<dataValidation sqref="N2:N10000" allowBlank="1" type="list"><formula1>TargetDefectList</formula1></dataValidation>` +
        `</dataValidations>`;
    } else {
      dataValidationsXml =
        `<dataValidations count="6">` +
        `<dataValidation sqref="C2:C10000" allowBlank="1" type="list"><formula1>TenantList</formula1></dataValidation>` +
        `<dataValidation sqref="D2:D10000" allowBlank="1" type="list"><formula1>ReviewerList</formula1></dataValidation>` +
        `<dataValidation sqref="E2:E10000" allowBlank="1" type="list"><formula1>StatusList</formula1></dataValidation>` +
        `<dataValidation sqref="F2:F10000" allowBlank="1" type="list"><formula1>DefectList</formula1></dataValidation>` +
        `<dataValidation sqref="I2:I10000" allowBlank="1" type="list"><formula1>StatusList</formula1></dataValidation>` +
        `<dataValidation sqref="J2:J10000" allowBlank="1" type="list"><formula1>DefectList</formula1></dataValidation>` +
        `</dataValidations>`;
    }

    let insertPos = sheet1Xml.indexOf("<ignoredErrors");
    if (insertPos === -1) insertPos = sheet1Xml.indexOf("<pageMargins");
    if (insertPos === -1) insertPos = sheet1Xml.indexOf("</worksheet>");

    sheet1Xml = sheet1Xml.slice(0, insertPos) + dataValidationsXml + sheet1Xml.slice(insertPos);
    zip.file("xl/worksheets/sheet1.xml", sheet1Xml);
  }

  // 5. Generate final Blob with dataValidations and trigger browser download
  const finalBlob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    compression: "DEFLATE",
    compressionOptions: { level: 2 }
  });

  const url = URL.createObjectURL(finalBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = actualFilename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    try {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (_) {}
  }, 10000);
}

/**
 * Parses an uploaded Excel sheet into normalized BIW review records.
 * Uses index-based cell extraction to safely handle repeated header column names.
 * Supports both new format (Date, Submitted By, Chassis in Col C) and legacy (Chassis in Col A).
 */
export async function parseBiwReviewWorkbook(
  file: File,
  expectedFormTitles?: string[]
): Promise<BiwExcelRow[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });

  const firstSheetName = wb.SheetNames[0];
  const ws = wb.Sheets[firstSheetName];
  if (!ws) {
    throw new Error("Excel sheet is empty or invalid");
  }

  const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
  const rows: BiwExcelRow[] = [];

  // Determine starting row: find row containing chassis/vin/che/cha/id/date
  let headerRowIndex = 0;
  for (let r = range.s.r; r <= Math.min(range.e.r, 5); r++) {
    const rowValues = [];
    for (let c = range.s.c; c <= Math.min(range.e.c, 6); c++) {
      const v = String(ws[XLSX.utils.encode_cell({ r, c })]?.v || "").trim().toLowerCase();
      if (v) rowValues.push(v);
    }
    const rowStr = rowValues.join(" ");
    if (
      rowStr.includes("chassis") ||
      rowStr.includes("biw") ||
      rowStr.includes("date") ||
      rowStr.includes("vin") ||
      rowStr.includes("identification")
    ) {
      headerRowIndex = r;
      break;
    }
  }

  // Inspect headers to detect columns dynamically
  let dateCol = -1;
  let assignedTenantCol = -1;
  let submittedByCol = -1;
  let chassisCol = -1;
  let biwFeedbackCol = -1;
  let biwReasonCol = -1;
  let biwRemarkCol = -1;
  let biwFileUrlCol = -1;
  let tvsFeedbackCol = -1;
  let tvsReasonCol = -1;
  let tvsRemarkCol = -1;
  let tvsFileUrlCol = -1;
  let targetTvsFeedbackCol = -1;
  let targetTvsReasonCol = -1;
  let targetTvsRemarkCol = -1;
  let targetTvsFileUrlCol = -1;

  for (let c = range.s.c; c <= range.e.c; c++) {
    const rawVal = ws[XLSX.utils.encode_cell({ r: headerRowIndex, c })]?.v;
    const txt = String(rawVal || "").trim().toLowerCase();
    if (!txt) continue;

    if (txt.includes("date") && dateCol === -1) {
      dateCol = c;
    } else if ((txt.includes("tenant") || txt.includes("plant") || txt.includes("assigned")) && assignedTenantCol === -1) {
      assignedTenantCol = c;
    } else if (
      (txt.includes("reviewed by") ||
        txt.includes("reviewer") ||
        txt.includes("submit") ||
        txt.includes("inspector") ||
        txt.includes("worker") ||
        (txt.includes("review") && !txt.includes("feed") && !txt.includes("status") && !txt.includes("section"))) &&
      submittedByCol === -1
    ) {
      submittedByCol = c;
    } else if ((txt.includes("chassis") || txt.includes("vin") || txt.includes("identification")) && chassisCol === -1) {
      chassisCol = c;
    } else if (txt.includes("biw") && (txt.includes("feed") || txt.includes("status") || txt.includes("accept") || txt.includes("back")) && biwFeedbackCol === -1) {
      biwFeedbackCol = c;
    } else if (biwFeedbackCol !== -1 && biwReasonCol === -1 && (txt.includes("rework") || txt.includes("resion") || txt.includes("reason") || txt.includes("defect")) && !txt.includes("tvs") && !txt.includes("1st") && !txt.includes("2nd")) {
      biwReasonCol = c;
    } else if (biwFeedbackCol !== -1 && biwRemarkCol === -1 && txt.includes("remark") && !txt.includes("tvs") && !txt.includes("1st") && !txt.includes("2nd")) {
      biwRemarkCol = c;
    } else if (biwFeedbackCol !== -1 && biwFileUrlCol === -1 && (txt.includes("file") || txt.includes("upload") || txt.includes("url")) && !txt.includes("tvs") && !txt.includes("1st") && !txt.includes("2nd")) {
      biwFileUrlCol = c;
    } else if ((txt.includes("tvs") || txt.includes("1st")) && (txt.includes("feed") || txt.includes("back") || txt.includes("status")) && tvsFeedbackCol === -1) {
      tvsFeedbackCol = c;
    } else if (tvsFeedbackCol !== -1 && tvsReasonCol === -1 && (txt.includes("rework") || txt.includes("resion") || txt.includes("reason") || txt.includes("defect")) && !txt.includes("2nd") && !txt.includes("target")) {
      tvsReasonCol = c;
    } else if (tvsFeedbackCol !== -1 && tvsRemarkCol === -1 && txt.includes("remark") && !txt.includes("2nd") && !txt.includes("target")) {
      tvsRemarkCol = c;
    } else if (tvsFeedbackCol !== -1 && tvsFileUrlCol === -1 && (txt.includes("file") || txt.includes("upload") || txt.includes("url")) && !txt.includes("2nd") && !txt.includes("target")) {
      tvsFileUrlCol = c;
    } else if ((txt.includes("2nd") || txt.includes("target")) && (txt.includes("feed") || txt.includes("back") || txt.includes("status")) && targetTvsFeedbackCol === -1) {
      targetTvsFeedbackCol = c;
    } else if (targetTvsFeedbackCol !== -1 && targetTvsReasonCol === -1 && (txt.includes("rework") || txt.includes("resion") || txt.includes("reason") || txt.includes("defect"))) {
      targetTvsReasonCol = c;
    } else if (targetTvsFeedbackCol !== -1 && targetTvsRemarkCol === -1 && txt.includes("remark")) {
      targetTvsRemarkCol = c;
    } else if (targetTvsFeedbackCol !== -1 && targetTvsFileUrlCol === -1 && (txt.includes("file") || txt.includes("upload") || txt.includes("url"))) {
      targetTvsFileUrlCol = c;
    }
  }

  // Validate required template columns (reject unrelated/invalid Excel files)
  if (chassisCol === -1 || (biwFeedbackCol === -1 && tvsFeedbackCol === -1)) {
    throw new Error(
      "Invalid Excel file: Missing required BIW Review Template columns (Chassis Number and BIW/TVS Feedback). Please upload a valid BIW Review Excel template."
    );
  }

  // Validate that the uploaded BIW template belongs to the current form (or its linked child/parent form)
  if (expectedFormTitles && expectedFormTitles.length > 0) {
    const normalizeTitle = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const expectedNorms = expectedFormTitles.map(normalizeTitle).filter(Boolean);
    const detectedTitles: string[] = [];

    [tvsFeedbackCol, targetTvsFeedbackCol].forEach((colIdx) => {
      if (colIdx === -1) return;
      const rawH = String(ws[XLSX.utils.encode_cell({ r: headerRowIndex, c: colIdx })]?.v || "").trim();
      const parenMatch = rawH.match(/\(([^)]+)\)/);
      if (parenMatch && parenMatch[1]) {
        let inner = parenMatch[1].trim();
        inner = inner.replace(/^(1st:|2nd:)\s*/i, "");
        if (inner.includes("|")) {
          inner = inner.split("|")[0].trim();
        }
        if (inner && !/^(accept|rework|reject|status)/i.test(inner)) {
          detectedTitles.push(inner);
        }
      }
    });

    if (detectedTitles.length > 0 && expectedNorms.length > 0) {
      const hasMatch = detectedTitles.some((dt) => {
        const dtNorm = normalizeTitle(dt);
        return expectedNorms.some((en) => en === dtNorm || en.includes(dtNorm) || dtNorm.includes(en));
      });
      if (!hasMatch) {
        throw new Error(
          `Invalid Excel template for this form: This Excel file was generated for "${detectedTitles[0]}", not "${expectedFormTitles[0]}". Please upload the BIW template downloaded for this form.`
        );
      }
    }
  }

  // Fallback defaults if header matching didn't catch specific positions:
  const is12Col = chassisCol === 0 && (dateCol === 1 || assignedTenantCol === 2 || submittedByCol === 3);
  const is3ColDate = !is12Col && (dateCol !== -1 || chassisCol === 2);
  const is2ColReviewer = !is12Col && !is3ColDate && (submittedByCol === 1 || (chassisCol === 0 && range.e.c >= 9));

  if (is12Col) {
    // 12-col layout: Col 0: Chassis, Col 1: Date, Col 2: Assigned Tenant, Col 3: Reviewed By, Col 4: BIW FB, Col 5: Reason, Col 6: Remark, Col 7: File, Col 8: TVS FB, Col 9: Reason, Col 10: Remark, Col 11: File
    if (chassisCol === -1) chassisCol = 0;
    if (dateCol === -1) dateCol = 1;
    if (assignedTenantCol === -1) assignedTenantCol = 2;
    if (submittedByCol === -1) submittedByCol = 3;
    if (biwFeedbackCol === -1) biwFeedbackCol = 4;
    if (biwReasonCol === -1) biwReasonCol = 5;
    if (biwRemarkCol === -1) biwRemarkCol = 6;
    if (biwFileUrlCol === -1) biwFileUrlCol = 7;
    if (tvsFeedbackCol === -1) tvsFeedbackCol = 8;
    if (tvsReasonCol === -1) tvsReasonCol = 9;
    if (tvsRemarkCol === -1) tvsRemarkCol = 10;
    if (tvsFileUrlCol === -1) tvsFileUrlCol = 11;
    if (targetTvsFeedbackCol === -1 && range.e.c >= 12) targetTvsFeedbackCol = 12;
    if (targetTvsReasonCol === -1 && range.e.c >= 13) targetTvsReasonCol = 13;
    if (targetTvsRemarkCol === -1 && range.e.c >= 14) targetTvsRemarkCol = 14;
    if (targetTvsFileUrlCol === -1 && range.e.c >= 15) targetTvsFileUrlCol = 15;
  } else if (is3ColDate) {
    if (dateCol === -1) dateCol = 0;
    if (submittedByCol === -1) submittedByCol = 1;
    if (chassisCol === -1) chassisCol = 2;
    if (biwFeedbackCol === -1) biwFeedbackCol = 3;
    if (biwReasonCol === -1) biwReasonCol = 4;
    if (biwRemarkCol === -1) biwRemarkCol = 5;
    if (biwFileUrlCol === -1) biwFileUrlCol = 6;
    if (tvsFeedbackCol === -1) tvsFeedbackCol = 7;
    if (tvsReasonCol === -1) tvsReasonCol = 8;
    if (tvsRemarkCol === -1) tvsRemarkCol = 9;
    if (tvsFileUrlCol === -1) tvsFileUrlCol = 10;
    if (targetTvsFeedbackCol === -1 && range.e.c >= 11) targetTvsFeedbackCol = 11;
    if (targetTvsReasonCol === -1 && range.e.c >= 12) targetTvsReasonCol = 12;
    if (targetTvsRemarkCol === -1 && range.e.c >= 13) targetTvsRemarkCol = 13;
    if (targetTvsFileUrlCol === -1 && range.e.c >= 14) targetTvsFileUrlCol = 14;
  } else if (is2ColReviewer) {
    // Standard format: Col 0: Chassis, Col 1: Reviewed By, Col 2: BIW FB, Col 3: Reason, Col 4: Remark, Col 5: File, Col 6: TVS FB, Col 7: Reason, Col 8: Remark, Col 9: File
    if (chassisCol === -1) chassisCol = 0;
    if (submittedByCol === -1) submittedByCol = 1;
    if (biwFeedbackCol === -1) biwFeedbackCol = 2;
    if (biwReasonCol === -1) biwReasonCol = 3;
    if (biwRemarkCol === -1) biwRemarkCol = 4;
    if (biwFileUrlCol === -1) biwFileUrlCol = 5;
    if (tvsFeedbackCol === -1) tvsFeedbackCol = 6;
    if (tvsReasonCol === -1) tvsReasonCol = 7;
    if (tvsRemarkCol === -1) tvsRemarkCol = 8;
    if (tvsFileUrlCol === -1) tvsFileUrlCol = 9;
    if (targetTvsFeedbackCol === -1 && range.e.c >= 10) targetTvsFeedbackCol = 10;
    if (targetTvsReasonCol === -1 && range.e.c >= 11) targetTvsReasonCol = 11;
    if (targetTvsRemarkCol === -1 && range.e.c >= 12) targetTvsRemarkCol = 12;
    if (targetTvsFileUrlCol === -1 && range.e.c >= 13) targetTvsFileUrlCol = 13;
  } else {
    // Legacy template without Reviewed By
    if (chassisCol === -1) chassisCol = 0;
    if (biwFeedbackCol === -1) biwFeedbackCol = 1;
    if (biwReasonCol === -1) biwReasonCol = 2;
    if (biwRemarkCol === -1) biwRemarkCol = 3;
    if (biwFileUrlCol === -1) biwFileUrlCol = 4;
    if (tvsFeedbackCol === -1) tvsFeedbackCol = 5;
    if (tvsReasonCol === -1) tvsReasonCol = 6;
    if (tvsRemarkCol === -1) tvsRemarkCol = 7;
    if (tvsFileUrlCol === -1) tvsFileUrlCol = 8;
    if (targetTvsFeedbackCol === -1 && range.e.c >= 9) targetTvsFeedbackCol = 9;
    if (targetTvsReasonCol === -1 && range.e.c >= 10) targetTvsReasonCol = 10;
    if (targetTvsRemarkCol === -1 && range.e.c >= 11) targetTvsRemarkCol = 11;
    if (targetTvsFileUrlCol === -1 && range.e.c >= 12) targetTvsFileUrlCol = 12;
  }

  // Read data rows
  for (let r = headerRowIndex + 1; r <= range.e.r; r++) {
    const getVal = (c: number): string => {
      if (c < 0) return "";
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      return cell && cell.v !== undefined && cell.v !== null ? String(cell.v).trim() : "";
    };

    const chassis = getVal(chassisCol);
    // If the chassis number cell is completely blank, skip row
    if (!chassis) continue;

    const tvsReasonVal = getVal(tvsReasonCol);
    const targetTvsReasonVal = getVal(targetTvsReasonCol);
    const reviewerName = submittedByCol !== -1 ? getVal(submittedByCol) : "";

    const row: BiwExcelRow = {
      rowIndex: r + 1,
      date: dateCol !== -1 ? getVal(dateCol) : "",
      assignedTenant: assignedTenantCol !== -1 ? getVal(assignedTenantCol) : "",
      submittedBy: reviewerName,
      reviewedBy: reviewerName,
      workerName: reviewerName || undefined,
      chassisNumber: chassis,
      biwFeedback: getVal(biwFeedbackCol),
      biwReason: getVal(biwReasonCol),
      biwRemark: getVal(biwRemarkCol),
      biwFileUrl: getVal(biwFileUrlCol),
      tvsFeedback: getVal(tvsFeedbackCol),
      tvsReason: tvsReasonVal,
      tvsRejectReason: tvsReasonVal,
      tvsRemark: getVal(tvsRemarkCol),
      tvsFileUrl: getVal(tvsFileUrlCol),
      targetTvsFeedback: getVal(targetTvsFeedbackCol),
      targetTvsReason: targetTvsReasonVal,
      targetTvsRejectReason: targetTvsReasonVal,
      targetTvsRemark: getVal(targetTvsRemarkCol),
      targetTvsFileUrl: getVal(targetTvsFileUrlCol)
    };

    rows.push(row);
  }

  return rows;
}

/**
 * Generates email preview HTML and text representation for review submissions.
 */
export function generateBiwEmailSummaryHtml(options: {
  formTitle: string;
  rows: BiwExcelRow[];
  senderName?: string;
}): { html: string; text: string; subject: string } {
  const { formTitle, rows, senderName } = options;
  const accepted = rows.filter((r) => String(r.biwFeedback || r.tvsFeedback).toLowerCase().includes("accept")).length;
  const rework = rows.filter((r) => String(r.biwFeedback || r.tvsFeedback).toLowerCase().includes("rework")).length;
  const rejected = rows.filter((r) => String(r.biwFeedback || r.tvsFeedback).toLowerCase().includes("reject")).length;

  const subject = `[Quality Alert] BIW & TVS Review Summary: ${formTitle} (${rows.length} Chassis Units)`;

  const html = `
<div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 800px; margin: 0 auto; line-height: 1.5;">
  <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 20px; border-radius: 8px 8px 0 0; color: white;">
    <h2 style="margin: 0 0 6px 0; font-size: 20px;">BIW & Inspection Review Report</h2>
    <p style="margin: 0; opacity: 0.9; font-size: 13px;">Form: <b>${formTitle}</b> | Date: ${new Date().toLocaleDateString()}</p>
  </div>

  <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; background: #ffffff;">
    <div style="display: flex; gap: 12px; margin-bottom: 24px;">
      <div style="flex: 1; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px; border-radius: 8px; text-align: center;">
        <span style="display: block; font-size: 11px; font-weight: bold; color: #166534; text-transform: uppercase;">Accepted</span>
        <span style="font-size: 24px; font-weight: bold; color: #15803d;">${accepted}</span>
      </div>
      <div style="flex: 1; background: #fefce8; border: 1px solid #fef08a; padding: 12px; border-radius: 8px; text-align: center;">
        <span style="display: block; font-size: 11px; font-weight: bold; color: #854d0e; text-transform: uppercase;">Rework</span>
        <span style="font-size: 24px; font-weight: bold; color: #a16207;">${rework}</span>
      </div>
      <div style="flex: 1; background: #fef2f2; border: 1px solid #fecaca; padding: 12px; border-radius: 8px; text-align: center;">
        <span style="display: block; font-size: 11px; font-weight: bold; color: #991b1b; text-transform: uppercase;">Rejected</span>
        <span style="font-size: 24px; font-weight: bold; color: #b91c1c;">${rejected}</span>
      </div>
    </div>

    <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 16px;">
      <thead>
        <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0; text-align: left;">
          <th style="padding: 10px 12px; color: #475569;">Chassis Number</th>
          <th style="padding: 10px 12px; color: #475569;">BIW Feedback</th>
          <th style="padding: 10px 12px; color: #475569;">Defect Reason</th>
          <th style="padding: 10px 12px; color: #475569;">Remark</th>
          <th style="padding: 10px 12px; color: #475569;">TVS Feedback</th>
        </tr>
      </thead>
      <tbody>
        ${rows
      .map(
        (r, i) => `
          <tr style="border-bottom: 1px solid #e2e8f0; background: ${i % 2 === 0 ? "#ffffff" : "#f8fafc"};">
            <td style="padding: 10px 12px; font-weight: bold; color: #0f172a;">${r.chassisNumber}</td>
            <td style="padding: 10px 12px;">
              <span style="padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 11px; background: ${String(r.biwFeedback).toLowerCase().includes("accept")
            ? "#dcfce7; color: #166534;"
            : String(r.biwFeedback).toLowerCase().includes("rework")
              ? "#fef9c3; color: #854d0e;"
              : "#fee2e2; color: #991b1b;"
          }">
                ${r.biwFeedback || "—"}
              </span>
            </td>
            <td style="padding: 10px 12px; color: #475569;">${r.biwReason || "—"}</td>
            <td style="padding: 10px 12px; color: #64748b;">${r.biwRemark || "—"}</td>
            <td style="padding: 10px 12px; color: #475569;">${r.tvsFeedback || "—"}</td>
          </tr>`
      )
      .join("")}
      </tbody>
    </table>

    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: right;">
      Generated via Focus 3rd Eye BIW Review System ${senderName ? `by ${senderName}` : ""}
    </div>
  </div>
</div>
`;

  const text = `
BIW & TVS REVIEW SUMMARY
Form: ${formTitle}
Date: ${new Date().toLocaleDateString()}
Total Units: ${rows.length} | Accepted: ${accepted} | Rework: ${rework} | Rejected: ${rejected}

CHASSIS UNIT DETAILS:
----------------------------------------------------------------------------------------------------
${rows
      .map(
        (r) =>
          `• ${r.chassisNumber} | BIW: ${r.biwFeedback || "N/A"} | Defect: ${r.biwReason || "None"} | Remark: ${r.biwRemark || "None"} | TVS: ${r.tvsFeedback || "N/A"}`
      )
      .join("\n")}
----------------------------------------------------------------------------------------------------
`;

  return { html, text, subject };
}

export const TVS_REVIEW_COLUMNS = [
  "Chassis Number",
  "TVS Feed back (Accept,Rework,Reject)",
  "Rework and Rejected Resion (Rust..)",
  "Remark",
  "Target Questionnaire",
  "File Upload"
];

export interface TvsExcelRow {
  chassisNumber: string;
  tvsFeedback?: string;
  tvsReason?: string;
  tvsRemark?: string;
  targetFormTitle?: string;
  fileUrl?: string;
  rowIndex?: number;
  matched?: boolean;
}

/**
 * Generates and downloads the TVS Review Excel Template with targeted tenant checkpoints
 * and OpenXML dropdown data validation.
 */
export async function downloadTvsReviewTemplate(options: {
  targetForm?: Form | any;
  targetFormTitle?: string;
  targetTenantName?: string;
  isChildForm?: boolean;
  chassisNumbers?: string[];
  responses?: any[];
  filename?: string;
  prefillTvsAccepted?: boolean;
}) {
  const {
    targetForm,
    targetFormTitle = "Inspection",
    targetTenantName,
    isChildForm,
    chassisNumbers = [],
    responses = [],
    filename,
    prefillTvsAccepted = false
  } = options;

  const defectOptions = extractFormDefectReasons(targetForm, responses);
  const statusOptions = ["Accepted", "Rejected", "Rework"];

  const mainSheetData: any[][] = [];
  mainSheetData.push(TVS_REVIEW_COLUMNS);

  const responseMap = new Map<string, any>();
  if (responses && Array.isArray(responses)) {
    responses.forEach((r) => {
      // 🔒 Dispatch Prerequisite: Only dispatched chassis can be included in TVS review template
      if (!r.isDispatched) return;
      const a = r.answers || {};
      const keys: string[] = [
        r.chassisNumber,
        (r as any).systemChassisNumber,
        a["Identification no"],
        a["identification no"],
        a["Identification No"],
        a["chassisNumber"],
        a["cha"],
        a["che"]
      ];
      Object.values(a).forEach((v) => {
        if (
          (typeof v === "string" || typeof v === "number") &&
          String(v).trim().length >= 1 &&
          String(v).trim().length <= 60
        ) {
          keys.push(String(v).trim());
        }
      });
      keys.filter(Boolean).forEach((k) => {
        const norm = String(k).trim().toUpperCase();
        if (!responseMap.has(norm)) {
          responseMap.set(norm, r);
        }
      });
    });
  }

  let validChassis = Array.from(
    new Set(
      chassisNumbers
        .map((c) => String(c || "").trim())
        .filter((c) => Boolean(c) && c.toUpperCase() !== "TVS" && c !== "Excel Import")
    )
  );

  if (validChassis.length === 0 && responseMap.size > 0) {
    validChassis = Array.from(responseMap.keys()).filter(
      (k) => k.toUpperCase() !== "TVS" && k !== "EXCEL IMPORT"
    );
  }

  const rowsCount = Math.max(validChassis.length, 30);
  const targetLabel = targetTenantName ? `${targetFormTitle} (${targetTenantName})` : targetFormTitle;

  for (let i = 0; i < rowsCount; i++) {
    const ch = validChassis[i] || "";
    const matchedResp = ch ? responseMap.get(ch.toUpperCase()) : null;

    let tvsStatus = "";
    if (prefillTvsAccepted) {
      tvsStatus = "Accepted";
    } else if (matchedResp?.review?.reviewOption) {
      const st = String(matchedResp.review.reviewOption).toLowerCase();
      if (st.includes("accept")) tvsStatus = "Accepted";
      else if (st.includes("reject")) tvsStatus = "Rejected";
      else if (st.includes("rework")) tvsStatus = "Rework";
    }
    const tvsReason = prefillTvsAccepted ? "" : (matchedResp?.review?.reason || "");
    const tvsRemark = prefillTvsAccepted ? "" : (matchedResp?.review?.remark || matchedResp?.review?.message || "");
    const tvsFileUrl = prefillTvsAccepted ? "" : (matchedResp?.review?.evidenceUrl || "");

    mainSheetData.push([
      ch,          // Col 1: Chassis Number
      tvsStatus,   // Col 2: TVS Feed back
      tvsReason,   // Col 3: Defect Reason (Targeted Checkpoints)
      tvsRemark,   // Col 4: Remark
      targetLabel, // Col 5: Target Questionnaire
      tvsFileUrl   // Col 6: File Upload
    ]);
  }

  const mainWs = XLSX_STYLE.utils.aoa_to_sheet(mainSheetData);

  mainWs["!cols"] = [
    { wch: 22 }, // Chassis Number
    { wch: 32 }, // TVS Feed back
    { wch: 42 }, // Defect Reason (Checkpoints)
    { wch: 32 }, // Remark
    { wch: 36 }, // Target Questionnaire
    { wch: 24 }  // File Upload
  ];

  // Header styles: TVS Emerald / Indigo / Purple Theme
  const range = XLSX.utils.decode_range(mainWs["!ref"] || "A1:F1");
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c });
    if (!mainWs[cellRef]) continue;

    let fillBg = "1E293B"; // Dark slate
    if (c === 1) fillBg = "065F46"; // TVS Emerald Green
    else if (c === 2) fillBg = "0D9488"; // Teal Checkpoints
    else if (c === 3) fillBg = "4338CA"; // Indigo Remark
    else if (c === 4) fillBg = "7E22CE"; // Purple Target Questionnaire
    else if (c === 5) fillBg = "334155"; // Slate File

    mainWs[cellRef].s = {
      fill: { fgColor: { rgb: fillBg } },
      font: { name: "Calibri", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
      alignment: { vertical: "center", horizontal: "center", wrapText: true },
      border: {
        top: { style: "thin", color: { rgb: "CBD5E1" } },
        bottom: { style: "medium", color: { rgb: "0F172A" } },
        left: { style: "thin", color: { rgb: "CBD5E1" } },
        right: { style: "thin", color: { rgb: "CBD5E1" } }
      }
    };
  }

  // Style data cells
  for (let r = 1; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      if (!mainWs[cellRef]) {
        mainWs[cellRef] = { t: "s", v: "" };
      }
      const isAlt = r % 2 === 1;
      mainWs[cellRef].s = {
        fill: { fgColor: { rgb: isAlt ? "F8FAFC" : "FFFFFF" } },
        font: { name: "Calibri", sz: 10, color: { rgb: "1E293B" } },
        alignment: {
          vertical: "center",
          horizontal: c === 0 || c === 1 ? "center" : "left"
        },
        border: {
          top: { style: "thin", color: { rgb: "E2E8F0" } },
          bottom: { style: "thin", color: { rgb: "E2E8F0" } },
          left: { style: "thin", color: { rgb: "E2E8F0" } },
          right: { style: "thin", color: { rgb: "E2E8F0" } }
        }
      };
    }
  }

  // Lookups sheet
  const lookupRows: any[][] = [["Review Decisions", "Defect Reasons (Checkpoints)"]];
  const maxLookups = Math.max(statusOptions.length, defectOptions.length);
  for (let i = 0; i < maxLookups; i++) {
    lookupRows.push([statusOptions[i] || "", defectOptions[i] || ""]);
  }

  const lookupWs = XLSX_STYLE.utils.aoa_to_sheet(lookupRows);
  lookupWs["!cols"] = [{ wch: 22 }, { wch: 50 }];

  const wb = XLSX_STYLE.utils.book_new();
  XLSX_STYLE.utils.book_append_sheet(wb, mainWs, "TVS Reviews");
  XLSX_STYLE.utils.book_append_sheet(wb, lookupWs, "Lookups");

  const initialBuf = XLSX_STYLE.write(wb, {
    bookType: "xlsx",
    type: "array",
    bookSST: false
  });

  const zip = await JSZip.loadAsync(initialBuf);

  // Define Names
  let wbXml = await zip.file("xl/workbook.xml")?.async("text");
  if (wbXml) {
    const defectLastRow = defectOptions.length + 1;
    const definedNamesXml =
      `<definedNames>` +
      `<definedName name="TvsStatusList">Lookups!$A$2:$A$4</definedName>` +
      `<definedName name="TvsDefectList">Lookups!$B$2:$B$${defectLastRow}</definedName>` +
      `</definedNames>`;

    if (wbXml.includes("<definedNames>")) {
      wbXml = wbXml.replace("</definedNames>", `<definedName name="TvsStatusList">Lookups!$A$2:$A$4</definedName><definedName name="TvsDefectList">Lookups!$B$2:$B$${defectLastRow}</definedName></definedNames>`);
    } else {
      wbXml = wbXml.replace("</sheets>", `</sheets>${definedNamesXml}`);
    }
    zip.file("xl/workbook.xml", wbXml);
  }

  // autoFilter + dataValidations in sheet1.xml: Column B (Status), Column C (Defects)
  let sheet1Xml = await zip.file("xl/worksheets/sheet1.xml")?.async("text");
  if (sheet1Xml) {
    const lastRowNum = Math.max(2, mainSheetData.length);
    if (!sheet1Xml.includes("<autoFilter")) {
      sheet1Xml = sheet1Xml.replace(
        "</sheetData>",
        `</sheetData><autoFilter ref="A1:F${lastRowNum}"/>`
      );
    }

    const dataValidationsXml =
      `<dataValidations count="2">` +
      `<dataValidation sqref="B2:B2000" allowBlank="1" type="list"><formula1>TvsStatusList</formula1></dataValidation>` +
      `<dataValidation sqref="C2:C2000" allowBlank="1" type="list"><formula1>TvsDefectList</formula1></dataValidation>` +
      `</dataValidations>`;

    let insertPos = sheet1Xml.indexOf("<ignoredErrors");
    if (insertPos === -1) insertPos = sheet1Xml.indexOf("<pageMargins");
    if (insertPos === -1) insertPos = sheet1Xml.indexOf("</worksheet>");

    sheet1Xml = sheet1Xml.slice(0, insertPos) + dataValidationsXml + sheet1Xml.slice(insertPos);
    zip.file("xl/worksheets/sheet1.xml", sheet1Xml);
  }

  const finalBlob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });

  const actualFilename =
    filename ||
    `TVS Review Template - ${targetLabel.replace(/[^a-zA-Z0-9_-]/g, "_")}.xlsx`;

  const url = URL.createObjectURL(finalBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = actualFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Parses an uploaded Excel sheet for TVS reviews.
 * Supports both dedicated 6-column TVS format and 10-column dual BIW+TVS format.
 */
export async function parseTvsReviewWorkbook(file: File): Promise<TvsExcelRow[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });

  const firstSheetName = wb.SheetNames[0];
  const ws = wb.Sheets[firstSheetName];
  if (!ws) {
    throw new Error("Excel sheet is empty or invalid");
  }

  const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
  const rows: TvsExcelRow[] = [];

  let headerRowIndex = 0;
  for (let r = range.s.r; r <= Math.min(range.e.r, 5); r++) {
    const rowValues = [];
    for (let c = range.s.c; c <= Math.min(range.e.c, 4); c++) {
      const v = String(ws[XLSX.utils.encode_cell({ r, c })]?.v || "").trim().toLowerCase();
      if (v) rowValues.push(v);
    }
    const rowStr = rowValues.join(" ");
    if (rowStr.includes("chassis") || rowStr.includes("tvs") || rowStr.includes("vin") || rowStr.includes("date") || rowStr.includes("id")) {
      headerRowIndex = r;
      break;
    }
  }

  let chassisCol = 0;
  for (let c = range.s.c; c <= Math.min(range.e.c, 4); c++) {
    const v = String(ws[XLSX.utils.encode_cell({ r: headerRowIndex, c })]?.v || "").toLowerCase();
    if (v.includes("chassis") || v.includes("vin") || v.includes("identification")) {
      chassisCol = c;
      break;
    }
  }

  const hCol1 = String(ws[XLSX.utils.encode_cell({ r: headerRowIndex, c: 1 })]?.v || "").toLowerCase();
  const hCol2 = String(ws[XLSX.utils.encode_cell({ r: headerRowIndex, c: 2 })]?.v || "").toLowerCase();
  const hCol3 = String(ws[XLSX.utils.encode_cell({ r: headerRowIndex, c: 3 })]?.v || "").toLowerCase();
  const hCol5 = String(ws[XLSX.utils.encode_cell({ r: headerRowIndex, c: 5 })]?.v || "").toLowerCase();
  const hCol7 = String(ws[XLSX.utils.encode_cell({ r: headerRowIndex, c: 7 })]?.v || "").toLowerCase();
  const isDedicatedTvs = chassisCol === 0 && (hCol1.includes("tvs") || (!hCol1.includes("biw") && !hCol5.includes("tvs") && !hCol1.includes("date")));

  for (let r = headerRowIndex + 1; r <= range.e.r; r++) {
    const getVal = (c: number): string => {
      if (c < 0) return "";
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      return cell && cell.v !== undefined && cell.v !== null ? String(cell.v).trim() : "";
    };

    const chassis = getVal(chassisCol);
    if (!chassis) continue;

    if (isDedicatedTvs) {
      // 6-col dedicated TVS format
      rows.push({
        rowIndex: r + 1,
        chassisNumber: chassis,
        tvsFeedback: getVal(1),
        tvsReason: getVal(2),
        tvsRemark: getVal(3),
        targetFormTitle: getVal(4),
        fileUrl: getVal(5)
      });
    } else if (chassisCol === 0 && (hCol1.includes("date") || hCol2.includes("tenant") || hCol2.includes("plant") || hCol3.includes("review"))) {
      // 12-col format with Chassis (0), Date (1), Assigned Tenant (2), Reviewed By (3)... TVS FB (8), TVS Reason (9), TVS Remark (10), TVS File (11)
      rows.push({
        rowIndex: r + 1,
        chassisNumber: chassis,
        tvsFeedback: getVal(8),
        tvsReason: getVal(9),
        tvsRemark: getVal(10),
        targetFormTitle: getVal(12),
        fileUrl: getVal(11)
      });
    } else if (chassisCol === 2) {
      // 11-col / 15-col format with Date (0), Submitted By (1), Chassis (2)
      rows.push({
        rowIndex: r + 1,
        chassisNumber: chassis,
        tvsFeedback: getVal(7) || getVal(3),
        tvsReason: getVal(8) || getVal(4),
        tvsRemark: getVal(9) || getVal(5),
        targetFormTitle: getVal(11),
        fileUrl: getVal(10) || getVal(6)
      });
    } else if (chassisCol === 0 && (hCol1.includes("review") || hCol1.includes("submit") || hCol1.includes("worker") || hCol1.includes("inspector"))) {
      // Standard format with Chassis (0), Reviewed By (1), BIW FB (2)... TVS FB (6), TVS Reason (7), TVS Remark (8), TVS File (9)
      rows.push({
        rowIndex: r + 1,
        chassisNumber: chassis,
        tvsFeedback: getVal(6),
        tvsReason: getVal(7),
        tvsRemark: getVal(8),
        targetFormTitle: getVal(10),
        fileUrl: getVal(9)
      });
    } else {
      // 10-col dual format
      rows.push({
        rowIndex: r + 1,
        chassisNumber: chassis,
        tvsFeedback: getVal(5) || getVal(1),
        tvsReason: getVal(6) || getVal(7) || getVal(2),
        tvsRemark: getVal(8) || getVal(3),
        targetFormTitle: getVal(4),
        fileUrl: getVal(9) || getVal(4)
      });
    }
  }

  return rows;
}

/**
 * Generates an executive summary HTML & plaintext email draft for TVS Reviews.
 */
export function generateTvsEmailSummaryHtml(options: {
  formTitle: string;
  targetTenant?: string;
  rows: TvsExcelRow[];
  senderName?: string;
}) {
  const { formTitle, targetTenant, rows, senderName } = options;

  let accepted = 0;
  let rework = 0;
  let rejected = 0;
  let pending = 0;

  rows.forEach((r) => {
    const fb = String(r.tvsFeedback || "").toLowerCase();
    if (fb.includes("accept")) accepted++;
    else if (fb.includes("rework")) rework++;
    else if (fb.includes("reject")) rejected++;
    else pending++;
  });

  const subject = `[Quality Alert] TVS Review Summary: ${formTitle}${targetTenant ? ` (${targetTenant})` : ""} (${rows.length} Chassis Units)`;

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #ffffff; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 12px;">
  <div style="border-bottom: 2px solid #6366f1; padding-bottom: 12px; margin-bottom: 20px;">
    <h2 style="margin: 0; color: #312e81; font-size: 20px;">TVS Quality Review Summary Report</h2>
    <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">
      Form: <strong>${formTitle}</strong> ${targetTenant ? `| Targeted Tenant: <strong>${targetTenant}</strong>` : ""} | Generated: ${new Date().toLocaleDateString()}
    </p>
  </div>

  <div style="display: flex; gap: 12px; margin-bottom: 24px;">
    <div style="flex: 1; padding: 14px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; text-align: center;">
      <div style="font-size: 22px; font-weight: bold; color: #166534;">${accepted}</div>
      <div style="font-size: 11px; font-weight: bold; color: #15803d; text-transform: uppercase;">Accepted</div>
    </div>
    <div style="flex: 1; padding: 14px; background: #fefce8; border: 1px solid #fef08a; border-radius: 8px; text-align: center;">
      <div style="font-size: 22px; font-weight: bold; color: #854d0e;">${rework}</div>
      <div style="font-size: 11px; font-weight: bold; color: #a16207; text-transform: uppercase;">Rework</div>
    </div>
    <div style="flex: 1; padding: 14px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; text-align: center;">
      <div style="font-size: 22px; font-weight: bold; color: #991b1b;">${rejected}</div>
      <div style="font-size: 11px; font-weight: bold; color: #b91c1c; text-transform: uppercase;">Rejected</div>
    </div>
  </div>

  <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 16px;">
    <thead>
      <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0; text-align: left;">
        <th style="padding: 10px 12px; color: #475569;">Chassis Number</th>
        <th style="padding: 10px 12px; color: #475569;">TVS Feedback</th>
        <th style="padding: 10px 12px; color: #475569;">Defect Checkpoint / Reason</th>
        <th style="padding: 10px 12px; color: #475569;">Remark</th>
        <th style="padding: 10px 12px; color: #475569;">Target Questionnaire</th>
      </tr>
    </thead>
    <tbody>
      ${rows
      .map(
        (r, i) => `
        <tr style="border-bottom: 1px solid #e2e8f0; background: ${i % 2 === 0 ? "#ffffff" : "#f8fafc"};">
          <td style="padding: 10px 12px; font-weight: bold; color: #0f172a;">${r.chassisNumber}</td>
          <td style="padding: 10px 12px;">
            <span style="padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 11px; background: ${String(r.tvsFeedback).toLowerCase().includes("accept")
            ? "#dcfce7; color: #166534;"
            : String(r.tvsFeedback).toLowerCase().includes("rework")
              ? "#fef9c3; color: #854d0e;"
              : "#fee2e2; color: #991b1b;"
          }">
              ${r.tvsFeedback || "—"}
            </span>
          </td>
          <td style="padding: 10px 12px; color: #475569;">${r.tvsReason || "—"}</td>
          <td style="padding: 10px 12px; color: #64748b;">${r.tvsRemark || "—"}</td>
          <td style="padding: 10px 12px; color: #4f46e5; font-weight: 500;">${r.targetFormTitle || formTitle}</td>
        </tr>`
      )
      .join("")}
    </tbody>
  </table>

  <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: right;">
    Generated via Focus 3rd Eye TVS Review System ${senderName ? `by ${senderName}` : ""}
  </div>
</div>
`;

  const text = `
TVS REVIEW SUMMARY REPORT
Form: ${formTitle}${targetTenant ? ` (${targetTenant})` : ""}
Date: ${new Date().toLocaleDateString()}
Total Units: ${rows.length} | Accepted: ${accepted} | Rework: ${rework} | Rejected: ${rejected}

CHASSIS UNIT DETAILS:
----------------------------------------------------------------------------------------------------
${rows
      .map(
        (r) =>
          `• ${r.chassisNumber} | TVS Status: ${r.tvsFeedback || "N/A"} | Defect: ${r.tvsReason || "None"} | Remark: ${r.tvsRemark || "None"} | Target: ${r.targetFormTitle || formTitle}`
      )
      .join("\n")}
----------------------------------------------------------------------------------------------------
`;

  return { html, text, subject };
}
