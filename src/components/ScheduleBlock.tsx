import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ScheduleItem } from '../lib/types';
import { todayKey, shortLabel, addDays } from '../lib/date';
import { ScheduleOccurrence, expandScheduleInRange } from '../lib/schedule';

interface ScheduleBlockProps {
  schedule: ScheduleItem[];
  activeKey: string;
  onAddSchedule: (date: string, text: string) => void;
  onDeleteSchedule: (id: string) => void;
  onOpenScheduleEdit: (id: string) => void;
  onOpenMonthView?: () => void;
  isCollapsed?: boolean;
  onToggleCollapsed?: () => void;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
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

interface ScheduleItemRowProps {
  key?: string;
  item: ScheduleOccurrence;
  onDeleteSchedule: (id: string) => void;
  onOpenScheduleEdit: (id: string) => void;
}

function ScheduleItemRow({
  item,
  onDeleteSchedule,
  onOpenScheduleEdit,
}: ScheduleItemRowProps) {
  const occurrenceDate = normalizeDateKey(item.occurrenceDate);
  const repeat = item.repeat;

  return (
    <li className="flex items-center justify-between group py-1 px-1.5 rounded hover:bg-slate-100/80 transition-colors min-w-0 gap-2">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="font-mono text-xs font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
          {formatDisplayDate(occurrenceDate)}
        </span>

        {repeat ? <span className="text-slate-400 shrink-0">↻</span> : null}
        <button
          type="button"
          onClick={() => onOpenScheduleEdit(item.id)}
          className="font-medium text-slate-800 truncate min-w-0 flex-1 cursor-pointer text-left hover:bg-slate-200/60 rounded px-1 py-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
        >
          {item.text}
        </button>
      </div>

      <button
        type="button"
        onClick={() => onDeleteSchedule(item.id)}
        aria-label="일정 삭제"
        className="w-8 h-8 flex items-center justify-center shrink-0 text-slate-400 [@media(hover:hover)]:hover:text-red-500 [@media(hover:hover)]:hover:bg-red-50 focus-visible:text-red-500 rounded-lg transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
      >
        ✕
      </button>
    </li>
  );
}

export function ScheduleBlock({
  schedule = [],
  activeKey,
  onAddSchedule,
  onDeleteSchedule,
  onOpenScheduleEdit,
  onOpenMonthView,
  isCollapsed: propIsCollapsed,
  onToggleCollapsed,
  isExpanded: propIsExpanded,
  onToggleExpanded,
}: ScheduleBlockProps) {
  const [localCollapsed, setLocalCollapsed] = useState(false);
  const [localExpanded, setLocalExpanded] = useState(false);

  const isCollapsed = propIsCollapsed ?? localCollapsed;
  const isExpanded = propIsExpanded ?? localExpanded;

  const toggleCollapsed = () => {
    if (onToggleCollapsed) {
      onToggleCollapsed();
    } else {
      setLocalCollapsed((prev) => !prev);
    }
  };

  const toggleExpanded = () => {
    if (onToggleExpanded) {
      onToggleExpanded();
    } else {
      setLocalExpanded((prev) => !prev);
    }
  };

  const [inputDate, setInputDate] = useState(activeKey || todayKey());
  const [inputText, setInputText] = useState('');
  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeKey) {
      setInputDate(activeKey);
    }
  }, [activeKey]);

  const today = todayKey();
  const limit7Date = addDays(today, 6);

  const upcomingLimitDate = addDays(today, 365);
  const upcomingSchedules = expandScheduleInRange(schedule, today, upcomingLimitDate);

  const within7Days = upcomingSchedules.filter(
    (item) => item.occurrenceDate <= limit7Date
  );
  const after7Days = upcomingSchedules.filter(
    (item) => item.occurrenceDate > limit7Date
  );

  // Items to show depending on isExpanded state
  const displayedSchedules = isExpanded ? upcomingSchedules : within7Days;

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
        onClick={toggleCollapsed}
        className="flex items-center justify-between cursor-pointer select-none"
      >
        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          <span>📌</span>
          <span>다가오는 일정</span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleCollapsed();
          }}
          aria-label={isCollapsed ? '일정 펼치기' : '일정 접기'}
          className="min-h-11 min-w-11 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 rounded-lg leading-none"
        >
          {isCollapsed ? (
            <ChevronDown size={20} strokeWidth={2} aria-hidden="true" />
          ) : (
            <ChevronUp size={20} strokeWidth={2} aria-hidden="true" />
          )}
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
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 font-mono flex items-center gap-1 font-semibold"
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
              placeholder="일정 추가 (마감, 약속 등)"
              className="flex-1 min-w-[120px] text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />

            <button
              type="submit"
              disabled={!inputText.trim()}
              className="text-xs px-3 py-1.5 accent-fill accent-fill-hover text-white font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              추가
            </button>
          </form>

          {/* Schedule List or Empty State */}
          {upcomingSchedules.length === 0 ? (
            <div className="text-xs text-slate-400 py-2 text-center">
              다가오는 일정이 없어요.
            </div>
          ) : (
            <div className="space-y-1">
              <div className="space-y-1 max-h-[35vh] overflow-y-auto pr-1">
                {displayedSchedules.length > 0 && (
                  <ul className="space-y-1 text-xs text-slate-700">
                    {displayedSchedules.map((item) => (
                      <ScheduleItemRow
                        key={`${item.id}:${item.occurrenceDate}`}
                        item={item}
                        onDeleteSchedule={onDeleteSchedule}
                        onOpenScheduleEdit={onOpenScheduleEdit}
                      />
                    ))}
                  </ul>
                )}
              </div>

              {/* Toggle expand/collapse button for schedules after 7 days */}
              {after7Days.length > 0 && !isExpanded && (
                <button
                  type="button"
                  onClick={toggleExpanded}
                  className="min-h-11 w-full flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors py-1 px-1.5 rounded-lg hover:bg-slate-100/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 group"
                >
                  <span className="font-mono font-semibold text-slate-600 group-hover:text-slate-900">
                    +{after7Days.length}개
                  </span>
                  <span className="text-[11px] font-medium text-slate-400 group-hover:text-slate-500">
                    · 7일 이후
                  </span>
                  <ChevronDown
                    size={20}
                    strokeWidth={2}
                    aria-hidden="true"
                    className="text-slate-500 group-hover:text-slate-800"
                  />
                </button>
              )}

              {isExpanded && after7Days.length > 0 && (
                <button
                  type="button"
                  onClick={toggleExpanded}
                  className="min-h-11 w-full flex items-center justify-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors py-1 px-1.5 rounded-lg hover:bg-slate-100/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 group"
                >
                  <span>접기</span>
                  <ChevronUp size={20} strokeWidth={2} aria-hidden="true" />
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
