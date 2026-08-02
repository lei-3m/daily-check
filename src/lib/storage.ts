import { AppState } from './types';
import { supabase, isSupabaseConfigured } from './supabase';

const STORAGE_KEY = 'daily-check:v1';
const SNAPSHOT_KEY = 'daily-check:snapshot';
const PENDING_SYNC_KEY = 'daily-check:pending-sync';
const SCHEDULE_COLLAPSED_KEY = 'daily-check:schedule-collapsed';

export type SyncStatusType = 'synced' | 'saving' | 'pending' | 'offline' | 'conflict' | 'local_only';

export interface SyncStatus {
  type: SyncStatusType;
  lastSavedAt?: string;
  message?: string;
}

export interface ConflictDetailItem {
  type:
    | 'todo_added'
    | 'todo_deleted'
    | 'todo_updated'
    | 'memo_changed'
    | 'schedule_added'
    | 'schedule_deleted'
    | 'schedule_updated';
  date: string;
  text?: string;
  label: string;
}

export interface ConflictDetails {
  items: ConflictDetailItem[];
}

interface LocalCacheEnvelope {
  userId?: string;
  updatedAt?: string | null;
  data: AppState;
}

interface PendingSyncEnvelope {
  userId?: string;
  pending: boolean;
}

// In-memory state for conflict tracking
let lastLoadedUpdatedAt: string | null = null;
let currentSyncStatus: SyncStatus = { type: 'synced' };

type StatusListener = (status: SyncStatus) => void;
type ConflictListener = (details: ConflictDetails) => void;

const statusListeners = new Set<StatusListener>();
const conflictListeners = new Set<ConflictListener>();

export function getSyncStatus(): SyncStatus {
  return currentSyncStatus;
}

export function subscribeSyncStatus(listener: StatusListener): () => void {
  statusListeners.add(listener);
  listener(currentSyncStatus);
  return () => {
    statusListeners.delete(listener);
  };
}

export function subscribeConflict(listener: ConflictListener): () => void {
  conflictListeners.add(listener);
  return () => {
    conflictListeners.delete(listener);
  };
}

function summarizeTodo(text: string, date: string): string {
  return `${date} 할 일: ${text}`;
}

function summarizeSchedule(text: string, date: string): string {
  return `${date} 일정: ${text}`;
}

function setServerSnapshot(state: AppState): void {
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Snapshot storage error:', error);
  }
}

function getServerSnapshot(): AppState | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.days) return null;
    return parsed as AppState;
  } catch {
    return null;
  }
}

function getConflictDetails(localState: AppState, serverState: AppState): ConflictDetails {
  const items: ConflictDetailItem[] = [];
  const dayKeys = new Set([
    ...Object.keys(localState.days || {}),
    ...Object.keys(serverState.days || {}),
  ]);

  for (const dayKey of [...dayKeys].sort()) {
    const localDay = localState.days?.[dayKey];
    const serverDay = serverState.days?.[dayKey];
    const localTodos = localDay?.todos || [];
    const serverTodos = serverDay?.todos || [];
    const serverTodoIds = new Set(serverTodos.map((todo) => todo.id));
    const localTodoIds = new Set(localTodos.map((todo) => todo.id));

    for (const todo of localTodos) {
      if (!serverTodoIds.has(todo.id)) {
        items.push({
          type: 'todo_added',
          date: dayKey,
          text: todo.text,
          label: summarizeTodo(todo.text, dayKey),
        });
      }
    }

    for (const todo of serverTodos) {
      if (!localTodoIds.has(todo.id)) {
        items.push({
          type: 'todo_deleted',
          date: dayKey,
          text: todo.text,
          label: `${summarizeTodo(todo.text, dayKey)} 삭제`,
        });
      }
    }

    for (const todo of localTodos) {
      const serverTodo = serverTodos.find((item) => item.id === todo.id);
      if (serverTodo && (serverTodo.text !== todo.text || serverTodo.done !== todo.done)) {
        items.push({
          type: 'todo_updated',
          date: dayKey,
          text: todo.text,
          label: summarizeTodo(todo.text, dayKey),
        });
      }
    }

    const localMemo = localDay?.memo || '';
    const serverMemo = serverDay?.memo || '';
    if (localMemo !== serverMemo) {
      const memoPreview = localMemo.trim().split(/\s+/).slice(0, 8).join(' ');
      items.push({
        type: 'memo_changed',
        date: dayKey,
        label: memoPreview ? `${dayKey} 메모: ${memoPreview}` : `${dayKey} 메모 비우기`,
      });
    }
  }

  const localSchedules = localState.schedule || [];
  const serverSchedules = serverState.schedule || [];
  const serverScheduleIds = new Set(serverSchedules.map((item) => item.id));
  const localScheduleIds = new Set(localSchedules.map((item) => item.id));

  for (const item of localSchedules) {
    if (!serverScheduleIds.has(item.id)) {
      items.push({
        type: 'schedule_added',
        date: item.date,
        text: item.text,
        label: summarizeSchedule(item.text, item.date),
      });
    }
  }

  for (const item of serverSchedules) {
    if (!localScheduleIds.has(item.id)) {
      items.push({
        type: 'schedule_deleted',
        date: item.date,
        text: item.text,
        label: `${summarizeSchedule(item.text, item.date)} 삭제`,
      });
    }
  }

  for (const item of localSchedules) {
    const serverItem = serverSchedules.find((serverItem) => serverItem.id === item.id);
    if (serverItem && (serverItem.date !== item.date || serverItem.text !== item.text)) {
      items.push({
        type: 'schedule_updated',
        date: item.date,
        text: item.text,
        label: summarizeSchedule(item.text, item.date),
      });
    }
  }

  return { items };
}

