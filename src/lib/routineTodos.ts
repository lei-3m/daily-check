/**
 * 루틴을 그 날짜의 할 일 목록에 얹는 계산 계층.
 *
 * 루틴 항목은 날마다 저장소에 새로 만들지 않습니다. 화면에 그릴 때
 * 루틴 규칙(기간·요일)과 완료 여부 맵으로 계산합니다.
 * 완료 표시는 그 날짜 하나만 바꾸고, 하지 않은 날은 다음날로 넘기지 않습니다.
 */
import type { Routine, Todo } from './types';
import { parseKey } from './date';
import { normalizeRoutines } from './routine';

/** 저장된 할 일 id와 섞이지 않게 붙이는 접두사. */
const ROUTINE_TODO_PREFIX = 'routine:';

/** 화면에 그리는 항목. routineId가 있으면 저장된 할 일이 아니라 루틴입니다. */
export type DisplayTodo = Todo & { routineId?: string };

export function routineTodoId(routineId: string): string {
  return `${ROUTINE_TODO_PREFIX}${routineId}`;
}

export function isRoutineTodoId(id: string): boolean {
  return id.startsWith(ROUTINE_TODO_PREFIX);
}

export function routineIdFromTodoId(id: string): string | null {
  return isRoutineTodoId(id) ? id.slice(ROUTINE_TODO_PREFIX.length) : null;
}

/**
 * 그 날짜에 이 루틴이 나타나는지.
 * 날짜 키는 "YYYY-MM-DD"라 문자열 비교가 곧 날짜 비교입니다.
 */
export function isRoutineActiveOn(routine: Routine, dateKey: string): boolean {
  if (!routine.text.trim()) return false;
  if (!routine.startDate || dateKey < routine.startDate) return false;
  if (routine.endDate && dateKey > routine.endDate) return false;
  return routine.weekdays.includes(parseKey(dateKey).getDay());
}

/** 그 날짜에 나타나는 루틴들을 할 일 모양으로 계산합니다. */
export function routineTodosFor(
  routines: Routine[] | undefined,
  dateKey: string
): DisplayTodo[] {
  return normalizeRoutines(routines)
    .filter((routine) => isRoutineActiveOn(routine, dateKey))
    .map((routine) => ({
      id: routineTodoId(routine.id),
      text: routine.text,
      done: routine.done[dateKey] === true,
      routineId: routine.id,
    }));
}

/**
 * 저장된 할 일 사이에 루틴 항목을 끼워 넣습니다.
 *
 * 할 일끼리의 순서는 저장된 배열 그대로 둡니다(AI 순서 제안이 바꾼 순서도 그대로).
 * order는 사용자가 드래그로 정한 순서이고, 여기서는 루틴이 어느 항목 뒤에
 * 오는지를 읽는 데만 씁니다. order에 없는 루틴은 목록 끝에 붙습니다.
 */
export function mergeRoutineTodos(
  todos: Todo[],
  routineTodos: DisplayTodo[],
  order?: string[]
): DisplayTodo[] {
  const result: DisplayTodo[] = [...todos];
  if (routineTodos.length === 0) return result;

  const orderIndex = (id: string) => {
    const index = order ? order.indexOf(id) : -1;
    return index === -1 ? Number.POSITIVE_INFINITY : index;
  };
  // 앞에 놓인 루틴부터 넣어야 뒤 루틴이 그것을 기준으로 자리를 잡는다.
  const sorted = [...routineTodos].sort((a, b) => orderIndex(a.id) - orderIndex(b.id));

  for (const routineTodo of sorted) {
    const index = orderIndex(routineTodo.id);
    if (!order || index === Number.POSITIVE_INFINITY) {
      result.push(routineTodo);
      continue;
    }

    // order에서 이 루틴 앞에 있던 항목 중 지금 목록에 남아 있는 것 뒤에 넣는다.
    let anchor = -1;
    for (let i = index - 1; i >= 0; i--) {
      const position = result.findIndex((todo) => todo.id === order[i]);
      if (position !== -1) {
        anchor = position;
        break;
      }
    }
    result.splice(anchor + 1, 0, routineTodo);
  }

  return result;
}

/** 지금 목록에 없는 id는 순서에서 버립니다. 삭제한 할 일·루틴이 쌓이지 않게. */
export function pruneTodoOrder(
  order: string[] | undefined,
  items: { id: string }[]
): string[] {
  if (!order || order.length === 0) return [];
  const ids = new Set(items.map((item) => item.id));
  return order.filter((id) => ids.has(id));
}

/** 저장소에 넣을 할 일만 남깁니다. 루틴 항목은 저장하지 않습니다. */
export function stripRoutineTodos(todos: DisplayTodo[]): Todo[] {
  return todos
    .filter((todo) => !todo.routineId && !isRoutineTodoId(todo.id))
    .map(({ id, text, done }) => ({ id, text, done }));
}

/** 그 날짜의 완료 여부만 뒤집습니다. 다른 날짜는 건드리지 않습니다. */
export function toggleRoutineDone(
  routines: Routine[] | undefined,
  routineId: string,
  dateKey: string
): Routine[] {
  return normalizeRoutines(routines).map((routine) => {
    if (routine.id !== routineId) return routine;
    const done = { ...routine.done };
    if (done[dateKey]) {
      delete done[dateKey];
    } else {
      done[dateKey] = true;
    }
    return { ...routine, done };
  });
}
