import {
  AccentPreference,
  AppState,
  DrawerList,
  ScheduleItem,
  ThemePreference,
  Todo,
  isAccentPreference,
  isThemePreference,
} from './types';
import { supabase, isSupabaseConfigured } from './supabase';
import { NETWORK_TIMEOUT_MS, withTimeout } from './async';

const LOCAL_KEY_PREFIX = 'daily-check:';
const STORAGE_KEY = 'daily-check:v1';
const SNAPSHOT_KEY = 'daily-check:snapshot';
const PENDING_SYNC_KEY = 'daily-check:pending-sync';
const SCHEDULE_COLLAPSED_KEY = 'daily-check:schedule-collapsed';
const PRIORITY_INCLUDE_MEMO_KEY = 'daily-check:priority-include-memo';
const YESTERDAY_CARRYOVER_DISMISSED_PREFIX = 'daily-check:yesterday-carryover-dismissed:';
const MIGRATION_PROMPTED_PREFIX = 'daily-check:migration-prompted:';
const THEME_KEY = 'daily-check:theme';
const ACCENT_KEY = 'daily-check:accent';

// 기기 설정. 계정 데이터가 아니므로 로그아웃해도 지우지 않습니다.
const DEVICE_KEYS: readonly string[] = [THEME_KEY, ACCENT_KEY];

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
    | 'schedule_updated'
    | 'drawer_added'
    | 'drawer_deleted'
    | 'drawer_updated'
    | 'accent_changed'
    | 'active_changed';
  date: string;
  text?: string;
  label: string;
}

export interface ConflictDetails {
  items: ConflictDetailItem[];
  otherItems: ConflictDetailItem[];
}

export type RealtimePullResult =
  | { type: 'ignored' }
  | { type: 'applied'; state: AppState }
  | { type: 'conflict'; state: AppState; details: ConflictDetails }
  | { type: 'offline' };

type MergeResult = {
  state: AppState;
  details: ConflictDetails;
};

interface LocalCacheEnvelope {
  userId?: string;
  updatedAt?: string | null;
  data: AppState;
}

interface PendingSyncEnvelope {
  userId?: string;
  pending: boolean;
}

// 타임아웃돼도 요청 자체는 취소되지 않습니다. 뒤늦게 성공해도 이어지는 코드를
// 실행하지 않으므로 상태는 건드리지 않고, 다음 기회에 다시 올립니다.
// upsert는 멱등이라 중복 업로드가 되어도 안전합니다.
const withSyncTimeout = <T,>(operation: PromiseLike<T>, label: string): Promise<T> =>
  withTimeout(operation, NETWORK_TIMEOUT_MS, label);

// In-memory state for conflict tracking
let lastLoadedUpdatedAt: string | null = null;
let currentSyncStatus: SyncStatus = { type: 'synced' };

// 서버를 오가는 작업이 겹쳐 돌면, 먼저 뜬 쪽이 붙잡은 오래된 스냅샷으로
// 나중 변경을 덮어씁니다. 한 번에 하나만 돌게 직렬화합니다.
let syncInFlight: Promise<unknown> | null = null;

export function isSyncInFlight(): boolean {
  return syncInFlight !== null;
}

async function runExclusive<T>(task: () => Promise<T>): Promise<T> {
  while (syncInFlight) {
    await syncInFlight.catch(() => undefined);
  }
  const run = task();
  syncInFlight = run;
  try {
    return await run;
  } finally {
    if (syncInFlight === run) syncInFlight = null;
  }
}

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

function listDisplayName(name: string): string {
  return name.trim() || '목록 이름';
}

function summarizeDrawerList(name: string, action: '추가' | '삭제' | '수정'): string {
  return `서랍 목록 ${action}: ${listDisplayName(name)}`;
}

function summarizeDrawerTodo(
  listName: string,
  text: string,
  action: '추가' | '삭제' | '수정'
): string {
  return `서랍 할 일 ${action}: ${listDisplayName(listName)} - ${text}`;
}

function createDefaultDrawer(): DrawerList[] {
  return [];
}

export function normalizeDrawer(drawer?: DrawerList[]): DrawerList[] {
  if (!drawer || drawer.length === 0) return createDefaultDrawer();
  return drawer.map((item, index) => ({
    id: item.id || `drawer-${index}`,
    name: typeof item.name === 'string' ? item.name : '목록 이름',
    items: item.items || [],
  }));
}

function normalizeStoredState(state: AppState): AppState {
  return {
    ...state,
    accentColor: isAccentPreference(state.accentColor) ? state.accentColor : 'default',
    drawer: normalizeDrawer(state.drawer),
  };
}

function setServerSnapshot(state: AppState): void {
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(normalizeStoredState(state)));
  } catch (error) {
    console.error('Snapshot storage error:', error);
  }
}

export function saveStateSnapshot(state: AppState): void {
  setServerSnapshot(state);
}

