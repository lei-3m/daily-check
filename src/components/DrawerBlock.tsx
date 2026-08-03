import React, { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Drawer, Todo } from '../lib/types';
import { cleanTodoPrefix } from './TodoList';

type DrawerMode = 'collapsed' | 'documents' | 'list';

interface DrawerBlockProps {
  drawers: Drawer[];
  mode: DrawerMode;
  activeDrawerId?: string;
  onOpenDrawer: () => void;
  onCloseDrawer: () => void;
  onOpenList: (id: string) => void;
  onBackToDocuments: () => void;
  onCreateDrawer: () => void;
  onRenameDrawer: (id: string, name: string) => void;
  onDeleteDrawer: (id: string) => void;
  onAddItems: (drawerId: string, texts: string[]) => void;
  onToggleItem: (drawerId: string, itemId: string) => void;
  onEditItem: (drawerId: string, itemId: string, text: string) => void;
  onDeleteItem: (drawerId: string, itemId: string) => void;
}

interface EditableDrawerNameProps {
  key?: string;
  drawer: Drawer;
  onRenameDrawer: (id: string, name: string) => void;
}

function EditableDrawerName({ drawer, onRenameDrawer }: EditableDrawerNameProps) {
  const [isEditing, setIsEditing] = useState(drawer.name.trim() === '');
  const [name, setName] = useState(drawer.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(drawer.name);
    if (drawer.name.trim() === '') {
      setIsEditing(true);
    }
  }, [drawer.name]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const save = () => {
    const trimmed = name.trim();
    if (trimmed) {
      onRenameDrawer(drawer.id, trimmed);
      setIsEditing(false);
    } else if (drawer.items.length > 0) {
      onRenameDrawer(drawer.id, '목록 이름');
      setIsEditing(false);
    } else {
      setName('');
      setIsEditing(true);
    }
  };
  const displayName = drawer.name.trim();

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={name}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setName(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            save();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setName(drawer.name);
            setIsEditing(false);
          }
        }}
        enterKeyHint="done"
        placeholder="목록 이름"
        className="w-full min-w-0 text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-slate-400"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      className={`min-w-0 text-left truncate text-sm font-semibold rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 ${
        displayName ? 'text-slate-800 hover:text-slate-900' : 'text-slate-400'
      }`}
      title="목록 이름 수정"
    >
      {displayName || '이름 없음'}
    </button>
  );
}

interface DrawerItemRowProps {
  key?: string;
  drawerId: string;
  item: Todo;
  onToggleItem: (drawerId: string, itemId: string) => void;
  onEditItem: (drawerId: string, itemId: string, text: string) => void;
  onDeleteItem: (drawerId: string, itemId: string) => void;
}

interface DrawerDocumentRowProps {
  key?: string;
  drawer: Drawer;
  onOpenList: (id: string) => void;
  onDeleteDrawer: (id: string) => void;
}

function DrawerDocumentRow({
  drawer,
  onOpenList,
  onDeleteDrawer,
}: DrawerDocumentRowProps) {
  const doneCount = drawer.items.filter((item) => item.done).length;
  const totalCount = drawer.items.length;
  const displayName = drawer.name.trim();

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 min-h-[44px] py-1 px-2.5 rounded-lg border border-transparent hover:bg-slate-50 hover:border-slate-100">
        <button
          type="button"
          onClick={() => onOpenList(drawer.id)}
          className="min-w-0 min-h-[44px] flex items-center justify-between gap-2 text-left rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
        >
          <span
            className={`block truncate text-sm font-semibold ${
              displayName ? 'text-slate-800' : 'text-slate-400'
            }`}
          >
            {displayName || '이름 없음'}
          </span>
          <span className="shrink-0 text-xs font-semibold text-slate-400 tabular-nums">
            {totalCount === 0 ? '열어서 추가' : `${doneCount}/${totalCount}`}
          </span>
        </button>
      <button
        type="button"
        onClick={() => onDeleteDrawer(drawer.id)}
        aria-label="목록 삭제"
        className="w-10 h-10 flex items-center justify-center shrink-0 text-slate-400 [@media(hover:hover)]:hover:text-red-500 [@media(hover:hover)]:hover:bg-red-50 focus-visible:text-red-500 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
      >
        ×
      </button>
    </li>
  );
}

