import { isCalendarDate } from './payCycleDates';

// Receipt and transaction dates are calendar dates, not UTC instants. Pin both
// parsing and display to UTC so the recorded day survives any browser time zone.
export function formatCalendarDate(value: string): string {
  const day = value.slice(0, 10);
  if (!isCalendarDate(day)) return 'Date unavailable';

  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`));
}
