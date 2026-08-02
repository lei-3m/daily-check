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
    <div className="flex items-center gap-2 sm:gap-2.5 pt-2">
      <button
        type="button"
        onClick={onCopy}
        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl accent-fill accent-fill-hover text-white font-semibold text-sm transition-colors shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
      >
        <span>📋</span>
        <span>복사</span>
      </button>

      <button
        type="button"
        onClick={onStartMoveMode}
        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 text-slate-800 font-semibold text-sm hover:bg-slate-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
      >
        <span>📅</span>
        <span className="whitespace-nowrap">다른 날짜로</span>
      </button>

      <button
        type="button"
        onClick={onPrioritize}
        disabled={isPrioritizing}
        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 text-slate-800 font-semibold text-sm hover:bg-slate-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:text-slate-400 disabled:cursor-wait disabled:opacity-70 select-none"
        aria-busy={isPrioritizing}
      >
        <span>✨</span>
        <span>우선순위</span>
      </button>
    </div>
  );
}
