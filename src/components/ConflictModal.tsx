import React, { useState } from 'react';
import type { ConflictDetailItem, ConflictDetails } from '../lib/storage';

interface ConflictModalProps {
  details?: ConflictDetails | null;
  onRefresh: () => void;
  onDismiss: () => void;
}

type ConflictGroup = {
  key: string;
  title: string;
  items: ConflictDetailItem[];
};

function shortDate(date: string): string {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return date;
  return `${Number(match[2])}/${Number(match[3])}`;
}

function conflictText(item: ConflictDetailItem): string {
  if (item.type.startsWith('drawer_')) return item.label;
  return item.text || item.label;
}

function groupItems(items: ConflictDetailItem[]): ConflictGroup[] {
  const groups: ConflictGroup[] = [
    {
      key: 'added',
      title: '추가한 항목',
      items: items.filter(
        (item) =>
          item.type === 'todo_added' ||
          item.type === 'schedule_added' ||
          item.type === 'drawer_added'
      ),
    },
    {
      key: 'deleted',
      title: '삭제한 항목',
      items: items.filter(
        (item) =>
          item.type === 'todo_deleted' ||
          item.type === 'schedule_deleted' ||
          item.type === 'drawer_deleted'
      ),
    },
    {
      key: 'updated',
      title: '수정한 항목',
      items: items.filter(
        (item) =>
          item.type === 'todo_updated' ||
          item.type === 'schedule_updated' ||
          item.type === 'drawer_updated'
      ),
    },
    {
      key: 'memo',
      title: '메모 변경',
      items: items.filter((item) => item.type === 'memo_changed'),
    },
    {
      key: 'accent',
      title: '강조 색상',
      items: items.filter((item) => item.type === 'accent_changed'),
    },
  ];

  return groups.filter((group) => group.items.length > 0);
}

export function ConflictModal({ details, onRefresh, onDismiss }: ConflictModalProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const allItems = details?.items || [];
  const visibleItems = isExpanded ? allItems : allItems.slice(0, 5);
  const hiddenCount = Math.max(allItems.length - visibleItems.length, 0);
  const groups = groupItems(visibleItems);

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

        {allItems.length > 0 && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 space-y-2">
            <div className="space-y-1.5 text-xs text-slate-700">
              {groups.map((group) => (
                <div key={group.key} className="grid grid-cols-[72px_1fr] gap-x-2 gap-y-1">
                  <div className="font-semibold text-slate-500">{group.title}</div>
                  <div className="space-y-1">
                    {group.items.map((item, index) => (
                      <div
                        key={`${group.key}-${item.date}-${item.text || ''}-${index}`}
                        className="grid grid-cols-[34px_1fr] gap-2 min-w-0"
                      >
                        <span className="font-mono text-slate-500">{shortDate(item.date)}</span>
                        {conflictText(item) ? (
                          <span className="min-w-0 break-words text-slate-800">
                            {conflictText(item)}
                          </span>
                        ) : (
                          <span className="min-w-0 text-slate-500">내용 변경</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setIsExpanded(true)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 rounded px-1 py-0.5"
              >
                외 {hiddenCount}개 ▾
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
