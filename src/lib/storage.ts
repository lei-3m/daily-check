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

// In-memory state for conflict tracking
let lastLoadedUpdatedAt: string | null = null;
let currentSyncStatus: SyncStatus = { type: 'synced' };

type StatusListener = (status: SyncStatus) => void;
type ConflictListener = () => void;

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

function updateSyncStatus(status: SyncStatus) {
  currentSyncStatus = status;
  statusListeners.forEach((listener) => listener(status));
}

export function getLocalCache(): AppState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppState;
    if (parsed && typeof parsed === 'object' && parsed.days) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export async function loadState(): Promise<AppState | null> {
  const localData = getLocalCache();

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

      // Update LocalStorage cache
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(serverState));
      } catch (e) {
        console.error('LocalStorage write failed:', e);
      }

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
    return localData;
  }
}

export async function saveState(state: AppState): Promise<void> {
  // 1. Always save to LocalStorage immediately as offline cache
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save state to localStorage:', error);
  }

  if (!isSupabaseConfigured()) {
    updateSyncStatus({ type: 'local_only' });
    return;
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;

    if (!user) {
      updateSyncStatus({ type: 'local_only' });
      return;
    }

    updateSyncStatus({ type: 'saving' });

    // Check server's updated_at for conflicts
    const { data: serverRow, error: fetchErr } = await supabase
      .from('user_state')
      .select('data, updated_at')
      .eq('user_id', user.id)
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
        updateSyncStatus({ type: 'conflict', message: '다른 기기에서 수정됨' });
        conflictListeners.forEach((cb) => cb());
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
      user_id: user.id,
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
