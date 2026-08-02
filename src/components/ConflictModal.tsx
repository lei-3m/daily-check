import React from 'react';
import type { ConflictDetails } from '../lib/storage';

interface ConflictModalProps {
  details?: ConflictDetails | null;
  onRefresh: () => void;
  onDismiss: () => void;
}

function getSummary(details?: ConflictDetails | null): string {
  const count = details?.items.length || 0;

  if (count === 0) {
    return '새로고침하면 이 기기에서 저장되지 않은 변경 내용이 사라질 수 있습니다.';
  }

  const allAdded = details?.items.every(
    (item) => item.type === 'todo_added' || item.type === 'schedule_added'
  );

  if (allAdded) {
    return `새로고침하면 이 기기에서 추가한 항목 ${count}개가 사라집니다.`;
  }

  return `새로고침하면 이 기기에서 바꾼 내용 ${count}개가 사라지거나 되돌아갑니다.`;
}

export function ConflictModal({ details, onRefresh, onDismiss }: ConflictModalProps) {
  const visibleItems = details?.items.slice(0, 5) || [];
  const hiddenCount = Math.max((details?.items.length || 0) - visibleItems.length, 0);

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-sm w-full p-5 space-y-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-amber-600 font-bold text-xs bg-amber-50 px-2 py-0.5 rounded-md mb-1">
            <span>⚠</span> 동기화 충돌
          </div>
          <h3 className="text-base font-bold text-slate-900">
            다른 기기에서 수정된 내용이 있어요.
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            {getSummary(details)}
          </p>
        </div>

        {visibleItems.length > 0 && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
            <ul className="space-y-1 text-xs text-slate-700">
              {visibleItems.map((item, index) => (
                <li key={`${item.type}-${item.label}-${index}`} className="flex gap-1.5">
                  <span className="text-slate-400">-</span>
                  <span className="min-w-0 break-words">{item.label}</span>
                </li>
              ))}
              {hiddenCount > 0 && (
                <li className="flex gap-1.5 text-slate-500">
                  <span className="text-slate-400">-</span>
                  <span>외 {hiddenCount}개</span>
                </li>
              )}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onDismiss}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          >
            나중에
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="px-3.5 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors shadow-2xs focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            새로고침
          </button>
        </div>
      </div>
    </div>
  );
}