function DrawerItemRow({
  drawerId,
  item,
  onToggleItem,
  onEditItem,
  onDeleteItem,
}: DrawerItemRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(item.text);
  const inputRef = useRef<HTMLInputElement>(null);
  const isCancelledRef = useRef(false);

  useEffect(() => {
    setEditText(item.text);
  }, [item.text]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const save = () => {
    if (isCancelledRef.current) return;
    const trimmed = editText.trim();
    if (trimmed) {
      onEditItem(drawerId, item.id, trimmed);
    } else {
      onDeleteItem(drawerId, item.id);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      isCancelledRef.current = true;
      setEditText(item.text);
      setIsEditing(false);
    }
  };

  return (
    <div className="group flex items-center justify-between py-2 px-2.5 rounded-lg transition-colors border border-transparent hover:bg-slate-50 hover:border-slate-100">
      <div className="flex items-center min-w-0 flex-1 mr-1">
        <button
          type="button"
          role="checkbox"
          aria-checked={item.done}
          aria-label={item.done ? '미완료로 변경' : '완료로 변경'}
          onClick={() => onToggleItem(drawerId, item.id)}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              onToggleItem(drawerId, item.id);
            }
          }}
          className="w-10 h-10 flex items-center justify-center shrink-0 -ml-1 mr-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 rounded-lg group/cb cursor-pointer"
        >
          <span
            className={`w-5 h-5 rounded-[6px] border flex items-center justify-center transition-all duration-150 motion-reduce:transition-none ${
              item.done
                ? 'accent-fill text-white'
                : 'bg-white border-slate-300 group-hover/cb:border-slate-400 text-transparent'
            }`}
          >
            <svg
              className={`w-3.5 h-3.5 stroke-current transition-transform duration-150 motion-reduce:transition-none ${
                item.done ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
              }`}
              viewBox="0 0 14 14"
              fill="none"
            >
              <path
                d="M3 7L5.5 9.5L11 4"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </button>

        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editText}
            onChange={(e) => {
              isCancelledRef.current = false;
              setEditText(e.target.value);
            }}
            onBlur={save}
            onKeyDown={handleKeyDown}
            enterKeyHint="done"
            className="flex-1 min-w-0 text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        ) : (
          <span
            onClick={() => {
              isCancelledRef.current = false;
              setIsEditing(true);
            }}
            className={`text-sm truncate font-medium cursor-pointer hover:text-slate-900 ${
              item.done ? 'line-through text-slate-400' : 'text-slate-800'
            }`}
            title="클릭하여 수정"
          >
            {item.text}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => onDeleteItem(drawerId, item.id)}
        aria-label="항목 삭제"
        className="w-10 h-10 flex items-center justify-center shrink-0 text-slate-400 [@media(hover:hover)]:hover:text-red-500 [@media(hover:hover)]:hover:bg-red-50 focus-visible:text-red-500 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
      >
        ×
      </button>
    </div>
  );
}

interface DrawerAddFormProps {
  drawerId: string;
  onAddItems: (drawerId: string, texts: string[]) => void;
}

function DrawerAddForm({ drawerId, onAddItems }: DrawerAddFormProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const inputValueRef = useRef('');
  inputValueRef.current = inputValue;

  const addSingle = () => {
    const cleaned = cleanTodoPrefix(inputValueRef.current || inputValue);
    if (cleaned) {
      onAddItems(drawerId, [cleaned]);
      setInputValue('');
      inputValueRef.current = '';
    }
    inputRef.current?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text');
    if (!pastedText.includes('\n') && !pastedText.includes('\r')) return;

    e.preventDefault();
    const lines = pastedText
      .split(/\r?\n/)
      .map((line) => cleanTodoPrefix(line))
      .filter((line) => line.length > 0);

    if (lines.length > 0) {
      onAddItems(drawerId, lines);
      setInputValue('');
      inputValueRef.current = '';
      inputRef.current?.focus();
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        addSingle();
      }}
      className="pt-1"
    >
      <div className="flex items-center gap-2 px-2 py-1 border border-slate-200 rounded-lg text-sm bg-slate-50/50 focus-within:bg-white focus-within:border-slate-300 focus-within:ring-2 focus-within:ring-slate-300 transition-all">
        <button
          type="button"
          onPointerDown={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.preventDefault();
            addSingle();
          }}
          aria-label="항목 추가"
          className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-base font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 rounded-md transition-colors cursor-pointer shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 select-none"
        >
          ＋
        </button>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            inputValueRef.current = e.target.value;
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addSingle();
            }
          }}
          onPaste={handlePaste}
          enterKeyHint="done"
          placeholder="항목 추가"
          className="w-full bg-transparent border-none text-slate-800 placeholder-slate-400 focus:outline-none text-sm font-medium py-1"
        />
      </div>
    </form>
  );
}