/**
 * 동기화 결과를 적용하는 사이에 생긴 로컬 변경을 되살립니다.
 *
 * 서버를 다녀오는 동안 화면에서 항목을 지우면, 작업을 시작할 때 붙잡은
 * 스냅샷에는 그 삭제가 없습니다. 결과를 그대로 적용하면 지운 항목이
 * 되살아납니다.
 *
 * base   = 작업을 시작할 때의 상태
 * latest = 지금 화면 상태 (그 사이의 변경 포함)
 * incoming = 서버 반영 결과
 *
 * 3-way 병합이 그대로 들어맞습니다. base 대비 latest의 변경과 base 대비
 * incoming의 변경을 합치면 양쪽 모두 남습니다.
 */
export function reapplyLocalChanges(
  base: AppState,
  latest: AppState,
  incoming: AppState
): AppState {
  return mergeThreeWay(latest, base, incoming).state;
}

function getServerSnapshot(): AppState | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.days) return null;
    return normalizeStoredState(parsed as AppState);
  } catch {
    return null;
  }
}

function collectDrawerTodoConflictItems(
  listName: string,
  localItems: Todo[],
  serverItems: Todo[],
  items: ConflictDetailItem[]
): void {
  const serverTodoIds = new Set(serverItems.map((todo) => todo.id));
  const localTodoIds = new Set(localItems.map((todo) => todo.id));

  for (const todo of localItems) {
    if (!serverTodoIds.has(todo.id)) {
      items.push({
        type: 'drawer_added',
        date: listDisplayName(listName),
        text: todo.text,
        label: summarizeDrawerTodo(listName, todo.text, '추가'),
      });
    }
  }

  for (const todo of serverItems) {
    if (!localTodoIds.has(todo.id)) {
      items.push({
        type: 'drawer_deleted',
        date: listDisplayName(listName),
        text: todo.text,
        label: summarizeDrawerTodo(listName, todo.text, '삭제'),
      });
    }
  }

  for (const todo of localItems) {
    const serverTodo = serverItems.find((item) => item.id === todo.id);
    if (serverTodo && (serverTodo.text !== todo.text || serverTodo.done !== todo.done)) {
      items.push({
        type: 'drawer_updated',
        date: listDisplayName(listName),
        text: todo.text,
        label: summarizeDrawerTodo(listName, todo.text, '수정'),
      });
    }
  }
}

function collectDrawerConflictItems(
  localLists: DrawerList[],
  serverLists: DrawerList[],
  items: ConflictDetailItem[]
): void {
  const serverIds = new Set(serverLists.map((list) => list.id));
  const localIds = new Set(localLists.map((list) => list.id));

  for (const list of localLists) {
    if (!serverIds.has(list.id)) {
      items.push({
        type: 'drawer_added',
        date: listDisplayName(list.name),
        label: summarizeDrawerList(list.name, '추가'),
      });
      for (const todo of list.items || []) {
        items.push({
          type: 'drawer_added',
          date: listDisplayName(list.name),
          text: todo.text,
          label: summarizeDrawerTodo(list.name, todo.text, '추가'),
        });
      }
    }
  }

  for (const list of serverLists) {
    if (!localIds.has(list.id)) {
      items.push({
        type: 'drawer_deleted',
        date: listDisplayName(list.name),
        label: summarizeDrawerList(list.name, '삭제'),
      });
      for (const todo of list.items || []) {
        items.push({
          type: 'drawer_deleted',
          date: listDisplayName(list.name),
          text: todo.text,
          label: summarizeDrawerTodo(list.name, todo.text, '삭제'),
        });
      }
    }
  }

  for (const list of localLists) {
    const serverList = serverLists.find((item) => item.id === list.id);
    if (!serverList) continue;

    if (serverList.name !== list.name) {
      items.push({
        type: 'drawer_updated',
        date: listDisplayName(list.name),
        label: summarizeDrawerList(list.name, '수정'),
      });
    }

    collectDrawerTodoConflictItems(
      list.name,
      list.items || [],
      serverList.items || [],
      items
    );
  }
}

function getConflictDetails(localState: AppState, serverState: AppState): ConflictDetails {
  const items: ConflictDetailItem[] = [];
  const normalizedLocal = normalizeStoredState(localState);
  const normalizedServer = normalizeStoredState(serverState);
  const dayKeys = new Set([
    ...Object.keys(normalizedLocal.days || {}),
    ...Object.keys(normalizedServer.days || {}),
  ]);

  for (const dayKey of [...dayKeys].sort()) {
    const localDay = normalizedLocal.days?.[dayKey];
    const serverDay = normalizedServer.days?.[dayKey];
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

  const localSchedules = normalizedLocal.schedule || [];
  const serverSchedules = normalizedServer.schedule || [];
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
    if (
      serverItem &&
      (serverItem.date !== item.date ||
        serverItem.text !== item.text ||
        serverItem.repeat !== item.repeat ||
        serverItem.repeatUntil !== item.repeatUntil)
    ) {
      items.push({
        type: 'schedule_updated',
        date: item.date,
        text: item.text,
        label: summarizeSchedule(item.text, item.date),
      });
    }
  }

  collectDrawerConflictItems(normalizedLocal.drawer, normalizedServer.drawer, items);

  if (normalizedLocal.accentColor !== normalizedServer.accentColor) {
    items.push({
      type: 'accent_changed',
      date: normalizedLocal.active,
      label: '강조 색상 변경',
    });
  }

  if (normalizedLocal.active !== normalizedServer.active) {
    items.push({
      type: 'active_changed',
      date: normalizedLocal.active,
      label: `선택 날짜 변경: ${normalizedLocal.active}`,
    });
  }

  return { items, otherItems: [] };
}

