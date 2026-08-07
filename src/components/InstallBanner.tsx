import React from 'react';
import { InstallBannerMode } from '../lib/installPrompt';

interface InstallBannerProps {
  mode: InstallBannerMode;
  onInstall: () => void;
  onDismiss: () => void;
}

// 저절로 사라지지 않는다. ✕로 닫아야 사라지고, 닫으면 다시 뜨지 않는다.
// 조용한 톤을 지키려고 본문과 같은 흰 배경에 얇은 테두리만 쓴다.
// 새 버전 토스트(검은 알약)보다 눈에 덜 띄어야 한다.
export function InstallBanner({ mode, onInstall, onDismiss }: InstallBannerProps) {
  if (mode === 'none') return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100vw-2rem)] max-w-[420px]"
    >
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-sm pl-3.5 pr-1.5 py-1.5 flex items-center gap-2">
        <p className="min-w-0 flex-1 text-xs text-slate-600 leading-relaxed">
          {mode === 'prompt'
            ? '홈 화면에 추가하면 앱처럼 쓸 수 있어요'
            : "공유 버튼을 누르고 '홈 화면에 추가'를 선택하세요"}
        </p>

        {mode === 'prompt' && (
          <button
            type="button"
            onClick={onInstall}
            className="shrink-0 min-h-11 px-3 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          >
            추가
          </button>
        )}

        <button
          type="button"
          onClick={onDismiss}
          aria-label="안내 닫기"
          className="shrink-0 w-11 h-11 flex items-center justify-center text-slate-400 [@media(hover:hover)]:hover:text-slate-600 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
