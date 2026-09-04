import React, { useEffect, useState, useRef } from 'react';
import { ChevronDown, ChevronUp, Repeat } from 'lucide-react';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { DisplayTodo } from '../lib/routineTodos';
import { restrictDragToList, useListDragSensors } from '../lib/listDrag';
import { moveIncompleteTodo } from '../lib/todoOrder';
import { TodoRow } from './TodoRow';
import { TodoAddForm, TodoAddFormHandle } from './TodoAddForm';

const TODO_SWIPE_START_PX = 60;
const TODO_SWIPE_AXIS_RATIO = 3;
const TODO_SWIPE_VERTICAL_ABORT_PX = 20;
const TODO_SWIPE_COMMIT_RATIO = 0.28;
const TODO_SWIPE_SETTLE_MS = 180;
// 이만큼이라도 움직였으면 탭이 아니다. 인라인 편집을 열지 않는다.
const TODO_TAP_SLOP_PX = 5;

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
  todos: DisplayTodo[];
  isSelectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggle: (id: string) => void;
  onEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onAddMany: (texts: string[]) => void;
  onReorderTodos?: (newTodos: DisplayTodo[]) => void;
  onSwipeDate?: (direction: -1 | 1) => void;
  /** 새 루틴 추가 화면으로 이동합니다. */
  onAddRoutine?: () => void;
  /** 루틴 항목을 눌렀을 때 그 루틴의 수정 화면으로 이동합니다. */
  onOpenRoutine?: (routineId: string) => void;
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
  onAddRoutine,
  onOpenRoutine,
}: TodoListProps) {
  const [isCompletedExpanded, setIsCompletedExpanded] = useState(false);
  const addFormRef = useRef<TodoAddFormHandle>(null);
  const swipeRailRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<HTMLDivElement>(null);
  const pendingAddScrollRef = useRef(false);
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

  // 새로 추가한 할 일은 목록 맨 아래에 붙는다. 화면 밖으로 밀려나면
  // 사용자가 직접 스크롤해야 하므로, 추가 직후 보이는 위치까지 끌어온다.
  useEffect(() => {
    if (!pendingAddScrollRef.current) return;
    pendingAddScrollRef.current = false;
    const lastRow = rowsRef.current?.lastElementChild;
    lastRow?.scrollIntoView({
      block: 'nearest',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
    addFormRef.current?.focus();
  }, [todos.length]);

  const sensors = useListDragSensors();

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

    // 손가락이 움직였으면 뒤따르는 click을 막는다. 스와이프 판정에 이르지
    // 못한 짧은 움직임이나 세로 스크롤에서도 편집이 열리면 안 된다.
    if (absDx >= TODO_TAP_SLOP_PX || absDy >= TODO_TAP_SLOP_PX) {
      suppressClickRef.current = true;
    }

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
        modifiers={[restrictDragToList]}
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
          <div ref={rowsRef} className="min-h-[128px] divide-y divide-slate-100/60">
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
                      onOpenRoutine={onOpenRoutine}
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
                    onOpenRoutine={onOpenRoutine}
                  />
                ))}
              </>
            )}
          </div>
        </SortableContext>
      </DndContext>
      </div>

      {!isSelectMode && (
        <div className="pt-2 flex items-stretch gap-2">
          <TodoAddForm
            ref={addFormRef}
            placeholder="할 일 적기"
            addLabel="할 일 추가"
            onAddMany={onAddMany}
            onBeforeAdd={() => {
              pendingAddScrollRef.current = true;
            }}
            className="flex-1 min-w-0"
          />
          {onAddRoutine ? (
            <button
              type="button"
              onClick={onAddRoutine}
              aria-label="루틴 추가"
              title="루틴 추가"
              data-todo-swipe-ignore="true"
              className="w-11 min-w-[44px] shrink-0 flex items-center justify-center rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-500 surface-hover-media focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 transition-colors"
            >
              <Repeat className="w-5 h-5" strokeWidth={2} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
