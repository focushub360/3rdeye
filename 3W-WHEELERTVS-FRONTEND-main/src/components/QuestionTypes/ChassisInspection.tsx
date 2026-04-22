import React, { useState, useRef } from "react";
import type { FollowUpQuestion } from "../../types";

interface ChassisInspectionProps {
  question: FollowUpQuestion;
  value: any;
  onChange?: (value: any) => void;
  readOnly?: boolean;
  showZone?: boolean;
}

const ZONE_OPTIONS = [
  "Zone 1",
  "Zone 2",
  "Zone 3",
  "Zone 4",
  "Zone 5",
  "Zone 6",
];

type InspectionStatus = "Accepted" | "Rework" | "Rejected" | "";

export default function ChassisInspection({
  question,
  value,
  onChange,
  readOnly = false,
  showZone = false,
}: ChassisInspectionProps) {
  // value shape: { status: string, zone?: string, evidencePhotos?: string[], remarks?: string }
  const parsed = typeof value === "object" && value !== null ? value : {};
  const status: InspectionStatus = parsed.status || "";
  const zone: string = parsed.zone || "";
  const evidencePhotos: string[] = parsed.evidencePhotos || [];
  const remarks: string = parsed.remarks || "";

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const updateValue = (updates: Record<string, any>) => {
    if (readOnly || !onChange) return;
    onChange({ ...parsed, ...updates });
  };

  const handleStatusChange = (newStatus: InspectionStatus) => {
    if (readOnly) return;
    updateValue({ status: newStatus === status ? "" : newStatus });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly || !onChange) return;
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        const current =
          typeof value === "object" && value !== null
            ? value.evidencePhotos || []
            : [];
        updateValue({ evidencePhotos: [...current, dataUrl] });
      };
      reader.readAsDataURL(file);
    });

    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const removePhoto = (index: number) => {
    if (readOnly) return;
    const updated = [...evidencePhotos];
    updated.splice(index, 1);
    updateValue({ evidencePhotos: updated });
  };

  const statusConfig = [
    {
      key: "Accepted" as InspectionStatus,
      label: "ACCEPTED",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      activeClasses: "bg-emerald-50 border-emerald-400 text-emerald-700 ring-2 ring-emerald-200",
      hoverClasses: "hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-600",
    },
    {
      key: "Rework" as InspectionStatus,
      label: "REWORK",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      ),
      activeClasses: "bg-amber-50 border-amber-400 text-amber-700 ring-2 ring-amber-200",
      hoverClasses: "hover:bg-amber-50 hover:border-amber-300 hover:text-amber-600",
    },
    {
      key: "Rejected" as InspectionStatus,
      label: "REJECTED",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      activeClasses: "bg-red-50 border-red-400 text-red-700 ring-2 ring-red-200",
      hoverClasses: "hover:bg-red-50 hover:border-red-300 hover:text-red-600",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Zone Selector (only for chassis-with-zone) */}
      {showZone && (
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Zone
          </label>
          <div className="flex flex-wrap gap-2">
            {ZONE_OPTIONS.map((z) => (
              <button
                key={z}
                type="button"
                disabled={readOnly}
                onClick={() => updateValue({ zone: zone === z ? "" : z })}
                className={`px-3 py-1.5 text-sm rounded-full border transition-all ${
                  zone === z
                    ? "bg-blue-100 border-blue-400 text-blue-700 font-semibold ring-1 ring-blue-200"
                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                } ${readOnly ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
              >
                {z}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Inspection Status */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Inspection Status
        </label>
        <div className="grid grid-cols-3 gap-3">
          {statusConfig.map((s) => (
            <button
              key={s.key}
              type="button"
              disabled={readOnly}
              onClick={() => handleStatusChange(s.key)}
              className={`flex flex-col items-center justify-center py-3 px-2 border rounded-xl transition-all duration-200 ${
                status === s.key ? s.activeClasses : `bg-white border-gray-200 text-gray-400 ${s.hoverClasses}`
              } ${readOnly ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
            >
              {s.icon}
              <span className="mt-1 text-xs font-bold tracking-wide">
                {s.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Evidence Photo */}
      <div>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Evidence Photo
        </label>

        {/* Uploaded Photos */}
        {evidencePhotos.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {evidencePhotos.map((photo: string, idx: number) => (
              <div key={idx} className="relative group">
                <img
                  src={photo}
                  alt={`Evidence ${idx + 1}`}
                  className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                />
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => removePhoto(idx)}
                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Upload / Camera Buttons */}
        {!readOnly && (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center py-4 px-3 border-2 border-dashed border-gray-300 rounded-xl bg-white hover:bg-gray-50 hover:border-gray-400 transition-all text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <span className="text-xs font-medium">Upload</span>
            </button>

            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex flex-col items-center justify-center py-4 px-3 border-2 border-dashed border-gray-300 rounded-xl bg-white hover:bg-gray-50 hover:border-gray-400 transition-all text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.04l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
              <span className="text-xs font-medium">Camera</span>
            </button>

            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        )}
      </div>

      {/* Remarks (shown when Rework or Rejected) */}
      {(status === "Rework" || status === "Rejected") && (
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Remarks
          </label>
          <textarea
            value={remarks}
            onChange={(e) => updateValue({ remarks: e.target.value })}
            disabled={readOnly}
            placeholder="Enter remarks..."
            rows={3}
            className={`w-full px-4 py-2 border border-gray-300 rounded-lg text-sm ${
              readOnly
                ? "bg-gray-100 cursor-not-allowed"
                : "bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            }`}
          />
        </div>
      )}
    </div>
  );
}