function getBidirectionalConflictDetails(
  localState: AppState,
  baseServerState: AppState,
  latestServerState: AppState
): ConflictDetails {
  return {
    items: getConflictDetails(localState, baseServerState).items,
    otherItems: getConflictDetails(latestServerState, baseServerState).items,
  };
}

function todoEquals(a: Todo, b: Todo): boolean {
  return a.text === b.text && a.done === b.done;
}

function scheduleEquals(a: ScheduleItem, b: ScheduleItem): boolean {
  return (
    a.date === b.date &&
    a.text === b.text &&
    a.repeat === b.repeat &&
    a.repeatUntil === b.repeatUntil
  );
}

function todoListEquals(a: Todo[], b: Todo[]): boolean {
  if (a.length !== b.length) return false;
  const bById = new Map(b.map((todo) => [todo.id, todo]));
  return a.every((todo) => {
    const other = bById.get(todo.id);
    return other ? todoEquals(todo, other) : false;
  });
}

function mergeOrder(...idLists: string[][]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const ids of idLists) {
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      result.push(id);
    }
  }
  return result;
}

function todoConflictItem(
  type: 'todo_deleted' | 'todo_updated' | 'todo_added',
  date: string,
  todo?: Todo
): ConflictDetailItem {
  const text = todo?.text || '삭제된 할 일';
  return {
    type,
    date,
    text,
    label:
      type === 'todo_deleted'
        ? `${summarizeTodo(text, date)} 삭제`
        : summarizeTodo(text, date),
  };
}

function scheduleConflictItem(
  type: 'schedule_deleted' | 'schedule_updated' | 'schedule_added',
  item?: ScheduleItem
): ConflictDetailItem {
  const date = item?.date || '';
  const text = item?.text || '삭제된 일정';
  return {
    type,
    date,
    text,
    label:
      type === 'schedule_deleted'
        ? `${summarizeSchedule(text, date)} 삭제`
        : summarizeSchedule(text, date),
  };
}

function drawerListConflictItem(
  type: 'drawer_deleted' | 'drawer_updated' | 'drawer_added',
  list?: DrawerList
): ConflictDetailItem {
  const action = type === 'drawer_deleted' ? '삭제' : type === 'drawer_added' ? '추가' : '수정';
  const name = list?.name || '목록 이름';
  return {
    type,
    date: listDisplayName(name),
    label: summarizeDrawerList(name, action),
  };
}

function drawerTodoConflictItem(
  type: 'drawer_deleted' | 'drawer_updated' | 'drawer_added',
  listName: string,
  todo?: Todo
): ConflictDetailItem {
  const action = type === 'drawer_deleted' ? '삭제' : type === 'drawer_added' ? '추가' : '수정';
  const text = todo?.text || '삭제된 할 일';
  return {
    type,
    date: listDisplayName(listName),
    text,
    label: summarizeDrawerTodo(listName, text, action),
  };
}

function mergeTodos(
  date: string,
  baseTodos: Todo[],
  localTodos: Todo[],
  remoteTodos: Todo[],
  localConflicts: ConflictDetailItem[],
  remoteConflicts: ConflictDetailItem[]
): Todo[] {
  const baseById = new Map(baseTodos.map((todo) => [todo.id, todo]));
  const localById = new Map(localTodos.map((todo) => [todo.id, todo]));
  const remoteById = new Map(remoteTodos.map((todo) => [todo.id, todo]));
  const merged = new Map<string, Todo>();

  for (const id of mergeOrder(
    localTodos.map((todo) => todo.id),
    remoteTodos.map((todo) => todo.id),
    baseTodos.map((todo) => todo.id)
  )) {
    const base = baseById.get(id);
    const local = localById.get(id);
    const remote = remoteById.get(id);

    if (!base) {
      if (local && remote && !todoEquals(local, remote)) {
        localConflicts.push(todoConflictItem('todo_added', date, local));
        remoteConflicts.push(todoConflictItem('todo_added', date, remote));
        merged.set(id, local);
      } else if (local) {
        merged.set(id, local);
      } else if (remote) {
        merged.set(id, remote);
      }
      continue;
    }

    const localChanged = !local || !todoEquals(local, base);
    const remoteChanged = !remote || !todoEquals(remote, base);

    if (localChanged && remoteChanged) {
      if (!local && !remote) continue;
      if (local && remote && todoEquals(local, remote)) {
        merged.set(id, local);
        continue;
      }

      localConflicts.push(
        local
          ? todoConflictItem('todo_updated', date, local)
          : todoConflictItem('todo_deleted', date, base)
      );
      remoteConflicts.push(
        remote
          ? todoConflictItem('todo_updated', date, remote)
          : todoConflictItem('todo_deleted', date, base)
      );
      if (local) merged.set(id, local);
    } else if (localChanged) {
      if (local) merged.set(id, local);
    } else if (remoteChanged) {
      if (remote) merged.set(id, remote);
    } else {
      merged.set(id, base);
    }
  }

  return [...merged.values()];
}

