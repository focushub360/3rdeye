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
  // Metadata for preview
  rowIndex?: number;
  matched?: boolean;
}

export const BIW_REVIEW_COLUMNS = [
  "Chassis Number",
  "BIW Feed back(Accept,Rework,Reject)",
  "Rework and Rejected Resion (Rust..)",
  "Remark",
  "File Upload",
  "TVS Feed back",
  "Rework Resion (Rust..)",
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
 */
export async function downloadBiwReviewTemplate(options: {
  form?: Form | null;
  formTitle?: string;
  chassisNumbers?: string[];
  responses?: any[];
  filename?: string;
}) {
  const { form, formTitle, chassisNumbers = [], responses = [], filename } = options;

  const defectOptions = extractFormDefectReasons(form, responses);
  const statusOptions = ["Accepted", "Rejected", "Rework"];

  // 1. Prepare Main Sheet Data (Header + Rows)
  const mainSheetData: any[][] = [];

  // Header row
  mainSheetData.push(BIW_REVIEW_COLUMNS);

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
        if (typeof v === "string" && v.trim().length >= 1 && v.trim().length <= 60) {
          keys.push(v.trim());
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

  // Provide rows: prefill actual chassis numbers and their current BIW status
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

    mainSheetData.push([
      ch,          // Col 1: Chassis Number
      biwStatus,   // Col 2: BIW Feed back (pre-loaded if already reviewed)
      biwReason,   // Col 3: BIW Reason
      biwRemark,   // Col 4: BIW Remark
      biwFileUrl,  // Col 5: BIW File URL
      tvsStatus,   // Col 6: TVS Feed back
      tvsReason,   // Col 7: TVS Rework Reason
      "",          // Col 8: TVS Rework & Rejected Reason
      tvsRemark,   // Col 9: TVS Remark
      tvsFileUrl   // Col 10: TVS File URL
    ]);
  }

  const mainWs = XLSX_STYLE.utils.aoa_to_sheet(mainSheetData);

  // Column widths
  mainWs["!cols"] = [
    { wch: 22 }, // Chassis Number
    { wch: 34 }, // BIW Feed back(Accept,Rework,Reject)
    { wch: 36 }, // Rework and Rejected Resion (Rust..)
    { wch: 24 }, // Remark
    { wch: 22 }, // File Upload
    { wch: 20 }, // TVS Feed back
    { wch: 28 }, // Rework Resion (Rust..)
    { wch: 36 }, // Rework and Rejected Resion (Rust..)
    { wch: 24 }, // Remark
    { wch: 22 }  // File Upload
  ];

  // Header Styles
  const range = XLSX.utils.decode_range(mainWs["!ref"] || "A1:J1");

  for (let c = range.s.c; c <= range.e.c; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c });
    if (!mainWs[cellRef]) continue;

    let fillBg = "1E293B"; // Dark slate
    if (c >= 1 && c <= 4) {
      fillBg = "1E40AF"; // BIW Royal Blue
    } else if (c >= 5 && c <= 9) {
      fillBg = "065F46"; // TVS Emerald Green
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
          horizontal: c === 0 || c === 1 || c === 5 ? "center" : "left"
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
  const maxLookupRows = Math.max(statusOptions.length, defectOptions.length);
  const lookupSheetData: any[][] = [
    ["Status Options", "Defect Checkpoints / Reasons"]
  ];

  for (let i = 0; i < maxLookupRows; i++) {
    lookupSheetData.push([
      statusOptions[i] || "",
      defectOptions[i] || ""
    ]);
  }

  const lookupWs = XLSX_STYLE.utils.aoa_to_sheet(lookupSheetData);
  lookupWs["!cols"] = [{ wch: 20 }, { wch: 50 }];

  // 3. Build Initial Workbook
  const wb = XLSX_STYLE.utils.book_new();
  XLSX_STYLE.utils.book_append_sheet(wb, mainWs, "BIW template");
  XLSX_STYLE.utils.book_append_sheet(wb, lookupWs, "Lookups");

  const cleanTitle = (formTitle || "Inspection").replace(/[^a-zA-Z0-9_-]/g, "_");
  const actualFilename = filename || `BIW template - ${cleanTitle}.xlsx`;

  // 4. Generate array buffer and inject native OpenXML dataValidations via JSZip
  const initialBuf = XLSX_STYLE.write(wb, { type: "array", bookType: "xlsx" });
  const zip = await JSZip.loadAsync(initialBuf);

  // 4a. Add Defined Names for StatusList and DefectList in workbook.xml
  let wbXml = await zip.file("xl/workbook.xml")?.async("text");
  if (wbXml) {
    const defectLastRow = defectOptions.length + 1;
    const definedNamesXml =
      `<definedNames>` +
      `<definedName name="StatusList">Lookups!$A$2:$A$4</definedName>` +
      `<definedName name="DefectList">Lookups!$B$2:$B$${defectLastRow}</definedName>` +
      `</definedNames>`;

    if (wbXml.includes("<definedNames>")) {
      wbXml = wbXml.replace("</definedNames>", `<definedName name="StatusList">Lookups!$A$2:$A$4</definedName><definedName name="DefectList">Lookups!$B$2:$B$${defectLastRow}</definedName></definedNames>`);
    } else {
      wbXml = wbXml.replace("</sheets>", `</sheets>${definedNamesXml}`);
    }
    zip.file("xl/workbook.xml", wbXml);
  }

  // 4b. Add dataValidations in sheet1.xml (strictly BEFORE <ignoredErrors or </worksheet>)
  let sheet1Xml = await zip.file("xl/worksheets/sheet1.xml")?.async("text");
  if (sheet1Xml) {
    const dataValidationsXml =
      `<dataValidations count="5">` +
      `<dataValidation sqref="B2:B2000" allowBlank="1" type="list"><formula1>StatusList</formula1></dataValidation>` +
      `<dataValidation sqref="C2:C2000" allowBlank="1" type="list"><formula1>DefectList</formula1></dataValidation>` +
      `<dataValidation sqref="F2:F2000" allowBlank="1" type="list"><formula1>StatusList</formula1></dataValidation>` +
      `<dataValidation sqref="G2:G2000" allowBlank="1" type="list"><formula1>DefectList</formula1></dataValidation>` +
      `<dataValidation sqref="H2:H2000" allowBlank="1" type="list"><formula1>DefectList</formula1></dataValidation>` +
      `</dataValidations>`;

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

  // Read data rows
  for (let r = headerRowIndex + 1; r <= range.e.r; r++) {
    const getVal = (c: number): string => {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      return cell && cell.v !== undefined && cell.v !== null ? String(cell.v).trim() : "";
    };

    const chassis = getVal(0);
    // If the chassis number cell is completely blank, skip row
    if (!chassis) continue;

    const row: BiwExcelRow = {
      rowIndex: r + 1,
      chassisNumber: chassis,
      biwFeedback: getVal(1),
      biwReason: getVal(2),
      biwRemark: getVal(3),
      biwFileUrl: getVal(4),
      tvsFeedback: getVal(5),
      tvsReason: getVal(6),
      tvsRejectReason: getVal(7),
      tvsRemark: getVal(8),
      tvsFileUrl: getVal(9)
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
              <span style="padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 11px; background: ${
                String(r.biwFeedback).toLowerCase().includes("accept")
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
