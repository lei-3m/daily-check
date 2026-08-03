import React, { useRef } from 'react';
import { addDays, shortLabel } from '../lib/date';

interface MoveBarProps {
  activeKey: string;
  selectedCount: number;
  totalCount: number;
  onToggleSelectAll: () => void;
  onMoveToDate: (targetKey: string) => void;
  onCancel: () => void;
}

export function MoveBar({
  activeKey,
  selectedCount,
  totalCount,
  onToggleSelectAll,
  onMoveToDate,
  onCancel,
}: MoveBarProps) {
  const dateInputRef = useRef<HTMLInputElement>(null);

  const tomorrowKey = addDays(activeKey, 1);
  const dayAfterTomorrowKey = addDays(activeKey, 2);
  const nextWeekKey = addDays(activeKey, 7);

  const handleCustomDateClick = () => {
    if (dateInputRef.current) {
      dateInputRef.current.showPicker?.();
      dateInputRef.current.click();
    }
  };

  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value; // YYYY-MM-DD
    if (val) {
      onMoveToDate(val);
    }
  };

  const isAllSelected = selectedCount > 0 && selectedCount === totalCount;
  const quickMoveButtonClass =
    'move-date-button flex flex-col items-center justify-center py-2 px-2 rounded-lg disabled:cursor-not-allowed text-xs font-semibold transition-colors border focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400';
  const quickMoveDateClass = 'move-date-button-date text-[10px] font-mono font-normal';

  return (
    <div className="bg-slate-900 text-white p-3 sm:p-4 rounded-xl shadow-lg border border-slate-800 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-150">
      {/* Header Info & Select All / Cancel */}
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
          취소 ✕
        </button>
      </div>

      {/* Quick Move Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button
          type="button"
          disabled={selectedCount === 0}
          onClick={() => onMoveToDate(tomorrowKey)}
          className={quickMoveButtonClass}
        >
          <span>내일</span>
          <span className={quickMoveDateClass}>
            ({shortLabel(tomorrowKey)})
          </span>
        </button>

        <button
          type="button"
          disabled={selectedCount === 0}
          onClick={() => onMoveToDate(dayAfterTomorrowKey)}
          className={quickMoveButtonClass}
        >
          <span>모레</span>
          <span className={quickMoveDateClass}>
            ({shortLabel(dayAfterTomorrowKey)})
          </span>
        </button>

        <button
          type="button"
          disabled={selectedCount === 0}
          onClick={() => onMoveToDate(nextWeekKey)}
          className={quickMoveButtonClass}
        >
          <span>일주일 뒤</span>
          <span className={quickMoveDateClass}>
            ({shortLabel(nextWeekKey)})
          </span>
        </button>

        {/* Custom Date Picker Button */}
        <div className="relative">
          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={handleCustomDateClick}
            className="w-full h-full flex flex-col items-center justify-center py-2 px-2 rounded-lg accent-fill accent-fill-hover disabled:opacity-70 disabled:cursor-not-allowed text-xs font-semibold text-white transition-colors shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <span>📅 날짜 선택</span>
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
