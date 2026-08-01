import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
const PANEL_GAP = 20; // 20px gap between month slide panels

// Global memoization cache for month grids
const monthGridCache = new Map<string, string[]>();
function getMonthGridMemoized(anchorKey: string): string[] {
  if (!monthGridCache.has(anchorKey)) {
    monthGridCache.set(anchorKey, monthGrid(anchorKey));
  }
  return monthGridCache.get(anchorKey)!;
}

function normalizeDate(dateStr: string): { key: string; year: number; month: number; date: number; label: string } {
  if (dateStr.includes('-')) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return { key: dateStr, year: y, month: m - 1, date: d, label: `${m}/${d}` };
  } else if (dateStr.includes('/')) {
    const [m, d] = dateStr.split('/').map(Number);
    const y = new Date().getFullYear();
    const key = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return { key, year: y, month: m - 1, date: d, label: `${m}/${d}` };
  }
  return { key: dateStr, year: new Date().getFullYear(), month: 0, date: 1, label: dateStr };
}

function getMonthOffsetKeyFromBase(baseKey: string, offset: number): string {
  const d = parseKey(baseKey);
  const targetDate = new Date(d.getFullYear(), d.getMonth() + offset, 1);
  const y = targetDate.getFullYear();
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

function getMonthKeyString(anchorKey: string): string {
  const d = parseKey(anchorKey);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function getMonthDifference(anchor1: string, anchor2: string): number {
  const d1 = parseKey(anchor1);
  const d2 = parseKey(anchor2);
  return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
}

interface DayCellProps {
  dateKey: string;
  dayNum: number;
  isSameMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
  scheduleExists: boolean;
  summaryType?: 'todos' | 'memo' | null;
  summaryDone?: number;
  summaryTotal?: number;
  onClick: (dateKey: string) => void;
}

const DayCell = React.memo(function DayCell({
  dateKey,
  dayNum,
  isSameMonth,
  isSelected,
  isToday,
  scheduleExists,
  summaryType,
  summaryDone,
  summaryTotal,
  onClick,
}: DayCellProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(dateKey)}
      className={`h-12 flex flex-col items-center justify-between p-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 relative select-auto ${
        isSelected
          ? 'bg-slate-900 text-white font-bold shadow-xs'
          : isSameMonth
          ? 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-100'
          : 'bg-slate-50/50 hover:bg-slate-100 text-slate-300 opacity-60 border border-transparent'
      } ${
        isToday && !isSelected ? 'ring-1.5 ring-slate-800 font-bold' : ''
      }`}
    >
      {/* Day Number and Schedule Dot indicator */}
      <div className="w-full flex items-center justify-between px-0.5">
        <span className="text-xs font-mono">{dayNum}</span>
        {scheduleExists ? (
          <span
            title="일정 있음"
            className={`text-[8px] leading-none ${
              isSelected ? 'text-amber-300' : 'text-amber-500'
            }`}
          >
            ●
          </span>
        ) : (
          <span className="w-2" />
        )}
      </div>

      {/* Day content summary */}
      <div className="h-4 flex items-center justify-center text-[10px] font-mono leading-none">
        {summaryType === 'todos' && (
          <span
            className={
              isSelected
                ? 'text-sky-300 font-semibold'
                : 'text-slate-500 font-medium'
            }
          >
            {summaryDone}/{summaryTotal}
          </span>
        )}
        {summaryType === 'memo' && (
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
});

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  // Fixed base month anchor initialized on mount
  const [baseMonthKey] = useState<string>(() => anchor);
  // Month offset index relative to baseMonthKey
  const [monthOffsetIndex, setMonthOffsetIndex] = useState<number>(0);

  const [dragDx, setDragDx] = useState<number>(0);
  const [isSwiping, setIsSwiping] = useState<boolean>(false);

  const pointerStateRef = useRef<{
    startX: number;
    startY: number;
    startTime: number;
    pointerId: number;
    isSwiping: boolean;
    isDecided: boolean;
  } | null>(null);

  const today = todayKey();

  // Sync monthOffsetIndex if anchor changes externally
  useEffect(() => {
    const diff = getMonthDifference(baseMonthKey, anchor);
    if (diff !== monthOffsetIndex) {
      setMonthOffsetIndex(diff);
    }
  }, [anchor, baseMonthKey, monthOffsetIndex]);

  // Current displayed month title
  const currentDisplayedAnchor = getMonthOffsetKeyFromBase(baseMonthKey, monthOffsetIndex);
  const currentDisplayedDate = parseKey(currentDisplayedAnchor);
  const monthTitle = `${currentDisplayedDate.getFullYear()}년 ${currentDisplayedDate.getMonth() + 1}월`;

  // Pre-calculate schedules and summaries lookup maps
  const scheduleKeysSet = useMemo(() => {
    const set = new Set<string>();
    for (const item of schedule) {
      set.add(normalizeDate(item.date).key);
    }
    return set;
  }, [schedule]);

  const daySummariesMap = useMemo(() => {
    const map = new Map<string, { type: 'todos' | 'memo'; done?: number; total?: number }>();
    for (const [key, day] of Object.entries(days)) {
      if (!day) continue;
      const todos = day.todos || [];
      const memo = day.memo || '';
      if (todos.length > 0) {
        const doneCount = todos.filter((t) => t.done).length;
        map.set(key, { type: 'todos', done: doneCount, total: todos.length });
      } else if (memo.trim().length > 0) {
        map.set(key, { type: 'memo' });
      }
    }
    return map;
  }, [days]);

  const handleSelectDateStable = useCallback(
    (key: string) => {
      onSelectDate(key);
    },
    [onSelectDate]
  );

  // Measure container width on resize
  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    updateWidth();

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect && entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleGoPrev = useCallback(() => {
    setMonthOffsetIndex((prev) => prev - 1);
    onPrevMonth();
  }, [onPrevMonth]);

  const handleGoNext = useCallback(() => {
    setMonthOffsetIndex((prev) => prev + 1);
    onNextMonth();
  }, [onNextMonth]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    pointerStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startTime: Date.now(),
      pointerId: e.pointerId,
      isSwiping: false,
      isDecided: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const state = pointerStateRef.current;
    if (!state || state.pointerId !== e.pointerId) return;

    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;

    if (!state.isDecided) {
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (absDx > 8 || absDy > 8) {
        state.isDecided = true;
        if (absDx > absDy * 1.5) {
          state.isSwiping = true;
          setIsSwiping(true);
        } else {
          pointerStateRef.current = null;
          return;
        }
      }
    }

    if (state.isSwiping) {
      setDragDx(dx);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const state = pointerStateRef.current;
    if (!state || state.pointerId !== e.pointerId) return;
    pointerStateRef.current = null;

    if (!state.isSwiping) return;

    const dx = e.clientX - state.startX;
    const dt = Date.now() - state.startTime;
    const w = containerWidth || (containerRef.current ? containerRef.current.clientWidth : 300);
    const speed = Math.abs(dx) / Math.max(dt, 1);

    const isFlick = speed > 0.3 && Math.abs(dx) > 20;
    const isDistancePassed = Math.abs(dx) >= w * 0.25;

    setIsSwiping(false);
    setDragDx(0);

    if (isDistancePassed || isFlick) {
      if (dx < 0) {
        handleGoNext();
      } else {
        handleGoPrev();
      }
    }
  };

  // Render range: 5 months centered around monthOffsetIndex: [monthOffsetIndex - 2 ... monthOffsetIndex + 2]
  const visibleOffsetIndices = useMemo(() => {
    const indices: number[] = [];
    for (let offset = monthOffsetIndex - 2; offset <= monthOffsetIndex + 2; offset++) {
      indices.push(offset);
    }
    return indices;
  }, [monthOffsetIndex]);

  const step = (containerWidth || 300) + PANEL_GAP;

  const renderMonthPanel = (offsetIndex: number) => {
    const panelAnchorKey = getMonthOffsetKeyFromBase(baseMonthKey, offsetIndex);
    const panelMonthKey = getMonthKeyString(panelAnchorKey);
    const gridKeys = getMonthGridMemoized(panelAnchorKey);
    const gridAnchorDate = parseKey(panelAnchorKey);
    const gridCurrentMonth = gridAnchorDate.getMonth();

    return (
      <div
        key={panelMonthKey}
        className="absolute top-0 left-0 w-full"
        style={{
          transform: `translateX(${offsetIndex * step}px)`,
        }}
      >
        <div className="grid grid-cols-7 gap-1 text-center font-semibold text-xs py-1 mb-1">
          {WEEKDAY_NAMES.map((name, i) => (
            <div
              key={name}
              className={
                i === 0 ? 'text-red-500/80' : i === 6 ? 'text-blue-500/80' : 'text-slate-400'
              }
            >
              {name}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {gridKeys.map((key) => {
            const d = parseKey(key);
            const dayNum = d.getDate();
            const isSameMonth = d.getMonth() === gridCurrentMonth;
            const isSelected = key === activeKey;
            const isToday = key === today;
            const scheduleExists = scheduleKeysSet.has(key);
            const summary = daySummariesMap.get(key);

            return (
              <DayCell
                key={key}
                dateKey={key}
                dayNum={dayNum}
                isSameMonth={isSameMonth}
                isSelected={isSelected}
                isToday={isToday}
                scheduleExists={scheduleExists}
                summaryType={summary?.type}
                summaryDone={summary?.done}
                summaryTotal={summary?.total}
                onClick={handleSelectDateStable}
              />
            );
          })}
        </div>
      </div>
    );
  };

  // Schedules for current displayed month
  const monthSchedules = schedule
    .map((item) => ({
      ...item,
      norm: normalizeDate(item.date),
    }))
    .filter(
      (item) =>
        item.norm.year === currentDisplayedDate.getFullYear() &&
        item.norm.month === currentDisplayedDate.getMonth()
    )
    .sort((a, b) => a.norm.key.localeCompare(b.norm.key));

  return (
    <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 space-y-3 select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between text-sm font-semibold text-slate-800">
        <button
          type="button"
          onClick={onBackToWeek}
          className="flex items-center gap-1 font-semibold text-slate-700 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300 rounded px-1.5 py-0.5 select-auto"
        >
          <span>‹</span>
          <span className="text-xs">주간 뷰로 돌아가기</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleGoPrev}
            aria-label="이전 달"
            className="p-1 rounded hover:bg-slate-200/70 text-slate-500 hover:text-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300 select-auto"
          >
            ‹
          </button>
          <span className="font-bold text-slate-900">{monthTitle}</span>
          <button
            type="button"
            onClick={handleGoNext}
            aria-label="다음 달"
            className="p-1 rounded hover:bg-slate-200/70 text-slate-500 hover:text-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300 select-auto"
          >
            ›
          </button>
        </div>
      </div>

      {/* Grid Container with swipe gesture */}
      <div
        ref={containerRef}
        className="overflow-hidden touch-pan-y relative"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          className="relative w-full h-[340px]"
          style={{
            transform: `translateX(${-monthOffsetIndex * step + dragDx}px)`,
            transition: isSwiping ? 'none' : 'transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1)',
            willChange: 'transform',
          }}
        >
          {visibleOffsetIndices.map((idx) => renderMonthPanel(idx))}
        </div>
      </div>

      {/* Month Schedule List */}
      {monthSchedules.length > 0 && (
        <div className="pt-3 border-t border-slate-200/80 space-y-2 select-auto">
          <div className="text-xs font-semibold text-slate-500 px-1">
            📌 이 달의 일정
          </div>
          <ul className="space-y-1 text-xs">
            {monthSchedules.map((item) => (
              <li
                key={item.id}
                onClick={() => onSelectDate(item.norm.key)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer text-slate-700 bg-white border border-slate-100"
              >
                <span className="text-amber-500 text-[10px]">●</span>
                <span className="font-mono font-semibold text-slate-600 w-10 shrink-0">
                  {item.norm.label}
                </span>
                <span className="font-medium text-slate-800 truncate">
                  {item.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
