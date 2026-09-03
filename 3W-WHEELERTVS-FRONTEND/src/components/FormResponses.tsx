import React, { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

/**
 * FormResponses Component
 * 
 * Automatically redirects to the full Service Analytics Responses Table (Screen 2),
 * preserving any query parameters such as batchId or upload filters so that
 * uploaded data is shown directly in the rich row-and-column table.
 */
export default function FormResponses() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      const search = window.location.search;
      const separator = search ? (search.includes("tab=") ? "" : "&") : "?";
      const targetUrl = search.includes("tab=")
        ? `/forms/${id}/analytics${search}`
        : `/forms/${id}/analytics${search ? `${search}&tab=responses` : "?tab=responses"}`;
      navigate(targetUrl, { replace: true });
    }
  }, [id, navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 bg-gray-50/50 dark:bg-gray-900/50">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-4"></div>
      <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
        Opening Responses Table...
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        Redirecting to Service Analytics Responses Table...
      </p>
    </div>
  );
}
