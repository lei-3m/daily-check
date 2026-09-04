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

/**
 * 반복 할 일. 요일과 기간만 저장하고, 날짜별 완료 여부는 done에 따로 기록합니다.
 */
export type Routine = {
  id: string;
  /** 시간은 별도 필드 없이 텍스트에 포함합니다. 예: "코딩테스트 1문 (09:00)" */
  text: string;
  /** 반복 요일. 0=일 ~ 6=토. 매일은 일곱 개 모두 담습니다. */
  weekdays: number[];
  startDate: string;
  /** 없으면 무기한 반복입니다. */
  endDate?: string;
  /** 완료한 날짜만 담습니다. 예: {"2026-09-04": true} */
  done: Record<string, boolean>;
};

export type DrawerList = {
  id: string;
  name: string;
  items: Todo[];
};

export type AppState = {
  days: Record<string, Day>;
  schedule: ScheduleItem[];
  routines: Routine[];
  drawer: DrawerList[];
  active: string;
  accentColor?: AccentPreference;
};