function mergeSchedules(
  baseSchedules: ScheduleItem[],
  localSchedules: ScheduleItem[],
  remoteSchedules: ScheduleItem[],
  localConflicts: ConflictDetailItem[],
  remoteConflicts: ConflictDetailItem[]
): ScheduleItem[] {
  const baseById = new Map(baseSchedules.map((item) => [item.id, item]));
  const localById = new Map(localSchedules.map((item) => [item.id, item]));
  const remoteById = new Map(remoteSchedules.map((item) => [item.id, item]));
  const merged = new Map<string, ScheduleItem>();

  for (const id of mergeOrder(
    localSchedules.map((item) => item.id),
    remoteSchedules.map((item) => item.id),
    baseSchedules.map((item) => item.id)
  )) {
    const base = baseById.get(id);
    const local = localById.get(id);
    const remote = remoteById.get(id);

    if (!base) {
      if (local && remote && !scheduleEquals(local, remote)) {
        localConflicts.push(scheduleConflictItem('schedule_added', local));
        remoteConflicts.push(scheduleConflictItem('schedule_added', remote));
        merged.set(id, local);
      } else if (local) {
        merged.set(id, local);
      } else if (remote) {
        merged.set(id, remote);
      }
      continue;
    }

    const localChanged = !local || !scheduleEquals(local, base);
    const remoteChanged = !remote || !scheduleEquals(remote, base);

    if (localChanged && remoteChanged) {
      if (!local && !remote) continue;
      if (local && remote && scheduleEquals(local, remote)) {
        merged.set(id, local);
        continue;
      }
      localConflicts.push(
        local
          ? scheduleConflictItem('schedule_updated', local)
          : scheduleConflictItem('schedule_deleted', base)
      );
      remoteConflicts.push(
        remote
          ? scheduleConflictItem('schedule_updated', remote)
          : scheduleConflictItem('schedule_deleted', base)
      );
      if (local) merged.set(id, local);
    } else if (localChanged) {
      if (local) merged.set(id, local);
    } else if (remoteChanged) {
      if (remote) merged.set(id, remote);
    } else {
      merged.set(id, base);
    }
  }

  return [...merged.values()];
}

function mergeDrawerTodos(
  listName: string,
  baseItems: Todo[],
  localItems: Todo[],
  remoteItems: Todo[],
  localConflicts: ConflictDetailItem[],
  remoteConflicts: ConflictDetailItem[]
): Todo[] {
  const baseById = new Map(baseItems.map((todo) => [todo.id, todo]));
  const localById = new Map(localItems.map((todo) => [todo.id, todo]));
  const remoteById = new Map(remoteItems.map((todo) => [todo.id, todo]));
  const merged = new Map<string, Todo>();

  for (const id of mergeOrder(
    localItems.map((todo) => todo.id),
    remoteItems.map((todo) => todo.id),
    baseItems.map((todo) => todo.id)
  )) {
    const base = baseById.get(id);
    const local = localById.get(id);
    const remote = remoteById.get(id);

    if (!base) {
      if (local && remote && !todoEquals(local, remote)) {
        localConflicts.push(drawerTodoConflictItem('drawer_added', listName, local));
        remoteConflicts.push(drawerTodoConflictItem('drawer_added', listName, remote));
        merged.set(id, local);
      } else if (local) {
        merged.set(id, local);
      } else if (remote) {
        merged.set(id, remote);
      }
      continue;
    }

    const localChanged = !local || !todoEquals(local, base);
    const remoteChanged = !remote || !todoEquals(remote, base);

    if (localChanged && remoteChanged) {
      if (!local && !remote) continue;
      if (local && remote && todoEquals(local, remote)) {
        merged.set(id, local);
        continue;
      }
      localConflicts.push(
        local
          ? drawerTodoConflictItem('drawer_updated', listName, local)
          : drawerTodoConflictItem('drawer_deleted', listName, base)
      );
      remoteConflicts.push(
        remote
          ? drawerTodoConflictItem('drawer_updated', listName, remote)
          : drawerTodoConflictItem('drawer_deleted', listName, base)
      );
      if (local) merged.set(id, local);
    } else if (localChanged) {
      if (local) merged.set(id, local);
    } else if (remoteChanged) {
      if (remote) merged.set(id, remote);
    } else {
      merged.set(id, base);
    }
  }

  return [...merged.values()];
}

