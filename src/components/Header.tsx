interface HeaderProps {
  dateLabel: string;
  completedCount: number;
  totalCount: number;
}

export function Header({
  dateLabel = "8월 1일 금요일",
  completedCount = 2,
  totalCount = 4,
}: Partial<HeaderProps>) {
  return (
    <header className="border-b border-slate-100 pb-4">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          오늘의 작업 공간
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full font-mono">
            {completedCount}/{totalCount}
          </span>
          <div
            title="계정 영역 (9단계 구현 예정)"
            className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 text-xs font-semibold select-none cursor-default"
          >
            ◐
          </div>
        </div>
      </div>
      <p className="text-sm font-medium text-slate-500">{dateLabel}</p>
    </header>
  );
}
