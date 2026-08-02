import { addDays, parseKey, toKey } from './date';
import type { ScheduleItem } from './types';

export type ScheduleRepeat = NonNullable<ScheduleItem['repeat']>;

export type ScheduleOccurrence = ScheduleItem & {
  occurrenceDate: string;
  sourceDate: string;
};

const MS_PER_DAY = 86400000;

function daysBetween(startKey: string, endKey: string): number {
  return Math.round((parseKey(endKey).getTime() - parseKey(startKey).getTime()) / MS_PER_DAY);
}

function endOfMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function monthIndex(key: string): number {
  const d = parseKey(key);
  return d.getFullYear() * 12 + d.getMonth();
}

function monthlyOccurrenceDate(startKey: string, offset: number): string {
  const start = parseKey(startKey);
  const target = new Date(start.getFullYear(), start.getMonth() + offset, 1);
  const day = Math.min(start.getDate(), endOfMonth(target.getFullYear(), target.getMonth()));
  target.setDate(day);
  return toKey(target);
}

function normalizeRepeat(repeat: ScheduleItem['repeat']): ScheduleRepeat | undefined {
  return repeat === 'weekly' || repeat === 'monthly' ? repeat : undefined;
}

export function expandScheduleInRange(
  schedule: ScheduleItem[],
  startKey: string,
  endKey: string
): ScheduleOccurrence[] {
  const occurrences: ScheduleOccurrence[] = [];

  for (const item of schedule) {
    const repeat = normalizeRepeat(item.repeat);
    const sourceDate = item.date;
    const itemEndKey = item.repeatUntil && item.repeatUntil < endKey ? item.repeatUntil : endKey;

    if (!repeat) {
      if (sourceDate >= startKey && sourceDate <= endKey) {
        occurrences.push({ ...item, occurrenceDate: sourceDate, sourceDate });
      }
      continue;
    }

    if (itemEndKey < startKey || sourceDate > endKey) continue;

    if (repeat === 'weekly') {
      const firstOffset = Math.max(0, Math.ceil(daysBetween(sourceDate, startKey) / 7) * 7);
      for (let dateKey = addDays(sourceDate, firstOffset); dateKey <= itemEndKey; dateKey = addDays(dateKey, 7)) {
        occurrences.push({ ...item, occurrenceDate: dateKey, sourceDate });
      }
      continue;
    }

    const startMonth = monthIndex(sourceDate);
    const rangeStartMonth = monthIndex(startKey);
    const rangeEndMonth = monthIndex(itemEndKey);
    for (let offset = Math.max(0, rangeStartMonth - startMonth); startMonth + offset <= rangeEndMonth; offset++) {
      const dateKey = monthlyOccurrenceDate(sourceDate, offset);
      if (dateKey >= startKey && dateKey <= itemEndKey) {
        occurrences.push({ ...item, occurrenceDate: dateKey, sourceDate });
      }
    }
  }

  return occurrences.sort((a, b) =>
    a.occurrenceDate === b.occurrenceDate
      ? a.text.localeCompare(b.text)
      : a.occurrenceDate.localeCompare(b.occurrenceDate)
  );
}

export function hasRepeat(item: ScheduleItem): boolean {
  return normalizeRepeat(item.repeat) !== undefined;
}
