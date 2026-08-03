import type { PrioritySuggestion } from '../lib/priority';

interface PrioritySuggestionModalProps {
  suggestion: PrioritySuggestion | null;
  isLoading?: boolean;
  onApply: () => void;
  onCancel: () => void;
}

export function PrioritySuggestionModal({
  suggestion,
  isLoading = false,
  onApply,
  onCancel,
}: PrioritySuggestionModalProps) {
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-sm w-full p-5 space-y-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-7 text-center">
            <div className="priority-stars" aria-hidden="true">
              <span className="priority-star priority-star-main">✦</span>
              <span className="priority-star priority-star-small priority-star-a">✦</span>
              <span className="priority-star priority-star-small priority-star-b">✧</span>
              <span className="priority-star priority-star-small priority-star-c">✦</span>
              <span className="priority-star priority-star-small priority-star-d">✧</span>
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                우선순위를 정리하는 중…
              </h3>
              <p className="text-xs text-slate-500">
                잠시만 기다려 주세요.
              </p>
            </div>
          </div>
        ) : suggestion ? (
          <>
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 accent-text font-bold text-xs accent-soft px-2 py-0.5 rounded-md mb-1">
            <span>✨</span> 우선순위 제안
          </div>
          <h3 className="text-base font-bold text-slate-900">
            이 순서로 정리할까요?
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            적용을 누르기 전까지 할 일 순서는 바뀌지 않습니다.
          </p>
        </div>

        <ol className="max-h-[52vh] overflow-y-auto rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 space-y-3">
          {suggestion.items.map((item, index) => (
            <li key={item.id} className="grid grid-cols-[24px_1fr] gap-2">
              <span className="text-sm font-bold text-slate-500">{index + 1}.</span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 break-words">
                  {item.text}
                </div>
                <div className="text-xs text-slate-500 leading-relaxed break-words mt-0.5">
                  {item.reason}
                </div>
              </div>
            </li>
          ))}
        </ol>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={onApply}
            className="px-3 py-2.5 text-xs font-semibold accent-fill accent-fill-hover text-white rounded-lg transition-colors shadow-2xs focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            적용
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          >
            취소
          </button>
        </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
