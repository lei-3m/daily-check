import { useEffect, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { ScheduleItem } from '../lib/types';
import { shortLabel, todayKey } from '../lib/date';

type RepeatValue = ScheduleItem['repeat'] | '';

interface ScheduleEditViewProps {
  item?: ScheduleItem;
  activeKey: string;
  onBack: () => void;
  onSave: (
    id: string | null,
    date: string,
    text: string,
    repeat?: ScheduleItem['repeat'],
    repeatUntil?: string
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

export function ScheduleEditView({
  item,
  activeKey,
  onBack,
  onSave,
  onDelete,
}: ScheduleEditViewProps) {
  const [text, setText] = useState(item?.text || '');
  const [date, setDate] = useState(item?.date || activeKey || todayKey());
  const [repeat, setRepeat] = useState<RepeatValue>(item?.repeat || '');
  const [repeatUntil, setRepeatUntil] = useState(item?.repeatUntil || '');
  const dateInputRef = useRef<HTMLInputElement>(null);
  const untilInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText(item?.text || '');
    setDate(item?.date || activeKey || todayKey());
    setRepeat(item?.repeat || '');
    setRepeatUntil(item?.repeatUntil || '');
  }, [activeKey, item]);

  const handleSave = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      if (item) onDelete(item.id);
      onBack();
      return;
    }
    onSave(item?.id || null, date, trimmed, repeat || undefined, repeat ? repeatUntil || undefined : undefined);
    onBack();
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
          className="min-h-11 min-w-11 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 rounded-lg"
        >
          <ChevronLeft size={20} strokeWidth={2} aria-hidden="true" />
        </button>
        <h2 className="text-sm font-semibold text-slate-900">일정 편집</h2>
      </div>

      <div className="space-y-3">
        <label className="grid grid-cols-[3.5rem_1fr] items-center gap-2 text-sm">
          <span className="text-xs font-semibold text-slate-500">내용</span>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-11 text-sm border border-slate-200 rounded-lg px-3 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </label>

        <div className="grid grid-cols-[3.5rem_1fr] items-center gap-2 text-sm">
          <span className="text-xs font-semibold text-slate-500">날짜</span>
          <div className="relative">
            <button
              type="button"
              onClick={() => openDatePicker(dateInputRef.current)}
              className="w-full min-h-11 text-left text-sm border border-slate-200 rounded-lg px-3 bg-white text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            >
              {shortLabel(date)}
            </button>
            <input
              ref={dateInputRef}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="sr-only absolute inset-0 opacity-0 pointer-events-none"
              tabIndex={-1}
            />
          </div>
        </div>

        <fieldset className="grid grid-cols-[3.5rem_1fr] items-start gap-2 text-sm">
          <legend className="sr-only">반복</legend>
          <span className="pt-2 text-xs font-semibold text-slate-500">반복</span>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: '', label: '없음' },
              { value: 'weekly', label: '매주' },
              { value: 'monthly', label: '매월' },
            ].map((option) => (
              <label
                key={option.value}
                className="min-h-11 flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700"
              >
                <input
                  type="radio"
                  name="schedule-repeat"
                  value={option.value}
                  checked={repeat === option.value}
                  onChange={() => setRepeat(option.value as RepeatValue)}
                  className="accent-slate-900"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {repeat ? (
          <div className="grid grid-cols-[3.5rem_1fr] items-center gap-2 text-sm">
            <span className="text-xs font-semibold text-slate-500">종료</span>
            <div className="relative">
              <button
                type="button"
                onClick={() => openDatePicker(untilInputRef.current)}
                className="w-full min-h-11 text-left text-sm border border-slate-200 rounded-lg px-3 bg-white text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              >
                {repeatUntil ? shortLabel(repeatUntil) : '여기까지만'}
              </button>
              <input
                ref={untilInputRef}
                type="date"
                value={repeatUntil}
                min={date}
                onChange={(e) => setRepeatUntil(e.target.value)}
                className="sr-only absolute inset-0 opacity-0 pointer-events-none"
                tabIndex={-1}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={handleSave}
          className="min-h-11 px-4 rounded-lg accent-fill accent-fill-hover text-white text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          저장
        </button>
        {item ? (
          <button
            type="button"
            onClick={handleDelete}
            className="min-h-11 px-4 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          >
            삭제
          </button>
        ) : null}
      </div>
    </section>
  );
}