function updateSyncStatus(status: SyncStatus) {
  if (
    currentSyncStatus.type === status.type &&
    currentSyncStatus.message === status.message &&
    currentSyncStatus.lastSavedAt === status.lastSavedAt
  ) {
    return;
  }
  currentSyncStatus = status;
  statusListeners.forEach((listener) => listener(status));
}

function setPendingSync(pending: boolean, userId?: string): void {
  try {
    const envelope: PendingSyncEnvelope = { userId, pending };
    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(envelope));
  } catch (error) {
    console.error('Failed to save pending sync flag:', error);
  }
}

export function clearPendingSync(userId?: string): void {
  setPendingSync(false, userId);
}

export function savePendingLocalState(state: AppState, userId?: string): void {
  setLocalCache(state, userId);
  setPendingSync(true, userId);
}

export async function resolvePendingSync(userId?: string): Promise<AppState | null> {
  if (!hasPendingSync(userId)) return null;
  updateSyncStatus({ type: 'pending', message: '동기화 대기 중' });
  return loadState(userId);
}

export function hasPendingSync(expectedUserId?: string): boolean {
  try {
    const raw = localStorage.getItem(PENDING_SYNC_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as PendingSyncEnvelope;
    if (!parsed?.pending) return false;
    if (expectedUserId && parsed.userId && parsed.userId !== expectedUserId) return false;
    return true;
  } catch {
    return false;
  }
}

function getLocalEnvelope(expectedUserId?: string): LocalCacheEnvelope | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    let envelope: LocalCacheEnvelope | null = null;

    if ('data' in parsed && parsed.data && typeof parsed.data === 'object' && parsed.data.days) {
      envelope = {
        userId: parsed.userId,
        updatedAt: parsed.updatedAt ?? null,
        data: parsed.data as AppState,
      };
    } else if (parsed.days) {
      envelope = {
        data: parsed as AppState,
        updatedAt: null,
      };
    }

    if (!envelope) return null;

    if (expectedUserId && (!envelope.userId || envelope.userId !== expectedUserId)) {
      return null;
    }

    return envelope;
  } catch {
    return null;
  }
}

