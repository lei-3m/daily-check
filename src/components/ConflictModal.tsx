import React from 'react';

interface ConflictModalProps {
  onRefresh: () => void;
  onDismiss: () => void;
}

export function ConflictModal({ onRefresh, onDismiss }: ConflictModalProps) {
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-sm w-full p-5 space-y-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-amber-600 font-bold text-xs bg-amber-50 px-2 py-0.5 rounded-md mb-1">
            <span>⚠️</span> 동기화 변경사항 발견
          </div>
          <h3 className="text-base font-bold text-slate-900">
            데이터 변경 감지
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            다른 기기에서 수정된 내용이 있어요. 새로고침할까요?
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onDismiss}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            나중에
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="px-3.5 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors shadow-2xs"
          >
            새로고침
          </button>
        </div>
      </div>
    </div>
  );
}
