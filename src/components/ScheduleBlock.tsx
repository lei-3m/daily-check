import React, { useState, useEffect } from 'react';
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
  const [showPast, setShowPast] = useState(false);
  const [inputDate, setInputDate] = useState(activeKey || todayKey());
  const [inputText, setInputText] = useState('');

  useEffect(() => {
    if (activeKey) {
      setInputDate(activeKey);
    }
  }, [activeKey]);

  const today = todayKey();

  // Sort schedule by date ascending
  const sortedSchedule = [...schedule].sort((a, b) => {
    const dateA = normalizeDateKey(a.date);
    const dateB = normalizeDateKey(b.date);
    return dateA.localeCompare(dateB);
  });

  const pastSchedules = sortedSchedule.filter(
    (item) => normalizeDateKey(item.date) < today
  );
  const upcomingSchedules = sortedSchedule.filter(
    (item) => normalizeDateKey(item.date) >= today
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onAddSchedule(inputDate, inputText.trim());
    setInputText('');
  };

  return (
    <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 space-y-3">
      {/* Block Header */}
      <div
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center justify-between cursor-pointer select-none"
      >
        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          <span>📌</span>
          <span>일정</span>
          <span className="text-xs text-slate-400 font-normal ml-1">
            ({schedule.length})
          </span>
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
        <div className="space-y-3">
          {/* Add Schedule Form */}
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <input
              type="date"
              value={inputDate}
              onChange={(e) => setInputDate(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 font-mono"
            />
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="일정 입력"
              className="flex-1 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="text-xs px-2.5 py-1.5 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              추가
            </button>
          </form>

          {/* Schedule List or Empty State */}
          {sortedSchedule.length === 0 ? (
            <div className="text-xs text-slate-400 py-2 text-center">
              등록된 일정이 없어요.
            </div>
          ) : (
            <div className="space-y-2">
              {/* Past Schedules Collapsible */}
              {pastSchedules.length > 0 && (
                <div className="border-b border-slate-200/60 pb-2">
                  <button
                    type="button"
                    onClick={() => setShowPast(!showPast)}
                    className="text-xs text-slate-500 font-medium hover:text-slate-800 flex items-center gap-1 transition-colors focus:outline-none"
                  >
                    <span>지난 일정 {pastSchedules.length}개</span>
                    <span>{showPast ? '▾' : '▸'}</span>
                  </button>

                  {showPast && (
                    <ul className="mt-2 space-y-1.5 pl-2 text-xs text-slate-500">
                      {pastSchedules.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center justify-between group py-0.5 hover:bg-slate-100/60 rounded px-1 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-slate-400 font-semibold w-10 shrink-0 text-right">
                              {formatDisplayDate(item.date)}
                            </span>
                            <span className="truncate line-through text-slate-400">
                              {item.text}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => onDeleteSchedule(item.id)}
                            aria-label="일정 삭제"
                            className="text-slate-300 hover:text-red-500 opacity-40 group-hover:opacity-100 transition-opacity p-0.5"
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Upcoming / Today Schedules */}
              <ul className="space-y-1.5 text-xs text-slate-700">
                {upcomingSchedules.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between group py-1 px-1.5 rounded hover:bg-slate-100/80 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-xs font-semibold text-slate-500 w-10 shrink-0 text-right">
                        {formatDisplayDate(item.date)}
                      </span>
                      <span className="font-medium text-slate-800 truncate">
                        {item.text}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteSchedule(item.id)}
                      aria-label="일정 삭제"
                      className="text-slate-300 hover:text-red-500 opacity-30 group-hover:opacity-100 focus:opacity-100 transition-opacity p-0.5 rounded"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
