import { useState, useEffect } from 'react';
import { AppState, Todo } from './lib/types';
import { todayKey, fullLabel } from './lib/date';
import { loadState, saveState } from './lib/storage';
import { Header } from './components/Header';
import { ScheduleBlock } from './components/ScheduleBlock';
import { DateTabs } from './components/DateTabs';
import { TodoList } from './components/TodoList';
import { MemoBlock } from './components/MemoBlock';
import { ActionBar } from './components/ActionBar';

export default function App() {
  const [appState, setAppState] = useState<AppState | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const today = todayKey();

    loadState().then((saved) => {
      if (!saved) {
        const initial: AppState = {
          days: {
            [today]: {
              todos: [
                { id: '1', text: '발표자료 만들기', done: false },
                { id: '2', text: 'PR 리뷰', done: true },
                { id: '3', text: '운동', done: false },
                { id: '4', text: '팀 회의 준비', done: true },
              ],
              memo: '오늘은 발표라 긴장됨.',
            },
          },
          schedule: [
            { id: '1', date: '8/2', text: '미용실' },
            { id: '2', date: '8/5', text: '회식' },
          ],
          active: today,
        };
        setAppState(initial);
      } else {
        const days = { ...(saved.days || {}) };
        let active = saved.active || today;

        if (!days[today]) {
          days[today] = { todos: [], memo: '' };
          active = today;
        }

        setAppState({
          days,
          schedule: saved.schedule || [],
          active,
        });
      }
      setIsLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!isLoaded || !appState) return;

    const timer = setTimeout(() => {
      saveState(appState);
    }, 350);

    return () => clearTimeout(timer);
  }, [appState, isLoaded]);

  if (!isLoaded || !appState) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-400 text-sm font-medium">로딩 중...</div>
      </div>
    );
  }

  const activeKey = appState.active;
  const currentDay = appState.days[activeKey] || { todos: [], memo: '' };
  const todos = currentDay.todos || [];

  const completedCount = todos.filter((t) => t.done).length;
  const totalCount = todos.length;

  const updateCurrentTodos = (newTodos: Todo[]) => {
    setAppState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        days: {
          ...prev.days,
          [activeKey]: {
            ...currentDay,
            todos: newTodos,
          },
        },
      };
    });
  };

  const handleToggle = (id: string) => {
    updateCurrentTodos(
      todos.map((todo) =>
        todo.id === id ? { ...todo, done: !todo.done } : todo
      )
    );
  };

  const handleEdit = (id: string, newText: string) => {
    updateCurrentTodos(
      todos.map((todo) =>
        todo.id === id ? { ...todo, text: newText } : todo
      )
    );
  };

  const handleDelete = (id: string) => {
    updateCurrentTodos(todos.filter((todo) => todo.id !== id));
  };

  const handleAddMany = (texts: string[]) => {
    const newItems: Todo[] = texts.map((text) => ({
      id:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).substring(2, 9),
      text,
      done: false,
    }));
    updateCurrentTodos([...todos, ...newItems]);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans py-6 px-3 sm:py-10 sm:px-4">
      <main className="max-w-[620px] mx-auto bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 sm:p-6 space-y-5">
        {/* Header Section */}
        <Header
          dateLabel={fullLabel(activeKey)}
          completedCount={completedCount}
          totalCount={totalCount}
        />

        {/* Fixed Schedule Block */}
        <ScheduleBlock schedule={appState.schedule} />

        {/* Date Tabs (Horizontal Scroll) */}
        <DateTabs activeKey={activeKey} />

        {/* Todo List */}
        <TodoList
          todos={todos}
          onToggle={handleToggle}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onAddMany={handleAddMany}
        />

        {/* Memo Block */}
        <MemoBlock memo={currentDay.memo} />

        {/* Action Bar */}
        <ActionBar />
      </main>
    </div>
  );
}


