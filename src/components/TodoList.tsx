import React, { useState, useRef, KeyboardEvent, ClipboardEvent } from 'react';
import { Todo } from '../lib/types';
import { TodoRow } from './TodoRow';

interface TodoListProps {
  todos: Todo[];
  isSelectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggle: (id: string) => void;
  onEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onAddMany: (texts: string[]) => void;
}

export function cleanTodoPrefix(line: string): string {
  let cleaned = line.trim();
  if (cleaned.startsWith('- [ ] ')) {
    cleaned = cleaned.slice(6);
  } else if (cleaned.startsWith('- [x] ') || cleaned.startsWith('- [X] ')) {
    cleaned = cleaned.slice(6);
  } else if (cleaned.startsWith('- [ ]')) {
    cleaned = cleaned.slice(5);
  } else if (cleaned.startsWith('- [x]') || cleaned.startsWith('- [X]')) {
    cleaned = cleaned.slice(5);
  } else if (cleaned.startsWith('- ')) {
    cleaned = cleaned.slice(2);
  } else if (cleaned.startsWith('* ')) {
    cleaned = cleaned.slice(2);
  } else if (cleaned.startsWith('-')) {
    cleaned = cleaned.slice(1);
  } else if (cleaned.startsWith('*')) {
    cleaned = cleaned.slice(1);
  }
  return cleaned.trim();
}

export function TodoList({
  todos,
  isSelectMode = false,
  selectedIds,
  onToggleSelect,
  onToggle,
  onEdit,
  onDelete,
  onAddMany,
}: TodoListProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAddSingle = () => {
    const cleaned = cleanTodoPrefix(inputValue);
    if (cleaned) {
      onAddMany([cleaned]);
      setInputValue('');
    }
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSingle();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAddSingle();
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text');
    if (pastedText.includes('\n') || pastedText.includes('\r')) {
      e.preventDefault();
      const lines = pastedText.split(/\r?\n/);
      const cleanedLines = lines
        .map((line) => cleanTodoPrefix(line))
        .filter((line) => line.length > 0);

      if (cleanedLines.length > 0) {
        onAddMany(cleanedLines);
        setInputValue('');
        inputRef.current?.focus();
      }
    }
  };

  return (
    <div className="space-y-1">
      <div className="divide-y divide-slate-100/60">
        {todos.map((todo) => (
          <TodoRow
            key={todo.id}
            todo={todo}
            isSelectMode={isSelectMode}
            isSelected={selectedIds?.has(todo.id)}
            onToggleSelect={onToggleSelect}
            onToggle={onToggle}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>

      {/* Add Todo Input Field (Hidden in select mode) */}
      {!isSelectMode && (
        <form onSubmit={handleSubmit} className="pt-2">
          <div className="flex items-center gap-2 px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm bg-slate-50/50 focus-within:bg-white focus-within:border-slate-300 focus-within:ring-2 focus-within:ring-slate-300 transition-all">
            <span className="text-base font-medium text-slate-400 select-none">＋</span>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              enterKeyHint="done"
              placeholder="할 일 추가 (여러 줄 붙여넣기 가능)"
              className="w-full bg-transparent border-none text-slate-800 placeholder-slate-400 focus:outline-none text-sm font-medium py-1"
            />
          </div>
        </form>
      )}
    </div>
  );
}


