import type { AccentPreference } from './theme';

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
  repeat?: 'weekly' | 'monthly';
  repeatUntil?: string;
};

export type Drawer = {
  id: string;
  name: string;
  items: Todo[];
};

export type AppState = {
  days: Record<string, Day>;
  schedule: ScheduleItem[];
  drawer: Drawer[];
  active: string;
  accentColor?: AccentPreference;
};
