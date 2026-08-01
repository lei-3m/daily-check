export function ActionBar() {
  return (
    <div className="flex items-center gap-2 sm:gap-2.5 pt-2">
      <button
        type="button"
        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
      >
        <span>📋</span>
        <span>복사</span>
      </button>

      <button
        type="button"
        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 text-slate-800 font-semibold text-sm hover:bg-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
      >
        <span>📅</span>
        <span className="whitespace-nowrap">다른 날짜로</span>
      </button>

      <button
        type="button"
        disabled
        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 text-slate-400 font-semibold text-sm cursor-not-allowed opacity-60 select-none"
      >
        <span>✨</span>
        <span>우선순위</span>
      </button>
    </div>
  );
}
