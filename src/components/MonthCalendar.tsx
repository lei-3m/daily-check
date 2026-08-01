import React from 'react';
import { Day, ScheduleItem } from '../lib/types';
import { todayKey, monthGrid, parseKey } from '../lib/date';

interface MonthCalendarProps {
  anchor: string;
  activeKey: string;
  days: Record<string, Day>;
  schedule: ScheduleItem[];
  onSelectDate: (key: string) => void;
  onBackToWeek: () => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

const WEEKDAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

export function MonthCalendar({
  anchor,
  activeKey,
  days,
  schedule,
  onSelectDate,
  onBackToWeek,
  onPrevMonth,
  onNextMonth,
}: MonthCalendarProps) {
  const today = todayKey();
  const anchorDate = parseKey(anchor);
  const currentMonth = anchorDate.getMonth();
  const monthTitle = `${anchorDate.getFullYear()}년 ${currentMonth + 1}월`;
  const gridKeys = monthGrid(anchor);

  const hasSchedule = (key: string) => {
    const d = parseKey(key);
    const short = `${d.getMonth() + 1}/${d.getDate()}`;
    return schedule.some((item) => item.date === key || item.date === short);
  };

  const getDaySummary = (key: string) => {
    const day = days[key];
    if (!day) return null;
    const todos = day.todos || [];
    const memo = day.memo || '';

    if (todos.length > 0) {
      const doneCount = todos.filter((t) => t.done).length;
      return { type: 'todos', done: doneCount, total: todos.length };
    } else if (memo.trim().length > 0) {
      return { type: 'memo' };
    }
    return null;
  };

  return (
    <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 space-y-3">
      {/* Top Header */}
      <div className="flex items-center justify-between text-sm font-semibold text-slate-800">
        <button
          type="button"
          onClick={onBackToWeek}
          className="flex items-center gap-1 font-semibold text-slate-700 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300 rounded px-1.5 py-0.5"
        >
          <span>‹</span>
          <span className="text-xs">주간 뷰로 돌아가기</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrevMonth}
            aria-label="이전 달"
            className="p-1 rounded hover:bg-slate-200/70 text-slate-500 hover:text-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            ‹
          </button>
          <span className="font-bold text-slate-900">{monthTitle}</span>
          <button
            type="button"
            onClick={onNextMonth}
            aria-label="다음 달"
            className="p-1 rounded hover:bg-slate-200/70 text-slate-500 hover:text-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            ›
          </button>
        </div>
      </div>

      {/* Grid: 7 columns */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_NAMES.map((name, i) => (
          <div
            key={name}
            className={`text-xs font-semibold py-1 ${
              i === 0 ? 'text-red-500/80' : i === 6 ? 'text-blue-500/80' : 'text-slate-400'
            }`}
          >
            {name}
          </div>
        ))}

        {gridKeys.map((key) => {
          const d = parseKey(key);
          const dayNum = d.getDate();
          const isSameMonth = d.getMonth() === currentMonth;
          const isSelected = key === activeKey;
          const isToday = key === today;
          const scheduleExists = hasSchedule(key);
          const summary = getDaySummary(key);

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDate(key)}
              className={`h-12 flex flex-col items-center justify-between p-1 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-slate-400 relative ${
                isSelected
                  ? 'bg-slate-900 text-white font-bold shadow-xs'
                  : isSameMonth
                  ? 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-100'
                  : 'bg-slate-50/50 hover:bg-slate-100 text-slate-300'
              } ${
                isToday && !isSelected ? 'ring-1.5 ring-slate-800 font-bold' : ''
              }`}
            >
              {/* Day Number and Schedule indicator */}
              <div className="w-full flex items-center justify-between px-0.5">
                <span className="text-xs font-mono">{dayNum}</span>
                {scheduleExists && (
                  <span
                    title="일정 있음"
                    className={`text-[9px] ${
                      isSelected ? 'text-amber-300' : 'text-slate-500'
                    }`}
                  >
                    📌
                  </span>
                )}
              </div>

              {/* Day content summary (Todos count or Memo dot) */}
              <div className="h-4 flex items-center justify-center text-[10px] font-mono leading-none">
                {summary?.type === 'todos' && (
                  <span
                    className={
                      isSelected
                        ? 'text-sky-300 font-semibold'
                        : 'text-slate-500 font-medium'
                    }
                  >
                    {summary.done}/{summary.total}
                  </span>
                )}
                {summary?.type === 'memo' && (
                  <span
                    className={
                      isSelected ? 'text-amber-300 font-bold' : 'text-slate-400'
                    }
                  >
                    ·
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
