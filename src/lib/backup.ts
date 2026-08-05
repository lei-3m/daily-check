import { AppState, Day, DrawerList, ScheduleItem, Todo, isAccentPreference } from './types';

type ValidationResult =
  | { ok: true; state: AppState }
  | { ok: false; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isTodo(value: unknown): value is Todo {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.text === 'string' &&
    typeof value.done === 'boolean'
  );
}

function isDay(value: unknown): value is Day {
  return (
    isRecord(value) &&
    Array.isArray(value.todos) &&
    value.todos.every(isTodo) &&
    typeof value.memo === 'string'
  );
}

function isScheduleItem(value: unknown): value is ScheduleItem {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isDateKey(value.date) &&
    typeof value.text === 'string' &&
    (value.repeat === undefined || value.repeat === 'weekly' || value.repeat === 'monthly') &&
    (value.repeatUntil === undefined || isDateKey(value.repeatUntil))
  );
}

function isDrawerList(value: unknown): value is DrawerList {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    Array.isArray(value.items) &&
    value.items.every(isTodo)
  );
}

export function validateBackupState(value: unknown): ValidationResult {
  if (!isRecord(value)) {
    return { ok: false, message: '백업 파일은 JSON 객체여야 합니다.' };
  }

  if (!isRecord(value.days)) {
    return { ok: false, message: '백업 파일에 days 데이터가 없습니다.' };
  }

  for (const [key, day] of Object.entries(value.days)) {
    if (!isDateKey(key)) {
      return { ok: false, message: `날짜 키 형식이 잘못되었습니다: ${key}` };
    }

    if (!isDay(day)) {
      return { ok: false, message: `${key}의 할 일 또는 메모 형식이 잘못되었습니다.` };
    }
  }

  if (!Array.isArray(value.schedule) || !value.schedule.every(isScheduleItem)) {
    return { ok: false, message: '일정 데이터 형식이 잘못되었습니다.' };
  }

  const drawer = value.drawer === undefined ? [] : value.drawer;
  if (!Array.isArray(drawer) || !drawer.every(isDrawerList)) {
    return { ok: false, message: '서랍 데이터 형식이 잘못되었습니다.' };
  }

  const active = value.active;
  if (!isDateKey(active)) {
    return { ok: false, message: '현재 날짜(active) 형식이 잘못되었습니다.' };
  }

  const accentColor =
    typeof value.accentColor === 'string' && isAccentPreference(value.accentColor)
      ? value.accentColor
      : 'default';

  return {
    ok: true,
    state: {
      days: value.days as Record<string, Day>,
      schedule: value.schedule,
      drawer,
      active,
      accentColor,
    },
  };
}
