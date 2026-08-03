import React from 'react';

interface MemoBlockProps {
  memo?: string;
  onChangeMemo: (memo: string) => void;
}

export function MemoBlock({ memo = '', onChangeMemo }: MemoBlockProps) {
  return (
    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
      <div className="flex items-center justify-between text-sm font-semibold text-slate-800">
        <div className="flex items-center gap-1.5">
          <span>📝</span>
          <span>메모</span>
        </div>
      </div>
      <textarea
        value={memo}
        onChange={(e) => onChangeMemo(e.target.value)}
        placeholder="이 날에 참고할 내용을 적어두세요."
        rows={3}
        className="w-full text-sm text-slate-700 placeholder-slate-400 bg-white border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-slate-300 leading-relaxed resize-y min-h-[70px]"
      />
    </div>
  );
}
