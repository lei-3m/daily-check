import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Day, ScheduleItem } from '../lib/types';
import { todayKey, weekDays, weekMonthLabel, parseKey, startOfWeek, addDays } from '../lib/date';

interface WeekStripProps {
  anchor: string;
  activeKey: string;
  days: Record<string, Day>;
  schedule: ScheduleItem[];
  onSelectDate: (key: string) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onGoToday: () => void;
  onOpenMonthView: () => void;
}

const WEEKDAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const PANEL_GAP = 20; // 20px gap between week slide panels
const MS_PER_DAY = 86400000;

// 주간 뷰는 화면 중간에 있고 바로 아래에 dnd-kit 정렬 목록이 있어서
// 월 달력(8px / 1.5배)보다 보수적으로 가로 스와이프를 판정한다.
// 다만 실제 기기에서 손가락은 완전히 수평으로 움직이지 않으므로 너무 조이면 시작되지 않는다.
const DRAG_START_PX = 25; // 가로 이동이 25px을 넘어야 드래그 시작
const DRAG_AXIS_RATIO = 1.3; // |dx| > |dy| * 1.3 일 때만 가로로 인정
const VERTICAL_ABORT_PX = 20; // 세로가 먼저 앞서면 제스처를 포기하고 스크롤에 넘김
const COMMIT_RATIO = 0.25; // 폭의 25% 이상 이동하면 전환
const FLICK_SPEED = 0.3; // px/ms
const FLICK_MIN_PX = 20;
const PANEL_FALLBACK_HEIGHT = 44;
const WEEK_DOT_ROW_CLASS = 'h-2.5 mt-1 flex items-center justify-center gap-0.5';
const WEEK_SCHEDULE_DOT_CLASS = 'w-1.5 h-1.5 rounded-full shrink-0 accent-dot';
const WEEK_TODO_DOT_CLASS = 'w-1 h-1 rounded-full shrink-0 calendar-todo-dot';