export function DrawerBlock({
  drawers,
  mode,
  activeDrawerId,
  onOpenDrawer,
  onCloseDrawer,
  onOpenList,
  onBackToDocuments,
  onCreateDrawer,
  onRenameDrawer,
  onDeleteDrawer,
  onAddItems,
  onToggleItem,
  onEditItem,
  onDeleteItem,
}: DrawerBlockProps) {
  const activeDrawer = drawers.find((drawer) => drawer.id === activeDrawerId);

  if (mode === 'collapsed') {
    return (
      <button
        type="button"
        onClick={onOpenDrawer}
        className="w-full bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 flex items-center justify-between text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
      >
        <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          <span>▤</span>
          <span>서랍</span>
        </span>
        <span className="min-h-11 min-w-11 flex items-center justify-center rounded-lg text-slate-600">
          <span className="text-[28px] font-bold leading-none">⌄</span>
        </span>
      </button>
    );
  }

  if (mode === 'list' && activeDrawer) {
    return (
      <section className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 space-y-3 max-w-full overflow-hidden">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onBackToDocuments}
            aria-label="뒤로"
            className="min-h-11 min-w-11 flex items-center justify-center font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 rounded-lg select-auto"
          >
            <span className="text-[34px] leading-none">〈</span>
          </button>
          <div className="min-w-0 flex-1">
            <EditableDrawerName
              drawer={activeDrawer}
              onRenameDrawer={onRenameDrawer}
            />
          </div>
        </div>

        <div className="max-h-[42vh] overflow-y-auto pr-1 divide-y divide-slate-100/60">
          {activeDrawer.items.length === 0 ? (
            <div className="text-xs text-slate-400 py-3 text-center leading-relaxed">
              이 목록은 아직 비어 있어요. 아래에서 항목을 추가하세요.
            </div>
          ) : (
            activeDrawer.items.map((item) => (
              <DrawerItemRow
                key={item.id}
                drawerId={activeDrawer.id}
                item={item}
                onToggleItem={onToggleItem}
                onEditItem={onEditItem}
                onDeleteItem={onDeleteItem}
              />
            ))
          )}
        </div>

        <DrawerAddForm drawerId={activeDrawer.id} onAddItems={onAddItems} />
      </section>
    );
  }

  return (
    <section className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 space-y-3 max-w-full overflow-hidden">
      <div className="flex items-center justify-between select-none">
        <button
          type="button"
          onClick={onCloseDrawer}
          aria-label="뒤로"
          className="min-h-11 min-w-11 flex items-center justify-center font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 rounded-lg select-auto"
        >
          <span className="text-[34px] leading-none">〈</span>
        </button>
      </div>

      <div className="max-h-[42vh] overflow-y-auto pr-1">
        {drawers.length === 0 ? (
          <div className="text-xs text-slate-400 py-3 text-center leading-relaxed">
            날짜와 무관한 체크리스트를 모아두는 곳입니다.<br />
            살 것, 읽을 책처럼 필요할 때 열어보세요.
          </div>
        ) : (
          <ul className="space-y-1">
            {drawers.map((drawer) => (
              <DrawerDocumentRow
                key={drawer.id}
                drawer={drawer}
                onOpenList={onOpenList}
                onDeleteDrawer={onDeleteDrawer}
              />
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={onCreateDrawer}
        className="w-full min-h-[44px] flex items-center justify-center gap-1.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
      >
        <span>＋</span>
        <span>새 목록</span>
      </button>
    </section>
  );
}
