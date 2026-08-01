import React from 'react';

interface MigrationModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function MigrationModal({ onConfirm, onCancel }: MigrationModalProps) {
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-sm w-full p-5 space-y-4">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-slate-900">
            기록 이관 요청
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            이 기기의 기록을 계정으로 옮길까요?
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            아니오
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-3.5 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors shadow-2xs"
          >
            예 (이관하기)
          </button>
        </div>
      </div>
    </div>
  );
}
