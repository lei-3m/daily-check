/**
 * 루틴: 매일 또는 특정 요일마다 반복하는 할 일.
 *
 * 일반 할 일과 달리 날짜별로 복사되지 않고 정의 하나만 저장합니다.
 * 완료 여부는 날짜별로 따로 기록합니다. 연속 기록(스트릭)은 계산하지 않습니다.
 */
import type { Routine } from './types';

/** 0=일요일 ... 6=토요일. 달력 요일 헤더와 같은 순서입니다. */
export const WEEKDAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

export const EVERYDAY_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

function isWeekday(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6;
}

/** 0~6만 남기고 중복을 없앤 뒤 일요일부터 정렬합니다. */
export function sortWeekdays(weekdays: number[]): number[] {
  return [...new Set(weekdays.filter(isWeekday))].sort((a, b) => a - b);
}

export function isEveryday(weekdays: number[]): boolean {
  return sortWeekdays(weekdays).length === 7;
}

export function toggleWeekday(weekdays: number[], weekday: number): number[] {
  return weekdays.includes(weekday)
    ? sortWeekdays(weekdays.filter((day) => day !== weekday))
    : sortWeekdays([...weekdays, weekday]);
}

export function weekdaysLabel(weekdays: number[]): string {
  const sorted = sortWeekdays(weekdays);
  if (sorted.length === 0) return '요일 없음';
  if (sorted.length === 7) return '매일';
  return sorted.map((day) => WEEKDAY_NAMES[day]).join('·');
}

/** 완료 표시는 완료한 날짜만 남깁니다. false는 저장하지 않습니다. */
export function normalizeDoneMap(done?: Record<string, boolean>): Record<string, boolean> {
  if (!done) return {};
  const result: Record<string, boolean> = {};
  for (const [dateKey, value] of Object.entries(done)) {
    if (value === true) result[dateKey] = true;
  }
  return result;
}

export function normalizeRoutines(routines?: Routine[]): Routine[] {
  if (!routines || routines.length === 0) return [];
  return routines.map((routine, index) => ({
    id: routine.id || `routine-${index}`,
    text: typeof routine.text === 'string' ? routine.text : '',
    weekdays: sortWeekdays(routine.weekdays || []),
    startDate: routine.startDate,
    ...(routine.endDate ? { endDate: routine.endDate } : {}),
    done: normalizeDoneMap(routine.done),
  }));
}
