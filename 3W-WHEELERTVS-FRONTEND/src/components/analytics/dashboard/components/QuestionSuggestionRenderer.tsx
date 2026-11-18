import React, { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Upload, Camera, Loader2 } from "lucide-react";
import { apiClient } from "../../../../api/client";
import CameraCapture from "../../../forms/CameraCapture";

export const QuestionSuggestionRenderer = ({
  question,
  value,
  onChange,
  currentAnswer,
  readOnly = false,
}: {
  question: any;
  value: any;
  onChange?: (val: any) => void;
  currentAnswer?: any;
  readOnly?: boolean;
}) => {
  const [uploading, setUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showPhotoSection, setShowPhotoSection] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // All values stored flat in the value object
  const safeValue = typeof value === "object" && value !== null ? value : {};
  const status = safeValue.inspectionStatus || "";
  const remark = (safeValue.inspectionRemark || safeValue.remark || "").trim();
  const fileUrl = (safeValue.inspectionFileUrl || safeValue.fileUrl || "").trim();

  const update = (patch: Record<string, any>) => {
    if (readOnly || !onChange) return;
    onChange({ ...safeValue, ...patch });
  };

  const handleFileUpload = async (file: File) => {
    try {
      setUploading(true);
      const result = await apiClient.uploadFile(file, "form");
      const url = apiClient.resolveUploadedFileUrl(result);
      if (url) {
        update({ inspectionFileUrl: url });
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  // In read-only mode, only show sections that were actually filled
  if (readOnly) {
    const hasRemark = Boolean(remark);
    const hasPhoto = Boolean(fileUrl);

    if (!hasRemark && !hasPhoto) {
      return null;
    }

    return (
      <div className="space-y-2 mt-1.5" onClick={(e) => e.stopPropagation()}>
        {hasRemark && (
          <div className="p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
            <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest block mb-1">
              Remark
            </span>
            <p className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed font-medium">
              {remark}
            </p>
          </div>
        )}

        {hasPhoto && (
          <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
            <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest block mb-1.5">
              Evidence Photo
            </span>
            <img
              src={fileUrl}
              alt="Evidence"
              className="max-h-56 max-w-full rounded-lg border border-blue-200 dark:border-blue-700 cursor-pointer object-cover hover:opacity-90 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                window.open(fileUrl, "_blank");
              }}
            />
          </div>
        )}
      </div>
    );
  }

  // Editable mode (when composing feedback)
  const hasPhoto = Boolean(fileUrl);

  return (
    <div className="space-y-2 mt-2" onClick={(e) => e.stopPropagation()}>
      {/* Remark */}
      <div
        className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800"
        onClick={(e) => e.stopPropagation()}
      >
        <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest block mb-1">
          Remark
        </label>
        <textarea
          rows={2}
          value={remark}
          onChange={(e) => {
            e.stopPropagation();
            update({ inspectionRemark: e.target.value });
          }}
          onKeyDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          placeholder="Enter remark..."
          className="w-full p-2 text-xs bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-700 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none resize-none"
        />
      </div>

      {/* Evidence Photo */}
      {hasPhoto || showPhotoSection ? (
        <div
          className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 animate-in fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest block">
              Evidence Photo
            </label>
            {!uploading && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  update({ inspectionFileUrl: "" });
                  setShowPhotoSection(false);
                }}
                className="text-[10px] text-gray-400 hover:text-red-500 font-bold"
              >
                ✕ Cancel / Remove
              </button>
            )}
          </div>

          {hasPhoto ? (
            <div className="flex gap-2">
              <label className="flex-1 cursor-pointer group relative">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onClick={(e) => e.stopPropagation()}
                  onChange={async (e) => {
                    e.stopPropagation();
                    const file = e.target.files?.[0];
                    if (file) await handleFileUpload(file);
                  }}
                />
                <img
                  src={fileUrl}
                  alt="Evidence"
                  className="w-full h-28 object-cover rounded-lg border-2 border-emerald-400"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(fileUrl, "_blank");
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg pointer-events-none">
                  <span className="text-[10px] text-white font-bold">Change</span>
                </div>
              </label>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCamera(true);
                }}
                className="flex-1 flex flex-col items-center justify-center gap-1 p-3 border-2 border-dashed border-purple-300 dark:border-purple-700 rounded-lg hover:border-purple-500 transition-colors"
              >
                <Camera className="w-4 h-4 text-purple-500" />
                <span className="text-[9px] text-purple-500 font-bold">
                  Camera
                </span>
              </button>
            </div>
          ) : uploading ? (
            <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg">
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              <span className="text-xs text-blue-600 dark:text-blue-400">
                Uploading...
              </span>
            </div>
          ) : (
            <div className="flex gap-2">
              <label className="flex-1 cursor-pointer">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onClick={(e) => e.stopPropagation()}
                  onChange={async (e) => {
                    e.stopPropagation();
                    const file = e.target.files?.[0];
                    if (file) await handleFileUpload(file);
                  }}
                />
                <div className="flex flex-col items-center justify-center gap-1 p-3 border-2 border-dashed border-blue-200 dark:border-blue-700 rounded-lg hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all">
                  <Upload className="w-4 h-4 text-blue-400" />
                  <span className="text-[9px] text-blue-500 dark:text-blue-400 font-bold">
                    Upload Photo
                  </span>
                </div>
              </label>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCamera(true);
                }}
                className="flex-1 flex flex-col items-center justify-center gap-1 p-3 border-2 border-dashed border-purple-200 dark:border-purple-700 rounded-lg hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-colors"
              >
                <Camera className="w-4 h-4 text-purple-400" />
                <span className="text-[9px] text-purple-500 dark:text-purple-400 font-bold">
                  Camera
                </span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowPhotoSection(true);
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg border border-dashed border-blue-200 dark:border-blue-800 transition-colors"
        >
          <Camera className="w-3.5 h-3.5" />
          <span>+ Add Evidence Photo</span>
        </button>
      )}

      {/* Camera modal */}
      {showCamera &&
        createPortal(
          <CameraCapture
            onCapture={async (file: File) => {
              await handleFileUpload(file);
              setShowCamera(false);
            }}
            onClose={() => setShowCamera(false)}
          />,
          document.body,
        )}
    </div>
  );
};

export default QuestionSuggestionRenderer;
