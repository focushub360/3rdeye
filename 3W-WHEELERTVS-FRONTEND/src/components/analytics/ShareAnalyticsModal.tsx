// ShareAnalyticsModal.tsx
import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  Send,
  Loader2,
  CheckCircle,
  AlertCircle,
  Download,
  FileSpreadsheet,
  Plus,
  Trash2,
  ShieldCheck,
  MessageCircle,
  Copy,
  Info,
  ChevronDown,
  ChevronUp,
  FileText,
  Layers
} from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { apiClient } from '../../api/client';

interface ShareAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  formId: string;
  formTitle: string;
  analyticsData?: any;
  responses?: any[];
  formSchema?: any;
}

export interface InviteItem {
  type: 'email' | 'email_cc' | 'whatsapp';
  email: string;
  phone?: string;
}

/**
 * Generates the complete Responses Tab as an Excel (.xlsx) workbook in Base64 format
 */
export function generateResponsesTabExcelBase64(
  responsesList: any[],
  formObj: any,
  title: string
): string {
  try {
    const wb = XLSX.utils.book_new();

    // 1. Gather all question definitions from form schema
    const questionHeaders: string[] = [];
    const questionKeys: Array<{ id: string; text: string }> = [];

    if (formObj?.sections && Array.isArray(formObj.sections) && formObj.sections.length > 0) {
      formObj.sections.forEach((section: any) => {
        if (Array.isArray(section.questions)) {
          section.questions.forEach((q: any) => {
            const qText = q.text || q.title || `Question ${q.id}`;
            questionHeaders.push(qText);
            questionKeys.push({ id: q.id, text: qText });
          });
        }
      });
    } else if (Array.isArray(formObj?.questions)) {
      formObj.questions.forEach((q: any) => {
        const qText = q.text || q.title || `Question ${q.id}`;
        questionHeaders.push(qText);
        questionKeys.push({ id: q.id, text: qText });
      });
    } else if (Array.isArray(formObj?.followUpQuestions)) {
      formObj.followUpQuestions.forEach((q: any) => {
        const qText = q.text || q.title || `Question ${q.id}`;
        questionHeaders.push(qText);
        questionKeys.push({ id: q.id, text: qText });
      });
    }

    // 2. Base column headers matching Responses Tab grid
    const baseHeaders = [
      "Timestamp",
      "Submitted By",
      "Status",
      "Chassis Number",
      "BIW Review",
      "Reviewed By",
      "Rework Reason / Remarks",
      "Dispatched",
      "Dispatched By",
      "Dispatched At"
    ];

    const allHeaders = [...baseHeaders, ...questionHeaders];
    const sheetData: any[][] = [allHeaders];

    // Helper for chassis display
    const getChassisVal = (ans: any, resp: any) => {
      if (ans?.chassis_number) {
        if (typeof ans.chassis_number === 'object') {
          return ans.chassis_number.value || ans.chassis_number.label || ans.chassis_number.text || JSON.stringify(ans.chassis_number);
        }
        return String(ans.chassis_number);
      }
      return resp?.chassisNumber || resp?.chassis_number || "-";
    };

    // Helper for answer display
    const formatAnswer = (ans: any) => {
      if (ans === undefined || ans === null) return "-";
      if (typeof ans === "string") {
        if (ans.startsWith("data:image/") || ans.startsWith("data:application/") || ans.length > 500) {
          return "[Evidence File Attached]";
        }
        return ans;
      }
      if (typeof ans === "number" || typeof ans === "boolean") {
        return String(ans);
      }
      if (Array.isArray(ans)) {
        return ans.map(a => typeof a === "object" ? formatAnswer(a) : a).join(", ");
      }
      if (typeof ans === "object") {
        if (ans.url && typeof ans.url === 'string' && !ans.url.startsWith('data:')) {
          return ans.url;
        }
        if (ans.data || ans.base64 || (typeof ans.url === 'string' && ans.url.startsWith('data:'))) {
          return "[Photo Evidence Attached]";
        }
        if (ans.status) {
          return ans.remark ? `${ans.status} (${ans.remark})` : ans.status;
        }
        if (ans.zonesData) {
          const defects: string[] = [];
          Object.entries(ans.zonesData).forEach(([zone, zData]: [string, any]) => {
            if (zData?.categories) {
              zData.categories.forEach((cat: any) => {
                (cat.defects || []).forEach((d: any) => {
                  defects.push(`${zone} > ${cat.name}: ${d.name}${d.details?.remark ? ` (${d.details.remark})` : ''}`);
                });
              });
            }
          });
          return defects.length > 0 ? defects.join("; ") : "Inspection OK";
        }
        if (ans.value || ans.label || ans.text) {
          const val = ans.value || ans.label || ans.text;
          if (typeof val === 'string' && (val.startsWith('data:') || val.length > 500)) return "[Photo Attached]";
          return String(val);
        }
        try {
          const sanitized = { ...ans };
          if (sanitized.data) sanitized.data = "[Binary Data]";
          if (sanitized.base64) sanitized.base64 = "[Binary Data]";
          return JSON.stringify(sanitized);
        } catch {
          return String(ans);
        }
      }
      return String(ans);
    };

    // Populate rows
    responsesList.forEach((resp: any) => {
      const answers = resp.answers || {};
      const chassisNo = getChassisVal(answers, resp);
      
      const reviewStatus = resp.review?.status || resp.biwReview?.status || (resp.isApproved ? "Approved" : "Pending");
      const reviewer = resp.review?.reviewer || resp.review?.name || resp.biwReview?.reviewer || resp.reviewedBy || "-";
      const remarks = resp.review?.remark || resp.review?.reason || resp.reworkReason || resp.biwReview?.remark || "-";
      
      const rawDate = resp.createdAt || resp.timestamp || resp.fallbackTimestamp;
      const dateStr = rawDate ? new Date(rawDate).toLocaleString() : "-";
      
      const row: any[] = [
        dateStr,
        resp.submittedBy || resp.createdBy || resp.inspectorName || "Anonymous",
        resp.status || "Completed",
        chassisNo,
        reviewStatus,
        reviewer,
        remarks,
        resp.isDispatched ? "Yes" : "No",
        resp.dispatchedByName || resp.dispatchedBy || "-",
        resp.dispatchedAt ? new Date(resp.dispatchedAt).toLocaleString() : "-"
      ];

      // Add question columns
      questionKeys.forEach(({ id }) => {
        row.push(formatAnswer(answers[id]));
      });

      sheetData.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Styling
    const headerStyle = {
      fill: { fgColor: { rgb: "1E3A8A" } },
      font: { color: { rgb: "FFFFFF" }, bold: true, sz: 11 },
      alignment: { vertical: "center", horizontal: "center", wrapText: true }
    };

    // Auto column widths
    const cols = allHeaders.map((_, i) => {
      if (i === 0) return { wch: 20 }; // Timestamp
      if (i === 1) return { wch: 22 }; // Submitted By
      if (i === 2) return { wch: 18 }; // Status
      if (i === 3) return { wch: 20 }; // Chassis Number
      if (i === 4) return { wch: 16 }; // BIW Review
      if (i === 5) return { wch: 20 }; // Reviewed By
      if (i === 6) return { wch: 30 }; // Remarks
      if (i === 7) return { wch: 14 }; // Dispatched
      if (i === 8) return { wch: 20 }; // Dispatched By
      if (i === 9) return { wch: 22 }; // Dispatched At
      return { wch: 30 }; // Question columns
    });
    ws["!cols"] = cols;

    // Apply header styling to first row
    allHeaders.forEach((_, colIndex) => {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIndex });
      if (ws[cellRef]) {
        (ws[cellRef] as any).s = headerStyle;
      }
    });

    XLSX.utils.book_append_sheet(wb, ws, "Responses");

    // Sheet 2: Chassis & Inspection Summary
    const summaryHeaders = ["Chassis Number", "Total Inspections", "Latest Status", "BIW Review", "Reviewed By", "Dispatched"];
    const chassisMap = new Map<string, any[]>();
    responsesList.forEach(r => {
      const c = getChassisVal(r.answers || {}, r);
      if (!chassisMap.has(c)) chassisMap.set(c, []);
      chassisMap.get(c)!.push(r);
    });

    const summaryData: any[][] = [summaryHeaders];
    chassisMap.forEach((rList, cNum) => {
      const latest = rList[rList.length - 1];
      summaryData.push([
        cNum,
        rList.length,
        latest.status || "-",
        latest.review?.status || latest.biwReview?.status || "Pending",
        latest.review?.reviewer || latest.biwReview?.reviewer || "-",
        latest.isDispatched ? "Yes" : "No"
      ]);
    });

    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    summaryWs["!cols"] = [{ wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 14 }];
    summaryHeaders.forEach((_, colIndex) => {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIndex });
      if (summaryWs[cellRef]) {
        (summaryWs[cellRef] as any).s = headerStyle;
      }
    });

    XLSX.utils.book_append_sheet(wb, summaryWs, "Chassis Summary");

    return XLSX.write(wb, { bookType: "xlsx", type: "base64" });
  } catch (error) {
    console.error("Error generating Responses Tab Excel Base64:", error);
    return "";
  }
}

