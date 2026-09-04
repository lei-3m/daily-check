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

export function weekdayLabel(key: string): string {
  return WEEKDAYS[parseKey(key).getDay()];
}

/** 요일 한 글자. 잘못된 키면 빈 문자열. */
export function weekdayChar(key: string): string {
  const day = parseKey(key).getDay();
  if (Number.isNaN(day)) return '';
  return WEEKDAYS[day][0];
}

/** 요일 헤더와 같은 색: 일요일 빨강, 토요일 파랑, 나머지는 상속. */
export function weekdayToneClass(key: string): string {
  const day = parseKey(key).getDay();
  if (day === 0) return 'text-red-500/80';
  if (day === 6) return 'text-blue-500/80';
  return '';
}

export function fullLabel(key: string): string {
  const d = parseKey(key);
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const dayName = weekdayLabel(key);
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

export function monthLabel(key: string): string {
  const d = parseKey(key);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}

export function monthKey(key: string): string {
  return key.slice(0, 7);
}

/**
 * 주간 헤더가 가리키는 날짜.
 * 한 주가 두 달에 걸쳐도 달은 하나만 표시한다.
 * 선택된 날짜가 이 주 안에 있으면 그 날짜의 달을 쓰고,
 * 없으면 이 주에서 더 많은 날을 차지하는 달(= 수요일이 속한 달)을 쓴다.
 */
export function weekHeaderKey(weekKey: string, activeKey?: string | null): string {
  const days = weekDays(weekKey);
  if (activeKey && days.includes(activeKey)) return activeKey;
  return days[3];
}

export function monthGrid(key: string): string[] {
  const d = parseKey(key);
  const year = d.getFullYear();
  const month = d.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const gridStartKey = startOfWeek(toKey(firstDayOfMonth));

  const grid: string[] = [];
  let current = gridStartKey;
  for (let i = 0; i < 42; i++) {
    grid.push(current);
    current = addDays(current, 1);
  }
  return grid;
}
