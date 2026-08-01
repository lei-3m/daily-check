import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
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
      onClick={isSelectMode ? () => onToggleSelect?.(id) : undefined}
      className={`group flex items-center justify-between py-2 px-2.5 rounded-lg transition-colors border ${
        isSelectMode
          ? isSelected
            ? 'bg-indigo-50/60 border-indigo-200 cursor-pointer'
            : 'hover:bg-slate-50 border-slate-100 cursor-pointer'
          : 'hover:bg-slate-50 border-transparent hover:border-slate-100'
      }`}
    >
      <div className="flex items-center min-w-0 flex-1 mr-2">
        {/* Selection Checkbox (in place of Drag handle when in Select Mode) */}
        {isSelectMode ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.(id);
            }}
            className={`w-4 h-4 rounded border flex items-center justify-center mr-2.5 shrink-0 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
              isSelected
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'bg-white border-slate-300 text-transparent hover:border-slate-400'
            }`}
            title={isSelected ? '선택 해제' : '선택'}
          >
            <svg
              className="w-3 h-3 fill-current stroke-current"
              viewBox="0 0 12 12"
            >
              <path
                d="M3.5 6L5 7.5L8.5 4"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </button>
        ) : (
          /* Drag handle */
          <span
            className="text-slate-300 group-hover:text-slate-500 opacity-40 group-hover:opacity-100 cursor-grab select-none mr-2.5 text-base transition-opacity"
            aria-hidden="true"
          >
            ⠿
          </span>
        )}

        {/* Raw Markdown Checkbox (Task Done Status) */}
        <button
          type="button"
          onClick={(e) => {
            if (isSelectMode) {
              e.stopPropagation();
              onToggleSelect?.(id);
            } else {
              onToggle(id);
            }
          }}
          className={`font-mono text-sm tracking-tight select-none font-semibold mr-2.5 shrink-0 focus:outline-none rounded px-0.5 ${
            done ? 'text-slate-400' : 'text-slate-700'
          } ${
            isSelectMode ? 'cursor-pointer' : 'hover:opacity-80 focus:ring-1 focus:ring-slate-400'
          }`}
          title={isSelectMode ? '이동 대상 선택' : done ? '미완료로 변경' : '완료로 변경'}
        >
          {done ? '- [x]' : '- [ ]'}
        </button>

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
            onClick={handleStartEdit}
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
          className="text-slate-300 hover:text-red-500 opacity-30 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1 rounded focus:outline-none focus:ring-2 focus:ring-slate-300"
        >
          ✕
        </button>
      )}
    </div>
  );
}


