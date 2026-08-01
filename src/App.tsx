import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { AppState, Todo } from './lib/types';
import { todayKey, fullLabel } from './lib/date';
import {
  loadState,
  saveState,
  clearUserCache,
  SyncStatus,
  subscribeSyncStatus,
  subscribeConflict,
  checkMigrationNeeded,
  markMigrationPrompted,
  uploadLocalToAccount,
} from './lib/storage';
import { supabase } from './lib/supabase';
import { formatTodosToMarkdown, copyToClipboard } from './lib/clipboard';
import { Header } from './components/Header';
import { ScheduleBlock } from './components/ScheduleBlock';
import { DateNav, View } from './components/DateNav';
import { TodoList } from './components/TodoList';
import { MemoBlock } from './components/MemoBlock';
import { ActionBar } from './components/ActionBar';
import { MoveBar } from './components/MoveBar';
import { Toast, useToast } from './components/Toast';
import { LoginScreen } from './components/LoginScreen';
import { MigrationModal } from './components/MigrationModal';
import { ConflictModal } from './components/ConflictModal';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  const [appState, setAppState] = useState<AppState | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ type: 'synced' });

  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);

  const [view, setView] = useState<View>(() => ({
    kind: 'week',
    anchor: todayKey(),
  }));
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { toastMessage, showToast, hideToast } = useToast();

  // 1. Session Auth listener
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setAuthChecking(false);
      if (!newSession) {
        clearUserCache();
        setAppState(null);
        setIsLoaded(false);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthChecking(false);
      if (!data.session) {
        clearUserCache();
        setAppState(null);
        setIsLoaded(false);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // 2. Sync status & Conflict listeners
  useEffect(() => {
    const unsubStatus = subscribeSyncStatus((status) => {
      setSyncStatus(status);
    });

    const unsubConflict = subscribeConflict(() => {
      setShowConflictModal(true);
    });

    return () => {
      unsubStatus();
      unsubConflict();
    };
  }, []);

  // 3. Load AppState when authenticated
  useEffect(() => {
    if (authChecking) return;
    if (!session) return;

    let isMounted = true;
    const today = todayKey();

    setIsLoaded(false);

    loadState(session.user.id).then((saved) => {
      if (!isMounted) return;

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
        const active = saved.active || today;

        setAppState({
          days,
          schedule: saved.schedule || [],
          active,
        });
      }
      setIsLoaded(true);

      // Check migration needed
      checkMigrationNeeded(session.user.id).then((needed) => {
        if (needed && isMounted) {
          setShowMigrationModal(true);
        }
      });
    });

    return () => {
      isMounted = false;
    };
  }, [session, authChecking]);

  // 4. Auto save state with debounce
  useEffect(() => {
    if (!isLoaded || !appState || !session) return;

    const timer = setTimeout(() => {
      saveState(appState);
    }, 350);

    return () => clearTimeout(timer);
  }, [appState, isLoaded, session]);

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-400 text-sm font-medium">세션 확인 중...</div>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

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

  const updateCurrentDay = (newTodos: Todo[], newMemo?: string) => {
    setAppState((prev) => {
      if (!prev) return prev;
      const memoValue =
        newMemo !== undefined ? newMemo : prev.days[activeKey]?.memo || '';
      const newDays = { ...prev.days };

      if (newTodos.length === 0 && (!memoValue || memoValue.trim() === '')) {
        delete newDays[activeKey];
      } else {
        newDays[activeKey] = {
          todos: newTodos,
          memo: memoValue,
        };
      }

      return {
        ...prev,
        days: newDays,
      };
    });
  };

  const handleToggle = (id: string) => {
    updateCurrentDay(
      todos.map((todo) =>
        todo.id === id ? { ...todo, done: !todo.done } : todo
      )
    );
  };

  const handleEdit = (id: string, newText: string) => {
    updateCurrentDay(
      todos.map((todo) =>
        todo.id === id ? { ...todo, text: newText } : todo
      )
    );
  };

  const handleDelete = (id: string) => {
    updateCurrentDay(todos.filter((todo) => todo.id !== id));
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
    updateCurrentDay([...todos, ...newItems]);
  };

  const handleSelectDate = (key: string) => {
    if (isSelectMode) {
      setIsSelectMode(false);
      setSelectedIds(new Set());
    }
    setAppState((prev) => (prev ? { ...prev, active: key } : prev));
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.size === todos.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(todos.map((t) => t.id)));
    }
  };

  const handleStartMoveMode = () => {
    setIsSelectMode(true);
    setSelectedIds(new Set());
  };

  const handleCancelMoveMode = () => {
    setIsSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleMoveToDate = (targetDateKey: string) => {
    if (selectedIds.size === 0) return;

    const movingTodos = todos.filter((t) => selectedIds.has(t.id));
    const remainingTodos = todos.filter((t) => !selectedIds.has(t.id));

    setAppState((prev) => {
      if (!prev) return prev;
      const newDays = { ...prev.days };

      // Update source day
      const sourceMemo = newDays[activeKey]?.memo || '';
      if (remainingTodos.length === 0 && (!sourceMemo || sourceMemo.trim() === '')) {
        delete newDays[activeKey];
      } else {
        newDays[activeKey] = {
          todos: remainingTodos,
          memo: sourceMemo,
        };
      }

      // Update target day
      const targetDay = newDays[targetDateKey] || { todos: [], memo: '' };
      newDays[targetDateKey] = {
        ...targetDay,
        todos: [...(targetDay.todos || []), ...movingTodos],
      };

      return {
        ...prev,
        days: newDays,
        active: targetDateKey,
      };
    });

    setIsSelectMode(false);
    setSelectedIds(new Set());
    showToast(`${movingTodos.length}개 할 일이 이동함`);
  };

  const handleAddSchedule = (date: string, text: string) => {
    const newItem = {
      id:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).substring(2, 9),
      date,
      text,
    };
    setAppState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        schedule: [...prev.schedule, newItem],
      };
    });
  };

  const handleDeleteSchedule = (id: string) => {
    setAppState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        schedule: prev.schedule.filter((item) => item.id !== id),
      };
    });
  };

  const handleChangeMemo = (newMemo: string) => {
    updateCurrentDay(todos, newMemo);
  };

  const handleCopy = async () => {
    if (todos.length === 0) {
      showToast('복사할 할 일이 없어요');
      return;
    }

    const text = formatTodosToMarkdown(todos);
    const success = await copyToClipboard(text);
    if (success) {
      showToast('복사됨 — ChatGPT에 붙여넣기');
    }
  };

  const handleSignOut = async () => {
    clearUserCache();
    setAppState(null);
    setIsLoaded(false);
    await supabase.auth.signOut();
    setSession(null);
  };

  const handleConfirmMigration = async () => {
    setShowMigrationModal(false);
    if (session && appState) {
      await uploadLocalToAccount(session.user.id, appState);
      showToast('기록이 계정으로 이관되었습니다');
    }
  };

  const handleCancelMigration = () => {
    setShowMigrationModal(false);
    if (session) {
      markMigrationPrompted(session.user.id);
    }
  };

  const handleRefreshConflict = async () => {
    setShowConflictModal(false);
    const updated = await loadState();
    if (updated) {
      setAppState(updated);
      showToast('최신 내용으로 새로고침되었습니다');
    }
  };

  const handleDismissConflict = () => {
    setShowConflictModal(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans py-6 px-3 sm:py-10 sm:px-4">
      <main className="max-w-[620px] mx-auto bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 sm:p-6 space-y-5">
        {/* Header Section */}
        <Header
          dateLabel={fullLabel(activeKey)}
          completedCount={completedCount}
          totalCount={totalCount}
          userEmail={session?.user?.email}
          syncStatus={syncStatus}
          onSignOut={handleSignOut}
        />

        {/* Fixed Schedule Block - Hidden in Month View */}
        {view.kind !== 'month' && (
          <ScheduleBlock
            schedule={appState.schedule}
            activeKey={activeKey}
            onAddSchedule={handleAddSchedule}
            onDeleteSchedule={handleDeleteSchedule}
            onOpenMonthView={() =>
              setView({ kind: 'month', anchor: activeKey || todayKey() })
            }
          />
        )}

        {/* Date Navigation (Week Strip / Month Calendar) */}
        <DateNav
          view={view}
          activeKey={activeKey}
          days={appState.days}
          schedule={appState.schedule}
          onChangeView={setView}
          onSelectDate={handleSelectDate}
        />

        {/* Todo List */}
        <TodoList
          todos={todos}
          isSelectMode={isSelectMode}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onToggle={handleToggle}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onAddMany={handleAddMany}
        />

        {/* Memo Block */}
        {!isSelectMode && (
          <MemoBlock
            memo={currentDay.memo}
            onChangeMemo={handleChangeMemo}
          />
        )}

        {/* Move Toolbar or Action Bar */}
        {isSelectMode ? (
          <MoveBar
            activeKey={activeKey}
            selectedCount={selectedIds.size}
            totalCount={todos.length}
            onToggleSelectAll={handleToggleSelectAll}
            onMoveToDate={handleMoveToDate}
            onCancel={handleCancelMoveMode}
          />
        ) : (
          <ActionBar
            onCopy={handleCopy}
            onStartMoveMode={handleStartMoveMode}
          />
        )}
      </main>

      {/* Migration Modal */}
      {showMigrationModal && (
        <MigrationModal
          onConfirm={handleConfirmMigration}
          onCancel={handleCancelMigration}
        />
      )}

      {/* Conflict Modal */}
      {showConflictModal && (
        <ConflictModal
          onRefresh={handleRefreshConflict}
          onDismiss={handleDismissConflict}
        />
      )}

      {/* Reusable Toast Notification */}
      <Toast message={toastMessage} onClose={hideToast} />
    </div>
  );
}