function mergeDrawerLists(
  baseLists: DrawerList[],
  localLists: DrawerList[],
  remoteLists: DrawerList[],
  localConflicts: ConflictDetailItem[],
  remoteConflicts: ConflictDetailItem[]
): DrawerList[] {
  const baseById = new Map(baseLists.map((list) => [list.id, list]));
  const localById = new Map(localLists.map((list) => [list.id, list]));
  const remoteById = new Map(remoteLists.map((list) => [list.id, list]));
  const merged: DrawerList[] = [];

  for (const id of mergeOrder(
    localLists.map((list) => list.id),
    remoteLists.map((list) => list.id),
    baseLists.map((list) => list.id)
  )) {
    const base = baseById.get(id);
    const local = localById.get(id);
    const remote = remoteById.get(id);

    if (!base) {
      if (local && remote && local.name !== remote.name) {
        localConflicts.push(drawerListConflictItem('drawer_added', local));
        remoteConflicts.push(drawerListConflictItem('drawer_added', remote));
      }
      if (local && remote) {
        merged.push({
          ...local,
          items: mergeDrawerTodos(
            local.name,
            [],
            local.items || [],
            remote.items || [],
            localConflicts,
            remoteConflicts
          ),
        });
      } else if (local) {
        merged.push(local);
      } else if (remote) {
        merged.push(remote);
      }
      continue;
    }

    const localDeleted = !local;
    const remoteDeleted = !remote;
    const localNameChanged = Boolean(local && local.name !== base.name);
    const remoteNameChanged = Boolean(remote && remote.name !== base.name);
    const localItems = local?.items || [];
    const remoteItems = remote?.items || [];

    if (localDeleted && remoteDeleted) continue;
    if (localDeleted) {
      const remoteChanged = remoteNameChanged || !todoListEquals(remoteItems, base.items || []);
      if (remoteChanged) {
        localConflicts.push(drawerListConflictItem('drawer_deleted', base));
        remoteConflicts.push(drawerListConflictItem('drawer_updated', remote));
        if (remote) merged.push(remote);
      }
      continue;
    }
    if (remoteDeleted) {
      const localChanged = localNameChanged || !todoListEquals(localItems, base.items || []);
      if (localChanged) {
        localConflicts.push(drawerListConflictItem('drawer_updated', local));
        remoteConflicts.push(drawerListConflictItem('drawer_deleted', base));
        merged.push(local);
      }
      continue;
    }

    if (!local || !remote) continue;
    let name = base.name;
    if (localNameChanged && remoteNameChanged) {
      if (local.name === remote.name) {
        name = local.name;
      } else {
        localConflicts.push(drawerListConflictItem('drawer_updated', local));
        remoteConflicts.push(drawerListConflictItem('drawer_updated', remote));
        name = local.name;
      }
    } else if (localNameChanged) {
      name = local.name;
    } else if (remoteNameChanged) {
      name = remote.name;
    }

    merged.push({
      ...local,
      name,
      items: mergeDrawerTodos(
        name,
        base.items || [],
        local.items || [],
        remote.items || [],
        localConflicts,
        remoteConflicts
      ),
    });
  }

  return merged;
}

function mergeThreeWay(localState: AppState, baseState: AppState, remoteState: AppState): MergeResult {
  const local = normalizeStoredState(localState);
  const base = normalizeStoredState(baseState);
  const remote = normalizeStoredState(remoteState);
  const localConflicts: ConflictDetailItem[] = [];
  const remoteConflicts: ConflictDetailItem[] = [];
  const days: AppState['days'] = {};

  const dayKeys = new Set([
    ...Object.keys(base.days || {}),
    ...Object.keys(local.days || {}),
    ...Object.keys(remote.days || {}),
  ]);

  for (const dayKey of [...dayKeys].sort()) {
    const baseDay = base.days?.[dayKey] || { todos: [], memo: '' };
    const localDay = local.days?.[dayKey] || { todos: [], memo: '' };
    const remoteDay = remote.days?.[dayKey] || { todos: [], memo: '' };
    const todos = mergeTodos(
      dayKey,
      baseDay.todos || [],
      localDay.todos || [],
      remoteDay.todos || [],
      localConflicts,
      remoteConflicts
    );

    const localMemoChanged = (localDay.memo || '') !== (baseDay.memo || '');
    const remoteMemoChanged = (remoteDay.memo || '') !== (baseDay.memo || '');
    let memo = baseDay.memo || '';
    if (localMemoChanged && remoteMemoChanged) {
      if ((localDay.memo || '') === (remoteDay.memo || '')) {
        memo = localDay.memo || '';
      } else {
        localConflicts.push({
          type: 'memo_changed',
          date: dayKey,
          label: (localDay.memo || '').trim()
            ? `${dayKey} 메모: ${(localDay.memo || '').trim().split(/\s+/).slice(0, 8).join(' ')}`
            : `${dayKey} 메모 비우기`,
        });
        remoteConflicts.push({
          type: 'memo_changed',
          date: dayKey,
          label: (remoteDay.memo || '').trim()
            ? `${dayKey} 메모: ${(remoteDay.memo || '').trim().split(/\s+/).slice(0, 8).join(' ')}`
            : `${dayKey} 메모 비우기`,
        });
        memo = localDay.memo || '';
      }
    } else if (localMemoChanged) {
      memo = localDay.memo || '';
    } else if (remoteMemoChanged) {
      memo = remoteDay.memo || '';
    }

    if (todos.length > 0 || memo.trim()) {
      days[dayKey] = { todos, memo };
    }
  }

  const schedule = mergeSchedules(
    base.schedule || [],
    local.schedule || [],
    remote.schedule || [],
    localConflicts,
    remoteConflicts
  );

  const drawer = mergeDrawerLists(
    base.drawer || [],
    local.drawer || [],
    remote.drawer || [],
    localConflicts,
    remoteConflicts
  );

  let accentColor = base.accentColor;
  const localAccentChanged = local.accentColor !== base.accentColor;
  const remoteAccentChanged = remote.accentColor !== base.accentColor;
  if (localAccentChanged && remoteAccentChanged) {
    if (local.accentColor === remote.accentColor) {
      accentColor = local.accentColor;
    } else {
      localConflicts.push({
        type: 'accent_changed',
        date: local.active,
        label: '강조 색상 변경',
      });
      remoteConflicts.push({
        type: 'accent_changed',
        date: remote.active,
        label: '강조 색상 변경',
      });
      accentColor = local.accentColor;
    }
  } else if (localAccentChanged) {
    accentColor = local.accentColor;
  } else if (remoteAccentChanged) {
    accentColor = remote.accentColor;
  }

  let active = base.active;
  const localActiveChanged = local.active !== base.active;
  const remoteActiveChanged = remote.active !== base.active;
  if (localActiveChanged && remoteActiveChanged) {
    if (local.active === remote.active) {
      active = local.active;
    } else {
      localConflicts.push({
        type: 'active_changed',
        date: local.active,
        label: `선택 날짜 변경: ${local.active}`,
      });
      remoteConflicts.push({
        type: 'active_changed',
        date: remote.active,
        label: `선택 날짜 변경: ${remote.active}`,
      });
      active = local.active;
    }
  } else if (localActiveChanged) {
    active = local.active;
  } else if (remoteActiveChanged) {
    active = remote.active;
  }

  return {
    state: {
      days,
      schedule,
      drawer,
      active,
      accentColor,
    },
    details: {
      items: localConflicts,
      otherItems: remoteConflicts,
    },
  };
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
        data: normalizeStoredState(parsed.data as AppState),
      };
    } else if (parsed.days) {
      envelope = {
        data: normalizeStoredState(parsed as AppState),
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

export function getPriorityIncludeMemoPreference(): boolean {
  try {
    const stored = localStorage.getItem(PRIORITY_INCLUDE_MEMO_KEY);
    return stored === null ? true : stored === 'true';
  } catch {
    return true;
  }
}

export function setPriorityIncludeMemoPreference(includeMemo: boolean): void {
  try {
    localStorage.setItem(PRIORITY_INCLUDE_MEMO_KEY, String(includeMemo));
  } catch (error) {
    console.error('Failed to save priority memo preference:', error);
  }
}

export function isYesterdayCarryoverDismissed(dateKey: string): boolean {
  try {
    return localStorage.getItem(`${YESTERDAY_CARRYOVER_DISMISSED_PREFIX}${dateKey}`) === 'true';
  } catch {
    return false;
  }
}

export function dismissYesterdayCarryover(dateKey: string): void {
  try {
    localStorage.setItem(`${YESTERDAY_CARRYOVER_DISMISSED_PREFIX}${dateKey}`, 'true');
  } catch (error) {
    console.error('Failed to save yesterday carryover dismissed state:', error);
  }
}

export function getStoredThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return isThemePreference(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function setStoredThemePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_KEY, preference);
  } catch (error) {
    console.error('Failed to save theme preference:', error);
  }
}

