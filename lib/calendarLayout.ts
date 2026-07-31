import type { EventRow } from './types';

export type PositionedEvent = {
  event: EventRow;
  column: number;
  columnCount: number;
  startMinutes: number;
  durationMinutes: number;
};

const DEFAULT_DURATION_MINUTES = 60;
const MIN_DURATION_MINUTES = 20;

// Greedy column assignment so overlapping events sit side-by-side instead of
// stacking unreadably on top of each other.
// ponytail: columnCount is global for the day, not per-overlap-cluster —
// correct (nothing overlaps visually) but can under-use width when separate
// clusters don't actually overlap each other. Upgrade path: per-cluster
// column counting if that ever looks cramped in practice.
export function layoutDayEvents(events: EventRow[], dayStart: Date): PositionedEvent[] {
  const withTimes = events
    .map((event) => {
      const start = new Date(event.start_time);
      const end = event.end_time
        ? new Date(event.end_time)
        : new Date(start.getTime() + DEFAULT_DURATION_MINUTES * 60000);
      const startMinutes = (start.getTime() - dayStart.getTime()) / 60000;
      const durationMinutes = Math.max((end.getTime() - start.getTime()) / 60000, MIN_DURATION_MINUTES);
      return { event, start, startMinutes, durationMinutes };
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const columnEnds: number[] = [];
  const placed = withTimes.map((item) => {
    let column = columnEnds.findIndex((end) => end <= item.startMinutes);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(0);
    }
    columnEnds[column] = item.startMinutes + item.durationMinutes;
    return { ...item, column };
  });

  const columnCount = Math.max(columnEnds.length, 1);
  return placed.map(({ event, startMinutes, durationMinutes, column }) => ({
    event,
    column,
    columnCount,
    startMinutes,
    durationMinutes,
  }));
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
