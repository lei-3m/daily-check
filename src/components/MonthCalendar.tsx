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

function getMonthOffsetKey(anchorKey: string, monthOffset: number): string {
  const d = parseKey(anchorKey);
  const targetDate = new Date(d.getFullYear(), d.getMonth() + monthOffset, 1);
  const y = targetDate.getFullYear();
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
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
      className={`h-12 flex flex-col items-center justify-between p-1 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-slate-400 relative select-auto ${
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
  const trackRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const isAnimatingRef = useRef(false);

  const pointerStateRef = useRef<{
    startX: number;
    startY: number;
    startTime: number;
    pointerId: number;
    isSwiping: boolean;
    isDecided: boolean;
  } | null>(null);

  const today = todayKey();
  const anchorDate = parseKey(anchor);
  const currentMonth = anchorDate.getMonth();
  const monthTitle = `${anchorDate.getFullYear()}년 ${currentMonth + 1}월`;

  const prevAnchor = getMonthOffsetKey(anchor, -1);
  const nextAnchor = getMonthOffsetKey(anchor, 1);

  // Stable grid keys for current, prev, next months
  const prevGridKeys = useMemo(() => getMonthGridMemoized(prevAnchor), [prevAnchor]);
  const currentGridKeys = useMemo(() => getMonthGridMemoized(anchor), [anchor]);
  const nextGridKeys = useMemo(() => getMonthGridMemoized(nextAnchor), [nextAnchor]);

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

  const handleSelectDateStable = useCallback((key: string) => {
    onSelectDate(key);
  }, [onSelectDate]);

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

  // Reset transform whenever anchor or containerWidth changes
  useEffect(() => {
    if (trackRef.current && containerRef.current) {
      const w = containerWidth || containerRef.current.clientWidth || 300;
      const step = w + PANEL_GAP;
      trackRef.current.style.transition = 'none';
      trackRef.current.style.transform = `translateX(-${step}px)`;
    }
    isAnimatingRef.current = false;
  }, [anchor, containerWidth]);

  const animateAndNavigate = (dir: 'next' | 'prev') => {
    if (isAnimatingRef.current || !trackRef.current || !containerRef.current) {
      if (dir === 'next') onNextMonth();
      else onPrevMonth();
      return;
    }

    const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isReducedMotion) {
      if (dir === 'next') onNextMonth();
      else onPrevMonth();
      return;
    }

    const w = containerWidth || containerRef.current.clientWidth || 300;
    const step = w + PANEL_GAP;
    isAnimatingRef.current = true;
    trackRef.current.style.transition = 'transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1)';
    trackRef.current.style.transform = `translateX(${dir === 'next' ? -2 * step : 0}px)`;

    setTimeout(() => {
      requestAnimationFrame(() => {
        if (trackRef.current) {
          trackRef.current.style.transition = 'none';
          trackRef.current.style.transform = `translateX(-${step}px)`;
        }
        isAnimatingRef.current = false;
        if (dir === 'next') onNextMonth();
        else onPrevMonth();
      });
    }, 180);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isAnimatingRef.current) return;
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
          if (trackRef.current) {
            trackRef.current.style.transition = 'none';
          }
        } else {
          // Vertical scroll - release pointer tracking
          pointerStateRef.current = null;
          return;
        }
      }
    }

    if (state.isSwiping && trackRef.current && containerRef.current) {
      const w = containerWidth || containerRef.current.clientWidth || 300;
      const step = w + PANEL_GAP;
      trackRef.current.style.transform = `translateX(${-step + dx}px)`;
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const state = pointerStateRef.current;
    if (!state || state.pointerId !== e.pointerId) return;
    pointerStateRef.current = null;

    if (!state.isSwiping || !trackRef.current || !containerRef.current) return;

    const dx = e.clientX - state.startX;
    const dt = Date.now() - state.startTime;
    const w = containerWidth || containerRef.current.clientWidth || 300;
    const step = w + PANEL_GAP;
    const speed = Math.abs(dx) / Math.max(dt, 1);

    const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const isFlick = speed > 0.3 && Math.abs(dx) > 20;
    const isDistancePassed = Math.abs(dx) >= w * 0.25;

    let direction: 'next' | 'prev' | 'reset' = 'reset';
    if (isDistancePassed || isFlick) {
      if (dx < 0) {
        direction = 'next';
      } else {
        direction = 'prev';
      }
    }

    if (isReducedMotion) {
      trackRef.current.style.transition = 'none';
      trackRef.current.style.transform = `translateX(-${step}px)`;
      if (direction === 'next') onNextMonth();
      else if (direction === 'prev') onPrevMonth();
      return;
    }

    isAnimatingRef.current = true;
    trackRef.current.style.transition = 'transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1)';

    let targetX = -step;
    if (direction === 'next') {
      targetX = -2 * step;
    } else if (direction === 'prev') {
      targetX = 0;
    }

    trackRef.current.style.transform = `translateX(${targetX}px)`;

    setTimeout(() => {
      requestAnimationFrame(() => {
        if (trackRef.current) {
          trackRef.current.style.transition = 'none';
          trackRef.current.style.transform = `translateX(-${step}px)`;
        }
        isAnimatingRef.current = false;
        if (direction === 'next') {
          onNextMonth();
        } else if (direction === 'prev') {
          onPrevMonth();
        }
      });
    }, 180);
  };

  const renderMonthGrid = (gridAnchorKey: string, gridKeys: string[]) => {
    const gridAnchorDate = parseKey(gridAnchorKey);
    const gridCurrentMonth = gridAnchorDate.getMonth();

    return (
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
    );
  };

  // Schedules for the current month
  const monthSchedules = schedule
    .map((item) => ({
      ...item,
      norm: normalizeDate(item.date),
    }))
    .filter(
      (item) =>
        item.norm.year === anchorDate.getFullYear() &&
        item.norm.month === currentMonth
    )
    .sort((a, b) => a.norm.key.localeCompare(b.norm.key));

  const initStep = (containerWidth || 300) + PANEL_GAP;

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
            onClick={() => animateAndNavigate('prev')}
            aria-label="이전 달"
            className="p-1 rounded hover:bg-slate-200/70 text-slate-500 hover:text-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300 select-auto"
          >
            ‹
          </button>
          <span className="font-bold text-slate-900">{monthTitle}</span>
          <button
            type="button"
            onClick={() => animateAndNavigate('next')}
            aria-label="다음 달"
            className="p-1 rounded hover:bg-slate-200/70 text-slate-500 hover:text-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300 select-auto"
          >
            ›
          </button>
        </div>
      </div>

      {/* Weekday Names Header (Fixed) */}
      <div className="grid grid-cols-7 gap-1 text-center font-semibold text-xs py-1">
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

      {/* Sliding Carousel Container */}
      <div
        ref={containerRef}
        className="overflow-hidden touch-pan-y relative"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          ref={trackRef}
          className="flex will-change-transform"
          style={{
            gap: `${PANEL_GAP}px`,
            transform: `translateX(-${initStep}px)`,
          }}
        >
          {/* Slide 0: Previous Month */}
          <div
            className="shrink-0"
            style={{ width: containerWidth ? `${containerWidth}px` : '100%' }}
          >
            {renderMonthGrid(prevAnchor, prevGridKeys)}
          </div>

          {/* Slide 1: Current Month */}
          <div
            className="shrink-0"
            style={{ width: containerWidth ? `${containerWidth}px` : '100%' }}
          >
            {renderMonthGrid(anchor, currentGridKeys)}
          </div>

          {/* Slide 2: Next Month */}
          <div
            className="shrink-0"
            style={{ width: containerWidth ? `${containerWidth}px` : '100%' }}
          >
            {renderMonthGrid(nextAnchor, nextGridKeys)}
          </div>
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


