interface MemoBlockProps {
  memo?: string;
}

export function MemoBlock({ memo = '오늘은 발표라 긴장됨.' }: MemoBlockProps) {
  return (
    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
        <span>📝</span>
        <span>메모</span>
      </div>
      <div className="text-sm text-slate-700 font-normal leading-relaxed whitespace-pre-wrap pl-0.5">
        {memo}
      </div>
    </div>
  );
}
