/**
 * 날짜 유틸리티 함수 모음
 * 모든 날짜 키는 로컬 타임존 기준 "YYYY-MM-DD" 문자열을 사용합니다.
 * UTC 변환으로 인한 날짜 왜곡을 방지하기 위해 표준 ISO 변환 메서드를 사용하지 않습니다.
 */

export function toKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayKey(): string {
  return toKey(new Date());
}

export function parseKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function shortLabel(key: string): string {
  const d = parseKey(key);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const WEEKDAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

export function fullLabel(key: string): string {
  const d = parseKey(key);
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const dayName = WEEKDAYS[d.getDay()];
  return `${month}월 ${date}일 ${dayName}`;
}

export function addDays(key: string, n: number): string {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

export function addMonths(key: string, n: number): string {
  const d = parseKey(key);
  d.setMonth(d.getMonth() + n);
  return toKey(d);
}

export function startOfWeek(key: string): string {
  const d = parseKey(key);
  const dayOfWeek = d.getDay();
  d.setDate(d.getDate() - dayOfWeek);
  return toKey(d);
}

export function weekDays(key: string): string[] {
  const start = startOfWeek(key);
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(addDays(start, i));
  }
  return days;
}

export function weekMonthLabel(key: string): string {
  const days = weekDays(key);
  const first = parseKey(days[0]);
  const last = parseKey(days[6]);

  const firstYear = first.getFullYear();
  const firstMonth = first.getMonth() + 1;
  const lastYear = last.getFullYear();
  const lastMonth = last.getMonth() + 1;

  if (firstYear === lastYear && firstMonth === lastMonth) {
    return `${firstYear}년 ${firstMonth}월`;
  } else if (firstYear === lastYear) {
    return `${firstMonth}월 – ${lastMonth}월`;
  } else {
    return `${firstYear}년 ${firstMonth}월 – ${lastYear}년 ${lastMonth}월`;
  }
}

export function monthGrid(key: string): string[] {
  const d = parseKey(key);
  const year = d.getFullYear();
  const month = d.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const gridStartKey = startOfWeek(toKey(firstDayOfMonth));

  const lastDayOfMonth = new Date(year, month + 1, 0);
  const gridEndKey = addDays(startOfWeek(toKey(lastDayOfMonth)), 6);

  const grid: string[] = [];
  let current = gridStartKey;
  while (current <= gridEndKey) {
    grid.push(current);
    current = addDays(current, 1);
  }
  return grid;
}
