import React from "react";

// Function to render message with images
export const renderMessageWithImages = (message: string) => {
  if (!message) return null;

  // Split message by image markdown syntax
  const parts = message.split(/(!\[.*?\]\(.*?\))/g);

  return (
    <div className="space-y-2">
      {parts.map((part, index) => {
        // Check if this part is an image markdown
        const imageMatch = part.match(/!\[.*?\]\((.*?)\)/);
        if (imageMatch) {
          const imageUrl = imageMatch[1];
          return (
            <div key={index} className="inline-block">
              <img
                src={imageUrl}
                alt="Evidence"
                className="max-w-32 max-h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => window.open(imageUrl, "_blank")}
                onError={(e) => {
                  console.error("Image failed to load:", imageUrl);
                  e.currentTarget.style.display = "none";
                  const fallback = document.createElement("div");
                  fallback.className = "text-xs text-red-500 mt-1";
                  fallback.textContent = "Image failed to load";
                  e.currentTarget.parentNode?.appendChild(fallback);
                }}
              />
            </div>
          );
        }
        // Regular text part
        return part.trim() ? (
          <span key={index} className="whitespace-pre-wrap">
            {part}
          </span>
        ) : null;
      })}
    </div>
  );
};

export const formatChatAnswerValue = (val: any): React.ReactNode => {
  if (val === undefined || val === null || val === "") {
    return <span className="text-gray-400 italic">No response</span>;
  }
  let parsed = val;
  if (typeof parsed === "string" && parsed.trim().startsWith("{") && parsed.trim().endsWith("}")) {
    try {
      parsed = JSON.parse(parsed);
    } catch { }
  }
  if (typeof parsed === "object" && parsed !== null) {
    if (parsed.status !== undefined || parsed.remark !== undefined || parsed.evidenceUrl !== undefined) {
      const s = String(parsed.status || "").trim();
      const norm = s.toLowerCase();
      const isOk = norm === "accepted" || norm === "direct ok" || norm === "ok";
      const isDefect = norm === "rejected" || norm.includes("rework") || norm === "not ok";
      return (
        <span className="inline-flex items-center gap-1.5 flex-wrap">
          {s && (
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${isOk
                ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border border-green-200 dark:border-green-800"
                : isDefect
                  ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-800"
                  : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200"
                }`}
            >
              {s}
            </span>
          )}
          {parsed.remark && String(parsed.remark).trim() && (
            <span className="text-[11px] text-gray-600 dark:text-gray-300 font-medium">
              Remark: <span className="italic font-normal">"{String(parsed.remark).trim()}"</span>
            </span>
          )}
          {parsed.evidenceUrl && String(parsed.evidenceUrl).trim() && (
            <a
              href={parsed.evidenceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 underline hover:text-indigo-800"
            >
              [View Photo]
            </a>
          )}
        </span>
      );
    }
    if (parsed.chassisNumber) {
      return <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">{parsed.chassisNumber}</span>;
    }
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return <span className="text-gray-400 italic">No response</span>;
      return <span className="text-gray-700 dark:text-gray-300">{parsed.map((p) => (typeof p === "object" ? (p?.name || p?.label || JSON.stringify(p)) : String(p))).join(", ")}</span>;
    }
    const cleanEntries = Object.entries(parsed).filter(([k, v]) => Boolean(v) && typeof v !== "object");
    if (cleanEntries.length > 0) {
      return (
        <span className="inline-flex items-center gap-1.5 flex-wrap">
          {cleanEntries.map(([k, v], i) => (
            <span key={i} className="text-[11px] text-gray-700 dark:text-gray-300">
              <span className="font-semibold text-gray-500 text-[10px] uppercase mr-0.5">{k}:</span>
              {String(v)}
            </span>
          ))}
        </span>
      );
    }
  }
  return <span className="text-gray-800 dark:text-gray-200 font-medium">{String(parsed)}</span>;
};
