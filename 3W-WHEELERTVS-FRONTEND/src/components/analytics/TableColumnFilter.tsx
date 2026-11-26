import React, { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
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
    const updatePosition = () => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const popoverWidth = 304;
      const estimatedHeight = 390;
      const idealLeft = rect.right - popoverWidth;
      const safeLeft = Math.max(12, Math.min(idealLeft, window.innerWidth - popoverWidth - 12));
      const spaceBelow = window.innerHeight - rect.bottom;
      const top =
        spaceBelow < estimatedHeight && rect.top > estimatedHeight
          ? Math.max(12, rect.top - estimatedHeight - 6)
          : Math.min(rect.bottom + 6, Math.max(12, window.innerHeight - estimatedHeight - 12));
      setDropdownPosition({ top, left: safeLeft });
    };

    if (isOpen) {
      updatePosition();
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, true);
    }
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        if (isOpen && draftSelectedValues !== selectedValues && filterMode === "list") {
          onFilterChange(columnId, draftSelectedValues);
        }
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
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

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed w-[304px] bg-white dark:bg-gray-900 rounded-2xl shadow-[0_20px_50px_-12px_rgba(15,23,42,0.25)] dark:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.6)] border border-gray-200/90 dark:border-gray-700/80 z-[9999] overflow-hidden normal-case tracking-normal text-left font-sans animate-in fade-in zoom-in-95 duration-150 ease-out"
            style={{
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-3.5 py-2.5 bg-gradient-to-r from-slate-50 to-indigo-50/40 dark:from-gray-800/90 dark:to-indigo-950/30 border-b border-gray-200/80 dark:border-gray-700/80 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-5 h-5 rounded-md bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Filter className="w-3 h-3" />
                </span>
                <span className="text-xs font-bold text-gray-800 dark:text-gray-100 truncate" title={title}>
                  {title}
                </span>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                  isFiltered
                    ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                }`}
              >
                {isFiltered ? `${selectedCount} / ${options.length}` : "All"}
              </span>
            </div>

            {/* Mode Switcher Segmented Control */}
            <div className="px-3 pt-2.5 pb-1.5">
              <div className="flex bg-gray-100 dark:bg-gray-800 p-0.5 rounded-xl gap-0.5">
                <button
                  type="button"
                  onClick={() => setFilterMode("list")}
                  className={`flex-1 py-1.5 px-2.5 text-[11px] font-semibold rounded-[10px] flex items-center justify-center gap-1.5 transition-all duration-150 ${
                    filterMode === "list"
                      ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-xs"
                      : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  }`}
                >
                  <ListFilter size={12} />
                  <span>List</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode("range")}
                  className={`flex-1 py-1.5 px-2.5 text-[11px] font-semibold rounded-[10px] flex items-center justify-center gap-1.5 transition-all duration-150 ${
                    filterMode === "range"
                      ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-xs"
                      : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  }`}
                >
                  <SlidersHorizontal size={12} />
                  <span>Range</span>
                </button>
              </div>
            </div>

            {/* Mode 1: Range [Start -> End] View */}
            {filterMode === "range" ? (
              <div className="px-3 pb-3 pt-1 space-y-2.5">
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                  Filter across an ordered range from start to end value.
                </p>

                {/* Start Unit Selector */}
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
                    Start Value
                  </label>
                  <select
                    value={rangeStart}
                    onChange={(e) => setRangeStart(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono font-medium rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 focus:outline-none transition-all"
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
                  <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
                    End Value
                  </label>
                  <select
                    value={rangeEnd}
                    onChange={(e) => setRangeEnd(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono font-medium rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 focus:outline-none transition-all"
                  >
                    {cleanOptions.map((opt, idx) => (
                      <option key={idx} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Range Preview Card */}
                <div className="px-2.5 py-2 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-xs flex items-center justify-between">
                  <span className="font-semibold text-indigo-900 dark:text-indigo-200">
                    {rangeSlice.length} value{rangeSlice.length === 1 ? "" : "s"}
                  </span>
                  <span className="font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400 truncate max-w-[160px]">
                    {rangeStart || "-"} &rarr; {rangeEnd || "-"}
                  </span>
                </div>
              </div>
            ) : (
              /* Mode 2: Standard List Filter */
              <>
                {/* Search Box */}
                <div className="px-3 pb-2">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={`Search ${title.toLowerCase()}...`}
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
                      className="w-full pl-8 pr-7 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/80 dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 outline-none transition-all"
                      autoFocus
                    />
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => setSearchTerm("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Quick action buttons when searching */}
                  {searchTerm.trim() && (
                    <div className="flex items-center justify-between gap-1 mt-1.5">
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                        {filteredOptions.length} match{filteredOptions.length === 1 ? "" : "es"}
                      </span>
                      {filteredOptions.length > 0 && (
                        <button
                          type="button"
                          onClick={handleSelectOnlySearchResults}
                          className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 px-2 py-0.5 rounded-md transition-colors"
                        >
                          Select Only ({filteredOptions.length})
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Options List */}
                <div className="max-h-56 overflow-y-auto px-2 pb-2 space-y-0.5 scrollbar-thin">
                  <div
                    className="flex items-center justify-between px-2.5 py-1.5 hover:bg-gray-100/80 dark:hover:bg-gray-800 rounded-lg cursor-pointer mb-1 border-b border-gray-100 dark:border-gray-800 transition-colors"
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
                        className="w-3.5 h-3.5 accent-indigo-600 border-gray-300 rounded focus:ring-indigo-500 pointer-events-none"
                      />
                      <span className="ml-2.5 text-xs text-gray-700 dark:text-gray-200 font-semibold">
                        {searchTerm.trim() ? "Select all results" : "Select all"}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400 font-medium tabular-nums">
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
                            className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-all duration-100 ${
                              selected
                                ? "bg-indigo-50/70 dark:bg-indigo-950/30 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                                : "hover:bg-gray-100/80 dark:hover:bg-gray-800/80"
                            }`}
                            onClick={() => toggleOption(option)}
                          >
                            <div className="flex items-center min-w-0 flex-1 mr-2">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => {}}
                                className="w-3.5 h-3.5 accent-indigo-600 border-gray-300 rounded focus:ring-indigo-500 pointer-events-none shrink-0"
                              />
                              <span
                                className={`ml-2.5 text-xs truncate ${
                                  selected
                                    ? "text-gray-900 dark:text-white font-medium"
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
                              className="opacity-0 group-hover:opacity-100 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 px-1.5 py-0.5 rounded-md transition-all shrink-0 shadow-2xs"
                              title={`Select only "${option}"`}
                            >
                              Only
                            </button>
                          </div>
                        );
                      })}
                      {filteredOptions.length > DISPLAY_LIMIT && (
                        <div className="px-2.5 py-2 text-center text-[10px] text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg mt-1 border border-gray-100 dark:border-gray-800">
                          Showing {DISPLAY_LIMIT} of {filteredOptions.length} — search to refine
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="px-2 py-6 text-center text-xs text-gray-400 dark:text-gray-500">
                      No matching options
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Actions */}
            <div className="px-3 py-2.5 bg-gray-50/90 dark:bg-gray-800/80 border-t border-gray-200/80 dark:border-gray-700/80 flex justify-between items-center">
              <button
                type="button"
                onClick={() => {
                  onFilterChange(columnId, null);
                  setSearchTerm("");
                }}
                disabled={!isFiltered}
                className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30 rounded-lg disabled:opacity-35 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleApplyDone}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] rounded-xl shadow-xs transition-all flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                {filterMode === "range" ? "Apply Range" : "Done"}
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
