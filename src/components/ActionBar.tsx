interface ActionBarProps {
  onCopy?: () => void;
  onStartMoveMode?: () => void;
  onPrioritize?: () => void;
  isPrioritizing?: boolean;
}

export function ActionBar({
  onCopy,
  onStartMoveMode,
  onPrioritize,
  isPrioritizing = false,
}: ActionBarProps) {
  return (
    <div className="flex w-full max-w-full items-center gap-1.5 sm:gap-2 pt-2">
      {/* 자주 쓰는 순서대로 왼쪽에 둔다. 복사는 거의 쓰지 않아 끝으로 보냈다. */}
      <button
        type="button"
        onClick={onPrioritize}
        disabled={isPrioritizing}
        className="min-h-11 min-w-0 flex-1 flex items-center justify-center gap-0.5 sm:gap-1 px-1.5 sm:px-2.5 py-2 rounded-xl accent-fill accent-fill-hover-media text-white font-semibold text-xs sm:text-base whitespace-nowrap transition-colors shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70 select-none"
        aria-busy={isPrioritizing}
      >
        <span>✨</span>
        <span>AI 순서 제안</span>
      </button>

      <button
        type="button"
        onClick={onStartMoveMode}
        className="min-h-11 min-w-0 flex-1 flex items-center justify-center gap-0.5 sm:gap-1 px-1.5 sm:px-2.5 py-2 rounded-xl bg-slate-100 surface-hover-media text-slate-800 font-semibold text-xs sm:text-base whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
      >
        <span>📅</span>
        <span className="whitespace-nowrap">선택해 옮기기</span>
      </button>

      <button
        type="button"
        onClick={onCopy}
        className="min-h-11 min-w-0 flex-1 flex items-center justify-center gap-0.5 sm:gap-1 px-1.5 sm:px-2.5 py-2 rounded-xl bg-slate-100 surface-hover-media text-slate-800 font-semibold text-xs sm:text-base whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
      >
        <span>📋</span>
        <span>남은 일 복사</span>
      </button>
    </div>
  );
}
