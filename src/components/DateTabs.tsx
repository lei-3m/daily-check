interface DateTabItem {
  key: string;
  label: string;
  isToday: boolean;
  isActive: boolean;
}

interface DateTabsProps {
  tabs?: DateTabItem[];
  activeKey?: string;
}

const DEFAULT_TABS: DateTabItem[] = [
  { key: '2026-07-31', label: '7/31', isToday: false, isActive: false },
  { key: '2026-08-01', label: '8/1', isToday: true, isActive: true },
  { key: '2026-08-02', label: '8/2', isToday: false, isActive: false },
];

export function DateTabs({
  tabs = DEFAULT_TABS,
}: DateTabsProps) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-slate-100">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 ${
            tab.isActive
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <span>{tab.label}</span>
          {tab.isToday && (
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full ${
                tab.isActive ? 'bg-amber-400' : 'bg-slate-500'
              }`}
            />
          )}
        </button>
      ))}

      <button
        type="button"
        aria-label="날짜 추가"
        className="flex items-center justify-center px-2.5 py-1.5 rounded-lg text-sm font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 whitespace-nowrap"
      >
        ＋
      </button>
    </div>
  );
}
