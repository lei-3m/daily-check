import { AppState } from './types';
import { supabase, isSupabaseConfigured } from './supabase';

const STORAGE_KEY = 'daily-check:v1';
const SNAPSHOT_KEY = 'daily-check:snapshot';

export type SyncStatusType = 'synced' | 'saving' | 'offline' | 'conflict' | 'local_only';

export interface SyncStatus {
  type: SyncStatusType;
  lastSavedAt?: string;
  message?: string;
}

export interface ConflictDetailItem {
  type: 'todo_added' | 'todo_deleted' | 'memo_changed' | 'schedule_added' | 'schedule_deleted';
  label: string;
}

export interface ConflictDetails {
  items: ConflictDetailItem[];
}

interface LocalCacheEnvelope {
  userId?: string;
  data: AppState;
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
          label: summarizeTodo(todo.text, dayKey),
        });
      }
    }

    for (const todo of serverTodos) {
      if (!localTodoIds.has(todo.id)) {
        items.push({
          type: 'todo_deleted',
          label: `${summarizeTodo(todo.text, dayKey)} 삭제`,
        });
      }
    }

    const localMemo = localDay?.memo || '';
    const serverMemo = serverDay?.memo || '';
    if (localMemo !== serverMemo) {
      const memoPreview = localMemo.trim().split(/\s+/).slice(0, 8).join(' ');
      items.push({
        type: 'memo_changed',
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
        label: summarizeSchedule(item.text, item.date),
      });
    }
  }

  for (const item of serverSchedules) {
    if (!localScheduleIds.has(item.id)) {
      items.push({
        type: 'schedule_deleted',
        label: `${summarizeSchedule(item.text, item.date)} 삭제`,
      });
    }
  }

  return { items };
}

function updateSyncStatus(status: SyncStatus) {
  currentSyncStatus = status;
  statusListeners.forEach((listener) => listener(status));
}

export function clearUserCache(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SNAPSHOT_KEY);
    lastLoadedUpdatedAt = null;
  } catch (e) {
    console.error('Failed to clear user cache:', e);
  }
}

export function setLocalCache(state: AppState, userId?: string): void {
  try {
    const envelope: LocalCacheEnvelope = {
      userId,
      data: state,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch (error) {
    console.error('Failed to save state to localStorage:', error);
  }
}

export function getLocalCache(expectedUserId?: string): AppState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    let cachedUserId: string | undefined;
    let appState: AppState | null = null;

    if ('data' in parsed && parsed.data && typeof parsed.data === 'object' && parsed.data.days) {
      cachedUserId = parsed.userId;
      appState = parsed.data as AppState;
    } else if (parsed.days) {
      // Legacy cache without envelope
      appState = parsed as AppState;
    }

    if (!appState) return null;

    // Validate user identity if expectedUserId is provided
    if (expectedUserId) {
      if (!cachedUserId || cachedUserId !== expectedUserId) {
        return null;
      }
    }

    return appState;
  } catch {
    return null;
  }
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

  const localData = getLocalCache(userId);

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
      lastLoadedUpdatedAt = row.updated_at || null;
      const serverState = row.data as AppState;

      // Update LocalStorage cache with user id
      setLocalCache(serverState, user.id);

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
        const conflictDetails = getConflictDetails(state, serverState);
        updateSyncStatus({ type: 'conflict', message: '다른 기기에서 수정됨' });
        conflictListeners.forEach((cb) => cb(conflictDetails));
        return;
      }

      // Save previous server version snapshot before overwriting
      if (serverRow.data) {
        try {
          localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(serverRow.data));
        } catch (e) {
          console.error('Snapshot storage error:', e);
        }
      }
    }

    // Save to server (upsert)
    const newUpdatedAt = new Date().toISOString();
    const { error: upsertErr } = await supabase.from('user_state').upsert({
      user_id: userId,
      data: state,
      updated_at: newUpdatedAt,
    });

    if (upsertErr) {
      console.warn('Failed to upsert to user_state:', upsertErr.message);
      updateSyncStatus({ type: 'offline', message: '오프라인' });
      return;
    }

    lastLoadedUpdatedAt = newUpdatedAt;
    const nowTimeStr = new Date().toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    updateSyncStatus({ type: 'synced', lastSavedAt: nowTimeStr });
  } catch (err) {
    console.error('Save state error:', err);
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
    const newUpdatedAt = new Date().toISOString();
    const { error } = await supabase.from('user_state').upsert({
      user_id: userId,
      data: state,
      updated_at: newUpdatedAt,
    });
    if (!error) {
      lastLoadedUpdatedAt = newUpdatedAt;
      updateSyncStatus({
        type: 'synced',
        lastSavedAt: new Date().toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      });
      return true;
    }
  } catch (e) {
    console.error('Migration upload failed:', e);
  }
  return false;
}
