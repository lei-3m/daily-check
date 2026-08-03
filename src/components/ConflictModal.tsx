import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { ConflictDetailItem, ConflictDetails } from '../lib/storage';

interface ConflictModalProps {
  details?: ConflictDetails | null;
  onRefresh: () => void;
  onDismiss: () => void;
}

function shortDate(date: string): string {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return date;
  return `${Number(match[2])}/${Number(match[3])}`;
}

function conflictText(item: ConflictDetailItem): string {
  if (item.type.startsWith('drawer_')) return item.label;
  return item.text || item.label;
}

function changePrefix(item: ConflictDetailItem): string {
  if (
    item.type === 'todo_added' ||
    item.type === 'schedule_added' ||
    item.type === 'drawer_added'
  ) {
    return '+';
  }
  if (
    item.type === 'todo_deleted' ||
    item.type === 'schedule_deleted' ||
    item.type === 'drawer_deleted'
  ) {
    return '-';
  }
  return '';
}

function changeLabel(item: ConflictDetailItem): string {
  if (item.type === 'memo_changed') return `메모 변경 ${shortDate(item.date)}`;
  if (item.type === 'accent_changed') return '강조 색상 변경';
  return conflictText(item) || '내용 변경';
}

function ConflictColumn({
  items,
  emptyText,
}: {
  items: ConflictDetailItem[];
  emptyText: string;
}) {
  if (items.length === 0) {
    return <div className="text-xs text-slate-400 py-1">{emptyText}</div>;
  }

  return (
    <div className="space-y-1.5">
      {items.map((item, index) => {
        const prefix = changePrefix(item);
        return (
          <div
            key={`${item.type}-${item.date}-${item.text || item.label}-${index}`}
            className="grid grid-cols-[12px_1fr] gap-1.5 min-w-0 text-xs"
          >
            <span
              className={`font-mono font-semibold ${
                prefix === '+'
                  ? 'text-emerald-700'
                  : prefix === '-'
                  ? 'text-rose-600'
                  : 'text-slate-400'
              }`}
            >
              {prefix}
            </span>
            <span className="min-w-0 break-words text-slate-800">
              {changeLabel(item)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function ConflictModal({ details, onRefresh, onDismiss }: ConflictModalProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const localItems = details?.items || [];
  const otherItems = details?.otherItems || [];
  const visibleLimit = isExpanded ? Number.POSITIVE_INFINITY : 5;
  const visibleLocalItems = localItems.slice(0, visibleLimit);
  const visibleOtherItems = otherItems.slice(0, visibleLimit);
  const hiddenCount =
    Math.max(localItems.length - visibleLocalItems.length, 0) +
    Math.max(otherItems.length - visibleOtherItems.length, 0);

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-sm w-full p-5 space-y-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-amber-600 font-bold text-xs bg-amber-50 px-2 py-0.5 rounded-md mb-1">
            <span>!</span> 동기화 충돌
          </div>
          <h3 className="text-base font-bold text-slate-900">
            다른 기기에서 수정된 내용이 있어요
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            새로고침하면 이 기기에서 한 변경이 사라집니다
          </p>
        </div>

        {(localItems.length > 0 || otherItems.length > 0) && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="min-w-0 space-y-1.5">
                <div className="text-[11px] font-bold text-slate-500">
                  이 기기에서 한 변경
                </div>
                <ConflictColumn
                  items={visibleLocalItems}
                  emptyText="변경 없음"
                />
              </div>
              <div className="min-w-0 space-y-1.5">
                <div className="text-[11px] font-bold text-slate-500">
                  다른 기기에서 한 변경
                </div>
                <ConflictColumn
                  items={visibleOtherItems}
                  emptyText="변경 없음"
                />
              </div>
            </div>

            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setIsExpanded(true)}
                className="min-h-11 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 rounded-lg px-2"
              >
                <span>외 {hiddenCount}개</span>
                <ChevronDown size={20} strokeWidth={2} aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            type="button"
            onClick={onDismiss}
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          >
            <span className="block">그대로 두기</span>
            <span className="block mt-0.5 text-[10px] font-medium text-slate-500">
              이 기기 변경 유지
            </span>
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="px-3 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors shadow-2xs focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <span className="block">다른 기기 내용 가져오기</span>
            <span className="block mt-0.5 text-[10px] font-medium text-slate-300">
              이 기기 변경 버림
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
