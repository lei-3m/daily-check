import { useState, useEffect, useRef } from 'react';
import { Session } from '@supabase/supabase-js';
import { AppState, Todo } from './lib/types';
import { todayKey, fullLabel, weekdayLabel } from './lib/date';
import {
  loadState,
  saveState,
  clearUserCache,
  clearPendingSync,
  getPriorityIncludeMemoPreference,
  getScheduleCollapsedPreference,
  resolvePendingSync,
  saveImportedState,
  savePendingLocalState,
  saveStateSnapshot,
  setPriorityIncludeMemoPreference,
  setScheduleCollapsedPreference,
  normalizeDrawer,
  SyncStatus,
  subscribeSyncStatus,
  subscribeConflict,
  checkMigrationNeeded,
  markMigrationPrompted,
  uploadLocalToAccount,
} from './lib/storage';
import type { ConflictDetails } from './lib/storage';
import { supabase } from './lib/supabase';
import { formatTodosToMarkdown, copyToClipboard } from './lib/clipboard';
import { validateBackupState } from './lib/backup';
import { useThemePreference } from './lib/theme';
import {
  buildPriorityRequest,
  parsePrioritySuggestion,
  PRIORITY_FUNCTION_NAME,
  PrioritySuggestion,
} from './lib/priority';
import { Header } from './components/Header';
import { ScheduleBlock } from './components/ScheduleBlock';
import { DrawerBlock } from './components/DrawerBlock';
import { DateNav, View } from './components/DateNav';
import { TodoList } from './components/TodoList';
import { MemoBlock } from './components/MemoBlock';
import { ActionBar } from './components/ActionBar';
import { MoveBar } from './components/MoveBar';
import { Toast, useToast } from './components/Toast';
import { LoginScreen } from './components/LoginScreen';
import { MigrationModal } from './components/MigrationModal';
import { ConflictModal } from './components/ConflictModal';
import { PrioritySuggestionModal } from './components/PrioritySuggestionModal';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  const [appState, setAppState] = useState<AppState | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ type: 'synced' });
  const syncStatusRef = useRef<SyncStatus>({ type: 'synced' });
  const { themePreference, setThemePreference } = useThemePreference();

  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictDetails, setConflictDetails] = useState<ConflictDetails | null>(null);

  const [view, setView] = useState<View>(() => ({
    kind: 'week',
    anchor: todayKey(),
  }));
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [isScheduleCollapsed, setIsScheduleCollapsed] = useState(() =>
    getScheduleCollapsedPreference()
  );
  const [isScheduleExpanded, setIsScheduleExpanded] = useState(false);
  const [includeMemoInPriority, setIncludeMemoInPriorityState] = useState(() =>
    getPriorityIncludeMemoPreference()
  );
  const [isPrioritizing, setIsPrioritizing] = useState(false);
  const [prioritySuggestion, setPrioritySuggestion] = useState<PrioritySuggestion | null>(null);

  const { toast, showToast, hideToast } = useToast();

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
      syncStatusRef.current = status;
      setSyncStatus(status);
    });

    const unsubConflict = subscribeConflict((details) => {
      if (details.items.length === 0) return;
      setConflictDetails(details);
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
              todos: [],
              memo: '',
            },
          },
          schedule: [],
          drawer: normalizeDrawer(),
          active: today,
        };
        setAppState(initial);
      } else {
        const days = { ...(saved.days || {}) };
        const active = saved.active || today;

        setAppState({
          days,
          schedule: saved.schedule || [],
          drawer: normalizeDrawer(saved.drawer),
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

    if (syncStatusRef.current.type === 'conflict') {
      savePendingLocalState(appState, session.user.id);
      return;
    }

    const timer = setTimeout(() => {
      saveState(appState);
    }, 350);

    return () => clearTimeout(timer);
  }, [appState, isLoaded, session]);

  useEffect(() => {
    if (!session) return;

    const handleOnline = () => {
      resolvePendingSync(session.user.id).then((state) => {
        if (state) {
          setAppState(state);
        }
      });
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [session]);

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
  const drawers = normalizeDrawer(appState.drawer);

  const completedCount = todos.filter((t) => t.done).length;
  const totalCount = todos.length;

  const createTodo = (text: string): Todo => ({
    id:
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2, 9),
    text,
    done: false,
  });

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
    const newItems: Todo[] = texts.map(createTodo);
    updateCurrentDay([...todos, ...newItems]);
  };

  const updateDrawers = (
    updater: (current: ReturnType<typeof normalizeDrawer>) => ReturnType<typeof normalizeDrawer>
  ) => {
    setAppState((prev) => {
      if (!prev) return prev;
      const normalized = normalizeDrawer(prev.drawer);
      return {
        ...prev,
        drawer: updater(normalized),
      };
    });
  };

  const createId = () =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2, 9);

  const handleAddDrawer = (name: string) => {
    const newDrawer = {
      id: createId(),
      name: name.trim(),
      items: [],
    };
    updateDrawers((current) => [...current, newDrawer]);
  };

  const handleRenameDrawer = (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    updateDrawers((current) =>
      current.map((drawer) =>
        drawer.id === id ? { ...drawer, name: trimmed } : drawer
      )
    );
  };

  const handleDeleteDrawer = (id: string) => {
    const drawer = drawers.find((item) => item.id === id);
    if (!drawer) return;
    if (
      drawer.items.length > 0 &&
      !window.confirm('목록 안의 항목도 함께 삭제됩니다. 계속할까요?')
    ) {
      return;
    }

    updateDrawers((current) => current.filter((item) => item.id !== id));
    if (view.kind === 'drawerList' && view.id === id) {
      setView({ kind: 'drawer' });
    }
  };

  const handleAddDrawerItems = (drawerId: string, texts: string[]) => {
    const newItems = texts.map(createTodo);
    updateDrawers((current) =>
      current.map((drawer) =>
        drawer.id === drawerId
          ? { ...drawer, items: [...drawer.items, ...newItems] }
          : drawer
      )
    );
  };

  const handleToggleDrawerItem = (drawerId: string, itemId: string) => {
    updateDrawers((current) =>
      current.map((drawer) =>
        drawer.id === drawerId
          ? {
              ...drawer,
              items: drawer.items.map((item) =>
                item.id === itemId ? { ...item, done: !item.done } : item
              ),
            }
          : drawer
      )
    );
  };

  const handleEditDrawerItem = (drawerId: string, itemId: string, text: string) => {
    updateDrawers((current) =>
      current.map((drawer) =>
        drawer.id === drawerId
          ? {
              ...drawer,
              items: drawer.items.map((item) =>
                item.id === itemId ? { ...item, text } : item
              ),
            }
          : drawer
      )
    );
  };

  const handleDeleteDrawerItem = (drawerId: string, itemId: string) => {
    updateDrawers((current) =>
      current.map((drawer) =>
        drawer.id === drawerId
          ? {
              ...drawer,
              items: drawer.items.filter((item) => item.id !== itemId),
            }
          : drawer
      )
    );
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

  const handleEditSchedule = (id: string, newDate: string, newText: string) => {
    if (!newText.trim()) {
      handleDeleteSchedule(id);
      return;
    }
    setAppState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        schedule: prev.schedule.map((item) =>
          item.id === id
            ? { ...item, date: newDate, text: newText.trim() }
            : item
        ),
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
      showToast('복사됨');
    }
  };

  const handleIncludeMemoInPriorityChange = (includeMemo: boolean) => {
    setIncludeMemoInPriorityState(includeMemo);
    setPriorityIncludeMemoPreference(includeMemo);
  };

  const handlePrioritize = async () => {
    const incompleteTodos = todos.filter((todo) => !todo.done);
    if (incompleteTodos.length < 2) {
      showToast('정렬할 할 일이 부족해요');
      return;
    }

    setIsPrioritizing(true);
    try {
      const today = todayKey();
      const upcomingSchedule = (appState.schedule || [])
        .filter((item) => item.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date));
      const body = buildPriorityRequest(
        activeKey,
        weekdayLabel(activeKey),
        incompleteTodos,
        currentDay.memo || '',
        includeMemoInPriority,
        upcomingSchedule
      );

      const { data, error } = await supabase.functions.invoke(PRIORITY_FUNCTION_NAME, {
        body,
      });

      if (error) {
        throw error;
      }

      setPrioritySuggestion(parsePrioritySuggestion(data, incompleteTodos));
    } catch (error) {
      console.warn('Priority suggestion failed:', error);
      showToast('우선순위 제안을 가져오지 못했어요');
    } finally {
      setIsPrioritizing(false);
    }
  };

  const handleApplyPrioritySuggestion = () => {
    if (!prioritySuggestion) return;

    const suggestedTodosById = new Map(
      prioritySuggestion.items
        .map((item) => todos.find((todo) => todo.id === item.id))
        .filter((todo): todo is Todo => Boolean(todo))
        .map((todo) => [todo.id, todo])
    );
    const reorderedIncomplete = prioritySuggestion.items
      .map((item) => suggestedTodosById.get(item.id))
      .filter((todo): todo is Todo => Boolean(todo));

    if (reorderedIncomplete.length !== todos.filter((todo) => !todo.done).length) {
      showToast('우선순위 적용에 실패했어요');
      return;
    }

    let nextIncompleteIndex = 0;
    const nextTodos = todos.map((todo) => {
      if (todo.done) return todo;
      return reorderedIncomplete[nextIncompleteIndex++] || todo;
    });

    updateCurrentDay(nextTodos);
    setPrioritySuggestion(null);
    showToast('우선순위를 적용했어요');
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

  const handleExportData = () => {
    if (!appState) return;

    const blob = new Blob([JSON.stringify(appState, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `daily-check-${todayKey()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast('데이터를 내보냈습니다');
  };

  const handleImportData = async (file: File) => {
    if (!appState || !session) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      showToast('가져오기 실패: JSON 파일이 아닙니다');
      return;
    }

    const validation = validateBackupState(parsed);
    if (validation.ok === false) {
      showToast(`가져오기 실패: ${validation.message}`);
      return;
    }

    if (!window.confirm('현재 데이터를 덮어씁니다. 계속할까요?')) {
      return;
    }

    const importedState = {
      ...validation.state,
      drawer: normalizeDrawer(validation.state.drawer),
    };

    saveStateSnapshot(appState);
    setAppState(importedState);
    setView({ kind: 'week', anchor: importedState.active || todayKey() });
    setIsSelectMode(false);
    setSelectedIds(new Set());

    const saved = await saveImportedState(session.user.id, importedState);
    showToast(saved ? '데이터를 가져왔습니다' : '가져왔지만 서버 저장은 대기 중입니다');
  };

  const handleRefreshConflict = async () => {
    setShowConflictModal(false);
    setConflictDetails(null);
    clearPendingSync(session?.user.id);
    const updated = await loadState();
    if (updated) {
      setAppState(updated);
      showToast('최신 내용으로 새로고침되었습니다');
    }
  };

  const handleDismissConflict = () => {
    setShowConflictModal(false);
    setConflictDetails(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans app-container sm:py-10 sm:px-4">
      <main className="max-w-[620px] mx-auto bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 sm:p-6 space-y-5">
        {/* Header Section */}
        <Header
          dateLabel={fullLabel(activeKey)}
          completedCount={completedCount}
          totalCount={totalCount}
          userEmail={session?.user?.email}
          syncStatus={syncStatus}
          onSignOut={handleSignOut}
          themePreference={themePreference}
          onThemePreferenceChange={setThemePreference}
          onExportData={handleExportData}
          onImportData={handleImportData}
          includeMemoInPriority={includeMemoInPriority}
          onIncludeMemoInPriorityChange={handleIncludeMemoInPriorityChange}
        />

        {/* Fixed Schedule Block - Hidden in Month View */}
        {view.kind !== 'month' && (
          <ScheduleBlock
            schedule={appState.schedule}
            activeKey={activeKey}
            onAddSchedule={handleAddSchedule}
            onEditSchedule={handleEditSchedule}
            onDeleteSchedule={handleDeleteSchedule}
            isCollapsed={isScheduleCollapsed}
            onToggleCollapsed={() =>
              setIsScheduleCollapsed((prev) => {
                const next = !prev;
                setScheduleCollapsedPreference(next);
                return next;
              })
            }
            isExpanded={isScheduleExpanded}
            onToggleExpanded={() => setIsScheduleExpanded((prev) => !prev)}
            onOpenMonthView={() =>
              setView({ kind: 'month', anchor: activeKey || todayKey() })
            }
          />
        )}

        {view.kind !== 'month' && (
          <DrawerBlock
            drawers={drawers}
            mode={
              view.kind === 'drawer'
                ? 'documents'
                : view.kind === 'drawerList'
                ? 'list'
                : 'collapsed'
            }
            activeDrawerId={view.kind === 'drawerList' ? view.id : undefined}
            onOpenDrawer={() => {
              setIsSelectMode(false);
              setSelectedIds(new Set());
              setView({ kind: 'drawer' });
            }}
            onCloseDrawer={() => setView({ kind: 'week', anchor: activeKey })}
            onOpenList={(id) => setView({ kind: 'drawerList', id })}
            onBackToDocuments={() => setView({ kind: 'drawer' })}
            onAddDrawer={handleAddDrawer}
            onRenameDrawer={handleRenameDrawer}
            onDeleteDrawer={handleDeleteDrawer}
            onAddItems={handleAddDrawerItems}
            onToggleItem={handleToggleDrawerItem}
            onEditItem={handleEditDrawerItem}
            onDeleteItem={handleDeleteDrawerItem}
          />
        )}

        {/* Date Navigation (Week Strip / Month Calendar) */}
        {(view.kind === 'week' || view.kind === 'month') && (
          <DateNav
            view={view}
            activeKey={activeKey}
            days={appState.days}
            schedule={appState.schedule}
            onChangeView={setView}
            onSelectDate={handleSelectDate}
          />
        )}

        {/* Todo List & Memo (Hidden in Month View) */}
        {view.kind === 'week' && (
          <>
            <TodoList
              todos={todos}
              isSelectMode={isSelectMode}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onToggle={handleToggle}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onAddMany={handleAddMany}
              onReorderTodos={(newTodos) => updateCurrentDay(newTodos)}
            />

            {!isSelectMode && (
              <MemoBlock
                memo={currentDay.memo}
                onChangeMemo={handleChangeMemo}
              />
            )}
          </>
        )}

        {view.kind === 'week' && (
          isSelectMode ? (
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
              onPrioritize={handlePrioritize}
              isPrioritizing={isPrioritizing}
            />
          )
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
          details={conflictDetails}
          onRefresh={handleRefreshConflict}
          onDismiss={handleDismissConflict}
        />
      )}

      {prioritySuggestion && (
        <PrioritySuggestionModal
          suggestion={prioritySuggestion}
          onApply={handleApplyPrioritySuggestion}
          onCancel={() => setPrioritySuggestion(null)}
        />
      )}

      {/* Reusable Toast Notification */}
      <Toast toast={toast} onClose={hideToast} />
    </div>
  );
}
