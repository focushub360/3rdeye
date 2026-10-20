import * as XLSX from "xlsx";
import XLSX_STYLE from "xlsx-js-style";
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
 * Extracts defect checkpoint questions from the active form.
 */
export function extractFormDefectReasons(form?: Form | null): string[] {
  const defectReasons: string[] = [];

  if (form?.sections && Array.isArray(form.sections)) {
    form.sections.forEach((sec: Section) => {
      if (sec.questions && Array.isArray(sec.questions)) {
        sec.questions.forEach((q: Question) => {
          if (q.text && typeof q.text === "string") {
            const cleanText = q.text.trim();
            if (cleanText && !defectReasons.includes(cleanText)) {
              defectReasons.push(cleanText);
            }
          }
        });
      }
    });
  }

  // Combine form checkpoints with standard defect terms, avoiding duplicates
  const combined = [...defectReasons];
  STANDARD_DEFECTS.forEach((d) => {
    if (!combined.some((item) => item.toLowerCase() === d.toLowerCase())) {
      combined.push(d);
    }
  });

  return combined;
}

/**
 * Generates and downloads the BIW Review Excel Template with dropdown data validations.
 */
export function downloadBiwReviewTemplate(options: {
  form?: Form | null;
  formTitle?: string;
  chassisNumbers?: string[];
  filename?: string;
}) {
  const { form, formTitle, chassisNumbers = [], filename } = options;

  const defectOptions = extractFormDefectReasons(form);
  const statusOptions = ["Accepted", "Rework", "Rejected"];

  // 1. Prepare Main Sheet Data (Header + Rows)
  const mainSheetData: any[][] = [];

  // Header row
  mainSheetData.push(BIW_REVIEW_COLUMNS);

  // Prefill chassis numbers or 10 empty sample rows
  const targetChassis = chassisNumbers.length > 0 ? chassisNumbers : Array.from({ length: 15 }, (_, i) => `CH-${1000 + i}`);
  targetChassis.forEach((chassis) => {
    mainSheetData.push([
      chassis, // Col 1: Chassis Number
      "",      // Col 2: BIW Feed back
      "",      // Col 3: BIW Reason
      "",      // Col 4: BIW Remark
      "",      // Col 5: BIW File URL
      "",      // Col 6: TVS Feed back
      "",      // Col 7: TVS Rework Reason
      "",      // Col 8: TVS Rework & Rejected Reason
      "",      // Col 9: TVS Remark
      ""       // Col 10: TVS File URL
    ]);
  });

  const mainWs = XLSX_STYLE.utils.aoa_to_sheet(mainSheetData);

  // Column widths
  mainWs["!cols"] = [
    { wch: 18 }, // Chassis Number
    { wch: 32 }, // BIW Feed back(Accept,Rework,Reject)
    { wch: 34 }, // Rework and Rejected Resion (Rust..)
    { wch: 22 }, // Remark
    { wch: 22 }, // File Upload
    { wch: 20 }, // TVS Feed back
    { wch: 26 }, // Rework Resion (Rust..)
    { wch: 34 }, // Rework and Rejected Resion (Rust..)
    { wch: 22 }, // Remark
    { wch: 22 }  // File Upload
  ];

  // Header Styles
  const range = XLSX.utils.decode_range(mainWs["!ref"] || "A1:J1");

  // Style header cells
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
  lookupWs["!cols"] = [{ wch: 20 }, { wch: 45 }];

  // 3. Add Data Validation for Dropdowns
  const statusLastRow = statusOptions.length + 1;
  const defectLastRow = defectOptions.length + 1;
  const maxRows = Math.max(500, targetChassis.length + 50);

  const dataValidations: any[] = [
    // Col B: BIW Feedback (Index 1)
    {
      sqref: `B2:B${maxRows}`,
      type: "list",
      formula1: `=Lookups!$A$2:$A$${statusLastRow}`
    },
    // Col C: BIW Defect Reason (Index 2)
    {
      sqref: `C2:C${maxRows}`,
      type: "list",
      formula1: `=Lookups!$B$2:$B$${defectLastRow}`
    },
    // Col F: TVS Feedback (Index 5)
    {
      sqref: `F2:F${maxRows}`,
      type: "list",
      formula1: `=Lookups!$A$2:$A$${statusLastRow}`
    },
    // Col G: TVS Rework Reason (Index 6)
    {
      sqref: `G2:G${maxRows}`,
      type: "list",
      formula1: `=Lookups!$B$2:$B$${defectLastRow}`
    },
    // Col H: TVS Rework/Reject Reason (Index 7)
    {
      sqref: `H2:H${maxRows}`,
      type: "list",
      formula1: `=Lookups!$B$2:$B$${defectLastRow}`
    }
  ];

  mainWs["!datavalidation"] = dataValidations;

  // 4. Build Workbook
  const wb = XLSX_STYLE.utils.book_new();
  XLSX_STYLE.utils.book_append_sheet(wb, mainWs, "BIW Review");
  XLSX_STYLE.utils.book_append_sheet(wb, lookupWs, "Lookups");

  const actualFilename =
    filename ||
    `BIW_Review_Template_${(formTitle || "Inspection").replace(/[^a-zA-Z0-9_-]/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`;

  XLSX_STYLE.writeFile(wb, actualFilename);
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

  // Determine starting row: find row containing chassis/che/feedback
  let headerRowIndex = 0;
  for (let r = range.s.r; r <= Math.min(range.e.r, 5); r++) {
    const firstCell = ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v;
    const str = String(firstCell || "").trim().toLowerCase();
    if (str.includes("che") || str.includes("chassis") || str.includes("vin")) {
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
    <p style="margin: 0; font-size: 14px; opacity: 0.9;">Form: <strong>${formTitle}</strong> | Total Units: <strong>${rows.length}</strong> | Date: <strong>${new Date().toLocaleDateString()}</strong></p>
  </div>
  
  <div style="padding: 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-top: none;">
    <div style="display: flex; gap: 12px; margin-bottom: 16px;">
      <span style="display: inline-block; padding: 6px 12px; background: #dcfce7; color: #15803d; border-radius: 6px; font-weight: bold; font-size: 13px;">✅ Accepted: ${accepted}</span>
      <span style="display: inline-block; padding: 6px 12px; background: #fef3c7; color: #b45309; border-radius: 6px; font-weight: bold; font-size: 13px;">⚠️ Rework: ${rework}</span>
      <span style="display: inline-block; padding: 6px 12px; background: #fee2e2; color: #b91c1c; border-radius: 6px; font-weight: bold; font-size: 13px;">❌ Rejected: ${rejected}</span>
    </div>

    <table style="width: 100%; border-collapse: collapse; font-size: 12px; background: white; border: 1px solid #cbd5e1;">
      <thead>
        <tr style="background: #0f172a; color: white; text-align: left;">
          <th style="padding: 8px; border: 1px solid #cbd5e1;">Chassis</th>
          <th style="padding: 8px; border: 1px solid #cbd5e1;">BIW Status</th>
          <th style="padding: 8px; border: 1px solid #cbd5e1;">BIW Defect / Reason</th>
          <th style="padding: 8px; border: 1px solid #cbd5e1;">Remark</th>
          <th style="padding: 8px; border: 1px solid #cbd5e1;">TVS Status</th>
          <th style="padding: 8px; border: 1px solid #cbd5e1;">Evidence</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r, i) => `
        <tr style="background-color: ${i % 2 === 0 ? "#ffffff" : "#f8fafc"};">
          <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: bold;">${r.chassisNumber}</td>
          <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">${r.biwFeedback || "-"}</td>
          <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">${r.biwReason || "-"}</td>
          <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">${r.biwRemark || r.tvsRemark || "-"}</td>
          <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">${r.tvsFeedback || "-"}</td>
          <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">${
            r.biwFileUrl
              ? `<a href="${r.biwFileUrl}" target="_blank" style="color: #2563eb; text-decoration: underline;">View File</a>`
              : "-"
          }</td>
        </tr>`
          )
          .join("")}
      </tbody>
    </table>

    <p style="margin-top: 16px; font-size: 11px; color: #64748b;">
      Generated via Focus 3rd Eye Quality Inspection System ${senderName ? `by ${senderName}` : ""}.
    </p>
  </div>
</div>
  `.trim();

  const text = `
BIW & Inspection Review Report
Form: ${formTitle} | Total Units: ${rows.length} | Date: ${new Date().toLocaleDateString()}

Summary:
- Accepted: ${accepted}
- Rework: ${rework}
- Rejected: ${rejected}

Chassis Details:
${rows.map((r) => `* ${r.chassisNumber}: BIW [${r.biwFeedback || "N/A"}] Reason: ${r.biwReason || "None"} | TVS [${r.tvsFeedback || "N/A"}] Remark: ${r.biwRemark || r.tvsRemark || "None"}`).join("\n")}
  `.trim();

  return { html, text, subject };
}
