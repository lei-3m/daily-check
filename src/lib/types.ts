export type ThemePreference = 'light' | 'dark' | 'system';
export type AccentPreference =
  | 'default'
  | 'blue'
  | 'green'
  | 'yellow'
  | 'pink'
  | 'orange'
  | 'purple';

export const isThemePreference = (value: string | null): value is ThemePreference =>
  value === 'light' || value === 'dark' || value === 'system';

export const isAccentPreference = (value: string | null | undefined): value is AccentPreference =>
  value === 'default' ||
  value === 'blue' ||
  value === 'green' ||
  value === 'yellow' ||
  value === 'pink' ||
  value === 'orange' ||
  value === 'purple';

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

export type DrawerList = {
  id: string;
  name: string;
  items: Todo[];
};

export type AppState = {
  days: Record<string, Day>;
  schedule: ScheduleItem[];
  drawer: DrawerList[];
  active: string;
  accentColor?: AccentPreference;
};