function normalizeScheduleDateKey(dateStr: string): string {
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

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function getWeekOffsetKey(baseWeekKey: string, offset: number): string {
  return addDays(baseWeekKey, offset * 7);
}

function getWeekDifference(baseWeekKey: string, key: string): number {
  const dayDiff = Math.round(
    (parseKey(startOfWeek(key)).getTime() - parseKey(baseWeekKey).getTime()) / MS_PER_DAY
  );
  return Math.round(dayDiff / 7);
}

interface WeekPanelProps {
  weekKey: string;
  /** 현재 보이는 주 패널에만 선택 상태를 넘긴다. 레일의 인접 주 패널은 항상 null. */
  activeKey: string | null;
  today: string;
  contentKeys: Set<string>;
  scheduleKeys: Set<string>;
  onSelectDate: (key: string) => void;
}

const WeekPanel = React.memo(function WeekPanel({
  weekKey,
  activeKey,
  today,
  contentKeys,
  scheduleKeys,
  onSelectDate,
}: WeekPanelProps) {
  return (
    <div className="grid grid-cols-7 gap-1 text-center">
      {weekDays(weekKey).map((key) => {
        const d = parseKey(key);
        const dayNum = d.getDate();
        const isSelected = key === activeKey;
        const isToday = key === today;
        const dayHasContent = contentKeys.has(key);
        const dayHasSchedule = scheduleKeys.has(key);

        return (
          // 강조는 항상 한 겹만 그린다.
          //   선택됨        -> 진한 채움 한 겹 (오늘이든 아니든 동일)
          //   오늘, 미선택  -> 채움 없이 아래쪽 점만
          //   선택 + 오늘   -> 진한 채움 + 점만 amber 로 (테두리를 덧그리지 않음)
          // 링은 focus-visible 에서만 그린다. focus 로 두면 클릭/탭한 뒤에도 링이 남아
          // 채움 위에 사각형이 하나 더 겹쳐 보인다.
          <button
            key={key}
            type="button"
            onClick={() => onSelectDate(key)}
            className={`flex flex-col items-center justify-center py-2 rounded-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 relative ${
              isSelected
                ? 'calendar-day-selected bg-slate-900 text-white font-bold shadow-xs'
                : 'hover:bg-slate-200/60 text-slate-700 font-medium'
            }`}
          >
            <span className="text-sm font-mono leading-none">{dayNum}</span>

            {/* Indicator dots container */}
            <div className={WEEK_DOT_ROW_CLASS}>
              {dayHasSchedule && (
                <span
                  title="일정 있음"
                  className={WEEK_SCHEDULE_DOT_CLASS}
                />
              )}
              {dayHasContent && (
                <span
                  title="내용 있음"
                  className={WEEK_TODO_DOT_CLASS}
                />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
});

export function WeekStrip({
  anchor,
  activeKey,
  days,
  schedule,
  onSelectDate,
  onPrevWeek,
  onNextWeek,
  onGoToday,
  onOpenMonthView,
}: WeekStripProps) {
  const today = todayKey();

  const containerRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [panelHeight, setPanelHeight] = useState<number>(0);

  // Fixed base week anchor initialized on mount
  const [baseWeekKey] = useState<string>(() => startOfWeek(anchor));
  // Week offset index relative to baseWeekKey
  const [weekOffsetIndex, setWeekOffsetIndex] = useState<number>(0);

  // Drag is transform-only: nothing below is React state, so no per-frame renders.
  const offsetIndexRef = useRef<number>(0);
  const stepRef = useRef<number>(0);
  const isFirstLayoutRef = useRef<boolean>(true);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startTime: number;
    pointerId: number;
    decided: boolean;
    active: boolean;
  } | null>(null);
  const suppressClickRef = useRef<boolean>(false);

  const currentWeekKey = getWeekOffsetKey(baseWeekKey, weekOffsetIndex);
  const monthTitle = weekMonthLabel(currentWeekKey);
  // 선택된 날짜가 오늘이 아니면 언제든 오늘로 돌아갈 수 있어야 한다.
  // (이번 주 안에서 다른 날짜를 고른 경우도 포함)
  const showTodayButton = activeKey !== today;

  const contentKeys = useMemo(() => {
    const set = new Set<string>();
    for (const [key, day] of Object.entries(days)) {
      if (!day) continue;
      const hasTodos = day.todos && day.todos.length > 0;
      const hasMemo = day.memo && day.memo.trim().length > 0;
      if (hasTodos || hasMemo) set.add(key);
    }
    return set;
  }, [days]);

  const scheduleKeys = useMemo(() => {
    const set = new Set<string>();
    for (const item of schedule) {
      set.add(normalizeScheduleDateKey(item.date));
    }
    return set;
  }, [schedule]);

  const handleSelectDateStable = useCallback(
    (key: string) => {
      onSelectDate(key);
    },
    [onSelectDate]
  );

  const applyTransform = useCallback((dx: number, animate: boolean) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.style.transition =
      animate && !prefersReducedMotion()
        ? 'transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1)'
        : 'none';
    rail.style.transform = `translateX(${-offsetIndexRef.current * stepRef.current + dx}px)`;
  }, []);

  // Measure container width on resize.
  // useLayoutEffect 로 첫 페인트 전에 재야 한다. useEffect 면 첫 프레임 동안
  // step 이 폴백값(300+gap)이라 인접 주 패널이 컨테이너 안으로 겹쳐 들어온다.
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    setContainerWidth(el.clientWidth);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect && entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Measure the active panel so the clipping container keeps its natural height
  const panelObserverRef = useRef<ResizeObserver | null>(null);
  const measurePanelRef = useCallback((el: HTMLDivElement | null) => {
    panelObserverRef.current?.disconnect();
    panelObserverRef.current = null;
    if (!el) return;
    setPanelHeight(el.offsetHeight);
    const observer = new ResizeObserver(() => setPanelHeight(el.offsetHeight));
    observer.observe(el);
    panelObserverRef.current = observer;
  }, []);
  useEffect(() => () => panelObserverRef.current?.disconnect(), []);

  // Sync weekOffsetIndex if anchor changes externally
  useEffect(() => {
    const diff = getWeekDifference(baseWeekKey, anchor);
    setWeekOffsetIndex((prev) => (prev === diff ? prev : diff));
  }, [anchor, baseWeekKey]);

  // Settle the rail whenever the week or the step size changes.
  useLayoutEffect(() => {
    const weekChanged = offsetIndexRef.current !== weekOffsetIndex;
    offsetIndexRef.current = weekOffsetIndex;
    stepRef.current = (containerWidth || containerRef.current?.clientWidth || 300) + PANEL_GAP;
    applyTransform(0, weekChanged && !isFirstLayoutRef.current);
    isFirstLayoutRef.current = false;
  }, [weekOffsetIndex, containerWidth, applyTransform]);

  const goPrev = useCallback(() => {
    setWeekOffsetIndex((prev) => prev - 1);
    onPrevWeek();
  }, [onPrevWeek]);

  const goNext = useCallback(() => {
    setWeekOffsetIndex((prev) => prev + 1);
    onNextWeek();
  }, [onNextWeek]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    suppressClickRef.current = false;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startTime: Date.now(),
      pointerId: e.pointerId,
      decided: false,
      active: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const state = dragRef.current;
    if (!state || state.pointerId !== e.pointerId) return;

    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;

    if (!state.decided) {
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // 세로가 앞서면 스와이프로 보지 않고 페이지 스크롤을 그대로 통과시킨다.
      if (absDy > VERTICAL_ABORT_PX && absDy >= absDx) {
        dragRef.current = null;
        return;
      }
      if (absDx <= DRAG_START_PX || absDx <= absDy * DRAG_AXIS_RATIO) return;

      state.decided = true;
      state.active = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // 포인터가 이미 놓였으면 캡처가 실패할 수 있다. 드래그는 그대로 진행.
      }
    }

    applyTransform(dx, false);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const state = dragRef.current;
    if (!state || state.pointerId !== e.pointerId) return;
    dragRef.current = null;
    if (!state.active) return;

    // 드래그였으면 뒤따르는 click(날짜 선택)을 삼킨다.
    suppressClickRef.current = true;

    const dx = e.clientX - state.startX;
    const dt = Date.now() - state.startTime;
    const width = containerWidth || containerRef.current?.clientWidth || 300;
    const speed = Math.abs(dx) / Math.max(dt, 1);

    const isFlick = speed > FLICK_SPEED && Math.abs(dx) > FLICK_MIN_PX;
    const isDistancePassed = Math.abs(dx) >= width * COMMIT_RATIO;

    if (isDistancePassed || isFlick) {
      if (dx < 0) {
        goNext();
      } else {
        goPrev();
      }
    } else {
      applyTransform(0, true);
    }
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    const state = dragRef.current;
    if (!state || state.pointerId !== e.pointerId) return;
    dragRef.current = null;
    if (!state.active) return;
    suppressClickRef.current = true;
    applyTransform(0, true);
  };

  const handleClickCapture = (e: React.MouseEvent) => {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  // Render range: 5 weeks centered around weekOffsetIndex
  const visibleOffsetIndices = useMemo(() => {
    const indices: number[] = [];
    for (let offset = weekOffsetIndex - 2; offset <= weekOffsetIndex + 2; offset++) {
      indices.push(offset);
    }
    return indices;
  }, [weekOffsetIndex]);

  const step = (containerWidth || 300) + PANEL_GAP;

  return (
    <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 space-y-2.5">
      {/* Header: Prev, Title + Today Button, Next */}
      <div className="flex items-center justify-between text-sm font-semibold text-slate-800">
        <button
          type="button"
          onClick={goPrev}
          aria-label="이전 주"
          className="p-1 rounded hover:bg-slate-200/70 text-slate-500 hover:text-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
        >
          ‹
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenMonthView}
            className="flex items-center gap-1 font-bold text-slate-900 hover:text-slate-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 rounded px-1.5 py-0.5"
          >
            <span>{monthTitle}</span>
            <span className="text-xs text-slate-400">›</span>
          </button>

          {showTodayButton && (
            <button
              type="button"
              onClick={onGoToday}
              className="text-xs px-2 py-0.5 rounded-full accent-soft accent-text hover:bg-slate-300 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              오늘
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={goNext}
          aria-label="다음 주"
          className="p-1 rounded hover:bg-slate-200/70 text-slate-500 hover:text-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
        >
          ›
        </button>
      </div>

      {/* Weekday name row (static) */}
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
      </div>

      {/* Week Grid with swipe gesture (scoped to this container only) */}
      <div
        ref={containerRef}
        className="overflow-hidden touch-pan-y relative select-none"
        style={{ height: panelHeight || PANEL_FALLBACK_HEIGHT }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClickCapture={handleClickCapture}
      >
        <div ref={railRef} className="relative w-full h-full" style={{ willChange: 'transform' }}>
          {visibleOffsetIndices.map((offsetIndex) => {
            const panelWeekKey = getWeekOffsetKey(baseWeekKey, offsetIndex);
            const isCurrentPanel = offsetIndex === weekOffsetIndex;
            return (
              <div
                key={panelWeekKey}
                ref={isCurrentPanel ? measurePanelRef : undefined}
                className="absolute top-0 left-0 w-full"
                style={{ transform: `translateX(${offsetIndex * step}px)` }}
                inert={!isCurrentPanel}
              >
                <WeekPanel
                  weekKey={panelWeekKey}
                  activeKey={isCurrentPanel ? activeKey : null}
                  today={today}
                  contentKeys={contentKeys}
                  scheduleKeys={scheduleKeys}
                  onSelectDate={handleSelectDateStable}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
