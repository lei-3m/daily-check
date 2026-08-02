import type { ScheduleItem, Todo } from './types';

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

export class PriorityResponseError extends Error {
  shouldShowMessage: boolean;

  constructor(message: string, shouldShowMessage = false) {
    super(message);
    this.name = 'PriorityResponseError';
    this.shouldShowMessage = shouldShowMessage;
  }
}

interface PriorityOrderItem {
  id: string;
  reason: string;
}

function readOrder(data: unknown): PriorityOrderItem[] {
  if (!data || typeof data !== 'object') {
    console.error('Invalid priority response:', data);
    throw new PriorityResponseError('Invalid priority response');
  }

  const record = data as Record<string, unknown>;
  if (typeof record.error === 'string' && record.error.trim()) {
    throw new PriorityResponseError(record.error.trim(), true);
  }

  if (!Array.isArray(record.order)) {
    console.error('Invalid priority response:', data);
    throw new PriorityResponseError('Invalid priority response');
  }

  const order: PriorityOrderItem[] = [];
  for (const item of record.order) {
    if (!item || typeof item !== 'object') continue;
    const orderItem = item as Record<string, unknown>;
    if (
      typeof orderItem.id !== 'string' ||
      orderItem.id.trim() === '' ||
      typeof orderItem.reason !== 'string'
    ) {
      continue;
    }
    order.push({
      id: orderItem.id.trim(),
      reason: orderItem.reason.trim(),
    });
  }

  return order;
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
  const order = readOrder(data);

  const todoById = new Map(incompleteTodos.map((todo) => [todo.id, todo]));
  const seen = new Set<string>();
  const items: PrioritySuggestionItem[] = [];

  for (const orderItem of order) {
    const id = orderItem.id;
    if (seen.has(id)) continue;
    const todo = todoById.get(id);
    if (!todo) {
      continue;
    }
    seen.add(id);
    items.push({
      id,
      text: todo.text,
      reason: orderItem.reason || '우선순위 제안',
    });
  }

  for (const todo of incompleteTodos) {
    if (!seen.has(todo.id)) {
      items.push({
        id: todo.id,
        text: todo.text,
        reason: '기존 순서 유지',
      });
    }
  }

  return { items };
}
