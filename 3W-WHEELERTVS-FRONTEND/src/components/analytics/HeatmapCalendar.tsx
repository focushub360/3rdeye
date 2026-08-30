import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
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
  responseCountsByDate: Record<string, number>;
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
        setTempStart(null); // reset temporary selection
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const { maxCount } = useMemo(() => {
    let max = 0;
    Object.values(responseCountsByDate).forEach(count => {
      if (count > max) max = count;
    });
    return { maxCount: max };
  }, [responseCountsByDate]);

  const getColorClass = (count: number, inRange: boolean, isEdge: boolean) => {
    let base = 'bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700';
    if (count >= maxCount * 0.66) base = 'bg-green-500 text-white hover:bg-green-600 shadow-sm shadow-green-500/30';
    else if (count >= maxCount * 0.33) base = 'bg-pink-400 text-white hover:bg-pink-500 shadow-sm shadow-pink-400/30';
    else if (count > 0) base = 'bg-red-400 text-white hover:bg-red-500 shadow-sm shadow-red-400/30';

    if (isEdge) {
      // Will be overridden by ring anyway, but keep base color
    } else if (inRange) {
      // Lighten the background for in-range items if they don't have a color, or just keep them selected
      if (count === 0) {
        base = 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300';
      }
    }
    return base;
  };

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
      onSelectDate(dateStr); // Temporarily select this as a single date while they pick the end
    }
  };

  const formatDisplayDate = () => {
    if (!selectedDate) return "Search date range...";
    if (!selectedDate.includes(',')) {
      return format(parseISO(selectedDate), "MMM d, yyyy");
    }
    const [s, e] = selectedDate.split(',');
    if (s === e) return format(parseISO(s), "MMM d, yyyy");
    return `${format(parseISO(s), "MMM d")} - ${format(parseISO(e), "MMM d, yyyy")}`;
  };

  return (
    <div className="relative inline-block w-full" ref={popoverRef}>
      {/* Trigger Button/Input */}
      <div 
        className="flex items-center justify-between w-full px-2 py-1 text-xs font-normal border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white cursor-pointer hover:border-indigo-400 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={selectedDate ? "font-medium" : "text-gray-400"}>
          {formatDisplayDate()}
        </span>
        <CalendarIcon className="w-3.5 h-3.5 text-gray-400" />
      </div>

      {/* Popover */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 p-3 animate-in fade-in zoom-in duration-200">
          
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <button 
              onClick={prevMonth}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </button>
            <h2 className="text-sm font-semibold text-gray-800 dark:text-white">
              {format(currentMonth, "MMMM yyyy")}
            </h2>
            <button 
              onClick={nextMonth}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </button>
          </div>

          {/* Days of Week */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {weekDays.map(day => (
              <div key={day} className="text-center text-[10px] font-medium text-gray-400 uppercase">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, idx) => {
              const dateStr = format(day, dateFormat);
              const count = responseCountsByDate[dateStr] || 0;
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
                  key={idx}
                  onClick={() => handleDateClick(dateStr)}
                  className={`
                    relative h-7 w-7 rounded-md flex items-center justify-center text-xs transition-all duration-200
                    ${!isCurrentMonth ? 'opacity-30' : ''}
                    ${getColorClass(count, inRange, isEdge)}
                    ${isEdge ? 'ring-2 ring-offset-1 ring-indigo-500 font-bold scale-110 z-10' : ''}
                    ${inRange && !isEdge ? 'ring-1 ring-indigo-200 dark:ring-indigo-800/50' : ''}
                  `}
                  title={`${format(day, "MMM d, yyyy")}: ${count} responses`}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>
          
          {/* Legend */}
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-[10px] text-gray-500">
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-gray-100 dark:bg-gray-700 border border-gray-200"></div> 0</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-red-400"></div> Low</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-pink-400"></div> Med</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-green-500"></div> High</div>
          </div>
          
          <div className="mt-2 text-center text-[9px] text-gray-400 dark:text-gray-500">
            {tempStart ? "Select end date..." : "Click to select a date or start a range"}
          </div>
        </div>
      )}
    </div>
  );
}
