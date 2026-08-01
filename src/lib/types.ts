export type Todo = {
  id: string;
  text: string;
  done: boolean;
};

export type Day = {
  todos: Todo[];
  memo: string;
};

export type ScheduleItem = {
  id: string;
  date: string;
  text: string;
};

export type AppState = {
  days: Record<string, Day>;
  schedule: ScheduleItem[];
  active: string;
};
