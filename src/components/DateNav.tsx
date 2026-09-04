import React from 'react';
import { Day, ScheduleItem } from '../lib/types';
import { addDays, addMonths, todayKey } from '../lib/date';
import { WeekStrip } from './WeekStrip';
import { MonthCalendar } from './MonthCalendar';

export type View =
  | { kind: 'week'; anchor: string }
  | { kind: 'month'; anchor: string }
  | { kind: 'drawer' }
  | { kind: 'drawerList'; id: string }
  | { kind: 'scheduleEdit'; id: string | null; returnMonthAnchor?: string }
  | { kind: 'routineList' }
  | { kind: 'routineEdit'; id: string | null };

interface DateNavProps {
  view: View;
  activeKey: string;
  days: Record<string, Day>;
  schedule: ScheduleItem[];
  onChangeView: (newView: View) => void;
  onSelectDate: (key: string) => void;
  onOpenScheduleEdit: (id: string) => void;
}

export function DateNav({
  view,
  activeKey,
  days,
  schedule,
  onChangeView,
  onSelectDate,
  onOpenScheduleEdit,
}: DateNavProps) {
  const today = todayKey();

  if (view.kind === 'week') {
    return (
      <WeekStrip
        anchor={view.anchor}
        activeKey={activeKey}
        days={days}
        schedule={schedule}
        onSelectDate={(key) => {
          onSelectDate(key);
          onChangeView({ kind: 'week', anchor: key });
        }}
        onPrevWeek={() =>
          onChangeView({ kind: 'week', anchor: addDays(view.anchor, -7) })
        }
        onNextWeek={() =>
          onChangeView({ kind: 'week', anchor: addDays(view.anchor, 7) })
        }
        onGoToday={() => {
          onSelectDate(today);
          onChangeView({ kind: 'week', anchor: today });
        }}
        onOpenMonthView={(monthAnchorKey) =>
          onChangeView({ kind: 'month', anchor: monthAnchorKey })
        }
      />
    );
  }

  if (view.kind === 'month') {
    return (
    <MonthCalendar
      anchor={view.anchor}
      activeKey={activeKey}
      days={days}
      schedule={schedule}
      onSelectDate={(key) => {
        onSelectDate(key);
        onChangeView({ kind: 'week', anchor: key });
      }}
      onBackToWeek={() =>
        onChangeView({ kind: 'week', anchor: activeKey })
      }
      onPrevMonth={() =>
        onChangeView({ kind: 'month', anchor: addMonths(view.anchor, -1) })
      }
      onNextMonth={() =>
        onChangeView({ kind: 'month', anchor: addMonths(view.anchor, 1) })
      }
      onOpenScheduleEdit={onOpenScheduleEdit}
    />
    );
  }

  return null;
}
