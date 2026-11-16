import * as XLSX from "xlsx";
import XLSX_STYLE from "xlsx-js-style";
import JSZip from "jszip";
import type { Form, Section, Question } from "../types/forms";

export interface BiwExcelRow {
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
    childResponses = {}
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

  // 1. Prepare Main Sheet Data (Header + Rows)
  const mainSheetData: any[][] = [];

  // Header row: Columns A-E (BIW), F-I (1st Main TVS), and J-M (2nd Target Tenant TVS cloned!)
  const headers = [
    "Chassis Number",
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

  // Map existing responses by chassis identifiers to pre-load current review status
  const responseMap = new Map<string, any>();
  if (responses && Array.isArray(responses)) {
    responses.forEach((r) => {
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

  // Filter out system tags like "TVS" or blank values and collect unique chassis numbers
  let validChassis = Array.from(
    new Set(
      chassisNumbers
        .map((c) => String(c || "").trim())
        .filter((c) => Boolean(c) && c.toUpperCase() !== "TVS" && c !== "Excel Import")
    )
  );

  // If no chassis was explicitly passed, extract from responses
  if (validChassis.length === 0 && responseMap.size > 0) {
    validChassis = Array.from(responseMap.keys()).filter(
      (k) => k.toUpperCase() !== "TVS" && k !== "EXCEL IMPORT"
    );
  }

  // Provide rows: prefill actual chassis numbers and their current BIW & TVS statuses
  const rowsCount = Math.max(validChassis.length, 30);
  for (let i = 0; i < rowsCount; i++) {
    const ch = validChassis[i] || "";
    const matchedResp = ch ? responseMap.get(ch.toUpperCase()) : null;

    let biwStatus = "";
    if (matchedResp?.biwReview?.status) {
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

    let tvsStatus = "";
    if (matchedResp?.review?.reviewOption) {
      const st = String(matchedResp.review.reviewOption).toLowerCase();
      if (st.includes("accept")) tvsStatus = "Accepted";
      else if (st.includes("reject")) tvsStatus = "Rejected";
      else if (st.includes("rework")) tvsStatus = "Rework";
    }
    const tvsReason = matchedResp?.review?.reason || "";
    const tvsRemark = matchedResp?.review?.remark || "";
    const tvsFileUrl = matchedResp?.review?.evidenceUrl || "";

    const row = [
      ch,          // Col 1 (A): Chassis Number
      biwStatus,   // Col 2 (B): BIW Feed back (pre-loaded if already reviewed)
      biwReason,   // Col 3 (C): BIW Reason
      biwRemark,   // Col 4 (D): BIW Remark
      biwFileUrl,  // Col 5 (E): BIW File URL
      tvsStatus,   // Col 6 (F): TVS Feed back
      tvsReason,   // Col 7 (G): TVS Reason (Rework and Rejected Reason)
      tvsRemark,   // Col 8 (H): TVS Remark
      tvsFileUrl   // Col 9 (I): TVS File URL
    ];

    if (hasTargetTenant) {
      let targetTvsStatus = "";
      let targetTvsReason = "";
      let targetTvsRemark = "";
      let targetTvsFileUrl = "";

      const childResp =
        matchedResp?.childResponse ||
        (childResponses && (childResponses[ch] || childResponses[ch.toUpperCase()])) ||
        null;

      if (childResp?.review?.reviewOption) {
        const st = String(childResp.review.reviewOption).toLowerCase();
        if (st.includes("accept")) targetTvsStatus = "Accepted";
        else if (st.includes("reject")) targetTvsStatus = "Rejected";
        else if (st.includes("rework")) targetTvsStatus = "Rework";
        targetTvsReason = childResp.review.reason || "";
        targetTvsRemark = childResp.review.remark || childResp.review.message || "";
        targetTvsFileUrl = childResp.review.evidenceUrl || "";
      }

      row.push(
        targetTvsStatus,   // Col 10 (J): TVS Feed back (Target Tenant)
        targetTvsReason,   // Col 11 (K): Rework and Rejected Reason
        targetTvsRemark,   // Col 12 (L): Remark
        targetTvsFileUrl   // Col 13 (M): File Upload
      );
    }

    mainSheetData.push(row);
  }

  const mainWs = XLSX_STYLE.utils.aoa_to_sheet(mainSheetData);

  // Column widths
  const colWidths = [
    { wch: 22 }, // Chassis Number
    { wch: 34 }, // BIW Feed back(Accept,Rework,Reject)
    { wch: 36 }, // Rework and Rejected Resion (Rust..)
    { wch: 24 }, // Remark
    { wch: 22 }, // File Upload
    { wch: 38 }, // TVS Feed back (1st Main Form)
    { wch: 36 }, // Rework and Rejected Resion (Rust..)
    { wch: 24 }, // Remark
    { wch: 22 }  // File Upload
  ];

  if (hasTargetTenant) {
    colWidths.push(
      { wch: 38 }, // TVS Feed back (2nd Target Tenant)
      { wch: 36 }, // Rework and Rejected Resion
      { wch: 24 }, // Remark
      { wch: 22 }  // File Upload
    );
  }

  mainWs["!cols"] = colWidths;

  // Header Styles
  const endCol = hasTargetTenant ? 12 : 8;
  const range = XLSX.utils.decode_range(mainWs["!ref"] || (hasTargetTenant ? "A1:M1" : "A1:I1"));

  for (let c = range.s.c; c <= range.e.c; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c });
    if (!mainWs[cellRef]) continue;

    let fillBg = "1E293B"; // Dark slate
    if (c >= 1 && c <= 4) {
      fillBg = "1E40AF"; // BIW Royal Blue
    } else if (c >= 5 && c <= 8) {
      fillBg = "065F46"; // TVS Emerald Green (matches user screenshot!)
    } else if (c >= 9 && c <= 12) {
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
          horizontal: c === 0 || c === 1 || c === 5 || c === 9 ? "center" : "left"
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
  const maxLookupRows = Math.max(statusOptions.length, defectOptions.length, targetDefectOptions.length);
  const lookupSheetData: any[][] = [
    ["Status Options", "Defect Checkpoints / Reasons", "Target Tenant Defects"]
  ];

  for (let i = 0; i < maxLookupRows; i++) {
    lookupSheetData.push([
      statusOptions[i] || "",
      defectOptions[i] || "",
      targetDefectOptions[i] || ""
    ]);
  }

  const lookupWs = XLSX_STYLE.utils.aoa_to_sheet(lookupSheetData);
  lookupWs["!cols"] = [{ wch: 20 }, { wch: 50 }, { wch: 50 }];

  // 3. Build Initial Workbook
  const wb = XLSX_STYLE.utils.book_new();
  XLSX_STYLE.utils.book_append_sheet(wb, mainWs, "BIW template");
  XLSX_STYLE.utils.book_append_sheet(wb, lookupWs, "Lookups");

  const cleanTitle = (formTitle || "Inspection").replace(/[^a-zA-Z0-9_-]/g, "_");
  const actualFilename = filename || `BIW template - ${cleanTitle}.xlsx`;

  // 4. Generate array buffer and inject native OpenXML dataValidations via JSZip
  const initialBuf = XLSX_STYLE.write(wb, { type: "array", bookType: "xlsx" });
  const zip = await JSZip.loadAsync(initialBuf);

  // 4a. Add Defined Names for StatusList, DefectList & TargetDefectList in workbook.xml
  let wbXml = await zip.file("xl/workbook.xml")?.async("text");
  if (wbXml) {
    const defectLastRow = defectOptions.length + 1;
    const targetDefectLastRow = targetDefectOptions.length + 1;

    let definedNamesInner =
      `<definedName name="StatusList">Lookups!$A$2:$A$4</definedName>` +
      `<definedName name="DefectList">Lookups!$B$2:$B$${defectLastRow}</definedName>`;

    if (hasTargetTenant && targetDefectOptions.length > 0) {
      definedNamesInner += `<definedName name="TargetDefectList">Lookups!$C$2:$C$${targetDefectLastRow}</definedName>`;
    }

    if (wbXml.includes("<definedNames>")) {
      wbXml = wbXml.replace("</definedNames>", `${definedNamesInner}</definedNames>`);
    } else {
      wbXml = wbXml.replace("</sheets>", `</sheets><definedNames>${definedNamesInner}</definedNames>`);
    }
    zip.file("xl/workbook.xml", wbXml);
  }

  // 4b. Add dataValidations in sheet1.xml (strictly BEFORE <ignoredErrors or </worksheet>)
  let sheet1Xml = await zip.file("xl/worksheets/sheet1.xml")?.async("text");
  if (sheet1Xml) {
    let dataValidationsXml = "";
    if (hasTargetTenant && targetDefectOptions.length > 0) {
      dataValidationsXml =
        `<dataValidations count="6">` +
        `<dataValidation sqref="B2:B2000" allowBlank="1" type="list"><formula1>StatusList</formula1></dataValidation>` +
        `<dataValidation sqref="C2:C2000" allowBlank="1" type="list"><formula1>DefectList</formula1></dataValidation>` +
        `<dataValidation sqref="F2:F2000" allowBlank="1" type="list"><formula1>StatusList</formula1></dataValidation>` +
        `<dataValidation sqref="G2:G2000" allowBlank="1" type="list"><formula1>DefectList</formula1></dataValidation>` +
        `<dataValidation sqref="J2:J2000" allowBlank="1" type="list"><formula1>StatusList</formula1></dataValidation>` +
        `<dataValidation sqref="K2:K2000" allowBlank="1" type="list"><formula1>TargetDefectList</formula1></dataValidation>` +
        `</dataValidations>`;
    } else {
      dataValidationsXml =
        `<dataValidations count="4">` +
        `<dataValidation sqref="B2:B2000" allowBlank="1" type="list"><formula1>StatusList</formula1></dataValidation>` +
        `<dataValidation sqref="C2:C2000" allowBlank="1" type="list"><formula1>DefectList</formula1></dataValidation>` +
        `<dataValidation sqref="F2:F2000" allowBlank="1" type="list"><formula1>StatusList</formula1></dataValidation>` +
        `<dataValidation sqref="G2:G2000" allowBlank="1" type="list"><formula1>DefectList</formula1></dataValidation>` +
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
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });

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
 * Parses an uploaded Excel sheet into normalized BIW review records.
 * Uses index-based cell extraction to safely handle repeated header column names.
 */
export async function parseBiwReviewWorkbook(file: File): Promise<BiwExcelRow[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });

  const firstSheetName = wb.SheetNames[0];
  const ws = wb.Sheets[firstSheetName];
  if (!ws) {
    throw new Error("Excel sheet is empty or invalid");
  }

  const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
  const rows: BiwExcelRow[] = [];

  // Determine starting row: find row containing chassis/vin/che/cha/id
  let headerRowIndex = 0;
  for (let r = range.s.r; r <= Math.min(range.e.r, 5); r++) {
    const firstCell = ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v;
    const str = String(firstCell || "").trim().toLowerCase();
    if (str.includes("chassis") || str.includes("cha") || str.includes("che") || str.includes("vin") || str.includes("id")) {
      headerRowIndex = r;
      break;
    }
  }

  // Inspect headers to detect if legacy 15-column template with duplicate reason columns was uploaded
  const headerTexts: string[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const v = ws[XLSX.utils.encode_cell({ r: headerRowIndex, c })]?.v;
    headerTexts.push(String(v || "").trim().toLowerCase());
  }
  const isLegacyDuplicateTvs = headerTexts.length >= 10 && (
    (headerTexts[6] || "").includes("rework") || (headerTexts[6] || "").includes("resion") || (headerTexts[6] || "").includes("reason")
  ) && (
    (headerTexts[7] || "").includes("rework") || (headerTexts[7] || "").includes("resion") || (headerTexts[7] || "").includes("reason")
  );

  // Read data rows
  for (let r = headerRowIndex + 1; r <= range.e.r; r++) {
    const getVal = (c: number): string => {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      return cell && cell.v !== undefined && cell.v !== null ? String(cell.v).trim() : "";
    };

    const chassis = getVal(0);
    // If the chassis number cell is completely blank, skip row
    if (!chassis) continue;

    let tvsFeedback = "";
    let tvsReason = "";
    let tvsRemark = "";
    let tvsFileUrl = "";
    let targetTvsFeedback = "";
    let targetTvsReason = "";
    let targetTvsRemark = "";
    let targetTvsFileUrl = "";

    if (isLegacyDuplicateTvs) {
      // Legacy 15-col format: F(5)=TVS FB, G(6)=Reason 1, H(7)=Reason 2, I(8)=Remark, J(9)=File, K(10)=Target FB, L(11)=Target R1, M(12)=Target R2, N(13)=Target Remark, O(14)=Target File
      tvsFeedback = getVal(5);
      tvsReason = getVal(6) || getVal(7);
      tvsRemark = getVal(8);
      tvsFileUrl = getVal(9);
      targetTvsFeedback = getVal(10);
      targetTvsReason = getVal(11) || getVal(12);
      targetTvsRemark = getVal(13);
      targetTvsFileUrl = getVal(14);
    } else {
      // Clean 9/13-col format: F(5)=TVS FB, G(6)=Reason, H(7)=Remark, I(8)=File, J(9)=Target FB, K(10)=Target Reason, L(11)=Target Remark, M(12)=Target File
      tvsFeedback = getVal(5);
      tvsReason = getVal(6);
      tvsRemark = getVal(7);
      tvsFileUrl = getVal(8);
      targetTvsFeedback = getVal(9);
      targetTvsReason = getVal(10);
      targetTvsRemark = getVal(11);
      targetTvsFileUrl = getVal(12);
    }

    const row: BiwExcelRow = {
      rowIndex: r + 1,
      chassisNumber: chassis,
      biwFeedback: getVal(1),
      biwReason: getVal(2),
      biwRemark: getVal(3),
      biwFileUrl: getVal(4),
      tvsFeedback,
      tvsReason,
      tvsRejectReason: tvsReason,
      tvsRemark,
      tvsFileUrl,
      targetTvsFeedback,
      targetTvsReason,
      targetTvsRejectReason: targetTvsReason,
      targetTvsRemark,
      targetTvsFileUrl
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
}) {
  const {
    targetForm,
    targetFormTitle = "Inspection",
    targetTenantName,
    isChildForm,
    chassisNumbers = [],
    responses = [],
    filename
  } = options;

  const defectOptions = extractFormDefectReasons(targetForm, responses);
  const statusOptions = ["Accepted", "Rejected", "Rework"];

  const mainSheetData: any[][] = [];
  mainSheetData.push(TVS_REVIEW_COLUMNS);

  const responseMap = new Map<string, any>();
  if (responses && Array.isArray(responses)) {
    responses.forEach((r) => {
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
    if (matchedResp?.review?.reviewOption) {
      const st = String(matchedResp.review.reviewOption).toLowerCase();
      if (st.includes("accept")) tvsStatus = "Accepted";
      else if (st.includes("reject")) tvsStatus = "Rejected";
      else if (st.includes("rework")) tvsStatus = "Rework";
    }
    const tvsReason = matchedResp?.review?.reason || "";
    const tvsRemark = matchedResp?.review?.remark || matchedResp?.review?.message || "";
    const tvsFileUrl = matchedResp?.review?.evidenceUrl || "";

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

  // dataValidations in sheet1.xml: Column B (Status), Column C (Defects)
  let sheet1Xml = await zip.file("xl/worksheets/sheet1.xml")?.async("text");
  if (sheet1Xml) {
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
    const firstCell = ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v;
    const str = String(firstCell || "").trim().toLowerCase();
    if (str.includes("chassis") || str.includes("cha") || str.includes("che") || str.includes("vin") || str.includes("id")) {
      headerRowIndex = r;
      break;
    }
  }

  const hCol1 = String(ws[XLSX.utils.encode_cell({ r: headerRowIndex, c: 1 })]?.v || "").toLowerCase();
  const hCol5 = String(ws[XLSX.utils.encode_cell({ r: headerRowIndex, c: 5 })]?.v || "").toLowerCase();
  const isDedicatedTvs = hCol1.includes("tvs") || (!hCol1.includes("biw") && !hCol5.includes("tvs"));

  for (let r = headerRowIndex + 1; r <= range.e.r; r++) {
    const getVal = (c: number): string => {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      return cell && cell.v !== undefined && cell.v !== null ? String(cell.v).trim() : "";
    };

    const chassis = getVal(0);
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