export function getStoredAccentPreference(): AccentPreference {
  try {
    const stored = localStorage.getItem(ACCENT_KEY);
    return isAccentPreference(stored) ? stored : 'default';
  } catch {
    return 'default';
  }
}

export function setStoredAccentPreference(preference: AccentPreference): void {
  try {
    localStorage.setItem(ACCENT_KEY, preference);
  } catch (error) {
    console.error('Failed to save accent preference:', error);
  }
}

// 삭제 중 인덱스가 밀리지 않도록 키를 먼저 모두 수집합니다.
function listLocalKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key && key.startsWith(LOCAL_KEY_PREFIX)) keys.push(key);
  }
  return keys;
}

/** 앱 시작 시 호출. 오늘 것을 뺀 지난 날짜의 carryover 키를 지웁니다. */
export function pruneStaleLocalKeys(currentDateKey: string): void {
  try {
    const keepKey = `${YESTERDAY_CARRYOVER_DISMISSED_PREFIX}${currentDateKey}`;
    listLocalKeys()
      .filter((key) => key.startsWith(YESTERDAY_CARRYOVER_DISMISSED_PREFIX) && key !== keepKey)
      .forEach((key) => localStorage.removeItem(key));
  } catch (e) {
    console.error('Failed to prune stale local keys:', e);
  }
}

/**
 * supabase-js가 저장한 세션 토큰을 지웁니다. 키 형식은 `sb-<project-ref>-auth-token`.
 * signOut이 네트워크 때문에 끝나지 않을 때 세션이 남지 않도록 하는 최후 수단입니다.
 */
export function clearSupabaseAuthTokens(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && /^sb-.*-auth-token/.test(key)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch (e) {
    console.error('Failed to clear supabase auth tokens:', e);
  }
}

