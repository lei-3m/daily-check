import React, {
  ClipboardEvent,
  KeyboardEvent,
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Plus } from 'lucide-react';
import { cleanTodoPrefix } from '../lib/todoText';

export interface TodoAddFormHandle {
  focus: () => void;
}

interface TodoAddFormProps {
  /** 맥락에 맞게 바꾸되 형식은 같게. 예: "할 일 적기", "항목 적기". */
  placeholder: string;
  /** ＋ 버튼의 접근성 이름. 예: "할 일 추가", "항목 추가". */
  addLabel: string;
  /** 한 줄이면 1개, 여러 줄을 붙여넣으면 여러 개가 한 번에 들어옵니다. */
  onAddMany: (texts: string[]) => void;
  /** 추가 직전에 불립니다. 새 항목으로 스크롤할지 표시할 때 씁니다. */
  onBeforeAdd?: () => void;
  /** 바깥 여백만 조정합니다. 입력창 자체의 생김새는 바꾸지 않습니다. */
  className?: string;
}

/**
 * 할 일과 서랍 항목을 추가하는 입력창. 두 곳이 같은 모양이어야 하므로
 * 한 컴포넌트를 함께 씁니다. 나뉘어 있으면 다음에 또 어긋납니다.
 */
export const TodoAddForm = forwardRef<TodoAddFormHandle, TodoAddFormProps>(
  function TodoAddForm(
    { placeholder, addLabel, onAddMany, onBeforeAdd, className = 'pt-2' },
    ref
  ) {
    const [inputValue, setInputValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const inputValueRef = useRef('');
    inputValueRef.current = inputValue;

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus({ preventScroll: true }),
    }));

    const addSingle = () => {
      const cleaned = cleanTodoPrefix(inputValueRef.current || inputValue);
      if (cleaned) {
        onBeforeAdd?.();
        onAddMany([cleaned]);
        setInputValue('');
        inputValueRef.current = '';
      }
      inputRef.current?.focus({ preventScroll: true });
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addSingle();
      }
    };

    const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
      const pastedText = e.clipboardData.getData('text');
      if (!pastedText.includes('\n') && !pastedText.includes('\r')) return;

      e.preventDefault();
      const lines = pastedText
        .split(/\r?\n/)
        .map((line) => cleanTodoPrefix(line))
        .filter((line) => line.length > 0);

      if (lines.length > 0) {
        onBeforeAdd?.();
        onAddMany(lines);
        setInputValue('');
        inputValueRef.current = '';
        inputRef.current?.focus({ preventScroll: true });
      }
    };

    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addSingle();
        }}
        className={className}
        data-todo-swipe-ignore="true"
      >
        {/* 항목 행과 헷갈리지 않게 테두리와 옅은 배경으로 구분합니다.
            입력창임을 알리는 정도면 충분하므로 주목을 끌지는 않습니다. */}
        <div className="flex items-center gap-2 px-2 py-1 rounded-xl text-sm border-2 border-slate-200 bg-slate-50 focus-within:accent-border focus-within:bg-white focus-within:ring-2 focus-within:ring-slate-300 transition-all">
          <button
            type="button"
            // 버튼을 눌러도 입력창이 blur되지 않아야 값이 살아 있습니다.
            onPointerDown={(e) => e.preventDefault()}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.preventDefault();
              addSingle();
            }}
            aria-label={addLabel}
            className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center accent-text hover:bg-slate-200/70 rounded-md transition-colors cursor-pointer shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 select-none"
          >
            <Plus className="w-6 h-6" strokeWidth={2.5} aria-hidden="true" />
          </button>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              inputValueRef.current = e.target.value;
            }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            enterKeyHint="done"
            placeholder={placeholder}
            className="w-full bg-transparent border-none text-slate-800 placeholder-slate-400 focus:outline-none text-sm font-medium py-1"
          />
        </div>
      </form>
    );
  }
);
