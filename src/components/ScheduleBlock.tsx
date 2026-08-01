import React, { useState, useEffect, useRef } from 'react';
import { ScheduleItem } from '../lib/types';
import { todayKey, shortLabel, addDays } from '../lib/date';

interface ScheduleBlockProps {
  schedule: ScheduleItem[];
  activeKey: string;
  onAddSchedule: (date: string, text: string) => void;
  onEditSchedule: (id: string, newDate: string, newText: string) => void;
  onDeleteSchedule: (id: string) => void;
  onOpenMonthView?: () => void;
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
  item: ScheduleItem;
  onEditSchedule: (id: string, newDate: string, newText: string) => void;
  onDeleteSchedule: (id: string) => void;
}

function ScheduleItemRow({
  item,
  onEditSchedule,
  onDeleteSchedule,
}: ScheduleItemRowProps) {
  const [isEditingText, setIsEditingText] = useState(false);
  const [editText, setEditText] = useState(item.text);
  const textInputRef = useRef<HTMLInputElement>(null);
  const datePickerRef = useRef<HTMLInputElement>(null);

  const normalizedDate = normalizeDateKey(item.date);

  useEffect(() => {
    setEditText(item.text);
  }, [item.text]);

  useEffect(() => {
    if (isEditingText && textInputRef.current) {
      textInputRef.current.focus();
      textInputRef.current.select();
    }
  }, [isEditingText]);

  const handleSaveText = () => {
    setIsEditingText(false);
    const trimmed = editText.trim();
    if (!trimmed) {
      onDeleteSchedule(item.id);
    } else if (trimmed !== item.text) {
      onEditSchedule(item.id, item.date, trimmed);
    }
  };

  const handleCancelText = () => {
    setEditText(item.text);
    setIsEditingText(false);
  };

  const handleTextKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveText();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelText();
    }
  };

  const handleDateClick = () => {
    if (datePickerRef.current) {
      if (
        'showPicker' in datePickerRef.current &&
        typeof datePickerRef.current.showPicker === 'function'
      ) {
        datePickerRef.current.showPicker();
      } else {
        datePickerRef.current.click();
      }
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    if (newDate && newDate !== normalizedDate) {
      onEditSchedule(item.id, newDate, item.text);
    }
  };

  return (
    <li className="flex items-center justify-between group py-1 px-1.5 rounded hover:bg-slate-100/80 transition-colors min-w-0 gap-2">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Date Selector Button */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={handleDateClick}
            title="날짜 수정"
            className="font-mono text-xs font-semibold text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 px-1.5 py-0.5 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-slate-300 cursor-pointer"
          >
            {formatDisplayDate(item.date)}
          </button>
          <input
            ref={datePickerRef}
            type="date"
            value={normalizedDate}
            onChange={handleDateChange}
            className="sr-only absolute inset-0 opacity-0 pointer-events-none"
            tabIndex={-1}
          />
        </div>

        {/* Text Display or Text Input */}
        {isEditingText ? (
          <input
            ref={textInputRef}
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={handleSaveText}
            onKeyDown={handleTextKeyDown}
            className="flex-1 text-xs border border-slate-300 rounded px-1.5 py-0.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 font-medium min-w-0"
          />
        ) : (
          <span
            onClick={() => setIsEditingText(true)}
            title="클릭하여 수정"
            className="font-medium text-slate-800 truncate min-w-0 flex-1 cursor-pointer hover:bg-slate-200/60 rounded px-1 py-0.5 transition-colors"
          >
            {item.text}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => onDeleteSchedule(item.id)}
        aria-label="일정 삭제"
        className="w-8 h-8 flex items-center justify-center shrink-0 text-slate-400 [@media(hover:hover)]:hover:text-red-500 [@media(hover:hover)]:hover:bg-red-50 focus:text-red-500 rounded-lg transition-colors cursor-pointer"
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
  onEditSchedule,
  onDeleteSchedule,
  onOpenMonthView,
}: ScheduleBlockProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
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

  // Filter only today or upcoming schedules and sort by date ascending
  const upcomingSchedules = [...schedule]
    .filter((item) => normalizeDateKey(item.date) >= today)
    .sort((a, b) => {
      const dateA = normalizeDateKey(a.date);
      const dateB = normalizeDateKey(b.date);
      return dateA.localeCompare(dateB);
    });

  const within7Days = upcomingSchedules.filter(
    (item) => normalizeDateKey(item.date) <= limit7Date
  );
  const after7Days = upcomingSchedules.filter(
    (item) => normalizeDateKey(item.date) > limit7Date
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
        onClick={() => setIsCollapsed(!isCollapsed)}
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
            <div className="space-y-1 max-h-[35vh] overflow-y-auto pr-1">
              {displayedSchedules.length > 0 && (
                <ul className="space-y-1 text-xs text-slate-700">
                  {displayedSchedules.map((item) => (
                    <ScheduleItemRow
                      key={item.id}
                      item={item}
                      onEditSchedule={onEditSchedule}
                      onDeleteSchedule={onDeleteSchedule}
                    />
                  ))}
                </ul>
              )}

              {/* Toggle expand/collapse button for schedules after 7 days */}
              {after7Days.length > 0 && !isExpanded && (
                <button
                  type="button"
                  onClick={() => setIsExpanded(true)}
                  className="w-full flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors py-1 px-1.5 rounded hover:bg-slate-100/80 focus:outline-none focus:ring-2 focus:ring-slate-300 group"
                >
                  <span className="font-mono font-semibold text-slate-600 group-hover:text-slate-900">
                    +{after7Days.length}개
                  </span>
                  <span className="text-slate-400 group-hover:text-slate-700 font-bold">▾</span>
                </button>
              )}

              {isExpanded && after7Days.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="w-full flex items-center justify-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors py-1 px-1.5 rounded hover:bg-slate-100/80 focus:outline-none focus:ring-2 focus:ring-slate-300 group"
                >
                  <span>접기</span>
                  <span className="font-bold">▴</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
