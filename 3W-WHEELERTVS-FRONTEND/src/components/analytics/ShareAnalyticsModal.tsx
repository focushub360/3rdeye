// ShareAnalyticsModal.tsx
import React, { useState } from 'react';
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
  Info
} from 'lucide-react';
import { apiClient } from '../../api/client';

interface ShareAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  formId: string;
  formTitle: string;
  analyticsData?: any;
}

export interface InviteItem {
  type: 'email' | 'email_cc' | 'whatsapp';
  email: string;
  phone?: string;
}

const ShareAnalyticsModal: React.FC<ShareAnalyticsModalProps> = ({
  isOpen,
  onClose,
  formId,
  formTitle,
  analyticsData
}) => {
  // State declarations
  const [invites, setInvites] = useState<InviteItem[]>([]);
  const [channels, setChannels] = useState<string[]>(['email']);
  const [customMessage, setCustomMessage] = useState('');
  const [shareMode, setShareMode] = useState<'link' | 'pdf' | 'both'>('both');
  const [isSending, setIsSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStats, setUploadStats] = useState<{ total: number; toCount: number; ccCount: number } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Show toast helper
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Download Sample Excel Template
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
    link.setAttribute("download", `Share_Analytics_Template_${formTitle.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Sample Excel/CSV template downloaded!", "info");
  };

  // Handle file upload
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

        setInvites(invitesFromFile);
        const toCount = data.toCount ?? invitesFromFile.filter(i => i.type !== 'email_cc').length;
        const ccCount = data.ccCount ?? invitesFromFile.filter(i => i.type === 'email_cc').length;
        setUploadStats({
          total: invitesFromFile.length,
          toCount,
          ccCount
        });

        showToast(
          `Uploaded ${invitesFromFile.length} invites (${toCount} Main To, ${ccCount} CC)`,
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

  // Handle adding manual invites
  const handleAddInvite = (defaultType: 'email' | 'email_cc' | 'whatsapp' = 'email') => {
    setInvites([...invites, { type: defaultType, email: '', phone: '' }]);
  };

  const handleRemoveInvite = (index: number) => {
    setInvites(invites.filter((_, i) => i !== index));
  };

  const handleInviteChange = (
    index: number,
    field: 'email' | 'phone' | 'type',
    value: string
  ) => {
    const updated = [...invites];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    setInvites(updated);
  };

  // Counts
  const mainCount = invites.filter(i => i.type === 'email').length;
  const ccCount = invites.filter(i => i.type === 'email_cc').length;
  const waCount = invites.filter(i => i.type === 'whatsapp').length;

  // Handle send
  const handleSend = async () => {
    const validInvites = invites.filter(
      invite => (invite.email && invite.email.trim().length > 0) || (invite.phone && invite.phone.trim().length > 0)
    );

    if (validInvites.length === 0) {
      showToast('Please add or upload at least one valid recipient (email or phone)', 'error');
      return;
    }

    if (channels.length === 0) {
      showToast('Please select at least one channel (Email, WhatsApp, or SMS)', 'error');
      return;
    }

    try {
      setIsSending(true);

      let pdfHtml = '';
      if (shareMode === 'pdf' || shareMode === 'both') {
        pdfHtml = generateAnalyticsPDFHtml(formTitle, analyticsData);
      }

      const result: any = await apiClient.sendAnalyticsInvites(
        formId,
        validInvites,
        channels,
        customMessage || 'Please review the analytics report.',
        pdfHtml,
        shareMode
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
        const ccMsg = ccCountSent > 0 ? ` (with ${ccCountSent} CC recipient${ccCountSent === 1 ? '' : 's'})` : '';
        showToast(
          `Automated email delivery complete: Sent ${sent} invite${sent === 1 ? '' : 's'}${ccMsg}!`,
          'success'
        );
        setTimeout(() => {
          setInvites([]);
          setCustomMessage('');
          setUploadStats(null);
          onClose();
        }, 2200);
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
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-gray-100 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-800/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white leading-tight">
                Share Analytics: {formTitle}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Automated email & CC invite dispatch with report attachment
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-200/60 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Guaranteed Automated Delivery Notice */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 px-6 py-2.5 border-b border-blue-100 dark:border-blue-900/30 flex items-center gap-2.5 text-xs text-blue-900 dark:text-blue-200">
          <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <span>
            <strong>Automated Server Mail:</strong> Emails are delivered directly in the background with Main Senders & CC Senders attached. No external Gmail app redirect required.
          </span>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Upload Section */}
          <div className="bg-slate-50 dark:bg-gray-900/50 p-4 rounded-xl border border-slate-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Upload Invites (Excel / CSV)
              </label>
              <button
                type="button"
                onClick={handleDownloadSample}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1 transition-colors"
                title="Download formatted sample Excel/CSV template"
              >
                <Download className="w-3.5 h-3.5" />
                Sample Template
              </button>
            </div>

            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
              Supported columns: <strong>Main Sender (To)</strong>, <strong>CC Sender (CC)</strong>, and <strong>Phone/Mobile</strong>.
            </p>

            <div className="flex items-center gap-3">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                disabled={uploading}
                className="block w-full text-xs text-gray-500 dark:text-gray-400
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-xl file:border-0
                  file:text-xs file:font-bold
                  file:bg-indigo-600 file:text-white
                  hover:file:bg-indigo-700
                  file:cursor-pointer transition-all"
              />
            </div>

            {uploading && (
              <div className="flex items-center gap-2 mt-2 text-indigo-600 dark:text-indigo-400 text-xs">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Parsing Excel columns & recipients...</span>
              </div>
            )}

            {uploadStats && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 font-bold">
                  <CheckCircle className="w-3.5 h-3.5" />
                  {uploadStats.total} Total Invites
                </span>
                <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-semibold text-[11px]">
                  {uploadStats.toCount} Main To
                </span>
                <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-semibold text-[11px]">
                  {uploadStats.ccCount} CC Sender
                </span>
              </div>
            )}
          </div>

          {/* Invites Management */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Recipients ({invites.length})
                </label>
                {invites.length > 0 && (
                  <span className="text-[11px] text-gray-500">
                    ({mainCount} Main, {ccCount} CC{waCount > 0 ? `, ${waCount} WhatsApp` : ''})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleAddInvite('email')}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" /> Main (To)
                </button>
                <button
                  type="button"
                  onClick={() => handleAddInvite('email_cc')}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1 transition-all"
                >
                  <Copy className="w-3.5 h-3.5" /> CC Sender
                </button>
              </div>
            </div>

            {invites.length === 0 ? (
              <div className="text-center py-6 px-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-gray-400 text-xs">
                Upload an Excel sheet or click <strong>+ Main (To)</strong> / <strong>+ CC Sender</strong> to add recipients.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {invites.map((invite, index) => {
                  const isCC = invite.type === 'email_cc';
                  const isWA = invite.type === 'whatsapp';

                  return (
                    <div
                      key={index}
                      className={`flex gap-2 items-center p-1.5 rounded-xl border transition-all ${
                        isCC
                          ? 'border-purple-200 bg-purple-50/40 dark:border-purple-900 dark:bg-purple-950/20'
                          : isWA
                            ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20'
                            : 'border-slate-200 bg-slate-50/40 dark:border-gray-700 dark:bg-gray-900/40'
                      }`}
                    >
                      <select
                        value={invite.type}
                        onChange={(e) => handleInviteChange(index, 'type', e.target.value)}
                        className={`w-32 px-2.5 py-1.5 text-xs font-bold rounded-lg border outline-hidden transition-all ${
                          isCC
                            ? 'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950 dark:text-purple-200'
                            : isWA
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200'
                              : 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950 dark:text-blue-200'
                        }`}
                      >
                        <option value="email">Main To</option>
                        <option value="email_cc">CC Sender</option>
                        <option value="whatsapp">WhatsApp</option>
                      </select>

                      <div className="flex-1 relative">
                        <input
                          type="email"
                          placeholder={isCC ? 'CC Email (e.g. manager@abc.com)' : 'Primary Email (e.g. client@abc.com)'}
                          value={invite.email}
                          onChange={(e) => handleInviteChange(index, 'email', e.target.value)}
                          className="w-full px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-medium"
                        />
                      </div>

                      <input
                        type="tel"
                        placeholder="Phone (optional)"
                        value={invite.phone || ''}
                        onChange={(e) => handleInviteChange(index, 'phone', e.target.value)}
                        className="w-28 sm:w-36 px-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-medium"
                      />

                      <button
                        type="button"
                        onClick={() => handleRemoveInvite(index)}
                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                        title="Remove recipient"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Channels Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">
              Delivery Channels
            </label>
            <div className="flex flex-wrap gap-4">
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
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border cursor-pointer transition-all ${
                      isChecked
                        ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 dark:border-indigo-700'
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
                    <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{channel.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Share Mode */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">
              Share Content Format
            </label>
            <div className="flex gap-4">
              {[
                { id: 'both', label: 'Both (Link + PDF Report)' },
                { id: 'pdf', label: 'PDF Report Only' },
                { id: 'link', label: 'Dashboard Link Only' }
              ].map((mode) => (
                <label
                  key={mode.id}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer text-xs font-semibold ${
                    shareMode === mode.id
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="shareMode"
                    checked={shareMode === mode.id}
                    onChange={() => setShareMode(mode.id as 'link' | 'pdf' | 'both')}
                    className="w-3.5 h-3.5 text-indigo-600"
                  />
                  <span>{mode.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Custom Message */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
              Custom Message (Optional)
            </label>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="e.g., Please review the quality inspection analytics report for this chassis unit..."
              className="w-full px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-none h-18"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-800/50">
          <div className="text-[11px] text-gray-500 flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-indigo-500" />
            <span>Sends direct automated email to Main recipients with CC copies.</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isSending}
              className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={isSending || invites.length === 0}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-xs hover:shadow-md"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending Automated Invites...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Invites ({invites.length})
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 px-5 py-3 rounded-xl shadow-2xl text-white text-xs font-bold z-[99999] flex items-center gap-2.5 animate-in slide-in-from-bottom-2 duration-200 ${
            toast.type === 'success'
              ? 'bg-emerald-600'
              : toast.type === 'error'
                ? 'bg-rose-600'
                : 'bg-indigo-600'
          }`}
        >
          {toast.type === 'success' && <CheckCircle className="w-4 h-4 text-white shrink-0" />}
          {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-white shrink-0" />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};

export default ShareAnalyticsModal;