import React from 'react';

interface SignOutWarningModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function SignOutWarningModal({ onConfirm, onCancel }: SignOutWarningModalProps) {
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-sm w-full p-5 space-y-4">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-slate-900">
            동기화되지 않은 변경이 있습니다
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            서버에 올리지 못한 변경이 남아 있습니다. 지금 로그아웃하면 사라집니다.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-11 px-4 text-xs font-semibold bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors shadow-2xs"
          >
            그래도 로그아웃
          </button>
        </div>
      </div>
    </div>
  );
}
