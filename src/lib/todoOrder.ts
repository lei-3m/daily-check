import { Todo } from './types';

export function normalizeTodoOrder<T extends Todo>(todos: T[]): T[] {
  return [
    ...todos.filter((todo) => todo.done),
    ...todos.filter((todo) => !todo.done),
  ];
}

export function appendIncompleteTodos(todos: Todo[], newTodos: Todo[]): Todo[] {
  return [
    ...todos.filter((todo) => todo.done),
    ...todos.filter((todo) => !todo.done),
    ...newTodos,
  ];
}

export function toggleTodoDoneAndMove(todos: Todo[], id: string): Todo[] {
  const target = todos.find((todo) => todo.id === id);
  if (!target) return todos;

  const toggled = { ...target, done: !target.done };
  const rest = todos.filter((todo) => todo.id !== id);

  if (toggled.done) {
    return [
      ...rest.filter((todo) => todo.done),
      toggled,
      ...rest.filter((todo) => !todo.done),
    ];
  }

  return [
    ...rest.filter((todo) => todo.done),
    toggled,
    ...rest.filter((todo) => !todo.done),
  ];
}

export function moveIncompleteTodo<T extends Todo>(
  todos: T[],
  activeId: string,
  overId: string
): T[] {
  const activeTodo = todos.find((todo) => todo.id === activeId);
  const overTodo = todos.find((todo) => todo.id === overId);
  if (!activeTodo || !overTodo || activeTodo.done || overTodo.done) return todos;

  const incompleteTodos = todos.filter((todo) => !todo.done);
  const completedTodos = todos.filter((todo) => todo.done);
  const oldIndex = incompleteTodos.findIndex((todo) => todo.id === activeId);
  const newIndex = incompleteTodos.findIndex((todo) => todo.id === overId);
  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return todos;

  const nextIncompleteTodos = [...incompleteTodos];
  const [moved] = nextIncompleteTodos.splice(oldIndex, 1);
  nextIncompleteTodos.splice(newIndex, 0, moved);
  return [...completedTodos, ...nextIncompleteTodos];
}
