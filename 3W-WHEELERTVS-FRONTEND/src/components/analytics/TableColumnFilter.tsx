import React, { useState, useRef, useEffect, useMemo } from "react";
import { Filter, Search, ArrowUp, ArrowDown, ArrowUpDown, X, Check, SlidersHorizontal, ListFilter } from "lucide-react";

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
  const [filterMode, setFilterMode] = useState<"list" | "range">("list");
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  // Range filter inputs
  const [rangeStart, setRangeStart] = useState<string>("");
  const [rangeEnd, setRangeEnd] = useState<string>("");

  // Local draft state for lightning fast 0ms UI interaction without parent re-render lag
  const [draftSelectedValues, setDraftSelectedValues] = useState<string[] | null>(selectedValues);

  // Sync draft when opened or when selectedValues prop changes
  useEffect(() => {
    if (isOpen) {
      setDraftSelectedValues(selectedValues);
    }
  }, [isOpen, selectedValues]);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const idealLeft = rect.right + window.scrollX - 270;
      const safeLeft = Math.max(16, Math.min(idealLeft, window.innerWidth - 300));
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 8,
        left: safeLeft,
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
        // Apply draft changes on close if modified
        if (isOpen && draftSelectedValues !== selectedValues && filterMode === "list") {
          onFilterChange(columnId, draftSelectedValues);
        }
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, draftSelectedValues, selectedValues, columnId, onFilterChange, filterMode]);

  // Orderly natural sort of options (numeric-aware: 1031 < 1032 < 1103, Sep26-KRT-01 < Sep26-KRT-02)
  const sortedOptions = useMemo(() => {
    return [...options].sort((a, b) => {
      const strA = String(a ?? "");
      const strB = String(b ?? "");
      if (strA === "") return 1;
      if (strB === "") return -1;
      return strA.localeCompare(strB, undefined, { numeric: true, sensitivity: "base" });
    });
  }, [options]);

  const cleanOptions = useMemo(() => {
    return sortedOptions.filter((o) => o !== undefined && o !== null && String(o).trim() !== "");
  }, [sortedOptions]);

  // Initialize range defaults when opened
  useEffect(() => {
    if (isOpen && cleanOptions.length > 0) {
      if (!rangeStart) setRangeStart(cleanOptions[0]);
      if (!rangeEnd) setRangeEnd(cleanOptions[cleanOptions.length - 1]);
    }
  }, [isOpen, cleanOptions]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return sortedOptions;
    const term = searchTerm.trim().toLowerCase();
    return sortedOptions.filter((option) =>
      String(option ?? "").toLowerCase().includes(term)
    );
  }, [sortedOptions, searchTerm]);

  const DISPLAY_LIMIT = 100;
  const displayedOptions = filteredOptions.slice(0, DISPLAY_LIMIT);

  const effectiveSelectedValues = draftSelectedValues === null ? options : draftSelectedValues;
  const effectiveSelectedSet = useMemo(() => new Set(effectiveSelectedValues), [effectiveSelectedValues]);

  const isOptionSelected = (option: string) => {
    if (draftSelectedValues === null) return true;
    return effectiveSelectedSet.has(option);
  };

  const handleSelectOnly = (option: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDraftSelectedValues([option]);
    onFilterChange(columnId, [option]);
  };

  const handleSelectOnlySearchResults = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (filteredOptions.length === 0) return;
    if (filteredOptions.length === options.length) {
      setDraftSelectedValues(null);
      onFilterChange(columnId, null);
    } else {
      setDraftSelectedValues(filteredOptions);
      onFilterChange(columnId, filteredOptions);
    }
  };

  const toggleOption = (option: string) => {
    let newValues: string[];

    if (draftSelectedValues === null) {
      if (searchTerm.trim()) {
        newValues = [option];
      } else {
        newValues = options.filter((o) => o !== option);
      }
    } else {
      if (draftSelectedValues.includes(option)) {
        newValues = draftSelectedValues.filter((v) => v !== option);
      } else {
        newValues = [...draftSelectedValues, option];
      }
    }

    if (newValues.length === options.length && options.length > 0) {
      setDraftSelectedValues(null);
      onFilterChange(columnId, null);
    } else {
      setDraftSelectedValues(newValues);
      onFilterChange(columnId, newValues);
    }
  };

  const isAllFilteredSelected = useMemo(() => {
    if (filteredOptions.length === 0) return false;
    return filteredOptions.every((opt) => isOptionSelected(opt));
  }, [filteredOptions, draftSelectedValues, effectiveSelectedSet]);

  const isSomeFilteredSelected = useMemo(() => {
    if (filteredOptions.length === 0) return false;
    return filteredOptions.some((opt) => isOptionSelected(opt)) && !isAllFilteredSelected;
  }, [filteredOptions, draftSelectedValues, effectiveSelectedSet, isAllFilteredSelected]);

  const toggleSelectAll = () => {
    if (searchTerm.trim()) {
      if (isAllFilteredSelected) {
        if (draftSelectedValues === null) {
          const matchingSet = new Set(filteredOptions);
          const newValues = options.filter((o) => !matchingSet.has(o));
          setDraftSelectedValues(newValues);
          onFilterChange(columnId, newValues);
        } else {
          const matchingSet = new Set(filteredOptions);
          const newValues = draftSelectedValues.filter((v) => !matchingSet.has(v));
          setDraftSelectedValues(newValues);
          onFilterChange(columnId, newValues);
        }
      } else {
        if (draftSelectedValues === null) {
          setDraftSelectedValues(filteredOptions);
          onFilterChange(columnId, filteredOptions);
        } else {
          const combined = Array.from(new Set([...draftSelectedValues, ...filteredOptions]));
          if (combined.length === options.length) {
            setDraftSelectedValues(null);
            onFilterChange(columnId, null);
          } else {
            setDraftSelectedValues(combined);
            onFilterChange(columnId, combined);
          }
        }
      }
    } else {
      if (draftSelectedValues === null || draftSelectedValues.length === options.length) {
        setDraftSelectedValues([]);
        onFilterChange(columnId, []);
      } else {
        setDraftSelectedValues(null);
        onFilterChange(columnId, null);
      }
    }
  };

  // Range calculation from sorted clean options
  const rangeSlice = useMemo(() => {
    if (!rangeStart && !rangeEnd) return [];
    if (!rangeStart) return [rangeEnd];
    if (!rangeEnd) return [rangeStart];

    const idxA = cleanOptions.indexOf(rangeStart);
    const idxB = cleanOptions.indexOf(rangeEnd);

    if (idxA !== -1 && idxB !== -1) {
      const minIdx = Math.min(idxA, idxB);
      const maxIdx = Math.max(idxA, idxB);
      return cleanOptions.slice(minIdx, maxIdx + 1);
    }
    return [rangeStart, rangeEnd];
  }, [cleanOptions, rangeStart, rangeEnd]);

  const handleApplyRange = () => {
    if (rangeSlice.length > 0) {
      onFilterChange(columnId, rangeSlice);
    }
    setIsOpen(false);
  };

  const handleApplyDone = () => {
    if (filterMode === "range") {
      handleApplyRange();
      return;
    }
    if (searchTerm.trim() && draftSelectedValues === null && filteredOptions.length > 0) {
      setDraftSelectedValues(filteredOptions);
      onFilterChange(columnId, filteredOptions);
    } else {
      onFilterChange(columnId, draftSelectedValues);
    }
    setIsOpen(false);
  };

  const isFiltered = selectedValues !== null;
  const isSorted = sortDirection !== null;
  const selectedCount = selectedValues === null ? options.length : selectedValues.length;

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
        className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors relative ${
          isFiltered
            ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 font-bold"
            : "text-gray-400 dark:text-gray-500"
        }`}
        title={`Filter ${title}`}
      >
        <Filter className="w-3 h-3" />
        {isFiltered && (
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-indigo-600 rounded-full ring-2 ring-white dark:ring-gray-900" />
        )}
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="fixed w-80 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-[9999] overflow-hidden animate-in fade-in zoom-in-95 duration-100"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-2.5 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate" title={title}>
              Filter: {title}
            </span>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
              {isFiltered ? `${selectedCount} of ${options.length}` : "All selected"}
            </span>
          </div>

          {/* Mode Switcher Tabs: List Selection vs Range [Start -> End] */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-850 p-1 gap-1">
            <button
              type="button"
              onClick={() => setFilterMode("list")}
              className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                filterMode === "list"
                  ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-xs border border-gray-200 dark:border-gray-600"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
              }`}
            >
              <ListFilter size={13} />
              <span>List Mode</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("range")}
              className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                filterMode === "range"
                  ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-xs border border-gray-200 dark:border-gray-600"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
              }`}
            >
              <SlidersHorizontal size={13} />
              <span>Range [Start &rarr; End]</span>
            </button>
          </div>

          {/* Mode 1: Range [Start -> End] View */}
          {filterMode === "range" ? (
            <div className="p-3 space-y-3">
              <div className="p-2.5 rounded-lg bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-indigo-900 dark:text-indigo-200 text-xs">
                Select start and end unit to filter this column across the exact range sequence.
              </div>

              {/* Start Unit Selector */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide block">
                  Start Unit:
                </label>
                <select
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono font-semibold rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  {cleanOptions.map((opt, idx) => (
                    <option key={idx} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              {/* End Unit Selector */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide block">
                  End Unit:
                </label>
                <select
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono font-semibold rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  {cleanOptions.map((opt, idx) => (
                    <option key={idx} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              {/* Range Preview Card */}
              <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700 text-xs flex items-center justify-between">
                <span className="font-semibold text-gray-600 dark:text-gray-300">
                  {rangeSlice.length} record{rangeSlice.length === 1 ? "" : "s"} in range
                </span>
                <span className="font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                  {rangeStart || "-"} &rarr; {rangeEnd || "-"}
                </span>
              </div>
            </div>
          ) : (
            /* Mode 2: Standard List Filter */
            <>
              {/* Search Box */}
              <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                <div className="relative">
                  <input
                    type="text"
                    placeholder={`Search ${title.toLowerCase()}... (Press Enter)`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (filteredOptions.length > 0) {
                          onFilterChange(columnId, filteredOptions);
                        }
                        setIsOpen(false);
                      }
                    }}
                    className="w-full pl-8 pr-7 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    autoFocus
                  />
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Quick action buttons when searching */}
                {searchTerm.trim() && (
                  <div className="flex items-center justify-between gap-1 mt-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-700/60">
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                      {filteredOptions.length} match{filteredOptions.length === 1 ? "" : "es"}
                    </span>
                    {filteredOptions.length > 0 && (
                      <button
                        type="button"
                        onClick={handleSelectOnlySearchResults}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 px-2 py-0.5 rounded transition-colors"
                      >
                        Select Only Results ({filteredOptions.length})
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Options List */}
              <div className="max-h-60 overflow-y-auto p-1.5 scrollbar-thin">
                <div
                  className="flex items-center justify-between px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700/60 rounded-md cursor-pointer mb-1 border-b border-gray-100 dark:border-gray-700/50"
                  onClick={toggleSelectAll}
                >
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={isAllFilteredSelected}
                      ref={(input) => {
                        if (input) input.indeterminate = isSomeFilteredSelected;
                      }}
                      readOnly
                      className="w-3.5 h-3.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 pointer-events-none"
                    />
                    <span className="ml-2 text-xs text-gray-700 dark:text-gray-200 font-bold">
                      {searchTerm.trim() ? "(Select All Results)" : "(Select All)"}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-400 font-medium">
                    {filteredOptions.length}
                  </span>
                </div>

                {filteredOptions.length > 0 ? (
                  <>
                    {displayedOptions.map((option) => {
                      const selected = isOptionSelected(option);
                      return (
                        <div
                          key={option}
                          className={`group flex items-center justify-between px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700/60 rounded cursor-pointer transition-colors ${
                            selected ? "bg-indigo-50/40 dark:bg-indigo-950/20" : ""
                          }`}
                          onClick={() => toggleOption(option)}
                        >
                          <div className="flex items-center min-w-0 flex-1 mr-2">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => {}}
                              className="w-3.5 h-3.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 pointer-events-none shrink-0"
                            />
                            <span
                              className={`ml-2 text-xs truncate ${
                                selected
                                  ? "text-gray-900 dark:text-white font-semibold"
                                  : "text-gray-600 dark:text-gray-400"
                              }`}
                              title={option}
                            >
                              {option === "" ? "(Blanks)" : option}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => handleSelectOnly(option, e)}
                            className="opacity-0 group-hover:opacity-100 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline px-1 py-0.5 rounded transition-opacity shrink-0"
                            title={`Select only "${option}"`}
                          >
                            Only
                          </button>
                        </div>
                      );
                    })}
                    {filteredOptions.length > DISPLAY_LIMIT && (
                      <div className="px-2 py-2 text-center text-[10px] text-gray-400 italic bg-gray-50 dark:bg-gray-800/50 rounded mt-1 border border-gray-100 dark:border-gray-700">
                        Showing first {DISPLAY_LIMIT} of {filteredOptions.length} matches. Type in search to refine.
                      </div>
                    )}
                  </>
                ) : (
                  <div className="px-2 py-4 text-center text-xs text-gray-500 dark:text-gray-400">
                    No matching options found
                  </div>
                )}
              </div>
            </>
          )}

          {/* Actions */}
          <div className="p-2 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <button
              onClick={() => {
                onFilterChange(columnId, null);
                setSearchTerm("");
              }}
              disabled={!isFiltered}
              className="px-2.5 py-1 text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Clear Filter
            </button>
            <button
              onClick={handleApplyDone}
              className="px-3 py-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              {filterMode === "range" ? "Apply Range" : "Done"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
