import React, { useRef } from 'react';
import { addDays, parseKey, shortLabel } from '../lib/date';

interface MoveBarProps {
  activeKey: string;
  selectedCount: number;
  totalCount: number;
  onToggleSelectAll: () => void;
  onMoveToDate: (targetKey: string) => void;
  onEmptySelection: () => void;
  onCancel: () => void;
}

export function MoveBar({
  activeKey,
  selectedCount,
  totalCount,
  onToggleSelectAll,
  onMoveToDate,
  onEmptySelection,
  onCancel,
}: MoveBarProps) {
  const dateInputRef = useRef<HTMLInputElement>(null);

  const tomorrowKey = addDays(activeKey, 1);
  const daysUntilSaturday = (6 - parseKey(activeKey).getDay() + 7) % 7 || 7;
  const saturdayKey = addDays(activeKey, daysUntilSaturday);
  const nextWeekKey = addDays(activeKey, 7);

  const handleCustomDateClick = () => {
    if (selectedCount === 0) {
      onEmptySelection();
      return;
    }
    if (dateInputRef.current) {
      dateInputRef.current.showPicker?.();
      dateInputRef.current.click();
    }
  };

  const handleMoveClick = (targetKey: string) => {
    if (selectedCount === 0) {
      onEmptySelection();
      return;
    }
    onMoveToDate(targetKey);
  };

  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val) {
      onMoveToDate(val);
    }
  };

  const isAllSelected = selectedCount > 0 && selectedCount === totalCount;
  const hasSelection = selectedCount > 0;
  const quickMoveButtonClass =
    'move-date-button flex items-center justify-center py-2 px-2 rounded-lg text-xs font-semibold transition-colors border focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400';
  const quickMoveLabelClass = 'whitespace-nowrap';

  return (
    <div className="bg-slate-900 text-white p-3 sm:p-4 rounded-xl shadow-lg border border-slate-800 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-150">
      <div className="flex items-center justify-between text-xs sm:text-sm font-medium border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleSelectAll}
            className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-500"
          >
            {isAllSelected ? '전체 해제' : '전체 선택'}
          </button>
          <span className="text-slate-300 font-semibold">
            {selectedCount}개 선택됨
          </span>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-500"
        >
          취소
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button
          type="button"
          aria-disabled={!hasSelection}
          onClick={() => handleMoveClick(tomorrowKey)}
          className={`${quickMoveButtonClass} ${hasSelection ? '' : 'opacity-70'}`}
        >
          <span className={quickMoveLabelClass}>내일 {shortLabel(tomorrowKey)}</span>
        </button>

        <button
          type="button"
          aria-disabled={!hasSelection}
          onClick={() => handleMoveClick(saturdayKey)}
          className={`${quickMoveButtonClass} ${hasSelection ? '' : 'opacity-70'}`}
        >
          <span className={quickMoveLabelClass}>토요일 {shortLabel(saturdayKey)}</span>
        </button>

        <button
          type="button"
          aria-disabled={!hasSelection}
          onClick={() => handleMoveClick(nextWeekKey)}
          className={`${quickMoveButtonClass} ${hasSelection ? '' : 'opacity-70'}`}
        >
          <span className={quickMoveLabelClass}>일주일 뒤 {shortLabel(nextWeekKey)}</span>
        </button>

        <div className="relative">
          <button
            type="button"
            aria-disabled={!hasSelection}
            onClick={handleCustomDateClick}
            className={`w-full h-full flex flex-col items-center justify-center py-2 px-2 rounded-lg accent-fill accent-fill-hover-media text-xs font-semibold text-white transition-colors shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
              hasSelection ? '' : 'opacity-70'
            }`}
          >
            <span>날짜 선택</span>
            <span className="text-[10px] accent-text-soft font-normal">
              달력에서 선택
            </span>
          </button>
          <input
            ref={dateInputRef}
            type="date"
            onChange={handleDateInputChange}
            className="sr-only absolute inset-0 opacity-0 pointer-events-none"
            tabIndex={-1}
          />
        </div>
      </div>
    </div>
  );
}
