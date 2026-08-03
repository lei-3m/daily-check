import React, { useEffect, useState, useRef, KeyboardEvent, ClipboardEvent } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import type { Modifier } from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Todo } from '../lib/types';
import { moveIncompleteTodo } from '../lib/todoOrder';
import { TodoRow } from './TodoRow';

const TODO_SWIPE_START_PX = 60;
const TODO_SWIPE_AXIS_RATIO = 3;
const TODO_SWIPE_VERTICAL_ABORT_PX = 20;
const TODO_SWIPE_COMMIT_RATIO = 0.28;
const TODO_SWIPE_SETTLE_MS = 180;

const restrictTodoDragToList: Modifier = ({ transform, activeNodeRect, containerNodeRect }) => {
  const nextTransform = { ...transform, x: 0 };

  if (!activeNodeRect || !containerNodeRect) {
    return nextTransform;
  }

  const minY = containerNodeRect.top - activeNodeRect.top;
  const maxY = containerNodeRect.bottom - activeNodeRect.bottom;

  return {
    ...nextTransform,
    y: Math.min(Math.max(nextTransform.y, minY), maxY),
  };
};

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function shouldIgnoreSwipeStart(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true;
  return Boolean(
    target.closest(
      'button,input,textarea,select,[contenteditable="true"],[data-todo-swipe-ignore="true"]'
    )
  );
}

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
  onSwipeDate?: (direction: -1 | 1) => void;
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
  onSwipeDate,
}: TodoListProps) {
  const [inputValue, setInputValue] = useState('');
  const [isCompletedExpanded, setIsCompletedExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputValueRef = useRef('');
  const swipeRailRef = useRef<HTMLDivElement>(null);
  const isDndDraggingRef = useRef(false);
  const suppressClickRef = useRef(false);
  const swipeResetTimerRef = useRef<number | null>(null);
  const swipeRef = useRef<{
    startX: number;
    startY: number;
    pointerId: number;
    decided: boolean;
    active: boolean;
  } | null>(null);
  inputValueRef.current = inputValue;
  const incompleteTodos = todos.filter((todo) => !todo.done);
  const completedTodos = todos.filter((todo) => todo.done);
  const todoIdsKey = todos.map((todo) => todo.id).join('|');

  useEffect(() => {
    setIsCompletedExpanded(false);
  }, [todoIdsKey]);

  useEffect(() => {
    return () => {
      if (swipeResetTimerRef.current !== null) {
        window.clearTimeout(swipeResetTimerRef.current);
      }
    };
  }, []);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    isDndDraggingRef.current = false;
    const { active, over } = event;
    if (over && active.id !== over.id) {
      if (onReorderTodos) {
        const newTodos = moveIncompleteTodo(todos, String(active.id), String(over.id));
        if (newTodos === todos) return;
        onReorderTodos(newTodos);
      }
    }
  };

  const applySwipeTransform = (dx: number, animate: boolean) => {
    const rail = swipeRailRef.current;
    if (!rail) return;
    rail.style.transition =
      animate && !prefersReducedMotion()
        ? `transform ${TODO_SWIPE_SETTLE_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`
        : 'none';
    rail.style.transform = `translateX(${dx}px)`;
  };

  const resetSwipeTransform = (animate: boolean) => {
    applySwipeTransform(0, animate);
  };

  const handleSwipePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onSwipeDate || isSelectMode || isDndDraggingRef.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (shouldIgnoreSwipeStart(e.target)) return;

    suppressClickRef.current = false;
    swipeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      pointerId: e.pointerId,
      decided: false,
      active: false,
    };
  };

  const handleSwipePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = swipeRef.current;
    if (!state || state.pointerId !== e.pointerId || isSelectMode || isDndDraggingRef.current) {
      return;
    }

    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (!state.decided) {
      if (absDy > TODO_SWIPE_VERTICAL_ABORT_PX && absDy >= absDx) {
        swipeRef.current = null;
        return;
      }
      if (absDx <= TODO_SWIPE_START_PX || absDx <= absDy * TODO_SWIPE_AXIS_RATIO) return;

      state.decided = true;
      state.active = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Pointer capture can fail if browser already released pointer.
      }
    }

    applySwipeTransform(dx, false);
  };

  const handleSwipePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = swipeRef.current;
    if (!state || state.pointerId !== e.pointerId) return;
    swipeRef.current = null;
    if (!state.active || !onSwipeDate) return;

    suppressClickRef.current = true;

    const dx = e.clientX - state.startX;
    const width = e.currentTarget.clientWidth || 300;
    const shouldCommit = Math.abs(dx) >= Math.max(TODO_SWIPE_START_PX, width * TODO_SWIPE_COMMIT_RATIO);

    if (!shouldCommit) {
      resetSwipeTransform(true);
      return;
    }

    const direction = dx < 0 ? 1 : -1;
    if (prefersReducedMotion()) {
      onSwipeDate(direction);
      resetSwipeTransform(false);
      return;
    }

    applySwipeTransform(direction === 1 ? -width : width, true);
    swipeResetTimerRef.current = window.setTimeout(() => {
      onSwipeDate(direction);
      resetSwipeTransform(false);
      swipeResetTimerRef.current = null;
    }, TODO_SWIPE_SETTLE_MS);
  };

  const handleSwipePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = swipeRef.current;
    if (!state || state.pointerId !== e.pointerId) return;
    swipeRef.current = null;
    if (!state.active) return;
    suppressClickRef.current = true;
    resetSwipeTransform(true);
  };

  const handleSwipeClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    e.preventDefault();
    e.stopPropagation();
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
    <div
      className="min-h-[128px] overflow-hidden touch-pan-y"
      onPointerDown={handleSwipePointerDown}
      onPointerMove={handleSwipePointerMove}
      onPointerUp={handleSwipePointerUp}
      onPointerCancel={handleSwipePointerCancel}
      onClickCapture={handleSwipeClickCapture}
    >
      <div ref={swipeRailRef} className="min-h-[128px] space-y-1" style={{ willChange: 'transform' }}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictTodoDragToList]}
        onDragStart={() => {
          isDndDraggingRef.current = true;
          swipeRef.current = null;
          resetSwipeTransform(false);
        }}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          isDndDraggingRef.current = false;
          swipeRef.current = null;
          resetSwipeTransform(false);
        }}
      >
        <SortableContext
          items={todos.map((todo) => todo.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="min-h-[128px] divide-y divide-slate-100/60">
            {todos.length === 0 ? (
              <div className="min-h-[128px] flex items-center justify-center text-xs text-slate-400 py-3 text-center">
                오늘 할 일이 없어요. 아래 입력칸에 할 일을 추가하세요.
              </div>
            ) : (
              <>
                {completedTodos.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsCompletedExpanded((prev) => !prev)}
                    aria-expanded={isCompletedExpanded}
                    className="min-h-11 w-full flex items-center justify-between gap-2 px-2.5 py-2 text-left text-xs font-semibold text-slate-500 border border-transparent [@media(hover:hover)]:hover:text-slate-700 [@media(hover:hover)]:hover:bg-slate-50 [@media(hover:hover)]:hover:border-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 rounded-lg"
                  >
                    <span>완료한 일 {completedTodos.length}개</span>
                    {isCompletedExpanded ? (
                      <ChevronUp size={20} strokeWidth={2} aria-hidden="true" />
                    ) : (
                      <ChevronDown size={20} strokeWidth={2} aria-hidden="true" />
                    )}
                  </button>
                )}

                {isCompletedExpanded &&
                  completedTodos.map((todo) => (
                    <TodoRow
                      key={todo.id}
                      todo={todo}
                      isSelectMode={isSelectMode}
                      isSelected={selectedIds?.has(todo.id)}
                      isDragDisabled
                      onToggleSelect={onToggleSelect}
                      onToggle={onToggle}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                  ))}

                {incompleteTodos.map((todo) => (
                  <TodoRow
                    key={todo.id}
                    todo={todo}
                    isSelectMode={isSelectMode}
                    isSelected={selectedIds?.has(todo.id)}
                    isDragDisabled={false}
                    onToggleSelect={onToggleSelect}
                    onToggle={onToggle}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                ))}
              </>
            )}
          </div>
        </SortableContext>
      </DndContext>
      </div>

      {!isSelectMode && (
        <form onSubmit={handleSubmit} className="pt-2" data-todo-swipe-ignore="true">
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
              className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-base font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 rounded-md transition-colors cursor-pointer shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 select-none"
            >
              +
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
