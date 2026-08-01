import React from 'react';
import { Day } from '../lib/types';
import { todayKey, weekDays, weekMonthLabel, parseKey } from '../lib/date';

interface WeekStripProps {
  anchor: string;
  activeKey: string;
  days: Record<string, Day>;
  onSelectDate: (key: string) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onGoToday: () => void;
  onOpenMonthView: () => void;
}

const WEEKDAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

export function WeekStrip({
  anchor,
  activeKey,
  days,
  onSelectDate,
  onPrevWeek,
  onNextWeek,
  onGoToday,
  onOpenMonthView,
}: WeekStripProps) {
  const today = todayKey();
  const currentWeekDays = weekDays(anchor);
  const isTodayInWeek = currentWeekDays.includes(today);
  const monthTitle = weekMonthLabel(anchor);

  const hasContent = (key: string) => {
    const day = days[key];
    if (!day) return false;
    const hasTodos = day.todos && day.todos.length > 0;
    const hasMemo = day.memo && day.memo.trim().length > 0;
    return hasTodos || hasMemo;
  };

  return (
    <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 space-y-2.5">
      {/* Header: Prev, Title + Today Button, Next */}
      <div className="flex items-center justify-between text-sm font-semibold text-slate-800">
        <button
          type="button"
          onClick={onPrevWeek}
          aria-label="이전 주"
          className="p-1 rounded hover:bg-slate-200/70 text-slate-500 hover:text-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300"
        >
          ‹
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenMonthView}
            className="flex items-center gap-1 font-bold text-slate-900 hover:text-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300 rounded px-1.5 py-0.5"
          >
            <span>{monthTitle}</span>
            <span className="text-xs text-slate-400">›</span>
          </button>

          {!isTodayInWeek && (
            <button
              type="button"
              onClick={onGoToday}
              className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 hover:bg-slate-300 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              오늘
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onNextWeek}
          aria-label="다음 주"
          className="p-1 rounded hover:bg-slate-200/70 text-slate-500 hover:text-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300"
        >
          ›
        </button>
      </div>

      {/* Week Grid: 7 columns */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_NAMES.map((name, i) => (
          <div
            key={name}
            className={`text-xs font-semibold py-0.5 ${
              i === 0 ? 'text-red-500/80' : i === 6 ? 'text-blue-500/80' : 'text-slate-400'
            }`}
          >
            {name}
          </div>
        ))}

        {currentWeekDays.map((key) => {
          const d = parseKey(key);
          const dayNum = d.getDate();
          const isSelected = key === activeKey;
          const isToday = key === today;
          const dayHasContent = hasContent(key);

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDate(key)}
              className={`flex flex-col items-center justify-center py-2 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-slate-400 relative ${
                isSelected
                  ? 'bg-slate-900 text-white font-bold shadow-xs'
                  : 'hover:bg-slate-200/60 text-slate-700 font-medium'
              }`}
            >
              <span className="text-sm font-mono leading-none">{dayNum}</span>

              {/* Indicator dots container */}
              <div className="h-2.5 flex items-center justify-center gap-0.5 mt-1">
                {isToday && (
                  <span
                    title="오늘"
                    className={`w-1.5 h-1.5 rounded-full ${
                      isSelected ? 'bg-amber-400' : 'bg-slate-900'
                    }`}
                  />
                )}
                {dayHasContent && (
                  <span
                    title="내용 있음"
                    className={`w-1 h-1 rounded-full ${
                      isSelected ? 'bg-sky-300' : 'bg-slate-400'
                    }`}
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
