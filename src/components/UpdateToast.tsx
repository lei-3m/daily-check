import React from 'react';

interface UpdateToastProps {
  isVisible: boolean;
  onReload: () => void;
}

// 저절로 사라지지 않는다. 새로고침 전까지는 옛 화면이라는 사실이 계속 보여야 한다.
export function UpdateToast({ isVisible, onReload }: UpdateToastProps) {
  if (!isVisible) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100vw-2rem)]"
    >
      <div className="bg-slate-900 text-white text-xs sm:text-sm font-medium pl-4 pr-1.5 py-1.5 rounded-full shadow-lg border border-slate-800 flex items-center gap-2">
        <span className="truncate">새 버전이 있습니다</span>
        <button
          type="button"
          onClick={onReload}
          className="min-h-11 px-3 rounded-full bg-white/15 hover:bg-white/25 font-semibold whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          새로고침
        </button>
      </div>
    </div>
  );
}