const ShareAnalyticsModal: React.FC<ShareAnalyticsModalProps> = ({
  isOpen,
  onClose,
  formId,
  formTitle,
  analyticsData,
  responses = [],
  formSchema
}) => {
  // State declarations
  // Dedicated recipient state: 1 Main (To) and 1 CC Sender ready for instant input
  const [invites, setInvites] = useState<InviteItem[]>([
    { type: 'email', email: '', phone: '' },
    { type: 'email_cc', email: '', phone: '' }
  ]);
  const [channels, setChannels] = useState<string[]>(['email']);
  const [customMessage, setCustomMessage] = useState('');
  const [shareMode, setShareMode] = useState<'excel' | 'all' | 'pdf' | 'link'>('excel');
  const [isSending, setIsSending] = useState(false);
  const [sendingStep, setSendingStep] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [uploadStats, setUploadStats] = useState<{ total: number; toCount: number; ccCount: number } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Local responses and schema fallback
  const [localResponses, setLocalResponses] = useState<any[]>(responses);
  const [localForm, setLocalForm] = useState<any>(formSchema);

  // Sync props or fetch if missing
  useEffect(() => {
    if (responses && responses.length > 0) {
      setLocalResponses(responses);
    } else if (isOpen && formId) {
      apiClient.getFormResponses(formId).then((res: any) => {
        const data = Array.isArray(res) ? res : res?.responses || res?.data || [];
        if (data.length > 0) setLocalResponses(data);
      }).catch(err => console.warn('Could not load responses for excel share:', err));
    }
  }, [isOpen, formId, responses]);

  useEffect(() => {
    if (formSchema) {
      setLocalForm(formSchema);
    } else if (isOpen && formId) {
      apiClient.getForm(formId).then((f: any) => {
        const formData = f?.data || f;
        if (formData) setLocalForm(formData);
      }).catch(err => console.warn('Could not load form schema for excel share:', err));
    }
  }, [isOpen, formId, formSchema]);

  // Show toast helper
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Download Sample Excel Template for bulk recipient list
  const handleDownloadSample = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      "Main Sender,CC Sender,Mobile\n" +
      "director@example.com,auditor@example.com,+919876543210\n" +
      "manager@example.com,quality@example.com,\n" +
      ",supervisor@example.com,+919876543211\n";

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Recipient_Invite_Template_${formTitle.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Sample recipient template downloaded!", "info");
  };

  // Handle recipient file upload (optional bulk)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const res = await apiClient.uploadAnalyticsInvites(formId, file);
      const data = (res as any)?.data || res;

      if (data && Array.isArray(data.preview)) {
        const invitesFromFile: InviteItem[] = data.preview.map((item: any) => ({
          type: item.type === 'email_cc' ? 'email_cc' : 'email',
          email: item.email || '',
          phone: item.phone || ''
        }));

        setInvites(prev => {
          const filledPrev = prev.filter(p => p.email.trim().length > 0 || (p.phone || '').trim().length > 0);
          return [...filledPrev, ...invitesFromFile];
        });

        const toCount = data.toCount ?? invitesFromFile.filter(i => i.type !== 'email_cc').length;
        const ccCount = data.ccCount ?? invitesFromFile.filter(i => i.type === 'email_cc').length;
        setUploadStats({
          total: invitesFromFile.length,
          toCount,
          ccCount
        });

        showToast(
          `Imported ${invitesFromFile.length} recipients (${toCount} Main To, ${ccCount} CC)`,
          'success'
        );
      } else {
        showToast('No valid email rows found in the uploaded file', 'error');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      showToast(error.message || 'Failed to parse Excel file', 'error');
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  // Handle adding manual invites row
  const handleAddInviteRow = (defaultType: 'email' | 'email_cc' | 'whatsapp' = 'email') => {
    setInvites(prev => [...prev, { type: defaultType, email: '', phone: '' }]);
  };

  const handleRemoveInvite = (index: number) => {
    setInvites(prev => prev.filter((_, i) => i !== index));
  };

  const handleInviteChange = (
    index: number,
    field: 'email' | 'phone' | 'type',
    value: string
  ) => {
    setInvites(prev => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = {
          ...updated[index],
          [field]: value
        };
      }
      return updated;
    });
  };

  // Active counts based on entered non-empty emails/phones
  const mainCount = invites.filter(i => i.type === 'email' && i.email.trim().length > 0).length;
  const ccCount = invites.filter(i => i.type === 'email_cc' && i.email.trim().length > 0).length;
  const waCount = invites.filter(i => i.type === 'whatsapp' && ((i.phone || '').trim().length > 0 || i.email.trim().length > 0)).length;

  const responsesCount = localResponses.length;

  // Handle send
  const handleSend = async () => {
    // Parse and expand comma/semicolon-separated emails
    const validInvites: InviteItem[] = [];
    for (const inv of invites) {
      const rawEmail = (inv.email || '').trim();
      const rawPhone = (inv.phone || '').trim();

      if (!rawEmail && !rawPhone) continue;

      if (rawEmail && (rawEmail.includes(',') || rawEmail.includes(';'))) {
        const splitEmails = rawEmail.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
        for (const singleEmail of splitEmails) {
          validInvites.push({
            type: inv.type,
            email: singleEmail,
            phone: rawPhone
          });
        }
      } else {
        validInvites.push({
          type: inv.type,
          email: rawEmail,
          phone: rawPhone
        });
      }
    }

    if (validInvites.length === 0) {
      showToast('Please enter at least one recipient email (Main To or CC)', 'error');
      return;
    }

    // Ensure at least one Main (To) email exists
    const hasMainTo = validInvites.some(i => i.type === 'email' && i.email);
    const hasCc = validInvites.some(i => i.type === 'email_cc' && i.email);

    if (!hasMainTo && hasCc) {
      showToast('Please specify a Main (To) recipient for the inspection report', 'error');
      return;
    }

    if (channels.length === 0) {
      showToast('Please select at least one channel (Email, WhatsApp, or SMS)', 'error');
      return;
    }

    try {
      setIsSending(true);
      setSendingStep(`Compiling ${localResponses.length} inspection records...`);
      await new Promise(r => setTimeout(r, 60));

      let pdfHtml = '';
      if (shareMode === 'pdf' || shareMode === 'all') {
        pdfHtml = generateAnalyticsPDFHtml(formTitle, analyticsData);
      }

      // Generate Excel workbook Base64 directly from responses tab data
      let excelBase64 = '';
      let excelFileName = '';
      if (shareMode === 'excel' || shareMode === 'all') {
        const safeTitle = (formTitle || 'inspection').replace(/[^a-zA-Z0-9_-]/g, '_');
        excelFileName = `${safeTitle}_Responses_${new Date().toISOString().slice(0, 10)}.xlsx`;
        excelBase64 = generateResponsesTabExcelBase64(localResponses, localForm, formTitle);
        console.log(`📊 Generated Excel Base64 for Responses Tab: ${excelFileName} (length: ${excelBase64.length})`);
      }

      setSendingStep('Dispatching automated email via server...');
      await new Promise(r => setTimeout(r, 40));

      const result: any = await apiClient.sendAnalyticsInvites(
        formId,
        validInvites,
        channels,
        customMessage || 'Please review the inspection responses report.',
        pdfHtml,
        shareMode,
        excelBase64,
        excelFileName
      );

      console.log('📥 Send Analytics Invites API Response:', result);

      if (!result) {
        throw new Error('No response from server');
      }

      const sent = result.sent ?? result.data?.sent ?? 0;
      const failed = result.failed ?? result.data?.failed ?? 0;
      const allSuccessful = result.allSuccessful ?? result.data?.allSuccessful ?? (sent > 0 && failed === 0);
      const ccCountSent = result.ccCount ?? ccCount;

      if (allSuccessful || sent > 0) {
        const ccMsg = ccCountSent > 0 ? ` (with ${ccCountSent} CC copy${ccCountSent === 1 ? '' : 'ies'})` : '';
        const attachmentMsg = (shareMode === 'excel' || shareMode === 'all') ? ' with Responses Excel (.xlsx) attached' : '';
        showToast(
          `Automated email delivery complete: Sent to ${sent} recipient${sent === 1 ? '' : 's'}${ccMsg}${attachmentMsg}!`,
          'success'
        );
        setTimeout(() => {
          setInvites([]);
          setCustomMessage('');
          setUploadStats(null);
          onClose();
        }, 2400);
      } else {
        showToast(`Delivery finished: ${sent} sent, ${failed} failed. Check server mail logs.`, 'error');
      }
    } catch (error: any) {
      console.error('❌ Error sending invites:', error);
      showToast(error.message || 'Failed to send automated invites. Please verify SMTP configuration.', 'error');
    } finally {
      setIsSending(false);
    }
  };

  // Generate Analytics PDF HTML
  const generateAnalyticsPDFHtml = (title: string, data: any): string => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${title} - Analytics Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #1e293b; }
            h1 { color: #1e40af; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; font-size: 20px; }
            .header { margin-bottom: 20px; }
            .badge { display: inline-block; padding: 4px 8px; background: #e0f2fe; color: #0369a1; border-radius: 4px; font-size: 11px; font-weight: bold; }
            .content { margin-top: 16px; font-size: 12px; line-height: 1.6; }
            .footer { margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 10px; color: #94a3b8; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${title} — Inspection Analytics Report</h1>
            <span class="badge">CONFIDENTIAL INSPECTION REPORT</span>
            <p style="margin: 6px 0 0; font-size: 11px; color: #64748b;">Generated: ${new Date().toLocaleString()}</p>
          </div>
          <div class="content">
            <p>Please find the inspection and quality metrics summary below. Full details can be accessed in the live portal.</p>
            ${data ? `<pre style="background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 10px;">${JSON.stringify(data, null, 2)}</pre>` : ''}
          </div>
          <div class="footer">
            Focus 3rd Eye / VehicleIQ Quality Inspection Platform
          </div>
        </body>
      </html>
    `;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col border border-gray-100 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-gray-200 dark:border-gray-700 bg-slate-50/80 dark:bg-gray-800/80">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800 shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white leading-tight">
                Share Responses: {formTitle}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5 font-medium">
                Direct automated dispatch with <strong>Responses Tab Excel (.xlsx)</strong> attached
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200/60 dark:hover:bg-gray-700 rounded-xl transition-colors text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Guaranteed Automated Delivery Notice */}
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 dark:from-emerald-950/30 dark:via-teal-950/30 dark:to-blue-950/30 px-6 py-3 border-b border-emerald-100 dark:border-emerald-900/30 flex items-center gap-3 text-sm text-emerald-950 dark:text-emerald-100">
          <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>
            <strong>Direct Server Dispatch:</strong> Emails are delivered directly in the background with the Responses Tab Excel (.xlsx) attached to Main & CC Senders. No external Gmail app redirect required.
          </span>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* SHARE CONTENT FORMAT */}
          <div>
            <label className="block text-sm font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200 mb-2.5">
              Share Content Format
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  id: 'excel',
                  label: 'Excel Responses Sheet (.xlsx)',
                  sublabel: 'Live responses table & questions attached as Excel',
                  icon: FileSpreadsheet,
                  color: 'text-emerald-600 dark:text-emerald-400',
                  badge: 'Recommended'
                },
                {
                  id: 'all',
                  label: 'All Formats (Excel + PDF + Link)',
                  sublabel: 'Includes Excel workbook, PDF report, & login link',
                  icon: Layers,
                  color: 'text-indigo-600 dark:text-indigo-400'
                },
                {
                  id: 'pdf',
                  label: 'PDF Report Only',
                  sublabel: 'A4 formatted PDF quality metrics report',
                  icon: FileText,
                  color: 'text-blue-600 dark:text-blue-400'
                },
                {
                  id: 'link',
                  label: 'Dashboard Link Only',
                  sublabel: 'Secure access link with one-time verification',
                  icon: Send,
                  color: 'text-purple-600 dark:text-purple-400'
                }
              ].map((mode) => {
                const Icon = mode.icon;
                const isSelected = shareMode === mode.id;
                return (
                  <label
                    key={mode.id}
                    onClick={() => setShareMode(mode.id as any)}
                    className={`flex items-start gap-3.5 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 dark:border-emerald-600 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/60'
                    }`}
                  >
                    <input
                      type="radio"
                      name="shareMode"
                      checked={isSelected}
                      onChange={() => setShareMode(mode.id as any)}
                      className="mt-1 w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-5 h-5 ${mode.color}`} />
                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                          {mode.label}
                        </span>
                        {mode.badge && (
                          <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                            {mode.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-300 font-medium mt-1 leading-normal">
                        {mode.sublabel}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Auto-attached confirmation banner */}
            {(shareMode === 'excel' || shareMode === 'all') && (
              <div className="mt-3.5 p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-start gap-3 text-sm text-emerald-900 dark:text-emerald-100">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <strong>Auto-Generated Responses Sheet:</strong> Live data from the Responses Tab (
                  <span className="font-bold underline">{responsesCount} inspection record{responsesCount === 1 ? '' : 's'}</span>
                  ) will be converted to <strong>{formTitle.replace(/\s+/g, '_')}_Responses.xlsx</strong> and attached to the email.
                  <span className="block text-xs font-medium text-emerald-700 dark:text-emerald-300 mt-1 leading-normal">
                    No file selection needed — the system compiles all inspection answers, chassis numbers, and defects straight away!
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* RECIPIENTS SECTION */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <label className="text-sm font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                  Recipients
                </label>
                {(mainCount > 0 || ccCount > 0 || waCount > 0) && (
                  <div className="flex items-center gap-1.5">
                    {mainCount > 0 && (
                      <span className="text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 px-2.5 py-0.5 rounded-full">
                        {mainCount} Main (To)
                      </span>
                    )}
                    {ccCount > 0 && (
                      <span className="text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200 px-2.5 py-0.5 rounded-full">
                        {ccCount} CC Sender
                      </span>
                    )}
                    {waCount > 0 && (
                      <span className="text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 px-2.5 py-0.5 rounded-full">
                        {waCount} WhatsApp
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 1. MAIN SENDER / PRIMARY RECIPIENT (TO) */}
            <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/25 border border-blue-200 dark:border-blue-900/60 rounded-2xl space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    To
                  </div>
                  <span className="text-sm font-bold text-blue-950 dark:text-blue-200">
                    Main Sender / Primary Recipient (To)
                  </span>
                  <span className="text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 rounded-md">
                    Required
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddInviteRow('email')}
                  className="text-xs font-bold text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100 flex items-center gap-1 hover:underline cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add another To
                </button>
              </div>

              {invites
                .map((invite, index) => ({ invite, index }))
                .filter(({ invite }) => invite.type === 'email')
                .map(({ invite, index }, idx, arr) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="email"
                        placeholder="Primary Email (e.g. priyaraj@focusengineering.in)"
                        value={invite.email}
                        onChange={(e) => handleInviteChange(index, 'email', e.target.value)}
                        className="w-full px-4 py-2.5 text-sm font-medium border border-blue-200 dark:border-blue-800 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-hidden transition-all shadow-2xs"
                      />
                    </div>
                    {channels.includes('whatsapp') && (
                      <input
                        type="tel"
                        placeholder="Phone (optional)"
                        value={invite.phone || ''}
                        onChange={(e) => handleInviteChange(index, 'phone', e.target.value)}
                        className="w-36 px-3 py-2.5 text-sm border border-blue-200 dark:border-blue-800 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 outline-hidden"
                      />
                    )}
                    {arr.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveInvite(index)}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors cursor-pointer"
                        title="Remove recipient"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
            </div>

            {/* 2. CC SENDER / QUALITY AUDITOR (CC) */}
            <div className="p-3.5 bg-purple-50/50 dark:bg-purple-950/25 border border-purple-200 dark:border-purple-900/60 rounded-2xl space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    CC
                  </div>
                  <span className="text-sm font-bold text-purple-950 dark:text-purple-200">
                    CC Sender / Quality Auditor (CC)
                  </span>
                  <span className="text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/50 px-2 py-0.5 rounded-md">
                    Optional
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddInviteRow('email_cc')}
                  className="text-xs font-bold text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-purple-100 flex items-center gap-1 hover:underline cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add another CC
                </button>
              </div>

              {invites
                .map((invite, index) => ({ invite, index }))
                .filter(({ invite }) => invite.type === 'email_cc')
                .map(({ invite, index }, idx, arr) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="email"
                        placeholder="CC Email (e.g. bharathanvicky@gmail.com)"
                        value={invite.email}
                        onChange={(e) => handleInviteChange(index, 'email', e.target.value)}
                        className="w-full px-4 py-2.5 text-sm font-medium border border-purple-200 dark:border-purple-800 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-hidden transition-all shadow-2xs"
                      />
                    </div>
                    {channels.includes('whatsapp') && (
                      <input
                        type="tel"
                        placeholder="Phone (optional)"
                        value={invite.phone || ''}
                        onChange={(e) => handleInviteChange(index, 'phone', e.target.value)}
                        className="w-36 px-3 py-2.5 text-sm border border-purple-200 dark:border-purple-800 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 outline-hidden"
                      />
                    )}
                    {arr.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveInvite(index)}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors cursor-pointer"
                        title="Remove CC recipient"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
            </div>

            {/* 3. WHATSAPP RECIPIENTS (if channel active) */}
            {channels.includes('whatsapp') && (
              <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                      WA
                    </div>
                    <span className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
                      WhatsApp Recipient(s)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddInviteRow('whatsapp')}
                    className="text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add WhatsApp
                  </button>
                </div>

                {invites
                  .map((invite, index) => ({ invite, index }))
                  .filter(({ invite }) => invite.type === 'whatsapp')
                  .map(({ invite, index }) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="tel"
                        placeholder="Mobile Number with Country Code (e.g. +919876543210)"
                        value={invite.phone || ''}
                        onChange={(e) => handleInviteChange(index, 'phone', e.target.value)}
                        className="flex-1 px-4 py-2.5 text-sm font-medium border border-emerald-200 dark:border-emerald-800 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveInvite(index)}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors cursor-pointer"
                        title="Remove WhatsApp recipient"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
              </div>
            )}

            {/* Optional Bulk Contact Import Collapsible */}
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowBulkUpload(!showBulkUpload)}
                className="text-xs sm:text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1.5 font-semibold"
              >
                {showBulkUpload ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {showBulkUpload ? 'Hide Bulk Recipient Import' : 'Or bulk import contacts from CSV / Excel list (Optional)'}
              </button>

              {showBulkUpload && (
                <div className="mt-2.5 p-3.5 bg-slate-50 dark:bg-gray-900/50 rounded-xl border border-slate-200 dark:border-gray-700 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                      Import Contacts File (Columns: Main Sender, CC Sender, Mobile)
                    </span>
                    <button
                      type="button"
                      onClick={handleDownloadSample}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Sample CSV
                    </button>
                  </div>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="block w-full text-xs sm:text-sm text-gray-600 dark:text-gray-400
                      file:mr-4 file:py-2 file:px-3.5
                      file:rounded-xl file:border-0
                      file:text-xs file:font-semibold
                      file:bg-indigo-50 file:text-indigo-700
                      hover:file:bg-indigo-100
                      file:cursor-pointer"
                  />
                  {uploadStats && (
                    <div className="mt-2.5 flex items-center gap-2 text-xs">
                      <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                        ✓ Imported {uploadStats.total} contacts ({uploadStats.toCount} To, {uploadStats.ccCount} CC)
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Delivery Channels Selection */}
          <div>
            <label className="block text-sm font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200 mb-2.5">
              Delivery Channels
            </label>
            <div className="flex flex-wrap gap-3.5">
              {[
                { id: 'email', label: 'Email (SMTP Automated)', icon: Mail, color: 'text-blue-600' },
                { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: 'text-emerald-600' },
                { id: 'sms', label: 'SMS', icon: Send, color: 'text-purple-600' }
              ].map((channel) => {
                const Icon = channel.icon;
                const isChecked = channels.includes(channel.id);
                return (
                  <label
                    key={channel.id}
                    className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border cursor-pointer transition-all ${
                      isChecked
                        ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 dark:border-indigo-700 shadow-xs'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setChannels([...channels, channel.id]);
                        } else {
                          setChannels(channels.filter(c => c !== channel.id));
                        }
                      }}
                      className="w-4 h-4 text-indigo-600 rounded-sm"
                    />
                    <Icon className={`w-4 h-4 ${channel.color}`} />
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{channel.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Custom Message */}
          <div>
            <label className="block text-sm font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200 mb-2">
              Custom Message (Optional)
            </label>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="e.g., Please review the attached inspection responses Excel workbook for this chassis unit..."
              className="w-full px-4 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-none h-20 placeholder-gray-400"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4.5 border-t border-gray-200 dark:border-gray-700 bg-slate-50/80 dark:bg-gray-800/80">
          <div className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-2 font-medium">
            <Info className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Sends automated email with Responses Tab Excel attached to Main To with CC copy.</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isSending}
              className="px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={isSending || invites.length === 0}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-xs hover:shadow-md"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{sendingStep || 'Generating Excel & Sending...'}</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send Responses Excel ({invites.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 px-5 py-3 rounded-xl shadow-2xl text-white text-sm font-bold z-[99999] flex items-center gap-2.5 animate-in slide-in-from-bottom-2 duration-200 ${
            toast.type === 'success'
              ? 'bg-emerald-600'
              : toast.type === 'error'
                ? 'bg-rose-600'
                : 'bg-indigo-600'
          }`}
        >
          {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-white shrink-0" />}
          {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-white shrink-0" />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};

export default ShareAnalyticsModal;