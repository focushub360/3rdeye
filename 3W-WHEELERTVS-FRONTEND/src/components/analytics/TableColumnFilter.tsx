import React, { useState, useRef, useEffect, useMemo } from "react";
import { Filter, Search, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

interface TableColumnFilterProps {
  columnId: string;
  title: string;
  options: string[];
  selectedValues: string[] | null;
  onFilterChange: (columnId: string, values: string[] | null) => void;
  sortDirection?: "asc" | "desc" | null;
  onSortChange?: (columnId: string, direction: "asc" | "desc" | null) => void;
}

export default function TableColumnFilter({
  columnId,
  title,
  options,
  selectedValues,
  onFilterChange,
  sortDirection = null,
  onSortChange,
}: TableColumnFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.right + window.scrollX - 256,
      });
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Orderly natural sort of options (numeric-aware: 1031 < 1032 < 1103)
  const sortedOptions = useMemo(() => {
    return [...options].sort((a, b) => {
      if (a === "") return 1;
      if (b === "") return -1;
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
    });
  }, [options]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return sortedOptions;
    const term = searchTerm.toLowerCase();
    return sortedOptions.filter((option) =>
      option.toLowerCase().includes(term)
    );
  }, [sortedOptions, searchTerm]);

  const effectiveSelectedValues = selectedValues === null ? options : selectedValues;

  const toggleOption = (option: string) => {
    let newValues: string[];

    if (selectedValues === null) {
      newValues = options.filter((o) => o !== option);
    } else {
      if (selectedValues.includes(option)) {
        newValues = selectedValues.filter((v) => v !== option);
      } else {
        newValues = [...selectedValues, option];
      }
    }

    if (newValues.length === options.length && options.length > 0) {
      onFilterChange(columnId, null);
    } else {
      onFilterChange(columnId, newValues);
    }
  };

  const toggleSelectAll = () => {
    if (filteredOptions.every((opt) => effectiveSelectedValues.includes(opt))) {
      if (selectedValues === null) {
        const visibleSet = new Set(filteredOptions);
        const newValues = options.filter((o) => !visibleSet.has(o));
        onFilterChange(columnId, newValues);
      } else {
        const newValues = selectedValues.filter((v) => !filteredOptions.includes(v));
        onFilterChange(columnId, newValues);
      }
    } else {
      const newValues = Array.from(
        new Set([...(selectedValues || []), ...filteredOptions])
      );
      if (newValues.length === options.length) {
        onFilterChange(columnId, null);
      } else {
        onFilterChange(columnId, newValues);
      }
    }
  };

  const isFiltered = selectedValues !== null;
  const isSorted = sortDirection !== null;

  return (
    <div className="inline-flex items-center gap-0.5 ml-1.5">
      {onSortChange && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!sortDirection) {
              onSortChange(columnId, "asc");
            } else if (sortDirection === "asc") {
              onSortChange(columnId, "desc");
            } else {
              onSortChange(columnId, null);
            }
          }}
          className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${
            isSorted
              ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30"
              : "text-gray-400 hover:text-gray-600 dark:text-gray-500"
          }`}
          title={
            sortDirection === "asc"
              ? "Sorted Ascending (Click for Descending)"
              : sortDirection === "desc"
              ? "Sorted Descending (Click to Clear)"
              : `Sort ${title} Ascending / Descending`
          }
        >
          {sortDirection === "asc" ? (
            <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
          ) : sortDirection === "desc" ? (
            <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
          ) : (
            <ArrowUpDown className="w-3 h-3" />
          )}
        </button>
      )}

      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${
          isFiltered
            ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 font-bold"
            : "text-gray-400 dark:text-gray-500"
        }`}
        title={`Filter ${title}`}
      >
        <Filter className="w-3 h-3" />
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="fixed w-64 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 z-[9999] overflow-hidden animate-in fade-in zoom-in-95 duration-100"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
          }}
        >
          {/* Search Box */}
          <div className="p-2.5 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                autoFocus
              />
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto p-1.5 scrollbar-thin">
            <div
              className="flex items-center px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md cursor-pointer mb-1"
              onClick={toggleSelectAll}
            >
              <input
                type="checkbox"
                checked={
                  filteredOptions.length > 0 &&
                  filteredOptions.every((opt) =>
                    effectiveSelectedValues.includes(opt)
                  )
                }
                readOnly
                className="w-3.5 h-3.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 pointer-events-none"
              />
              <span className="ml-2 text-xs text-gray-700 dark:text-gray-200 font-bold">
                (Select All)
              </span>
            </div>

            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <div
                  key={option}
                  className="flex items-center px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer"
                  onClick={() => toggleOption(option)}
                >
                  <input
                    type="checkbox"
                    checked={effectiveSelectedValues.includes(option)}
                    onChange={() => {}}
                    className="w-3.5 h-3.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 pointer-events-none"
                  />
                  <span
                    className="ml-2 text-xs text-gray-700 dark:text-gray-300 truncate"
                    title={option}
                  >
                    {option === "" ? "(Blanks)" : option}
                  </span>
                </div>
              ))
            ) : (
              <div className="px-2 py-4 text-center text-xs text-gray-500 dark:text-gray-400">
                No matches found
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-2 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <button
              onClick={() => onFilterChange(columnId, null)}
              disabled={!isFiltered}
              className="px-2.5 py-1 text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Clear Filter
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded shadow-xs transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
