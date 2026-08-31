import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  parseISO,
  isAfter,
  isBefore,
  isEqual
} from 'date-fns';

interface HeatmapCalendarProps {
  selectedDate: string; // "YYYY-MM-DD" or "YYYY-MM-DD,YYYY-MM-DD" or empty string
  onSelectDate: (date: string) => void;
  responseCountsByDate?: Record<string, number>;
}

export default function HeatmapCalendar({
  selectedDate,
  onSelectDate,
  responseCountsByDate
}: HeatmapCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [isOpen, setIsOpen] = useState(false);
  const [tempStart, setTempStart] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Parse selection
  const [startStr, endStr] = useMemo(() => {
    if (!selectedDate) return [null, null];
    if (selectedDate.includes(',')) {
      return selectedDate.split(',');
    }
    return [selectedDate, selectedDate];
  }, [selectedDate]);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setTempStart(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const dateFormat = "yyyy-MM-dd";
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const handleDateClick = (dateStr: string) => {
    if (tempStart) {
      // Second click: completing the range
      const tStart = parseISO(tempStart);
      const tEnd = parseISO(dateStr);
      
      if (isBefore(tEnd, tStart)) {
        onSelectDate(`${dateStr},${tempStart}`);
      } else {
        onSelectDate(`${tempStart},${dateStr}`);
      }
      setTempStart(null);
      setIsOpen(false);
    } else {
      // First click: If they click an already exact selected single date or range, clear it.
      if (selectedDate === dateStr || selectedDate === `${dateStr},${dateStr}`) {
        onSelectDate("");
        setIsOpen(false);
        return;
      }
      // Otherwise start a new range
      setTempStart(dateStr);
      onSelectDate(dateStr);
    }
  };

  // Format display as MM/dd/yyyy
  const formatDisplayDate = () => {
    if (!selectedDate) return "MM/DD/YYYY or Range";
    if (!selectedDate.includes(',')) {
      try {
        return format(parseISO(selectedDate), "MM/dd/yyyy");
      } catch {
        return selectedDate;
      }
    }
    const [s, e] = selectedDate.split(',');
    if (s === e) {
      try {
        return format(parseISO(s), "MM/dd/yyyy");
      } catch {
        return s;
      }
    }
    try {
      return `${format(parseISO(s), "MM/dd/yyyy")} - ${format(parseISO(e), "MM/dd/yyyy")}`;
    } catch {
      return `${s} - ${e}`;
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectDate("");
    setTempStart(null);
  };

  return (
    <div className="relative inline-block w-full" ref={popoverRef}>
      {/* Trigger Button/Input */}
      <div 
        className="flex items-center justify-between w-full px-2 py-1 text-xs font-normal border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white cursor-pointer hover:border-indigo-400 transition-colors shadow-2xs"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-1.5 overflow-hidden">
          <CalendarIcon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <span className={`truncate ${selectedDate ? "font-semibold text-gray-800 dark:text-gray-100" : "text-gray-400"}`}>
            {formatDisplayDate()}
          </span>
        </div>
        {selectedDate ? (
          <button 
            type="button" 
            onClick={handleClear} 
            className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
            title="Clear date filter"
          >
            <X className="w-3 h-3" />
          </button>
        ) : null}
      </div>

      {/* Popover Calendar */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-68 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 p-3 animate-in fade-in zoom-in duration-150">
          
          {/* Header */}
          <div className="flex items-center justify-between mb-2.5">
            <button 
              type="button"
              onClick={prevMonth}
              className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h2 className="text-sm font-bold text-gray-800 dark:text-white">
              {format(currentMonth, "MMMM yyyy")}
            </h2>
            <button 
              type="button"
              onClick={nextMonth}
              className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Days of Week */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {weekDays.map(day => (
              <div key={day} className="text-center text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid (Clean - No heatmap colors) */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, idx) => {
              const dateStr = format(day, dateFormat);
              const isCurrentMonth = isSameMonth(day, monthStart);
              
              const isStart = startStr === dateStr || tempStart === dateStr;
              const isEnd = endStr === dateStr;
              const isEdge = isStart || isEnd;
              
              let inRange = false;
              if (startStr && endStr && startStr !== endStr) {
                const s = parseISO(startStr);
                const e = parseISO(endStr);
                if ((isAfter(day, s) && isBefore(day, e)) || isEdge) {
                  inRange = true;
                }
              }

              return (
                <button
                  type="button"
                  key={idx}
                  onClick={() => handleDateClick(dateStr)}
                  className={`
                    h-7 w-7 rounded-md flex items-center justify-center text-xs transition-all duration-150
                    ${!isCurrentMonth ? 'opacity-25 text-gray-400' : 'text-gray-700 dark:text-gray-200'}
                    ${isEdge 
                      ? 'bg-indigo-600 text-white font-bold shadow-xs scale-105 z-10' 
                      : inRange 
                        ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200 font-medium' 
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'}
                  `}
                  title={format(day, "MM/dd/yyyy")}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>
          
          {/* Action Footer */}
          <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                const todayStr = format(new Date(), dateFormat);
                onSelectDate(todayStr);
                setIsOpen(false);
              }}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Today
            </button>
            {selectedDate && (
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:underline"
              >
                Clear Filter
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
