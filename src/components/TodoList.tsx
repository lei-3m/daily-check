import React, { useState, useRef, KeyboardEvent, ClipboardEvent } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
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
  onReorderTodos?: (newTodos: Todo[]) => void;
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
  onReorderTodos,
}: TodoListProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const inputValueRef = useRef('');
  inputValueRef.current = inputValue;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = todos.findIndex((item) => item.id === active.id);
      const newIndex = todos.findIndex((item) => item.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1 && onReorderTodos) {
        const newTodos = arrayMove(todos, oldIndex, newIndex);
        onReorderTodos(newTodos);
      }
    }
  };

  const handleAddSingle = () => {
    const currentVal = inputValueRef.current || inputValue;
    const cleaned = cleanTodoPrefix(currentVal);
    if (cleaned) {
      onAddMany([cleaned]);
      setInputValue('');
      inputValueRef.current = '';
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
        inputValueRef.current = '';
        inputRef.current?.focus();
      }
    }
  };

  return (
    <div className="space-y-1">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={todos.map((todo) => todo.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="divide-y divide-slate-100/60">
            {todos.length === 0 ? (
              <div className="text-xs text-slate-400 py-3 text-center">
                등록된 할 일이 없어요. 아래에서 새로운 할 일을 추가해 보세요!
              </div>
            ) : (
              todos.map((todo) => (
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
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add Todo Input Field (Hidden in select mode) */}
      {!isSelectMode && (
        <form onSubmit={handleSubmit} className="pt-2">
          <div className="flex items-center gap-2 px-2 py-1 border border-slate-200 rounded-lg text-sm bg-slate-50/50 focus-within:bg-white focus-within:border-slate-300 focus-within:ring-2 focus-within:ring-slate-300 transition-all">
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
              }}
              onMouseDown={(e) => {
                e.preventDefault();
              }}
              onClick={(e) => {
                e.preventDefault();
                handleAddSingle();
              }}
              aria-label="할 일 추가"
              className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-base font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 rounded-md transition-colors cursor-pointer shrink-0 focus:outline-none focus:ring-2 focus:ring-slate-300 select-none"
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


