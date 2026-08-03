import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Todo } from '../lib/types';

interface TodoRowProps {
  key?: string;
  todo: Todo;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  onToggle: (id: string) => void;
  onEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
}

export function TodoRow({
  todo,
  isSelectMode = false,
  isSelected = false,
  onToggleSelect,
  onToggle,
  onEdit,
  onDelete,
}: TodoRowProps) {
  const { id, text, done } = todo;
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(text);
  const inputRef = useRef<HTMLInputElement>(null);
  const isCancelledRef = useRef(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled: isSelectMode,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: 'relative',
  };

  useEffect(() => {
    if (isEditing && !isSelectMode) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing, isSelectMode]);

  const handleStartEdit = () => {
    if (isSelectMode) {
      onToggleSelect?.(id);
      return;
    }
    setEditText(text);
    isCancelledRef.current = false;
    setIsEditing(true);
  };

  const handleSave = () => {
    if (isCancelledRef.current) return;
    const trimmed = editText.trim();
    if (trimmed === '') {
      onDelete(id);
    } else {
      onEdit(id, trimmed);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      isCancelledRef.current = true;
      setEditText(text);
      setIsEditing(false);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={isSelectMode ? () => onToggleSelect?.(id) : undefined}
      className={`group flex items-center justify-between py-2 px-2.5 rounded-lg transition-colors border ${
        isDragging
          ? 'shadow-xl bg-white opacity-95 scale-[1.01] border-slate-300 ring-1.5 ring-slate-200'
          : isSelectMode
          ? isSelected
            ? 'accent-soft accent-border cursor-pointer'
            : 'hover:bg-slate-50 border-slate-100 cursor-pointer'
          : 'hover:bg-slate-50 border-transparent hover:border-slate-100'
      }`}
    >
      <div className="flex items-center min-w-0 flex-1 mr-1">
        {/* Selection Checkbox (in place of Drag handle when in Select Mode) */}
        {isSelectMode ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.(id);
            }}
            className="w-10 h-10 flex items-center justify-center shrink-0 -ml-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 rounded-lg"
            title={isSelected ? '선택 해제' : '선택'}
          >
            <span
              className={`w-5 h-5 rounded-[6px] border flex items-center justify-center transition-all duration-150 motion-reduce:transition-none ${
                isSelected
                  ? 'accent-fill text-white'
                  : 'bg-white border-slate-300 text-transparent'
              }`}
            >
              <svg
                className="w-3.5 h-3.5 stroke-current"
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
        ) : (
          /* Drag handle */
          <span
            {...attributes}
            {...listeners}
            style={{ touchAction: 'pan-y' }}
            className="w-10 h-10 flex items-center justify-center shrink-0 -ml-1 text-slate-400 [@media(hover:hover)]:hover:text-slate-600 select-none cursor-grab active:cursor-grabbing text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 rounded"
            aria-label="순서 변경"
            title="드래그하여 순서 변경"
          >
            ⠿
          </span>
        )}

        {/* Task Done Status Checkbox */}
        {!isSelectMode && (
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={done ? '미완료로 변경' : '완료로 변경'}
          onClick={(e) => {
            if (isSelectMode) {
              e.stopPropagation();
              onToggleSelect?.(id);
            } else {
              onToggle(id);
            }
          }}
          onKeyDown={(e) => {
            if (!isSelectMode && (e.key === ' ' || e.key === 'Enter')) {
              e.preventDefault();
              onToggle(id);
            }
          }}
          className="w-10 h-10 flex items-center justify-center shrink-0 -ml-1 mr-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 rounded-lg group/cb cursor-pointer"
          title={isSelectMode ? '이동 대상 선택' : done ? '미완료로 변경' : '완료로 변경'}
        >
          <span
            className={`w-5 h-5 rounded-[6px] border flex items-center justify-center transition-all duration-150 motion-reduce:transition-none ${
              done
                ? 'accent-fill text-white'
                : 'bg-white border-slate-300 group-hover/cb:border-slate-400 text-transparent'
            }`}
          >
            <svg
              className={`w-3.5 h-3.5 stroke-current transition-transform duration-150 motion-reduce:transition-none ${
                done ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
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
        )}

        {/* Task Text or Edit Input */}
        {!isSelectMode && isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="flex-1 text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        ) : (
          <span
            onClick={isSelectMode ? undefined : handleStartEdit}
            title={isSelectMode ? '선택' : '클릭하여 수정'}
            className={`text-sm truncate font-medium ${
              isSelectMode ? 'select-none' : 'cursor-pointer hover:text-slate-900'
            } ${done ? 'line-through text-slate-400' : 'text-slate-800'}`}
          >
            {text}
          </span>
        )}
      </div>

      {/* Delete Button (Hidden in Select Mode) */}
      {!isSelectMode && (
        <button
          type="button"
          onClick={() => onDelete(id)}
          aria-label="할 일 삭제"
          className="w-10 h-10 flex items-center justify-center shrink-0 text-slate-400 [@media(hover:hover)]:hover:text-red-500 [@media(hover:hover)]:hover:bg-red-50 focus-visible:text-red-500 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
        >
          ✕
        </button>
      )}
    </div>
  );
}
