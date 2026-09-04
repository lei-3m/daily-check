import { ChevronRight, Plus } from 'lucide-react';
import { Routine } from '../lib/types';
import { shortLabel } from '../lib/date';
import { weekdaysLabel } from '../lib/routine';

interface RoutineBlockProps {
  routines: Routine[];
  onOpenRoutineEdit: (id: string | null) => void;
}

function periodLabel(routine: Routine): string {
  const start = shortLabel(routine.startDate);
  return routine.endDate ? `${start} ~ ${shortLabel(routine.endDate)}` : `${start} ~ 무기한`;
}

export function RoutineBlock({ routines, onOpenRoutineEdit }: RoutineBlockProps) {
  return (
    <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 space-y-3 max-w-full overflow-hidden">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          <span>🔁</span>
          <span>루틴</span>
          {routines.length > 0 ? (
            <span className="font-mono text-xs font-semibold text-slate-500">
              {routines.length}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => onOpenRoutineEdit(null)}
          className="min-h-11 px-3 flex items-center gap-1 rounded-lg accent-fill accent-fill-hover-media text-white text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
          <span>루틴 추가</span>
        </button>
      </div>

      {routines.length === 0 ? (
        <p className="text-xs text-slate-400 py-1">
          매일 또는 특정 요일마다 하는 일을 루틴으로 등록해두세요.
        </p>
      ) : (
        <ul className="space-y-1 text-xs">
          {routines.map((routine) => (
            <li key={routine.id}>
              <button
                type="button"
                onClick={() => onOpenRoutineEdit(routine.id)}
                className="w-full min-h-11 flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-100 text-left surface-hover-media focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              >
                <span className="min-w-0 flex-1 space-y-0.5">
                  <span className="block font-medium text-slate-800 break-words">
                    {routine.text}
                  </span>
                  <span className="block text-[11px] text-slate-500">
                    {weekdaysLabel(routine.weekdays)} · {periodLabel(routine)}
                  </span>
                </span>
                <ChevronRight
                  size={18}
                  strokeWidth={2}
                  aria-hidden="true"
                  className="shrink-0 text-slate-400"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
