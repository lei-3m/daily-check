import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Todo } from '../lib/types';

interface YesterdayCarryoverProps {
  todos: Todo[];
  onImport: (ids: string[]) => void;
  onDismiss: () => void;
}

export function YesterdayCarryover({
  todos,
  onImport,
  onDismiss,
}: YesterdayCarryoverProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const allSelected = todos.length > 0 && selectedIds.size === todos.length;
  const todoIdsKey = todos.map((todo) => todo.id).join('|');

  useEffect(() => {
    setIsExpanded(false);
    setSelectedIds(new Set());
  }, [todoIdsKey]);

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(todos.map((todo) => todo.id)));
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleImport = () => {
    if (selectedIds.size === 0) return;
    onImport([...selectedIds]);
  };

  return (
    <section className="rounded-lg border border-slate-100 bg-slate-50/50 overflow-hidden">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
          className="min-h-11 flex-1 flex items-center justify-between gap-2 px-2.5 py-2 text-left text-xs font-semibold text-slate-600 [@media(hover:hover)]:hover:bg-slate-100 [@media(hover:hover)]:hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
        >
          <span>어제 못 한 일 {todos.length}개 가져오기</span>
          {isExpanded ? (
            <ChevronUp size={20} strokeWidth={2} aria-hidden="true" />
          ) : (
            <ChevronDown size={20} strokeWidth={2} aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="어제 못 한 일 가져오기 닫기"
          className="min-h-11 min-w-11 flex items-center justify-center text-slate-400 [@media(hover:hover)]:hover:bg-slate-100 [@media(hover:hover)]:hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
        >
          ×
        </button>
      </div>

      {isExpanded && (
        <div className="border-t border-slate-100 px-2.5 py-2 space-y-2">
          <label className="min-h-11 flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer rounded-lg px-1 [@media(hover:hover)]:hover:bg-slate-100">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              className="accent-control h-4 w-4"
            />
            <span>전체 선택</span>
          </label>

          <ul className="space-y-1">
            {todos.map((todo) => (
              <li key={todo.id}>
                <label className="min-h-11 flex items-center gap-2 text-sm text-slate-700 cursor-pointer rounded-lg px-1 [@media(hover:hover)]:hover:bg-slate-100">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(todo.id)}
                    onChange={() => toggleSelected(todo.id)}
                    className="accent-control h-4 w-4"
                  />
                  <span className="min-w-0 truncate">{todo.text}</span>
                </label>
              </li>
            ))}
          </ul>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleImport}
              disabled={selectedIds.size === 0}
              className="min-h-11 px-4 rounded-lg accent-fill accent-fill-hover text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            >
              가져오기
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
