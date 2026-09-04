import { useState, useEffect, useRef } from 'react';
import { Session } from '@supabase/supabase-js';
import { AppState, Routine, ScheduleItem, Todo } from './lib/types';
import { addDays, todayKey, fullLabel, weekdayLabel } from './lib/date';
import {
  loadState,
  saveState,
  clearUserCache,
  clearSupabaseAuthTokens,
  clearPendingSync,
  hasPendingSync,
  getPriorityIncludeMemoPreference,
  getScheduleCollapsedPreference,
  getSessionView,
  setSessionView,
  dismissYesterdayCarryover,
  isYesterdayCarryoverDismissed,
  reapplyLocalChanges,
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
  pullRealtimeServerState,
} from './lib/storage';
import type { ConflictDetails } from './lib/storage';
import { supabase } from './lib/supabase';
import { NETWORK_TIMEOUT_MS, withTimeout } from './lib/async';
import { formatTodosToMarkdown, copyToClipboard } from './lib/clipboard';
import { validateBackupState } from './lib/backup';
import { AccentPreference, useThemePreference } from './lib/theme';
import {
  buildPriorityRequest,
  parsePrioritySuggestion,
  PriorityResponseError,
  PrioritySuggestion,
} from './lib/priority';
import { expandScheduleInRange } from './lib/schedule';
import { normalizeRoutines } from './lib/routine';
import {
  DisplayTodo,
  isRoutineTodoId,
  mergeRoutineTodos,
  pruneTodoOrder,
  routineIdFromTodoId,
  routineTodosFor,
  stripRoutineTodos,
  toggleRoutineDone,
} from './lib/routineTodos';
import {
  appendIncompleteTodos,
  normalizeTodoOrder,
  toggleTodoDoneAndMove,
} from './lib/todoOrder';
import { Header } from './components/Header';
import type { AccountProfile, AccountProfileUpdate } from './components/Header';
import { ScheduleBlock } from './components/ScheduleBlock';
import { ScheduleEditView } from './components/ScheduleEditView';
import { RoutineListView } from './components/RoutineListView';
import { RoutineEditView } from './components/RoutineEditView';
import { DrawerBlock } from './components/DrawerBlock';
import { DateNav, View } from './components/DateNav';
import { TodoList } from './components/TodoList';
import { YesterdayCarryover } from './components/YesterdayCarryover';
import { MemoBlock } from './components/MemoBlock';
import { ActionBar } from './components/ActionBar';
import { MoveBar } from './components/MoveBar';
import { Toast, useToast } from './components/Toast';
import { UpdateToast } from './components/UpdateToast';
import { InstallBanner } from './components/InstallBanner';
import { useServiceWorkerUpdate } from './lib/swUpdate';
import { useInstallBanner } from './lib/installPrompt';
import { LoginScreen } from './components/LoginScreen';
import { MigrationModal } from './components/MigrationModal';
import { ConflictModal } from './components/ConflictModal';
import { SignOutWarningModal } from './components/SignOutWarningModal';
import { PrioritySuggestionModal } from './components/PrioritySuggestionModal';

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="loading-checks" role="status" aria-live="polite">
        <div className="loading-checks-list" aria-hidden="true">
          <span className="loading-check" />
          <span className="loading-check" />
          <span className="loading-check" />
        </div>
        <div className="text-slate-400 text-sm font-medium">불러오는 중</div>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  const [appState, setAppState] = useState<AppState | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ type: 'synced' });
  const syncStatusRef = useRef<SyncStatus>({ type: 'synced' });
  const appStateRef = useRef<AppState | null>(null);
  const hasUnsavedLocalChangesRef = useRef(false);
  const pendingRealtimeUpdateRef = useRef(false);
  const suppressNextSaveRef = useRef(false);
  const {
    themePreference,
    setThemePreference,
    accentPreference,
    setAccentPreference,
  } = useThemePreference();
  const initialAccentPreferenceRef = useRef(accentPreference);

  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictDetails, setConflictDetails] = useState<ConflictDetails | null>(null);
  const [showSignOutWarning, setShowSignOutWarning] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  // disabled는 리렌더 뒤에야 적용되므로 같은 틱의 연타는 ref로 막습니다.
  const signOutInFlightRef = useRef(false);
  // 로그아웃했다는 표시. 로그인은 OAuth 리디렉트로 페이지가 새로 뜨므로
  // 이 페이지가 사는 동안 다시 false가 될 일은 없습니다.
  const signedOutRef = useRef(false);
  const authEventSeenRef = useRef(false);

  const [view, setView] = useState<View>(() => ({
    kind: 'week',
    anchor: todayKey(),
  }));
  const viewRef = useRef<View>(view);
  const didRestoreViewRef = useRef(false);
  const activeKeyRef = useRef(todayKey());
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
  const [dismissedYesterdayCarryoverDate, setDismissedYesterdayCarryoverDate] = useState<
    string | null
  >(() => {
    const today = todayKey();
    return isYesterdayCarryoverDismissed(today) ? today : null;
  });

  const { toast, showToast, hideToast } = useToast();
  const { isUpdateReady, applyUpdate } = useServiceWorkerUpdate();
  const { bannerMode: installBannerMode, installMode, dismiss: dismissInstallBanner, promptInstall } =
    useInstallBanner();

  const getMetadataString = (key: string): string => {
    const value = session?.user.user_metadata?.[key];
    return typeof value === 'string' ? value.trim() : '';
  };

  const googleName =
    getMetadataString('full_name') ||
    getMetadataString('name') ||
    getMetadataString('user_name');
  const profile: AccountProfile = {
    displayName:
      getMetadataString('display_name') ||
      googleName ||
      session?.user.email ||
      '',
    googleName,
    email: session?.user.email,
    avatarEmoji: getMetadataString('avatar_emoji') || null,
    avatarUrl:
      getMetadataString('avatar_url') ||
      getMetadataString('picture') ||
      null,
  };

  const getViewFromHistoryState = (state: unknown): View | null => {
    if (!state || typeof state !== 'object') return null;
    const value = state as {
      view?: unknown;
      anchor?: unknown;
      id?: unknown;
      returnMonthAnchor?: unknown;
    };
    if (value.view === 'drawer') return { kind: 'drawer' };
    if (value.view === 'drawerList' && typeof value.id === 'string') {
      return { kind: 'drawerList', id: value.id };
    }
    if (value.view === 'scheduleEdit') {
      return {
        kind: 'scheduleEdit',
        id: typeof value.id === 'string' ? value.id : null,
        returnMonthAnchor:
          typeof value.returnMonthAnchor === 'string' ? value.returnMonthAnchor : undefined,
      };
    }
    if (value.view === 'routineList') return { kind: 'routineList' };
    if (value.view === 'routineEdit') {
      return {
        kind: 'routineEdit',
        id: typeof value.id === 'string' ? value.id : null,
      };
    }
    if (value.view === 'month' && typeof value.anchor === 'string') {
      return { kind: 'month', anchor: value.anchor };
    }
    if (value.view === 'week' && typeof value.anchor === 'string') {
      return { kind: 'week', anchor: value.anchor };
    }
    return null;
  };

  /**
   * 복원해도 되는 화면인지 판단합니다.
   * id가 필요한 화면은 그 id가 아직 있어야 합니다. 삭제된 목록을 복원하면 빈 화면이 됩니다.
   */
  const resolveRestorableView = (candidate: View): View | null => {
    const state = appStateRef.current;
    if (!state) return null;

    if (candidate.kind === 'drawerList') {
      const exists = normalizeDrawer(state.drawer).some((list) => list.id === candidate.id);
      return exists ? candidate : { kind: 'drawer' };
    }

    if (candidate.kind === 'routineEdit') {
      // id가 없으면 새 루틴을 쓰던 중이다. 입력하던 내용은 새로고침으로
      // 이미 사라졌으므로 빈 편집 화면을 다시 열지 않는다.
      if (!candidate.id) return null;
      const exists = normalizeRoutines(state.routines).some(
        (routine) => routine.id === candidate.id
      );
      return exists ? candidate : null;
    }

    if (candidate.kind === 'scheduleEdit') {
      // id가 없으면 새 일정 작성 중이었다는 뜻이다. 입력하던 내용은 새로고침으로
      // 이미 사라졌으므로 빈 편집 화면을 다시 열지 않는다.
      if (!candidate.id) return null;
      const exists = state.schedule.some((item) => item.id === candidate.id);
      return exists ? candidate : null;
    }

    return candidate;
  };

  const getHistoryStateForView = (nextView: View) => {
    if (nextView.kind === 'drawer') return { view: 'drawer' };
    if (nextView.kind === 'drawerList') return { view: 'drawerList', id: nextView.id };
    if (nextView.kind === 'routineList') return { view: 'routineList' };
    if (nextView.kind === 'routineEdit') {
      return { view: 'routineEdit', id: nextView.id };
    }
    if (nextView.kind === 'scheduleEdit') {
      return {
        view: 'scheduleEdit',
        id: nextView.id,
        returnMonthAnchor: nextView.returnMonthAnchor,
      };
    }
    return { view: nextView.kind, anchor: nextView.anchor };
  };

  const finalizeUntitledDrawer = (id: string) => {
    setAppState((prev) => {
      if (!prev) return prev;
      const normalized = normalizeDrawer(prev.drawer);
      const drawer = normalized.find((item) => item.id === id);
      if (!drawer || drawer.name.trim()) return prev;
      if (drawer.items.length > 0) {
        return {
          ...prev,
          drawer: normalized.map((item) =>
            item.id === id ? { ...item, name: '목록 이름' } : item
          ),
        };
      }
      return {
        ...prev,
        drawer: normalized.filter((item) => item.id !== id),
      };
    });
  };

  // 1. Session Auth listener
  useEffect(() => {
    let isDisposed = false;

    const applySession = (nextSession: Session | null) => {
      if (isDisposed) return;
      // 로그아웃을 시작한 뒤 도착하는 세션은 받지 않습니다. signOut 시점에
      // 이미 진행 중이던 토큰 갱신이 뒤늦게 끝나면 세션이 되살아납니다.
      if (signedOutRef.current && nextSession) return;

      setSession(nextSession);
      setAuthChecking(false);
      if (!nextSession) {
        clearUserCache();
        setAppState(null);
        setIsLoaded(false);
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      authEventSeenRef.current = true;
      applySession(newSession);
    });

    supabase.auth.getSession().then(({ data }) => {
      // 이미 인증 이벤트를 처리했다면 먼저 뜬 결과로 덮지 않습니다.
      if (authEventSeenRef.current) {
        setAuthChecking(false);
        return;
      }
      applySession(data.session);
    });

    return () => {
      isDisposed = true;
      authListener.subscription.unsubscribe();
    };
  }, []);

  // 2. Sync status & Conflict listeners
  useEffect(() => {
    const unsubStatus = subscribeSyncStatus((status) => {
      syncStatusRef.current = status;
      if (status.type === 'synced' || status.type === 'local_only') {
        hasUnsavedLocalChangesRef.current = false;
      }
      setSyncStatus(status);
    });

    const unsubConflict = subscribeConflict((details) => {
      if (details.items.length === 0 && details.otherItems.length === 0) return;
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
          routines: [],
          drawer: normalizeDrawer(),
          active: today,
          accentColor: initialAccentPreferenceRef.current,
        };
        setAppState(initial);
      } else {
        const days = { ...(saved.days || {}) };
        const active = saved.active || today;
        const accentColor = saved.accentColor || initialAccentPreferenceRef.current;

        setAppState({
          days,
          schedule: saved.schedule || [],
          routines: normalizeRoutines(saved.routines),
          drawer: normalizeDrawer(saved.drawer),
          active,
          accentColor,
        });
        setAccentPreference(accentColor);
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
  }, [session, authChecking, setAccentPreference]);

  /**
   * 동기화 결과를 화면에 적용합니다.
   *
   * 서버를 다녀오는 동안 사용자가 항목을 지우면, 작업을 시작할 때 붙잡은
   * 스냅샷에는 그 삭제가 없습니다. 결과를 그대로 setAppState하면 지운 항목이
   * 되살아납니다. 그 사이 변경이 있었으면 3-way 병합으로 되살립니다.
   *
   * 반환값은 되살린 로컬 변경이 있었는지 여부입니다.
   */
  const applySyncedState = (baseState: AppState | null, incoming: AppState): boolean => {
    const latest = appStateRef.current;
    const hasLocalEdits = Boolean(baseState && latest && latest !== baseState);
    const next =
      hasLocalEdits && baseState && latest
        ? reapplyLocalChanges(baseState, latest, incoming)
        : incoming;

    // 되살린 변경은 아직 서버에 없습니다. 저장을 막으면 그대로 사라집니다.
    suppressNextSaveRef.current = !hasLocalEdits;
    setAppState(next);
    setAccentPreference(next.accentColor || 'default');
    return hasLocalEdits;
  };

  // 4. Auto save state with debounce
  useEffect(() => {
    if (!isLoaded || !appState || !session) return;

    if (suppressNextSaveRef.current) {
      suppressNextSaveRef.current = false;
      hasUnsavedLocalChangesRef.current = false;
      return;
    }

    hasUnsavedLocalChangesRef.current = true;

    if (syncStatusRef.current.type === 'conflict') {
      savePendingLocalState(appState, session.user.id);
      return;
    }

    const timer = setTimeout(() => {
      saveState(appState).then((mergedState) => {
        if (!mergedState) return;
        applySyncedState(appState, mergedState);
      });
    }, 350);

    return () => clearTimeout(timer);
  }, [appState, isLoaded, session]);

  useEffect(() => {
    if (!session) return;

    const handleOnline = () => {
      // 자동 업로드를 기다리는 사이의 변경을 잃지 않도록 시작 시점을 기억합니다.
      const baseState = appStateRef.current;
      resolvePendingSync(session.user.id).then((state) => {
        if (!state) return;
        applySyncedState(baseState, state);
      });
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [session]);

  useEffect(() => {
    if (!session || !isLoaded) return;

    let isDisposed = false;
    let isPulling = false;

    const isTextInputFocused = () => {
      const activeElement = document.activeElement;
      if (!activeElement) return false;
      if (activeElement instanceof HTMLInputElement) return true;
      if (activeElement instanceof HTMLTextAreaElement) return true;
      if (activeElement instanceof HTMLSelectElement) return true;
      return activeElement instanceof HTMLElement && activeElement.isContentEditable;
    };

    const pullRemoteChange = async () => {
      if (isDisposed || isPulling) return;
      const currentState = appStateRef.current;
      if (!currentState) return;

      isPulling = true;
      try {
        const result = await pullRealtimeServerState(
          session.user.id,
          currentState,
          hasUnsavedLocalChangesRef.current
        );
        if (isDisposed) return;

        if (result.type === 'applied') {
          // 되살린 변경이 있으면 아직 서버에 없으므로 미저장 표시를 유지합니다.
          hasUnsavedLocalChangesRef.current = applySyncedState(currentState, result.state);
        } else if (result.type === 'conflict') {
          applySyncedState(currentState, result.state);
          setConflictDetails(result.details);
          setShowConflictModal(true);
        }
      } finally {
        isPulling = false;
      }
    };

    const handleRemoteChange = () => {
      if (isTextInputFocused()) {
        pendingRealtimeUpdateRef.current = true;
        return;
      }
      void pullRemoteChange();
    };

    const handleFocusOut = () => {
      window.setTimeout(() => {
        if (isDisposed || isTextInputFocused() || !pendingRealtimeUpdateRef.current) return;
        pendingRealtimeUpdateRef.current = false;
        void pullRemoteChange();
      }, 0);
    };

    const channel = supabase
      .channel(`user-state:${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_state',
          filter: `user_id=eq.${session.user.id}`,
        },
        handleRemoteChange
      )
      .subscribe();

    document.addEventListener('focusout', handleFocusOut);

    return () => {
      isDisposed = true;
      pendingRealtimeUpdateRef.current = false;
      document.removeEventListener('focusout', handleFocusOut);
      void supabase.removeChannel(channel);
    };
  }, [session, isLoaded, setAccentPreference]);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    activeKeyRef.current = appState?.active || todayKey();
  }, [appState?.active]);

  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

  // 새로고침해도 보고 있던 화면으로 돌아온다. 당겨서 새로고침이 잦은 폰에서
  // 서랍을 보다가 주간 뷰로 튕기면 하던 일을 잃는다.
  //
  // 히스토리는 주간 뷰부터 다시 쌓는다. 새로고침 직후에는 항목이 하나뿐이라
  // 그대로 복원하면 뒤로가기가 앱을 나가버린다.
  useEffect(() => {
    if (!isLoaded || didRestoreViewRef.current) return;
    didRestoreViewRef.current = true;

    const weekView: View = { kind: 'week', anchor: activeKeyRef.current };
    window.history.replaceState(getHistoryStateForView(weekView), '');

    const restored = getViewFromHistoryState(getSessionView());
    if (!restored) return;

    const target = resolveRestorableView(restored);
    if (!target || target.kind === 'week') return;

    // 서랍 체크리스트는 목록 일람을 거쳐 들어간다. 뒤로가기 순서도 그대로 둔다.
    if (target.kind === 'drawerList') {
      window.history.pushState(getHistoryStateForView({ kind: 'drawer' }), '');
    }
    window.history.pushState(getHistoryStateForView(target), '');
    setView(target);
  }, [isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    setSessionView(getHistoryStateForView(view));
  }, [isLoaded, view]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const currentView = viewRef.current;
      if (currentView.kind === 'drawerList') {
        finalizeUntitledDrawer(currentView.id);
      }

      const nextView = getViewFromHistoryState(event.state) || {
        kind: 'week',
        anchor: activeKeyRef.current,
      };
      setView(nextView);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (authChecking) {
    return <LoadingScreen />;
  }

  if (!session) {
    return <LoginScreen />;
  }

  if (!isLoaded || !appState) {
    return <LoadingScreen />;
  }

  const activeKey = appState.active;
  const today = todayKey();
  const yesterdayKey = addDays(today, -1);
  const currentDay = appState.days[activeKey] || { todos: [], memo: '' };
  const todos = normalizeTodoOrder(currentDay.todos || []);
  const routines = normalizeRoutines(appState.routines);
  // 루틴은 저장된 할 일이 아니라 여기서 계산해 목록에 얹는다.
  const routineTodos = routineTodosFor(routines, activeKey);
  const displayTodos = normalizeTodoOrder(
    mergeRoutineTodos(todos, routineTodos, currentDay.todoOrder)
  );
  const yesterdayIncompleteTodos = (appState.days[yesterdayKey]?.todos || []).filter(
    (todo) => !todo.done
  );
  const shouldShowYesterdayCarryover =
    view.kind === 'week' &&
    activeKey === today &&
    yesterdayIncompleteTodos.length > 0 &&
    dismissedYesterdayCarryoverDate !== today &&
    !isYesterdayCarryoverDismissed(today);
  const drawerLists = normalizeDrawer(appState.drawer).map((list) => ({
    ...list,
    items: normalizeTodoOrder(list.items),
  }));
  const editingSchedule =
    view.kind === 'scheduleEdit' && view.id
      ? appState.schedule.find((item) => item.id === view.id)
      : undefined;

  const editingRoutine =
    view.kind === 'routineEdit' && view.id
      ? routines.find((routine) => routine.id === view.id)
      : undefined;

  const completedCount = displayTodos.filter((t) => t.done).length;
  const totalCount = displayTodos.length;

  const createTodo = (text: string): Todo => ({
    id:
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2, 9),
    text,
    done: false,
  });

  const updateCurrentDay = (newTodos: Todo[], newMemo?: string, newOrder?: string[]) => {
    setAppState((prev) => {
      if (!prev) return prev;
      const orderedTodos = normalizeTodoOrder(newTodos);
      const memoValue =
        newMemo !== undefined ? newMemo : prev.days[activeKey]?.memo || '';
      const newDays = { ...prev.days };
      const todoOrder = pruneTodoOrder(
        newOrder !== undefined ? newOrder : prev.days[activeKey]?.todoOrder,
        [...orderedTodos, ...routineTodos]
      );

      // 루틴만 있는 날은 저장할 할 일이 없다. 그래도 서로의 순서는 남긴다.
      if (
        orderedTodos.length === 0 &&
        (!memoValue || memoValue.trim() === '') &&
        todoOrder.length < 2
      ) {
        delete newDays[activeKey];
      } else {
        newDays[activeKey] = {
          todos: orderedTodos,
          memo: memoValue,
          ...(todoOrder.length > 0 ? { todoOrder } : {}),
        };
      }

      return {
        ...prev,
        days: newDays,
      };
    });
  };

  const handleToggle = (id: string) => {
    const routineId = routineIdFromTodoId(id);
    if (routineId) {
      // 그 날짜의 완료 여부만 바꾼다. 다른 날짜는 그대로다.
      setAppState((prev) =>
        prev
          ? { ...prev, routines: toggleRoutineDone(prev.routines, routineId, activeKey) }
          : prev
      );
      return;
    }
    updateCurrentDay(toggleTodoDoneAndMove(todos, id));
  };

  // 루틴의 내용과 삭제는 루틴 편집 화면에서만 다룬다.
  // 여기서 고치면 그 루틴이 나타나는 다른 날짜까지 바뀐다.
  const handleEdit = (id: string, newText: string) => {
    if (isRoutineTodoId(id)) return;
    updateCurrentDay(
      todos.map((todo) =>
        todo.id === id ? { ...todo, text: newText } : todo
      )
    );
  };

  const handleDelete = (id: string) => {
    if (isRoutineTodoId(id)) return;
    updateCurrentDay(todos.filter((todo) => todo.id !== id));
  };

  const handleReorderTodos = (newTodos: DisplayTodo[]) => {
    updateCurrentDay(
      stripRoutineTodos(newTodos),
      undefined,
      newTodos.map((todo) => todo.id)
    );
  };

  const handleAddMany = (texts: string[]) => {
    const newItems: Todo[] = texts.map(createTodo);
    updateCurrentDay(appendIncompleteTodos(todos, newItems));
  };

  const updateDrawers = (
    updater: (current: ReturnType<typeof normalizeDrawer>) => ReturnType<typeof normalizeDrawer>
  ) => {
    setAppState((prev) => {
      if (!prev) return prev;
      const normalized = normalizeDrawer(prev.drawer).map((list) => ({
        ...list,
        items: normalizeTodoOrder(list.items),
      }));
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

  const pushView = (nextView: View) => {
    window.history.pushState(getHistoryStateForView(nextView), '');
    setView(nextView);
  };

  const handleOpenDrawer = () => {
    setIsSelectMode(false);
    setSelectedIds(new Set());
    pushView({ kind: 'drawer' });
  };

  const handleOpenDrawerList = (id: string) => {
    pushView({ kind: 'drawerList', id });
  };

  const handleBackToDrawerLists = () => {
    if (viewRef.current.kind === 'drawerList') {
      finalizeUntitledDrawer(viewRef.current.id);
    }
    window.history.back();
  };

  const handleCloseDrawer = () => {
    window.history.back();
  };

  const handleCreateDrawer = () => {
    const newList = {
      id: createId(),
      name: '',
      items: [],
    };
    updateDrawers((current) => [...current, newList]);
    pushView({ kind: 'drawerList', id: newList.id });
  };

  const handleChangeView = (nextView: View) => {
    const currentView = viewRef.current;
    if (currentView.kind !== 'month' && nextView.kind === 'month') {
      pushView(nextView);
      return;
    }
    if (currentView.kind === 'month' && nextView.kind === 'month') {
      window.history.replaceState(getHistoryStateForView(nextView), '');
      setView(nextView);
      return;
    }
    if (currentView.kind === 'month' && nextView.kind === 'week') {
      window.history.back();
      if (nextView.anchor !== activeKeyRef.current) {
        window.setTimeout(() => setView(nextView), 0);
      }
      return;
    }
    setView(nextView);
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
    const list = drawerLists.find((item) => item.id === id);
    if (!list) return;
    if (
      list.items.length > 0 &&
      !window.confirm('목록 안의 할 일도 함께 삭제됩니다. 계속할까요?')
    ) {
      return;
    }

    updateDrawers((current) => current.filter((item) => item.id !== id));
    if (view.kind === 'drawerList' && view.id === id) {
      setView({ kind: 'drawer' });
    }
  };

  const handleAddDrawerTodos = (listId: string, texts: string[]) => {
    const newItems = texts.map(createTodo);
    updateDrawers((current) =>
      current.map((drawer) =>
        drawer.id === listId
          ? { ...drawer, items: appendIncompleteTodos(drawer.items, newItems) }
          : drawer
      )
    );
  };

  const handleToggleDrawerTodo = (listId: string, todoId: string) => {
    updateDrawers((current) =>
      current.map((drawer) =>
        drawer.id === listId
          ? {
              ...drawer,
              items: toggleTodoDoneAndMove(drawer.items, todoId),
            }
          : drawer
      )
    );
  };

  // 순서만 바꾼다. 목록을 새로 만들거나 지우지 않는다.
  // 드래그 도중 다른 기기에서 목록이 추가되면 그 목록은 뒤에 남는다.
  const handleReorderDrawers = (orderedIds: string[]) => {
    updateDrawers((current) => {
      const byId = new Map(current.map((list) => [list.id, list]));
      const reordered = orderedIds
        .map((id) => byId.get(id))
        .filter((list): list is (typeof current)[number] => Boolean(list));
      const rest = current.filter((list) => !orderedIds.includes(list.id));
      return [...reordered, ...rest];
    });
  };

  const handleReorderDrawerTodos = (listId: string, items: Todo[]) => {
    updateDrawers((current) =>
      current.map((drawer) =>
        drawer.id === listId ? { ...drawer, items } : drawer
      )
    );
  };

  const handleEditDrawerTodo = (listId: string, todoId: string, text: string) => {
    updateDrawers((current) =>
      current.map((drawer) =>
        drawer.id === listId
          ? {
              ...drawer,
              items: drawer.items.map((item) =>
                item.id === todoId ? { ...item, text } : item
              ),
            }
          : drawer
      )
    );
  };

  const handleDeleteDrawerTodo = (listId: string, todoId: string) => {
    updateDrawers((current) =>
      current.map((drawer) =>
        drawer.id === listId
          ? {
              ...drawer,
              items: drawer.items.filter((item) => item.id !== todoId),
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

  const handleSwipeTodoDate = (direction: -1 | 1) => {
    const targetKey = addDays(activeKeyRef.current, direction);
    handleSelectDate(targetKey);
    setView({ kind: 'week', anchor: targetKey });
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
          ...newDays[activeKey],
          todos: remainingTodos,
          memo: sourceMemo,
        };
      }

      // Update target day
      const targetDay = newDays[targetDateKey] || { todos: [], memo: '' };
      newDays[targetDateKey] = {
        ...targetDay,
        todos: normalizeTodoOrder([...(targetDay.todos || []), ...movingTodos]),
      };

      return {
        ...prev,
        days: newDays,
        active: targetDateKey,
      };
    });

    setIsSelectMode(false);
    setSelectedIds(new Set());
    showToast(`선택한 할 일 ${movingTodos.length}개를 옮겼어요`);
  };

  const handleDismissYesterdayCarryover = () => {
    dismissYesterdayCarryover(today);
    setDismissedYesterdayCarryoverDate(today);
  };

  const handleImportYesterdayTodos = (ids: string[]) => {
    if (ids.length === 0) return;

    setAppState((prev) => {
      if (!prev) return prev;
      const sourceDay = prev.days[yesterdayKey];
      if (!sourceDay) return prev;

      const selectedIds = new Set(ids);
      const movingTodos = (sourceDay.todos || []).filter(
        (todo) => selectedIds.has(todo.id) && !todo.done
      );
      if (movingTodos.length === 0) return prev;

      const remainingYesterdayTodos = (sourceDay.todos || []).filter(
        (todo) => !selectedIds.has(todo.id)
      );
      const todayDay = prev.days[today] || { todos: [], memo: '' };
      const nextDays = { ...prev.days };

      if (
        remainingYesterdayTodos.length === 0 &&
        (!sourceDay.memo || sourceDay.memo.trim() === '')
      ) {
        delete nextDays[yesterdayKey];
      } else {
        nextDays[yesterdayKey] = {
          ...sourceDay,
          todos: normalizeTodoOrder(remainingYesterdayTodos),
        };
      }

      nextDays[today] = {
        ...todayDay,
        todos: appendIncompleteTodos(todayDay.todos || [], movingTodos),
      };

      return {
        ...prev,
        days: nextDays,
        active: today,
      };
    });
  };

  const handleAddSchedule = (
    date: string,
    text: string,
    repeat?: ScheduleItem['repeat']
  ) => {
    const newItem = {
      id:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).substring(2, 9),
      date,
      text,
      ...(repeat ? { repeat } : {}),
    };
    setAppState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        schedule: [...prev.schedule, newItem],
      };
    });
  };

  const handleEditSchedule = (
    id: string,
    newDate: string,
    newText: string,
    repeat?: ScheduleItem['repeat'],
    repeatUntil?: string
  ) => {
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
            ? {
                ...item,
                date: newDate,
                text: newText.trim(),
                repeat,
                repeatUntil: repeat ? repeatUntil : undefined,
              }
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

  const openScheduleEdit = (id: string | null) => {
    const currentView = viewRef.current;
    pushView({
      kind: 'scheduleEdit',
      id,
      returnMonthAnchor: currentView.kind === 'month' ? currentView.anchor : undefined,
    });
  };

  const closeScheduleEdit = () => {
    window.history.back();
  };

  const handleSaveScheduleFromEdit = (
    id: string | null,
    date: string,
    text: string,
    repeat?: ScheduleItem['repeat'],
    repeatUntil?: string
  ) => {
    if (id) {
      handleEditSchedule(id, date, text, repeat, repeatUntil);
    } else {
      handleAddSchedule(date, text, repeat);
    }
    const currentView = viewRef.current;
    if (currentView.kind === 'scheduleEdit' && currentView.returnMonthAnchor) {
      const targetView: View = { kind: 'month', anchor: `${date.slice(0, 7)}-01` };
      window.history.replaceState(getHistoryStateForView(targetView), '');
      setView(targetView);
    } else {
      window.history.back();
    }
  };

  const openRoutineList = () => {
    pushView({ kind: 'routineList' });
  };

  const closeRoutineList = () => {
    window.history.back();
  };

  const openRoutineEdit = (id: string | null) => {
    pushView({ kind: 'routineEdit', id });
  };

  const closeRoutineEdit = () => {
    window.history.back();
  };

  const handleSaveRoutine = (
    id: string | null,
    text: string,
    weekdays: number[],
    startDate: string,
    endDate?: string
  ) => {
    setAppState((prev) => {
      if (!prev) return prev;
      const routines = normalizeRoutines(prev.routines);
      if (id) {
        return {
          ...prev,
          routines: routines.map((routine) =>
            routine.id === id
              ? {
                  ...routine,
                  text,
                  weekdays,
                  startDate,
                  endDate,
                }
              : routine
          ),
        };
      }
      const newRoutine: Routine = {
        id: createId(),
        text,
        weekdays,
        startDate,
        ...(endDate ? { endDate } : {}),
        done: {},
      };
      return { ...prev, routines: [...routines, newRoutine] };
    });
    window.history.back();
  };

  const handleDeleteRoutine = (id: string) => {
    setAppState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        routines: normalizeRoutines(prev.routines).filter((routine) => routine.id !== id),
      };
    });
  };

  const handleChangeMemo = (newMemo: string) => {
    updateCurrentDay(todos, newMemo);
  };

  const handleCopy = async () => {
    if (displayTodos.every((todo) => todo.done)) {
      showToast('복사할 미완료 할 일이 없어요');
      return;
    }

    const text = formatTodosToMarkdown(displayTodos);
    const success = await copyToClipboard(text);
    if (success) {
      showToast('미완료 할 일을 복사했어요');
    }
  };

  const handleIncludeMemoInPriorityChange = (includeMemo: boolean) => {
    setIncludeMemoInPriorityState(includeMemo);
    setPriorityIncludeMemoPreference(includeMemo);
  };

  const handleAccentPreferenceChange = (accentColor: AccentPreference) => {
    setAccentPreference(accentColor);
    setAppState((prev) => (prev ? { ...prev, accentColor } : prev));
  };

  const handlePrioritize = async () => {
    if (isPrioritizing) return;

    const incompleteTodos = todos.filter((todo) => !todo.done);
    if (incompleteTodos.length < 2) {
      showToast('정렬할 할 일이 부족해요');
      return;
    }

    setIsPrioritizing(true);
    try {
      const today = todayKey();
      const upcomingSchedule = expandScheduleInRange(
        appState.schedule || [],
        today,
        addDays(today, 6)
      ).map((item) => ({
        ...item,
        date: item.occurrenceDate,
      }));
      const body = buildPriorityRequest(
        activeKey,
        weekdayLabel(activeKey),
        incompleteTodos,
        currentDay.memo || '',
        includeMemoInPriority,
        upcomingSchedule
      );

      const { data, error } = await supabase.functions.invoke('prioritize', {
        body,
      });

      if (error) {
        console.error('Priority Edge Function error:', error);
        throw error;
      }

      setPrioritySuggestion(parsePrioritySuggestion(data, incompleteTodos));
    } catch (error) {
      console.error('Priority suggestion failed:', error);
      if (error instanceof PriorityResponseError && error.shouldShowMessage) {
        showToast(error.message);
      } else {
        showToast('AI 순서 제안을 가져오지 못했어요');
      }
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
      showToast('AI 순서 적용에 실패했어요');
      return;
    }

    let nextIncompleteIndex = 0;
    const nextTodos = todos.map((todo) => {
      if (todo.done) return todo;
      return reorderedIncomplete[nextIncompleteIndex++] || todo;
    });

    updateCurrentDay(nextTodos);
    setPrioritySuggestion(null);
    showToast('AI가 제안한 순서를 적용했어요');
  };

  const performSignOut = async () => {
    // 먼저 표시해야 signOut을 기다리는 사이에 도착하는 세션 이벤트를 막습니다.
    signedOutRef.current = true;
    setShowSignOutWarning(false);
    setIsSigningOut(true);

    try {
      // 죽은 네트워크에서 signOut이 끝나지 않으면 화면이 멈춥니다. 상한을 둡니다.
      const { error } = await withTimeout(
        supabase.auth.signOut(),
        NETWORK_TIMEOUT_MS,
        'signOut'
      );
      if (error) {
        console.warn('Sign-out request failed:', error.message);
      }
    } catch (e) {
      console.warn('Sign-out did not finish, clearing session locally:', e);
    } finally {
      setIsSigningOut(false);
    }

    // signOut이 실패하거나 시간을 넘겼어도 토큰이 남아서는 안 됩니다.
    clearSupabaseAuthTokens();
    clearUserCache();
    setAppState(null);
    setIsLoaded(false);
    setSession(null);
  };

  const handleSignOut = async () => {
    if (signOutInFlightRef.current) return;
    signOutInFlightRef.current = true;

    try {
      const userId = session?.user?.id;

      // 올리지 못한 변경이 없으면 그대로 로그아웃합니다.
      if (!userId || !appState || !hasPendingSync(userId)) {
        await performSignOut();
        return;
      }

      // 오프라인이 확실하면 요청 타임아웃을 기다리지 않고 바로 알립니다.
      if (!navigator.onLine) {
        setShowSignOutWarning(true);
        return;
      }

      // 마지막으로 한 번 업로드를 시도합니다. saveState가 충돌까지 처리합니다.
      setIsSigningOut(true);
      try {
        await saveState(appState);
      } finally {
        setIsSigningOut(false);
      }

      if (!hasPendingSync(userId)) {
        await performSignOut();
        return;
      }

      // 업로드 실패(오프라인·충돌). 사라진다는 것을 알리고 확인을 받습니다.
      setShowSignOutWarning(true);
    } finally {
      signOutInFlightRef.current = false;
    }
  };

  const handleConfirmSignOutWarning = async () => {
    if (signOutInFlightRef.current) return;
    signOutInFlightRef.current = true;
    try {
      await performSignOut();
    } finally {
      signOutInFlightRef.current = false;
    }
  };

  const handleUpdateProfile = async (update: AccountProfileUpdate): Promise<boolean> => {
    if (!session) return false;

    const nextMetadata = { ...(session.user.user_metadata || {}) };

    if ('displayName' in update) {
      const displayName = update.displayName?.trim() || '';
      if (displayName) {
        nextMetadata.display_name = displayName;
      } else {
        delete nextMetadata.display_name;
      }
    }

    if ('avatarEmoji' in update) {
      if (update.avatarEmoji) {
        nextMetadata.avatar_emoji = update.avatarEmoji;
      } else {
        delete nextMetadata.avatar_emoji;
      }
    }

    const { error } = await supabase.auth.updateUser({ data: nextMetadata });
    if (error) {
      console.error('Profile update failed:', error);
      showToast('프로필 저장에 실패했습니다');
      return false;
    }

    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    showToast('프로필을 저장했습니다');
    return true;
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
      routines: normalizeRoutines(validation.state.routines),
      drawer: normalizeDrawer(validation.state.drawer),
      accentColor: validation.state.accentColor || 'default',
    };

    saveStateSnapshot(appState);
    setAppState(importedState);
    setAccentPreference(importedState.accentColor || 'default');
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
      setAccentPreference(updated.accentColor || 'default');
      showToast('최신 내용으로 새로고침되었습니다');
    }
  };

  const handleDismissConflict = () => {
    setShowConflictModal(false);
    setConflictDetails(null);
  };

  return (
    // 배너는 화면에 고정이고 액션 버튼은 문서 흐름 안에 있다.
    // 끝까지 스크롤했을 때 버튼이 배너에 가리지 않도록 아래를 비워 둔다.
    <div
      className={`min-h-screen bg-slate-50 text-slate-900 font-sans app-container sm:py-10 sm:px-4 ${
        installBannerMode === 'none' ? '' : 'pb-24'
      }`}
    >
      <main className="max-w-[620px] mx-auto bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 sm:p-6 space-y-5">
        {/* Header Section */}
        <Header
          dateLabel={fullLabel(activeKey)}
          completedCount={completedCount}
          totalCount={totalCount}
          profile={profile}
          syncStatus={syncStatus}
          onSignOut={handleSignOut}
          isSigningOut={isSigningOut}
          onUpdateProfile={handleUpdateProfile}
          themePreference={themePreference}
          onThemePreferenceChange={setThemePreference}
          accentPreference={accentPreference}
          onAccentPreferenceChange={handleAccentPreferenceChange}
          onExportData={handleExportData}
          onImportData={handleImportData}
          includeMemoInPriority={includeMemoInPriority}
          onIncludeMemoInPriorityChange={handleIncludeMemoInPriorityChange}
          installMode={installMode}
          onInstall={promptInstall}
        />

        {/* Fixed Schedule Block - Hidden in Month View */}
        {view.kind === 'week' && (
          <ScheduleBlock
            schedule={appState.schedule}
            activeKey={activeKey}
            onAddSchedule={handleAddSchedule}
            onDeleteSchedule={handleDeleteSchedule}
            onOpenScheduleEdit={openScheduleEdit}
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
              handleChangeView({ kind: 'month', anchor: activeKey || todayKey() })
            }
          />
        )}

        {view.kind === 'routineList' && (
          <RoutineListView
            routines={normalizeRoutines(appState.routines)}
            onBack={closeRoutineList}
            onOpenRoutineEdit={openRoutineEdit}
          />
        )}

        {view.kind === 'routineEdit' && (
          <RoutineEditView
            item={editingRoutine}
            onBack={closeRoutineEdit}
            onSave={handleSaveRoutine}
            onDelete={handleDeleteRoutine}
          />
        )}

        {view.kind === 'scheduleEdit' && (
          <ScheduleEditView
            item={editingSchedule}
            activeKey={activeKey}
            onBack={closeScheduleEdit}
            onSave={handleSaveScheduleFromEdit}
            onDelete={handleDeleteSchedule}
          />
        )}

        {/* Date Navigation (Week Strip / Month Calendar) */}
        {(view.kind === 'week' || view.kind === 'month') && (
          <DateNav
            view={view}
            activeKey={activeKey}
            days={appState.days}
            schedule={appState.schedule}
            onChangeView={handleChangeView}
            onSelectDate={handleSelectDate}
            onOpenScheduleEdit={openScheduleEdit}
          />
        )}

        {/* Todo List & Memo (Hidden in Month View) */}
        {view.kind === 'week' && (
          <>
            {shouldShowYesterdayCarryover && (
              <YesterdayCarryover
                todos={yesterdayIncompleteTodos}
                onImport={handleImportYesterdayTodos}
                onDismiss={handleDismissYesterdayCarryover}
              />
            )}

            <TodoList
              todos={displayTodos}
              isSelectMode={isSelectMode}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onToggle={handleToggle}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onAddMany={handleAddMany}
              onReorderTodos={handleReorderTodos}
              onSwipeDate={handleSwipeTodoDate}
              onOpenRoutines={openRoutineList}
            />

            {!isSelectMode && (
              <MemoBlock
                memo={currentDay.memo}
                onChangeMemo={handleChangeMemo}
              />
            )}
          </>
        )}

        {/* 서랍은 매일 보는 것이 아니므로 메모 아래에 둡니다.
            위에 있으면 오늘 할 일을 여기에 적는 오해가 생깁니다. */}
        {view.kind !== 'month' &&
          view.kind !== 'scheduleEdit' &&
          view.kind !== 'routineList' &&
          view.kind !== 'routineEdit' && (
          <DrawerBlock
            lists={drawerLists}
            mode={
              view.kind === 'drawer'
                ? 'lists'
                : view.kind === 'drawerList'
                ? 'list'
                : 'collapsed'
            }
            activeListId={view.kind === 'drawerList' ? view.id : undefined}
            onOpenDrawer={handleOpenDrawer}
            onCloseDrawer={handleCloseDrawer}
            onOpenList={handleOpenDrawerList}
            onBackToLists={handleBackToDrawerLists}
            onCreateDrawer={handleCreateDrawer}
            onRenameDrawer={handleRenameDrawer}
            onDeleteDrawer={handleDeleteDrawer}
            onAddTodos={handleAddDrawerTodos}
            onToggleTodo={handleToggleDrawerTodo}
            onEditTodo={handleEditDrawerTodo}
            onDeleteTodo={handleDeleteDrawerTodo}
            onReorderTodos={handleReorderDrawerTodos}
            onReorderLists={handleReorderDrawers}
          />
        )}

        {view.kind === 'week' && (
          <>
            <div
              className={`bottom-action-spacer ${
                isSelectMode ? 'bottom-action-spacer-move' : ''
              }`}
              aria-hidden="true"
            />
            <div
              className={`bottom-action-shell ${
                isSelectMode ? 'bottom-action-shell-move' : ''
              }`}
            >
              {isSelectMode ? (
                <MoveBar
              activeKey={activeKey}
              selectedCount={selectedIds.size}
              totalCount={todos.length}
              onToggleSelectAll={handleToggleSelectAll}
              onMoveToDate={handleMoveToDate}
              onEmptySelection={() => showToast('옮길 할 일을 선택해주세요')}
              onCancel={handleCancelMoveMode}
            />
              ) : (
                <ActionBar
              onCopy={handleCopy}
              onStartMoveMode={handleStartMoveMode}
              onPrioritize={handlePrioritize}
              isPrioritizing={isPrioritizing}
            />
              )}
            </div>
          </>
        )}
      </main>

      {/* Migration Modal */}
      {showMigrationModal && (
        <MigrationModal
          onConfirm={handleConfirmMigration}
          onCancel={handleCancelMigration}
        />
      )}

      {/* Conflict Modal — 로그아웃 경고가 떠 있는 동안에는 겹치지 않게 숨깁니다. */}
      {showConflictModal && !showSignOutWarning && (
        <ConflictModal
          details={conflictDetails}
          onRefresh={handleRefreshConflict}
          onDismiss={handleDismissConflict}
        />
      )}

      {showSignOutWarning && (
        <SignOutWarningModal
          onConfirm={handleConfirmSignOutWarning}
          onCancel={() => setShowSignOutWarning(false)}
        />
      )}

      {(isPrioritizing || prioritySuggestion) && (
        <PrioritySuggestionModal
          suggestion={prioritySuggestion}
          isLoading={isPrioritizing}
          onApply={handleApplyPrioritySuggestion}
          onCancel={() => setPrioritySuggestion(null)}
        />
      )}

      {/* Reusable Toast Notification */}
      <Toast toast={toast} onClose={hideToast} />

      {/* 배포된 새 버전이 준비되면 알린다. 새로고침은 사용자가 누를 때만. */}
      <UpdateToast isVisible={isUpdateReady} onReload={applyUpdate} />

      {/* 홈 화면 추가 안내. 로그인 화면에서는 이 트리에 닿지 않는다. */}
      <InstallBanner
        mode={installBannerMode}
        onInstall={promptInstall}
        onDismiss={dismissInstallBanner}
      />
    </div>
  );
}
