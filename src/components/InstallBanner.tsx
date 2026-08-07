import React from 'react';
import { ArrowDownToLine } from 'lucide-react';
import { InstallBannerMode } from '../lib/installPrompt';

interface InstallBannerProps {
  mode: InstallBannerMode;
  onInstall: () => void;
  onDismiss: () => void;
}

// 저절로 사라지지 않는다. ✕로 닫아야 사라진다.
// 재질은 다가오는 일정·서랍과 같은 카드다. 화면에 떠 있으므로 그림자만 더한다.
export function InstallBanner({ mode, onInstall, onDismiss }: InstallBannerProps) {
  if (mode === 'none') return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100vw-2rem)] max-w-[420px]"
    >
      <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl shadow-lg p-2.5 flex items-center gap-2.5">
        {/* 안내를 거드는 표시일 뿐이다. 본문보다 한 단계 연하게 두어
            채색된 [추가] 버튼이 배너에서 가장 눈에 띄게 한다. */}
        {/* mr-0.5는 컨테이너 gap-2.5(10px)에 2px을 더해 문구까지 12px을 만든다.
            컨테이너 gap을 키우면 [추가]·✕ 사이까지 벌어져 380px에서 폭이 모자란다. */}
        <ArrowDownToLine
          size={24}
          strokeWidth={2}
          aria-hidden="true"
          className="shrink-0 mr-0.5 text-slate-400"
        />

        <p className="min-w-0 flex-1 text-xs font-medium text-slate-600 leading-relaxed">
          {mode === 'prompt' ? (
            <>
              홈 화면에 추가하면
              <br />
              앱처럼 쓸 수 있어요
            </>
          ) : (
            <>
              공유 버튼을 누르고
              <br />
              '홈 화면에 추가'를 선택하세요
            </>
          )}
        </p>

        {mode === 'prompt' && (
          <button
            type="button"
            onClick={onInstall}
            className="shrink-0 min-h-11 px-4 text-xs font-semibold rounded-lg accent-fill accent-fill-hover text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            추가
          </button>
        )}

        {/* 주된 동작은 [추가]다. 닫기는 눌러야 보이는 정도로만 남긴다. */}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="안내 닫기"
          className="shrink-0 w-11 h-11 -mr-1.5 flex items-center justify-center text-slate-300 [@media(hover:hover)]:hover:text-slate-500 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
