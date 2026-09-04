import { useEffect, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Routine } from '../lib/types';
import { shortLabel, todayKey } from '../lib/date';
import {
  EVERYDAY_WEEKDAYS,
  WEEKDAY_NAMES,
  isEveryday,
  sortWeekdays,
  toggleWeekday,
} from '../lib/routine';

interface RoutineEditViewProps {
  item?: Routine;
  onBack: () => void;
  onSave: (
    id: string | null,
    text: string,
    weekdays: number[],
    startDate: string,
    endDate?: string
  ) => void;
  onDelete: (id: string) => void;
}

function openDatePicker(input: HTMLInputElement | null) {
  if (!input) return;
  if ('showPicker' in input && typeof input.showPicker === 'function') {
    input.showPicker();
  } else {
    input.click();
  }
}

/** 요일 버튼 색. 달력 요일 헤더와 같습니다. */
function weekdayToneClass(weekday: number, selected: boolean): string {
  if (selected) return '';
  if (weekday === 0) return 'text-red-500/80';
  if (weekday === 6) return 'text-blue-500/80';
  return 'text-slate-600';
}

export function RoutineEditView({ item, onBack, onSave, onDelete }: RoutineEditViewProps) {
  const [text, setText] = useState(item?.text || '');
  const [weekdays, setWeekdays] = useState<number[]>(item?.weekdays || EVERYDAY_WEEKDAYS);
  const [startDate, setStartDate] = useState(item?.startDate || todayKey());
  const [endDate, setEndDate] = useState(item?.endDate || '');
  const startInputRef = useRef<HTMLInputElement>(null);
  const endInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText(item?.text || '');
    setWeekdays(item?.weekdays || EVERYDAY_WEEKDAYS);
    setStartDate(item?.startDate || todayKey());
    setEndDate(item?.endDate || '');
  }, [item]);

  const everyday = isEveryday(weekdays);
  const canSave = text.trim().length > 0 && weekdays.length > 0;

  const handleSave = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      if (item) onDelete(item.id);
      onBack();
      return;
    }
    if (weekdays.length === 0) return;
    onSave(item?.id || null, trimmed, sortWeekdays(weekdays), startDate, endDate || undefined);
  };

  const handleDelete = () => {
    if (item) onDelete(item.id);
    onBack();
  };

  return (
    <section className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 space-y-4 max-w-full overflow-hidden">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="뒤로"
          className="min-h-11 min-w-11 flex items-center justify-center text-slate-500 [@media(hover:hover)]:hover:text-slate-800 [@media(hover:hover)]:hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 rounded-lg"
        >
          <ChevronLeft size={20} strokeWidth={2} aria-hidden="true" />
        </button>
        <h2 className="text-sm font-semibold text-slate-900">
          {item ? '루틴 편집' : '새 루틴'}
        </h2>
      </div>

      <div className="space-y-3">
        <label className="grid grid-cols-[3.5rem_1fr] items-center gap-2 text-sm">
          <span className="text-xs font-semibold text-slate-500">내용</span>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="예: 코딩테스트 1문 (09:00)"
            enterKeyHint="done"
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.preventDefault();
            }}
            className="min-h-11 text-sm border border-slate-200 rounded-lg px-3 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </label>

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-slate-500 pb-1">반복 요일</legend>

          <button
            type="button"
            onClick={() => setWeekdays(everyday ? [] : EVERYDAY_WEEKDAYS)}
            aria-pressed={everyday}
            className={`min-h-11 w-full rounded-lg border text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 ${
              everyday
                ? 'accent-fill accent-fill-hover-media text-white border-transparent'
                : 'bg-white border-slate-200 text-slate-700 surface-hover-media'
            }`}
          >
            매일
          </button>

          <div className="grid grid-cols-7 gap-1">
            {WEEKDAY_NAMES.map((name, weekday) => {
              const selected = weekdays.includes(weekday);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setWeekdays((prev) => toggleWeekday(prev, weekday))}
                  aria-pressed={selected}
                  aria-label={`${name}요일`}
                  className={`min-h-11 rounded-lg border text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 ${
                    selected
                      ? 'accent-fill accent-fill-hover-media text-white border-transparent'
                      : `bg-white border-slate-200 surface-hover-media ${weekdayToneClass(
                          weekday,
                          selected
                        )}`
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>

          {weekdays.length === 0 ? (
            <p className="text-xs text-slate-400">요일을 하나 이상 골라주세요.</p>
          ) : null}
        </fieldset>

        <div className="grid grid-cols-[3.5rem_1fr] items-center gap-2 text-sm">
          <span className="text-xs font-semibold text-slate-500">시작</span>
          <div className="relative">
            <button
              type="button"
              onClick={() => openDatePicker(startInputRef.current)}
              className="w-full min-h-11 text-left text-sm border border-slate-200 rounded-lg px-3 bg-white text-slate-900 surface-hover-media focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            >
              {shortLabel(startDate)}
            </button>
            <input
              ref={startInputRef}
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="sr-only absolute inset-0 opacity-0 pointer-events-none"
              tabIndex={-1}
            />
          </div>
        </div>

        <div className="grid grid-cols-[3.5rem_1fr] items-center gap-2 text-sm">
          <span className="text-xs font-semibold text-slate-500">종료</span>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <button
                type="button"
                onClick={() => openDatePicker(endInputRef.current)}
                className="w-full min-h-11 text-left text-sm border border-slate-200 rounded-lg px-3 bg-white text-slate-900 surface-hover-media focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              >
                {endDate ? shortLabel(endDate) : '무기한'}
              </button>
              <input
                ref={endInputRef}
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="sr-only absolute inset-0 opacity-0 pointer-events-none"
                tabIndex={-1}
              />
            </div>
            {endDate ? (
              <button
                type="button"
                onClick={() => setEndDate('')}
                className="min-h-11 px-3 shrink-0 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold surface-hover-media focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              >
                무기한으로
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="min-h-11 px-4 rounded-lg accent-fill accent-fill-hover-media text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          저장
        </button>
        {item ? (
          <button
            type="button"
            onClick={handleDelete}
            className="min-h-11 px-4 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold surface-hover-media focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          >
            삭제
          </button>
        ) : null}
      </div>
    </section>
  );
}