/** 로그아웃/세션 없음. 기기 설정(테마·강조색)만 남기고 전부 지웁니다. */
export function clearUserCache(): void {
  try {
    listLocalKeys()
      .filter((key) => !DEVICE_KEYS.includes(key))
      .forEach((key) => localStorage.removeItem(key));
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
      data: normalizeStoredState(state),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch (error) {
    console.error('Failed to save state to localStorage:', error);
  }
}

export function getLocalCache(expectedUserId?: string): AppState | null {
  return getLocalEnvelope(expectedUserId)?.data || null;
}

function isCurrentServerVersion(updatedAt?: string | null): boolean {
  if (!updatedAt || !lastLoadedUpdatedAt) return false;
  return new Date(updatedAt).getTime() <= new Date(lastLoadedUpdatedAt).getTime();
}

function hasLocalWriteRisk(userId?: string): boolean {
  return (
    hasPendingSync(userId) ||
    currentSyncStatus.type === 'saving' ||
    currentSyncStatus.type === 'pending' ||
    currentSyncStatus.type === 'offline' ||
    currentSyncStatus.type === 'conflict'
  );
}

export function pullRealtimeServerState(
  userId: string,
  localState: AppState,
  hasUnsavedLocalChanges: boolean
): Promise<RealtimePullResult> {
  return runExclusive(() =>
    pullRealtimeServerStateInternal(userId, localState, hasUnsavedLocalChanges)
  );
}

async function pullRealtimeServerStateInternal(
  userId: string,
  localState: AppState,
  hasUnsavedLocalChanges: boolean
): Promise<RealtimePullResult> {
  if (!isSupabaseConfigured()) return { type: 'ignored' };

  try {
    const { data: row, error } = await withSyncTimeout(
      supabase
        .from('user_state')
        .select('data, updated_at')
        .eq('user_id', userId)
        .maybeSingle(),
      'user_state realtime pull'
    );

    if (error) {
      console.warn('Failed to load realtime server state:', error.message);
      return { type: 'offline' };
    }

    if (!row?.data) return { type: 'ignored' };
    if (isCurrentServerVersion(row.updated_at || null)) return { type: 'ignored' };

    const serverState = normalizeStoredState(row.data as AppState);

    if (hasUnsavedLocalChanges || hasLocalWriteRisk(userId)) {
      const baseServerState = getServerSnapshot();
      if (!baseServerState) {
        const details = getConflictDetails(localState, serverState);
        setLocalCache(localState, userId);
        setPendingSync(true, userId);
        updateSyncStatus({ type: 'conflict', message: 'Conflict detected' });
        return { type: 'conflict', state: localState, details };
      }
      const mergeResult = mergeThreeWay(localState, baseServerState, serverState);
      if (mergeResult.details.items.length > 0 || mergeResult.details.otherItems.length > 0) {
        setLocalCache(mergeResult.state, userId);
        setPendingSync(true, userId);
        updateSyncStatus({ type: 'conflict', message: '다른 기기에서 수정됨' });
        return { type: 'conflict', state: mergeResult.state, details: mergeResult.details };
      }

      const uploadedAt = await uploadStateToServer(userId, mergeResult.state);
      if (uploadedAt) return { type: 'applied', state: mergeResult.state };
      setLocalCache(mergeResult.state, userId);
      setPendingSync(true, userId);
      return { type: 'offline' };
    }

    lastLoadedUpdatedAt = row.updated_at || null;
    setLocalCache(serverState, userId, row.updated_at || null);
    setServerSnapshot(serverState);
    setPendingSync(false, userId);

    const formattedTime = row.updated_at
      ? new Date(row.updated_at).toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      : undefined;

    updateSyncStatus({ type: 'synced', lastSavedAt: formattedTime });
    return { type: 'applied', state: serverState };
  } catch (error) {
    console.warn('Realtime server state pull failed:', error);
    return { type: 'offline' };
  }
}

async function uploadStateToServer(userId: string, state: AppState): Promise<string | null> {
  const normalizedState = normalizeStoredState(state);
  const newUpdatedAt = new Date().toISOString();

  let error: { message: string } | null = null;
  try {
    ({ error } = await withSyncTimeout(
      supabase.from('user_state').upsert({
        user_id: userId,
        data: normalizedState,
        updated_at: newUpdatedAt,
      }),
      'user_state upload'
    ));
  } catch (e) {
    // 시간을 넘긴 경우. 오프라인과 똑같이 실패로 다룹니다.
    console.warn('Upload to user_state did not finish:', e);
    return null;
  }

  if (error) {
    console.warn('Failed to upsert to user_state:', error.message);
    return null;
  }

  lastLoadedUpdatedAt = newUpdatedAt;
  setLocalCache(normalizedState, userId, newUpdatedAt);
  setServerSnapshot(normalizedState);
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

export function loadState(expectedUserId?: string): Promise<AppState | null> {
  return runExclusive(() => loadStateInternal(expectedUserId));
}

async function loadStateInternal(expectedUserId?: string): Promise<AppState | null> {
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
    const { data: row, error } = await withSyncTimeout(
      supabase
        .from('user_state')
        .select('data, updated_at')
        .eq('user_id', user.id)
        .maybeSingle(),
      'user_state load'
    );

    if (error) {
      console.warn('Failed to load server state:', error.message);
      updateSyncStatus({ type: 'offline', message: '오프라인 (서버 연결 실패)' });
      return localData;
    }

    if (row && row.data) {
      const serverState = normalizeStoredState(row.data as AppState);
      const serverTime = row.updated_at ? new Date(row.updated_at).getTime() : 0;
      const localTime = localEnvelope?.updatedAt ? new Date(localEnvelope.updatedAt).getTime() : 0;

      if (pendingSync && localData) {
        if (serverTime > localTime) {
          const baseServerState = getServerSnapshot();
          if (!baseServerState) {
            const details = getConflictDetails(localData, serverState);
            setLocalCache(localData, user.id);
            setPendingSync(true, user.id);
            updateSyncStatus({ type: 'conflict', message: 'Conflict detected' });
            conflictListeners.forEach((cb) => cb(details));
            return localData;
          }
          const mergeResult = mergeThreeWay(
            localData,
            baseServerState,
            serverState
          );
          if (
            mergeResult.details.items.length === 0 &&
            mergeResult.details.otherItems.length === 0
          ) {
            const uploadedAt = await uploadStateToServer(user.id, mergeResult.state);
            if (uploadedAt) {
              return mergeResult.state;
            }

            setLocalCache(mergeResult.state, user.id);
            setPendingSync(true, user.id);
            updateSyncStatus({ type: 'offline', message: '오프라인' });
            return mergeResult.state;
          }

          setLocalCache(mergeResult.state, user.id);
          setPendingSync(true, user.id);
          updateSyncStatus({ type: 'conflict', message: '다른 기기에서 수정됨' });
          conflictListeners.forEach((cb) => cb(mergeResult.details));
          return mergeResult.state;
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

export function saveState(state: AppState): Promise<AppState | null> {
  return runExclusive(() => saveStateInternal(state));
}

async function saveStateInternal(state: AppState): Promise<AppState | null> {
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
  const localEnvelopeBeforeSave = getLocalEnvelope(userId);
  const localBaseUpdatedAt = localEnvelopeBeforeSave?.updatedAt ?? lastLoadedUpdatedAt;
  setLocalCache(state, userId, localBaseUpdatedAt);
  setPendingSync(true, userId);

  if (!isSupabaseConfigured() || !userId) {
    updateSyncStatus({ type: 'local_only' });
    return null;
  }

  try {
    updateSyncStatus({ type: 'saving' });

    // Check server's updated_at for conflicts
    const { data: serverRow, error: fetchErr } = await withSyncTimeout(
      supabase
        .from('user_state')
        .select('data, updated_at')
        .eq('user_id', userId)
        .maybeSingle(),
      'user_state conflict check'
    );

    if (fetchErr) {
      console.warn('Network issue checking server updated_at:', fetchErr.message);
      setPendingSync(true, userId);
      updateSyncStatus({ type: 'offline', message: '오프라인' });
      return null;
    }

    if (serverRow && serverRow.updated_at) {
      const serverTime = new Date(serverRow.updated_at).getTime();
      const localTime = localBaseUpdatedAt ? new Date(localBaseUpdatedAt).getTime() : 0;

      // Conflict check: server has newer data than what we loaded
      if (localBaseUpdatedAt !== null && serverTime > localTime) {
        const serverState = normalizeStoredState((serverRow.data || {
          days: {},
          schedule: [],
          drawer: createDefaultDrawer(),
          active: state.active,
          accentColor: state.accentColor,
        }) as AppState);
        const baseServerState = getServerSnapshot();
        if (!baseServerState) {
          const details = getConflictDetails(state, serverState);
          setLocalCache(state, userId, localBaseUpdatedAt);
          setPendingSync(true, userId);
          updateSyncStatus({ type: 'conflict', message: 'Conflict detected' });
          conflictListeners.forEach((cb) => cb(details));
          return state;
        }
        const mergeResult = mergeThreeWay(
          state,
          baseServerState,
          serverState
        );
        if (
          mergeResult.details.items.length === 0 &&
          mergeResult.details.otherItems.length === 0
        ) {
          const uploadedAt = await uploadStateToServer(userId, mergeResult.state);
          if (!uploadedAt) {
            setLocalCache(mergeResult.state, userId);
            setPendingSync(true, userId);
            updateSyncStatus({ type: 'offline', message: '오프라인' });
          }
          return mergeResult.state;
        }

        setLocalCache(mergeResult.state, userId);
        setPendingSync(true, userId);
        updateSyncStatus({ type: 'conflict', message: '다른 기기에서 수정됨' });
        conflictListeners.forEach((cb) => cb(mergeResult.details));
        return mergeResult.state;
      }

      // Save previous server version snapshot before overwriting
      if (serverRow.data) {
        setServerSnapshot(normalizeStoredState(serverRow.data as AppState));
      }
    }

    const uploadedAt = await uploadStateToServer(userId, state);
    if (!uploadedAt) {
      setPendingSync(true, userId);
      updateSyncStatus({ type: 'offline', message: '오프라인' });
    }
    return null;
  } catch (err) {
    console.error('Save state error:', err);
    setPendingSync(true, userId);
    updateSyncStatus({ type: 'offline', message: '오프라인' });
    return null;
  }
}

// Migration check helper
export async function checkMigrationNeeded(userId: string): Promise<boolean> {
  const promptKey = `${MIGRATION_PROMPTED_PREFIX}${userId}`;
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
  localStorage.setItem(`${MIGRATION_PROMPTED_PREFIX}${userId}`, 'true');
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

export async function saveImportedState(userId: string, state: AppState): Promise<boolean> {
  setLocalCache(state, userId);
  setPendingSync(true, userId);
  return (await uploadStateToServer(userId, state)) !== null;
}
