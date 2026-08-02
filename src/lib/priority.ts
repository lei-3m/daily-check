import type { ScheduleItem, Todo } from './types';

export const PRIORITY_FUNCTION_NAME = 'prioritize-todos';

export interface PriorityTodoInput {
  id: string;
  text: string;
}

export interface PriorityScheduleInput {
  id: string;
  date: string;
  text: string;
}

export interface PriorityRequestBody {
  date: string;
  weekday: string;
  todos: PriorityTodoInput[];
  memo?: string;
  schedule: PriorityScheduleInput[];
}

export interface PrioritySuggestionItem {
  id: string;
  text: string;
  reason: string;
}

export interface PrioritySuggestion {
  items: PrioritySuggestionItem[];
}

type ReasonMap = Record<string, string>;

function readOrderedIds(data: unknown): string[] | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  const ids = record.order ?? record.sortedIds ?? record.ids;
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
    return null;
  }
  return ids;
}

function readReasons(data: unknown): ReasonMap | null {
  if (!data || typeof data !== 'object') return null;
  const reasons = (data as Record<string, unknown>).reasons;

  if (reasons && typeof reasons === 'object' && !Array.isArray(reasons)) {
    const entries = Object.entries(reasons as Record<string, unknown>);
    if (entries.some(([, value]) => typeof value !== 'string')) return null;
    return Object.fromEntries(entries) as ReasonMap;
  }

  if (Array.isArray(reasons)) {
    const result: ReasonMap = {};
    for (const item of reasons) {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      if (typeof record.id !== 'string' || typeof record.reason !== 'string') {
        return null;
      }
      result[record.id] = record.reason;
    }
    return result;
  }

  return null;
}

export function buildPriorityRequest(
  date: string,
  weekday: string,
  todos: Todo[],
  memo: string,
  includeMemo: boolean,
  schedule: ScheduleItem[]
): PriorityRequestBody {
  const body: PriorityRequestBody = {
    date,
    weekday,
    todos: todos.map((todo) => ({
      id: todo.id,
      text: todo.text,
    })),
    schedule: schedule.map((item) => ({
      id: item.id,
      date: item.date,
      text: item.text,
    })),
  };

  if (includeMemo) {
    body.memo = memo;
  }

  return body;
}

export function parsePrioritySuggestion(
  data: unknown,
  incompleteTodos: Todo[]
): PrioritySuggestion {
  const orderedIds = readOrderedIds(data);
  const reasons = readReasons(data);
  if (!orderedIds || !reasons) {
    throw new Error('Invalid priority response');
  }

  const todoById = new Map(incompleteTodos.map((todo) => [todo.id, todo]));
  const seen = new Set<string>();
  const items: PrioritySuggestionItem[] = [];

  for (const id of orderedIds) {
    if (seen.has(id)) continue;
    const todo = todoById.get(id);
    const reason = reasons[id];
    if (!todo || typeof reason !== 'string' || reason.trim() === '') {
      continue;
    }
    seen.add(id);
    items.push({
      id,
      text: todo.text,
      reason: reason.trim(),
    });
  }

  for (const todo of incompleteTodos) {
    if (!seen.has(todo.id)) {
      throw new Error('Invalid priority response');
    }
  }

  return { items };
}
