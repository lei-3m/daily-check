import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Todo } from '../lib/types';

interface TodoRowProps {
  key?: string;
  todo: Todo;
  onToggle: (id: string) => void;
  onEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
}

export function TodoRow({ todo, onToggle, onEdit, onDelete }: TodoRowProps) {
  const { id, text, done } = todo;
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(text);
  const inputRef = useRef<HTMLInputElement>(null);
  const isCancelledRef = useRef(false);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
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
    <div className="group flex items-center justify-between py-2 px-2.5 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
      <div className="flex items-center min-w-0 flex-1 mr-2">
        {/* Drag handle */}
        <span
          className="text-slate-300 group-hover:text-slate-500 opacity-40 group-hover:opacity-100 cursor-grab select-none mr-2.5 text-base transition-opacity"
          aria-hidden="true"
        >
          ⠿
        </span>

        {/* Raw Markdown Checkbox */}
        <button
          type="button"
          onClick={() => onToggle(id)}
          className={`font-mono text-sm tracking-tight select-none font-semibold mr-2.5 shrink-0 hover:opacity-80 focus:outline-none focus:ring-1 focus:ring-slate-400 rounded px-0.5 ${
            done ? 'text-slate-400' : 'text-slate-700'
          }`}
          title={done ? '미완료로 변경' : '완료로 변경'}
        >
          {done ? '- [x]' : '- [ ]'}
        </button>

        {/* Task Text or Edit Input */}
        {isEditing ? (
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
            title="클릭하여 수정"
            className={`text-sm truncate font-medium cursor-pointer hover:text-slate-900 ${
              done ? 'line-through text-slate-400' : 'text-slate-800'
            }`}
          >
            {text}
          </span>
        )}
      </div>

      {/* Delete Button */}
      <button
        type="button"
        onClick={() => onDelete(id)}
        aria-label="할 일 삭제"
        className="text-slate-300 hover:text-red-500 opacity-30 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1 rounded focus:outline-none focus:ring-2 focus:ring-slate-300"
      >
        ✕
      </button>
    </div>
  );
}


