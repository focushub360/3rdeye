import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface StatusMultiSelectProps {
  options: string[];
  selectedValues: string; // comma separated
  onChange: (newValues: string) => void;
}

export default function StatusMultiSelect({ options, selectedValues, onChange }: StatusMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  
  const selectedSet = new Set(selectedValues ? selectedValues.split(',') : []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleOption = (option: string) => {
    const newSet = new Set(selectedSet);
    if (newSet.has(option)) {
      newSet.delete(option);
    } else {
      newSet.add(option);
    }
    onChange(Array.from(newSet).join(','));
  };

  const handleSelectAll = () => {
    if (selectedSet.size === options.length) {
      onChange(""); // Deselect all
    } else {
      onChange(options.join(','));
    }
  };

  return (
    <div className="relative w-full" ref={popoverRef}>
      <div 
        className="flex items-center justify-between w-full px-2 py-1 text-xs font-normal border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white cursor-pointer hover:border-indigo-400 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate pr-2">
          {selectedSet.size === 0 
            ? "All Statuses" 
            : selectedSet.size === 1
              ? Array.from(selectedSet)[0]
              : `${selectedSet.size} selected`}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-48 max-h-64 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 p-2 animate-in fade-in zoom-in duration-200">
          <div 
            className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer transition-colors"
            onClick={handleSelectAll}
          >
            <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedSet.size === options.length ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 dark:border-gray-600'}`}>
              {selectedSet.size === options.length && <Check className="w-3 h-3 text-white" />}
            </div>
            <span>Select All</span>
          </div>
          
          <div className="h-px bg-gray-100 dark:bg-gray-700 my-1"></div>

          {options.map((option) => (
            <div 
              key={option}
              className="flex items-center gap-2 px-2 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer transition-colors"
              onClick={() => toggleOption(option)}
            >
              <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedSet.has(option) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 dark:border-gray-600'}`}>
                {selectedSet.has(option) && <Check className="w-3 h-3 text-white" />}
              </div>
              <span className="truncate">{option}</span>
            </div>
          ))}
          
          {options.length === 0 && (
            <div className="px-2 py-2 text-xs text-gray-400 text-center italic">No statuses found</div>
          )}
        </div>
      )}
    </div>
  );
}
