import React from "react";
import {
  X,
  Award,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Truck,
  RotateCcw,
  Sparkles,
  Layers,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

interface PerformanceGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PerformanceGuideModal: React.FC<PerformanceGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="relative px-6 py-5 bg-gradient-to-r from-purple-700 via-indigo-700 to-blue-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/15 backdrop-blur-md shadow-xs border border-white/20">
              <Award className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                <span>How Does the Performance Table Work?</span>
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/20">
                  Metrics & Evaluation
                </span>
              </h2>
              <p className="text-xs text-white/80 font-medium mt-0.5">
                Comprehensive guide to inspector accountability, formulas, review stages, and ratings
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto p-5 sm:p-6 space-y-6 text-gray-700 dark:text-gray-300 text-sm">
          {/* Section 1: Performance Score Calculation Formula */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-purple-50 via-indigo-50/50 to-blue-50 dark:from-purple-950/30 dark:via-indigo-950/20 dark:to-blue-950/20 border border-purple-200/60 dark:border-purple-800/50">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h3 className="text-sm font-black uppercase tracking-wider text-purple-900 dark:text-purple-200">
                1. Performance Score Calculation Formula
              </h3>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mb-3">
              The <strong>Performance Score</strong> evaluates the overall inspection quality and defect-free rate of each inspector. It dynamically reflects both first-time inspection results and subsequent secondary reviews:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 bg-white dark:bg-gray-800 rounded-xl border border-purple-200 dark:border-purple-800 shadow-2xs space-y-1.5">
                <span className="font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider text-[11px] block">
                  A. Secondary Review Formula (BIW & TVS)
                </span>
                <div className="py-2 px-3 bg-purple-50 dark:bg-purple-950/50 rounded-lg font-mono text-center font-bold text-purple-950 dark:text-purple-200 border border-purple-200 dark:border-purple-900 text-xs">
                  Score = (Total Accepted Reviews ÷ Total Reviewed) × 100
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  When chassis units have undergone secondary review (BIW or TVS Quality Review), the score directly measures the ratio of approved units vs rejections or reworks.
                </p>
              </div>

              <div className="p-3.5 bg-white dark:bg-gray-800 rounded-xl border border-indigo-200 dark:border-indigo-800 shadow-2xs space-y-1.5">
                <span className="font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider text-[11px] block">
                  B. Submission Baseline Formula (Unreviewed)
                </span>
                <div className="py-2 px-3 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg font-mono text-center font-bold text-indigo-950 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-900 text-xs">
                  Score = ((Submitted − Defects − Rejected) ÷ Submitted) × 100
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  For chassis awaiting review, the score is based on the initial inspection submission: units with zero defects score 100%, while reported reworks reduce the rate.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Performance Rating Tiers */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">
                2. Performance Rating Tiers
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-extrabold text-emerald-800 dark:text-emerald-300">
                    ≥ 90%
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-xs font-black text-emerald-900 dark:text-emerald-200 uppercase tracking-wider">
                  Exemplary Performer
                </p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1">
                  Highest factory standard. Exceptional first-time-right quality.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-extrabold text-blue-800 dark:text-blue-300">
                    80% – 89%
                  </span>
                  <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-xs font-black text-blue-900 dark:text-blue-200 uppercase tracking-wider">
                  Exceeded Performance
                </p>
                <p className="text-[11px] text-blue-700 dark:text-blue-400 mt-1">
                  Consistently strong inspection diligence and low defect turnaround.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-extrabold text-amber-800 dark:text-amber-300">
                    70% – 79%
                  </span>
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <p className="text-xs font-black text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                  Met Expectation
                </p>
                <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
                  Acceptable threshold meeting standard manufacturing requirements.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-extrabold text-red-800 dark:text-red-300">
                    &lt; 70%
                  </span>
                  <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                </div>
                <p className="text-xs font-black text-red-900 dark:text-red-200 uppercase tracking-wider">
                  Partially Met Performer
                </p>
                <p className="text-[11px] text-red-700 dark:text-red-400 mt-1">
                  Frequent rework or rejections detected; requires supervisor attention.
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Column Directory */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">
                3. Column Directory & Field Definitions
              </h3>
            </div>

            <div className="space-y-3">
              {/* Group A */}
              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/80">
                <span className="text-[11px] font-black uppercase tracking-wider text-gray-800 dark:text-gray-200 block mb-2">
                  A. Inspection & Dispatch Columns
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-emerald-600 shrink-0 w-36">Direct Ok:</span>
                    <span className="text-gray-600 dark:text-gray-300">Chassis units passed on initial inspection with 0 defects.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-blue-600 shrink-0 w-36">Rework QC Completed:</span>
                    <span className="text-gray-600 dark:text-gray-300">Units that had defects, underwent correction, and were verified.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-yellow-600 shrink-0 w-36">Rework QC Pending:</span>
                    <span className="text-gray-600 dark:text-gray-300">Chassis with open defect checkpoints currently awaiting rework.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-red-600 shrink-0 w-36">Rejected:</span>
                    <span className="text-gray-600 dark:text-gray-300">Units that failed critical parameters and cannot proceed.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-orange-600 shrink-0 w-36">Dispatch Pending:</span>
                    <span className="text-gray-600 dark:text-gray-300">Approved units cleared and queued for vehicle dispatch.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-purple-600 shrink-0 w-36">Dispatched:</span>
                    <span className="text-gray-600 dark:text-gray-300">Units officially marked as dispatched from the facility.</span>
                  </div>
                  <div className="flex items-start gap-2 md:col-span-2">
                    <span className="font-bold text-gray-900 dark:text-white shrink-0 w-36">Total Submitted:</span>
                    <span className="text-gray-600 dark:text-gray-300">Total chassis inspection forms submitted by this inspector.</span>
                  </div>
                </div>
              </div>

              {/* Group B */}
              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/80">
                <span className="text-[11px] font-black uppercase tracking-wider text-gray-800 dark:text-gray-200 block mb-2">
                  B. Secondary Quality Review Columns (BIW & TVS QA)
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-gray-800 dark:text-gray-200 shrink-0 w-36">Total Reviewed:</span>
                    <span className="text-gray-600 dark:text-gray-300">Inspections reviewed by QA supervisors (BIW / TVS).</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-gray-500 shrink-0 w-36">Review Pending:</span>
                    <span className="text-gray-600 dark:text-gray-300">Submissions awaiting secondary quality verification.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-emerald-600 shrink-0 w-36">Accepted:</span>
                    <span className="text-gray-600 dark:text-gray-300">Secondary review approved without issues.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-red-600 shrink-0 w-36">Rejected:</span>
                    <span className="text-gray-600 dark:text-gray-300">Rejected during review (directly lowers inspector rate).</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-amber-600 shrink-0 w-36">Reworked:</span>
                    <span className="text-gray-600 dark:text-gray-300">Returned for rework (directly lowers inspector rate).</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Connected Forms Accountability */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
            <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <span className="font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider text-[11px] block">
                Connected Forms Accountability (Main Form vs. Child Form)
              </span>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                When reviewing a unit with linked inspection checklists (e.g., <em>Chassis N603 Working Priya</em> as Main Form and <em>N603 Paint working Priya</em> as Child Form), switching tabs in the TVS Review modal assigns the review and any rework/rejection to that exact form and its respective submitter. This ensures each inspector is evaluated strictly for their assigned checkpoints.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/60 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            Click outside or press Close to dismiss
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-all shadow-xs cursor-pointer active:scale-95"
          >
            Got it, Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PerformanceGuideModal;