export function getScheduleCollapsedPreference(): boolean {
  try {
    return localStorage.getItem(SCHEDULE_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setScheduleCollapsedPreference(isCollapsed: boolean): void {
  try {
    localStorage.setItem(SCHEDULE_COLLAPSED_KEY, String(isCollapsed));
  } catch (error) {
    console.error('Failed to save schedule collapsed preference:', error);
  }
}

export function clearUserCache(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SNAPSHOT_KEY);
    localStorage.removeItem(PENDING_SYNC_KEY);
    lastLoadedUpdatedAt = null;
  } catch (e) {
    console.error('Failed to clear user cache:', e);
  }
}

export function setLocalCache(state: AppState, userId?: string, updatedAt = lastLoadedUpdatedAt): void {
  try {
    const envelope: LocalCacheEnvelope = {
      userId,
      updatedAt,
      data: state,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch (error) {
    console.error('Failed to save state to localStorage:', error);
  }
}

export function getLocalCache(expectedUserId?: string): AppState | null {
  return getLocalEnvelope(expectedUserId)?.data || null;
}

async function uploadStateToServer(userId: string, state: AppState): Promise<string | null> {
  const newUpdatedAt = new Date().toISOString();
  const { error } = await supabase.from('user_state').upsert({
    user_id: userId,
    data: state,
    updated_at: newUpdatedAt,
  });

  if (error) {
    console.warn('Failed to upsert to user_state:', error.message);
    return null;
  }

  lastLoadedUpdatedAt = newUpdatedAt;
  setLocalCache(state, userId, newUpdatedAt);
  setServerSnapshot(state);
  setPendingSync(false, userId);
  updateSyncStatus({
    type: 'synced',
    lastSavedAt: new Date().toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
  });
  return newUpdatedAt;
}

export async function loadState(expectedUserId?: string): Promise<AppState | null> {
  let userId = expectedUserId;

  if (isSupabaseConfigured() && !userId) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      userId = sessionData.session?.user?.id;
    } catch {
      // ignore
    }
  }

  const localEnvelope = getLocalEnvelope(userId);
  const localData = localEnvelope?.data || null;
  const pendingSync = hasPendingSync(userId);
  if (localEnvelope?.updatedAt) {
    lastLoadedUpdatedAt = localEnvelope.updatedAt;
  }
  if (pendingSync) {
    updateSyncStatus({ type: 'pending', message: '동기화 대기 중' });
  }

  if (!isSupabaseConfigured()) {
    updateSyncStatus({ type: 'local_only' });
    return localData;
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;

    if (!user) {
      updateSyncStatus({ type: 'local_only' });
      return localData;
    }

    // Try fetching from server
    const { data: row, error } = await supabase
      .from('user_state')
      .select('data, updated_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.warn('Failed to load server state:', error.message);
      updateSyncStatus({ type: 'offline', message: '오프라인 (서버 연결 실패)' });
      return localData;
    }

    if (row && row.data) {
      const serverState = row.data as AppState;
      const serverTime = row.updated_at ? new Date(row.updated_at).getTime() : 0;
      const localTime = localEnvelope?.updatedAt ? new Date(localEnvelope.updatedAt).getTime() : 0;

      if (pendingSync && localData) {
        if (serverTime > localTime) {
          const conflictDetails = getConflictDetails(localData, getServerSnapshot() || serverState);
          if (conflictDetails.items.length === 0) {
            setPendingSync(false, user.id);
            lastLoadedUpdatedAt = row.updated_at || null;
            setLocalCache(serverState, user.id, row.updated_at || null);
            setServerSnapshot(serverState);
            updateSyncStatus({ type: 'synced' });
            return serverState;
          }

          updateSyncStatus({ type: 'conflict', message: '다른 기기에서 수정됨' });
          conflictListeners.forEach((cb) => cb(conflictDetails));
          return localData;
        }

        const uploadedAt = await uploadStateToServer(user.id, localData);
        if (uploadedAt) {
          return localData;
        }

        setPendingSync(true, user.id);
        updateSyncStatus({ type: 'offline', message: '오프라인' });
        return localData;
      }

      lastLoadedUpdatedAt = row.updated_at || null;

      // Update LocalStorage cache with user id
      setLocalCache(serverState, user.id, row.updated_at || null);
      setServerSnapshot(serverState);

      const formattedTime = row.updated_at
        ? new Date(row.updated_at).toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        : undefined;

      updateSyncStatus({ type: 'synced', lastSavedAt: formattedTime });
      return serverState;
    } else {
      // User has no server record yet
      if (pendingSync && localData) {
        const uploadedAt = await uploadStateToServer(user.id, localData);
        if (uploadedAt) {
          return localData;
        }

        setPendingSync(true, user.id);
        updateSyncStatus({ type: 'offline', message: '오프라인' });
        return localData;
      }

      lastLoadedUpdatedAt = null;
      updateSyncStatus({ type: 'synced' });
      return localData;
    }
  } catch (err) {
    console.error('Unexpected error loading state:', err);
    updateSyncStatus({ type: 'offline', message: '오프라인' });
    return getLocalCache(userId);
  }
}

export async function saveState(state: AppState): Promise<void> {
  let userId: string | undefined;

  if (isSupabaseConfigured()) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      userId = sessionData.session?.user?.id;
    } catch {
      // ignore
    }
  }

  // Save to LocalStorage immediately as offline cache
  setLocalCache(state, userId);
  setPendingSync(true, userId);

  if (!isSupabaseConfigured() || !userId) {
    updateSyncStatus({ type: 'local_only' });
    return;
  }

  try {
    updateSyncStatus({ type: 'saving' });

    // Check server's updated_at for conflicts
    const { data: serverRow, error: fetchErr } = await supabase
      .from('user_state')
      .select('data, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchErr) {
      console.warn('Network issue checking server updated_at:', fetchErr.message);
      setPendingSync(true, userId);
      updateSyncStatus({ type: 'offline', message: '오프라인' });
      return;
    }

    if (serverRow && serverRow.updated_at) {
      const serverTime = new Date(serverRow.updated_at).getTime();
      const localTime = lastLoadedUpdatedAt ? new Date(lastLoadedUpdatedAt).getTime() : 0;

      // Conflict check: server has newer data than what we loaded
      if (lastLoadedUpdatedAt !== null && serverTime > localTime) {
        const serverState = (serverRow.data || {
          days: {},
          schedule: [],
          active: state.active,
        }) as AppState;
        const conflictDetails = getConflictDetails(state, getServerSnapshot() || serverState);
        if (conflictDetails.items.length === 0) {
          setPendingSync(false, userId);
          lastLoadedUpdatedAt = serverRow.updated_at || null;
          setLocalCache(serverState, userId, serverRow.updated_at || null);
          setServerSnapshot(serverState);
          updateSyncStatus({ type: 'synced' });
          return;
        }

        setPendingSync(true, userId);
        updateSyncStatus({ type: 'conflict', message: '다른 기기에서 수정됨' });
        conflictListeners.forEach((cb) => cb(conflictDetails));
        return;
      }

      // Save previous server version snapshot before overwriting
      if (serverRow.data) {
        setServerSnapshot(serverRow.data as AppState);
      }
    }

    const uploadedAt = await uploadStateToServer(userId, state);
    if (!uploadedAt) {
      setPendingSync(true, userId);
      updateSyncStatus({ type: 'offline', message: '오프라인' });
    }
  } catch (err) {
    console.error('Save state error:', err);
    setPendingSync(true, userId);
    updateSyncStatus({ type: 'offline', message: '오프라인' });
  }
}

// Migration check helper
export async function checkMigrationNeeded(userId: string): Promise<boolean> {
  const promptKey = `daily-check:migration-prompted:${userId}`;
  if (localStorage.getItem(promptKey) === 'true') {
    return false;
  }

  const localCache = getLocalCache();
  if (!localCache || !localCache.days || Object.keys(localCache.days).length === 0) {
    return false;
  }

  try {
    const { data: row } = await supabase
      .from('user_state')
      .select('data')
      .eq('user_id', userId)
      .maybeSingle();

    if (!row || !row.data || Object.keys(row.data.days || {}).length === 0) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

export function markMigrationPrompted(userId: string) {
  localStorage.setItem(`daily-check:migration-prompted:${userId}`, 'true');
}

export async function uploadLocalToAccount(userId: string, state: AppState): Promise<boolean> {
  markMigrationPrompted(userId);
  try {
    return (await uploadStateToServer(userId, state)) !== null;
  } catch (e) {
    console.error('Migration upload failed:', e);
  }
  return false;
}
