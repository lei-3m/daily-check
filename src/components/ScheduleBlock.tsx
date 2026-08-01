import { ScheduleItem } from '../lib/types';

interface ScheduleBlockProps {
  schedule?: ScheduleItem[];
}

const DEFAULT_SCHEDULE: ScheduleItem[] = [
  { id: '1', date: '8/2', text: '미용실' },
  { id: '2', date: '8/5', text: '회식' },
];

export function ScheduleBlock({ schedule = DEFAULT_SCHEDULE }: ScheduleBlockProps) {
  return (
    <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          <span>📌</span>
          <span>일정</span>
        </div>
        <button
          type="button"
          aria-label="일정 접기"
          className="text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300 rounded p-0.5 text-sm leading-none"
        >
          −
        </button>
      </div>
      <ul className="space-y-1.5 pl-6 text-sm text-slate-700">
        {schedule.map((item) => (
          <li key={item.id} className="flex items-center gap-3">
            <span className="font-mono text-xs font-semibold text-slate-500 w-8">
              {item.date}
            </span>
            <span className="font-medium text-slate-800">{item.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
