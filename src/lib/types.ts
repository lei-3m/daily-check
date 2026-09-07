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
  /**
   * 사용자가 드래그로 정한 표시 순서(할 일 id + 루틴 항목 id).
   * 루틴 항목은 저장되지 않으므로 위치만 여기에 남깁니다.
   * 순서를 바꾼 적이 없으면 없습니다.
   */
  todoOrder?: string[];
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
  /**
   * 루틴끼리의 표시 순서. 작은 값이 위에 옵니다.
   * 예전 데이터에는 없어서 선택 항목입니다. normalizeRoutines가 생성 순서로 채웁니다.
   */
  sortOrder?: number;
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
