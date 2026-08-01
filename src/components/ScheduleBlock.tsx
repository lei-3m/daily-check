import React, { useState, useEffect, useRef } from 'react';
import { ScheduleItem } from '../lib/types';
import { todayKey, shortLabel } from '../lib/date';

interface ScheduleBlockProps {
  schedule: ScheduleItem[];
  activeKey: string;
  onAddSchedule: (date: string, text: string) => void;
  onDeleteSchedule: (id: string) => void;
}

function normalizeDateKey(dateStr: string): string {
  if (dateStr.includes('-')) return dateStr;
  const parts = dateStr.split('/');
  if (parts.length === 2) {
    const year = new Date().getFullYear();
    const month = parts[0].padStart(2, '0');
    const day = parts[1].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return dateStr;
}

function formatDisplayDate(dateStr: string): string {
  if (dateStr.includes('-')) {
    return shortLabel(dateStr);
  }
  return dateStr;
}

export function ScheduleBlock({
  schedule = [],
  activeKey,
  onAddSchedule,
  onDeleteSchedule,
}: ScheduleBlockProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [inputDate, setInputDate] = useState(activeKey || todayKey());
  const [inputText, setInputText] = useState('');
  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeKey) {
      setInputDate(activeKey);
    }
  }, [activeKey]);

  const today = todayKey();

  // Filter only today or upcoming schedules and sort by date ascending
  const upcomingSchedules = [...schedule]
    .filter((item) => normalizeDateKey(item.date) >= today)
    .sort((a, b) => {
      const dateA = normalizeDateKey(a.date);
      const dateB = normalizeDateKey(b.date);
      return dateA.localeCompare(dateB);
    });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onAddSchedule(inputDate, inputText.trim());
    setInputText('');
  };

  const handleDateTriggerClick = () => {
    if (dateInputRef.current) {
      if (
        'showPicker' in dateInputRef.current &&
        typeof dateInputRef.current.showPicker === 'function'
      ) {
        dateInputRef.current.showPicker();
      } else {
        dateInputRef.current.click();
      }
    }
  };

  return (
    <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 space-y-3 max-w-full overflow-hidden">
      {/* Block Header */}
      <div
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center justify-between cursor-pointer select-none"
      >
        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          <span>📌</span>
          <span>일정</span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsCollapsed(!isCollapsed);
          }}
          aria-label={isCollapsed ? '일정 펼치기' : '일정 접기'}
          className="text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300 rounded px-1.5 py-0.5 text-xs font-semibold leading-none"
        >
          {isCollapsed ? '펼치기 ▾' : '접기 −'}
        </button>
      </div>

      {!isCollapsed && (
        <div className="space-y-3 max-w-full">
          {/* Add Schedule Form */}
          <form
            onSubmit={handleSubmit}
            className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full max-w-full"
          >
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={handleDateTriggerClick}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300 font-mono flex items-center gap-1 font-semibold"
              >
                <span>📅</span>
                <span>{inputDate ? shortLabel(inputDate) : '날짜'}</span>
              </button>
              <input
                ref={dateInputRef}
                type="date"
                value={inputDate}
                onChange={(e) => setInputDate(e.target.value)}
                className="sr-only absolute inset-0 opacity-0 pointer-events-none"
                tabIndex={-1}
              />
            </div>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="일정 입력"
              className="flex-1 min-w-[120px] text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />

            <button
              type="submit"
              disabled={!inputText.trim()}
              className="text-xs px-3 py-1.5 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              추가
            </button>
          </form>

          {/* Schedule List or Empty State */}
          {upcomingSchedules.length === 0 ? (
            <div className="text-xs text-slate-400 py-2 text-center">
              등록된 일정이 없어요.
            </div>
          ) : (
            <ul className="space-y-1.5 text-xs text-slate-700">
              {upcomingSchedules.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between group py-1 px-1.5 rounded hover:bg-slate-100/80 transition-colors min-w-0"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="font-mono text-xs font-semibold text-slate-500 w-10 shrink-0 text-right">
                      {formatDisplayDate(item.date)}
                    </span>
                    <span className="font-medium text-slate-800 truncate min-w-0 flex-1">
                      {item.text}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteSchedule(item.id)}
                    aria-label="일정 삭제"
                    className="w-8 h-8 flex items-center justify-center shrink-0 text-slate-400 [@media(hover:hover)]:hover:text-red-500 [@media(hover:hover)]:hover:bg-red-50 focus:text-red-500 rounded-lg transition-colors"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
